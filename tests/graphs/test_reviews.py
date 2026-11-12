from __future__ import annotations

import pytest

from helpers import default_cast, drive, first_town, make_script
from tragedy.engine import review as rv
from tragedy.engine import show as eng
from tragedy.engine import tour as tour_rules
from tragedy.engine import world
from tragedy.flows.reviews.build import build
from tragedy.flows.reviews.state import merge_reviews
from tragedy.settings import get_settings
from tragedy.tour_store import GraphStore, get_tour, put_tour

GENRE, SEED = "farce", 7
TOUR = "tour-test"


@pytest.fixture(autouse=True)
def _offline_and_quick(monkeypatch):
    """Hermetic: the offline model, with no pacing delay between streamed tokens."""
    monkeypatch.setenv("TRAGEDY_PROVIDER", "offline")
    monkeypatch.setenv("TRAGEDY_OFFLINE_TOKEN_DELAY_S", "0")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def _input(policy="lean_in", night=0, **extra):
    town = first_town()
    cast = default_cast(GENRE, SEED, night)
    script = make_script(GENRE, town, cast, SEED, night)
    result = eng.simulate_show(seed=SEED, night=night, genre=GENRE, town=town, cast=cast, script=script, policy=policy)
    return {
        "tour_id": TOUR, "night": night, "seed": SEED, "genre": GENRE, "town": town, "cast": cast, "script": script,
        "result": result, **extra,
    }


def expected(inp, traditions=()):
    """The notices, the stars, the funds and the headline draft computed straight from the engine."""
    reviews = [
        rv.review_one(
            c, inp["result"], script=inp["script"], cast=inp["cast"], town=inp["town"], traditions=list(traditions),
            seed=inp["seed"], night=inp["night"],
        )
        for c in world.critics()
    ]
    stars = rv.final_stars(reviews)
    funds = rv.funds_delta(stars, inp["result"]["warmth"])
    head = rv.headline_draft(stars, inp["result"], script=inp["script"], town=inp["town"], seed=inp["seed"], night=inp["night"])
    return reviews, stars, funds, head


async def _run(saver, store, inp, thread="v1"):
    graph = build(saver, store)
    return await drive(graph, inp, {"configurable": {"thread_id": thread}}, lambda p: None)


async def _tour(store, **extra):
    tour = {**tour_rules.new_tour(SEED, TOUR), **extra}
    await put_tour(GraphStore(store), tour)
    return tour


async def test_graph_matches_the_engine(saver, store):
    await _tour(store)
    inp = _input()
    values, events, asked = await _run(saver, store, inp)
    reviews, stars, funds, head = expected(inp)
    assert asked == []
    assert values["reviews"] == reviews and values["stars"] == stars and values["funds_delta"] == funds
    assert values["headline"] == head, "offline, the sub-editor echoes the engine's draft"

    pigeons = [e for e in events if e["kind"] == "review.pigeon"]
    assert len(pigeons) == 5
    for e in pigeons:
        assert set(e["data"]) == {"critic", "name", "outlet", "stars", "quote"}
        assert e["data"] == next(r for r in reviews if r["critic"] == e["data"]["critic"]) and e["agent"] == e["data"]["critic"]

    heads = [e for e in events if e["kind"] == "review.headline"]
    assert len(heads) == 1 and heads[0]["data"] == {"text": head, "stars": stars, "funds_delta": funds}

    keys = [e["key"] for e in events]
    assert len(keys) == len(set(keys)), "event keys must be unique within a run"


async def test_output_is_exactly_the_protocol_keys(saver, store):
    graph = build(saver, store)
    out = await graph.ainvoke(_input(), {"configurable": {"thread_id": "o1"}})
    assert set(out) == {"stars", "funds_delta", "headline", "reviews"}
    assert all(set(r) == {"critic", "name", "outlet", "stars", "quote"} for r in out["reviews"])


async def test_reviews_come_back_in_dataset_order(saver, store):
    values, _, _ = await _run(saver, store, _input())
    assert [r["critic"] for r in values["reviews"]] == [c["id"] for c in world.critics()]


async def test_the_tours_traditions_are_read_from_the_store(saver, store):
    inp = _input()
    trad = [{"calamity": "the_chair", "title": "The Chair", "count": 2}]
    await _tour(store, traditions=trad)
    values, _, _ = await _run(saver, store, inp)
    assert values["reviews"] == expected(inp, trad)[0]
    assert values["traditions"] == trad


async def test_the_notice_is_filed_in_the_tour_and_the_funds_are_paid(saver, store):
    tour = await _tour(store)
    inp = _input()
    values, _, _ = await _run(saver, store, inp)
    after = await get_tour(GraphStore(store), TOUR)
    entry = {
        "night": 0, "town": inp["town"], "genre": GENRE, "title": inp["script"]["title"], "stars": values["stars"],
        "headline": values["headline"], "funds_delta": values["funds_delta"], "cast": inp["cast"],
    }
    assert after["history"] == [entry]
    assert after["funds"] == tour["funds"] + values["funds_delta"]
    assert after == tour_rules.file_review(tour, entry)


