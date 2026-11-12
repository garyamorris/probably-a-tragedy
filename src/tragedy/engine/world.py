"""Typed-ish read access to the datasets (cached). All engine code goes through here, never through raw JSON."""

from __future__ import annotations

from functools import lru_cache
from typing import Any

from tragedy.data.loader import load

Row = dict[str, Any]


@lru_cache
def performers() -> dict[str, Row]:
    return {r["id"]: r for r in load("performers")}


@lru_cache
def staff() -> dict[str, Row]:
    return {r["id"]: r for r in load("staff")}


@lru_cache
def flaws() -> dict[str, Row]:
    return {r["id"]: r for r in load("flaws")}


@lru_cache
def mishaps_by_flaw() -> dict[str, list[Row]]:
    out: dict[str, list[Row]] = {}
    for r in load("mishaps"):
        out.setdefault(r["flaw"], []).append(r)
    return out


@lru_cache
def mishaps() -> dict[str, Row]:
    return {r["id"]: r for r in load("mishaps")}


@lru_cache
def whispers() -> dict[str, Row]:
    return {r["kind"]: r for r in load("whispers")}


@lru_cache
def cues() -> dict[str, Row]:
    return {r["id"]: r for r in load("cues")}


@lru_cache
def genres() -> dict[str, Row]:
    return {r["id"]: r for r in load("genres")}


@lru_cache
def towns() -> dict[str, Row]:
    return {r["id"]: r for r in load("towns")}


@lru_cache
def tastes() -> dict[str, Row]:
    return {r["id"]: r for r in load("tastes")}


@lru_cache
def critics() -> list[Row]:
    return list(load("critics"))


@lru_cache
def props() -> dict[str, Row]:
    return {r["id"]: r for r in load("props")}


@lru_cache
def road_events() -> list[Row]:
    return list(load("road_events"))


@lru_cache
def playbill_data() -> Row:
    return load("playbill")


def short_name(full: str) -> str:
    """'Sir Reginald Blort' -> 'Reginald'; 'Mabel Tuckett' -> 'Mabel'; 'Mr. Tock' -> 'Tock'."""
    parts = full.split()
    if len(parts) > 1 and parts[0].rstrip(".") in {
        "Sir",
        "Captain",
        "Mr",
        "Mrs",
        "Dame",
        "Madame",
        "Lord",
        "Lady",
        "Dr",
    }:
        return parts[1]
    return parts[0]


def full_name(pid: str) -> str:
    if pid in performers():
        return performers()[pid]["name"]
    if pid in staff():
        return staff()[pid]["name"]
    return pid


def nick(pid: str) -> str:
    return short_name(full_name(pid))


def calamity_title(slug: str) -> str:
    """'the_goose_incident' -> 'The Goose Incident'."""
    return " ".join(w.capitalize() for w in slug.split("_"))


def calamity_words(slug: str) -> str:
    return slug.removeprefix("the_").replace("_", " ")


def genre_tag_union(genre_id: str) -> set[str]:
    g = genres()[genre_id]
    return {t for variants in g["beats"].values() for v in variants for t in v["tags"]}
