from __future__ import annotations

from langgraph.graph import END, START, StateGraph

from tragedy.flows.rehearsal import nodes as n
from tragedy.flows.rehearsal.state import RehearsalInput, RehearsalOutput, RehearsalState


def build(checkpointer=None, store=None):  # type: ignore[no-untyped-def]
    """Compile WITHOUT a checkpointer/store for the server (it injects its own); tests pass InMemorySaver/InMemoryStore."""
    g = StateGraph(RehearsalState, input_schema=RehearsalInput, output_schema=RehearsalOutput)
    g.add_node("plan", n.plan, destinations=("simulate",), metadata={"kind": "map"})
    g.add_node("simulate", n.simulate, metadata={"kind": "worker", "fan_out": "per imaginary night"})
    g.add_node("summarize", n.summarize, defer=True, metadata={"kind": "reduce"})
    g.add_edge(START, "plan")
    g.add_edge("simulate", "summarize")
    g.add_edge("summarize", END)
    return g.compile(checkpointer=checkpointer, store=store, name="rehearsal")
