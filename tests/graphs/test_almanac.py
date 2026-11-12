from __future__ import annotations

import pytest
from langgraph.store.memory import InMemoryStore

from helpers import default_cast, drive, make_script
from tragedy.embeddings import aembed
from tragedy.engine import show as eng
from tragedy.engine import tour as tour_rules
from tragedy.engine import world
from tragedy.flows.almanac.build import build
from tragedy.tour_store import GraphStore, get_tour, ns_almanac, put_tour, seed_legends

SEED, TOUR = 7, "tour-almanac"


@pytest.fixture
def lore_store() -> InMemoryStore:
    """A Store with the semantic index the real server configures in langgraph.json (hashed 256-d embedder)."""
    return InMemoryStore(index={"embed": aembed, "dims": 256, "fields": ["text"]})


def mishap(calamity: str, beat: int = 1, title: str | None = None) -> dict:
    return {"beat": beat, "id": f"{calamity}_x", "title": title or f"{world.calamity_title(calamity)} strikes", "actor": "mabel", "calamity": calamity, "decision": "lean_in"}


def result_of(*calamities: str) -> dict:
    ms = [mishap(c, beat=i) for i, c in enumerate(calamities)]
    return {"warmth": 60, "chaos": 40, "quality_avg": 60, "quality_lead": 60, "quality": [], "mishaps": ms, "calamities": list(calamities), "tradition_hits": 0, "yes_and": 0, "cues_used": [], "beats": []}


def inp(night: int, result: dict, town: str = "marshwick", next_town: str | None = "gloomsby") -> dict:
    return {"tour_id": TOUR, "night": night, "seed": SEED, "genre": "farce", "town": town, "result": result, "next_town": next_town}


async def _tour_in(store) -> GraphStore:
    st = GraphStore(store)
    await put_tour(st, tour_rules.new_tour(SEED, TOUR))
    return st


def enshrine_all(payload):
    return {"enshrine": [c["calamity"] for c in payload["candidates"]]}


async def test_one_calamity_is_noted_but_is_not_yet_a_candidate(saver, store):
    st = await _tour_in(store)
    graph = build(saver, store)
    values, events, asked = await drive(graph, inp(0, result_of("the_lean")), {"configurable": {"thread_id": "a0"}}, enshrine_all)
    assert asked == [], "no calamity has recurred, so the Prompter is not asked"
    noted = [e for e in events if e["kind"] == "almanac.noted"]
    assert len(noted) == 1 and noted[0]["data"]["calamity"] == "the_lean" and noted[0]["data"]["count"] == 1
    assert "Marshwick-on-Mire" in noted[0]["data"]["text"] and "farce" in noted[0]["data"]["text"]
    written = [e for e in events if e["kind"] == "memory.written"]
    assert len(written) == 1 and written[0]["data"]["ns"] == f"almanac/{TOUR}" and written[0]["data"]["key"] == "the_lean:0:0"
    tour = await get_tour(st, TOUR)
    assert tour["calamity_counts"] == {"the_lean": 1} and tour["traditions"] == []
    assert values["traditions"] == []
    assert len(await st.search(ns_almanac(TOUR), None, 10)) == 1


async def test_a_recurring_calamity_becomes_a_tradition_and_grants_an_encore(saver, store):
    st = await _tour_in(store)
    graph = build(saver, store)
    await drive(graph, inp(0, result_of("the_lean", "the_chair")), {"configurable": {"thread_id": "n0"}}, enshrine_all)
    encore_before = (await get_tour(st, TOUR))["encore"]

    values, events, asked = await drive(graph, inp(1, result_of("the_lean"), town="gloomsby", next_town="hinge_regis"), {"configurable": {"thread_id": "n1"}}, enshrine_all)
    assert len(asked) == 1
    p = asked[0]
    assert p["kind"] == "curate_traditions" and p["max"] == 2
    assert p["candidates"] == [{"calamity": "the_lean", "title": "The Lean", "count": 2, "text": p["candidates"][0]["text"]}]
    assert "The Lean" in p["candidates"][0]["text"]
    kinds = [e["kind"] for e in events]
    assert kinds.index("almanac.candidate") < kinds.index("almanac.tradition")
    cand = next(e for e in events if e["kind"] == "almanac.candidate")
    assert cand["data"]["calamity"] == "the_lean" and cand["data"]["count"] == 2
    assert next(e for e in events if e["kind"] == "almanac.tradition")["data"] == {"calamity": "the_lean", "title": "The Lean"}

    assert values["traditions"] == [{"calamity": "the_lean", "title": "The Lean", "count": 2}]
    tour = await get_tour(st, TOUR)  # the Store survives; this is what the HUD and the next show read
    assert tour["traditions"] == values["traditions"] and tour["encore"] == encore_before + 1
    assert tour["calamity_counts"] == {"the_lean": 2, "the_chair": 1}
    keys = [e["key"] for e in events]
    assert len(keys) == len(set(keys)), "event keys must be unique within a run"


