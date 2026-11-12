from __future__ import annotations

import pytest

from helpers import drive, first_town
from tragedy.data.tags import ROLES
from tragedy.engine import casting, world
from tragedy.flows.casting_call.build import build
from tragedy.settings import get_settings

GENRE, SEED = "farce", 7


@pytest.fixture(autouse=True)
def _offline_and_quick(monkeypatch):
    """Hermetic: the offline model, with no pacing delay between streamed tokens."""
    monkeypatch.setenv("TRAGEDY_PROVIDER", "offline")
    monkeypatch.setenv("TRAGEDY_OFFLINE_TOKEN_DELAY_S", "0")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def accept(payload):
    return {"cast": payload["proposed"]}


def rotated(cast):
    return {"lead": cast["villain"], "villain": cast["fool"], "fool": cast["lead"]}


def _input(**extra):
    return {"tour_id": "tour-test", "night": 0, "seed": SEED, "genre": GENRE, "town": first_town(), **extra}


async def _run(saver, store, chooser, thread="c1", **extra):
    graph = build(saver, store)
    return await drive(graph, _input(**extra), {"configurable": {"thread_id": thread}}, chooser)


async def test_graph_matches_the_engine(saver, store):
    values, events, asked = await _run(saver, store, accept)
    table = casting.score_table(GENRE, SEED, 0)
    expected = casting.recommend(table)
    assert values["cast"] == expected

    auditions = [e for e in events if e["kind"] == "cast.audition"]
    assert len(auditions) == 24  # 8 candidates x 3 roles
    assert {(e["data"]["role"], e["data"]["actor"]) for e in auditions} == {(r, a) for r in ROLES for a in world.performers()}
    for e in auditions:
        d = e["data"]
        assert set(d) == {"role", "actor", "score", "line"}
        assert d["score"] == table[d["role"]][d["actor"]]
        assert d["line"] == casting.audition_line(d["actor"], d["role"], GENRE, SEED, 0) and d["line"]

    recs = [e for e in events if e["kind"] == "cast.recommend"]
    assert len(recs) == 1
    rec = recs[0]["data"]
    assert set(rec) == {"cast", "note", "scores"}
    assert rec["cast"] == expected and rec["scores"] == table and rec["note"]

    assert len(asked) == 1
    keys = [e["key"] for e in events]
    assert len(keys) == len(set(keys)), "event keys must be unique within a run"


async def test_interrupt_payload_is_a_complete_confirm_cast(saver, store):
    _, events, asked = await _run(saver, store, accept)
    p = asked[0]
    assert p["kind"] == "confirm_cast"
    assert {"proposed", "scores", "note", "genre", "roles", "flaws"} <= set(p)
    assert "error" not in p, "the first ask is not a re-ask"
    assert p["proposed"] == casting.recommend(casting.score_table(GENRE, SEED, 0))
    assert p["genre"] == GENRE and p["roles"] == world.genres()[GENRE]["roles"]
    assert set(p["scores"]) == set(ROLES) and all(len(row) == 8 for row in p["scores"].values())
    assert p["note"] == next(e for e in events if e["kind"] == "cast.recommend")["data"]["note"]
    assert set(p["flaws"]) == set(world.performers())
    for actor, names in p["flaws"].items():
        assert names == [world.flaws()[f]["name"] for f in world.performers()[actor]["flaws"]] and names


async def test_the_players_edit_wins(saver, store):
    proposed = casting.recommend(casting.score_table(GENRE, SEED, 0))
    mine = rotated(proposed)
    assert mine != proposed
    values, events, asked = await _run(saver, store, lambda p: {"cast": mine})
    assert values["cast"] == mine and len(asked) == 1
    assert next(e for e in events if e["kind"] == "cast.recommend")["data"]["cast"] == proposed


async def test_a_bare_cast_dict_is_accepted_too(saver, store):
    proposed = casting.recommend(casting.score_table(GENRE, SEED, 0))
    values, _, asked = await _run(saver, store, lambda p: rotated(proposed))
    assert values["cast"] == rotated(proposed) and len(asked) == 1


BAD = [
    "banana",
    None,
    42,
    [],
    {},
    {"cast": None},
    {"cast": "mabel"},
    {"cast": {"lead": "mabel"}},
    {"cast": {"lead": "mabel", "villain": "mabel", "fool": "gus"}},  # a duplicate
    {"cast": {"lead": "nobody", "villain": "reginald", "fool": "gus"}},  # not a performer
    {"cast": {"lead": ["mabel"], "villain": "reginald", "fool": "gus"}},  # unhashable
    {"cast": {"lead": 1, "villain": 2, "fool": 3}},
]


