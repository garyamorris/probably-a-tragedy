"""The SPA must revalidate on every load, or players keep running yesterday's modules after an update."""

from __future__ import annotations

import httpx

from tragedy.server.app import create_app


async def test_the_spa_files_are_served_with_no_cache_and_an_etag():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=create_app()), base_url="http://t") as c:
        r = await c.get("/app/js/views/title.js")
        assert r.status_code == 200
        assert r.headers["cache-control"] == "no-cache" and r.headers.get("etag"), "revalidate, cheaply, via the ETag"
        again = await c.get("/app/js/views/title.js", headers={"if-none-match": r.headers["etag"]})
        assert again.status_code == 304 and again.headers["cache-control"] == "no-cache"
        page = await c.get("/app/")
        assert page.status_code == 200 and page.headers["cache-control"] == "no-cache"


async def test_other_routes_are_left_alone():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=create_app()), base_url="http://t") as c:
        r = await c.get("/healthz")
        assert r.status_code == 200 and "cache-control" not in r.headers