async def test_declining_enshrines_nothing_and_a_candidate_stays_a_candidate(saver, store):
    st = await _tour_in(store)
    graph = build(saver, store)
    await drive(graph, inp(0, result_of("the_lean", "the_lean")), {"configurable": {"thread_id": "d0"}}, lambda p: {"enshrine": []})
    tour = await get_tour(st, TOUR)
    assert tour["traditions"] == [] and tour["encore"] == 2 and tour["calamity_counts"]["the_lean"] == 2
    _, _, asked = await drive(graph, inp(1, result_of("the_chair")), {"configurable": {"thread_id": "d1"}}, lambda p: {"enshrine": []})
    assert [c["calamity"] for c in asked[0]["candidates"]] == ["the_lean"], "a declined candidate is offered again, once, next night"


@pytest.mark.parametrize("garbage", ["banana", None, 7, [], {}, {"enshrine": 7}, {"enshrine": [1, None, {}]}, {"enshrine": ["not_a_candidate"]}, {"enshrine": "nope"}])
async def test_garbage_resume_values_enshrine_nothing_and_do_not_crash(saver, store, garbage):
    st = await _tour_in(store)
    graph = build(saver, store)
    values, _, asked = await drive(graph, inp(0, result_of("the_lean", "the_lean")), {"configurable": {"thread_id": "g"}}, lambda p: garbage)
    assert len(asked) == 1
    assert values["traditions"] == []
    assert (await get_tour(st, TOUR))["encore"] == 2


async def test_at_most_two_traditions_and_only_real_candidates_count(saver, store):
    st = await _tour_in(store)
    graph = build(saver, store)
    three = result_of("the_lean", "the_lean", "the_chair", "the_chair", "the_wig", "the_wig")
    greedy = lambda p: {"enshrine": ["the_wig", "bogus", "the_wig", "the_lean", "the_chair"]}  # noqa: E731
    values, events, asked = await drive(graph, inp(0, three), {"configurable": {"thread_id": "m"}}, greedy)
    assert [c["calamity"] for c in asked[0]["candidates"]] == ["the_chair", "the_lean", "the_wig"], "candidates are listed most-recurring first, then by name"
    assert [t["calamity"] for t in values["traditions"]] == ["the_wig", "the_lean"], "max 2, de-duplicated, bogus slugs dropped, order kept"
    assert len([e for e in events if e["kind"] == "almanac.tradition"]) == 2
    assert (await get_tour(st, TOUR))["encore"] == 4


async def test_semantic_recall_finds_the_legend_of_the_next_town(saver, lore_store):
    st = await _tour_in(lore_store)
    assert await seed_legends(st) == 60
    graph = build(saver, lore_store)
    values, events, _ = await drive(graph, inp(0, result_of("the_lean"), town="gloomsby", next_town="marshwick"), {"configurable": {"thread_id": "r"}}, enshrine_all)
    recalled = values["recalled"]
    assert 1 <= len(recalled) <= 3
    assert recalled[0]["town"] == "marshwick" and recalled[0]["calamity"] == "the_chair", "Marshwick expects the chair; its legend is the top hit"
    assert "Marshwick" in recalled[0]["text"]
    assert all(set(r) == {"text", "calamity", "town", "score"} and r["score"] > 0 for r in recalled)
    own = [r for r in recalled if r["town"] == "marshwick"]
    assert len(own) == 2 and recalled[:2] == own, "both of Marshwick's legends come before anything about other towns"
    assert own == sorted(own, key=lambda r: -r["score"]) and [r["score"] for r in recalled[2:]] == sorted((r["score"] for r in recalled[2:]), reverse=True)
    assert [e["data"] for e in events if e["kind"] == "memory.recalled"] == recalled


async def test_every_town_recalls_its_own_legends_first(saver, lore_store):
    st = await _tour_in(lore_store)
    await seed_legends(st)
    graph = build(saver, lore_store)
    for i, town in enumerate(sorted(world.towns())):
        values, _, _ = await drive(graph, inp(0, result_of(), next_town=town), {"configurable": {"thread_id": f"all-{i}"}}, enshrine_all)
        assert values["recalled"] and values["recalled"][0]["town"] == town, town


async def test_this_tours_own_calamity_can_be_recalled_later(saver, lore_store):
    """The Almanac remembers what happened IN this tour: a goose in Gloomsby is recalled on the way back to a goose-minded town."""
    st = await _tour_in(lore_store)
    await seed_legends(st)
    graph = build(saver, lore_store)
    res = {**result_of("the_goose_incident"), "mishaps": [mishap("the_goose_incident", title="The goose eats the wedding cake")]}
    values, _, _ = await drive(graph, inp(0, res, town="gloomsby", next_town="marshwick"), {"configurable": {"thread_id": "own"}}, enshrine_all)
    own = await st.search(ns_almanac(TOUR), "goose wedding cake", 3)
    assert own and own[0]["value"]["calamity"] == "the_goose_incident" and "Gloomsby" in own[0]["value"]["text"]
    assert values["recalled"], "something is always remembered about a town with legends"


