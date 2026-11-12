from __future__ import annotations

import pytest
from langgraph.types import Command

from tragedy.common.rng import weighted
from tragedy.common.stream import capture
from tragedy.engine import tour as tour_rules
from tragedy.engine import world
from tragedy.flows.the_road.build import build
from tragedy.flows.the_road.nodes import CRASH_MESSAGE, roll
from tragedy.tour_store import GraphStore, get_tour, put_tour

SEED, TOUR = 7, "tour-road"


def cfg(thread: str) -> dict:
    return {"configurable": {"thread_id": thread}}


def inp(night: int = 0, crash: bool = False, seed: int = SEED) -> dict:
    towns = tour_rules.new_tour(SEED, TOUR)["towns"]
    return {"tour_id": TOUR, "night": night, "seed": seed, "from_town": towns[night], "to_town": towns[night + 1], "crash": crash}


async def _tour_in(store, **patch) -> GraphStore:
    st = GraphStore(store)
    await put_tour(st, {**tour_rules.new_tour(SEED, TOUR), **patch})
    return st


async def run(graph, input_, config, chooser=lambda p: {"choice": p["choices"][0]["id"]}, max_steps=6):
    """Like tests.helpers.drive, but with durability='sync' (what the client passes for this graph) and errors surfaced to the caller."""
    asked, cur = [], input_
    for _ in range(max_steps):
        await graph.ainvoke(cur, config, durability="sync")
        snap = await graph.aget_state(config)
        if not snap.interrupts:
            break
        asked += [i.value for i in snap.interrupts]
        cur = Command(resume={i.id: chooser(i.value) for i in snap.interrupts})
    return (await graph.aget_state(config)).values, asked


def event_for(seed: int, night: int) -> dict:
    return roll(seed, night)


def pick_seed(predicate) -> int:
    return next(s for s in range(500) if predicate(roll(s, 0)))


# --------------------------------------------------------------------------------------------- the happy road
async def test_the_wagon_rolls_to_the_next_town(saver, store):
    st = await _tour_in(store)
    graph = build(saver, store)
    with capture() as events:
        values, asked = await run(graph, inp(), cfg("r1"))
    ev = event_for(SEED, 0)
    assert len(asked) == 1 and asked[0]["kind"] == "crossroads"
    assert asked[0]["event"] == {"id": ev["id"], "title": ev["title"], "text": ev["text"]}
    assert asked[0]["choices"] == [{"id": c["id"], "label": c["label"]} for c in ev["choices"]], "the Prompter sees labels, not effects"
    towns = inp()["to_town"]
    assert values["arrived"] == towns and values["choice"] == ev["choices"][0]["id"]
    assert values["event"]["id"] == ev["id"] and values["effects"] == ev["choices"][0]["effects"]

    kinds = [e["kind"] for e in events]
    assert kinds.count("road.event") == 1 and kinds.count("road.arrive") == 1 and "road.crash" not in kinds
    steps = [e["data"] for e in events if e["kind"] == "road.step"]
    assert [s["pct"] for s in steps] == sorted(s["pct"] for s in steps) and steps[0]["pct"] < 20 and steps[-1]["pct"] == 100
    assert any(s["label"].startswith("Weather: ") for s in steps)
    road_event = next(e for e in events if e["kind"] == "road.event")["data"]
    assert road_event == {"id": ev["id"], "title": ev["title"], "text": ev["text"], "choices": asked[0]["choices"]}
    assert next(e for e in events if e["kind"] == "road.arrive")["data"] == {"town": towns}
    assert len({e["key"] for e in events}) == len(events), "event keys must be unique within a run"

    tour = await get_tour(st, TOUR)
    assert tour["night"] == 1 and tour["wagon"] == {"at": towns} and tour["candles"] == 2


