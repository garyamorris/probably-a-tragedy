"""Studio-friendly inputs: fill in ONLY what the caller left blank, never override what they gave.

The game always sends every field. LangGraph Studio's form does not: a person types a tour id and a genre, not a `cast` and a
`script` as JSON. Without this, `performance`, `almanac` and `the_road` crashed with `KeyError: 'tour_id'` / `'seed'` / `'night'`.
Each of those graphs now starts with a `defaults` step that completes the input from the engine (a recommended cast, a drafted
script, a headless result) and says so in a `note` event. When the input is already complete it writes nothing new.
"""

from __future__ import annotations

from typing import Any

from tragedy.engine import casting, world
from tragedy.engine import show as show_engine
from tragedy.engine import tour as tour_rules
from tragedy.engine.script import draft_script
from tragedy.tour_store import GraphStore, get_tour

DEMO_TOUR = "studio-demo"
DEMO_SEED = 7


def _has_beats(script: Any) -> bool:
    return isinstance(script, dict) and bool(script.get("beats"))


def _is_result(result: Any) -> bool:
    """A caller-supplied show result is kept as given if it looks like one (a trimmed one may carry no beats at all)."""
    return isinstance(result, dict) and any(k in result for k in ("beats", "mishaps", "calamities", "warmth"))


async def complete(
    state: dict[str, Any], store: Any, *, cast: bool = False, script: bool = False, result: bool = False, next_town: bool = False
) -> dict[str, Any]:
    """Return the (possibly extended) common input keys. Always includes tour_id/night/seed so the step always writes something."""
    tour_id = str(state.get("tour_id") or DEMO_TOUR)
    night = int(state.get("night") or 0)
    stored = await get_tour(GraphStore(store), tour_id)
    seed = state.get("seed")
    seed = int(seed) if seed is not None else int(stored["seed"] if stored else DEMO_SEED)
    tour = stored or tour_rules.new_tour(seed, tour_id)  # not persisted: only used to read the town order
    towns = tour.get("towns") or sorted(world.towns())[:5]
    out: dict[str, Any] = {"tour_id": tour_id, "night": night, "seed": seed}
    filled: list[str] = [k for k in ("tour_id", "night", "seed") if state.get(k) is None or (k == "tour_id" and not state.get(k))]

    genre = state.get("genre") or "farce"
    town = state.get("town") or (towns[night] if night < len(towns) else towns[-1])
    out["genre"], out["town"] = genre, town
    filled += [k for k in ("genre", "town") if not state.get(k)]

    have_cast = state.get("cast") if casting.valid_cast(state.get("cast")) else None
    if cast or script or result:
        out["cast"] = have_cast or casting.recommend(casting.score_table(genre, seed, night))
        if not have_cast:
            filled.append("cast")
    if script or result:
        sc = state.get("script") if _has_beats(state.get("script")) else None
        trads = [t["calamity"] for t in tour.get("traditions", [])]
        out["script"] = sc or draft_script("quill_tender", seed=seed, night=night, genre=genre, town=town, cast=out["cast"], traditions=trads)
        if not sc:
            filled.append("script")
    if result:
        res = state.get("result") if _is_result(state.get("result")) else None
        out["result"] = res or show_engine.simulate_show(
            seed=seed, night=night, genre=genre, town=town, cast=out["cast"], script=out["script"],
            rapport=tour.get("rapport", {}), traditions=tour.get("traditions", []), policy="best",
        )
        if not res:
            filled.append("result")
    if next_town and "next_town" not in state:
        out["next_town"] = towns[night + 1] if night + 1 < len(towns) else None
    out["_filled"] = filled  # stripped by the caller; used only for the note
    return out
