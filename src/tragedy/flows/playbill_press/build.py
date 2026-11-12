from __future__ import annotations

from typing import Any

from langgraph.func import entrypoint
from langgraph.pregel import Pregel

from tragedy.flows.playbill_press.workflow import playbill_press


def build(checkpointer: Any = None, store: Any = None) -> Pregel:
    """The workflow as a Pregel graph. Compile WITHOUT a checkpointer/store for the server (it injects its own;
    a module-level graph carrying its own checkpointer crashes `langgraph dev`); tests pass InMemorySaver/InMemoryStore.

    `previous` only works on a checkpointed thread, and the thread is per tour (`playbill-<tour>`): the SPA asks the server for it."""
    graph = entrypoint(checkpointer=checkpointer, store=store)(playbill_press)
    graph.name = "playbill_press"
    return graph
