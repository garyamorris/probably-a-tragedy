from __future__ import annotations

from helpers import default_cast, drive, first_town, make_script
from tragedy.engine import show as eng
from tragedy.engine import tour as tour_rules
from tragedy.flows.performance.build import build
from tragedy.tour_store import GraphStore, put_tour

GENRE, SEED = "farce", 7


def lean_in(payload):
    opt = next(o for o in eng.whisper_options(payload["mishap"]["kind"]) if o.get("chain"))
    return {"option": opt["id"], "cue": None, "text": None}


async def _setup(store, saver, scenario=None, cast=None):
    town = first_town()
    cast = cast or default_cast(GENRE, SEED)
    tour = tour_rules.new_tour(SEED, "tour-test")
    await put_tour(GraphStore(store), tour)
    script = make_script(GENRE, town, cast, SEED)
    graph = build(saver, store)
    inp = {"tour_id": "tour-test", "night": 0, "seed": SEED, "genre": GENRE, "town": town, "cast": cast, "script": script}
    if scenario:
        inp["scenario"] = scenario
    return graph, inp, town, cast, script


async def test_graph_matches_the_headless_engine(saver, store):
    graph, inp, town, cast, script = await _setup(store, saver)
    cfg = {"configurable": {"thread_id": "t1"}}
    values, events, asked = await drive(graph, inp, cfg, lean_in)
    expected = eng.simulate_show(seed=SEED, night=0, genre=GENRE, town=town, cast=cast, script=script, policy="lean_in")
    assert values["result"] == expected
    kinds = [e["kind"] for e in events]
    for k in ("audience.seat", "stage.beat", "stage.line", "stage.mishap", "stage.decision", "audience.react", "audience.tally", "meter", "stage.curtain"):
        assert k in kinds, k
    assert kinds.count("audience.react") == 60 and kinds.count("stage.beat") == 5
    assert all(a["kind"] == "prompters_box" for a in asked)
    keys = [e["key"] for e in events]
    assert len(keys) == len(set(keys)), "event keys must be unique within a run"


async def test_each_beat_says_why_the_house_moved(saver, store):
    """A fun audit: the engine computed the reasons (town taste, props, tangle...) and the graph threw them away."""
    graph, inp, _town, _cast, _script = await _setup(store, saver)
    _values, events, _asked = await drive(graph, inp, {"configurable": {"thread_id": "why"}}, lean_in)
    whys = [e for e in events if e["kind"] == "stage.why"]
    assert whys, "at least one beat must explain itself"
    for e in whys:
        d = e["data"]
        assert d["chips"] and d["text"] and isinstance(d["delta"], float) and 0 <= d["beat"] < 5, d
        assert all(set(c) == {"label", "value"} for c in d["chips"])
        assert abs(d["chips"][0]["value"]) >= abs(d["chips"][-1]["value"]), "biggest reason first"


async def test_interrupt_payload_is_a_complete_prompters_box(saver, store):
    graph, inp, *_ = await _setup(store, saver)
    cfg = {"configurable": {"thread_id": "t2"}}
    _, _, asked = await drive(graph, inp, cfg, lean_in)
    assert asked, "the mishap-rich farce should freeze the stage at least once"
    p = asked[0]
    assert len(p["options"]) == 3 and p["cues"] and p["free_text"] and p["mishap"]["severity"] == "major"


async def test_understudy_takes_over_when_a_performer_freezes(saver, store):
    graph, inp, *_ = await _setup(store, saver, scenario="stage_fright")
    cfg = {"configurable": {"thread_id": "t3"}}
    values, events, _ = await drive(graph, inp, cfg, lean_in)
    enters = [e for e in events if e["kind"] == "stage.enter" and e["data"]["actor"] == "gus"]
    assert enters and enters[0]["data"]["from"] == "trapdoor"
    assert "result" in values and len(values["result"]["beats"]) == 5


async def test_time_travel_fork_changes_the_ending_but_not_the_first_timeline(saver, store):
    graph, inp, *_ = await _setup(store, saver)
    cfg = {"configurable": {"thread_id": "t4"}}
    first, _, asked = await drive(graph, inp, cfg, lean_in)
    assert asked
    history = [s async for s in graph.aget_state_history(cfg)]
    starts = [s for s in history if s.next == ("direct",) and s.values.get("show", {}).get("beat") == 1]
    assert starts, "a checkpoint exists at the start of beat 2"
    fork_cfg = starts[0].config

    def cover_up(payload):
        opt = min(eng.whisper_options(payload["mishap"]["kind"]), key=lambda o: o["effects"]["chaos"])
        return {"option": opt["id"], "cue": None, "text": None}

    second, _, _ = await drive(graph, None, fork_cfg, cover_up)
    assert second["result"] != first["result"]
    assert second["result"]["beats"][0] == first["result"]["beats"][0], "history before the fork point is shared"
    assert len(second["result"]["beats"]) == 5


async def test_garbage_resume_values_do_not_crash_the_show(saver, store):
    graph, inp, *_ = await _setup(store, saver)
    cfg = {"configurable": {"thread_id": "t5"}}
    values, _, _ = await drive(graph, inp, cfg, lambda p: "banana")
    assert len(values["result"]["beats"]) == 5