async def test_no_next_town_means_nothing_to_recall(saver, lore_store):
    st = await _tour_in(lore_store)
    await seed_legends(st)
    values, events, _ = await drive(build(saver, lore_store), inp(0, result_of("the_lean"), next_town=None), {"configurable": {"thread_id": "z"}}, enshrine_all)
    assert values["recalled"] == [] and not [e for e in events if e["kind"] == "memory.recalled"]


async def test_replaying_a_night_never_counts_a_calamity_twice(saver, store):
    st = await _tour_in(store)
    graph = build(saver, store)
    for attempt in ("x1", "x2"):
        await drive(graph, inp(0, result_of("the_lean")), {"configurable": {"thread_id": attempt}}, enshrine_all)
    tour = await get_tour(st, TOUR)
    assert tour["calamity_counts"] == {"the_lean": 1} and tour["calamity_log"] == {"0": ["the_lean"]}
    assert len(await st.search(ns_almanac(TOUR), None, 10)) == 1


async def test_a_replayed_night_replaces_its_old_contribution(saver, store):
    """'Take it from the top' ends differently: the night's second pass counts INSTEAD of its first, other nights are untouched."""
    st = await _tour_in(store)
    graph = build(saver, store)
    await drive(graph, inp(0, result_of("the_lean", "the_chair")), {"configurable": {"thread_id": "h0"}}, enshrine_all)
    await drive(graph, inp(1, result_of("the_wig")), {"configurable": {"thread_id": "h1"}}, enshrine_all)
    _, events, _ = await drive(graph, inp(0, result_of("the_lean", "the_lean")), {"configurable": {"thread_id": "h0b"}}, lambda p: {"enshrine": []})
    tour = await get_tour(st, TOUR)
    assert tour["calamity_counts"] == {"the_lean": 2, "the_wig": 1}, "the_chair vanished with the old night 0"
    assert tour["calamity_log"] == {"0": ["the_lean", "the_lean"], "1": ["the_wig"]}
    assert [e["data"]["count"] for e in events if e["kind"] == "almanac.noted"] == [1, 2]


async def test_a_new_tour_reusing_an_id_counts_from_zero_despite_old_almanac_entries(saver, store):
    """The same seed gives the same tour id, so a restarted tour finds the previous run's entries in the Store."""
    st = await _tour_in(store)
    await drive(build(saver, store), inp(0, result_of("the_lean")), {"configurable": {"thread_id": "o1"}}, enshrine_all)
    await put_tour(st, tour_rules.new_tour(SEED, TOUR))  # POST /api/tour with the same seed
    await drive(build(saver, store), inp(0, result_of("the_lean")), {"configurable": {"thread_id": "o2"}}, enshrine_all)
    assert (await get_tour(st, TOUR))["calamity_counts"] == {"the_lean": 1}


async def test_two_mishaps_of_one_calamity_in_one_beat_keep_separate_memories(saver, store):
    st = await _tour_in(store)
    res = {**result_of("the_lean"), "mishaps": [mishap("the_lean", beat=2), mishap("the_lean", beat=2)]}
    _, events, asked = await drive(build(saver, store), inp(0, res), {"configurable": {"thread_id": "dup"}}, enshrine_all)
    assert len(await st.search(ns_almanac(TOUR), None, 10)) == 2
    assert [c["count"] for c in asked[0]["candidates"]] == [2]
    assert len({e["key"] for e in events}) == len(events)


async def test_a_real_show_flows_through_the_almanac(saver, store):
    """End to end against the engine: whatever the farce produced is remembered, and every noted calamity is a real one."""
    st = await _tour_in(store)
    town, genre = "marshwick", "farce"
    cast = default_cast(genre, SEED)
    result = eng.simulate_show(seed=SEED, night=0, genre=genre, town=town, cast=cast, script=make_script(genre, town, cast, SEED), policy="lean_in")
    assert result["mishaps"]
    values, events, asked = await drive(build(saver, store), inp(0, result), {"configurable": {"thread_id": "real"}}, enshrine_all)
    noted = [e["data"]["calamity"] for e in events if e["kind"] == "almanac.noted"]
    assert noted == [m["calamity"] for m in result["mishaps"]]
    assert (await get_tour(st, TOUR))["calamity_counts"] == {c: noted.count(c) for c in set(noted)}
    assert bool(asked) == any(noted.count(c) >= 2 for c in noted)
    assert {t["calamity"] for t in values["traditions"]} == {c["calamity"] for p in asked for c in p["candidates"]}


async def test_a_tour_missing_from_the_store_does_not_crash_the_graph(saver, store):
    values, _, _ = await drive(build(saver, store), inp(0, result_of("the_lean")), {"configurable": {"thread_id": "no-tour"}}, enshrine_all)
    assert values["traditions"] == [] and values["recalled"] == []
