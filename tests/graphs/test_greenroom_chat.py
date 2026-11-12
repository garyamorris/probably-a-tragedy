from __future__ import annotations

from typing import Any

import pytest
from langchain_core.messages import AIMessage, AIMessageChunk, ToolMessage
from langgraph.store.memory import InMemoryStore
from langgraph.types import Command

from tragedy.common.stream import capture
from tragedy.embeddings import aembed
from tragedy.engine import tour as tour_rules
from tragedy.engine import world
from tragedy.flows.greenroom_chat.build import build
from tragedy.flows.greenroom_chat.middleware import UNCLEAR, clean_decision, clean_decisions
from tragedy.flows.greenroom_chat.persona import system_prompt
from tragedy.flows.greenroom_chat.scripts import build_script, extract_prop, gossip_query
from tragedy.flows.greenroom_chat.tools import prop_price, prop_slug, rank_gossip, towns_in
from tragedy.models.offline import OfflineChatModel
from tragedy.tour_store import GraphStore, get_tour, put_tour, seed_legends

TOUR = "tour-greenroom"
APPROVE = {"decisions": [{"type": "approve"}]}


@pytest.fixture
def lore_store() -> InMemoryStore:
    return InMemoryStore(index={"embed": aembed, "dims": 256, "fields": ["text"]})


def make_graph(saver, store, script=None):
    """The real agent with an instant offline model (no token delay), exactly as `build()` wires it otherwise."""
    return build(saver, store, model=OfflineChatModel(role="smart", script=script or build_script(), token_delay_s=0))


async def tour_in(store, **patch) -> GraphStore:
    st = GraphStore(store)
    await put_tour(st, {**tour_rules.new_tour(7, TOUR), **patch})
    return st


def ctx(actor: str = "mabel") -> dict[str, str]:
    return {"tour_id": TOUR, "actor_id": actor}


async def say(graph, text: str, thread: str, actor: str = "mabel", decide: Any = None) -> tuple[list, list, list]:
    """Send one message; answer every interrupt with `decide(payload)`. Returns (messages, interrupt payloads, custom events)."""
    config = {"configurable": {"thread_id": thread}}
    asked: list[dict] = []
    with capture() as events:
        out = await graph.ainvoke({"messages": [{"role": "user", "content": text}]}, config, context=ctx(actor))
        for _ in range(4):
            snap = await graph.aget_state(config)
            if not snap.interrupts:
                break
            asked += [i.value for i in snap.interrupts]
            out = await graph.ainvoke(Command(resume={i.id: decide(i.value) for i in snap.interrupts}), config, context=ctx(actor))
    return out["messages"], asked, list(events)


def reply_of(messages) -> str:
    return next(m for m in reversed(messages) if isinstance(m, AIMessage)).text


def tool_msgs(messages, name: str | None = None) -> list[ToolMessage]:
    return [m for m in messages if isinstance(m, ToolMessage) and (name is None or m.name == name)]


def voice_of(actor: str) -> set[str]:
    v = world.performers()[actor]["voice"]
    return set(v["catchphrases"])


# ------------------------------------------------------------------------------------------------ calm_nerves
async def test_a_calming_word_triggers_calm_nerves_and_raises_rapport(saver, store):
    st = await tour_in(store)
    msgs, asked, events = await say(make_graph(saver, store), "Mabel, you seem nervous. Take a breath, it will be fine.", "c1")
    assert asked == [], "calm_nerves is not reviewed"
    assert [m.name for m in tool_msgs(msgs)] == ["calm_nerves"] and "1/5" in tool_msgs(msgs)[0].text
    assert (await get_tour(st, TOUR))["rapport"] == {"mabel": 1}
    assert [e["data"] for e in events if e["kind"] == "greenroom.rapport"] == [{"actor": "mabel", "rapport": 1}]
    assert [e["data"] for e in events if e["kind"] == "greenroom.tool"] == [{"tool": "calm_nerves", "args": {}, "status": "done"}]
    reply = reply_of(msgs)
    assert any(c in reply for c in voice_of("mabel")) and "1/5" in reply, "the puppet answers in her own voice, quoting the tool result"
    assert len({e["key"] for e in events}) == len(events)


