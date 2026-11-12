"""Tour state + Almanac memory in the LangGraph Store.

Two adapters, one API: graphs use the `BaseStore` they are given (`runtime.store` / `get_store()`), the custom FastAPI
routes use the in-process SDK client (`langgraph_sdk.get_client(url=None)`). Thread state rewinds; the Store does not:
that is the game's economy (Encore tokens, Traditions and the Almanac survive "Take it from the top").

Namespaces: ("tour", tour_id)/state   ("almanac","legends")/legend_###   ("almanac", tour_id)/<calamity>:<night>
"""

from __future__ import annotations

from typing import Any, Protocol

from tragedy.data.loader import load

NS_LEGENDS = ("almanac", "legends")


def ns_tour(tour_id: str) -> tuple[str, str]:
    return ("tour", tour_id)


def ns_almanac(tour_id: str) -> tuple[str, str]:
    return ("almanac", tour_id)


class StoreAdapter(Protocol):
    async def get(self, ns: tuple[str, ...], key: str) -> dict[str, Any] | None: ...
    async def put(self, ns: tuple[str, ...], key: str, value: dict[str, Any], *, index: bool = True) -> None: ...
    async def search(self, ns: tuple[str, ...], query: str | None, limit: int = 5) -> list[dict[str, Any]]: ...


class GraphStore:
    """Adapter over a langgraph `BaseStore` (inside graph nodes). `store=None` degrades to 'no memory'."""

    def __init__(self, store: Any) -> None:
        self.store = store

    async def get(self, ns: tuple[str, ...], key: str) -> dict[str, Any] | None:
        if self.store is None:
            return None
        item = await self.store.aget(ns, key)
        return dict(item.value) if item else None

    async def put(self, ns: tuple[str, ...], key: str, value: dict[str, Any], *, index: bool = True) -> None:
        if self.store is not None:
            await self.store.aput(ns, key, value, index=None if index else False)

    async def search(self, ns: tuple[str, ...], query: str | None, limit: int = 5) -> list[dict[str, Any]]:
        if self.store is None:
            return []
        items = await self.store.asearch(ns, query=query, limit=limit)
        return [{"key": i.key, "score": getattr(i, "score", None), "value": dict(i.value)} for i in items]


class SdkStore:
    """Adapter over the in-process langgraph SDK client (inside the custom FastAPI routes)."""

    def __init__(self, client: Any) -> None:
        self.client = client

    async def get(self, ns: tuple[str, ...], key: str) -> dict[str, Any] | None:
        try:
            item = await self.client.store.get_item(list(ns), key)
        except Exception:
            return None
        return dict(item["value"]) if item else None

    async def put(self, ns: tuple[str, ...], key: str, value: dict[str, Any], *, index: bool = True) -> None:
        await self.client.store.put_item(list(ns), key, value, index=None if index else False)

    async def search(self, ns: tuple[str, ...], query: str | None, limit: int = 5) -> list[dict[str, Any]]:
        res = await self.client.store.search_items(list(ns), query=query, limit=limit)
        return [{"key": i["key"], "score": i.get("score"), "value": dict(i["value"])} for i in res.get("items", [])]


# ------------------------------------------------------------------------------------------------ tour state
async def get_tour(st: StoreAdapter, tour_id: str) -> dict[str, Any] | None:
    return await st.get(ns_tour(tour_id), "state")


async def put_tour(st: StoreAdapter, tour: dict[str, Any]) -> None:
    await st.put(ns_tour(tour["id"]), "state", tour, index=False)


async def seed_legends(st: StoreAdapter) -> int:
    """Idempotently load datasets/almanac_seeds.jsonl into the legends namespace (semantic-search field: text)."""
    rows = load("almanac_seeds")
    if rows and await st.get(NS_LEGENDS, rows[0]["id"]) is not None:
        return 0
    for r in rows:
        await st.put(NS_LEGENDS, r["id"], {"text": r["text"], "calamity": r["calamity"], "town": r["town"]})
    return len(rows)


async def remember_calamity(st: StoreAdapter, tour_id: str, night: int, entry: dict[str, Any]) -> str:
    key = f"{entry['calamity']}:{night}:{entry.get('beat', 0)}"
    await st.put(ns_almanac(tour_id), key, {"night": night, **entry})
    return key


async def recall(st: StoreAdapter, tour_id: str, query: str, limit: int = 3) -> list[dict[str, Any]]:
    """Semantic recall across the pre-seeded legends and this tour's own calamities."""
    hits = await st.search(NS_LEGENDS, query, limit) + await st.search(ns_almanac(tour_id), query, limit)
    hits.sort(key=lambda h: -(h["score"] or 0))
    return [
        {"text": h["value"]["text"], "calamity": h["value"].get("calamity"), "town": h["value"].get("town"), "score": round(h["score"] or 0, 3)}
        for h in hits[:limit]
    ]
