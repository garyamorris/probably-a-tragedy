"""The nine graphs as the player meets them (shown in the Prompt Book and /api/boot)."""

from __future__ import annotations

from typing import Any

GRAPHS: list[dict[str, Any]] = [
    {"id": "casting_call", "title": "Casting Call", "blurb": "Auditions in parallel; Madame recommends; you confirm the cast.",
     "features": ["Send map-reduce", "reducers", "defer", "interrupt (edit/approve)"]},
    {"id": "writers_room", "title": "The Writers' Room", "blurb": "Three quills draft the play; a judge loops until it is good enough; you pick.",
     "features": ["Send x3", "evaluator loop", "conditional edges", "interrupt (pick)"]},
    {"id": "rehearsal", "title": "Dress Rehearsal", "blurb": "Twelve imaginary nights, in parallel, scored against the gold set.",
     "features": ["Send x12", "eval vs gold", "defer"]},
    {"id": "performance", "title": "The Show", "blurb": "Madame directs, puppets act, mishaps freeze the stage and you whisper.",
     "features": ["supervisor Command(goto)", "interrupt (Prompter)", "Send x12 audience", "retry + fallback", "checkpoints = time travel", "streaming"]},
    {"id": "reviews", "title": "The Pigeon Critics", "blurb": "Five pigeons, five opinions, one headline.",
     "features": ["Send x5", "custom reducer", "token streaming", "Store write"]},
    {"id": "almanac", "title": "The Almanac of Calamities", "blurb": "Every disaster is remembered; recurring ones become Traditions.",
     "features": ["Store + semantic search", "memory-write interrupt", "cross-thread memory"]},
    {"id": "playbill_press", "title": "The Playbill Press", "blurb": "Prints tonight's programme, remembering the tour so far.",
     "features": ["Functional API", "@entrypoint / @task", "previous"]},
    {"id": "the_road", "title": "The Road", "blurb": "The wagon trundles on; sometimes it breaks down and resumes.",
     "features": ["durable execution", "crash recovery", "interrupt (crossroads)"]},
    {"id": "greenroom_chat", "title": "The Greenroom", "blurb": "Chat with a puppet backstage; props need your approval.",
     "features": ["create_agent + middleware", "tool-call review", "messages streaming", "Store"]},
]
GRAPH_IDS = [g["id"] for g in GRAPHS]
