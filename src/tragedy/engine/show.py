"""THE SHOW ENGINE. Pure, deterministic, JSON-in/JSON-out; the `performance` graph orchestrates these functions.

Beat flow (graph node -> engine call):
    direct   -> beat_context, beat_quality, direct_note
    perform  -> detect_mishaps (+ auto_choice for minor ones)
    prompters_box (interrupt, major mishaps only) -> the player's `choice`
    resolve  -> resolve_mishap (one per mishap), then `audience` (Send x12 over seat_reaction) and `close_beat`
    curtain_call -> finish_show
`simulate_show` runs the very same functions with a policy instead of a Prompter: rehearsal, gold set, tests.
"""

from __future__ import annotations

import re
from copy import deepcopy
from statistics import fmean
from typing import Any

from tragedy.common.rng import chance, clamp, pick, roll, stable_int
from tragedy.data.tags import BEAT_WEIGHTS, BEATS, ROLES
from tragedy.engine import audience, flavour, world
from tragedy.engine.casting import role_fit

LINEUP = ROLES
BEAT_NAMES = ("The Setup", "The Complication", "The Reversal", "The Twist", "The Finale")
MAX_MISHAPS_PER_BEAT = 2
FIRST_DECISION_BY = 1  # beat index (0..4): every show puts a real decision (a major mishap) in front of the Prompter by the second beat
CHAOS_DECAY = 2.0  # was 3.0: with the retuned whispers (data/content/whispers.py) chaos now builds, so covering up can matter
PERSONAL_TOUCH = 2.0
# --- balance knobs (measured by `python -m tragedy.engine.balance`; retune together, then `make data`) -----------
P_SCALE = 0.55  # share of a flaw's authored intensity that becomes mishap probability
EFFECT_SCALE = 0.6  # authored mishap/whisper warmth effects are generous; the audience is hard to please
LUCK_GAIN = 6.0  # +/- warmth per beat of pure stage luck (a restless house, a lucky draught): the 'probably' in the title
PROP_BONUS = 2.0  # warmth per real prop the troupe owns that a scene calls for (max 2 per beat): the real thing, not a rubber one
CHAIN_BONUS = 1.0  # warmth per link of a yes-and chain
PERF_CENTER, PERF_DIV = 64.0, 7.0  # beat quality maps to warmth as (Q - center) / div
# A fun audit found gothic romance the best genre in 30 of 30 towns: its beats lean on the skills (drama, romance) that the strongest
# puppets have. GENRE_CENTER is each genre's measured mean beat quality for Madame's cast (tests/unit/test_engine.py re-measures it);
# beat_quality() judges a beat against its own genre's usual quality, so no genre is strong by default, and the town decides.
GENRE_CENTER = {"melodrama": 66.3, "farce": 64.4, "whodunit": 65.7, "gothic_romance": 71.8, "pantomime": 64.9}  # re-measured after FIRST_DECISION_BY
GENRE_MEAN = 66.6
GENRE_FAVOUR = 2.0  # warmth per beat when the town LOVES tonight's genre; the same, negative, when it scorns it
RAPPORT_CHAIN = 0.07  # each rapport point makes that puppet this much likelier to join your "Yes, and..." (it no longer cuts mishaps)


# --------------------------------------------------------------------------------------------------- show state
def _traditions(raw: Any) -> dict[str, int]:
    out: dict[str, int] = {}
    for x in raw or []:
        if isinstance(x, str):
            out[x] = 2
        else:
            out[x["calamity"]] = int(x.get("count", 2))
    return out


def spare_flaws() -> list[str]:
    """Flaws no puppet carries permanently: they strike as one-night 'bad days'."""
    carried = {f for p in world.performers().values() for f in p["flaws"]}
    return sorted(set(world.flaws()) - carried)


def bad_days(seed: int, night: int, cast: dict[str, str]) -> dict[str, str]:
    spare = spare_flaws()
    out: dict[str, str] = {}
    for aid in cast.values():
        if spare and chance(0.35, seed, night, "bad-day", aid):
            out[aid] = pick(spare, seed, night, "bad-day-flaw", aid)
    return out


def flaws_of(show: dict[str, Any], actor_id: str) -> list[str]:
    extra = show.get("bad_day", {}).get(actor_id)
    return [*world.performers()[actor_id]["flaws"], *([extra] if extra else [])]


