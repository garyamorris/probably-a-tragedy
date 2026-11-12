"""Custom stream events (``stream_mode="custom"``): ONE envelope for every graph, produced by ONE helper.

    {"v": 1, "kind": <kind>, "key": <deterministic key>, "agent": <who or None>, "data": {...}}

* ``key`` is deterministic (e.g. ``"line:n2:b1:3"``) so the client can drop duplicates that a resumed node re-emits
  (an `interrupt()` node re-runs from line 1 on resume).
* Outside a run (unit tests calling a node function directly) ``emit`` is a silent no-op, or goes to ``capture``.
* The full catalogue of kinds and their ``data`` shapes is docs/PROTOCOL.md section 4.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

from langgraph.config import get_stream_writer

PAYLOAD_VERSION = 1

KINDS: frozenset[str] = frozenset(
    {
        # generic
        "progress",
        "note",
        "meter",
        # casting_call
        "cast.audition",
        "cast.recommend",
        # writers_room
        "script.draft",
        "script.chosen",
        # performance
        "stage.set",
        "stage.beat",
        "stage.enter",
        "stage.exit",
        "stage.direct",
        "stage.line",
        "stage.mishap",
        "stage.decision",
        "stage.cue",
        "stage.chain",
        "stage.curtain",
        "stage.why",
        "audience.seat",
        "audience.react",
        "audience.tally",
        # reviews
        "review.pigeon",
        "review.headline",
        # almanac
        "almanac.noted",
        "almanac.candidate",
        "almanac.tradition",
        "memory.recalled",
        "memory.written",
        # the_road
        "road.step",
        "road.event",
        "road.arrive",
        "road.crash",
        # playbill_press
        "playbill.section",
        # rehearsal
        "rehearsal.sample",
        "rehearsal.summary",
        # greenroom_chat
        "greenroom.rapport",
        "greenroom.tool",
    }
)

_CAPTURE: list[list[dict[str, Any]]] = []


def stream_payload(kind: str, key: str, /, *, agent: str | None = None, **data: Any) -> dict[str, Any]:
    return {"v": PAYLOAD_VERSION, "kind": kind, "key": key, "agent": agent, "data": data}


def emit(kind: str, key: str, /, *, agent: str | None = None, **data: Any) -> None:
    """Write one custom stream event. Safe from sync/async nodes and from tests (no-op outside a run)."""
    if kind not in KINDS:
        raise ValueError(f"unknown stream kind {kind!r}; add it to tragedy.common.stream.KINDS and docs/PROTOCOL.md")
    payload = stream_payload(kind, key, agent=agent, **data)
    if _CAPTURE:
        _CAPTURE[-1].append(payload)
    try:
        writer = get_stream_writer()
    except RuntimeError:
        return
    writer(payload)


@contextmanager
def capture() -> Iterator[list[dict[str, Any]]]:
    """Tests: collect every emitted payload (also works outside a graph run)."""
    buf: list[dict[str, Any]] = []
    _CAPTURE.append(buf)
    try:
        yield buf
    finally:
        _CAPTURE.pop()
