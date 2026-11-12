"""Custom game API (docs/PROTOCOL.md section 3). Everything that is NOT a graph run lives here.

All routes are `async def` and touch the Store only through the in-process SDK client (blockbuster-safe).
"""

from __future__ import annotations

import asyncio
import datetime as dt
import json
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import BaseModel

from tragedy import __version__
from tragedy.common.rng import stable_int
from tragedy.data import loader
from tragedy.data.tags import STAR_TARGET, TOUR_NIGHTS
from tragedy.engine import tour as tour_rules
from tragedy.models.factory import STATS as voice_stats
from tragedy.server import links
from tragedy.server.catalog import GRAPH_IDS, GRAPHS
from tragedy.settings import get_settings
from tragedy.tour_store import SdkStore, get_tour, put_tour, seed_legends

router = APIRouter(prefix="/api")
go = APIRouter(prefix="/go")  # human-facing Studio launcher: pages and redirects, not JSON


def _store() -> SdkStore:
    from langgraph_sdk import get_client

    return SdkStore(get_client(url=None))


async def _need_tour(tour_id: str) -> tuple[SdkStore, dict[str, Any]]:
    st = _store()
    tour = await get_tour(st, tour_id)
    if tour is None:
        raise HTTPException(404, f"no such tour: {tour_id}")
    return st, tour


def _manifest_sync() -> dict[str, Any]:
    p = loader.DATASET_DIR / "MANIFEST.json"
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}


async def _manifest() -> dict[str, Any]:
    # file IO must never run on the server's event loop (blockbuster): hop to a worker thread
    return await asyncio.to_thread(_manifest_sync)


def _dataset_page(name: str, offset: int, limit: int) -> dict[str, Any] | None:
    if name not in loader.names():
        return None
    data = loader.load(name)
    if isinstance(data, dict):  # playbill is one object
        return {"name": name, "rows": 1, "offset": 0, "items": data, "object": True}
    return {"name": name, "rows": len(data), "offset": offset, "items": list(data[offset : offset + limit])}


@router.get("/boot")
async def boot() -> dict[str, Any]:
    s = get_settings()
    man = await _manifest()
    ids = await links.assistant_ids()
    return {
        "version": __version__,
        "provider": s.resolved_provider(),
        "model": {"offline": "deterministic fake", "anthropic": s.model_fast, "openai": s.openai_model_fast}[s.resolved_provider()],
        "voice": dict(voice_stats),
        "tracing": {"enabled": links.tracing_enabled(), "project": links.project_name()},
        "studio": {"url": s.studio_url, "base_link": links.studio_base()},
        "public_base_url": s.public_base_url,
        "tour_nights": TOUR_NIGHTS,
        "star_target": STAR_TARGET,
        "graphs": [{**g, "assistant_id": ids.get(g["id"])} for g in GRAPHS],
        "datasets": [
            {"name": n, "rows": m.get("rows"), "desc": m.get("description", "")} for n, m in sorted(man.items())
        ],
    }


@router.get("/graphs")
async def graphs() -> list[dict[str, Any]]:
    return GRAPHS


@router.get("/datasets")
async def datasets() -> list[dict[str, Any]]:
    man = await _manifest()
    return [{"name": n, "rows": m.get("rows"), "desc": m.get("description", "")} for n, m in sorted(man.items())]


@router.get("/datasets/{name}")
async def dataset(name: str, offset: int = 0, limit: int = Query(50, le=500)) -> dict[str, Any]:
    page = await asyncio.to_thread(_dataset_page, name, offset, limit)
    if page is None:
        raise HTTPException(404, f"no such dataset: {name}")
    return page


class NewTour(BaseModel):
    seed: int | None = None
    daily: bool = False


@router.post("/tour")
async def new_tour(body: NewTour | None = None) -> dict[str, Any]:
    body = body or NewTour()
    seed = body.seed
    if seed is None:
        seed = (
            stable_int("daily", dt.date.today().isoformat()) % 1_000_000
            if body.daily
            else stable_int(dt.datetime.now().isoformat()) % 1_000_000
        )
    # a fresh id per tour even for a shared seed (the daily seed): otherwise a second tour would inherit the first one's
    # Almanac entries from the Store
    tour_id = f"tour-{stable_int(seed, dt.datetime.now().isoformat()) % 0xFFFFFF:06x}"
    tour = tour_rules.new_tour(int(seed), tour_id)
    st = _store()
    await seed_legends(st)
    await put_tour(st, tour)
    return tour


@router.get("/tour/{tour_id}")
async def read_tour(tour_id: str) -> dict[str, Any]:
    _, tour = await _need_tour(tour_id)
    return tour


class ThreadReq(BaseModel):
    graph: str
    attempt: int = 0
    night: int | None = None


@router.post("/tour/{tour_id}/thread")
async def thread(tour_id: str, body: ThreadReq) -> dict[str, Any]:
    if body.graph not in GRAPH_IDS:
        raise HTTPException(400, f"unknown graph: {body.graph}")
    _, tour = await _need_tour(tour_id)
    night = tour["night"] if body.night is None else body.night
    key_night = -1 if body.graph in {"playbill_press", "greenroom_chat"} else night  # these accumulate across the tour
    return {"thread_id": tour_rules.thread_id(tour_id, body.graph, key_night, body.attempt), "night": night}


@router.post("/tour/{tour_id}/rewind")
async def rewind(tour_id: str) -> dict[str, Any]:
    st, tour = await _need_tour(tour_id)
    new = tour_rules.spend(tour, "encore")
    if new is None:
        raise HTTPException(409, "no Encore tokens left: enshrine a Tradition in the Almanac to earn one")
    await put_tour(st, new)
    return {"encore": new["encore"]}


@router.post("/tour/{tour_id}/candle")
async def candle(tour_id: str) -> dict[str, Any]:
    st, tour = await _need_tour(tour_id)
    new = tour_rules.spend(tour, "candles")
    if new is None:
        raise HTTPException(409, "no rehearsal candles left tonight")
    await put_tour(st, new)
    return {"candles": new["candles"]}


@router.get("/links")
async def get_links(graph: str | None = None, thread_id: str | None = None) -> dict[str, Any]:
    return await links.links(graph, thread_id)


@go.get("", response_class=HTMLResponse)
async def launcher() -> HTMLResponse:
    """Every graph and its newest threads, each linking to Studio with the right graph AND thread (Studio's picker won't)."""
    ids = await links.assistant_ids()
    threads = await links.recent_threads(GRAPH_IDS)
    return HTMLResponse(links.render_launcher(GRAPHS, ids, threads), headers={"Cache-Control": "no-store"})


@go.get("/graph/{graph}")
async def go_graph(graph: str) -> RedirectResponse:
    if graph not in GRAPH_IDS:
        raise HTTPException(404, f"no graph called {graph!r}; try one of {', '.join(GRAPH_IDS)}")
    return RedirectResponse(links.studio_graph(graph, (await links.assistant_ids()).get(graph)), status_code=302)


@go.get("/thread/{thread_id}")
async def go_thread(thread_id: str) -> RedirectResponse:
    """Studio on this thread, with the graph it belongs to already selected."""
    from langgraph_sdk import get_client

    try:
        row = await get_client(url=None).threads.get(thread_id)
    except Exception as exc:
        raise HTTPException(404, f"no thread {thread_id!r}") from exc
    graph = links.thread_graph(row.get("metadata"))
    aid = (await links.assistant_ids()).get(graph) if graph else None
    return RedirectResponse(links.studio_thread(thread_id, graph, aid), status_code=302)
