from __future__ import annotations

from helpers import default_cast, make_script
from tragedy.common.stream import capture
from tragedy.engine import world
from tragedy.flows.playbill_press.build import build
from tragedy.flows.playbill_press.tasks import bio_text

SEED, GENRE, TOUR = 7, "farce", "tour-press"
TOWNS = ["marshwick", "gloomsby", "hinge_regis", "snoring_magna", "wibbling_opera"]


def cfg(thread: str = f"playbill-{TOUR}") -> dict:
    return {"configurable": {"thread_id": thread}}


def inp(night: int = 0, **patch) -> dict:
    cast = default_cast(GENRE, SEED, night)
    town = TOWNS[night]
    base = {
        "tour_id": TOUR, "night": night, "seed": SEED, "genre": GENRE, "town": town, "cast": cast,
        "script": make_script(GENRE, town, cast, SEED, night), "stars": 3.5, "headline": "A HIT IN MARSHWICK; GOOSE UNHARMED",
        "traditions": [{"calamity": "the_lean", "title": "The Lean", "count": 2}],
    }
    return {**base, **patch}


async def print_night(graph, night: int, thread: str = f"playbill-{TOUR}", **patch):
    with capture() as events:
        out = await graph.ainvoke(inp(night, **patch), cfg(thread))
    return out["playbill"], events


async def test_the_playbill_has_every_section(saver, store):
    graph = build(saver, store)
    pb, _ = await print_night(graph, 0)
    i = inp(0)
    assert set(pb) >= {"title", "town", "night", "genre", "cast", "tonight", "traditions", "quote", "back_page", "previously"}
    assert pb["title"] == i["script"]["title"] and pb["tagline"] == i["script"]["tagline"]
    assert (pb["town"], pb["night"], pb["genre"], pb["stars"]) == ("marshwick", 0, GENRE, 3.5)
    assert [c["role"] for c in pb["cast"]] == ["lead", "villain", "fool"]
    assert [c["id"] for c in pb["cast"]] == [i["cast"][r] for r in ("lead", "villain", "fool")]
    assert all(set(c) >= {"id", "name", "role", "bio"} for c in pb["cast"])
    assert pb["cast"][0]["role_label"] == world.genres()[GENRE]["roles"]["lead"]
    assert pb["quote"] == "A HIT IN MARSHWICK; GOOSE UNHARMED"
    assert pb["traditions"] and "The Lean" in pb["traditions"][0]
    assert pb["tonight"][0].startswith("Tonight") or "Marshwick-on-Mire" in pb["tonight"][0]
    assert len(pb["tonight"]) == 6 and all(b["logline"] in " ".join(pb["tonight"]) for b in i["script"]["beats"])
    assert len(pb["back_page"]) == 3 and len(set(pb["back_page"])) == 3
    assert pb["previously"] == []


async def test_sections_stream_in_poster_order_with_unique_keys(saver, store):
    _, events = await print_night(build(saver, store), 0)
    sections = [e for e in events if e["kind"] == "playbill.section"]
    assert [e["data"]["name"] for e in sections] == ["title", "cast", "tonight", "traditions", "quote", "back_page"]
    assert sections[0]["data"]["text"] == inp(0)["script"]["title"]
    assert len(sections[1]["data"]["items"]) == 3
    assert len({e["key"] for e in events}) == len(events)
    assert events[-1]["kind"] == "progress" and events[-1]["data"]["pct"] == 100


async def test_bios_use_the_grammar_the_performers_bio_seed_and_never_repeat_within_a_playbill(saver, store):
    pb, _ = await print_night(build(saver, store), 0)
    data = world.playbill_data()["bio"]
    bios = [c["bio"] for c in pb["cast"]]
    for c in pb["cast"]:
        p = world.performers()[c["id"]]
        assert c["bio"].startswith(f"{p['name']}, ") and p["bio_seed"].strip().rstrip(".") + "." in c["bio"]
        assert any(op in c["bio"] for op in data["openers"]) and any(cr in c["bio"] for cr in data["credits"]) and any(q in c["bio"] for q in data["quirks"])
    for part in ("openers", "credits", "quirks"):
        used = [next(x for x in data[part] if x in b) for b in bios]
        assert len(set(used)) == 3, f"every bio gets its own {part}"
    assert len(set(bios)) == 3


