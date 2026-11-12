"""Nodes of the `reviews` graph: gather -> critics x5 (Send) -> reduce [defer] -> headline (voice, streams) -> file_review (Store).

Stars and funds come from the engine; the pigeons' pull-quotes are engine templates; the sub-editor only gives the headline
a voice. Filing the notice writes the tour state in the Store.
"""

from __future__ import annotations

from typing import Any, Literal

from langchain_core.runnables import RunnableConfig
from langgraph.runtime import Runtime
from langgraph.types import Command, Overwrite, Send

from tragedy.common.stream import emit
from tragedy.engine import casting, world
from tragedy.engine import review as rv
from tragedy.engine import script as scr
from tragedy.engine import show as eng
from tragedy.engine import tour as tour_rules
from tragedy.flows.reviews.state import CriticInput, ReviewsState
from tragedy.models.factory import voice
from tragedy.tour_store import GraphStore, get_tour, put_tour

SUB_EDITOR = "a pompous newspaper sub-editor"
HEADLINE_STYLE = "Write it as a single ALL-CAPS newspaper headline of at most 12 words."


def _int(x: Any, default: int) -> int:
    return x if isinstance(x, int) and not isinstance(x, bool) else default


def _key(night: int, *parts: Any) -> str:
    return ":".join(str(p) for p in (night, "reviews", *parts))


async def _load_tour(runtime: Runtime[Any], tour_id: Any) -> dict[str, Any] | None:
    """The tour state from the Store, or None (no Store, no tour, or an id the Store cannot hold as a namespace label)."""
    if not (isinstance(tour_id, str) and tour_id and "." not in tour_id):
        return None
    return await get_tour(GraphStore(runtime.store), tour_id)


def _is_cast(x: Any) -> bool:
    return isinstance(x, dict) and all(isinstance(v, str) for v in x.values()) and casting.valid_cast(x)


# --------------------------------------------------------------------------------------------------------- gather
async def gather(state: ReviewsState, runtime: Runtime[Any]) -> Command[Literal["critics"]]:
    """Loads the tour's Traditions from the Store, tidies the inputs, and sends the show to every pigeon."""
    night, seed = _int(state.get("night"), 0), _int(state.get("seed"), 0)
    genre = state.get("genre") if state.get("genre") in world.genres() else sorted(world.genres())[0]
    town = state.get("town") if state.get("town") in world.towns() else sorted(world.towns())[0]
    cast = state["cast"] if _is_cast(state.get("cast")) else casting.recommend(casting.score_table(genre, seed, night))
    script = state.get("script")
    if not (isinstance(script, dict) and isinstance(script.get("beats"), list) and len(script["beats"]) == 5):
        script = scr.draft_script("quill_tender", seed=seed, night=night, genre=genre, town=town, cast=cast, traditions=[])
    result = state.get("result")
    if not (isinstance(result, dict) and "quality_avg" in result and "chaos" in result):
        # Studio convenience: no performance result handed over, so review an imaginary night of this cast and script
        result = eng.simulate_show(seed=seed, night=night, genre=genre, town=town, cast=cast, script=script, policy="best")
    tour = await _load_tour(runtime, state.get("tour_id")) or {}
    traditions = [t for t in tour.get("traditions", []) if isinstance(t, dict) and t.get("title")]
    sends = [
        Send(
            "critics",
            CriticInput(
                critic=c["id"], seed=seed, night=night, town=town, cast=cast, script=script, result=result,
                traditions=traditions,
            ),
        )
        for c in world.critics()
    ]
    emit("progress", _key(night, "progress", 0), agent="clipboard", label="The pigeons take their seats", pct=0)
    return Command(
        update={
            "night": night, "seed": seed, "genre": genre, "town": town, "cast": cast, "script": script,
            "result": result, "traditions": traditions,
            "reviews": Overwrite([]),  # a re-run on the same thread starts clean
        },
        goto=sends,
    )


# --------------------------------------------------------------------------------------------------------- critics
async def critics(p: CriticInput) -> dict[str, Any]:
    """One pigeon (5 run in parallel): same show, different weights."""
    critic = next(c for c in world.critics() if c["id"] == p["critic"])
    r = rv.review_one(
        critic, p["result"], script=p["script"], cast=p["cast"], town=p["town"], traditions=p["traditions"],
        seed=p["seed"], night=p["night"],
    )
    emit(
        "review.pigeon", _key(p["night"], "pigeon", r["critic"]), agent=r["critic"],
        critic=r["critic"], name=r["name"], outlet=r["outlet"], stars=r["stars"], quote=r["quote"],
    )
    return {"reviews": [r]}


# --------------------------------------------------------------------------------------------------------- reduce
async def reduce(state: ReviewsState) -> dict[str, Any]:
    """defer=True: runs once all five notices are in."""
    stars = rv.final_stars(state["reviews"])
    funds = rv.funds_delta(stars, state["result"]["warmth"])
    emit("progress", _key(state["night"], "progress", 1), agent="clipboard", label="The notices are tallied", pct=60)
    return {"stars": stars, "funds_delta": funds}


# --------------------------------------------------------------------------------------------------------- headline
async def headline(state: ReviewsState, config: RunnableConfig) -> dict[str, Any]:
    draft = rv.headline_draft(
        state["stars"], state["result"], script=state["script"], town=state["town"], seed=state["seed"], night=state["night"]
    )
    text = await voice(SUB_EDITOR, draft, style=HEADLINE_STYLE, actor="sub_editor", config=config)
    text = " ".join(text.split())[:160] or draft
    emit("review.headline", _key(state["night"], "headline"), agent="sub_editor", text=text, stars=state["stars"], funds_delta=state["funds_delta"])
    return {"headline": text}


# --------------------------------------------------------------------------------------------------------- file_review
async def file_review(state: ReviewsState, runtime: Runtime[Any]) -> dict[str, Any]:
    """Files the notice in the tour's history and pays out the funds. Idempotent per night; no tour in the Store -> skipped."""
    tour = await _load_tour(runtime, state.get("tour_id"))
    if tour is None:
        return {}
    entry = {
        "night": state["night"], "town": state["town"], "genre": state["genre"], "title": state["script"]["title"],
        "stars": state["stars"], "headline": state["headline"], "funds_delta": state["funds_delta"], "cast": dict(state["cast"]),
    }
    previous = next((h for h in tour.get("history", []) if h.get("night") == entry["night"]), None)
    if previous == entry:  # a replayed node: already filed, nothing to pay twice
        return {}
    if previous is not None:  # a re-run of the same night with a different outcome replaces it (and its payout)
        tour = {**tour, "funds": int(tour["funds"]) - int(previous.get("funds_delta", 0))}
    await put_tour(GraphStore(runtime.store), tour_rules.file_review(tour, entry))
    emit("progress", _key(state["night"], "progress", 2), agent="clipboard", label="Filed in the tour's history", pct=100)
    return {}
