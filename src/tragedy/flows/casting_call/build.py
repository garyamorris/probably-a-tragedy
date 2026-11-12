from __future__ import annotations

from langgraph.graph import END, START, StateGraph

from tragedy.flows.casting_call import nodes as n
from tragedy.flows.casting_call.state import CastInput, CastOutput, CastState


def build(checkpointer=None, store=None):  # type: ignore[no-untyped-def]
    """Compile WITHOUT a checkpointer/store for the server (it injects its own); tests pass InMemorySaver/InMemoryStore."""
    g = StateGraph(CastState, input_schema=CastInput, output_schema=CastOutput)
    g.add_node("load", n.load, destinations=("audition",), metadata={"kind": "map"})
    g.add_node("audition", n.audition, metadata={"kind": "worker", "fan_out": "candidate x role"})
    g.add_node("rank", n.rank, defer=True, metadata={"kind": "reduce"})
    g.add_node("recommend", n.recommend, metadata={"role": "supervisor: Madame"})
    g.add_node("confirm_cast", n.confirm_cast, destinations=("confirm_cast", "done"), metadata={"human": "the Prompter"})
    g.add_node("done", n.done)
    g.add_edge(START, "load")
    g.add_edge("audition", "rank")
    g.add_edge("rank", "recommend")
    g.add_edge("recommend", "confirm_cast")
    g.add_edge("done", END)
    return g.compile(checkpointer=checkpointer, store=store, name="casting_call")