def init_show(
    *,
    seed: int,
    night: int,
    genre: str,
    town: str,
    cast: dict[str, str],
    rapport: dict[str, int] | None = None,
    traditions: Any = None,
    morale: int = 0,
    props_owned: list[str] | None = None,
) -> dict[str, Any]:
    t = world.towns()[town]
    return {
        "seed": seed,
        "night": night,
        "genre": genre,
        "town": town,
        "cast": dict(cast),
        "beat": 0,
        "warmth": round(40 + 20 * t["temperament"]["openness"], 1),
        "chaos": 10.0,
        "quality": [],
        "lead_q": [],
        "mishaps": [],
        "calamities": [],
        "decisions": [],
        "cues_left": {cid: row["uses"] for cid, row in world.cues().items()},
        "cues_used": [],
        "yes_and": 0,
        "tradition_hits": 0,
        "beats": [],
        "rapport": dict(rapport or {}),
        "traditions": _traditions(traditions),
        "morale": int(morale),
        "props_owned": sorted(set(props_owned or [])),
        "bad_day": bad_days(seed, night, cast),
    }


def stage_fright(show: dict[str, Any], actor_id: str) -> float:
    """Morale (-3..+3, from the road) shifts everyone's nerves by 5 points per step."""
    return clamp(world.performers()[actor_id]["stage_fright"] - 5 * show.get("morale", 0))


# --------------------------------------------------------------------------------------------------- beat context
def _fmt(text: str, names: dict[str, str], slots: dict[str, str], town_name: str) -> str:
    out = text
    for r in LINEUP:
        out = out.replace("{" + r + "}", names[r])
    return (
        out.replace("{place}", slots.get("place", "stage"))
        .replace("{object}", slots.get("object", "prop"))
        .replace("{town}", town_name)
    )


def _emotion(role: str, tags: list[str], seed: int, night: int, beat: int, k: int) -> str:
    t = set(tags)
    if role == "villain":
        return (
            "rage" if t & {"fire", "sword", "chase", "betrayal"} and roll(seed, night, beat, k, "emo") < 0.5 else "smug"
        )
    if t & {"romance", "kiss", "wedding", "reunion"} and role == "lead":
        return "love"
    if t & {"mourning", "death"}:
        return "grief"
    if t & {"ghost", "chase", "storm", "murder", "fire"}:
        return "fear"
    return pick(("joy", "neutral", "joy"), seed, night, beat, k, role, "emo")


def beat_context(show: dict[str, Any], script: dict[str, Any], i: int) -> dict[str, Any]:
    b = script["beats"][i]
    g, town = world.genres()[show["genre"]], world.towns()[show["town"]]
    cast = show["cast"]
    names = {r: world.nick(cast[r]) for r in LINEUP}
    prop_tags = {t for p in b.get("props", []) for t in world.props().get(p, {}).get("tags", [])}
    all_tags = sorted(set(b["tags"]) | prop_tags)
    lines = [
        {
            "actor": cast[ln["role"]],
            "role": ln["role"],
            "text": _fmt(ln["text"], names, b.get("slots", {}), town["name"]),
            "emotion": _emotion(ln["role"], all_tags, show["seed"], show["night"], i, k),
        }
        for k, ln in enumerate(b["lines"])
    ]
    return {
        "index": i,
        "beat": BEATS[i],
        "name": BEAT_NAMES[i],
        "logline": b["logline"],
        "beat_tags": list(b["tags"]),
        "tags": all_tags,
        "set": g["sets"][BEATS[i]],
        "sky": town["sky"],
        "props": list(b.get("props", [])),
        "lines": lines,
        "lineup": [{"actor": cast[r], "role": r} for r in LINEUP],
        "slots": b.get("slots", {}),
        "palette": g["palette"],
    }


def beat_quality(show: dict[str, Any], ctx: dict[str, Any]) -> tuple[float, dict[str, float]]:
    skill = world.genres()[show["genre"]]["skill_by_beat"][ctx["beat"]]
    per: dict[str, float] = {}
    shift = GENRE_CENTER.get(show["genre"], GENRE_MEAN) - GENRE_MEAN  # judged against the genre's usual quality: no genre is strong by default
    for r in LINEUP:
        a = world.performers()[show["cast"][r]]
        per[r] = round(
            clamp(
                0.5 * a["skills"][skill]
                + 0.3 * role_fit(a, r)
                + 0.2 * (100 - stage_fright(show, a["id"]))
                - 0.15 * show["chaos"]
                - shift
            ),
            1,
        )
    return round(fmean(per.values()), 1), per


