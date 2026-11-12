from __future__ import annotations

import pytest

from helpers import default_cast, drive, first_town, make_script
from tragedy.common.rng import sub_seed
from tragedy.engine import review as rv
from tragedy.engine import show as eng
from tragedy.engine import tour as tour_rules
from tragedy.engine import world
from tragedy.flows.rehearsal.build import build
from tragedy.flows.rehearsal.nodes import MAX_SAMPLES, bucket, clamp_samples, summarize_sims, verdict_for
from tragedy.flows.rehearsal.state import merge_sims
from tragedy.settings import get_settings
from tragedy.tour_store import GraphStore, get_tour, put_tour

GENRE, SEED = "farce", 7


@pytest.fixture(autouse=True)
def _offline(monkeypatch):
    monkeypatch.setenv("TRAGEDY_PROVIDER", "offline")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def _input(**extra):
    town = first_town()
    cast = default_cast(GENRE, SEED)
    return {
        "tour_id": "tour-test", "night": 0, "seed": SEED, "genre": GENRE, "town": town, "cast": cast,
        "script": make_script(GENRE, town, cast, SEED), **extra,
    }


async def _run(saver, store, inp, thread="r1"):
    graph = build(saver, store)
    return await drive(graph, inp, {"configurable": {"thread_id": thread}}, lambda p: None)


def engine_sample(inp, i):
    """What imaginary night `i` must be, computed straight from the engine."""
    seed = sub_seed(inp["seed"], "rehearsal", i)
    result = eng.simulate_show(
        seed=seed, night=inp["night"], genre=inp["genre"], town=inp["town"], cast=inp["cast"], script=inp["script"], policy="best"
    )
    stars = rv.final_stars(
        [
            rv.review_one(c, result, script=inp["script"], cast=inp["cast"], town=inp["town"], traditions=[], seed=seed, night=inp["night"])
            for c in world.critics()
        ]
    )
    return stars, result


async def test_twelve_imaginary_nights_match_the_engine(saver, store):
    inp = _input()
    values, events, asked = await _run(saver, store, inp)
    assert asked == [], "rehearsal never interrupts"

    samples = [e for e in events if e["kind"] == "rehearsal.sample"]
    assert len(samples) == 12 and sorted(e["data"]["i"] for e in samples) == list(range(12))
    for e in samples:
        d = e["data"]
        assert set(d) == {"i", "stars", "warmth", "chaos", "top_mishap"}
        stars, result = engine_sample(inp, d["i"])
        assert d["stars"] == stars and d["warmth"] == result["warmth"] and d["chaos"] == result["chaos"]
        assert d["top_mishap"] == (result["mishaps"][0]["title"] if result["mishaps"] else None)

    summaries = [e for e in events if e["kind"] == "rehearsal.summary"]
    assert len(summaries) == 1
    s = summaries[0]["data"]
    assert set(s) == {"histogram", "mean", "risk", "verdict"} and values["summary"] == s
    assert len(s["histogram"]) == 5 and sum(s["histogram"]) == 12, "the histogram accounts for every sample"
    stars = [engine_sample(inp, i)[0] for i in range(12)]
    expected = [0] * 5
    for x in stars:
        expected[max(1, min(5, int(x))) - 1] += 1
    assert s["histogram"] == expected
    assert s["mean"] == pytest.approx(sum(stars) / 12, abs=0.006)
    assert s["verdict"] == verdict_for(s["mean"]) and isinstance(s["verdict"], str)

    keys = [e["key"] for e in events]
    assert len(keys) == len(set(keys)), "event keys must be unique within a run"


async def test_risk_list_is_the_most_frequent_mishaps(saver, store):
    inp = _input()
    _, events, _ = await _run(saver, store, inp)
    risk = next(e for e in events if e["kind"] == "rehearsal.summary")["data"]["risk"]
    assert risk, "a farce with this cast always has disasters"
    assert all(set(r) == {"title", "freq"} and 0 < r["freq"] <= 1 for r in risk)
    assert [r["freq"] for r in risk] == sorted((r["freq"] for r in risk), reverse=True)
    counted: dict[str, int] = {}
    for i in range(12):
        for t in {m["title"] for m in engine_sample(inp, i)[1]["mishaps"]}:
            counted[t] = counted.get(t, 0) + 1
    for r in risk:
        assert r["freq"] == pytest.approx(counted[r["title"]] / 12, abs=0.006)
    assert risk[0]["freq"] == pytest.approx(max(counted.values()) / 12, abs=0.006)


