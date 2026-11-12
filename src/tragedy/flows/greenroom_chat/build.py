from __future__ import annotations

from typing import Any

from langchain.agents import create_agent
from langchain.agents.middleware import ModelCallLimitMiddleware, ToolCallLimitMiddleware

from tragedy.flows.greenroom_chat.context import GreenroomContext
from tragedy.flows.greenroom_chat.middleware import PersonaMiddleware, PropReviewMiddleware
from tragedy.flows.greenroom_chat.scripts import build_script
from tragedy.flows.greenroom_chat.tools import TOOLS
from tragedy.models.factory import get_chat_model


def build(checkpointer: Any = None, store: Any = None, *, model: Any = None):  # type: ignore[no-untyped-def]
    """ONE compiled agent for every puppet: the persona (system prompt, offline voice) comes from ``runtime.context.actor_id``.

    Compile WITHOUT a checkpointer/store for the server; tests pass InMemorySaver/InMemoryStore. Offline (default) the model is a
    scripted ``OfflineChatModel``; with a real key (``TRAGEDY_PROVIDER=anthropic|auto`` + ``ANTHROPIC_API_KEY``) it is Claude ('smart').
    """
    llm = model or get_chat_model("smart", script=build_script())
    return create_agent(
        llm,
        TOOLS,
        middleware=[
            PersonaMiddleware(),
            ModelCallLimitMiddleware(run_limit=6, exit_behavior="end"),
            ToolCallLimitMiddleware(run_limit=4),
            PropReviewMiddleware(),
        ],
        context_schema=GreenroomContext,
        checkpointer=checkpointer,
        store=store,
        name="greenroom_chat",
    )
