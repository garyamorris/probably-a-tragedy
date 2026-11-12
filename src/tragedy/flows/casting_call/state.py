from __future__ import annotations

import operator
from typing import Annotated, Any, TypedDict


class CastInput(TypedDict, total=False):
    tour_id: str
    night: int
    seed: int
    genre: str
    town: str
    candidates: list[str]  # performer ids; default: all eight


class CastOutput(TypedDict, total=False):
    cast: dict[str, str]  # {"lead", "villain", "fool"}


class CastState(CastInput, CastOutput, total=False):
    candidate_ids: list[str]  # validated candidates, in audition order
    auditions: Annotated[list[dict[str, Any]], operator.add]  # filled by the `audition` Send workers
    scores: dict[str, dict[str, float]]  # {role: {actor: score}}
    proposed: dict[str, str]  # Madame's recommendation
    note: str  # Madame's voiced note
    attempts: int  # how many invalid confirmations we have already bounced


class AuditionInput(TypedDict):
    """What one `Send` carries to an `audition` worker."""

    actor: str
    role: str
    genre: str
    seed: int
    night: int
