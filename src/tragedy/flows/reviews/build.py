from __future__ import annotations

from langgraph.graph import END, START, StateGraph

from tragedy.flows.reviews import nodes as n
from tragedy.flows.reviews.state import ReviewsInput, ReviewsOutput, ReviewsState


def build(checkpointer=None, store=None):  # type: ignore[no-untyped-def]
    """Compile WITHOUT a checkpointer/store for the server (it injects its own); tests pass InMemorySaver/InMemoryStore."""
    g = StateGraph(ReviewsState, input_schema=ReviewsInput, output_schema=ReviewsOutput)
    g.add_node("gather", n.gather, destinations=("critics",), metadata={"kind": "map"})
    g.add_node("critics", n.critics, metadata={"kind": "worker", "fan_out": "one per pigeon"})
    g.add_node("reduce", n.reduce, defer=True, metadata={"kind": "reduce"})
    g.add_node("headline", n.headline, metadata={"llm": True, "streams": "tokens"})
    g.add_node("file_review", n.file_review, metadata={"store": "write"})
    g.add_edge(START, "gather")
    g.add_edge("critics", "reduce")
    g.add_edge("reduce", "headline")
    g.add_edge("headline", "file_review")
    g.add_edge("file_review", END)
    return g.compile(checkpointer=checkpointer, store=store, name="reviews")