async def test_rapport_caps_at_five(saver, store):
    st = await tour_in(store)
    graph = make_graph(saver, store)
    for _ in range(7):
        _, _, events = await say(graph, "please calm down, you are worried again", "cap")
    assert (await get_tour(st, TOUR))["rapport"]["mabel"] == 5
    assert [e["data"]["rapport"] for e in events if e["kind"] == "greenroom.rapport"] == [5]


async def test_rapport_is_per_puppet_and_keeps_what_the_road_wrote(saver, store):
    st = await tour_in(store, rapport={"goose": 2})
    graph = make_graph(saver, store)
    await say(graph, "easy now, no nerves", "p1", actor="goose")
    await say(graph, "easy now, no nerves", "p2", actor="tock")
    assert (await get_tour(st, TOUR))["rapport"] == {"goose": 3, "tock": 1}


# ------------------------------------------------------------------------------------------------ fetch_prop: human review
async def test_a_prop_request_interrupts_with_the_langchain_review_payload(saver, store):
    st = await tour_in(store)
    msgs, asked, events = await say(make_graph(saver, store), "Mabel, do you need a chandelier for the finale?", "f1", decide=lambda p: APPROVE)
    assert len(asked) == 1
    p = asked[0]
    assert set(p) == {"action_requests", "review_configs"}
    (req,) = p["action_requests"]
    assert req["name"] == "fetch_prop" and req["args"] == {"prop": "probably secure chandelier"} and "Mrs. Gasket" in req["description"]
    assert p["review_configs"] == [{"action_name": "fetch_prop", "allowed_decisions": ["approve", "edit", "reject"]}]
    cost = prop_price("probably secure chandelier")
    assert f"{cost} fund" in req["description"]
    assert 1 <= cost <= 3

    tour = await get_tour(st, TOUR)
    assert tour["funds"] == 8 - cost, "approved: the funds are deducted, once"
    statuses = [(e["data"]["tool"], e["data"]["status"]) for e in events if e["kind"] == "greenroom.tool"]
    assert statuses == [("fetch_prop", "approved"), ("fetch_prop", "done")]
    args = [e["data"]["args"] for e in events if e["kind"] == "greenroom.tool"]
    assert args == [{"prop": "probably secure chandelier", "cost": cost}, {"prop": "probably secure chandelier", "cost": cost, "real": True}]
    assert tour["props"] == ["chandelier"], "a chandelier is a real prop of the plays: the troupe now owns it"
    assert "probably secure chandelier" in tool_msgs(msgs, "fetch_prop")[0].text and any(c in reply_of(msgs) for c in voice_of("mabel"))
    assert len({e["key"] for e in events}) == len(events)


async def test_rejecting_a_prop_costs_nothing_and_the_puppet_says_so(saver, store):
    st = await tour_in(store)
    msgs, asked, events = await say(
        make_graph(saver, store), "I need a sword, quickly", "f2", decide=lambda p: {"decisions": [{"type": "reject", "message": "Too dear this week."}]}
    )
    assert len(asked) == 1
    assert (await get_tour(st, TOUR))["funds"] == 8
    (tm,) = tool_msgs(msgs, "fetch_prop")
    assert tm.status == "error" and "Too dear this week." in tm.text and "rejected" in tm.text.lower()
    assert "No? Fine" in reply_of(msgs) and any(c in reply_of(msgs) for c in voice_of("mabel"))
    assert [e["data"]["status"] for e in events if e["kind"] == "greenroom.tool"] == ["rejected"], "nothing ran, so there is no 'done'"


async def test_editing_the_prop_swaps_what_gets_fetched_and_what_gets_charged(saver, store):
    st = await tour_in(store)
    edit = {"decisions": [{"type": "edit", "edited_action": {"name": "fetch_prop", "args": {"prop": "a Tiny Ladder!"}}}]}
    msgs, asked, events = await say(make_graph(saver, store), "could you borrow a crown for me", "f3", decide=lambda p: edit)
    assert asked[0]["action_requests"][0]["args"] == {"prop": "cardboard crown"}
    assert (await get_tour(st, TOUR))["funds"] == 8 - prop_price("a tiny ladder")
    statuses = [(e["data"]["status"], e["data"]["args"]["prop"]) for e in events if e["kind"] == "greenroom.tool"]
    assert statuses == [("edited", "a tiny ladder"), ("done", "a tiny ladder")]
    assert "a tiny ladder" in tool_msgs(msgs, "fetch_prop")[0].text


