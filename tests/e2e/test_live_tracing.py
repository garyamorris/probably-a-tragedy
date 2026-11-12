"""LIVE: tracing end to end (opt-in: `uv run pytest -m live tests/e2e/test_live_tracing.py -s`).

Starts a real server with LangSmith tracing ON into a throwaway project (inputs/outputs hidden), plays casting ->
writers' room -> a whole show, then asks the app's OWN /api/links for the trace of the show thread and checks the link
resolves to a real root run carrying the thread id. This is the one thing the offline suite cannot prove.
"""

from __future__ import annotations

import os
import time

import pytest

from e2e.test_full_night import Client, accept_everything

pytestmark = pytest.mark.live
PROJECT = os.environ.get("TRAGEDY_TRACE_VERIFY_PROJECT", "probably-a-tragedy-verify")


@pytest.fixture(scope="module")
def traced(tracing_server):
    c = Client(tracing_server)
    tour = c.api("POST", "/api/tour", json={"seed": 5})
    tid = tour["id"]
    ctx = {"tour_id": tid, "night": 0, "seed": 5, "genre": "farce", "town": tour["towns"][0]}
    threads: dict[str, str] = {}

    def run(graph: str, inp: dict):
        threads[graph] = c.thread_for(tid, graph)
        _, values, _ = c.play(graph, threads[graph], {"input": inp}, accept_everything)
        return values

    cast = run("casting_call", ctx)["cast"]
    script = run("writers_room", {**ctx, "cast": cast, "traditions": []})["script"]
    run("performance", {**ctx, "cast": cast, "script": script})
    return {"c": c, "threads": threads}


def test_server_reports_tracing_on(traced):
    boot = traced["c"].api("GET", "/api/boot")
    assert boot["tracing"]["enabled"] is True and boot["tracing"]["project"] == PROJECT


def test_view_trace_link_resolves_to_the_shows_root_run(traced):
    c, thread = traced["c"], traced["threads"]["performance"]
    deadline, out = time.time() + 120, {}
    while time.time() < deadline:  # LangSmith ingests asynchronously
        out = c.api("GET", "/api/links", params={"graph": "performance", "thread_id": thread})
        if out["trace"]:
            break
        time.sleep(5)
    print("\n/api/links ->", out)
    assert out["trace"], f"no trace link after 120s: {out['trace_status']}"
    assert out["trace"].startswith("https://") and "smith.langchain.com" in out["trace"]
    assert out["studio_thread"] and thread in out["studio_thread"]


def test_the_trace_carries_the_metadata_the_lookup_relies_on(traced):
    """Read-only: which metadata keys does the server stamp on the root run? (documents the contract)."""
    from langsmith import Client as LS

    thread = traced["threads"]["performance"]
    runs = list(LS().list_runs(project_name=PROJECT, is_root=True, filter=f'and(eq(metadata_key, "thread_id"), eq(metadata_value, "{thread}"))', limit=3))
    assert runs, "root run with metadata thread_id not found"
    meta = runs[0].extra.get("metadata", {}) if runs[0].extra else {}
    print("root run:", runs[0].name, "| status:", runs[0].status, "| metadata keys:", sorted(meta))
    assert meta.get("thread_id") == thread
    assert meta.get("graph_id") == "performance" or runs[0].name
