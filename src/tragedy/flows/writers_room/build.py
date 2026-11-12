from __future__ import annotations

from langgraph.graph import END, START, StateGraph

from tragedy.flows.writers_room import nodes as n
from tragedy.flows.writers_room.quill import build_quill
from tragedy.flows.writers_room.state import WritersInput, WritersOutput, WritersState


def build(checkpointer=None, store=None):  # type: ignore[no-untyped-def]
    """Compile WITHOUT a checkpointer/store for the server (it injects its own); tests pass InMemorySaver/InMemoryStore."""
    g = StateGraph(WritersState, input_schema=WritersInput, output_schema=WritersOutput)
    g.add_node("brief", n.brief, metadata={"role": "supervisor: Madame"})
    g.add_node("quill", build_quill(), metadata={"kind": "subgraph", "fan_out": "x3 herons"})  # compiled subgraph as a node
    g.add_node("judge", n.judge, defer=True, metadata={"kind": "reduce"})
    g.add_node("revise", n.revise, metadata={"kind": "loop"})
    g.add_node("pick_draft", n.pick_draft, metadata={"human": "the Prompter"})
    g.add_node("finalize", n.finalize)
    g.add_edge(START, "brief")
    g.add_conditional_edges("brief", n.fan_out, ["quill"])
    g.add_edge("quill", "judge")
    g.add_conditional_edges("judge", n.route_after_judge, {"revise": "revise", "pick_draft": "pick_draft"})
    g.add_conditional_edges("revise", n.fan_out, ["quill"])
    g.add_edge("pick_draft", "finalize")
    g.add_edge("finalize", END)
    return g.compile(checkpointer=checkpointer, store=store, name="writers_room")