async def test_a_tour_does_not_repeat_a_players_bio(saver, store):
    graph = build(saver, store)
    leads = []
    for night in range(5):
        pb, _ = await print_night(graph, night, cast={"lead": "mabel", "villain": "reginald", "fool": "poppet"})
        leads.append(pb["cast"][0]["bio"])
    assert len(set(leads)) >= 4, "bios are a function of (seed, night): the programme changes as the tour goes on"


async def test_previously_grows_across_nights_on_the_same_thread(saver, store):
    graph = build(saver, store)
    lens, pbs = [], []
    for night, stars in enumerate([3.5, 2.5, 4.0]):
        pb, _ = await print_night(graph, night, stars=stars, headline=f"HEADLINE {night}")
        pbs.append(pb)
        lens.append(len(pb["previously"]))
    assert lens == [0, 1, 2]
    prev = pbs[2]["previously"]
    assert [p["night"] for p in prev] == [0, 1] and [p["town"] for p in prev] == ["marshwick", "gloomsby"]
    assert [p["stars"] for p in prev] == [3.5, 2.5]
    assert prev[0]["title"] == pbs[0]["title"] and prev[1]["title"] == pbs[1]["title"]
    for entry, town, stars in ((prev[0], "Marshwick-on-Mire", "3.5"), (prev[1], "Gloomsby-by-the-Sea", "2.5")):
        assert town in entry["text"] and stars in entry["text"] and entry["title"] in entry["text"], "the PREVIOUSLY template is filled in"
        assert "{" not in entry["text"]


async def test_reprinting_a_night_does_not_duplicate_it_and_remembers_only_earlier_nights(saver, store):
    graph = build(saver, store)
    await print_night(graph, 0)
    await print_night(graph, 1)
    again, _ = await print_night(graph, 1, stars=5.0)
    assert [p["night"] for p in again["previously"]] == [0], "a reprint of night 1 only remembers night 0"
    later, _ = await print_night(graph, 2)
    assert [(p["night"], p["stars"]) for p in later["previously"]] == [(0, 3.5), (1, 5.0)], "the reprint replaced the old night 1"


async def test_each_tour_has_its_own_memory(saver, store):
    graph = build(saver, store)
    await print_night(graph, 0, "playbill-tour-a")
    await print_night(graph, 1, "playbill-tour-a")
    other, _ = await print_night(graph, 1, "playbill-tour-b")
    assert other["previously"] == [], "another thread (tour) has not seen night 0"


async def test_the_same_input_prints_the_same_programme(saver, store):
    a, _ = await print_night(build(saver, store), 2, "t-a")
    b, _ = await print_night(build(saver, store), 2, "t-b")
    assert a == b


async def test_traditions_may_be_slugs_or_rows_and_a_bare_input_still_prints(saver, store):
    graph = build(saver, store)
    pb, _ = await print_night(graph, 0, "slugs", traditions=["the_goose_incident", {"calamity": "the_chair", "count": 3}, {"title": "no calamity"}, 5])
    assert [t.split(" (")[0] for t in pb["traditions"]] == ["The Goose Incident", "The Chair"]
    assert "seen 3 times" in pb["traditions"][1]

    out = await graph.ainvoke({"tour_id": "bare", "night": 0, "seed": 1}, cfg("bare"))
    bare = out["playbill"]
    assert bare["cast"] == [] and bare["traditions"] == [] and bare["title"] and bare["quote"] and len(bare["tonight"]) == 1


async def test_the_task_timeline_is_streamed_for_studio(saver, store):
    graph = build(saver, store)
    names = []
    async for chunk in graph.astream(inp(0), cfg("timeline"), stream_mode="updates"):
        names += list(chunk)
    assert {"bios", "traditions_page", "review_wall", "layout"} <= set(names)
    assert names.index("layout") > max(names.index(n) for n in ("bios", "traditions_page", "review_wall")), "layout waits for the three it assembles"


def test_the_entrypoint_is_one_node_with_a_typed_input_schema():
    from tragedy.graphs.playbill_press import graph

    assert set(graph.get_graph().nodes) == {"__start__", "playbill_press", "__end__"}
    schema = graph.get_input_jsonschema()
    props = schema["$defs"]["PlaybillInput"]["properties"]
    assert {"tour_id", "night", "seed", "genre", "town", "cast", "script", "stars", "headline", "traditions"} <= set(props)


def test_bio_text_follows_the_documented_template():
    text = bio_text("mabel", "a natural talent,", "Credits include a chair.", "Will not discuss the swan.")
    assert text == f"Mabel Tuckett, a natural talent, {world.performers()['mabel']['bio_seed']}. Credits include a chair. Will not discuss the swan."