def direct_note(show: dict[str, Any], ctx: dict[str, Any]) -> str:
    """Madame's draft note for the beat (the graph gives it a voice)."""
    lead = world.nick(show["cast"]["lead"])
    chaos = show["chaos"]
    mood = (
        "The strings are practically a hedge."
        if chaos >= 60
        else "Darling, no sudden movements."
        if chaos >= 30
        else "Calm. Elegant. Do not ruin it."
    )
    return f"{ctx['name']}: {ctx['logline']} {lead}, you're on. {mood}"


# --------------------------------------------------------------------------------------------------- mishaps
def mishap_probability(show: dict[str, Any], actor_id: str, flaw_id: str) -> float:
    f = world.flaws()[flaw_id]
    # Rapport used to subtract here (-0.08 a point). But mishaps are where the warmth and the decisions come from, so friendship made
    # shows duller and worse (a fun audit measured -3.6 stars a tour at rapport 5). It now helps the yes-and chain instead.
    p = P_SCALE * f["intensity"] + show["chaos"] / 300 + stage_fright(show, actor_id) / 450
    return round(clamp(p, 0.05, 0.9), 3)


def _format_mishap(
    row: dict[str, Any], show: dict[str, Any], ctx: dict[str, Any], actor: str, other: str
) -> dict[str, str]:
    d = {
        "actor": world.nick(actor),
        "other": world.nick(other),
        "object": ctx["slots"].get("object", "prop"),
        "place": ctx["slots"].get("place", "stage"),
        "town": world.towns()[show["town"]]["name"],
    }

    def f(s: str) -> str:
        for k, v in d.items():
            s = s.replace("{" + k + "}", v)
        return s

    return {"title": f(row["title"]), "text": f(row["text"])}


def detect_mishaps(show: dict[str, Any], ctx: dict[str, Any]) -> list[dict[str, Any]]:
    seed, night, beat = show["seed"], show["night"], ctx["index"]
    tags = set(ctx["tags"])
    cands: list[tuple[float, str, str, str, bool]] = []  # p, actor, flaw, role, fired
    for r in LINEUP:
        aid = show["cast"][r]
        for fid in flaws_of(show, aid):
            if set(world.flaws()[fid]["triggers"]) & tags:
                p = mishap_probability(show, aid, fid)
                cands.append((p, aid, fid, r, chance(p, seed, night, beat, aid, fid)))
    fired = sorted((c for c in cands if c[4]), key=lambda c: (-c[0], c[1], c[2]))
    chosen: list[tuple[float, str, str, str, bool]] = []
    used: set[str] = set()
    for c in fired:
        if c[1] not in used and len(chosen) < MAX_MISHAPS_PER_BEAT:
            chosen.append(c)
            used.add(c[1])
    def build(c: tuple[float, str, str, str, bool], forced: bool) -> dict[str, Any]:
        p, aid, fid, role, _ = c
        rows = world.mishaps_by_flaw()[fid]
        if forced:
            rows = [r for r in rows if r["severity"] == "major"] or rows  # a promised decision is one the Prompter must handle
        row = pick(rows, seed, night, beat, aid, fid, "row")
        others = [show["cast"][r] for r in LINEUP if show["cast"][r] != aid]
        other = pick(others, seed, night, beat, aid, "other")
        txt = _format_mishap(row, show, ctx, aid, other)
        return {
            "id": row["id"],
            "flaw": fid,
            "actor": aid,
            "other": other,
            "role": role,
            "kind": row["kind"],
            "severity": row["severity"],
            "title": txt["title"],
            "text": txt["text"],
            "anim": row["anim"],
            "tags": list(row["tags"]),
            "calamity": row["calamity"],
            "effects": dict(row["effects"]),
            "p": p,
            "forced": forced,
            "beat": beat,
        }

    out = [build(c, False) for c in chosen]
    # The Prompter's whole job is the whisper, and Madame handles minor mishaps herself, so a show that has only had minor ones has given
    # the player nothing to do. (A played-through audit waited 2 min 38 s at 1x for its first decision; a simulation put the first major
    # mishap at the finale in 6% of shows and nowhere in 8%.) Guarantee a real decision by beat FIRST_DECISION_BY: promote the likeliest
    # mishap that fired this beat to a major one, or force a major one when nothing fired.
    mishaps_by_id = world.mishaps()
    had_major = any(mishaps_by_id[m["id"]]["severity"] == "major" for m in show["mishaps"] if m["id"] in mishaps_by_id)
    if beat >= FIRST_DECISION_BY and not had_major and not any(o["severity"] == "major" for o in out):
        if chosen:
            out[0] = build(chosen[0], True)
        else:
            pool = sorted(cands, key=lambda c: (-c[0], c[1], c[2])) or [
                (0.5, show["cast"]["lead"], world.performers()[show["cast"]["lead"]]["flaws"][0], "lead", False)
            ]
            out = [build(pool[0], True)]
    return out


