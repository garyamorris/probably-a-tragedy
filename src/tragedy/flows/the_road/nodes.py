"""Nodes of the `the_road` graph.

DURABLE EXECUTION / CRASH RECOVERY (the demo): run this graph with ``durability="sync"`` so a checkpoint is written *before* each
next step starts. With ``crash=true`` the node ``apply`` raises ``RuntimeError("the wagon lost a wheel")`` the first time it runs
for a (tour, night); the run fails, the thread keeps its last checkpoint (everything up to and including the crossroads), and the
client simply resumes the thread with ``input=None``. ``depart``, ``weather``, ``roll_event`` and ``crossroads`` are NOT re-run
(their events are not repeated and the Prompter is not asked again); only ``apply`` re-executes, and this time succeeds.
What makes the second attempt succeed is real persisted state, not a flag in graph state: a marker in the Store at
``("crash", tour_id)/night<N>``, written BEFORE the raise.

CRON: the wagon could also roll on a schedule (e.g. a nightly "ghost wagon" for an abandoned tour). Nothing wires it; every node is
deterministic from the input, so a scheduled run is safe. Bind it to a thread (``create_for_thread``) because the crossroads waits for
an answer; ``client.crons.create(assistant_id, schedule=..., input=...)`` is the thread-less equivalent::

    await client.crons.create_for_thread(
        thread_id, "the_road", schedule="0 9 * * *", durability="sync",
        input={"tour_id": tid, "night": n, "seed": seed, "from_town": a, "to_town": b},
    )
"""

from __future__ import annotations

from typing import Any

from langgraph.runtime import Runtime
from langgraph.types import interrupt

from tragedy.common.rng import pick, weighted
from tragedy.common.stream import emit
from tragedy.engine import tour as tour_rules
from tragedy.engine import world
from tragedy.flows.the_road.state import RoadState
from tragedy.tour_store import GraphStore, get_tour, put_tour

CRASH_MESSAGE = "the wagon lost a wheel"
RAPPORT_MAX = 5

WEATHER: tuple[tuple[str, str], ...] = (
    ("drizzle", "Drizzle, with opinions."),
    ("fog", "Fog so thick the horse asks the wagon for directions."),
    ("sun", "Unexpected sunshine. Everyone's paint begins to bubble."),
    ("wind", "A headwind. Hats are in danger; Hortensia holds hers hostage."),
    ("hail", "Hail, in neat rows, as if rehearsed."),
    ("frost", "A crisp frost. The goose files a formal complaint."),
    ("rainbow", "A rainbow, which Mr. Tock logs as 'suspicious'."),
    ("thunder", "Distant thunder. Gus takes notes for later; he has never done thunder."),
    ("mud", "Mud to the axle. The wagon is now technically a boat."),
)


def _k(night: int, *parts: Any) -> str:
    return ":".join(str(p) for p in ("road", night, *parts))


def _town_name(town_id: str | None) -> str:
    town = world.towns().get(town_id or "")
    return town["name"] if town else str(town_id or "somewhere").replace("_", " ").title()


def truthy(v: Any) -> bool:
    return v.strip().lower() in ("1", "true", "yes", "on") if isinstance(v, str) else bool(v)


async def _tour(st: GraphStore, state: RoadState) -> dict[str, Any]:
    return await get_tour(st, state["tour_id"]) or tour_rules.new_tour(int(state.get("seed", 0)), state["tour_id"])


def _public_choices(choices: list[dict[str, Any]]) -> list[dict[str, str]]:
    return [{"id": c["id"], "label": c["label"]} for c in choices]


# ----------------------------------------------------------------------------------------------------- depart
async def studio_defaults(state: RoadState, runtime: Runtime[Any]) -> dict[str, Any]:
    """Complete a partial input (LangGraph Studio's form): fills only what is blank, never overrides; a no-op for the game."""
    from tragedy.flows.defaults import complete

    out = await complete(dict(state), runtime.store)
    filled = out.pop("_filled")
    if filled:
        emit("note", f"defaults:{out['night']}", agent="defaults", text="Filled in what was left blank: " + ", ".join(filled) + ".")
    return out



async def depart(state: RoadState, runtime: Runtime[Any]) -> dict[str, Any]:
    night = int(state.get("night", 0))
    tour = await _tour(GraphStore(runtime.store), state)
    towns = tour.get("towns", [])
    from_town = state.get("from_town") or tour.get("wagon", {}).get("at") or (towns[night] if night < len(towns) else None)
    to_town = state.get("to_town") or (towns[night + 1] if night + 1 < len(towns) else None)
    emit("road.step", _k(night, "step", "depart"), agent="the_road", pct=10, label=f"Leaving {_town_name(from_town)}")
    return {"from_town": from_town, "to_town": to_town}


