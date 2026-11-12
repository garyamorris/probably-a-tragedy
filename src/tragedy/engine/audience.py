"""The paper audience: twelve seats, each with a taste, each reacting on its own (a Send x12 map step in the graph)."""

from __future__ import annotations

from typing import Any

from tragedy.common.rng import clamp, pick, roll, stable_int
from tragedy.engine import world

AUDIENCE_GAIN = 1.0  # mean seat delta -> warmth points per beat
REACTIONS = ("laugh", "gasp", "cry", "boo", "yawn", "applaud")
SOBBY = {"mourning", "reunion", "wedding", "romance", "death", "letter"}
SHOCKING = {"death", "murder", "poison", "ghost", "betrayal", "fire", "sword"}


def make_seats(seed: int, night: int, town_id: str, n: int = 12) -> list[dict[str, Any]]:
    town = world.towns()[town_id]
    mix, bias = town["audience"]["mix"], town["audience"].get("hat_bias")
    ids = sorted(world.tastes())
    picks = [mix[i % len(mix)] if i < 7 else pick(ids, seed, night, "seat-taste", i) for i in range(n)]
    order = sorted(range(n), key=lambda i: stable_int(seed, night, "seat-order", i))
    seats = []
    for pos, src in enumerate(order):
        taste = world.tastes()[picks[src]]
        hat = bias if bias and roll(seed, night, "hat", pos) < 0.3 else taste["hat"]
        seats.append({"seat": pos, "taste": taste["id"], "hat": hat, "palette": taste["palette"]})
    return seats


def seat_reaction(
    seat: dict[str, Any], *, tags: list[str], mishap_tags: list[str], chain: bool, beat: int, seed: int, night: int
) -> dict[str, Any]:
    taste = world.tastes()[seat["taste"]]
    likes, hates = set(taste["likes"]), set(taste["hates"])
    tagset = set(tags)
    liked, hated = sorted(tagset & likes), sorted(tagset & hates)
    affinity = len(liked) - 1.3 * len(hated)
    funny = bool(mishap_tags)
    r = roll(seed, night, beat, seat["seat"], "react")
    reaction, why = "yawn", "nothing much happened"
    if hated and r < taste["boo"] + 0.22 * len(hated):
        reaction, why = "boo", f"hates {hated[0]}"
    elif funny and r < min(0.95, taste["laugh"] + (0.12 if chain else 0.0)):
        reaction, why = "laugh", "a mishap, lovingly handled" if chain else "a mishap"
    elif tagset & SHOCKING and r < taste["gasp"] + 0.25:
        reaction, why = "gasp", f"saw {sorted(tagset & SHOCKING)[0]}"
    elif tagset & SOBBY and r < taste["cry"] + 0.2:
        reaction, why = "cry", f"moved by {sorted(tagset & SOBBY)[0]}"
    elif liked:
        reaction, why = "applaud", f"loves {liked[0]}"
    intensity = round(
        clamp(
            0.35
            + 0.25 * abs(affinity)
            + (0.25 if funny else 0.0)
            + 0.15 * roll(seed, night, beat, seat["seat"], "amp"),
            0,
            1,
        ),
        2,
    )
    base = {"laugh": 2.0, "applaud": 2.5, "gasp": 1.0, "cry": 1.0, "yawn": -1.0, "boo": -2.5}[reaction]
    delta = round(clamp(base * (0.6 + intensity) + 0.4 * affinity, -3.5, 4.5), 2)
    return {"seat": seat["seat"], "reaction": reaction, "intensity": intensity, "why": why, "delta": delta}


def tally(reactions: list[dict[str, Any]]) -> dict[str, Any]:
    counts = dict.fromkeys(REACTIONS, 0)
    for r in reactions:
        counts[r["reaction"]] += 1
    delta = round(sum(r["delta"] for r in reactions) / max(1, len(reactions)) * AUDIENCE_GAIN, 2)
    return {"delta": delta, "counts": counts}