# --------------------------------------------------------------------------------------------------- decisions
def whisper_options(kind: str) -> list[dict[str, Any]]:
    return world.whispers().get(kind, world.whispers()["generic"])["options"]


def shuffled_options(show: dict[str, Any], mishap: dict[str, Any]) -> list[dict[str, Any]]:
    """The three whispers in an order that changes per mishap (but is the same on every replay of that beat).

    "Yes, and..." used to be option 1 every time, so the right answer was always the same key.
    """
    return sorted(
        whisper_options(mishap["kind"]),
        key=lambda o: stable_int(show["seed"], show["night"], mishap["beat"], mishap["id"], o["id"], "order"),
    )


def prompter_view(show: dict[str, Any], mishap: dict[str, Any]) -> dict[str, Any]:
    """The interrupt payload for the Prompter's Box."""
    return {
        "kind": "prompters_box",
        "beat": mishap["beat"],
        "mishap": {
            k: mishap[k] for k in ("id", "title", "text", "actor", "kind", "severity", "tags", "anim", "calamity")
        },
        "options": [{"id": o["id"], "label": o["label"], "hint": o["hint"]} for o in shuffled_options(show, mishap)],
        "cues": [
            {"id": cid, "label": row["label"], "emoji": row["emoji"], "uses_left": show["cues_left"].get(cid, 0)}
            for cid, row in world.cues().items()
        ],
        "free_text": True,
    }


def auto_choice(show: dict[str, Any], mishap: dict[str, Any]) -> dict[str, Any]:
    """What Madame does about a minor mishap: tidy up if the strings are a mess, otherwise lean in."""
    opts = whisper_options(mishap["kind"])
    pick_opt = (
        min(opts, key=lambda o: o["effects"]["chaos"])
        if show["chaos"] >= 50
        else next((o for o in opts if o.get("chain")), opts[0])
    )
    return {"option": pick_opt["id"], "cue": None, "text": None, "by": "madame"}


def policy_choice(
    show: dict[str, Any], mishap: dict[str, Any], policy: str, ctx: dict[str, Any] | None = None
) -> dict[str, Any]:
    """Autopilot Prompters. `best` = one-step lookahead through the engine itself (every option x every usable cue)."""
    opts = whisper_options(mishap["kind"])
    if policy == "cover_up":
        o = min(opts, key=lambda x: x["effects"]["chaos"])
        return {"option": o["id"], "cue": None, "text": None, "by": "prompter"}
    if policy != "best" or ctx is None:  # lean_in
        o = next((x for x in opts if x.get("chain")), opts[0])
        return {"option": o["id"], "cue": None, "text": None, "by": "prompter"}

    def value(res: dict[str, Any]) -> float:
        # warmth now, and keep the strings in the charming zone (the critics' sweet spot is ~45, not 0)
        e = res["effects"]
        return e["warmth"] - 0.2 * abs(show["chaos"] + e["chaos"] - 40)

    best_choice, best_val = None, -1e9
    usable = [None] + [c for c, n in show["cues_left"].items() if n > 0]
    for o in opts:
        for cue in usable:
            choice = {"option": o["id"], "cue": cue, "text": None}
            res = resolve_mishap(show, ctx, mishap, choice)
            v = value(res) - (3.0 if cue else 0.0)  # cues are limited: only spend one for a clear win
            if v > best_val + 1e-9:
                best_choice, best_val = choice, v
    assert best_choice is not None
    return {**best_choice, "text": None, "by": "prompter"}


