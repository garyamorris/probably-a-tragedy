"""Nodes of the `almanac` graph. The engine decides (counts, candidates, +1 Encore); the Store remembers; nodes emit and route.

Interrupt discipline: `curate` is the only node with an `interrupt()`; everything above it is pure, and its events are
emitted AFTER it. `ingest` is replay-safe (see its docstring): a retried or re-run night cannot inflate a calamity's count.
"""

from __future__ import annotations

from typing import Any

from langgraph.runtime import Runtime
from langgraph.types import interrupt

from tragedy.common.stream import emit
from tragedy.engine import tour as tour_rules
from tragedy.engine import world
from tragedy.flows.almanac.state import AlmanacState
from tragedy.tour_store import GraphStore, get_tour, put_tour, recall, remember_calamity

MAX_TRADITIONS = 2
THRESHOLD = 2  # a calamity seen this many times becomes a candidate Tradition
RECALL_LIMIT = 3


def _k(night: int, *parts: Any) -> str:
    return ":".join(str(p) for p in ("almanac", night, *parts))


async def _tour(st: GraphStore, state: AlmanacState) -> dict[str, Any]:
    """The tour from the Store; a missing one (a graph run on its own, e.g. in Studio) gets a fresh tour so nothing crashes."""
    tour_id = state["tour_id"]
    return await get_tour(st, tour_id) or tour_rules.new_tour(int(state.get("seed", 0)), tour_id)


def _mem_key(calamity: str, night: int, beat: Any) -> str:
    return f"{calamity}:{night}:{beat}"  # mirrors tragedy.tour_store.remember_calamity


def _town_name(town_id: str | None) -> str:
    town = world.towns().get(town_id or "")
    return town["name"] if town else str(town_id or "somewhere").replace("_", " ").title()


def _legend(town_name: str, mishap: dict[str, Any], genre: str) -> str:
    """The searchable sentence stored in the Almanac, e.g. 'In Marshwick-on-Mire, Mabel leans too far left (lean) during a farce.'"""
    words = world.calamity_words(mishap["calamity"])
    title = mishap.get("title") or world.calamity_title(mishap["calamity"])
    return f"In {town_name}, {title} ({words}) during a {genre.replace('_', ' ')}."


# ----------------------------------------------------------------------------------------------------- ingest
async def studio_defaults(state: AlmanacState, runtime: Runtime[Any]) -> dict[str, Any]:
    """Complete a partial input (LangGraph Studio's form): fills only what is blank, never overrides; a no-op for the game."""
    from tragedy.flows.defaults import complete

    out = await complete(dict(state), runtime.store, result=True, next_town=True)
    filled = out.pop("_filled")
    if filled:
        emit("note", f"defaults:{out['night']}", agent="defaults", text="Filled in what was left blank: " + ", ".join(filled) + ".")
    return out



async def ingest(state: AlmanacState, runtime: Runtime[Any]) -> dict[str, Any]:
    """Every mishap of the show becomes a memory (Store write, semantic index) and bumps the tour's calamity counts.

    Replay-safe: the tour keeps `calamity_log` {night: [calamity, ...]}. Ingesting a night that was ingested before (a retried run,
    or the night replayed after "Take it from the top") first takes that night's old contribution back, so counts never inflate;
    a NEW tour that reuses a tour id (same seed) has no log and counts from zero even if old Almanac entries are still in the Store.
    """
    st = GraphStore(runtime.store)
    night, tour_id = int(state["night"]), state["tour_id"]
    genre = state.get("genre") or "play"
    mishaps = [m for m in (state.get("result") or {}).get("mishaps", []) if m.get("calamity")]
    cals = [m["calamity"] for m in mishaps]
    tour = await _tour(st, state)
    log = dict(tour.get("calamity_log", {}))
    counts = dict(tour.get("calamity_counts", {}))
    for old in log.get(str(night), []):
        counts[old] = counts.get(old, 0) - 1
    running = {c: n for c, n in counts.items() if n > 0}
    tour = {**tour, "calamity_counts": dict(running)}

    noted: list[dict[str, Any]] = []
    seen: set[str] = set()
    for i, m in enumerate(mishaps):
        cal = m["calamity"]
        beat = m.get("beat", 0)
        if _mem_key(cal, night, beat) in seen:  # two mishaps of one calamity in one beat must not overwrite each other
            beat = f"{beat}-{i}"
        seen.add(_mem_key(cal, night, beat))
        text = _legend(_town_name(state.get("town")), m, genre)
        key = await remember_calamity(
            st, tour_id, night,
            {"text": text, "calamity": cal, "town": state.get("town"), "genre": genre, "beat": beat, "title": m.get("title")},
        )
        running[cal] = running.get(cal, 0) + 1
        noted.append({"calamity": cal, "count": running[cal], "text": text, "key": key})

    tour = tour_rules.add_calamity_counts(tour, cals)
    tour["calamity_log"] = {**log, str(night): cals}
    await put_tour(st, tour)
    for i, n in enumerate(noted):
        emit("almanac.noted", _k(night, "noted", i), agent="almanac", calamity=n["calamity"], count=n["count"], text=n["text"])
        emit("memory.written", _k(night, "written", i), agent="almanac", ns=f"almanac/{tour_id}", key=n["key"])
    emit("progress", _k(night, "progress", "ingest"), agent="almanac", label="The Almanac notes tonight's calamities", pct=25)
    return {"noted": noted}


