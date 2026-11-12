from __future__ import annotations

from collections.abc import Callable
from typing import Any

from langgraph.types import Command

from tragedy.common.stream import capture
from tragedy.engine import casting, world
from tragedy.engine import script as scr

Chooser = Callable[[dict[str, Any]], Any]


def default_cast(genre: str = "farce", seed: int = 7, night: int = 0) -> dict[str, str]:
    return casting.recommend(casting.score_table(genre, seed, night))


def make_script(genre: str, town: str, cast: dict[str, str], seed: int = 7, night: int = 0, quill: str = "quill_tender") -> dict[str, Any]:
    return scr.draft_script(quill, seed=seed, night=night, genre=genre, town=town, cast=cast, traditions=[])


def first_town() -> str:
    return sorted(world.towns())[0]


async def drive(graph: Any, input_: Any, config: dict[str, Any], chooser: Chooser, max_steps: int = 40) -> tuple[dict[str, Any], list[dict[str, Any]], list[dict[str, Any]]]:
    """Run to completion, answering every interrupt with `chooser(payload)`. Returns (final state, events, interrupt payloads)."""
    events: list[dict[str, Any]] = []
    asked: list[dict[str, Any]] = []
    # After the first call, always address the thread's HEAD: a fork from a past checkpoint creates a new branch,
    # and `config` (pinned to the old checkpoint_id) would keep pointing at the old branch.
    head = {"configurable": {"thread_id": config["configurable"]["thread_id"]}}
    with capture() as buf:
        cur: Any = input_
        first = True
        for _ in range(max_steps):
            await graph.ainvoke(cur, config if first else head)
            first = False
            snap = await graph.aget_state(head)
            if not snap.interrupts:
                break
            resume = {}
            for it in snap.interrupts:
                asked.append(it.value)
                resume[it.id] = chooser(it.value)
            cur = Command(resume=resume)
        events = list(buf)
    snap = await graph.aget_state(head)
    return snap.values, events, asked
