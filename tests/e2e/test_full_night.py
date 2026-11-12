"""One whole night over REAL HTTP against a REAL `langgraph dev` server: exactly the calls the SPA makes.

casting_call -> writers_room -> performance (Prompter interrupts) -> reviews -> almanac -> playbill_press -> the_road,
then a "Take it from the top" fork from a checkpoint. If this passes, the front end's contract with the back end holds.
"""

from __future__ import annotations

import json
from typing import Any

import httpx
import pytest

pytestmark = pytest.mark.e2e

STREAM_MODES = ["values", "updates", "messages-tuple", "custom", "tasks", "checkpoints"]


def parse_sse(text: str) -> list[tuple[str, Any]]:
    out: list[tuple[str, Any]] = []
    for frame in text.replace("\r\n", "\n").split("\n\n"):
        event, data = "message", []
        for line in frame.split("\n"):
            if line.startswith("event:"):
                event = line[6:].strip()
            elif line.startswith("data:"):
                data.append(line[5:].strip())
        if data:
            try:
                out.append((event, json.loads("\n".join(data))))
            except json.JSONDecodeError:
                out.append((event, "\n".join(data)))
    return out


class Client:
    def __init__(self, base: str) -> None:
        self.base = base
        self.http = httpx.Client(base_url=base, timeout=60)

    def api(self, method: str, path: str, **kw: Any) -> Any:
        r = self.http.request(method, path, **kw)
        assert r.status_code < 400, f"{method} {path} -> {r.status_code} {r.text[:400]}"
        return r.json()

    def thread_for(self, tour_id: str, graph: str, **extra: Any) -> str:
        tid = self.api("POST", f"/api/tour/{tour_id}/thread", json={"graph": graph, **extra})["thread_id"]
        self.api("POST", "/threads", json={"thread_id": tid, "if_exists": "do_nothing", "metadata": {"tour_id": tour_id, "graph": graph}})
        return tid

    def stream(self, graph: str, tid: str, body: dict[str, Any]) -> list[tuple[str, Any]]:
        payload = {"assistant_id": graph, "stream_mode": STREAM_MODES, "stream_subgraphs": True, "on_disconnect": "continue", **body}
        r = self.http.post(f"/threads/{tid}/runs/stream", json=payload)
        assert r.status_code == 200, r.text[:400]
        return parse_sse(r.text)

    def interrupts(self, tid: str) -> list[dict[str, Any]]:
        state = self.api("GET", f"/threads/{tid}/state")
        return [i for t in state.get("tasks", []) for i in t.get("interrupts", [])]

    def play(self, graph: str, tid: str, first: dict[str, Any], chooser) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
        """Run a graph to completion answering every interrupt. Returns (custom events, final state values, asked payloads)."""
        events: list[dict[str, Any]] = []
        asked: list[dict[str, Any]] = []
        body = first
        for _ in range(30):
            sse = self.stream(graph, tid, body)
            events += [d for e, d in sse if e.startswith("custom") and isinstance(d, dict)]
            errors = [d for e, d in sse if e == "error"]
            assert not errors, f"{graph} errored: {errors}"
            pending = self.interrupts(tid)
            if not pending:
                break
            resume = {}
            for it in pending:
                asked.append(it["value"])
                resume[it["id"]] = chooser(it["value"])
            body = {"command": {"resume": resume}}
        else:
            pytest.fail(f"{graph}: still interrupted after 30 rounds")
        return events, self.api("GET", f"/threads/{tid}/state")["values"], asked


def accept_everything(payload: dict[str, Any]) -> Any:
    kind = payload.get("kind")
    if kind == "confirm_cast":
        return {"cast": payload["proposed"]}
    if kind == "pick_draft":
        return {"draft_id": payload["drafts"][0]["draft_id"]}
    if kind == "prompters_box":
        return {"option": "lean_in", "cue": None, "text": None}
    if kind == "curate_traditions":
        return {"enshrine": [c["calamity"] for c in payload["candidates"]][:2]}
    if kind == "crossroads":
        return {"choice": payload["choices"][0]["id"]}
    pytest.fail(f"unexpected interrupt: {payload}")


@pytest.fixture(scope="module")
def night(dev_server):
    c = Client(dev_server)
    tour = c.api("POST", "/api/tour", json={"seed": 7})
    tid = tour["id"]
    town, nxt = tour["towns"][0], tour["towns"][1]
    genre = "farce"
    ctx = {"tour_id": tid, "night": 0, "seed": tour["seed"], "genre": genre, "town": town}
    out: dict[str, Any] = {"c": c, "tour": tour, "ctx": ctx, "events": {}, "asked": {}}

    def run(graph: str, inp: dict[str, Any], **thread_kw: Any) -> dict[str, Any]:
        thread = c.thread_for(tid, graph, **thread_kw)
        ev, values, asked = c.play(graph, thread, {"input": inp}, accept_everything)
        out["events"][graph], out["asked"][graph], out[graph + "_thread"] = ev, asked, thread
        return values

    cast = run("casting_call", ctx)["cast"]
    script = run("writers_room", {**ctx, "cast": cast, "traditions": []})["script"]
    perf = run("performance", {**ctx, "cast": cast, "script": script})
    result = perf["result"]
    rev = run("reviews", {**ctx, "cast": cast, "script": script, "result": result})
    alm = run("almanac", {**ctx, "result": result, "next_town": nxt})
    pb = run("playbill_press", {**ctx, "cast": cast, "script": script, "stars": rev["stars"], "headline": rev["headline"], "traditions": alm["traditions"]})
    road = run("the_road", {"tour_id": tid, "night": 0, "seed": tour["seed"], "from_town": town, "to_town": nxt})
    out.update(cast=cast, script=script, result=result, reviews=rev, almanac=alm, playbill=pb, road=road)
    return out


