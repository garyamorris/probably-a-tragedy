"""Studio and trace deep links: the only place that knows their URL shapes."""

from __future__ import annotations

import asyncio
import os
from typing import Any
from urllib.parse import quote

from tragedy.settings import get_settings


def tracing_enabled() -> bool:
    flag = os.environ.get("LANGSMITH_TRACING", os.environ.get("LANGCHAIN_TRACING_V2", "")).lower() in {
        "1",
        "true",
        "yes",
    }
    return flag and bool(os.environ.get("LANGSMITH_API_KEY"))


def project_name() -> str:
    return os.environ.get("LANGSMITH_PROJECT") or get_settings().langsmith_project


def studio_base() -> str:
    """The one link Studio documents: open Studio against this server."""
    s = get_settings()
    return f"{s.studio_url.rstrip('/')}/?baseUrl={quote(s.public_base_url, safe='')}"


def studio_route(assistant_id: str | None = None, thread_id: str | None = None) -> str:
    """Studio's own thread route, as Studio itself redirects to it (verified against the real Studio, 2026-11-08):

        <studio>/thread?baseUrl=<server>&render=interact&mode=graph&assistantId=<assistant uuid>&threadId=<thread id>

    `assistantId` selects the graph (the server's assistant UUID for it), `threadId` selects a thread of that graph.
    """
    s = get_settings()
    q = f"baseUrl={quote(s.public_base_url, safe='')}&render=interact&mode=graph"
    if assistant_id:
        q += f"&assistantId={quote(assistant_id, safe='')}"
    if thread_id:
        q += f"&threadId={quote(thread_id, safe='')}"
    return f"{s.studio_url.rstrip('/')}/thread?{q}"


def studio_graph(graph: str, assistant_id: str | None = None) -> str:
    return studio_route(assistant_id) if assistant_id else studio_base()


def studio_thread(thread_id: str, graph: str | None = None, assistant_id: str | None = None) -> str:
    return studio_route(assistant_id, thread_id)


_ASSISTANTS: dict[str, str] = {}


async def assistant_ids() -> dict[str, str]:
    """graph id -> the server's assistant UUID (Studio addresses graphs by assistant). Cached once known."""
    if _ASSISTANTS:
        return dict(_ASSISTANTS)
    try:
        from langgraph_sdk import get_client

        rows = await get_client(url=None).assistants.search(limit=100)
        for r in rows:
            _ASSISTANTS.setdefault(r["graph_id"], r["assistant_id"])
    except Exception:
        pass  # Studio links then degrade to the documented base link
    return dict(_ASSISTANTS)


def thread_graph(metadata: dict[str, Any] | None) -> str | None:
    """Which graph a thread belongs to: the server stamps `graph_id` on first run; the SPA's own `graph` is the fallback."""
    m = metadata or {}
    return m.get("graph_id") or m.get("graph")


async def recent_threads(graph_ids: list[str], per_graph: int = 4) -> dict[str, list[dict[str, Any]]]:
    """graph id -> its newest threads, via the in-process SDK client. Never raises: a down store is an empty launcher."""
    out: dict[str, list[dict[str, Any]]] = {g: [] for g in graph_ids}
    try:
        from langgraph_sdk import get_client

        client = get_client(url=None)
        for g in graph_ids:
            rows = await client.threads.search(metadata={"graph_id": g}, limit=per_graph, sort_by="updated_at", sort_order="desc")
            out[g] = [{"thread_id": r["thread_id"], "status": r.get("status"), "updated_at": r.get("updated_at") or ""} for r in rows]
    except Exception:
        pass
    return out


