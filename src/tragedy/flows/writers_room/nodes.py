"""Nodes of the `writers_room` graph.

    brief -> [fan_out: Send x3] quill (SUBGRAPH: draft -> self_check -> present) -> judge [defer]
          -> (best true score < 0.45 and no revision yet ? revise -> [fan_out again] : pick_draft [interrupt]) -> finalize

The engine writes and scores the scripts; the quills only give the tagline a voice; the player picks. The true score
is never stored or sent anywhere (state is streamed to the client): it is recomputed by the engine when judging, and
the events and the interrupt payload carry Madame's noisy `confidence` instead.
"""

from __future__ import annotations

from typing import Any, Literal

from langgraph.types import Overwrite, Send, interrupt

from tragedy.common.stream import emit
from tragedy.engine import casting, world
from tragedy.engine import script as scr
from tragedy.flows.writers_room.quill import public_beats
from tragedy.flows.writers_room.state import QuillInput, WritersState

REVISE_BELOW = 0.45  # if even the best draft is worse than this, Madame sends the quills back...
MAX_REVISIONS = 1  # ...once


def _int(x: Any, default: int) -> int:
    return x if isinstance(x, int) and not isinstance(x, bool) else default


def _key(night: int, *parts: Any) -> str:
    return ":".join(str(p) for p in (night, "wr", *parts))


def _traditions(raw: Any) -> list[str]:
    """Calamity slugs; the tour state stores dicts ({"calamity", "title", "count"}), so accept both."""
    out: list[str] = []
    for x in raw if isinstance(raw, list) else []:
        slug = x.get("calamity") if isinstance(x, dict) else x
        if isinstance(slug, str) and slug and slug not in out:
            out.append(slug)
    return out


def _cast(raw: Any, genre: str, seed: int, night: int) -> dict[str, str]:
    if casting.valid_cast(raw if isinstance(raw, dict) and all(isinstance(v, str) for v in raw.values()) else None):
        return dict(raw)
    return casting.recommend(casting.score_table(genre, seed, night))


def current_drafts(state: WritersState) -> list[dict[str, Any]]:
    """The latest round's drafts, one per quill, in the quills' fixed order (never completion order)."""
    latest = {d["draft_id"]: d for d in state.get("drafts", []) if d["round"] == state.get("round", 0)}
    return sorted(latest.values(), key=lambda d: scr.QUILLS.index(d["quill"]))


def true_score(state: WritersState, d: dict[str, Any]) -> float:
    """The engine's hidden verdict on a draft (pure, so recomputing it is free and keeps it out of every stream)."""
    return scr.score_script(
        d["script"], town=state["town"], cast=state["cast"], genre=state["genre"], traditions=state["traditions"]
    )


def truly_best(state: WritersState, drafts: list[dict[str, Any]]) -> dict[str, Any]:
    return max(drafts, key=lambda d: (true_score(state, d), -scr.QUILLS.index(d["quill"])))


def public(d: dict[str, Any]) -> dict[str, Any]:
    """A draft as the player sees it: no script body, and above all no true score."""
    return {
        "draft_id": d["draft_id"], "quill": d["quill"], "title": d["title"], "tagline": d["tagline"],
        "beats": public_beats(d["script"]), "confidence": d["confidence"],
    }


# --------------------------------------------------------------------------------------------------------- brief
async def brief(state: WritersState) -> dict[str, Any]:
    night, seed = _int(state.get("night"), 0), _int(state.get("seed"), 0)
    genre = state.get("genre") if state.get("genre") in world.genres() else sorted(world.genres())[0]
    town = state.get("town") if state.get("town") in world.towns() else sorted(world.towns())[0]
    cast = _cast(state.get("cast"), genre, seed, night)
    temp = world.towns()[town]["temperament"]
    emit(
        "note", _key(night, "brief"), agent="madame",
        text=(
            f"Brief: {world.genres()[genre]['name']} for {world.towns()[town]['name']}. "
            f"They like {', '.join(temp['likes'])}; they cannot abide {', '.join(temp['hates'])}."
        ),
    )
    emit("progress", _key(night, "progress", 0), agent="madame", label="The quills are briefed", pct=0)
    return {
        "night": night, "seed": seed, "genre": genre, "town": town, "cast": cast,
        "traditions": _traditions(state.get("traditions")), "round": 0, "revisions": 0,
        "drafts": Overwrite([]),  # a re-run on the same thread starts clean
    }


def fan_out(state: WritersState) -> list[Send]:
    """Conditional-edge router (after `brief` and after `revise`): one copy of the `quill` subgraph per heron."""
    return [
        Send(
            "quill",
            QuillInput(
                quill=q, seed=state["seed"], night=state["night"], genre=state["genre"], town=state["town"],
                cast=state["cast"], traditions=state["traditions"], round=state["round"],
            ),
        )
        for q in scr.QUILLS
    ]


# --------------------------------------------------------------------------------------------------------- judge
async def judge(state: WritersState) -> dict[str, Any]:
    """defer=True: runs once all three quills are in. Builds the player's shortlist (the verdict is `route_after_judge`)."""
    emit("progress", _key(state["night"], "progress", 1 + state["round"]), agent="clipboard", label="Drafts judged", pct=60)
    return {"shortlist": [public(d) for d in current_drafts(state)]}


def route_after_judge(state: WritersState) -> Literal["revise", "pick_draft"]:
    """Conditional edge: if even the TRULY best draft is weak and we have not revised yet, send the quills back."""
    best = true_score(state, truly_best(state, current_drafts(state)))
    return "revise" if best < REVISE_BELOW and state.get("revisions", 0) < MAX_REVISIONS else "pick_draft"


# --------------------------------------------------------------------------------------------------------- revise
async def revise(state: WritersState) -> dict[str, Any]:
    rnd = state["round"] + 1
    emit("note", _key(state["night"], "revise", rnd), agent="madame", text="Darling, no. Not one of these will do. Again.")
    return {"round": rnd, "revisions": state.get("revisions", 0) + 1}


# --------------------------------------------------------------------------------------------------------- pick_draft
def _clean_pick(raw: Any, ids: list[str]) -> str | None:
    if isinstance(raw, dict):
        raw = raw.get("draft_id")
    return raw if isinstance(raw, str) and raw in ids else None


async def pick_draft(state: WritersState) -> dict[str, Any]:
    """The player picks. Everything above `interrupt()` is pure (the node re-runs on resume)."""
    shortlist = state["shortlist"]
    ids = [d["draft_id"] for d in shortlist]
    picked = _clean_pick(interrupt({"kind": "pick_draft", "drafts": shortlist}), ids)
    return {"chosen_id": picked or truly_best(state, current_drafts(state))["draft_id"]}  # garbage -> the truly best


# --------------------------------------------------------------------------------------------------------- finalize
async def finalize(state: WritersState) -> dict[str, Any]:
    chosen = next(d for d in current_drafts(state) if d["draft_id"] == state["chosen_id"])
    emit("script.chosen", _key(state["night"], "chosen"), agent="prompter", draft_id=chosen["draft_id"])
    emit("progress", _key(state["night"], "progress", 9), agent="madame", label="The play is chosen", pct=100)
    return {"script": chosen["script"]}