def test_every_graph_completed_and_asked_the_right_questions(night):
    assert night["asked"]["casting_call"][0]["kind"] == "confirm_cast"
    assert night["asked"]["writers_room"][0]["kind"] == "pick_draft"
    assert night["asked"]["performance"] and all(a["kind"] == "prompters_box" for a in night["asked"]["performance"])
    assert night["asked"]["the_road"][0]["kind"] == "crossroads"


def test_the_show_streamed_the_events_the_stage_needs(night):
    kinds = [e["kind"] for e in night["events"]["performance"] if "kind" in e and "key" in e]  # the envelope's own kind
    for k in ("audience.seat", "stage.beat", "stage.set", "stage.line", "stage.mishap", "stage.decision", "audience.react", "audience.tally", "meter", "stage.why", "stage.curtain"):
        assert k in kinds, f"missing {k}; got {sorted(set(kinds))}"
    assert kinds.count("stage.beat") == 5 and kinds.count("audience.react") == 60


def test_the_review_and_almanac_and_playbill(night):
    rev = night["reviews"]
    assert 0.5 <= rev["stars"] <= 5 and len(rev["reviews"]) == 5 and rev["headline"]
    assert night["playbill"]["playbill"]["cast"] and night["playbill"]["playbill"]["title"]


def test_the_tour_state_was_updated_by_the_graphs(night):
    c, tid = night["c"], night["tour"]["id"]
    tour = c.api("GET", f"/api/tour/{tid}")
    assert tour["night"] == 1, "the_road advances the night"
    assert tour["wagon"]["at"] == night["tour"]["towns"][1]
    assert len(tour["history"]) == 1 and tour["history"][0]["stars"] == night["reviews"]["stars"]
    assert tour["funds"] != night["tour"]["funds"] or night["reviews"]["funds_delta"] == 0


def test_take_it_from_the_top_forks_the_show_from_a_checkpoint(night):
    c = night["c"]
    thread = night["performance_thread"]
    hist = c.api("POST", f"/threads/{thread}/history", json={"limit": 100})
    starts = [h for h in hist if h.get("next") == ["direct"] and (h.get("values") or {}).get("show", {}).get("beat") == 2]
    assert starts, "a checkpoint exists at the start of the third beat"
    cp = starts[0]["checkpoint"]["checkpoint_id"]
    original_final = c.api("GET", f"/threads/{thread}/state")["values"]["result"]

    def cover_up(payload: dict[str, Any]) -> Any:
        opts = payload["options"]
        return {"option": next((o["id"] for o in opts if o["id"] == "cover_up"), opts[-1]["id"]), "cue": None, "text": None}

    _ev, values, asked = c.play("performance", thread, {"input": None, "checkpoint": {"checkpoint_id": cp}}, cover_up)
    assert values["result"]["beats"][:2] == original_final["beats"][:2], "the first two beats are shared history"
    assert len(values["result"]["beats"]) == 5
    assert asked or values["result"] != original_final


def test_economy_endpoints(night):
    c, tid = night["c"], night["tour"]["id"]
    before = c.api("GET", f"/api/tour/{tid}")
    assert c.api("POST", f"/api/tour/{tid}/rewind")["encore"] == before["encore"] - 1
    assert c.api("POST", f"/api/tour/{tid}/candle")["candles"] == before["candles"] - 1


def test_links_are_present_and_honest_about_tracing(night):
    c = night["c"]
    links = c.api("GET", "/api/links", params={"graph": "performance", "thread_id": night["performance_thread"]})
    assert links["studio_graph"].startswith("https://smith.langchain.com/studio/thread?baseUrl=")
    assert f"threadId={night['performance_thread']}" in links["studio_thread"]
    # Studio addresses a graph by the server's assistant id: it must be the real one
    assistants = {a["graph_id"]: a["assistant_id"] for a in c.api("POST", "/assistants/search", json={"limit": 50})}
    assert links["assistant_id"] == assistants["performance"] and f"assistantId={assistants['performance']}" in links["studio_thread"]
    boot_graphs = {g["id"]: g["assistant_id"] for g in c.api("GET", "/api/boot")["graphs"]}
    assert boot_graphs == assistants, "/api/boot exposes every graph's assistant id for the client's Studio links"
    assert links["trace"] is None and "tracing is off" in links["trace_status"]
    boot = c.api("GET", "/api/boot")
    assert len(boot["graphs"]) == 9 and boot["provider"] == "offline" and boot["tracing"]["enabled"] is False
    assert {d["name"] for d in boot["datasets"]} >= {"performers", "mishaps", "genres", "towns", "critics"}


def test_static_app_and_datasets_are_served(night):
    c = night["c"]
    r = c.http.get("/app/", follow_redirects=True)
    assert r.status_code == 200 and "text/html" in r.headers["content-type"]
    ds = c.api("GET", "/api/datasets/performers")
    assert ds["rows"] == 8 and ds["items"][0]["id"]