async def test_the_same_seed_and_night_roll_the_same_event(saver, store):
    await _tour_in(store)
    a = await run(build(saver, store), inp(), cfg("d1"))
    await _tour_in(store)
    b = await run(build(saver, store), inp(), cfg("d2"))
    assert a == b
    assert event_for(SEED, 0) == event_for(SEED, 0)
    seen = {event_for(s, n)["id"] for s in range(40) for n in range(5)}
    assert len(seen) >= 10, "the weighted draw reaches most of the 20 road events"


def test_the_roll_follows_the_dataset_weights():
    events = world.road_events()
    weights = [float(e["weight"]) for e in events]
    for s in range(30):
        assert roll(s, 2) is weighted(events, weights, s, 2, "road-event")


async def test_the_crossroads_choice_applies_its_effects(saver, store):
    seed = pick_seed(lambda e: any(c["effects"].get("funds", 0) < 0 and c["effects"].get("rapport") for c in e["choices"]))
    ev = roll(seed, 0)
    choice = next(c for c in ev["choices"] if c["effects"].get("funds", 0) < 0 and c["effects"].get("rapport"))
    st = await _tour_in(store, funds=8, rapport={"goose": 1})
    values, _ = await run(build(saver, store), inp(seed=seed), cfg("e1"), lambda p: {"choice": choice["id"]})
    assert values["choice"] == choice["id"] and values["effects"] == choice["effects"]
    tour = await get_tour(st, TOUR)
    assert tour["funds"] == max(0, 8 + choice["effects"]["funds"])
    for actor, n in choice["effects"]["rapport"].items():
        assert tour["rapport"][actor] == max(0, min(5, (1 if actor == "goose" else 0) + n))
    assert tour["night"] == 1


async def test_encore_and_morale_effects_are_kept(saver, store):
    seed = pick_seed(lambda e: any(c["effects"].get("encore") for c in e["choices"]))
    choice = next(c for c in roll(seed, 0)["choices"] if c["effects"].get("encore"))
    st = await _tour_in(store, encore=2)
    await run(build(saver, store), inp(seed=seed), cfg("e2"), lambda p: {"choice": choice["id"]})
    tour = await get_tour(st, TOUR)
    assert tour["encore"] == 2 + choice["effects"]["encore"]
    assert tour.get("morale", 0) == choice["effects"].get("morale", 0)


async def test_funds_never_go_below_zero(saver, store):
    seed = pick_seed(lambda e: any(c["effects"].get("funds", 0) <= -2 for c in e["choices"]))
    choice = next(c for c in roll(seed, 0)["choices"] if c["effects"].get("funds", 0) <= -2)
    st = await _tour_in(store, funds=0)
    await run(build(saver, store), inp(seed=seed), cfg("e3"), lambda p: {"choice": choice["id"]})
    assert (await get_tour(st, TOUR))["funds"] == 0


@pytest.mark.parametrize("garbage", ["banana", None, 3, {}, {"choice": "no_such_choice"}, {"choice": 7}, ["bribe"]])
async def test_garbage_resume_takes_the_first_choice(saver, store, garbage):
    st = await _tour_in(store)
    values, asked = await run(build(saver, store), inp(), cfg("g"), lambda p: garbage)
    assert values["choice"] == asked[0]["choices"][0]["id"] and values["arrived"] == inp()["to_town"]
    assert (await get_tour(st, TOUR))["night"] == 1


async def test_a_replayed_apply_never_moves_the_wagon_twice(saver, store):
    st = await _tour_in(store)
    graph = build(saver, store)
    await run(graph, inp(), cfg("p1"))
    await run(graph, inp(), cfg("p2"))  # the same night again, on another thread
    assert (await get_tour(st, TOUR))["night"] == 1


async def test_a_tour_missing_from_the_store_does_not_crash_the_road(saver, store):
    values, _ = await run(build(saver, store), inp(), cfg("m"))
    assert values["arrived"] == inp()["to_town"]


