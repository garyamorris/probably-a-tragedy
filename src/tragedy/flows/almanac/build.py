from __future__ import annotations

from langgraph.graph import END, START, StateGraph

from tragedy.flows.almanac import nodes as n
from tragedy.flows.almanac.state import AlmanacInput, AlmanacOutput, AlmanacState


def build(checkpointer=None, store=None):  # type: ignore[no-untyped-def]
    """Compile WITHOUT a checkpointer/store for the server (it injects its own); tests pass InMemorySaver/InMemoryStore."""
    g = StateGraph(AlmanacState, input_schema=AlmanacInput, output_schema=AlmanacOutput)
    g.add_node("defaults", n.studio_defaults, metadata={"role": "fills in what a Studio form leaves blank"})
    g.add_node("ingest", n.ingest, metadata={"store": "write"})
    g.add_node("detect", n.detect)
    g.add_node("curate", n.curate, metadata={"human": "the Prompter"})
    g.add_node("enshrine", n.enshrine, metadata={"store": "write"})
    g.add_node("recall", n.recall_node, metadata={"store": "semantic search"})
    g.add_edge(START, "defaults")
    g.add_edge("defaults", "ingest")
    g.add_edge("ingest", "detect")
    g.add_conditional_edges("detect", n.route_after_detect, {"curate": "curate", "recall": "recall"})
    g.add_edge("curate", "enshrine")
    g.add_edge("enshrine", "recall")
    g.add_edge("recall", END)
    return g.compile(checkpointer=checkpointer, store=store, name="almanac")
