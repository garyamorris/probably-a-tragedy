from __future__ import annotations

from typing import Any, TypedDict


class AlmanacInput(TypedDict, total=False):
    tour_id: str
    night: int
    seed: int
    genre: str
    town: str
    result: dict[str, Any]  # the `performance` graph's result
    next_town: str | None


class AlmanacOutput(TypedDict, total=False):
    traditions: list[dict[str, Any]]  # the tour's FULL list of Traditions after tonight
    recalled: list[dict[str, Any]]  # what the Store remembers about the next town


class AlmanacState(AlmanacInput, AlmanacOutput, total=False):
    noted: list[dict[str, Any]]  # [{calamity, count, text, key}] written tonight
    candidates: list[dict[str, Any]]  # [{calamity, title, count, text}] (count >= 2 and not yet a Tradition)
    chosen: list[str]  # the Prompter's (validated) choice; NOT named like a node (LangGraph forbids it)
