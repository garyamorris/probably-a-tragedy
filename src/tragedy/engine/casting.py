"""Casting: audition scores, audition lines, Madame's recommendation."""

from __future__ import annotations

from itertools import permutations
from typing import Any

from tragedy.common.rng import clamp, pick, roll
from tragedy.data.tags import BEATS, ROLES
from tragedy.engine import world

ROLE_SKILLS: dict[str, tuple[str, ...]] = {
    "lead": ("drama", "romance"),
    "villain": ("menace", "drama"),
    "fool": ("comedy", "physical", "improv"),
}


def role_fit(actor: dict[str, Any], role: str) -> float:
    if role in actor.get("roles", []):
        return 100.0
    return 75.0 if actor["id"] == "gus" else 60.0


def flaw_exposure(actor: dict[str, Any], genre_id: str) -> float:
    """Expected flaw trouble in this genre, 0..1: sum of intensity x share of the genre's variants that trigger the flaw."""
    g = world.genres()[genre_id]
    variants = [v for beat in BEATS for v in g["beats"][beat]]
    total = 0.0
    for fid in actor.get("flaws", []):
        f = world.flaws()[fid]
        hit = sum(1 for v in variants if set(v["tags"]) & set(f["triggers"])) / max(1, len(variants))
        total += f["intensity"] * hit
    return min(1.0, total * 1.6)


def genre_skill(actor: dict[str, Any], genre_id: str) -> float:
    g = world.genres()[genre_id]
    return sum(actor["skills"][g["skill_by_beat"][b]] for b in BEATS) / len(BEATS)


def audition_score(actor_id: str, role: str, genre_id: str, seed: int, night: int) -> float:
    a = world.performers()[actor_id]
    role_skill = sum(a["skills"][s] for s in ROLE_SKILLS[role]) / len(ROLE_SKILLS[role])
    score = (
        0.35 * role_skill
        + 0.25 * genre_skill(a, genre_id)
        + 0.20 * role_fit(a, role)
        + 0.10 * (100 - a["stage_fright"])
        + 0.10 * (100 - 100 * flaw_exposure(a, genre_id))
        + (roll(seed, night, "audition", actor_id, role) - 0.5) * 6
    )
    return round(clamp(score), 1)


def audition_line(actor_id: str, role: str, genre_id: str, seed: int, night: int) -> str:
    """A real line from the genre for this role, spoken by the auditionee."""
    g = world.genres()[genre_id]
    pool = [
        ln["text"]
        for beat in ("setup", "complication")
        for v in g["beats"][beat]
        for ln in v["lines"]
        if ln["role"] == role
    ]
    text = pick(pool, seed, night, "audition-line", actor_id, role)
    me = world.nick(actor_id)
    names = {"lead": "the hero", "villain": "the villain", "fool": "the fool"}
    for r in ROLES:
        text = text.replace("{" + r + "}", me if r == role else names[r])
    return text.replace("{place}", "this room").replace("{town}", "this town").replace("{object}", "the thing")


def score_table(
    genre_id: str, seed: int, night: int, candidates: list[str] | None = None
) -> dict[str, dict[str, float]]:
    ids = candidates or sorted(world.performers())
    return {role: {a: audition_score(a, role, genre_id, seed, night) for a in ids} for role in ROLES}


def recommend(scores: dict[str, dict[str, float]]) -> dict[str, str]:
    """Best distinct triple by total score (336 combinations at most; ties by id order)."""
    ids = sorted(next(iter(scores.values())))
    best: tuple[float, tuple[str, str, str]] | None = None
    for trio in permutations(ids, 3):
        total = sum(scores[r][a] for r, a in zip(ROLES, trio, strict=True))
        if best is None or total > best[0] + 1e-9:
            best = (total, trio)
    assert best is not None
    return dict(zip(ROLES, best[1], strict=True))


def recommendation_note(cast: dict[str, str], genre_id: str) -> str:
    g = world.genres()[genre_id]
    lab = g["roles"]
    parts = [f"{world.nick(cast[r])} as {lab[r]}" for r in ROLES]
    risky = max(cast.values(), key=lambda a: flaw_exposure(world.performers()[a], genre_id))
    flaw = world.flaws()[world.performers()[risky]["flaws"][0]]["name"].lower()
    return f"{parts[0]}, {parts[1]}, and {parts[2]}. Do keep an eye on {world.nick(risky)}: {flaw}."


def valid_cast(cast: Any) -> bool:
    return (
        isinstance(cast, dict)
        and set(cast) == set(ROLES)
        and len(set(cast.values())) == 3
        and all(v in world.performers() for v in cast.values())
    )
