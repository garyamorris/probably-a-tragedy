"""The puppet's three tools. All three read `runtime.context` ({tour_id, actor_id}) and the Store through `GraphStore`.

* ``calm_nerves``   the Prompter soothes the puppet: +1 rapport (cap 5) written into the tour state in the Store
* ``fetch_prop``    Mrs. Gasket fetches a prop for 1-3 funds; reviewed by a human BEFORE it runs (``PropReviewMiddleware``)
* ``recall_gossip`` semantic search of the Almanac (legends + this tour's calamities)

Tool bodies run only after approval, so the funds are deducted exactly once; a rejected call never reaches this code.
"""

from __future__ import annotations

import re
from typing import Any

from langchain.tools import ToolRuntime, tool

from tragedy.common.rng import stable_int
from tragedy.common.stream import emit
from tragedy.engine import tour as tour_rules
from tragedy.engine import world
from tragedy.flows.greenroom_chat.context import GreenroomContext, ctx_get
from tragedy.flows.greenroom_chat.persona import DEFAULT_ACTOR
from tragedy.tour_store import GraphStore, get_tour, put_tour, recall

RAPPORT_MAX = 5
REVIEWED_TOOLS = ("fetch_prop",)


def prop_slug(prop: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(prop).lower()).strip()[:40] or "a spare candle"


def prop_id_for(prop: str) -> str | None:
    """Map free text ('the chandelier', 'umbrella stand') onto a real prop id from the props dataset, or None."""
    slug = prop_slug(prop).replace(" ", "_")
    ids = set(world.props())
    if slug in ids:
        return slug
    words = [w for w in prop_slug(prop).split() if w not in {"a", "an", "the", "some", "real"}]
    for cand in ("_".join(words), *words):
        if cand in ids:
            return cand
    return None


def prop_price(prop: str) -> int:
    """1-3 funds, by prop: a pure function of the (normalised) prop name, so approval, execution and the UI always agree."""
    return 1 + stable_int("prop-price", prop_slug(prop)) % 3


def funds_text(n: int) -> str:
    return f"{n} fund" if n == 1 else f"{n} funds"


def _ids(runtime: ToolRuntime[GreenroomContext]) -> tuple[str, str]:
    ctx = getattr(runtime, "context", None)
    return str(ctx_get(ctx, "tour_id", "tour-demo")), str(ctx_get(ctx, "actor_id", DEFAULT_ACTOR))


def _call_id(runtime: ToolRuntime[GreenroomContext]) -> str:
    return str(getattr(runtime, "tool_call_id", None) or "call")


async def _tour(runtime: ToolRuntime[GreenroomContext], tour_id: str) -> tuple[GraphStore, dict[str, Any] | None]:
    st = GraphStore(runtime.store)
    return st, await get_tour(st, tour_id)


def towns_in(text: str) -> set[str]:
    """Town ids named in a free-text query ('gossip about Marshwick' -> {'marshwick'})."""
    low = text.lower()
    return {tid for tid, t in world.towns().items() if tid.replace("_", " ") in low or t["name"].split("-")[0].lower() in low}


def rank_gossip(hits: list[dict[str, Any]], query: str, limit: int = 3) -> list[dict[str, Any]]:
    """Keep real matches (score > 0); the legends of a town the Prompter NAMED come first (a hashed bag-of-words embedder is lexical, so a
    named town is the strongest signal there is), then by score."""
    named = towns_in(query)
    good = [h for h in hits if (h["score"] or 0) > 0]
    return sorted(good, key=lambda h: (h["town"] not in named, -(h["score"] or 0)))[:limit]


