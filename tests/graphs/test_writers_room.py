from __future__ import annotations

import json

import pytest

from helpers import default_cast, drive, first_town
from tragedy.data.tags import BEATS
from tragedy.engine import script as scr
from tragedy.engine import world
from tragedy.flows.writers_room.build import build
from tragedy.settings import get_settings

GENRE, SEED = "farce", 7
PUBLIC_DRAFT_KEYS = {"draft_id", "quill", "title", "tagline", "beats", "confidence"}


@pytest.fixture(autouse=True)
def _offline_and_quick(monkeypatch):
    """Hermetic: the offline model, with no pacing delay between streamed tokens."""
    monkeypatch.setenv("TRAGEDY_PROVIDER", "offline")
    monkeypatch.setenv("TRAGEDY_OFFLINE_TOKEN_DELAY_S", "0")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def _input(**extra):
    town = extra.pop("town", first_town())
    return {
        "tour_id": "tour-test", "night": 0, "seed": SEED, "genre": GENRE, "town": town,
        "cast": default_cast(GENRE, SEED), "traditions": [], **extra,
    }


def _kw(inp):
    return {"town": inp["town"], "cast": inp["cast"], "genre": inp["genre"], "traditions": inp["traditions"]}


def engine_scores(inp, attempt=0):
    """quill -> (script, true score) exactly as the engine drafts them (the offline voice echoes taglines unchanged)."""
    out = {}
    for q in scr.QUILLS:
        s = scr.draft_script(q, seed=inp["seed"], night=inp["night"], **_kw(inp), attempt=attempt)
        out[q] = (s, scr.score_script(s, **_kw(inp)))
    return out


def pick_first(payload):
    return {"draft_id": payload["drafts"][0]["draft_id"]}


def settled(q, inp, rnd=0, score=None):
    """The script quill `q` ends up presenting in round `rnd`: its redraft replaces a first draft scoring under 0.3."""
    score = score or scr.score_script
    for redo in (0, 1):
        s = scr.draft_script(q, seed=inp["seed"], night=inp["night"], **_kw(inp), attempt=2 * rnd + redo)
        if redo or score(s, **_kw(inp)) >= 0.3:
            return s
    raise AssertionError("unreachable")


def contains_key(obj, key):
    if isinstance(obj, dict):
        return key in obj or any(contains_key(v, key) for v in obj.values())
    if isinstance(obj, list):
        return any(contains_key(v, key) for v in obj)
    return False


def calm_inputs():
    """An input where the best draft is good enough (no revise), also after a redraft, and no quill redrafts by itself."""
    for seed in range(40):
        for town in sorted(world.towns())[:6]:
            inp = _input(seed=seed, town=town, cast=default_cast(GENRE, seed))
            first = [s for _, s in engine_scores(inp).values()]
            again = [s for _, s in engine_scores(inp, attempt=1).values()]
            if max(first) >= 0.5 and min(first) >= 0.31 and max(again) >= 0.5:
                return inp
    raise AssertionError("no calm input found: the thresholds and the datasets disagree")


async def _run(saver, store, chooser, inp, thread="w1"):
    graph = build(saver, store)
    values, events, asked = await drive(graph, inp, {"configurable": {"thread_id": thread}}, chooser)
    return values, events, asked


async def test_graph_drafts_three_scripts_and_the_player_picks_one(saver, store):
    inp = calm_inputs()
    expected = engine_scores(inp)
    values, events, asked = await _run(saver, store, lambda p: {"draft_id": p["drafts"][1]["draft_id"]}, inp)

    assert len(asked) == 1 and asked[0]["kind"] == "pick_draft"
    drafts = asked[0]["drafts"]
    assert [d["quill"] for d in drafts] == list(scr.QUILLS), "a stable order, whatever order the quills finish in"
    assert all(set(d) == PUBLIC_DRAFT_KEYS for d in drafts)
    assert all(isinstance(d["confidence"], int) and 0 <= d["confidence"] <= 3 for d in drafts)
    for d in drafts:
        s = expected[d["quill"]][0]
        assert d["draft_id"] == f"{d['quill']}-0" and d["title"] == s["title"] and d["tagline"] == s["tagline"]
        assert d["beats"] == [{"beat": b["beat"], "logline": b["logline"], "tags": b["tags"]} for b in s["beats"]]
        assert [b["beat"] for b in d["beats"]] == list(BEATS)

    chosen = drafts[1]["quill"]
    assert values["script"] == expected[chosen][0], "the script is exactly the engine's draft"
    assert {"title", "tagline", "quill", "genre", "beats", "tags"} <= set(values["script"])
    assert values["script"]["quill"] == chosen

    ev = [e for e in events if e["kind"] == "script.draft"]
    assert len(ev) == 3 and {e["data"]["draft_id"] for e in ev} == {d["draft_id"] for d in drafts}
    for e in ev:
        assert set(e["data"]) == PUBLIC_DRAFT_KEYS and e["agent"] == e["data"]["quill"]
        assert e["data"] == next(d for d in drafts if d["draft_id"] == e["data"]["draft_id"])
    won = [e for e in events if e["kind"] == "script.chosen"]
    assert len(won) == 1 and won[0]["data"] == {"draft_id": drafts[1]["draft_id"]}
    keys = [e["key"] for e in events]
    assert len(keys) == len(set(keys)), "event keys must be unique within a run"