def _classify_text(text: str, opts: list[dict[str, Any]]) -> dict[str, Any]:
    words = set(re.findall(r"[a-z']+", text.lower()))
    best, best_n = None, 0
    for o in opts:
        vocab = {
            w for w in re.findall(r"[a-z']+", f"{o['label']} {o['hint']} {o.get('line', '')}".lower()) if len(w) > 3
        }
        vocab |= {k.lower() for k in o.get("keywords", [])}
        n = len(words & vocab)
        if n > best_n:
            best, best_n = o, n
    return best or next((o for o in opts if o.get("chain")), opts[0])


def resolve_mishap(
    show: dict[str, Any], ctx: dict[str, Any], mishap: dict[str, Any], choice: dict[str, Any]
) -> dict[str, Any]:
    """Pure: the consequences of one decision. Does not mutate `show` (apply via close_beat)."""
    opts = whisper_options(mishap["kind"])
    text = (choice.get("text") or "").strip() or None
    opt = next((o for o in opts if o["id"] == choice.get("option")), None)
    if opt is None:
        opt = _classify_text(text, opts) if text else next((o for o in opts if o.get("chain")), opts[0])
    scale = 0.5 if mishap["severity"] == "minor" else 1.0
    warmth = (mishap["effects"].get("warmth", 0) + opt["effects"].get("warmth", 0)) * scale * EFFECT_SCALE
    chaos = (mishap["effects"].get("chaos", 0) + opt["effects"].get("chaos", 0)) * scale
    tags = [t for t in [opt.get("adds_tag")] if t]
    if text:
        warmth += PERSONAL_TOUCH
    cue_out = None
    cid = choice.get("cue")
    if cid and show["cues_left"].get(cid, 0) > 0 and cid in world.cues():
        cue = world.cues()[cid]
        fits = sorted(set(cue["fits"]) & (set(mishap["tags"]) | set(ctx["tags"]) | set(tags)))
        miracle = bool(fits)
        eff = cue["effects"] if miracle else cue["misfire"]
        warmth += eff.get("warmth", 0)
        chaos += eff.get("chaos", 0)
        cue_out = {
            "cue": cid,
            "fits": fits,
            "outcome": "miracle" if miracle else "misfire",
            "anim": cue["anim"],
            "text": (f"{cue['label']}: exactly what the scene needed." if miracle else cue["misfire_text"]),
            "effects": dict(eff),
        }
    chain = None
    if opt.get("chain"):
        joiners = [
            show["cast"][r]
            for r in LINEUP
            if show["cast"][r] != mishap["actor"]
            and chance(
                min(0.95, 0.1 + 0.9 * world.performers()[show["cast"][r]]["skills"]["improv"] / 100 * 0.85 + RAPPORT_CHAIN * show["rapport"].get(show["cast"][r], 0)),
                show["seed"],
                show["night"],
                ctx["index"],
                show["cast"][r],
                "chain",
            )
        ]
        if joiners:
            lines = [flavour.yes_and_line(world.nick(a), show["seed"], show["night"], ctx["index"], a) for a in joiners]
            chain = {"actors": joiners, "lines": lines, "bonus": round(CHAIN_BONUS * len(joiners), 1)}
            warmth += chain["bonus"]
    trad = None
    count = show["traditions"].get(mishap["calamity"])
    if count and opt.get("chain"):
        bonus = 10.0 if count >= 3 else 6.0
        trad = {"calamity": mishap["calamity"], "bonus": bonus}
        warmth += bonus
    return {
        "mishap_id": mishap["id"],
        "calamity": mishap["calamity"],
        "option": opt["id"],
        "label": opt["label"],
        "by": choice.get("by", "prompter"),
        "text": text,
        "line": opt.get("line", ""),
        "cue": cue_out,
        "chain": chain,
        "tradition": trad,
        "tags": tags,
        "effects": {"warmth": round(warmth, 2), "chaos": round(chaos, 2)},
    }


# --------------------------------------------------------------------------------------------------- town & audience
def town_judgement(town_id: str, tags: list[str], calamities: list[str]) -> tuple[float, list[str]]:
    temp = world.towns()[town_id]["temperament"]
    delta, notes = 0.0, []
    for t in sorted(set(tags)):
        if t in temp["likes"]:
            delta += 2.5
            notes.append(f"likes {t}")
        elif t in temp["hates"]:
            delta -= 3.0
            notes.append(f"hates {t}")
    for c in calamities:
        if c == temp.get("expects"):
            delta += 8.0
            notes.append(f"expected {c}")
    return round(clamp(delta, -12, 12), 2), notes


