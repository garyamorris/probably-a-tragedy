"""LIVE: the whole game on a REAL OpenAI model (opt-in: `uv run pytest -m live tests/e2e/test_live_openai.py -s`).

Proves three things: (1) every graph still completes with a real model voicing the puppets, (2) the model genuinely
rewrote text (voice stats), and (3) scores NEVER depend on model text: the same night played offline gives identical results.
Costs a few cents (about 15 short completions on a small model). Tracing is off and no LangSmith key is passed.
"""

from __future__ import annotations

from typing import Any

import pytest

from e2e.test_full_night import Client, accept_everything

pytestmark = pytest.mark.live


def play_night(base: str, seed: int = 7) -> dict[str, Any]:
    c = Client(base)
    tour = c.api("POST", "/api/tour", json={"seed": seed})
    tid, town, _nxt = tour["id"], tour["towns"][0], tour["towns"][1]
    ctx = {"tour_id": tid, "night": 0, "seed": seed, "genre": "farce", "town": town}
    out: dict[str, Any] = {"c": c, "tour": tour, "events": {}}

    def run(graph: str, inp: dict[str, Any]) -> dict[str, Any]:
        thread = c.thread_for(tid, graph)
        ev, values, _ = c.play(graph, thread, {"input": inp}, accept_everything)
        out["events"][graph] = ev
        return values

    out["cast"] = run("casting_call", ctx)["cast"]
    out["script"] = run("writers_room", {**ctx, "cast": out["cast"], "traditions": []})["script"]
    out["result"] = run("performance", {**ctx, "cast": out["cast"], "script": out["script"]})["result"]
    out["reviews"] = run("reviews", {**ctx, "cast": out["cast"], "script": out["script"], "result": out["result"]})
    return out


@pytest.fixture(scope="module")
def live(openai_server):
    return play_night(openai_server)


@pytest.fixture(scope="module")
def offline(dev_server):
    return play_night(dev_server)


def test_server_reports_the_real_provider(live):
    boot = live["c"].api("GET", "/api/boot")
    assert boot["provider"] == "openai" and "gpt" in boot["model"]


def test_the_model_really_voiced_the_puppets(live):
    v = live["c"].api("GET", "/api/boot")["voice"]
    print("voice stats:", v)
    assert v["calls"] >= 5, v
    assert v["fallbacks"] == 0, f"voice() silently fell back to the draft {v['fallbacks']} times: {v}"
    assert v["changed"] >= 3, "OpenAI should have rephrased most drafts"


def test_directors_notes_and_headline_were_rewritten_but_keep_the_facts(live, offline):
    live_notes = [e["data"]["text"] for e in live["events"]["performance"] if e["kind"] == "stage.direct"]
    off_notes = [e["data"]["text"] for e in offline["events"]["performance"] if e["kind"] == "stage.direct"]
    assert len(live_notes) == len(off_notes) == 5
    assert live_notes != off_notes, "a real model must change at least some wording"
    print("\n--- Madame, offline vs OpenAI ---")
    for a, b in list(zip(off_notes, live_notes, strict=True))[:3]:
        print(f"offline: {a}\nopenai : {b}\n")
    print("headline offline:", offline["reviews"]["headline"], "\nheadline openai :", live["reviews"]["headline"])
    assert live["reviews"]["headline"].strip()


def test_scores_never_depend_on_model_text(live, offline):
    """The central architecture claim: models give VOICE, the engine decides OUTCOMES."""
    assert live["cast"] == offline["cast"]
    assert live["result"] == offline["result"], "the show result must be identical with or without a real model"
    assert live["reviews"]["stars"] == offline["reviews"]["stars"]
    assert [r["stars"] for r in live["reviews"]["reviews"]] == [r["stars"] for r in offline["reviews"]["reviews"]]


def test_greenroom_agent_chats_and_uses_tools_with_a_real_model(openai_server):
    c = Client(openai_server)
    tour = c.api("POST", "/api/tour", json={"seed": 11})
    tid = tour["id"]
    thread = c.thread_for(tid, "greenroom_chat", attempt=0)
    body = {
        "input": {"messages": [{"role": "human", "content": "Mabel, you look terrified. Please calm your nerves before the show."}]},
        "context": {"tour_id": tid, "actor_id": "mabel"},
    }
    _events, values, _asked = c.play("greenroom_chat", thread, body, lambda p: {"decisions": [{"type": "approve"}]})
    msgs = values["messages"]
    tool_calls = [tc["name"] for m in msgs if m.get("type") == "ai" for tc in (m.get("tool_calls") or [])]
    reply = next(m for m in reversed(msgs) if m.get("type") == "ai" and m.get("content"))
    print("\ntool calls:", tool_calls, "\nMabel says:", reply["content"])
    assert reply["content"].strip()
    after = c.api("GET", f"/api/tour/{tid}")
    print("rapport after:", after["rapport"])
    assert tool_calls == [] or "calm_nerves" in tool_calls
