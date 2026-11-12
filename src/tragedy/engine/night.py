"""One whole night, headless: script -> show -> five reviews -> stars. Used by rehearsal, the gold set and the evals."""

from __future__ import annotations

from typing import Any

from tragedy.engine import review, show, world
from tragedy.engine import script as scr


def simulate_night(
    *, seed: int, night: int, genre: str, town: str, cast: dict[str, str], policy: str = "best",
    quill: str = "quill_tender", traditions: list[dict[str, Any]] | None = None, rapport: dict[str, int] | None = None,
    script: dict[str, Any] | None = None,
) -> dict[str, Any]:
    traditions = traditions or []
    sc = script or scr.draft_script(quill, seed=seed, night=night, genre=genre, town=town, cast=cast, traditions=[t["calamity"] for t in traditions])
    result = show.simulate_show(seed=seed, night=night, genre=genre, town=town, cast=cast, script=sc, rapport=rapport, traditions=traditions, policy=policy)
    reviews = [review.review_one(c, result, script=sc, cast=cast, town=town, traditions=traditions, seed=seed, night=night) for c in world.critics()]
    stars = review.final_stars(reviews)
    return {"script": sc, "result": result, "reviews": reviews, "stars": stars, "funds_delta": review.funds_delta(stars, result["warmth"])}