# ----------------------------------------------------------------------------------------------------- weather
async def weather(state: RoadState) -> dict[str, Any]:
    night, seed = int(state.get("night", 0)), int(state.get("seed", 0))
    kind, line = pick(WEATHER, seed, night, "weather")
    emit("road.step", _k(night, "step", "weather"), agent="the_road", pct=30, label=f"Weather: {line}")
    return {"forecast": {"kind": kind, "line": line}}


# ----------------------------------------------------------------------------------------------------- roll_event
def roll(seed: int, night: int) -> dict[str, Any]:
    """The road event for this (seed, night): a weighted pick from road_events.json, a pure function of its inputs."""
    events = world.road_events()
    return weighted(events, [float(e.get("weight", 1)) for e in events], seed, night, "road-event")


async def roll_event(state: RoadState) -> dict[str, Any]:
    night, seed = int(state.get("night", 0)), int(state.get("seed", 0))
    ev = roll(seed, night)
    choices = list(ev.get("choices") or [])
    emit("road.event", _k(night, "event"), agent="the_road", id=ev["id"], title=ev["title"], text=ev["text"], choices=_public_choices(choices))
    emit("road.step", _k(night, "step", "event"), agent="the_road", pct=50, label=ev["title"])
    return {"event": {"id": ev["id"], "title": ev["title"], "text": ev["text"]}, "choices": choices}


def route_after_roll(state: RoadState) -> str:
    return "crossroads" if state.get("choices") else "apply"


# ----------------------------------------------------------------------------------------------------- crossroads
def clean_choice(raw: Any, choices: list[dict[str, Any]]) -> str:
    """Resume value `{"choice": <id>}`; anything invalid (garbage, unknown id) takes the first choice."""
    ids = [c["id"] for c in choices]
    want = raw.get("choice") if isinstance(raw, dict) else raw if isinstance(raw, str) else None
    return want if isinstance(want, str) and want in ids else ids[0]


async def crossroads(state: RoadState) -> dict[str, Any]:
    ev, choices = state["event"], state["choices"]
    raw = interrupt({"kind": "crossroads", "event": ev, "choices": _public_choices(choices)})  # pure above this line
    choice = clean_choice(raw, choices)
    label = next(c["label"] for c in choices if c["id"] == choice)
    emit("road.step", _k(int(state.get("night", 0)), "step", "chose"), agent="the_road", pct=62, label=f"The wagon goes with: {label}")
    return {"choice": choice}


# ----------------------------------------------------------------------------------------------------- apply
async def apply(state: RoadState, runtime: Runtime[Any]) -> dict[str, Any]:
    """Effects, then the wagon moves on (night + 1, candles refilled). The only node that can crash, and it does so BEFORE any effect."""
    st = GraphStore(runtime.store)
    night, tour_id = int(state.get("night", 0)), state["tour_id"]

    if truthy(state.get("crash")):
        marker = f"night{night}"
        if await st.get(("crash", tour_id), marker) is None:
            await st.put(("crash", tour_id), marker, {"node": "apply", "night": night}, index=False)  # BEFORE raising: the retry sees it
            emit("road.crash", _k(night, "crash", 0), agent="the_road", node="apply", recovered=False)
            raise RuntimeError(CRASH_MESSAGE)
        emit("road.crash", _k(night, "crash", 1), agent="the_road", node="apply", recovered=True)

    ev, choices = state["event"], state.get("choices") or []
    choice = next((c for c in choices if c["id"] == state.get("choice")), None)
    effects = dict((choice or {}).get("effects") or ev.get("effects") or {})

    tour = await _tour(st, state)
    to_town = state.get("to_town") or tour.get("wagon", {}).get("at")
    if int(tour.get("night", 0)) <= night:  # idempotent: a replayed apply never moves the wagon twice
        tour = tour_rules.apply_effects(tour, effects)
        for actor in effects.get("rapport") or {}:  # rapport lives in 0..5
            tour["rapport"][actor] = max(0, min(RAPPORT_MAX, int(tour["rapport"].get(actor, 0))))
        tour = tour_rules.advance(tour, to_town)
        await put_tour(st, tour)
    emit("road.step", _k(night, "step", "apply"), agent="the_road", pct=85, label=f"Nearly in {_town_name(to_town)}")
    return {"effects": effects, "choice": choice["id"] if choice else None}


# ----------------------------------------------------------------------------------------------------- arrive
async def arrive(state: RoadState) -> dict[str, Any]:
    night = int(state.get("night", 0))
    town = state.get("to_town") or ""
    emit("road.arrive", _k(night, "arrive"), agent="the_road", town=town)
    emit("road.step", _k(night, "step", "arrive"), agent="the_road", pct=100, label=f"Welcome to {_town_name(town)}")
    return {"arrived": town}
