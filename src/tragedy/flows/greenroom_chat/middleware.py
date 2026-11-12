"""Middleware of `greenroom_chat` (the rest of the stack is stock `langchain.agents.middleware`).

* :class:`PersonaMiddleware`      the system prompt for THIS puppet (from performers.json voice) + live facts from the Store
* :class:`PropReviewMiddleware`   `HumanInTheLoopMiddleware` for `fetch_prop`: the interrupt IS langchain's HITL payload
                                  (``{action_requests, review_configs}``), resumed with ``{"decisions": [{"type": "approve"|"edit"|"reject"}]}``.
                                  Unlike the stock class it never crashes on a malformed answer: garbage becomes a polite rejection.

Order (outermost first): persona, call limits, review. The review runs in ``after_model`` (before the tools node), so a rejected
prop never reaches the tool and the funds are never touched.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

from langchain.agents.middleware import (
    AgentMiddleware,
    HumanInTheLoopMiddleware,
    InterruptOnConfig,
    ModelRequest,
    ModelResponse,
)
from langchain.agents.middleware.human_in_the_loop import _EDITED_TOOL_CALLS_KEY, ActionRequest, ReviewConfig
from langchain_core.messages import AIMessage, SystemMessage, ToolCall, ToolMessage
from langgraph.types import interrupt

from tragedy.common.stream import emit
from tragedy.flows.greenroom_chat.context import ctx_get
from tragedy.flows.greenroom_chat.persona import DEFAULT_ACTOR, system_prompt
from tragedy.flows.greenroom_chat.tools import REVIEWED_TOOLS, funds_text, prop_price, prop_slug
from tragedy.tour_store import GraphStore, get_tour, ns_tour

UNCLEAR = "The answer was unclear, so Mrs. Gasket stayed put and nothing was fetched."


# ----------------------------------------------------------------------------------------------------- persona
class PersonaMiddleware(AgentMiddleware):
    """The system prompt is rebuilt on every model call from `runtime.context` (which puppet) and the tour in the Store (rapport, funds)."""

    @staticmethod
    def _apply(request: ModelRequest[Any], tour: dict[str, Any] | None) -> ModelRequest[Any]:
        actor = str(ctx_get(getattr(request.runtime, "context", None), "actor_id", DEFAULT_ACTOR))
        tour = tour or {}
        prompt = system_prompt(
            actor, rapport=int(tour.get("rapport", {}).get(actor, 0)) if tour else None,
            funds=int(tour["funds"]) if "funds" in tour else None, night=int(tour["night"]) if "night" in tour else None,
        )
        return request.override(system_message=SystemMessage(content=prompt))

    @staticmethod
    def _tour_id(request: ModelRequest[Any]) -> str:
        return str(ctx_get(getattr(request.runtime, "context", None), "tour_id", "tour-demo"))

    def wrap_model_call(self, request: ModelRequest[Any], handler: Callable[[ModelRequest[Any]], ModelResponse[Any]]) -> Any:
        store = getattr(request.runtime, "store", None)
        item = store.get(ns_tour(self._tour_id(request)), "state") if store is not None else None
        return handler(self._apply(request, dict(item.value) if item else None))

    async def awrap_model_call(
        self, request: ModelRequest[Any], handler: Callable[[ModelRequest[Any]], Awaitable[ModelResponse[Any]]]
    ) -> Any:
        tour = await get_tour(GraphStore(getattr(request.runtime, "store", None)), self._tour_id(request))
        return await handler(self._apply(request, tour))


# ------------------------------------------------------------------------------------------------ prop review
def _describe(tool_call: ToolCall, state: Any, runtime: Any) -> str:
    prop = prop_slug(tool_call["args"].get("prop", ""))
    return f"Mrs. Gasket will fetch: {prop}. It costs {funds_text(prop_price(prop))}. Approve, edit the prop, or reject?"


def clean_decision(raw: Any, tool_call: ToolCall) -> dict[str, Any]:
    """One reviewer answer -> a decision the stock middleware accepts. Anything unclear is a rejection (never a free purchase)."""
    if not isinstance(raw, dict):
        return {"type": "reject", "message": UNCLEAR}
    kind = raw.get("type")
    if kind == "approve":
        return {"type": "approve"}
    if kind == "reject":
        msg = raw.get("message")
        return {"type": "reject", "message": str(msg).strip()[:140]} if isinstance(msg, str) and msg.strip() else {"type": "reject"}
    if kind == "edit":
        edited = raw.get("edited_action")
        args = (edited.get("args") if isinstance(edited, dict) else None) or raw.get("args")
        prop = args.get("prop") if isinstance(args, dict) else None
        if isinstance(prop, str) and prop.strip():
            return {"type": "edit", "edited_action": {"name": tool_call["name"], "args": {"prop": prop_slug(prop)}}}
    return {"type": "reject", "message": UNCLEAR}


def clean_decisions(raw: Any, tool_calls: list[ToolCall]) -> list[dict[str, Any]]:
    """`{"decisions": [...]}` (or a bare list, or one bare decision) -> exactly one clean decision per reviewed call."""
    seq = raw.get("decisions") if isinstance(raw, dict) and "decisions" in raw else raw
    if isinstance(seq, dict):
        seq = [seq]
    seq = seq if isinstance(seq, list) else []
    return [clean_decision(seq[i] if i < len(seq) else None, tc) for i, tc in enumerate(tool_calls)]


class PropReviewMiddleware(HumanInTheLoopMiddleware):
    """Human-in-the-loop for `fetch_prop`, with the stock payload and a hardened `after_model`."""

    def __init__(self, tools: tuple[str, ...] = REVIEWED_TOOLS) -> None:
        cfg = InterruptOnConfig(allowed_decisions=["approve", "edit", "reject"], description=_describe)
        super().__init__(dict.fromkeys(tools, cfg), description_prefix="Mrs. Gasket needs sign-off")

    def after_model(self, state: Any, runtime: Any) -> dict[str, Any] | None:
        last_ai = next((m for m in reversed(state.get("messages") or []) if isinstance(m, AIMessage)), None)
        if last_ai is None or not last_ai.tool_calls:
            return None
        asked: list[int] = []
        requests: list[ActionRequest] = []
        configs: list[ReviewConfig] = []
        for i, tc in enumerate(last_ai.tool_calls):
            cfg = self.interrupt_on.get(tc["name"])
            if cfg is not None and self._should_interrupt(tc, cfg, state, runtime):
                req, rc = self._create_action_and_config(tc, cfg, state, runtime)
                requests.append(req)
                configs.append(rc)
                asked.append(i)
        if not requests:
            return {_EDITED_TOOL_CALLS_KEY: {}} if state.get(_EDITED_TOOL_CALLS_KEY) else None

        raw = interrupt({"action_requests": requests, "review_configs": configs})  # everything above this line is pure
        decisions = clean_decisions(raw, [last_ai.tool_calls[i] for i in asked])

        revised: list[ToolCall] = []
        answers: list[ToolMessage] = []
        edits: dict[str, Any] = {}
        n = 0
        for i, tc in enumerate(last_ai.tool_calls):
            if i not in asked:
                revised.append(tc)
                continue
            decision = decisions[n]
            n += 1
            call, message = self._process_decision(decision, tc, self.interrupt_on[tc["name"]])
            revised.append(call)  # type: ignore[arg-type]
            args = {**tc["args"], **(decision["edited_action"]["args"] if decision["type"] == "edit" else {})}
            if decision["type"] == "edit":
                edits[tc["id"]] = decision["edited_action"]
            if message is not None:
                answers.append(message)
            status = {"approve": "approved", "edit": "edited", "reject": "rejected"}[decision["type"]]
            emit(
                "greenroom.tool", f"gr:{tc['id']}:review", agent="fetch_prop", tool=tc["name"],
                args={"prop": prop_slug(args.get("prop", "")), "cost": prop_price(args.get("prop", ""))}, status=status,
            )
        last_ai.tool_calls = revised
        return {"messages": [last_ai, *answers], _EDITED_TOOL_CALLS_KEY: edits}

    async def aafter_model(self, state: Any, runtime: Any) -> dict[str, Any] | None:
        return self.after_model(state, runtime)