async def test_it_is_deterministic(saver, store):
    inp = _input()
    a, ev_a, _ = await _run(saver, store, inp, thread="d1")
    b, ev_b, _ = await _run(saver, store, inp, thread="d2")
    assert a["summary"] == b["summary"]
    norm = lambda evs: sorted((e["key"], repr(e["data"])) for e in evs)  # noqa: E731  (completion order is not fixed)
    assert norm(ev_a) == norm(ev_b)


@pytest.mark.parametrize(
    ("asked", "expected"),
    [(None, 12), (12, 12), (1, 1), (5, 5), (24, 24), (25, 24), (1000, 24), (0, 1), (-3, 1), ("many", 12), (3.5, 12), (True, 12)],
)
async def test_samples_are_clamped(saver, store, asked, expected):
    assert clamp_samples(asked) == expected
    inp = _input() if asked is None else _input(samples=asked)
    values, events, _ = await _run(saver, store, inp, thread=f"n{asked!r}")
    assert len([e for e in events if e["kind"] == "rehearsal.sample"]) == expected
    assert sum(values["summary"]["histogram"]) == expected and values["n_samples"] == expected
    assert MAX_SAMPLES == 24


async def test_a_missing_script_is_drafted_by_the_tender_quill(saver, store):
    inp = _input()
    bare = {k: v for k, v in inp.items() if k != "script"}
    values, _, _ = await _run(saver, store, bare, thread="s1")
    again, _, _ = await _run(saver, store, inp, thread="s2")  # the same script, handed over explicitly
    assert values["script"] == inp["script"] and values["summary"] == again["summary"]


async def test_a_missing_cast_is_recommended(saver, store):
    inp = _input()
    bare = {k: v for k, v in inp.items() if k not in ("cast", "script")}
    values, _, _ = await _run(saver, store, bare, thread="c1")
    assert values["cast"] == default_cast(GENRE, SEED)


async def test_rehearsal_leaves_the_tour_alone(saver, store):
    tour = tour_rules.new_tour(SEED, "tour-test")
    await put_tour(GraphStore(store), tour)
    await _run(saver, store, _input())
    assert await get_tour(GraphStore(store), "tour-test") == tour, "the candle is spent by the API, not here"


async def test_a_different_seed_gives_different_nights(saver, store):
    a, _, _ = await _run(saver, store, _input(), thread="a")
    b, _, _ = await _run(saver, store, _input(seed=SEED + 1), thread="b")
    assert a["summary"] != b["summary"]


async def test_events_reach_the_real_custom_stream(saver, store):
    graph = build(saver, store)
    cfg = {"configurable": {"thread_id": "wire"}}
    kinds = [p["kind"] async for p in graph.astream(_input(), cfg, stream_mode="custom")]
    assert kinds.count("rehearsal.sample") == 12 and kinds.count("rehearsal.summary") == 1
    assert kinds.index("rehearsal.summary") > max(i for i, k in enumerate(kinds) if k == "rehearsal.sample"), "defer: last"


# ----------------------------------------------------------------------------------------- the pure pieces
def test_bucket_and_verdict_bands():
    assert [bucket(x) for x in (0.5, 1.0, 1.5, 2.5, 3.0, 4.5, 5.0)] == [1, 1, 1, 2, 3, 4, 5]
    assert len({verdict_for(m) for m in (0.5, 1.5, 2.25, 3.0, 4.0, 4.75)}) == 6
    assert verdict_for(5.0) != verdict_for(0.5)


def test_summarize_sims_is_pure_and_total():
    sims = [
        {"i": 0, "stars": 4.5, "mishaps": ["A", "B"]},
        {"i": 1, "stars": 2.0, "mishaps": ["A"]},
        {"i": 2, "stars": 0.5, "mishaps": []},
        {"i": 3, "stars": 5.0, "mishaps": ["C"]},
    ]
    s = summarize_sims(sims)
    assert s["histogram"] == [1, 1, 0, 1, 1] and s["mean"] == 3.0
    assert s["risk"][0] == {"title": "A", "freq": 0.5}
    assert [r["title"] for r in s["risk"]] == ["A", "B", "C"], "ties break alphabetically"
    assert summarize_sims([])["histogram"] == [0] * 5


def test_merge_sims_reducer_is_ordered_and_idempotent():
    one, two, three = ({"i": i, "stars": 1.0} for i in (0, 1, 2))
    assert [s["i"] for s in merge_sims([three], [one, two])] == [0, 1, 2]
    assert merge_sims(merge_sims([], [one, two]), [one]) == [one, two]
    assert merge_sims(None, None) == []


def test_graph_shape():
    g = build().get_graph()
    assert {"plan", "simulate", "summarize"} <= set(g.nodes)
    assert ("simulate", "summarize") in {(e.source, e.target) for e in g.edges}
