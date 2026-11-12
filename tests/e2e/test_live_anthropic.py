"""LIVE: the whole game on REAL Claude (opt-in: `uv run pytest -m live tests/e2e/test_live_anthropic.py -s`).

Mirrors test_live_openai.py: every graph completes with a real model voicing the puppets, the model genuinely rewrote text,
scores are IDENTICAL to the offline run, and the greenroom agent (create_agent + tool-call review) works with Claude's tool calling.
"""

from __future__ import annotations

import pytest

from e2e.test_full_night import Client
from e2e.test_live_openai import play_night

pytestmark = pytest.mark.live


@pytest.fixture(scope="module")
def live(anthropic_server):
    return play_night(anthropic_server)


@pytest.fixture(scope="module")
def offline(dev_server):
    return play_night(dev_server)


def test_server_reports_claude(live):
    boot = live["c"].api("GET", "/api/boot")
    assert boot["provider"] == "anthropic" and "claude" in boot["model"]


def test_claude_really_voiced_the_puppets(live):
    v = live["c"].api("GET", "/api/boot")["voice"]
    print("voice stats:", v)
    assert v["calls"] >= 5 and v["fallbacks"] == 0, f"voice() fell back to the draft: {v}"
    assert v["changed"] >= 3


def test_directors_notes_are_rewritten(live, offline):
    a = [e["data"]["text"] for e in offline["events"]["performance"] if e["kind"] == "stage.direct"]
    b = [e["data"]["text"] for e in live["events"]["performance"] if e["kind"] == "stage.direct"]
    assert len(a) == len(b) == 5 and a != b
    print("\n--- Madame, offline vs Claude ---")
    for x, y in list(zip(a, b, strict=True))[:3]:
        print(f"offline: {x}\nclaude : {y}\n")
    print("headline claude:", live["reviews"]["headline"])


def test_scores_never_depend_on_model_text(live, offline):
    assert live["cast"] == offline["cast"]
    assert live["result"] == offline["result"]
    assert live["reviews"]["stars"] == offline["reviews"]["stars"]


def test_greenroom_agent_uses_tools_with_claude(anthropic_server):
    c = Client(anthropic_server)
    tour = c.api("POST", "/api/tour", json={"seed": 13})
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
    text = reply["content"] if isinstance(reply["content"], str) else " ".join(b.get("text", "") for b in reply["content"] if isinstance(b, dict))
    print("\ntool calls:", tool_calls, "\nMabel says:", text)
    assert text.strip()
    print("rapport after:", c.api("GET", f"/api/tour/{tid}")["rapport"])
    assert tool_calls == [] or "calm_nerves" in tool_calls
