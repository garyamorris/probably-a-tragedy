"""The `quill` subgraph: one heron playwright drafts a script, checks it, and redrafts once if it is hopeless.

    START -> draft -> self_check -- true score < 0.3 and not yet redrafted --> draft
                               `-- otherwise --> present -> END   (emits `script.draft`, returns {"drafts": [one draft]})

It is mounted in the parent as the node `quill` and fed by `Send`, so three copies run in parallel.
In Studio / `get_graph(xray=True)` its inner nodes show as `quill:draft`, `quill:self_check`, `quill:present`.
"""

from __future__ import annotations

from typing import Any, Literal

from langchain_core.runnables import RunnableConfig
from langgraph.graph import END, START, StateGraph

from tragedy.common.stream import emit
from tragedy.engine import script as scr
from tragedy.engine import world
from tragedy.flows.writers_room.state import QuillInput, QuillOutput, QuillState
from tragedy.models.factory import voice

REDRAFT_BELOW = 0.3  # a quill whose own draft scores under this tears it up once


def engine_attempt(round_: int, redo: int) -> int:
    """The engine's `attempt` label. Two per round so a revise round never replays a quill's own redraft."""
    return 2 * round_ + redo


def draft_id(quill: str, round_: int) -> str:
    return f"{quill}-{round_}"


def persona(quill: str) -> str:
    s = world.staff().get(quill, {})
    name = s.get("name", "Bartholomew Quill")
    tone = s.get("voice", {}).get("tone", "a playwright heron")
    return f"{name}, a heron playwright, in a mood best described as: {tone}"


def public_beats(script: dict[str, Any]) -> list[dict[str, Any]]:
    return [{"beat": b["beat"], "logline": b["logline"], "tags": list(b["tags"])} for b in script["beats"]]


async def draft(state: QuillState, config: RunnableConfig) -> dict[str, Any]:
    attempt = engine_attempt(state["round"], state.get("redo", 0))
    script = scr.draft_script(
        state["quill"], seed=state["seed"], night=state["night"], genre=state["genre"], town=state["town"],
        cast=state["cast"], traditions=state["traditions"], attempt=attempt,
    )
    tagline = await voice(persona(state["quill"]), script["tagline"], actor=state["quill"], config=config)
    script["tagline"] = " ".join(tagline.split())[:160] or script["tagline"]
    return {"script": script}


async def self_check(state: QuillState) -> dict[str, Any]:
    redo = state.get("redo", 0)
    attempt = engine_attempt(state["round"], redo)
    score = scr.score_script(
        state["script"], town=state["town"], cast=state["cast"], genre=state["genre"], traditions=state["traditions"]
    )
    confidence = scr.faith_stars(score, state["seed"], state["night"], state["quill"], attempt)
    accepted = score >= REDRAFT_BELOW or redo >= 1
    # the true score is used here and then dropped: only Madame's noisy `confidence` is kept in state
    return {"confidence": confidence, "accepted": accepted, "redo": redo if accepted else redo + 1}


def _after_check(state: QuillState) -> Literal["present", "draft"]:
    return "present" if state.get("accepted") else "draft"


async def present(state: QuillState) -> dict[str, Any]:
    script = state["script"]
    did = draft_id(state["quill"], state["round"])
    emit(
        "script.draft", f"{state['night']}:draft:{did}", agent=state["quill"], draft_id=did, quill=state["quill"],
        title=script["title"], tagline=script["tagline"], beats=public_beats(script), confidence=state["confidence"],
    )
    return {
        "drafts": [
            {
                "draft_id": did, "quill": state["quill"], "title": script["title"], "tagline": script["tagline"],
                "script": script, "confidence": state["confidence"], "round": state["round"],
            }
        ]
    }


def build_quill():  # type: ignore[no-untyped-def]
    g = StateGraph(QuillState, input_schema=QuillInput, output_schema=QuillOutput)
    g.add_node("draft", draft, metadata={"role": "quill"})
    g.add_node("self_check", self_check, metadata={"kind": "evaluate"})
    g.add_node("present", present)
    g.add_edge(START, "draft")
    g.add_edge("draft", "self_check")
    g.add_conditional_edges("self_check", _after_check, {"present": "present", "draft": "draft"})
    g.add_edge("present", END)
    return g.compile(name="quill")
