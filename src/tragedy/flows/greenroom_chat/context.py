from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class GreenroomContext:
    """Run context: WHICH tour and WHICH puppet. One compiled graph serves every performer; the persona comes from here."""

    tour_id: str = "tour-demo"
    actor_id: str = "mabel"


def ctx_get(ctx: Any, key: str, default: Any = None) -> Any:
    """`runtime.context` is None locally unless passed, a dict or the dataclass on the server: read all three the same way."""
    if ctx is None:
        return default
    value = ctx.get(key) if isinstance(ctx, dict) else getattr(ctx, key, None)
    return default if value in (None, "") else value
