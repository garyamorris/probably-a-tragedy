"""Studio + trace links: URL shapes, the tracing gate, and the LangSmith lookup against a FAKE client (no network)."""

from __future__ import annotations

import pytest

from tragedy.server import links


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch):
    for v in ("LANGSMITH_TRACING", "LANGCHAIN_TRACING_V2", "LANGSMITH_API_KEY", "LANGSMITH_PROJECT"):
        monkeypatch.delenv(v, raising=False)


def test_tracing_needs_both_the_flag_and_a_key(monkeypatch):
    assert links.tracing_enabled() is False
    monkeypatch.setenv("LANGSMITH_TRACING", "true")
    assert links.tracing_enabled() is False, "flag without a key"
    monkeypatch.setenv("LANGSMITH_API_KEY", "k")
    assert links.tracing_enabled() is True
    monkeypatch.setenv("LANGSMITH_TRACING", "false")
    assert links.tracing_enabled() is False


def test_studio_urls_use_the_route_studio_itself_uses():
    """Shape verified against the real LangSmith Studio: /thread?baseUrl&render=interact&mode=graph&assistantId&threadId."""
    t = links.studio_thread("abc-123", "performance", "ASSIST-1")
    assert t.startswith("https://smith.langchain.com/studio/thread?baseUrl=http%3A%2F%2F")
    assert t.endswith("&render=interact&mode=graph&assistantId=ASSIST-1&threadId=abc-123")
    assert links.studio_graph("reviews", "ASSIST-2").endswith("&assistantId=ASSIST-2")
    # no assistant id known -> only the documented base link, never a made-up path
    assert links.studio_graph("reviews") == links.studio_base()
    assert links.studio_base().startswith("https://smith.langchain.com/studio/?baseUrl=")


async def test_links_resolve_the_assistant_id_for_the_graph(monkeypatch):
    async def fake_ids():
        return {"performance": "A-PERF"}

    monkeypatch.setattr(links, "assistant_ids", fake_ids)
    out = await links.links("performance", "thread-1")
    assert out["assistant_id"] == "A-PERF"
    assert "assistantId=A-PERF" in out["studio_graph"] and "threadId=thread-1" in out["studio_thread"]
    unknown = await links.links("nonexistent", "thread-1")
    assert unknown["assistant_id"] is None and unknown["studio_graph"] == links.studio_base()


async def test_off_means_an_honest_message_not_a_broken_link():
    out = await links.links("performance", "t1")
    assert out["trace"] is None and "tracing is off" in out["trace_status"] and out["langsmith_project"] is None


class _Run:
    id = "run-1"


def _fake_client(runs):
    calls = {}

    class FakeClient:
        def list_runs(self, **kw):
            calls["list_runs"] = kw
            return iter(runs)

        def get_run_url(self, *, run, project_name):
            calls["get_run_url"] = (run.id, project_name)
            return f"https://smith.langchain.com/o/org/projects/p/proj/r/{run.id}"

    return FakeClient, calls


async def test_lookup_filters_on_thread_id_and_returns_the_run_url(monkeypatch):
    monkeypatch.setenv("LANGSMITH_TRACING", "true")
    monkeypatch.setenv("LANGSMITH_API_KEY", "k")
    monkeypatch.setenv("LANGSMITH_PROJECT", "my-project")
    import langsmith

    cls, calls = _fake_client([_Run()])
    monkeypatch.setattr(langsmith, "Client", cls)
    out = await links.links("performance", "thread-xyz")
    assert out["trace"].endswith("/r/run-1") and out["trace_status"] == "ok"
    kw = calls["list_runs"]
    assert kw["project_name"] == "my-project" and kw["limit"] == 1
    assert 'eq(metadata_key, "thread_id")' in kw["filter"] and 'eq(metadata_value, "thread-xyz")' in kw["filter"]
    assert 'eq(is_root, true)' in kw["filter"]
    assert calls["get_run_url"] == ("run-1", "my-project")
    assert out["langsmith_project"]


async def test_no_run_yet_and_provider_errors_degrade_gracefully(monkeypatch):
    monkeypatch.setenv("LANGSMITH_TRACING", "true")
    monkeypatch.setenv("LANGSMITH_API_KEY", "k")
    import langsmith

    cls, _ = _fake_client([])
    monkeypatch.setattr(langsmith, "Client", cls)
    out = await links.links("performance", "t")
    assert out["trace"] is None and "no trace for this thread yet" in out["trace_status"]

    class Boom:
        def list_runs(self, **_):
            raise RuntimeError("401")

    monkeypatch.setattr(langsmith, "Client", Boom)
    out = await links.links("performance", "t")
    assert out["trace"] is None and "trace lookup failed" in out["trace_status"] and "RuntimeError" in out["trace_status"]
    assert (await links.links("performance", None))["trace_status"] == "no thread yet"


def test_thread_graph_prefers_the_server_stamp_and_falls_back_to_ours():
    assert links.thread_graph({"graph_id": "almanac", "graph": "x"}) == "almanac"
    assert links.thread_graph({"graph": "reviews"}) == "reviews"
    assert links.thread_graph({}) is None and links.thread_graph(None) is None


def test_launcher_links_every_thread_with_its_own_graph_and_thread_ids():
    """Studio's picker is global and never switches graph, so the launcher's links must carry assistantId AND threadId."""
    graphs = [{"id": "almanac", "title": "The Almanac", "blurb": "Memory."}, {"id": "reviews", "title": "Critics", "blurb": "Pigeons."}]
    ids = {"almanac": "A-ALM", "reviews": "A-REV"}
    threads = {"almanac": [{"thread_id": "11111111-aaaa", "status": "interrupted", "updated_at": "2026-11-08T15:10:09+00:00"}], "reviews": []}
    page = links.render_launcher(graphs, ids, threads)
    assert "assistantId=A-ALM&amp;threadId=11111111-aaaa" in page, "a thread links to ITS graph"
    assert "assistantId=A-REV" in page and "no threads yet" in page
    assert "st-interrupted" in page and "2026-11-08 15:10" in page
    assert "A-ALM&amp;threadId=11111111-aaaa" not in page.split("Critics")[1], "no thread leaks into another graph's section"


def test_launcher_escapes_what_it_prints():
    graphs = [{"id": "g", "title": "<script>x</script>", "blurb": "a & b"}]
    page = links.render_launcher(graphs, {}, {"g": [{"thread_id": '"><b>', "status": "<i>", "updated_at": ""}]})
    assert "<script>x" not in page and "&lt;script&gt;" in page and '"><b>' not in page


def test_launcher_without_assistant_ids_degrades_to_the_documented_base_link():
    page = links.render_launcher([{"id": "g", "title": "G", "blurb": "b"}], {}, {})
    assert "studio/?baseUrl=" in page and "assistantId" not in page