@tool
async def calm_nerves(runtime: ToolRuntime[GreenroomContext]) -> str:
    """Soothe the puppet's pre-show nerves. The Prompter talks them down; their rapport with the Prompter rises by 1 (max 5),
    which makes them likelier to join the Prompter's "Yes, and..." in the next show. Use when the Prompter says the puppet seems nervous, worried or scared."""
    tour_id, actor = _ids(runtime)
    cid = _call_id(runtime)
    st, tour = await _tour(runtime, tour_id)
    name = world.nick(actor)
    if tour is None:
        emit("greenroom.tool", f"gr:{cid}:tool", agent="calm_nerves", tool="calm_nerves", args={}, status="failed")
        return f"There is no tour {tour_id} on the Stage Manager's clipboard. {name} stays as nervous as before."
    before = int(tour.get("rapport", {}).get(actor, 0))
    after = min(RAPPORT_MAX, before + 1)
    tour = {**tour, "rapport": {**tour.get("rapport", {}), actor: after}}
    await put_tour(st, tour)
    emit("greenroom.rapport", f"gr:{cid}:rapport", agent=actor, actor=actor, rapport=after)
    emit("greenroom.tool", f"gr:{cid}:tool", agent="calm_nerves", tool="calm_nerves", args={}, status="done")
    if after == before:
        return f"{name} is already as calm as a puppet gets. Rapport with {name} stays at {after}/{RAPPORT_MAX}."
    return f"{name} breathes out. Rapport with {name} is now {after}/{RAPPORT_MAX}."


@tool
async def fetch_prop(prop: str, runtime: ToolRuntime[GreenroomContext]) -> str:
    """Send Mrs. Gasket (eight hands, always the wrong prop) to fetch a prop for the puppet. Costs 1-3 funds depending on the prop,
    taken from the troupe's funds. A human reviews and approves the call BEFORE it runs. `prop` is a short name, e.g. "chandelier"."""
    tour_id, _actor = _ids(runtime)
    cid = _call_id(runtime)
    st, tour = await _tour(runtime, tour_id)
    prop = prop_slug(prop)
    cost = prop_price(prop)
    args = {"prop": prop, "cost": cost}
    if tour is None:
        emit("greenroom.tool", f"gr:{cid}:tool", agent="fetch_prop", tool="fetch_prop", args=args, status="failed")
        return f"There is no tour {tour_id} on the Stage Manager's clipboard, so there is no purse to pay Mrs. Gasket from."
    funds = int(tour.get("funds", 0))
    if funds < cost:
        emit("greenroom.tool", f"gr:{cid}:tool", agent="fetch_prop", tool="fetch_prop", args=args, status="failed")
        return f"The purse holds {funds_text(funds)} and the {prop} costs {cost}. Mrs. Gasket returns empty-handed (one hand holds a spoon)."
    prop_id = prop_id_for(prop)
    if prop_id and prop_id in tour.get("props", []):
        emit("greenroom.tool", f"gr:{cid}:tool", agent="fetch_prop", tool="fetch_prop", args={**args, "owned": True}, status="done")
        return f"Mrs. Gasket already owns the {prop}. She looks guilty and puts it behind her back (no charge)."
    tour = tour_rules.apply_effects(tour, {"funds": -cost})
    if prop_id:
        tour = tour_rules.own_prop(tour, prop_id)
    await put_tour(st, tour)
    emit("greenroom.tool", f"gr:{cid}:tool", agent="fetch_prop", tool="fetch_prop", args={**args, "real": bool(prop_id)}, status="done")
    boon = f" It is the real thing now: scenes that need a {world.props()[prop_id]['name'].lower()} will warm the house." if prop_id else " It is not a prop the plays ask for, but it is lovely."
    return f"Mrs. Gasket returns with {prop}, and also a spoon. It cost {funds_text(cost)}; {tour['funds']} left in the purse.{boon}"


@tool
async def recall_gossip(query: str, runtime: ToolRuntime[GreenroomContext]) -> str:
    """Recall what the Almanac remembers (town legends and calamities from this tour) about `query`: a town, a prop, a gag, a rumour."""
    tour_id, _actor = _ids(runtime)
    cid = _call_id(runtime)
    hits = rank_gossip(await recall(GraphStore(runtime.store), tour_id, str(query), limit=8), str(query))
    for i, h in enumerate(hits):
        emit("memory.recalled", f"gr:{cid}:recalled:{i}", agent="recall_gossip", **h)
    emit("greenroom.tool", f"gr:{cid}:tool", agent="recall_gossip", tool="recall_gossip", args={"query": str(query)}, status="done")
    if not hits:
        return "Nobody in the Almanac remembers anything about that, darling."
    return "The Almanac remembers:\n" + "\n".join(f"- {h['text']}" for h in hits)


TOOLS = [calm_nerves, fetch_prop, recall_gossip]
