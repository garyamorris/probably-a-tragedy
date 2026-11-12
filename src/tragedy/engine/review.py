"""Reviews: five pigeons weigh the same show differently. Stars never depend on model text."""

from __future__ import annotations

import re
from typing import Any

from tragedy.common.rng import clamp, pick, roll
from tragedy.engine import flavour, world

FEAST_TAGS = {"feast"}
STAR_CENTER, STAR_WIDTH = 0.34, 0.50  # centre was 0.30: after the fun-audit rebalance 0.34 puts a careless tour near 12 stars, a town-reading one near 15
NOISE_GAIN = 2.0  # pigeons are moody: widens night-to-night variance (rehearsal histograms, 'probably a tragedy')  # weighted metric x -> stars: 0.5 + 4.5 * clamp((x - center) / width)


def metrics(result: dict[str, Any], script: dict[str, Any] | None = None) -> dict[str, float]:
    chaos = result["chaos"]
    feast_beats = sum(1 for b in (script["beats"] if script else []) if FEAST_TAGS & set(b["tags"]) or "cake" in b.get("props", []))
    return {
        # each metric is stretched over the range it realistically spans (raw warmth lives in 35-90, quality in 40-80)
        "quality": clamp((result["quality_avg"] - 40) / 40, 0, 1),
        "lead": clamp((result["quality_lead"] - 40) / 40, 0, 1),
        "warmth": clamp((result["warmth"] - 30) / 65, 0, 1),
        "charm_chaos": clamp(1 - abs(chaos - 45) / 55, 0, 1),
        "tradition": min(1.0, result["tradition_hits"] / 2),
        # the snacks critic judges the banquet: a script with feast scenes is the lever, warmth only seasons it
        "snacks": clamp(0.1 + 0.3 * clamp((result["warmth"] - 30) / 65, 0, 1) + 0.6 * min(1.0, feast_beats / 2), 0, 1),
    }


def critic_stars(critic: dict[str, Any], m: dict[str, float], seed: int, night: int) -> float:
    w = critic["weights"]
    total_w = sum(w.values()) or 1.0
    x = sum(w.get(k, 0.0) * m[k] for k in m) / total_w
    stars = 0.5 + 4.5 * clamp((x - STAR_CENTER) / STAR_WIDTH, 0, 1)
    stars += critic["bias"] + (roll(seed, night, critic["id"], "noise") - 0.5) * 2 * critic["noise"] * NOISE_GAIN
    return clamp(round(stars * 2) / 2, 0.5, 5.0)


def _fill(template: str, ctx: dict[str, str]) -> str:
    return re.sub(r"\{(\w+)\}", lambda mo: ctx.get(mo.group(1), mo.group(0)), template)


def notable_mishap(result: dict[str, Any]) -> dict[str, Any] | None:
    return result["mishaps"][0] if result["mishaps"] else None


def quote_context(
    result: dict[str, Any],
    *,
    script: dict[str, Any],
    cast: dict[str, str],
    town: str,
    traditions: list[dict[str, Any]],
    seed: int,
    night: int,
) -> dict[str, str]:
    mi = notable_mishap(result)
    return {
        "show": script["title"],
        "lead": world.nick(cast["lead"]),
        "villain": world.nick(cast["villain"]),
        "fool": world.nick(cast["fool"]),
        "town": world.towns()[town]["name"],
        "mishap": mi["title"] if mi else "an uneventful miracle",
        "calamity": world.calamity_words(mi["calamity"]) if mi else "the quiet",
        "tradition": traditions[0]["title"] if traditions else "The First Night",
        "snack": flavour.snack(seed, night),
    }


def quote(critic: dict[str, Any], stars: float, ctx: dict[str, str], seed: int, night: int) -> str:
    bucket = str(max(1, int(stars)))
    return _fill(pick(critic["templates"][bucket], seed, night, critic["id"], "quote"), ctx)


def review_one(
    critic: dict[str, Any],
    result: dict[str, Any],
    *,
    script: dict[str, Any],
    cast: dict[str, str],
    town: str,
    traditions: list[dict[str, Any]],
    seed: int,
    night: int,
) -> dict[str, Any]:
    stars = critic_stars(critic, metrics(result, script), seed, night)
    ctx = quote_context(result, script=script, cast=cast, town=town, traditions=traditions, seed=seed, night=night)
    return {
        "critic": critic["id"],
        "name": critic["name"],
        "outlet": critic["outlet"],
        "stars": stars,
        "quote": quote(critic, stars, ctx, seed, night),
    }


def final_stars(reviews: list[dict[str, Any]]) -> float:
    return clamp(round(sum(r["stars"] for r in reviews) / max(1, len(reviews)) * 2) / 2, 0.5, 5.0)


def funds_delta(stars: float, warmth: float) -> int:
    return int(round(stars * warmth / 45))  # ~6-8 a night: scarce enough that what you buy matters (see engine.show.PROP_BONUS)


def headline_draft(
    stars: float, result: dict[str, Any], *, script: dict[str, Any], town: str, seed: int, night: int
) -> str:
    mi = notable_mishap(result)
    return flavour.headline(
        stars,
        seed,
        night,
        title=script["title"],
        town=world.towns()[town]["name"].split("-")[0],
        mishap=mi["title"] if mi else "A QUIET MIRACLE",
    )
