"""Tour rules (pure functions over the tour-state dict). Persistence lives in `tragedy.tour_store`."""

from __future__ import annotations

import uuid
from copy import deepcopy
from typing import Any

from tragedy.common.rng import pick_n, stable_int
from tragedy.data.tags import SPECIAL_TOWN, STAR_TARGET, TOUR_NIGHTS
from tragedy.engine import world

NS = uuid.UUID("7c2f5a3e-0d4b-4f6e-9a77-5b1e0c0de001")


def new_tour(seed: int, tour_id: str | None = None) -> dict[str, Any]:
    pool = sorted(t for t in world.towns() if t != SPECIAL_TOWN)
    chosen = pick_n(pool, TOUR_NIGHTS - 1, seed, "tour-towns") + [SPECIAL_TOWN]
    tid = tour_id or f"tour-{stable_int(seed, 'tour-id') % 0xFFFFFF:06x}"
    return {
        "id": tid,
        "seed": seed,
        "night": 0,
        "towns": chosen,
        "funds": 8,
        "encore": 2,
        "candles": 2,
        "morale": 0,
        "props": [],  # real props bought in the greenroom (engine.show.PROP_BONUS warmth whenever a scene needs one)
        "rapport": {},
        "traditions": [],
        "calamity_counts": {},
        "history": [],
        "wagon": {"at": chosen[0]},
        "status": "active",
    }


def total_stars(tour: dict[str, Any]) -> float:
    return float(sum(h.get("stars", 0) for h in tour.get("history", [])))


def status(tour: dict[str, Any]) -> str:
    if len(tour.get("history", [])) < TOUR_NIGHTS:
        return "active"
    total = total_stars(tour)
    return "triumph" if total >= STAR_TARGET else "respectable" if total >= 11 else "tragedy"


def night_seed(tour: dict[str, Any], night: int | None = None) -> int:
    return stable_int(tour["seed"], "night", tour["night"] if night is None else night) % 2_147_483_647


def thread_id(tour_id: str, graph: str, night: int, attempt: int = 0) -> str:
    return str(uuid.uuid5(NS, f"{tour_id}/{graph}/{night}/{attempt}"))


def file_review(tour: dict[str, Any], entry: dict[str, Any]) -> dict[str, Any]:
    t = deepcopy(tour)
    t["history"] = [h for h in t["history"] if h.get("night") != entry["night"]] + [entry]
    t["funds"] = int(t["funds"]) + int(entry.get("funds_delta", 0))
    t["status"] = status(t)
    return t


def add_calamity_counts(tour: dict[str, Any], calamities: list[str]) -> dict[str, Any]:
    t = deepcopy(tour)
    counts = dict(t.get("calamity_counts", {}))
    for c in calamities:
        counts[c] = counts.get(c, 0) + 1
    t["calamity_counts"] = counts
    return t


def enshrine(tour: dict[str, Any], calamity: str) -> dict[str, Any]:
    t = deepcopy(tour)
    if any(x["calamity"] == calamity for x in t["traditions"]):
        return t
    t["traditions"].append(
        {
            "calamity": calamity,
            "title": world.calamity_title(calamity),
            "count": int(t["calamity_counts"].get(calamity, 2)),
        }
    )
    t["encore"] = int(t["encore"]) + 1
    return t


def spend(tour: dict[str, Any], what: str) -> dict[str, Any] | None:
    """Spend one 'encore' or 'candles'; returns the new tour or None when there is none left."""
    if int(tour.get(what, 0)) <= 0:
        return None
    t = deepcopy(tour)
    t[what] = int(t[what]) - 1
    return t


def apply_effects(tour: dict[str, Any], effects: dict[str, Any]) -> dict[str, Any]:
    t = deepcopy(tour)
    t["funds"] = max(0, int(t["funds"]) + int(effects.get("funds", 0)))
    t["encore"] = max(0, int(t["encore"]) + int(effects.get("encore", 0)))
    t["morale"] = max(-3, min(3, int(t.get("morale", 0)) + int(effects.get("morale", 0))))
    for actor, n in (effects.get("rapport") or {}).items():
        t["rapport"][actor] = int(t["rapport"].get(actor, 0)) + int(n)
    return t


def advance(tour: dict[str, Any], to_town: str) -> dict[str, Any]:
    t = deepcopy(tour)
    t["night"] = min(TOUR_NIGHTS, int(t["night"]) + 1)
    t["candles"] = 2
    t["wagon"] = {"at": to_town}
    return t


def own_prop(tour: dict[str, Any], prop_id: str) -> dict[str, Any]:
    t = deepcopy(tour)
    if prop_id not in t.setdefault("props", []):
        t["props"].append(prop_id)
    return t
