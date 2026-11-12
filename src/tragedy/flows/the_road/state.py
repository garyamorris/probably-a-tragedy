from __future__ import annotations

from typing import Any, TypedDict


class RoadInput(TypedDict, total=False):
    tour_id: str
    night: int
    seed: int
    from_town: str
    to_town: str
    crash: bool  # the crash demo: `apply` raises once (see nodes.apply)


class RoadOutput(TypedDict, total=False):
    event: dict[str, Any]  # {id, title, text}
    choice: str | None  # the crossroads choice id
    effects: dict[str, Any]  # what the choice did: {funds, morale, rapport, encore}
    arrived: str  # the town id the wagon rolled into


class RoadState(RoadInput, RoadOutput, total=False):
    forecast: dict[str, str]  # {kind, line}; NOT named like the node `weather` (LangGraph forbids it)
    choices: list[dict[str, Any]]  # the event's choices (with effects; the client only ever sees id + label)
