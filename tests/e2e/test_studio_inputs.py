"""What LangGraph Studio actually sends: a form with a field or two, not the full payload the game builds.

Every graph must accept that over real HTTP against a real `langgraph dev` server, ask its questions, and finish. Before the
`defaults` step existed, `performance`, `almanac` and `the_road` died with `KeyError: 'tour_id'` on exactly these inputs.
"""

from __future__ import annotations

import uuid
from typing import Any

import httpx
import pytest

pytestmark = pytest.mark.e2e

MODES = ["values", "updates", "messages-tuple", "custom", "tasks", "checkpoints"]

SPARSE = [
    ("casting_call", {}),
    ("casting_call", {"genre": "farce"}),
    ("writers_room", {}),
    ("writers_room", {"genre": "farce"}),
    ("performance", {}),
    ("performance", {"tour_id": "studio-demo", "genre": "farce"}),
    ("reviews", {}),
    ("almanac", {}),
    ("almanac", {"tour_id": "studio-demo"}),
    ("the_road", {}),
    ("the_road", {"tour_id": "studio-demo"}),
    ("playbill_press", {}),
    ("rehearsal", {}),
    ("greenroom_chat", {"messages": [{"role": "user", "content": "hello Mrs. Gasket"}]}),
]


def answer(v: dict[str, Any]) -> Any:
    k = v.get("kind")
    if k == "confirm_cast":
        return {"cast": v["proposed"]}
    if k == "pick_draft":
        return {"draft_id": v["drafts"][0]["draft_id"]}
    if k == "prompters_box":
        return {"option": v["options"][0]["id"], "cue": None, "text": None}
    if k == "curate_traditions":
        return {"enshrine": [c["calamity"] for c in v["candidates"]][:2]}
    if k == "crossroads":
        return {"choice": v["choices"][0]["id"]}
    return {"approve": True}


@pytest.mark.parametrize("graph,inp", SPARSE, ids=[f"{g}:{','.join(i) or 'empty'}" for g, i in SPARSE])
def test_a_sparse_studio_input_runs_to_the_end(dev_server, graph, inp):
    http = httpx.Client(base_url=dev_server, timeout=120)
    tid = str(uuid.uuid4())
    http.post("/threads", json={"thread_id": tid, "metadata": {"graph": graph}}).raise_for_status()
    body: dict[str, Any] = {"input": inp}
    for _ in range(12):
        r = http.post(f"/threads/{tid}/runs/stream", json={"assistant_id": graph, "stream_mode": MODES, "stream_subgraphs": True, **body})
        assert r.status_code == 200 and "event: error" not in r.text, f"{graph} {inp}: {r.text[:500]}"
        state = http.get(f"/threads/{tid}/state").json()
        pending = [i for t in state.get("tasks", []) for i in t.get("interrupts", [])]
        if not pending:
            assert state["values"], f"{graph} finished with an empty state"
            return
        body = {"command": {"resume": {i["id"]: answer(i["value"]) for i in pending}}}
    pytest.fail(f"{graph} {inp}: still interrupted after 12 rounds")


# ---- the /go launcher: Studio's thread picker is global and never switches graph, so we hand out links that do ----


def _studio_target(r: httpx.Response) -> dict[str, str]:
    from urllib.parse import parse_qs, urlparse

    assert r.status_code == 302, r.text
    u = urlparse(r.headers["location"])
    assert u.netloc == "smith.langchain.com" and u.path.endswith("/studio/thread")
    return {k: v[0] for k, v in parse_qs(u.query).items()}


def test_go_thread_opens_studio_on_the_threads_own_graph(dev_server):
    """The thread's graph, not whatever Studio had selected: run two graphs, and each thread redirects to its own assistant."""
    assistants = {a["graph_id"]: a["assistant_id"] for a in httpx.post(f"{dev_server}/assistants/search", json={"limit": 50}).json()}
    seen = {}
    for graph in ("reviews", "casting_call"):
        t = httpx.post(f"{dev_server}/threads", json={"metadata": {"graph": graph}}, timeout=30).json()["thread_id"]
        httpx.post(f"{dev_server}/threads/{t}/runs/wait", json={"assistant_id": graph, "input": {}}, timeout=120)
        q = _studio_target(httpx.get(f"{dev_server}/go/thread/{t}", follow_redirects=False))
        assert q["threadId"] == t and q["assistantId"] == assistants[graph], f"{graph}: {q}"
        seen[graph] = t
    page = httpx.get(f"{dev_server}/go")
    assert page.status_code == 200 and "text/html" in page.headers["content-type"]
    for graph, t in seen.items():
        assert f"assistantId={assistants[graph]}&amp;threadId={t}" in page.text, f"{graph} thread listed under its own graph"


def test_go_graph_and_unknowns(dev_server):
    r = httpx.get(f"{dev_server}/go/graph/almanac", follow_redirects=False)
    assert "assistantId=" in r.headers["location"] and "threadId" not in r.headers["location"]
    assert httpx.get(f"{dev_server}/go/graph/nope", follow_redirects=False).status_code == 404
    assert httpx.get(f"{dev_server}/go/thread/{uuid.uuid4()}", follow_redirects=False).status_code == 404
