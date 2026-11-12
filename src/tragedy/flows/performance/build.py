from __future__ import annotations

from langgraph.graph import END, START, StateGraph
from langgraph.types import RetryPolicy

from tragedy.flows.performance import nodes as n
from tragedy.flows.performance.state import ShowInput, ShowOutput, ShowState


def build(checkpointer=None, store=None):  # type: ignore[no-untyped-def]
    """Compile WITHOUT a checkpointer/store for the server (it injects its own); tests pass InMemorySaver/InMemoryStore."""
    g = StateGraph(ShowState, input_schema=ShowInput, output_schema=ShowOutput)
    g.add_node("defaults", n.studio_defaults, metadata={"role": "fills in what a Studio form leaves blank"})
    g.add_node("curtain_up", n.curtain_up)
    g.add_node("direct", n.direct, destinations=("perform",), metadata={"role": "supervisor: Madame"})
    g.add_node(
        "perform", n.perform, destinations=("prompters_box", "resolve"),
        retry_policy=RetryPolicy(max_attempts=2, initial_interval=0.0, jitter=False, retry_on=n.StageFright),
        error_handler=n.understudy,
    )
    g.add_node("prompters_box", n.prompters_box, destinations=("prompters_box", "resolve"), metadata={"human": "the Prompter"})
    g.add_node("resolve", n.resolve, destinations=("react",))
    g.add_node("react", n.react)
    g.add_node("tally", n.tally, defer=True, destinations=("direct", "curtain_call"))
    g.add_node("curtain_call", n.curtain_call)
    g.add_edge(START, "defaults")
    g.add_edge("defaults", "curtain_up")
    g.add_edge("curtain_up", "direct")
    g.add_edge("react", "tally")
    g.add_edge("curtain_call", END)
    return g.compile(checkpointer=checkpointer, store=store)
