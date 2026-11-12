from __future__ import annotations

import operator
from typing import Annotated, Any, TypedDict


class WritersInput(TypedDict, total=False):
    tour_id: str
    night: int
    seed: int
    genre: str
    town: str
    cast: dict[str, str]
    traditions: list[str]  # calamity slugs the town expects to see honoured (tour-state dicts are accepted too)


class WritersOutput(TypedDict, total=False):
    script: dict[str, Any]  # PROTOCOL section 1 `script`


class WritersState(WritersInput, WritersOutput, total=False):
    round: int  # 0 = first drafting round; the revise loop bumps it
    revisions: int  # how many times Madame sent the quills back
    # every round's drafts (each carries its `round`). The TRUE score is deliberately in no state, event or payload:
    # `values` streams the whole state (and subgraph states) to the client, so it is recomputed on demand by the engine.
    drafts: Annotated[list[dict[str, Any]], operator.add]
    shortlist: list[dict[str, Any]]  # the latest round's drafts as the player sees them
    chosen_id: str


class QuillInput(TypedDict):
    """What one `Send` carries into the `quill` subgraph."""

    quill: str
    seed: int
    night: int
    genre: str
    town: str
    cast: dict[str, str]
    traditions: list[str]
    round: int


class QuillState(QuillInput, total=False):
    redo: int  # 0 on the first draft, 1 after the quill's own redraft
    script: dict[str, Any]
    confidence: int
    accepted: bool


class QuillOutput(TypedDict):
    drafts: list[dict[str, Any]]