@pytest.mark.parametrize(
    "garbage",
    ["banana", None, 7, [], {}, {"decisions": "yes"}, {"decisions": []}, {"decisions": [None]}, {"decisions": [{"type": "explode"}]},
     {"decisions": [{"type": "edit"}]}, {"decisions": [{"type": "edit", "edited_action": {"name": "fetch_prop", "args": {"prop": 3}}}]}],
)
async def test_garbage_review_answers_never_crash_and_never_spend_funds(saver, store, garbage):
    st = await tour_in(store)
    msgs, asked, events = await say(make_graph(saver, store), "I need a lantern", "gb", decide=lambda p: garbage)
    assert len(asked) == 1
    assert (await get_tour(st, TOUR))["funds"] == 8, "an unclear answer is a rejection, never a purchase"
    (tm,) = tool_msgs(msgs, "fetch_prop")
    assert tm.status == "error"
    assert reply_of(msgs)
    assert [e["data"]["status"] for e in events if e["kind"] == "greenroom.tool"] == ["rejected"]


async def test_a_purse_too_light_for_the_prop_fails_politely(saver, store):
    st = await tour_in(store, funds=0)
    msgs, _, events = await say(make_graph(saver, store), "I need a chandelier", "poor", decide=lambda p: APPROVE)
    assert (await get_tour(st, TOUR))["funds"] == 0
    assert "empty-handed" in tool_msgs(msgs, "fetch_prop")[0].text
    assert [e["data"]["status"] for e in events if e["kind"] == "greenroom.tool"] == ["approved", "failed"]
    assert "purse is empty" in reply_of(msgs)


def test_decisions_are_cleaned_to_exactly_one_per_reviewed_call():
    tc = {"name": "fetch_prop", "args": {"prop": "x"}, "id": "c1", "type": "tool_call"}
    assert clean_decision({"type": "approve", "junk": 1}, tc) == {"type": "approve"}
    assert clean_decision({"type": "reject"}, tc) == {"type": "reject"}
    assert clean_decision("no", tc) == {"type": "reject", "message": UNCLEAR}
    assert clean_decision({"type": "edit", "args": {"prop": "Rope"}}, tc)["edited_action"] == {"name": "fetch_prop", "args": {"prop": "rope"}}
    assert clean_decisions(APPROVE, [tc]) == [{"type": "approve"}]
    assert clean_decisions({"type": "approve"}, [tc]) == [{"type": "approve"}], "one bare decision is accepted"
    assert [d["type"] for d in clean_decisions({"decisions": [{"type": "approve"}]}, [tc, tc])] == ["approve", "reject"], "missing answers are rejections"
    assert [d["type"] for d in clean_decisions({"decisions": [{"type": "approve"}] * 3}, [tc])] == ["approve"], "extra answers are ignored"


def test_prop_prices_are_one_to_three_funds_and_stable():
    names = [r["name"] for r in world.props().values()]
    prices = {n: prop_price(n) for n in names}
    assert set(prices.values()) <= {1, 2, 3} and len(set(prices.values())) == 3, "the dataset's props cover all three price points"
    assert prices == {n: prop_price(n) for n in names} and prop_price("Rope!!") == prop_price("rope")
    assert prop_slug("") == "a spare candle"


def test_a_named_town_outranks_a_better_raw_score():
    hits = [
        {"text": "other", "calamity": "the_wig", "town": "puddlecombe", "score": 0.30},
        {"text": "named", "calamity": "the_chair", "town": "marshwick", "score": 0.12},
        {"text": "nothing", "calamity": "the_wig", "town": "marshwick", "score": 0.0},
        {"text": "unscored", "calamity": None, "town": None, "score": None},
    ]
    assert [h["text"] for h in rank_gossip(hits, "gossip about Marshwick")] == ["named", "other"]
    assert [h["text"] for h in rank_gossip(hits, "the chair")] == ["other", "named"], "no town named: plain score order"
    assert towns_in("what happened in Snoring Magna and at the wibbling opera?") == {"snoring_magna", "wibbling_opera"}


