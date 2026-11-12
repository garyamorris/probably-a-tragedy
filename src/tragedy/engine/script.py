"""The Writers' Room: three quills draft a five-beat script from the genre's authored variants."""

from __future__ import annotations

from typing import Any

from tragedy.common.rng import clamp, pick, roll
from tragedy.data.tags import BEATS
from tragedy.engine import flavour, world
from tragedy.engine.casting import flaw_exposure

QUILLS: tuple[str, ...] = ("quill_pompous", "quill_frantic", "quill_tender")

QUILL_TASTE: dict[str, frozenset[str]] = {
    "quill_pompous": frozenset(
        {"speech", "crown", "trial", "death", "mourning", "rhyme", "letter", "betrayal", "mirror", "song"}
    ),
    "quill_frantic": frozenset(
        {
            "chase",
            "door",
            "slapstick",
            "fire",
            "storm",
            "sword",
            "mistaken_identity",
            "goose",
            "stairs",
            "chair",
            "chandelier",
        }
    ),
    "quill_tender": frozenset(
        {"romance", "kiss", "reunion", "wedding", "song", "dance", "feast", "ghost", "secret", "mourning"}
    ),
}
# How much each quill listens to the town (the pompous one barely does).
QUILL_ATTENTION: dict[str, float] = {"quill_pompous": 0.25, "quill_frantic": 0.6, "quill_tender": 0.9}

# A tradition is "honoured" by a script when a beat carries the matching prop.
CALAMITY_PROP: dict[str, str] = {
    "the_chair": "chair",
    "the_chandelier": "chandelier",
    "the_cake": "cake",
    "the_candle": "candle",
    "the_umbrella": "umbrella_stand",
    "the_mask": "mask",
    "the_moon": "moon",
    "the_ghost_sheet": "ghost_sheet",
    "the_goose_incident": "goose",
    "the_corpse": "skull",
    "the_swordfight": "sword",
    "the_kiss": "bouquet",
    "the_wrong_door": "door",
    "the_trapdoor": "trunk",
    "the_banister": "ladder",
}


def town_alignment(town_id: str, tags: set[str] | list[str]) -> float:
    temp = world.towns()[town_id]["temperament"]
    likes, hates = set(temp["likes"]), set(temp["hates"])
    return sum(1.0 for t in set(tags) if t in likes) - 1.3 * sum(1.0 for t in set(tags) if t in hates)


def _variant_score(
    quill: str,
    v: dict[str, Any],
    town_id: str,
    tradition_props: set[str],
    seed: int,
    night: int,
    beat: str,
    attempt: int,
) -> float:
    taste = len(set(v["tags"]) & QUILL_TASTE[quill])
    town = QUILL_ATTENTION[quill] * town_alignment(town_id, v["tags"])
    trad = 0.8 if tradition_props & set(v.get("props", [])) else 0.0
    return taste + town + trad + 1.2 * roll(seed, night, quill, beat, attempt, v["id"])


def draft_script(
    quill: str,
    *,
    seed: int,
    night: int,
    genre: str,
    town: str,
    cast: dict[str, str],
    traditions: list[str],
    attempt: int = 0,
) -> dict[str, Any]:
    g = world.genres()[genre]
    trad_props = {CALAMITY_PROP[c] for c in traditions if c in CALAMITY_PROP}
    beats: list[dict[str, Any]] = []
    for beat in BEATS:
        variants = g["beats"][beat]
        v = max(variants, key=lambda x: _variant_score(quill, x, town, trad_props, seed, night, beat, attempt))
        props = list(v.get("props", []))
        obj_id = pick(props, seed, night, quill, beat, "obj") if props else None
        beats.append(
            {
                "beat": beat,
                "variant": v["id"],
                "logline": v["logline"],
                "tags": list(v["tags"]),
                "lines": [dict(ln) for ln in v["lines"]],
                "props": props,
                "slots": {"object": world.props()[obj_id]["name"] if obj_id else "prop", "place": g["sets"][beat]},
            }
        )
    tags = sorted({t for b in beats for t in b["tags"]})
    title = flavour.make_title(
        genre,
        seed,
        night,
        quill,
        attempt,
        lead=world.nick(cast["lead"]),
        villain=world.nick(cast["villain"]),
        town=world.towns()[town]["name"].split("-")[0],
        obj=beats[1]["slots"]["object"],
        place=beats[0]["slots"]["place"],
    )
    return {
        "title": title,
        "tagline": flavour.make_tagline(quill, seed, night, attempt),
        "quill": quill,
        "genre": genre,
        "beats": beats,
        "tags": tags,
    }


def score_script(
    script: dict[str, Any], *, town: str, cast: dict[str, str], genre: str, traditions: list[str]
) -> float:
    """True quality of a draft, 0..1 (hidden from the player; Madame's 'faith' stars are a noisy view of it)."""
    per_beat = [clamp(0.5 + 0.22 * town_alignment(town, b["tags"]), 0, 1) for b in script["beats"]]
    town_fit = sum(per_beat) / len(per_beat)
    exposure = sum(flaw_exposure(world.performers()[a], genre) for a in cast.values()) / 3
    cast_fit = 1 - 0.5 * exposure
    variety = min(1.0, len(script["tags"]) / 12)
    trad_props = {CALAMITY_PROP[c] for c in traditions if c in CALAMITY_PROP}
    honoured = sum(1 for b in script["beats"] if trad_props & set(b["props"]))
    trad = min(1.0, honoured / 2) if trad_props else 0.5
    return round(0.5 * town_fit + 0.3 * cast_fit + 0.1 * variety + 0.1 * trad, 4)


def faith_stars(true_score: float, seed: int, night: int, quill: str, attempt: int = 0) -> int:
    """Madame's 0-3 'stars of faith': an honest-ish but noisy hint."""
    noisy = true_score + (roll(seed, night, quill, attempt, "faith") - 0.5) * 0.3
    return int(clamp(round((noisy - 0.35) / 0.4 * 3), 0, 3))
