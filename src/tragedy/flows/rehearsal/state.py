from __future__ import annotations

from typing import Annotated, Any, TypedDict


def merge_sims(left: list[dict[str, Any]] | None, right: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    """Reducer: simulated nights merged by their index `i`, always sorted by `i` (completion order is irrelevant)."""
    by_i = {s["i"]: s for s in (left or [])}
    by_i.update({s["i"]: s for s in (right or [])})
    return [by_i[i] for i in sorted(by_i)]


class RehearsalInput(TypedDict, total=False):
    tour_id: str
    night: int
    seed: int
    genre: str
    town: str
    cast: dict[str, str]
    script: dict[str, Any]  # optional: drafted by quill_tender when missing
    samples: int  # default 12, clamped to 1..24


class RehearsalOutput(TypedDict, total=False):
    summary: dict[str, Any]  # {histogram, mean, risk, verdict}


class RehearsalState(RehearsalInput, RehearsalOutput, total=False):
    n_samples: int  # the clamped sample count
    sims: Annotated[list[dict[str, Any]], merge_sims]  # filled by the `simulate` Send workers


class SimulateInput(TypedDict):
    """What one `Send` carries to a `simulate` worker."""

    i: int
    seed: int
    night: int
    genre: str
    town: str
    cast: dict[str, str]
    script: dict[str, Any]