def event_tags(ctx: dict[str, Any], mishaps: list[dict[str, Any]], results: list[dict[str, Any]]) -> list[str]:
    tags = set(ctx["tags"])
    for m in mishaps:
        tags |= set(m["tags"])
    for r in results:
        tags |= set(r["tags"])
        if r["cue"] and r["cue"]["outcome"] == "miracle":
            tags |= set(r["cue"]["fits"])
    return sorted(tags)


# --------------------------------------------------------------------------------------------------- closing a beat
def close_beat(
    show: dict[str, Any],
    ctx: dict[str, Any],
    qual: float,
    per: dict[str, float],
    mishaps: list[dict[str, Any]],
    results: list[dict[str, Any]],
    audience_delta: float,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Returns (new show, breakdown). Pure."""
    s = deepcopy(show)
    perf = (qual - PERF_CENTER) / PERF_DIV
    temper = world.towns()[s["town"]]["temperament"]
    genre_taste = GENRE_FAVOUR if temper.get("favours") == s["genre"] else -GENRE_FAVOUR if temper.get("scorns") == s["genre"] else 0.0
    eff_w = sum(r["effects"]["warmth"] for r in results)
    eff_c = sum(r["effects"]["chaos"] for r in results)
    tags = event_tags(ctx, mishaps, results)
    town_d, notes = town_judgement(s["town"], tags, [m["calamity"] for m in mishaps])
    tangle = -1.5 if s["chaos"] >= 70 else 0.0
    # props honouring a Tradition (the chair is back!)
    from tragedy.engine.script import CALAMITY_PROP

    callbacks = [c for c in s["traditions"] if CALAMITY_PROP.get(c) in ctx["props"]]
    callback_bonus = 4.0 * len(callbacks)
    owned_hit = [p_ for p_ in ctx["props"] if p_ in s.get("props_owned", [])][:2]
    prop_bonus = PROP_BONUS * len(owned_hit)
    luck = round((roll(s["seed"], s["night"], ctx["index"], "luck") - 0.5) * 2 * LUCK_GAIN, 2)
    s["warmth"] = round(clamp(s["warmth"] + perf + eff_w + town_d + genre_taste + audience_delta + tangle + callback_bonus + prop_bonus + luck), 1)
    s["chaos"] = round(clamp(s["chaos"] + eff_c - CHAOS_DECAY), 1)
    s["quality"].append(qual)
    s["lead_q"].append(per["lead"])
    for m, r in zip(mishaps, results, strict=True):
        s["mishaps"].append(
            {
                "beat": ctx["index"],
                "id": m["id"],
                "title": m["title"],
                "actor": m["actor"],
                "calamity": m["calamity"],
                "decision": r["option"],
            }
        )
        s["calamities"].append(m["calamity"])
        s["decisions"].append({"mishap_id": m["id"], "option": r["option"], "by": r["by"]})
        if r["cue"]:
            s["cues_left"][r["cue"]["cue"]] = max(0, s["cues_left"][r["cue"]["cue"]] - 1)
            s["cues_used"].append(r["cue"]["cue"])
        if r["chain"]:
            s["yes_and"] += len(r["chain"]["actors"])
        if r["tradition"]:
            s["tradition_hits"] += 1
    s["tradition_hits"] += len(callbacks)
    s["beats"].append({"beat": ctx["beat"], "warmth": s["warmth"], "chaos": s["chaos"]})
    s["beat"] = ctx["index"] + 1
    breakdown = {
        "performance": round(perf, 2),
        "mishaps": round(eff_w, 2),
        "town": town_d,
        "town_notes": notes,
        "genre_taste": genre_taste,
        "audience": round(audience_delta, 2),
        "tangle": tangle,
        "callbacks": callbacks,
        "callback_bonus": callback_bonus,
        "real_props": owned_hit,
        "prop_bonus": prop_bonus,
    }
    return s, breakdown


def why_chips(breakdown: dict[str, Any], *, town_name: str, genre_name: str) -> list[dict[str, Any]]:
    """The reasons behind one beat's warmth change, as short player-readable chips, biggest first. Pure.

    A fun audit found the engine computed all of this and threw it away, so a player could not learn WHY a night scored what it did
    (town taste moved the warmth as much as luck did, and was never named).
    """
    chips: list[dict[str, Any]] = []

    def add(label: str, value: float) -> None:
        if abs(value) >= 0.5:
            chips.append({"label": label, "value": round(value, 1)})

    if breakdown.get("genre_taste"):
        add(f"{town_name} {'loves' if breakdown['genre_taste'] > 0 else 'scorns'} {genre_name}", breakdown["genre_taste"])
    for note in breakdown.get("town_notes", []):
        kind, _, what = note.partition(" ")
        pretty = what.replace("_", " ")
        if kind == "likes":
            add(f"The town likes {pretty}", 2.5)
        elif kind == "hates":
            add(f"The town hates {pretty}", -3.0)
        elif kind == "expected":
            add(f"The town was waiting for {pretty}", 8.0)
    for prop in breakdown.get("real_props", []):
        add(f"A real {prop.replace('_', ' ')}", PROP_BONUS)
    for cal in breakdown.get("callbacks", []):
        add(f"The tradition returns: {cal.replace('the_', '').replace('_', ' ')}", 4.0)
    add("Strings in a knot", breakdown.get("tangle", 0.0))
    add("The playing", breakdown.get("performance", 0.0))
    add("Your whispers and the mishaps", breakdown.get("mishaps", 0.0))
    add("The house", breakdown.get("audience", 0.0))
    return sorted(chips, key=lambda c: -abs(c["value"]))


def finish_show(show: dict[str, Any]) -> dict[str, Any]:
    q = show["quality"]
    quality_avg = sum(w * x for w, x in zip(BEAT_WEIGHTS, q, strict=False)) / max(1e-9, sum(BEAT_WEIGHTS[: len(q)]))
    knotted = show["chaos"] >= 90
    warmth = clamp(show["warmth"] - (5 if knotted else 0))
    return {
        "warmth": round(warmth, 1),
        "chaos": round(show["chaos"], 1),
        "quality_avg": round(quality_avg, 1),
        "quality_lead": round(fmean(show["lead_q"]) if show["lead_q"] else 0.0, 1),
        "quality": list(q),
        "mishaps": list(show["mishaps"]),
        "calamities": list(show["calamities"]),
        "tradition_hits": show["tradition_hits"],
        "yes_and": show["yes_and"],
        "cues_used": list(show["cues_used"]),
        "beats": list(show["beats"]),
        "knotted": knotted,
    }


# --------------------------------------------------------------------------------------------------- headless
def run_beat(show: dict[str, Any], script: dict[str, Any], i: int, policy: str = "lean_in") -> dict[str, Any]:
    """One whole beat with a policy instead of a Prompter. Mirrors the graph step for step."""
    ctx = beat_context(show, script, i)
    qual, per = beat_quality(show, ctx)
    mishaps = detect_mishaps(show, ctx)
    results: list[dict[str, Any]] = []
    working = deepcopy(show)
    for m in mishaps:
        choice = auto_choice(working, m) if m["severity"] == "minor" else policy_choice(working, m, policy, ctx)
        res = resolve_mishap(working, ctx, m, choice)
        if res["cue"]:
            working["cues_left"][res["cue"]["cue"]] -= 1
        results.append(res)
    tags = event_tags(ctx, mishaps, results)
    seats = audience.make_seats(show["seed"], show["night"], show["town"])
    reacts = [
        audience.seat_reaction(
            s_,
            tags=tags,
            mishap_tags=sorted({t for m in mishaps for t in m["tags"]}),
            chain=any(r["chain"] for r in results),
            beat=i,
            seed=show["seed"],
            night=show["night"],
        )
        for s_ in seats
    ]
    tally = audience.tally(reacts)
    new_show, breakdown = close_beat(show, ctx, qual, per, mishaps, results, tally["delta"])
    return {
        "show": new_show,
        "ctx": ctx,
        "mishaps": mishaps,
        "results": results,
        "tally": tally,
        "reactions": reacts,
        "breakdown": breakdown,
    }


def simulate_show(
    *,
    seed: int,
    night: int,
    genre: str,
    town: str,
    cast: dict[str, str],
    script: dict[str, Any],
    rapport: dict[str, int] | None = None,
    traditions: Any = None,
    policy: str = "lean_in",
) -> dict[str, Any]:
    show = init_show(seed=seed, night=night, genre=genre, town=town, cast=cast, rapport=rapport, traditions=traditions)
    for i in range(len(BEATS)):
        show = run_beat(show, script, i, policy)["show"]
    return finish_show(show)