def render_launcher(graphs: list[dict[str, Any]], ids: dict[str, str], threads: dict[str, list[dict[str, Any]]]) -> str:
    """The `/go` page: every graph, and its newest threads, each linking straight to Studio with BOTH assistantId and threadId.

    Studio's own thread picker lists every graph's threads together and does not switch graph when you pick one, so a thread of
    one graph opens beside another graph's diagram. These links carry the pair, so Studio opens the right graph on the right thread.
    """
    from html import escape

    def li(g: dict[str, Any]) -> str:
        gid = g["id"]
        aid = ids.get(gid)
        rows = "".join(
            f'<li><a href="{escape(studio_thread(t["thread_id"], gid, aid))}" target="_blank" rel="noreferrer">{escape(t["thread_id"][:8])}</a>'
            f' <span class="st st-{escape(str(t.get("status") or "idle"))}">{escape(str(t.get("status") or "idle"))}</span>'
            f' <time>{escape(str(t.get("updated_at", ""))[:16].replace("T", " "))}</time></li>'
            for t in threads.get(gid, [])
        ) or '<li class="none">no threads yet</li>'
        return (
            f'<section><h2><a href="{escape(studio_graph(gid, aid))}" target="_blank" rel="noreferrer">{escape(g["title"])}</a> <code>{escape(gid)}</code></h2>'
            f'<p>{escape(g["blurb"])}</p><ul>{rows}</ul></section>'
        )

    body = "".join(li(g) for g in graphs)
    return (
        '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        "<title>Studio launcher</title><style>"
        ":root{color-scheme:dark;--bg:#14101c;--ink:#f1e7d0;--dim:#a99bb8;--gold:#e9b44c;--card:#201a2c}"
        "body{margin:0;padding:24px 16px 48px;background:var(--bg);color:var(--ink);font:16px/1.5 Georgia,serif}"
        "main{max-width:760px;margin:0 auto}h1{margin:0 0 4px}header p{color:var(--dim);margin:0 0 20px}"
        "section{background:var(--card);border-radius:10px;padding:12px 16px;margin:0 0 12px}"
        "h2{margin:0;font-size:1.05rem}h2 a{color:var(--gold)}code{color:var(--dim);font-size:.8rem}"
        "section p{margin:2px 0 6px;color:var(--dim)}ul{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:6px 16px}"
        "li{font-size:.9rem}li a{color:var(--ink)}time{color:var(--dim);font-size:.8rem}.none{color:var(--dim)}"
        ".st{font-size:.72rem;border:1px solid var(--dim);border-radius:9px;padding:0 6px;color:var(--dim)}.st-interrupted{color:var(--gold);border-color:var(--gold)}"
        "</style></head><body><main><header><h1>Studio launcher</h1>"
        "<p>Studio's thread picker lists every graph's threads together and does not switch graph when you pick one. "
        "Open threads from here instead: each link opens the right graph on the right thread. "
        '<a href="/app/" style="color:var(--gold)">Back to the game</a></p></header>'
        f"{body}</main></body></html>"
    )


def _trace_lookup(thread_id: str) -> tuple[str | None, str]:
    from langsmith import Client  # lazy

    client = Client()
    flt = f'and(eq(is_root, true), eq(metadata_key, "thread_id"), eq(metadata_value, "{thread_id}"))'
    runs = list(client.list_runs(project_name=project_name(), filter=flt, limit=1))
    if not runs:
        return None, "no trace for this thread yet (LangSmith can take a few seconds)"
    return client.get_run_url(run=runs[0], project_name=project_name()), "ok"


async def trace_link(thread_id: str | None) -> dict[str, Any]:
    if not tracing_enabled():
        return {
            "trace": None,
            "trace_status": "tracing is off: run `make dev TRACE=1` (needs LANGSMITH_API_KEY) to get trace links",
        }
    if not thread_id:
        return {"trace": None, "trace_status": "no thread yet"}
    try:
        url, status = await asyncio.wait_for(asyncio.to_thread(_trace_lookup, thread_id), timeout=6)
    except Exception as exc:
        return {"trace": None, "trace_status": f"trace lookup failed: {type(exc).__name__}"}
    return {"trace": url, "trace_status": status}


async def links(graph: str | None, thread_id: str | None) -> dict[str, Any]:
    aid = (await assistant_ids()).get(graph) if graph else None
    out: dict[str, Any] = {
        "studio_base": studio_base(),
        "studio_graph": studio_graph(graph, aid) if graph else studio_base(),
        "studio_thread": studio_thread(thread_id, graph, aid) if thread_id else None,
        "assistant_id": aid,
        "thread_id": thread_id,
        "langsmith_project": f"{get_settings().langsmith_url.rstrip('/')}/" if tracing_enabled() else None,
    }
    out.update(await trace_link(thread_id))
    return out
