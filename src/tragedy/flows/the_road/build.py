from __future__ import annotations

from langgraph.graph import END, START, StateGraph

from tragedy.flows.the_road import nodes as n
from tragedy.flows.the_road.state import RoadInput, RoadOutput, RoadState


def build(checkpointer=None, store=None):  # type: ignore[no-untyped-def]
    """Compile WITHOUT a checkpointer/store for the server (it injects its own); tests pass InMemorySaver/InMemoryStore.

    Run it with ``durability="sync"`` (the client passes it per run; there is no compile-time switch): every superstep is checkpointed
    before the next begins, which is what makes the crash demo resumable from exactly the failed node.
    """
    g = StateGraph(RoadState, input_schema=RoadInput, output_schema=RoadOutput)
    g.add_node("defaults", n.studio_defaults, metadata={"role": "fills in what a Studio form leaves blank"})
    g.add_node("depart", n.depart)
    g.add_node("weather", n.weather)
    g.add_node("roll_event", n.roll_event)
    g.add_node("crossroads", n.crossroads, metadata={"human": "the Prompter"})
    g.add_node("apply", n.apply, metadata={"durability": "sync", "may_crash": True})
    g.add_node("arrive", n.arrive)
    g.add_edge(START, "defaults")
    g.add_edge("defaults", "depart")
    g.add_edge("depart", "weather")
    g.add_edge("weather", "roll_event")
    g.add_conditional_edges("roll_event", n.route_after_roll, {"crossroads": "crossroads", "apply": "apply"})
    g.add_edge("crossroads", "apply")
    g.add_edge("apply", "arrive")
    g.add_edge("arrive", END)
    return g.compile(checkpointer=checkpointer, store=store, name="the_road")
