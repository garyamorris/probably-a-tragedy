"""Nodes of the `casting_call` graph: load -> audition x24 (Send) -> rank [defer] -> recommend -> confirm_cast [interrupt] -> done.

The engine scores every candidate for every role; Madame only gives the verdict a voice; the player has the last word.
"""

from __future__ import annotations

from typing import Any, Literal

from langchain_core.runnables import RunnableConfig
from langgraph.types import Command, Overwrite, Send, interrupt

from tragedy.common.stream import emit
from tragedy.data.tags import ROLES
from tragedy.engine import casting, world
from tragedy.flows.casting_call.state import AuditionInput, CastState
from tragedy.models.factory import voice

MADAME = "Madame Odalys Prunt, an imperious, wounded theatre director who lives off one good review from 1987"
MAX_REASKS = 1  # an invalid confirmation is bounced once; after that Madame's proposal stands


def _int(x: Any, default: int) -> int:
    return x if isinstance(x, int) and not isinstance(x, bool) else default


def _key(night: int, *parts: Any) -> str:
    return ":".join(str(p) for p in (night, "cast", *parts))


def _candidates(raw: Any) -> list[str]:
    """Valid, distinct performer ids in the order given; fewer than three usable ids means 'everyone'."""
    everyone = sorted(world.performers())
    if not isinstance(raw, list):
        return everyone
    seen: list[str] = []
    for x in raw:
        if isinstance(x, str) and x in world.performers() and x not in seen:
            seen.append(x)
    return seen if len(seen) >= len(ROLES) else everyone


def _clean_cast(raw: Any, allowed: list[str]) -> dict[str, str] | None:
    """The resume value may be {"cast": {...}} or the bare cast; anything else (or an unusable cast) is None."""
    if isinstance(raw, dict) and isinstance(raw.get("cast"), dict):
        raw = raw["cast"]
    if not isinstance(raw, dict) or not all(isinstance(raw.get(r), str) for r in ROLES):
        return None
    cast = {r: raw[r] for r in ROLES}
    return cast if casting.valid_cast(cast) and all(a in allowed for a in cast.values()) else None


# --------------------------------------------------------------------------------------------------------- load
async def load(state: CastState) -> Command[Literal["audition"]]:
    night, seed = _int(state.get("night"), 0), _int(state.get("seed"), 0)
    genre = state.get("genre")
    if genre not in world.genres():
        genre = sorted(world.genres())[0]
    ids = _candidates(state.get("candidates"))
    sends = [
        Send("audition", AuditionInput(actor=a, role=r, genre=genre, seed=seed, night=night)) for r in ROLES for a in ids
    ]
    emit("progress", _key(night, "progress", 0), agent="madame", label="Auditions open", pct=0)
    return Command(
        update={
            "night": night, "seed": seed, "genre": genre, "candidate_ids": ids,
            "auditions": Overwrite([]), "attempts": 0,  # a re-run on the same thread starts clean
        },
        goto=sends,
    )


# --------------------------------------------------------------------------------------------------------- audition
async def audition(p: AuditionInput) -> dict[str, Any]:
    """One candidate x one role (24 of these run in parallel). Pure engine; the line is a real line from the genre."""
    score = casting.audition_score(p["actor"], p["role"], p["genre"], p["seed"], p["night"])
    line = casting.audition_line(p["actor"], p["role"], p["genre"], p["seed"], p["night"])
    emit(
        "cast.audition", _key(p["night"], "audition", p["role"], p["actor"]), agent=p["actor"],
        role=p["role"], actor=p["actor"], score=score, line=line,
    )
    return {"auditions": [{"role": p["role"], "actor": p["actor"], "score": score, "line": line}]}


# --------------------------------------------------------------------------------------------------------- rank
async def rank(state: CastState) -> dict[str, Any]:
    """defer=True: runs once every audition has landed. Builds the {role: {actor: score}} table in a stable order."""
    by = {(a["role"], a["actor"]): a["score"] for a in state["auditions"]}
    scores = {r: {a: by[(r, a)] for a in state["candidate_ids"] if (r, a) in by} for r in ROLES}
    emit("progress", _key(state["night"], "progress", 1), agent="clipboard", label="Auditions scored", pct=60)
    return {"scores": scores}


# --------------------------------------------------------------------------------------------------------- recommend
async def recommend(state: CastState, config: RunnableConfig) -> dict[str, Any]:
    proposed = casting.recommend(state["scores"])
    draft = casting.recommendation_note(proposed, state["genre"])
    note = await voice(MADAME, draft, actor="madame", config=config)
    emit("cast.recommend", _key(state["night"], "recommend"), agent="madame", cast=proposed, note=note, scores=state["scores"])
    return {"proposed": proposed, "note": note}


# --------------------------------------------------------------------------------------------------------- confirm_cast
def _flaw_names(ids: list[str]) -> dict[str, list[str]]:
    return {a: [world.flaws()[f]["name"] for f in world.performers()[a]["flaws"]] for a in ids}


async def confirm_cast(state: CastState) -> Command[Literal["confirm_cast", "done"]]:
    """The player confirms (or edits) the cast. Everything above `interrupt()` is pure: the node re-runs on resume."""
    proposed, attempts = state["proposed"], state.get("attempts", 0)
    payload: dict[str, Any] = {
        "kind": "confirm_cast",
        "proposed": proposed,
        "scores": state["scores"],
        "note": state["note"],
        "genre": state["genre"],
        "roles": dict(world.genres()[state["genre"]]["roles"]),
        "flaws": _flaw_names(state["candidate_ids"]),
    }
    if attempts:
        payload["error"] = "That cast will not do: three different candidates, one per role, please."
    cast = _clean_cast(interrupt(payload), state["candidate_ids"])
    if cast:
        return Command(update={"cast": cast}, goto="done")
    if attempts < MAX_REASKS:  # re-ask ONCE (a fresh task, so a fresh interrupt)
        return Command(update={"attempts": attempts + 1}, goto="confirm_cast")
    emit("note", _key(state["night"], "fallback"), agent="madame", text="Darling, no. Madame's cast stands.")
    return Command(update={"cast": proposed}, goto="done")


# --------------------------------------------------------------------------------------------------------- done
async def done(state: CastState) -> dict[str, Any]:
    emit("progress", _key(state["night"], "progress", 2), agent="madame", label="The cast is set", pct=100)
    return {}