@pytest.mark.parametrize("bad", BAD, ids=[repr(b)[:40] for b in BAD])
async def test_garbage_is_reasked_once_then_madame_wins(saver, store, bad):
    values, events, asked = await _run(saver, store, lambda p: bad)
    proposed = casting.recommend(casting.score_table(GENRE, SEED, 0))
    assert values["cast"] == proposed
    assert len(asked) == 2, "one ask plus exactly one re-ask"
    assert "error" not in asked[0] and asked[1]["error"]
    assert {k: v for k, v in asked[1].items() if k != "error"} == asked[0], "the re-ask is the same question"
    assert any(e["kind"] == "note" for e in events), "Madame says that her cast stands"


async def test_a_bad_answer_followed_by_a_good_one_uses_the_good_one(saver, store):
    proposed = casting.recommend(casting.score_table(GENRE, SEED, 0))
    answers = iter(["banana", {"cast": rotated(proposed)}])
    values, _, asked = await _run(saver, store, lambda p: next(answers))
    assert values["cast"] == rotated(proposed) and len(asked) == 2


async def test_candidates_limit_the_auditions_and_the_choices(saver, store):
    pool = ["mabel", "reginald", "gus", "goose", "tock"]
    seen = []

    def chooser(p):
        seen.append(p)
        # first try a performer who is not on the shortlist (rejected), then take the proposal
        return {"cast": {"lead": "hortensia", "villain": "reginald", "fool": "gus"}} if len(seen) == 1 else accept(p)

    values, events, asked = await _run(saver, store, chooser, candidates=pool)
    assert len([e for e in events if e["kind"] == "cast.audition"]) == 15
    assert len(asked) == 2 and all(set(p["flaws"]) == set(pool) for p in asked)
    assert all(a in pool for a in values["cast"].values())
    assert values["cast"] == casting.recommend(casting.score_table(GENRE, SEED, 0, pool))


async def test_too_few_candidates_means_everyone(saver, store):
    _, events, _ = await _run(saver, store, accept, candidates=["mabel", "nobody"])
    assert len([e for e in events if e["kind"] == "cast.audition"]) == 24


async def test_unknown_genre_does_not_crash(saver, store):
    graph = build(saver, store)
    values, _, asked = await drive(graph, _input(genre="opera"), {"configurable": {"thread_id": "c2"}}, accept)
    assert casting.valid_cast(values["cast"]) and asked[0]["genre"] in world.genres()


async def test_a_rerun_on_the_same_thread_starts_clean(saver, store):
    graph = build(saver, store)
    cfg = {"configurable": {"thread_id": "c3"}}
    first, _, _ = await drive(graph, _input(), cfg, accept)
    second, events, _ = await drive(graph, _input(night=1), cfg, accept)
    assert len(first["auditions"]) == 24 and len(second["auditions"]) == 24, "the accumulator is reset by `load`"
    assert len([e for e in events if e["kind"] == "cast.audition"]) == 24
    assert second["cast"] == casting.recommend(casting.score_table(GENRE, SEED, 1))


async def test_the_whole_thing_is_deterministic(saver, store):
    a, ev_a, _ = await _run(saver, store, accept, thread="d1")
    b, ev_b, _ = await _run(saver, store, accept, thread="d2")
    assert a["cast"] == b["cast"] and a["scores"] == b["scores"]
    norm = lambda evs: sorted((e["key"], repr(e["data"])) for e in evs)  # noqa: E731  (completion order is not fixed)
    assert norm(ev_a) == norm(ev_b)


async def test_madames_note_streams_as_tokens(saver, store):
    graph = build(saver, store)
    cfg = {"configurable": {"thread_id": "m1"}}
    tagged = []
    async for chunk, meta in graph.astream(_input(), cfg, stream_mode="messages"):
        tagged.extend(t for t in (meta.get("tags") or []) if t.startswith("actor:"))
        assert chunk is not None
    assert "actor:madame" in tagged, "tokens must be attributable to the speaker (jaw flaps)"


async def test_events_reach_the_real_custom_stream(saver, store):
    graph = build(saver, store)
    cfg = {"configurable": {"thread_id": "wire"}}
    kinds = [p["kind"] async for p in graph.astream(_input(), cfg, stream_mode="custom")]
    assert kinds.count("cast.audition") == 24 and kinds.count("cast.recommend") == 1


def test_graph_shape():
    g = build().get_graph()
    assert {"load", "audition", "rank", "recommend", "confirm_cast", "done"} <= set(g.nodes)
    edges = {(e.source, e.target) for e in g.edges}
    assert ("audition", "rank") in edges and ("confirm_cast", "confirm_cast") in edges and ("load", "audition") in edges