def test_the_gossip_topic_is_read_from_the_message():
    assert gossip_query("any gossip about the town of marshwick?") == "marshwick"
    assert gossip_query("Mabel, what do they say about the opera house?", "Mabel Tuckett") == "opera house"
    assert gossip_query("gossip!") == "gossip!", "nothing left but the ask itself: search for the whole thing"


def test_the_prop_is_read_from_the_message():
    assert extract_prop("Do you need a chandelier?") == "probably secure chandelier"
    assert extract_prop("fetch me the sword") == "rubber sword"
    assert extract_prop("could you borrow a tiny wheelbarrow for tonight") == "tiny wheelbarrow"
    assert extract_prop("props, props, props") == "a spare candle"


# ------------------------------------------------------------------------------------------------ recall_gossip
async def test_gossip_questions_search_the_almanac(saver, lore_store):
    st = await tour_in(lore_store)
    await seed_legends(st)
    msgs, asked, events = await say(make_graph(saver, lore_store), "Mabel, any gossip about Marshwick? What have you heard about the chair?", "g1")
    assert asked == []
    recalled = [e["data"] for e in events if e["kind"] == "memory.recalled"]
    assert recalled and recalled[0]["town"] == "marshwick" and all(set(r) == {"text", "calamity", "town", "score"} for r in recalled)
    assert [e["data"]["tool"] for e in events if e["kind"] == "greenroom.tool"] == ["recall_gossip"]
    assert recalled[0]["text"] in reply_of(msgs) and any(c in reply_of(msgs) for c in voice_of("mabel"))
    asked_tool = next(tc for m in msgs if isinstance(m, AIMessage) for tc in m.tool_calls)
    assert asked_tool["name"] == "recall_gossip" and asked_tool["args"] == {"query": "marshwick chair"}, "the tool gets the topic, not the whole sentence"
    assert len({e["key"] for e in events}) == len(events)


async def test_gossip_with_nothing_remembered_still_gets_an_answer(saver, store):
    await tour_in(store)  # a store with no semantic index: nothing can be recalled
    msgs, _, events = await say(make_graph(saver, store), "any rumours about the town?", "g2")
    assert "Nobody" in reply_of(msgs) and not [e for e in events if e["kind"] == "memory.recalled"]


# ------------------------------------------------------------------------------------------------ persona
async def test_every_puppet_speaks_in_its_own_voice_from_one_compiled_graph(saver, store):
    await tour_in(store)
    graph = make_graph(saver, store)
    replies = {}
    for actor in world.performers():
        msgs, _, _ = await say(graph, "How was the journey?", f"v-{actor}", actor=actor)
        replies[actor] = reply_of(msgs)
        assert tool_msgs(msgs) == []
        assert any(c in replies[actor] for c in voice_of(actor)), f"{actor} uses a catchphrase from performers.json"
    assert len(set(replies.values())) == len(replies)


async def test_plain_chat_varies_with_the_conversation(saver, store):
    await tour_in(store)
    graph = make_graph(saver, store)
    seen = set()
    for i in range(6):
        msgs, _, _ = await say(graph, f"And then what happened, take {i}?", "var")
        seen.add(reply_of(msgs))
    assert len(seen) >= 4


async def test_the_system_prompt_is_built_from_the_performers_voice_and_the_tour(saver, store):
    await tour_in(store, rapport={"mabel": 3}, funds=5)
    script = build_script()
    await say(make_graph(saver, store, script), "Hello there", "sp")
    sys_prompt = script.calls[-1].system
    v = world.performers()["mabel"]["voice"]
    assert "Mabel Tuckett" in sys_prompt and v["tone"] in sys_prompt
    assert all(c in sys_prompt for c in v["catchphrases"]) and all(t in sys_prompt for t in v["tics"])
    assert "One string is too short." in sys_prompt, "flaw text from flaws.json"
    assert "rapport with the Prompter 3/5" in sys_prompt and "5 funds" in sys_prompt
    assert system_prompt("nobody-by-that-name").startswith("You are Mabel"), "an unknown puppet falls back instead of crashing"


