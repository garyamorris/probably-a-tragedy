"""Studio's form sends a few fields, not a `cast` and a `script` as JSON. These graphs used to crash on that (KeyError 'tour_id' /
'seed' / 'night'); now a `defaults` step completes the input, and does NOTHING when the game sends everything."""

from __future__ import annotations

import pytest

from helpers import default_cast, drive, first_town, make_script
from tragedy.engine import show as eng
from tragedy.flows.almanac.build import build as build_almanac
from tragedy.flows.performance.build import build as build_performance
from tragedy.flows.the_road.build import build as build_road


def answer(payload):
    kind = payload.get("kind")
    if kind == "prompters_box":
        opt = next(o for o in eng.whisper_options(payload["mishap"]["kind"]) if o.get("chain"))
        return {"option": opt["id"], "cue": None, "text": None}
    if kind == "curate_traditions":
        return {"enshrine": [c["calamity"] for c in payload["candidates"]][:2]}
    if kind == "crossroads":
        return {"choice": payload["choices"][0]["id"]}
    raise AssertionError(f"unexpected interrupt {payload}")


def notes(events):
    return [e for e in events if e["kind"] == "note" and e.get("agent") == "defaults"]


PARTIAL = [{}, {"tour_id": "studio-demo"}, {"tour_id": "studio-demo", "genre": "whodunit", "town": "marshwick"}, {"cast": {}, "script": {}}]


@pytest.mark.parametrize("inp", PARTIAL, ids=["empty", "tour only", "tour+genre+town", "empty objects from the form"])
async def test_performance_runs_from_a_partial_studio_input(saver, store, inp):
    values, events, _asked = await drive(build_performance(saver, store), inp, {"configurable": {"thread_id": "p"}}, answer)
    assert len(values["result"]["beats"]) == 5 and values["result"]["mishaps"]
    (note,) = notes(events)
    assert "cast" in note["data"]["text"] and "script" in note["data"]["text"]


@pytest.mark.parametrize("inp", [{}, {"tour_id": "studio-demo"}, {"night": 1, "genre": "pantomime"}], ids=["empty", "tour only", "night+genre"])
async def test_almanac_runs_from_a_partial_studio_input(saver, store, inp):
    values, events, _ = await drive(build_almanac(saver, store), inp, {"configurable": {"thread_id": "a"}}, answer)
    assert "traditions" in values and notes(events) and "result" in notes(events)[0]["data"]["text"]


@pytest.mark.parametrize("inp", [{}, {"tour_id": "studio-demo"}, {"seed": 3}], ids=["empty", "tour only", "seed only"])
async def test_the_road_runs_from_a_partial_studio_input(saver, store, inp):
    values, events, _asked = await drive(build_road(saver, store), inp, {"configurable": {"thread_id": "r"}}, answer)
    assert values.get("arrived") or values.get("from_town"), values
    assert notes(events)


async def test_a_complete_input_from_the_game_is_left_exactly_as_it_was(saver, store):
    """The defaults step must be invisible to the game: no note, and the result is the headless engine's, as before."""
    town, cast = first_town(), default_cast("farce", 7)
    script = make_script("farce", town, cast, 7)
    inp = {"tour_id": "tour-x", "night": 0, "seed": 7, "genre": "farce", "town": town, "cast": cast, "script": script}
    values, events, _ = await drive(build_performance(saver, store), inp, {"configurable": {"thread_id": "full"}}, answer)
    assert notes(events) == [], "nothing was missing, so nothing is announced"
    assert values["result"] == eng.simulate_show(seed=7, night=0, genre="farce", town=town, cast=cast, script=script, policy="lean_in")


async def test_what_the_caller_gives_is_never_overridden(saver, store):
    town = first_town()
    cast = default_cast("pantomime", 11)
    _values, events, _ = await drive(
        build_performance(saver, store), {"seed": 11, "genre": "pantomime", "town": town, "cast": cast}, {"configurable": {"thread_id": "keep"}}, answer
    )
    snap = await build_performance(saver, store).aget_state({"configurable": {"thread_id": "keep"}})
    assert snap.values["cast"] == cast and snap.values["genre"] == "pantomime" and snap.values["town"] == town and snap.values["seed"] == 11
    assert "cast" not in notes(events)[0]["data"]["text"] and "script" in notes(events)[0]["data"]["text"]


async def test_a_trimmed_result_without_beats_is_still_the_callers_result(saver, store):
    """The almanac only reads mishaps/calamities; a caller's result must not be swapped for a simulated one just because it has no beats."""
    from tragedy.engine import tour as tour_rules
    from tragedy.tour_store import GraphStore, put_tour

    await put_tour(GraphStore(store), tour_rules.new_tour(7, "trim"))
    trimmed = {"warmth": 60, "chaos": 40, "quality_avg": 60, "quality_lead": 60, "quality": [], "mishaps": [], "calamities": [], "tradition_hits": 0, "yes_and": 0, "cues_used": [], "beats": []}
    _v, events, _ = await drive(
        build_almanac(saver, store), {"tour_id": "trim", "night": 0, "seed": 7, "result": trimmed}, {"configurable": {"thread_id": "trim"}}, answer
    )
    assert [e for e in events if e["kind"] == "almanac.noted"] == [], "the caller's empty calamity list was used, not a simulated show's"
    assert "result" not in " ".join(n["data"]["text"] for n in notes(events))