async def test_the_true_score_never_leaks(saver, store):
    inp = calm_inputs()
    values, events, asked = await _run(saver, store, pick_first, inp)
    truth = {str(round(s, 4)) for _, s in engine_scores(inp).values()}
    for blob in (events, asked, values):
        assert not contains_key(blob, "score"), "no `score` key in any event, interrupt payload or state"
        text = json.dumps(blob)
        assert not any(t in text for t in truth), "and not under another name either"


async def test_the_true_score_is_not_in_the_streamed_state_either(saver, store):
    """The SPA streams `values` with stream_subgraphs on, so root AND quill-subgraph states reach the browser."""
    inp = calm_inputs()
    truth = {str(round(s, 4)) for _, s in engine_scores(inp).values()}
    graph = build(saver, store)
    cfg = {"configurable": {"thread_id": "leak"}}
    namespaces = set()
    async for ns, mode, chunk in graph.astream(inp, cfg, stream_mode=["values", "updates"], subgraphs=True):
        namespaces.add(bool(ns))
        text = json.dumps(chunk, default=str)
        assert not contains_key(chunk, "score") and not any(t in text for t in truth), (ns, mode)
    assert namespaces == {True, False}, "both the root graph and the quill subgraphs were observed"


async def test_invalid_picks_fall_back_to_the_truly_best_draft(saver, store):
    inp = calm_inputs()
    expected = engine_scores(inp)
    best = max(scr.QUILLS, key=lambda q: (expected[q][1], -scr.QUILLS.index(q)))
    for n, bad in enumerate(["banana", None, 7, {}, {"draft_id": "nope"}, {"draft_id": ["quill_tender-0"]}, {"draft_id": None}]):
        values, _, asked = await _run(saver, store, lambda p, b=bad: b, inp, thread=f"bad{n}")
        assert len(asked) == 1
        assert values["script"]["quill"] == best, f"garbage {bad!r} must pick the highest true score"


async def test_a_bare_draft_id_string_is_accepted(saver, store):
    inp = calm_inputs()
    values, _, _ = await _run(saver, store, lambda p: p["drafts"][2]["draft_id"], inp)
    assert values["script"]["quill"] == scr.QUILLS[2]


async def test_a_hopeless_first_round_triggers_one_revision(saver, store, monkeypatch):
    inp = calm_inputs()
    real = scr.score_script
    # round 0 = engine attempts 0 (first draft) and 1 (a quill's own redraft): every one of those scripts is hopeless
    round0 = [
        scr.draft_script(q, seed=inp["seed"], night=0, **_kw(inp), attempt=a) for q in scr.QUILLS for a in (0, 1)
    ]
    monkeypatch.setattr(scr, "score_script", lambda script, **kw: 0.2 if script in round0 else real(script, **kw))
    values, events, asked = await _run(saver, store, pick_first, inp)

    assert len(asked) == 1, "the player is only asked once, after the revision"
    ids = [d["draft_id"] for d in asked[0]["drafts"]]
    assert ids == [f"{q}-1" for q in scr.QUILLS], "the pick list holds round 1 only; round 0 is kept out"
    drafted = [e["data"]["draft_id"] for e in events if e["kind"] == "script.draft"]
    assert sorted(drafted) == sorted([f"{q}-0" for q in scr.QUILLS] + ids), "both rounds were announced"
    assert any(e["kind"] == "note" and ":revise:" in e["key"] for e in events), "Madame sends them back"
    assert values["revisions"] == 1 and values["round"] == 1
    assert values["script"]["quill"] == scr.QUILLS[0]
    # round 1 drafts with fresh engine attempts (2, 3): never a replay of round 0 (attempts 0, 1)
    assert values["script"] == settled(scr.QUILLS[0], inp, rnd=1, score=real)
    assert values["script"] not in round0


async def test_the_loop_runs_at_most_once(saver, store, monkeypatch):
    inp = calm_inputs()
    monkeypatch.setattr(scr, "score_script", lambda script, **kw: 0.1)  # nothing is ever good enough
    values, events, asked = await _run(saver, store, pick_first, inp)
    assert len(asked) == 1 and values["revisions"] == 1
    assert len([e for e in events if e["kind"] == "script.draft"]) == 6
    assert "script" in values


