from __future__ import annotations

from typing import Annotated, Any, TypedDict


def merge_reviews(left: list[dict[str, Any]] | None, right: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    """Reducer: reviews merged by critic id, always in `critics.json` order (completion order is irrelevant)."""
    from tragedy.engine import world

    order = {c["id"]: i for i, c in enumerate(world.critics())}
    by_id = {r["critic"]: r for r in (left or [])}
    by_id.update({r["critic"]: r for r in (right or [])})
    return sorted(by_id.values(), key=lambda r: (order.get(r["critic"], len(order)), r["critic"]))


class ReviewsInput(TypedDict, total=False):
    tour_id: str
    night: int
    seed: int
    genre: str
    town: str
    cast: dict[str, str]
    script: dict[str, Any]
    result: dict[str, Any]  # the `performance` graph's result


class ReviewsOutput(TypedDict, total=False):
    stars: float
    funds_delta: int
    headline: str
    reviews: list[dict[str, Any]]


class ReviewsState(ReviewsInput, total=False):
    traditions: list[dict[str, Any]]  # the tour's enshrined Traditions (from the Store, else [])
    reviews: Annotated[list[dict[str, Any]], merge_reviews]  # filled by the `critics` Send workers
    stars: float
    funds_delta: int
    headline: str


class CriticInput(TypedDict):
    """What one `Send` carries to a `critics` worker."""

    critic: str
    seed: int
    night: int
    town: str
    cast: dict[str, str]
    script: dict[str, Any]
    result: dict[str, Any]
    traditions: list[dict[str, Any]]