async def test_a_missing_tour_does_not_crash_the_tools(saver, store):
    msgs, _, events = await say(make_graph(saver, store), "please calm down", "nt")
    assert "no tour" in tool_msgs(msgs)[0].text and [e["data"]["status"] for e in events if e["kind"] == "greenroom.tool"] == ["failed"]
    msgs, _, _ = await say(make_graph(saver, store), "I need a rope", "nt2", decide=lambda p: APPROVE)
    assert "no tour" in tool_msgs(msgs, "fetch_prop")[0].text


# ------------------------------------------------------------------------------------------------ streaming
async def test_tokens_stream_in_messages_mode(saver, store):
    await tour_in(store)
    graph = build(saver, store, model=OfflineChatModel(role="smart", script=build_script(), token_delay_s=0))
    chunks, nodes = [], set()
    async for chunk, meta in graph.astream(
        {"messages": [{"role": "user", "content": "Tell me about your day, Mabel"}]},
        {"configurable": {"thread_id": "s1"}}, context=ctx(), stream_mode="messages",
    ):
        if isinstance(chunk, AIMessageChunk) and chunk.content:
            chunks.append(chunk.text)
            nodes.add(meta["langgraph_node"])
    assert len(chunks) > 5, "one chunk per word, not one per message"
    assert nodes == {"model"}
    final = reply_of((await graph.aget_state({"configurable": {"thread_id": "s1"}})).values["messages"])
    assert "".join(chunks) == final


async def test_a_streamed_run_pauses_for_review_and_resumes(saver, store):
    st = await tour_in(store)
    graph = make_graph(saver, store)
    config = {"configurable": {"thread_id": "s2"}}
    seen: list[str] = []
    async for chunk, _meta in graph.astream({"messages": [{"role": "user", "content": "I need a harp"}]}, config, context=ctx(), stream_mode="messages"):
        seen.append(getattr(chunk, "text", ""))
    snap = await graph.aget_state(config)
    assert snap.next and snap.interrupts and (await get_tour(st, TOUR))["funds"] == 8
    async for chunk, _meta in graph.astream(Command(resume={snap.interrupts[0].id: APPROVE}), config, context=ctx(), stream_mode="messages"):
        seen.append(getattr(chunk, "text", ""))
    assert (await get_tour(st, TOUR))["funds"] < 8 and len([s for s in seen if s]) > 5


# ------------------------------------------------------------------------------------------------ wiring
def test_the_module_graph_is_one_agent_with_a_context_schema_and_no_checkpointer():
    from tragedy.graphs.greenroom_chat import graph

    assert graph.checkpointer is None and graph.store is None
    props = graph.get_context_jsonschema()["properties"]
    assert set(props) == {"tour_id", "actor_id"}
    assert {"model", "tools"} <= set(graph.get_graph().nodes)
    assert any("PropReviewMiddleware" in n and "after_model" in n for n in graph.get_graph().nodes)


def test_with_a_real_key_the_agent_uses_claude(monkeypatch):
    from pydantic import SecretStr

    from tragedy.models import factory
    from tragedy.settings import Settings

    s = Settings(provider="anthropic", anthropic_api_key=SecretStr("sk-test-not-real"))
    assert s.resolved_provider() == "anthropic"
    monkeypatch.setattr(factory, "get_settings", lambda: s)
    from langchain_anthropic import ChatAnthropic

    assert isinstance(factory.get_chat_model("smart", script=build_script()), ChatAnthropic)
    assert build() is not None  # the whole agent still assembles around it


async def test_buying_the_same_real_prop_twice_charges_once_and_a_made_up_prop_is_flavour_only(saver, store):
    """Money buys something real (a prop the plays ask for warms the house), once; a made-up prop is just lovely."""
    st = await tour_in(store)
    graph = make_graph(saver, store)
    await say(graph, "Mabel, do you need a chandelier for the finale?", "own1", decide=lambda p: APPROVE)
    after_first = await get_tour(st, TOUR)
    assert after_first["props"] == ["chandelier"]
    funds_after_first = after_first["funds"]
    await say(graph, "Mabel, do you need a chandelier for the finale?", "own2", decide=lambda p: APPROVE)
    again = await get_tour(st, TOUR)
    assert again["props"] == ["chandelier"] and again["funds"] == funds_after_first, "already owned: no second charge"
    from tragedy.flows.greenroom_chat.tools import prop_id_for

    assert prop_id_for("a unicorn") is None and prop_id_for("the Umbrella Stand") == "umbrella_stand"