async def test_a_quill_redrafts_once_when_its_own_draft_is_hopeless(saver, store, monkeypatch):
    inp = calm_inputs()
    real, seen = scr.score_script, set()

    def fake(script, **kw):
        if script["quill"] not in seen:  # each quill's FIRST draft is torn up
            seen.add(script["quill"])
            return 0.1
        return real(script, **kw)

    monkeypatch.setattr(scr, "score_script", fake)
    values, events, asked = await _run(saver, store, pick_first, inp)

    redone = engine_scores(inp, attempt=1)  # engine attempt 1 = the quill's own redraft in round 0
    drafts = asked[0]["drafts"]
    assert [d["draft_id"] for d in drafts] == [f"{q}-0" for q in scr.QUILLS]
    assert len([e for e in events if e["kind"] == "script.draft"]) == 3, "only the accepted draft is announced"
    for d in drafts:
        assert d["title"] == redone[d["quill"]][0]["title"], "the announced draft is the redraft (engine attempt 1)"
    assert values["script"] == redone[scr.QUILLS[0]][0]


async def test_tour_state_traditions_are_accepted(saver, store):
    inp = calm_inputs()
    inp["traditions"] = [{"calamity": "the_chair", "title": "The Chair", "count": 2}, "the_cake", {"nope": 1}, 5]
    values, _, asked = await _run(saver, store, pick_first, inp)
    assert len(asked) == 1 and "script" in values


async def test_missing_inputs_are_tolerated(saver, store):
    values, _, asked = await _run(saver, store, pick_first, {"tour_id": "tour-test", "seed": 3}, thread="lenient")
    assert asked and values["script"]["genre"] in world.genres()


async def test_a_rerun_on_the_same_thread_starts_clean(saver, store):
    inp = calm_inputs()
    graph = build(saver, store)
    cfg = {"configurable": {"thread_id": "again"}}
    await drive(graph, inp, cfg, pick_first)
    values, _, asked = await drive(graph, inp, cfg, pick_first)
    assert len(values["drafts"]) == 3, "the accumulator is reset by `brief`"
    assert len(asked) == 1 and len(asked[0]["drafts"]) == 3


async def test_deterministic(saver, store):
    inp = calm_inputs()
    a, ev_a, pa = await _run(saver, store, pick_first, inp, thread="x1")
    b, ev_b, pb = await _run(saver, store, pick_first, inp, thread="x2")
    assert a["script"] == b["script"] and pa == pb
    norm = lambda evs: sorted((e["key"], repr(e["data"])) for e in evs)  # noqa: E731
    assert norm(ev_a) == norm(ev_b)


async def test_taglines_stream_in_each_quills_voice(saver, store):
    graph = build(saver, store)
    cfg = {"configurable": {"thread_id": "tok"}}
    tags = set()
    # the quills live in a subgraph, so (like the SPA, which sets stream_subgraphs) ask for subgraph events
    async for ns, (_chunk, meta) in graph.astream(calm_inputs(), cfg, stream_mode="messages", subgraphs=True):
        assert ns and ns[0].startswith("quill:"), "the tokens come from inside the quill subgraph"
        tags |= {t for t in (meta.get("tags") or []) if t.startswith("actor:")}
    assert {f"actor:{q}" for q in scr.QUILLS} <= tags


async def test_events_reach_the_real_custom_stream_from_inside_the_subgraph(saver, store):
    graph = build(saver, store)
    cfg = {"configurable": {"thread_id": "wire"}}
    got = []
    async for ns, payload in graph.astream(calm_inputs(), cfg, stream_mode="custom", subgraphs=True):
        got.append((ns, payload))
    drafts = [(ns, p) for ns, p in got if p["kind"] == "script.draft"]
    assert len(drafts) == 3 and all(ns and ns[0].startswith("quill:") for ns, _ in drafts)
    assert all(p["v"] == 1 and p["key"] and p["data"]["draft_id"] for _, p in drafts)


def test_the_quill_subgraph_is_readable_in_the_xray_view():
    flat = build().get_graph()
    deep = build().get_graph(xray=True)
    assert {"brief", "quill", "judge", "revise", "pick_draft", "finalize"} <= set(flat.nodes)
    inner = {n for n in deep.nodes if n.startswith("quill:")}
    assert {"quill:draft", "quill:self_check", "quill:present"} <= inner, sorted(deep.nodes)
    edges = {(e.source, e.target) for e in deep.edges}
    assert ("quill:self_check", "quill:draft") in edges, "the redraft loop is visible"
    assert ("quill:present", "judge") in edges and ("judge", "revise") in edges and ("revise", "quill:__start__") in edges
