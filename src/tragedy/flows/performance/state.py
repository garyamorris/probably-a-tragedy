from __future__ import annotations

import operator
from typing import Annotated, Any, TypedDict


class ShowInput(TypedDict, total=False):
    tour_id: str
    night: int
    seed: int
    genre: str
    town: str
    cast: dict[str, str]
    script: dict[str, Any]
    scenario: str  # optional: "stage_fright" forces the understudy fallback on beat 3 (demo/test)


class ShowOutput(TypedDict, total=False):
    result: dict[str, Any]


class ShowState(ShowInput, ShowOutput, total=False):
    show: dict[str, Any]  # engine show state (plain JSON)
    seats: list[dict[str, Any]]
    ctx: dict[str, Any]  # current beat context
    qual: float
    per: dict[str, float]
    mishaps: list[dict[str, Any]]
    results: list[dict[str, Any] | None]  # aligned with `mishaps`
    pending: list[int]  # indices of major mishaps still awaiting the Prompter
    reactions: Annotated[list[dict[str, Any]], operator.add]  # filled by the `react` Send workers (tagged with `beat`)


class ReactInput(TypedDict):
    seat: dict[str, Any]
    tags: list[str]
    mishap_tags: list[str]
    chain: bool
    beat: int
    seed: int
    night: int
