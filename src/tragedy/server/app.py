"""Custom FastAPI app mounted by `langgraph dev` via langgraph.json `http.app`.

Rules learned the hard way (Foghorn docs/design/01): async only (blockbuster), never `mount("/")` (it would swallow the
built-in /threads /runs /assistants routes), never define /info, keep `http.cors` unset, mount static under /app (NOT /ui).
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import FastAPI
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from starlette.types import ASGIApp, Receive, Scope, Send

from tragedy import __version__
from tragedy.server import routes
from tragedy.settings import get_settings

_STATIC_DIR = Path(__file__).parent / "static"


class StripPrivateNetworkRequest:
    """Drop Chrome's Private-Network-Access preflight header so langgraph-api's own middleware can answer it."""

    _HEADER = b"access-control-request-private-network"

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http" and scope.get("method") == "OPTIONS":
            headers = [(k, v) for k, v in scope["headers"] if k.lower() != self._HEADER]
            if len(headers) != len(scope["headers"]):
                scope = {**scope, "headers": headers}
        await self.app(scope, receive, send)


class RevalidateStatic:
    """Make the SPA's files revalidate on every load (`Cache-Control: no-cache`; the ETag keeps it to a cheap 304).

    StaticFiles sends only ETag + Last-Modified, so browsers cache the ES modules heuristically and keep running yesterday's
    code after an update (a playtest saw the old title screen after the file had changed). Only /app/* is touched.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or not scope.get("path", "").startswith("/app"):
            await self.app(scope, receive, send)
            return

        async def send_with_cache_control(message: Any) -> None:
            if message["type"] == "http.response.start":
                headers = [(k, v) for k, v in message.get("headers", []) if k.lower() != b"cache-control"]
                headers.append((b"cache-control", b"no-cache"))
                message = {**message, "headers": headers}
            await send(message)

        await self.app(scope, receive, send_with_cache_control)


def create_app() -> FastAPI:
    app = FastAPI(title="probably-a-tragedy custom routes", docs_url=None, redoc_url=None, openapi_url=None)
    app.add_middleware(StripPrivateNetworkRequest)
    app.add_middleware(RevalidateStatic)

    @app.get("/", include_in_schema=False)
    async def root() -> RedirectResponse:
        return RedirectResponse("/app/", status_code=307)

    @app.get("/healthz")
    async def healthz() -> dict[str, Any]:
        return {"status": "ok", "version": __version__, "provider": get_settings().resolved_provider()}

    app.include_router(routes.router)
    app.include_router(routes.go)
    app.mount("/app", StaticFiles(directory=_STATIC_DIR, html=True, check_dir=False), name="theatre")
    return app


app = create_app()