async def test_filing_is_idempotent_per_night(saver, store):
    tour = await _tour(store)
    inp = _input()
    values, _, _ = await _run(saver, store, inp, thread="i1")
    once = await get_tour(GraphStore(store), TOUR)
    await _run(saver, store, inp, thread="i2")  # the very same night again (a replay, a refresh, a retry)
    twice = await get_tour(GraphStore(store), TOUR)
    assert twice == once and len(twice["history"]) == 1
    assert twice["funds"] == tour["funds"] + values["funds_delta"], "paid once"


async def test_a_different_outcome_for_the_same_night_replaces_the_notice(saver, store):
    tour = await _tour(store)
    good, bad = _input("best"), _input("cover_up")
    assert good["result"] != bad["result"]
    await _run(saver, store, good, thread="g1")
    v2, _, _ = await _run(saver, store, bad, thread="g2")
    after = await get_tour(GraphStore(store), TOUR)
    assert len(after["history"]) == 1 and after["history"][0]["stars"] == v2["stars"]
    assert after["funds"] == tour["funds"] + v2["funds_delta"], "the first payout was taken back"


async def test_a_second_night_adds_to_the_history(saver, store):
    await _tour(store)
    a, b = _input(night=0), _input(night=1)
    va, _, _ = await _run(saver, store, a, thread="n0")
    vb, _, _ = await _run(saver, store, b, thread="n1")
    after = await get_tour(GraphStore(store), TOUR)
    assert [h["night"] for h in after["history"]] == [0, 1]
    assert after["funds"] == 8 + va["funds_delta"] + vb["funds_delta"]


async def test_no_tour_in_the_store_is_fine(saver, store):
    inp = _input()
    values, events, _ = await _run(saver, store, inp)  # the Store has no tour at all
    reviews, stars, _funds, head = expected(inp)
    assert values["stars"] == stars and values["reviews"] == reviews and values["headline"] == head
    assert await get_tour(GraphStore(store), TOUR) is None, "nothing was invented"
    assert len([e for e in events if e["kind"] == "review.pigeon"]) == 5


async def test_a_tour_id_the_store_cannot_hold_is_skipped(saver, store):
    inp = _input(tour_id="not.a.valid.namespace")
    graph = build(saver, store)
    values, _, _ = await drive(graph, inp, {"configurable": {"thread_id": "odd"}}, lambda p: None)
    assert "headline" in values


async def test_no_result_reviews_an_imaginary_night(saver, store):
    inp = _input()
    bare = {k: v for k, v in inp.items() if k != "result"}
    values, events, _ = await _run(saver, store, bare, thread="bare")
    assert len(values["reviews"]) == 5 and 0.5 <= values["stars"] <= 5.0
    assert [e["kind"] for e in events].count("review.headline") == 1


async def test_it_is_deterministic(saver, store):
    inp = _input()
    a, ev_a, _ = await _run(saver, store, inp, thread="d1")
    b, ev_b, _ = await _run(saver, store, inp, thread="d2")
    assert a["reviews"] == b["reviews"] and a["headline"] == b["headline"]
    norm = lambda evs: sorted((e["key"], repr(e["data"])) for e in evs)  # noqa: E731
    assert norm(ev_a) == norm(ev_b)


async def test_the_headline_streams_as_tokens(saver, store):
    graph = build(saver, store)
    tagged: set[str] = set()
    text = ""
    async for chunk, meta in graph.astream(_input(), {"configurable": {"thread_id": "tok"}}, stream_mode="messages"):
        tags = {t for t in (meta.get("tags") or []) if t.startswith("actor:")}
        tagged |= tags
        if "actor:sub_editor" in tags:
            text += str(chunk.content)
    assert "actor:sub_editor" in tagged
    assert text.strip() == expected(_input())[3]


async def test_events_reach_the_real_custom_stream(saver, store):
    graph = build(saver, store)
    cfg = {"configurable": {"thread_id": "wire"}}
    kinds = [p["kind"] async for p in graph.astream(_input(), cfg, stream_mode="custom")]
    assert kinds.count("review.pigeon") == 5 and kinds.count("review.headline") == 1
    assert kinds.index("review.headline") > max(i for i, k in enumerate(kinds) if k == "review.pigeon"), "reduce is deferred"


def test_merge_reviews_reducer_orders_by_dataset_and_dedupes():
    order = [c["id"] for c in world.critics()]
    rows = [{"critic": c, "stars": 3.0} for c in order]
    assert [r["critic"] for r in merge_reviews(None, list(reversed(rows)))] == order
    shuffled = merge_reviews(merge_reviews([rows[3]], [rows[0], rows[4]]), [rows[2], rows[1]])
    assert [r["critic"] for r in shuffled] == order
    again = merge_reviews(shuffled, [{"critic": order[0], "stars": 5.0}])
    assert len(again) == 5 and again[0]["stars"] == 5.0, "a repeated critic replaces its earlier notice"
    assert merge_reviews([], []) == []


def test_graph_shape():
    g = build().get_graph()
    assert {"gather", "critics", "reduce", "headline", "file_review"} <= set(g.nodes)
    edges = {(e.source, e.target) for e in g.edges}
    assert {("critics", "reduce"), ("reduce", "headline"), ("headline", "file_review"), ("gather", "critics")} <= edges