# --------------------------------------------------------------------------------------------- the crash demo
async def test_crash_then_resume_with_null_input_completes_without_redoing_anything(saver, store):
    st = await _tour_in(store)
    graph = build(saver, store)
    config = cfg("c1")
    with capture() as events:
        # first attempt: depart, weather, roll_event, crossroads (interrupt) all run; `apply` then loses a wheel
        await graph.ainvoke(inp(crash=True), config, durability="sync")
        snap = await graph.aget_state(config)
        assert [i.value["kind"] for i in snap.interrupts] == ["crossroads"]
        with pytest.raises(RuntimeError, match=CRASH_MESSAGE):
            await graph.ainvoke(Command(resume={snap.interrupts[0].id: {"choice": snap.interrupts[0].value["choices"][-1]["id"]}}), config, durability="sync")

        crashed = await graph.aget_state(config)
        assert crashed.next == ("apply",), "the run stopped exactly at the failed node, every earlier step is checkpointed"
        assert crashed.values["choice"] is not None
        assert (await get_tour(st, TOUR))["night"] == 0, "nothing was applied before the crash"
        assert await st.get(("crash", TOUR), "night0") is not None, "the marker was written BEFORE raising"

        # the client resumes the same thread with input null
        await graph.ainvoke(None, config, durability="sync")
    done = await graph.aget_state(config)
    assert done.next == () and not done.interrupts
    assert done.values["arrived"] == inp()["to_town"]

    crashes = [e["data"] for e in events if e["kind"] == "road.crash"]
    assert crashes == [{"node": "apply", "recovered": False}, {"node": "apply", "recovered": True}]
    kinds = [e["kind"] for e in events]
    assert kinds.count("road.event") == 1, "roll_event did not run again"
    assert kinds.count("road.arrive") == 1
    assert sum(1 for e in events if e["kind"] == "road.step" and e["data"]["label"].startswith("Weather")) == 1, "weather did not run again"
    assert kinds.index("road.crash") < kinds.index("road.arrive")
    assert len({e["key"] for e in events}) == len(events)

    tour = await get_tour(st, TOUR)
    assert tour["night"] == 1 and tour["wagon"] == {"at": inp()["to_town"]}, "applied exactly once"
    ev = roll(SEED, 0)
    assert done.values["choice"] == ev["choices"][-1]["id"], "the choice made before the crash survived it"


async def test_the_crash_marker_makes_it_happen_once_per_tour_and_night(saver, store):
    st = await _tour_in(store)
    graph = build(saver, store)
    await st.put(("crash", TOUR), "night0", {"node": "apply"}, index=False)  # a previous attempt already crashed on night 0
    with capture() as events:
        values, _ = await run(graph, inp(crash=True), cfg("c2"))
    assert values["arrived"] == inp()["to_town"]
    assert [e["data"] for e in events if e["kind"] == "road.crash"] == [{"node": "apply", "recovered": True}]


async def test_crash_on_a_road_with_no_choices_skips_the_crossroads(saver, store, monkeypatch):
    plain = {"id": "quiet", "title": "A quiet mile", "text": "Nothing happens. The goose is suspicious.", "weight": 1, "choices": []}
    monkeypatch.setattr(world, "road_events", lambda: [plain])
    st = await _tour_in(store)
    graph = build(saver, store)
    config = cfg("c3")
    with pytest.raises(RuntimeError, match=CRASH_MESSAGE):
        await graph.ainvoke(inp(crash=True), config, durability="sync")
    assert (await graph.aget_state(config)).next == ("apply",)
    await graph.ainvoke(None, config, durability="sync")
    values = (await graph.aget_state(config)).values
    assert values["choice"] is None and values["effects"] == {} and values["arrived"] == inp()["to_town"]
    assert (await get_tour(st, TOUR))["night"] == 1


async def test_a_crash_is_not_triggered_unless_asked(saver, store):
    await _tour_in(store)
    with capture() as events:
        await run(build(saver, store), inp(crash=False), cfg("c4"))
        await run(build(saver, store), {**inp(), "crash": "false"}, cfg("c5"))  # a stringly-typed "false" is false
    assert not [e for e in events if e["kind"] == "road.crash"]
