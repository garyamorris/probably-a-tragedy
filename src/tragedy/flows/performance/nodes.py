"""Nodes of the `performance` graph. Each is a thin shell: the engine decides, the node emits events and routes."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

from langchain_core.runnables import RunnableConfig
from langgraph.errors import NodeError
from langgraph.runtime import Runtime
from langgraph.types import Command, Send, interrupt

from tragedy.common.rng import chance
from tragedy.common.stream import emit
from tragedy.engine import audience, world
from tragedy.engine import show as engine
from tragedy.flows.performance.state import ReactInput, ShowState
from tragedy.models.factory import voice
from tragedy.tour_store import GraphStore, get_tour

MADAME = "Madame Odalys Prunt, an imperious, wounded theatre director who lives off one good review from 1987"
FRIGHT_BEAT = 2  # the Reversal: where a nervous lead is most likely to freeze (and Gus is most likely to be needed)


class StageFright(Exception):
    """A performer froze. RetryPolicy retries once (they stay frozen); the error handler sends in the understudy."""

    def __init__(self, role: str, actor: str) -> None:
        super().__init__(f"{actor} froze as the {role}")
        self.role, self.actor = role, actor


def _key(show: dict[str, Any], *parts: Any) -> str:
    return ":".join(str(p) for p in (show["night"], *parts))


# ----------------------------------------------------------------------------------------------------- defaults

async def studio_defaults(state: ShowState, runtime: Runtime[Any]) -> dict[str, Any]:
    """Complete a partial input (LangGraph Studio's form): fills only what is blank, never overrides; a no-op for the game."""
    from tragedy.flows.defaults import complete

    out = await complete(dict(state), runtime.store, cast=True, script=True)
    filled = out.pop("_filled")
    if filled:
        emit("note", f"defaults:{out['night']}", agent="defaults", text="Filled in what was left blank: " + ", ".join(filled) + ".")
    return out


# ----------------------------------------------------------------------------------------------------- curtain_up
async def curtain_up(state: ShowState, runtime: Runtime[Any]) -> dict[str, Any]:
    tour = await get_tour(GraphStore(runtime.store), state["tour_id"]) or {}
    show = engine.init_show(
        seed=state["seed"], night=state["night"], genre=state["genre"], town=state["town"], cast=state["cast"],
        rapport=tour.get("rapport", {}), traditions=tour.get("traditions", []), morale=tour.get("morale", 0),
        props_owned=tour.get("props", []),
    )
    seats = audience.make_seats(show["seed"], show["night"], show["town"])
    for s in seats:
        emit("audience.seat", _key(show, "seat", s["seat"]), agent="curtain_up", **s)
    emit("meter", _key(show, "meter", -1), agent="curtain_up", warmth=show["warmth"], chaos=show["chaos"], beat=0)
    emit("progress", _key(show, "progress", 0), agent="curtain_up", label="Curtain up", pct=0)
    return {"show": show, "seats": seats, "reactions": []}


# ----------------------------------------------------------------------------------------------------- direct
async def direct(state: ShowState, config: RunnableConfig) -> Command[Any]:
    show = state["show"]
    i = show["beat"]
    ctx = engine.beat_context(show, state["script"], i)
    qual, per = engine.beat_quality(show, ctx)
    note = await voice(MADAME, engine.direct_note(show, ctx), actor="madame", config=config)
    emit("stage.beat", _key(show, "beat", i), agent="madame", index=i, beat=ctx["beat"], name=ctx["name"], logline=ctx["logline"], tags=ctx["tags"])
    emit("stage.set", _key(show, "set", i), agent="madame", beat=ctx["beat"], set=ctx["set"], sky=ctx["sky"], props=ctx["props"], palette=ctx["palette"])
    if i == 0:
        for k, row in enumerate(ctx["lineup"]):
            emit("stage.enter", _key(show, "enter", row["actor"]), agent="madame", actor=row["actor"], role=row["role"], **{"from": "left" if k % 2 == 0 else "right"})
    emit("stage.direct", _key(show, "direct", i), agent="madame", text=note, speaker="madame")
    return Command(update={"ctx": ctx, "qual": qual, "per": per, "mishaps": [], "results": [], "pending": []}, goto="perform")


# ----------------------------------------------------------------------------------------------------- perform
def _fright_victim(state: ShowState) -> tuple[str, str] | None:
    show, ctx = state["show"], state["ctx"]
    if ctx["index"] != FRIGHT_BEAT or "gus" in show["cast"].values():
        return None
    if state.get("scenario") == "stage_fright":
        return "lead", show["cast"]["lead"]
    for role in ("lead", "villain", "fool"):
        a = world.performers()[show["cast"][role]]
        if engine.stage_fright(show, a["id"]) >= 60 and chance(0.18, show["seed"], show["night"], "fright", a["id"]):
            return role, a["id"]
    return None


def _emit_resolution(show: dict[str, Any], ctx: dict[str, Any], idx: int, m: dict[str, Any], res: dict[str, Any]) -> None:
    emit(
        "stage.decision", _key(show, "decision", ctx["index"], idx), agent=res["by"], mishap_id=m["id"], option=res["option"],
        label=res["label"], cue=res["cue"]["cue"] if res["cue"] else None, text=res["text"], line=res["line"],
        effects=res["effects"], by=res["by"],
    )
    if res["cue"]:
        c = res["cue"]
        emit("stage.cue", _key(show, "cue", ctx["index"], idx), agent="prompter", cue=c["cue"], fits=c["fits"], outcome=c["outcome"], text=c["text"], anim=c["anim"])
    if res["chain"]:
        emit("stage.chain", _key(show, "chain", ctx["index"], idx), agent="cast", **res["chain"])


async def perform(state: ShowState) -> Command[Any]:
    show, ctx = state["show"], state["ctx"]
    victim = _fright_victim(state)
    if victim:  # raised BEFORE any side effect, so a retry is clean
        raise StageFright(*victim)
    for k, ln in enumerate(ctx["lines"]):
        emit("stage.line", _key(show, "line", ctx["index"], k), agent=ln["actor"], actor=ln["actor"], role=ln["role"], text=ln["text"], emotion=ln["emotion"])
    mishaps = engine.detect_mishaps(show, ctx)
    results: list[dict[str, Any] | None] = [None] * len(mishaps)
    pending: list[int] = []
    for i, m in enumerate(mishaps):
        emit(
            "stage.mishap", _key(show, "mishap", ctx["index"], i), agent=m["actor"], id=m["id"], actor=m["actor"], other=m["other"], kind=m["kind"],
            severity=m["severity"], title=m["title"], text=m["text"], anim=m["anim"], tags=m["tags"], calamity=m["calamity"], effects=m["effects"],
        )
        if m["severity"] == "major":
            pending.append(i)
        else:  # Madame handles minor mishaps herself
            res = engine.resolve_mishap(show, ctx, m, engine.auto_choice(show, m))
            results[i] = res
            _emit_resolution(show, ctx, i, m, res)
    return Command(update={"mishaps": mishaps, "results": results, "pending": pending}, goto="prompters_box" if pending else "resolve")


async def understudy(state: ShowState, error: NodeError) -> Command[Any]:
    """error_handler for `perform`: after the retries are spent, Gus (who knows every part) finally goes on."""
    exc = error.error
    if not isinstance(exc, StageFright):
        raise exc
    show = deepcopy(state["show"])
    show["cast"][exc.role] = "gus"
    ctx = engine.beat_context(show, state["script"], state["ctx"]["index"])
    qual, per = engine.beat_quality(show, ctx)
    i = ctx["index"]
    emit("stage.exit", _key(show, "exit", exc.actor), agent="clipboard", actor=exc.actor, role=exc.role, **{"from": "trapdoor"})
    emit("stage.enter", _key(show, "enter-gus", i), agent="gus", actor="gus", role=exc.role, **{"from": "trapdoor"})
    emit("note", _key(show, "understudy", i), agent="clipboard", text=f"Cue 14: {world.nick(exc.actor)} has frozen. Gus knows every part. Gus has never been on stage.")
    return Command(update={"show": show, "ctx": ctx, "qual": qual, "per": per}, goto="perform")


# ----------------------------------------------------------------------------------------------------- prompters_box
def _working_show(show: dict[str, Any], results: list[dict[str, Any] | None]) -> dict[str, Any]:
    w = deepcopy(show)
    for r in results:
        if r and r["cue"]:
            w["cues_left"][r["cue"]["cue"]] = max(0, w["cues_left"][r["cue"]["cue"]] - 1)
    return w


def _clean_choice(raw: Any) -> dict[str, Any]:
    raw = raw if isinstance(raw, dict) else {}
    text = raw.get("text")
    return {
        "option": str(raw["option"]) if raw.get("option") else None,
        "cue": str(raw["cue"]) if raw.get("cue") else None,
        "text": str(text).strip()[:140] if text else None,
        "by": "prompter",
    }


async def prompters_box(state: ShowState) -> Command[Any]:
    show, ctx = state["show"], state["ctx"]
    idx = state["pending"][0]
    m = state["mishaps"][idx]
    working = _working_show(show, state["results"])
    choice = _clean_choice(interrupt(engine.prompter_view(working, m)))  # everything above this line must be pure
    res = engine.resolve_mishap(working, ctx, m, choice)
    _emit_resolution(show, ctx, idx, m, res)
    results = list(state["results"])
    results[idx] = res
    rest = state["pending"][1:]
    return Command(update={"results": results, "pending": rest}, goto="prompters_box" if rest else "resolve")


# ----------------------------------------------------------------------------------------------------- resolve -> react x12 -> tally
async def resolve(state: ShowState) -> Command[Any]:
    show, ctx = state["show"], state["ctx"]
    results = [r for r in state["results"] if r]
    tags = engine.event_tags(ctx, state["mishaps"], results)
    mishap_tags = sorted({t for m in state["mishaps"] for t in m["tags"]})
    chain = any(r["chain"] for r in results)
    sends = [
        Send("react", ReactInput(seat=s, tags=tags, mishap_tags=mishap_tags, chain=chain, beat=ctx["index"], seed=show["seed"], night=show["night"]))
        for s in state["seats"]
    ]
    return Command(goto=sends)


async def react(payload: ReactInput) -> dict[str, Any]:
    r = audience.seat_reaction(
        payload["seat"], tags=payload["tags"], mishap_tags=payload["mishap_tags"], chain=payload["chain"],
        beat=payload["beat"], seed=payload["seed"], night=payload["night"],
    )
    emit("audience.react", f"{payload['night']}:react:{payload['beat']}:{r['seat']}", agent=f"seat{r['seat']}",
         seat=r["seat"], reaction=r["reaction"], intensity=r["intensity"], why=r["why"])
    return {"reactions": [{**r, "beat": payload["beat"]}]}


async def tally(state: ShowState) -> Command[Any]:
    show, ctx = state["show"], state["ctx"]
    rs = sorted((r for r in state["reactions"] if r["beat"] == ctx["index"]), key=lambda r: r["seat"])
    t = audience.tally(rs)
    new_show, bd = engine.close_beat(show, ctx, state["qual"], state["per"], state["mishaps"], [r for r in state["results"] if r], t["delta"])
    i = ctx["index"]
    chips = engine.why_chips(bd, town_name=world.towns()[show["town"]]["name"], genre_name=world.genres()[show["genre"]]["name"])
    if chips:
        text = " · ".join(f"{c['label']} {c['value']:+g}" for c in chips[:4])
        emit("stage.why", _key(show, "why", i), agent="clipboard", beat=i, chips=chips, text=text, delta=round(new_show["warmth"] - show["warmth"], 1))
    emit("audience.tally", _key(show, "tally", i), agent="clipboard", beat=i, delta=t["delta"], counts=t["counts"])
    emit("meter", _key(show, "meter", i), agent="clipboard", warmth=new_show["warmth"], chaos=new_show["chaos"], beat=i + 1)
    emit("progress", _key(show, "progress", i + 1), agent="clipboard", label=f"{ctx['name']} done", pct=round(100 * (i + 1) / 5))
    nxt = "direct" if new_show["beat"] < 5 else "curtain_call"
    return Command(update={"show": new_show}, goto=nxt)


# ----------------------------------------------------------------------------------------------------- curtain_call
async def curtain_call(state: ShowState) -> dict[str, Any]:
    show = state["show"]
    result = engine.finish_show(show)
    for row in state["ctx"]["lineup"]:
        emit("stage.exit", _key(show, "bow", row["actor"]), agent=row["actor"], actor=row["actor"], role=row["role"], **{"from": "left"})
    emit(
        "stage.curtain", _key(show, "curtain"), agent="narrator", warmth=result["warmth"], chaos=result["chaos"],
        quality_avg=result["quality_avg"], tradition_hits=result["tradition_hits"], knotted=result["knotted"],
    )
    emit("progress", _key(show, "progress", "done"), agent="narrator", label="Curtain", pct=100)
    return {"result": result}