# ----------------------------------------------------------------------------------------------------- detect
async def detect(state: AlmanacState, runtime: Runtime[Any]) -> dict[str, Any]:
    """A calamity seen at least twice that is not yet a Tradition is a candidate."""
    st = GraphStore(runtime.store)
    night = int(state["night"])
    tour = await _tour(st, state)
    held = {t["calamity"] for t in tour.get("traditions", [])}
    candidates = [
        {
            "calamity": cal,
            "title": world.calamity_title(cal),
            "count": int(n),
            "text": f"{world.calamity_title(cal)} has struck {n} times this tour. Enshrine it, and every town will expect it.",
        }
        for cal, n in sorted(tour.get("calamity_counts", {}).items(), key=lambda kv: (-kv[1], kv[0]))
        if n >= THRESHOLD and cal not in held
    ]
    for c in candidates:
        emit("almanac.candidate", _k(night, "candidate", c["calamity"]), agent="almanac", **c)
    emit("progress", _k(night, "progress", "detect"), agent="almanac", label=f"{len(candidates)} candidate Tradition(s)", pct=50)
    return {"candidates": candidates}


def route_after_detect(state: AlmanacState) -> str:
    return "curate" if state.get("candidates") else "recall"


# ----------------------------------------------------------------------------------------------------- curate
def clean_choice(raw: Any, candidates: list[dict[str, Any]]) -> list[str]:
    """Validate the resume value `{"enshrine": [calamity, ...]}`: only real candidates, no duplicates, at most MAX_TRADITIONS.
    Garbage (not a dict, wrong types, unknown slugs) enshrines nothing rather than crashing."""
    allowed = [c["calamity"] for c in candidates]
    wanted = raw.get("enshrine") if isinstance(raw, dict) else None
    if isinstance(wanted, str):
        wanted = [wanted]
    if not isinstance(wanted, list):
        return []
    out: list[str] = []
    for w in wanted:
        if isinstance(w, str) and w in allowed and w not in out:
            out.append(w)
    return out[:MAX_TRADITIONS]


async def curate(state: AlmanacState) -> dict[str, Any]:
    candidates = state.get("candidates") or []
    raw = interrupt({"kind": "curate_traditions", "candidates": candidates, "max": MAX_TRADITIONS})  # pure above this line
    chosen = clean_choice(raw, candidates)
    emit("progress", _k(int(state["night"]), "progress", "curate"), agent="almanac", label="The Prompter has curated", pct=70)
    return {"chosen": chosen}


# ----------------------------------------------------------------------------------------------------- enshrine
async def enshrine(state: AlmanacState, runtime: Runtime[Any]) -> dict[str, Any]:
    st = GraphStore(runtime.store)
    night = int(state["night"])
    tour = await _tour(st, state)
    for cal in state.get("chosen") or []:
        before = len(tour["traditions"])
        tour = tour_rules.enshrine(tour, cal)  # +1 Encore token; idempotent for an already-held Tradition
        if len(tour["traditions"]) > before:
            emit("almanac.tradition", _k(night, "tradition", cal), agent="almanac", calamity=cal, title=world.calamity_title(cal))
    await put_tour(st, tour)
    emit("progress", _k(night, "progress", "enshrine"), agent="almanac", label="Traditions enshrined", pct=85)
    return {}


# ----------------------------------------------------------------------------------------------------- recall
def recall_query(next_town: str) -> str:
    """The town's name + its gossip + the calamity it expects. The default embedder is a hashed bag of words (lexical, not truly
    semantic), so the two discriminating terms (the short name, the expected gag) are repeated to outweigh the gossip's filler:
    measured on the 60 seeded legends the town's own legend is the best raw hit for 25 of 30 towns (14 of 30 unweighted), and the
    town-first ordering in `recall_node` makes it 30 of 30."""
    t = world.towns()[next_town]
    short = t["name"].split("-")[0]
    expects = t["temperament"].get("expects")
    words = world.calamity_words(expects) if expects else ""
    return " ".join(p for p in (" ".join([short] * 3), t["name"], " ".join([words] * 3) if words else "", t.get("gossip", "")) if p)


async def recall_node(state: AlmanacState, runtime: Runtime[Any]) -> dict[str, Any]:
    """Semantic search of the Store (legends + this tour's own calamities) for the town the wagon is heading to."""
    st = GraphStore(runtime.store)
    night = int(state["night"])
    nxt = state.get("next_town")
    recalled: list[dict[str, Any]] = []
    if nxt and nxt in world.towns():
        hits = await recall(st, state["tour_id"], recall_query(nxt), limit=RECALL_LIMIT * 3)
        # the next town's own legends first (that is what the Prompter is walking into), then the best of the rest
        recalled = sorted((h for h in hits if (h["score"] or 0) > 0), key=lambda h: (h["town"] != nxt, -h["score"]))[:RECALL_LIMIT]
    for i, r in enumerate(recalled):
        emit("memory.recalled", _k(night, "recalled", i), agent="almanac", **r)
    tour = await _tour(st, state)
    emit("progress", _k(night, "progress", "recall"), agent="almanac", label="The Almanac is closed", pct=100)
    return {"traditions": tour.get("traditions", []), "recalled": recalled}
