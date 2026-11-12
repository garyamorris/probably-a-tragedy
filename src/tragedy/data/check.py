"""``python -m tragedy.data check``: validate every dataset that exists against docs/DATA.md.

What it enforces (errors fail the run, warnings are advice):

* schema: required fields, types, ranges, list lengths, unknown fields (warning)
* vocabulary: every tag / skill / role / beat / genre / calamity / mishap kind / anim / prop / set / sky / landmark / hat /
  head / costume comes from ``tragedy.data.tags`` (the only list that exists)
* text: non-empty, no stray whitespace, sensible length, ``{placeholders}`` from the per-dataset allowed set (``PLACEHOLDERS``)
* counts: the minimum (and sane maximum) number of rows per dataset (``COUNTS``)
* ids: unique, slug-shaped
* referential integrity across datasets (only when both sides exist yet): flaws in performers, mishaps per flaw, whisper
  kinds per mishap kind, props in variants, tastes in towns, calamities in towns.expects, flaw trigger coverage, ...
* balance (engine inputs): every role has >= 3 natural candidates, nobody dominates, flaws can fire, ...

``check_data`` is a pure function of a ``{name: data}`` mapping so tests can feed it broken data on purpose.
"""

from __future__ import annotations

import json
import re
import string
import traceback
from collections import Counter, defaultdict
from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field
from typing import Any, NamedTuple

from tragedy.data import tags as T

# ------------------------------------------------------------------------------------------------ spec constants
DATASET_NAMES: tuple[str, ...] = (
    "performers",
    "staff",
    "flaws",
    "mishaps",
    "whispers",
    "cues",
    "genres",
    "towns",
    "tastes",
    "critics",
    "playbill",
    "road_events",
    "almanac_seeds",
    "props",
    "shows_gold",
)

# (min, max) rows per dataset. "min" is the DATA.md count; "max" is a sanity ceiling so a runaway generator is noticed.
COUNTS: dict[str, tuple[int, int]] = {
    "performers": (8, 8),
    "staff": (7, 12),
    "flaws": (24, 30),
    "mishaps": (80, 110),
    "whispers": (13, 13),
    "cues": (6, 6),
    "genres": (5, 5),
    "towns": (30, 40),
    "tastes": (12, 20),
    "critics": (5, 5),
    "road_events": (20, 30),
    "almanac_seeds": (60, 90),
    "props": (30, 30),
    "shows_gold": (30, 80),
}

NONE: frozenset[str] = frozenset()
# Allowed {placeholders}. Anything else fails check. Edit here (and tell the authors) if the engine grows a new slot.
PLACEHOLDERS: dict[str, frozenset[str]] = {
    "mishaps": frozenset({"actor", "other", "object", "place", "town"}),
    "genres": frozenset({"lead", "villain", "fool", "place", "town", "object"}),
    "critics": frozenset({"show", "lead", "villain", "fool", "town", "mishap", "calamity", "tradition", "snack"}),
    "playbill": frozenset(
        {
            "name",
            "town",
            "show",
            "title",
            "lead",
            "villain",
            "fool",
            "tradition",
            "calamity",
            "mishap",
            "snack",
            "night",
            "genre",
            "stars",
            "quill",
            "role",
            "quote",
        }
    ),
    "road_events": frozenset({"town", "from_town", "to_town"}),
}  # every other dataset: no placeholders at all

REQUIRED_PERFORMERS = ("mabel", "reginald", "gus", "goose", "hortensia", "bartleby", "poppet", "tock")
REQUIRED_STAFF = ("madame", "quill_pompous", "quill_frantic", "quill_tender", "clipboard", "gasket", "narrator")
QUILLS = ("quill_pompous", "quill_frantic", "quill_tender")
REQUIRED_FLAWS = (
    "leans_left",
    "cries_by_watering_can",
    "apologises_mid_villainy",
    "only_knows_act_two",
    "speaks_in_rhyme",
    "exits_through_the_wrong_door",
    "corpses",
    "upstages_the_moon",
    "afraid_of_the_chandelier",
    "allergic_to_feathers",
    "forgets_which_play",
    "falls_in_love_with_props",
    "cannot_say_the_word_macbeth",
    "over_commits_to_death",
    "stage_whispers_everything",
    "eats_the_props",
    "never_been_on_stage",
)
CUE_IDS = ("lights", "thunder", "trapdoor", "fog", "spotlight", "curtain")
REQUIRED_TASTES = (
    "man_who_hates_death",
    "tearful_aunt",
    "pun_lover",
    "child_in_the_front",
    "retired_actor",
    "critic_in_disguise",
    "sleepy_farmer",
    "goose_fancier",
    "romantic",
    "skeptic",
    "snack_vendor",
    "mayor",
)
CRITIC_IDS = ("pompous", "wounded_parent", "snacks", "chaos_gourmand", "sentimentalist")
CRITIC_WEIGHTS = ("quality", "lead", "warmth", "charm_chaos", "tradition", "snacks")
ARMS = ("short", "normal", "long")  # the DATA.md example shows "long"; this is the closed set the performers use
SEVERITIES = ("minor", "major")
CUE_ANIMS = ("lights_flash", "lightning", "trapdoor", "fog", "spotlight", "curtain")  # one per cue, in CUE_IDS order
WHISPER_KINDS: tuple[str, ...] = (*T.MISHAP_KINDS, "generic")
WHISPER_CHAIN_ID = "lean_in"  # the autopilot ("autopilot":"lean_in" in shows_gold) takes this option in every kind
WHISPER_COVER_ID = "cover_up"
ROLE_SKILLS: dict[str, tuple[str, ...]] = {  # which skills make someone a *natural* lead / villain / fool
    "lead": ("drama", "romance"),
    "villain": ("menace", "drama"),
    "fool": ("comedy", "physical", "improv"),
}
PROP_IMPLIED_TAGS: dict[str, str] = {
    "sword": "sword",
    "chandelier": "chandelier",
    "goose": "goose",
}  # prop id -> required tag
BRAND_HINTS = (
    "disney",
    "muppet",
    "wes anderson",
    "goose game",
    "pixar",
    "netflix",
    "google",
    "harry potter",
    "star wars",
    "mickey mouse",
    "coca-cola",
    "mcdonald",
    "ikea",
    "lego",
    "nintendo",
    "batman",
)

HEX = re.compile(r"^#[0-9a-fA-F]{6}$")
SLUG = re.compile(r"^[a-z][a-z0-9_]*$")
NUMBER = (int, float)


class Issue(NamedTuple):
    ds: str
    where: str
    msg: str
    level: str  # "error" | "warning"


@dataclass
class Report:
    issues: list[Issue] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)
    skipped: list[str] = field(default_factory=list)
    rows: dict[str, int] = field(default_factory=dict)

    @property
    def errors(self) -> list[Issue]:
        return [i for i in self.issues if i.level == "error"]

    @property
    def warnings(self) -> list[Issue]:
        return [i for i in self.issues if i.level == "warning"]

    @property
    def ok(self) -> bool:
        return not self.errors

    def messages(self, level: str = "error") -> list[str]:
        return [f"{i.ds}{i.where}: {i.msg}" for i in self.issues if i.level == level]


def is_num(x: Any) -> bool:
    return isinstance(x, NUMBER) and not isinstance(x, bool)


def is_int(x: Any) -> bool:
    return isinstance(x, int) and not isinstance(x, bool)


def placeholders_in(text: str) -> tuple[set[str], str | None]:
    """The ``{names}`` in a format string, or an explanation of why it is malformed."""
    names: set[str] = set()
    try:
        for _lit, name, spec, conv in string.Formatter().parse(text):
            if name is None:
                continue
            if not name.isidentifier() or spec or conv:
                return (
                    names,
                    f"unsupported placeholder {{{name}{':' + spec if spec else ''}{'!' + conv if conv else ''}}} (use plain {{name}})",
                )
            names.add(name)
    except ValueError as exc:
        return names, f"malformed braces ({exc})"
    return names, None


# ================================================================================================================ checker
class Checker:
    def __init__(self, data: Mapping[str, Any]):
        self.data: dict[str, Any] = dict(data)
        self.report = Report()
        self._ids: dict[str, list[str]] = {}

    # ---------------------------------------------------------------------------------------------- reporting
    def err(self, ds: str, where: str, msg: str) -> None:
        self.report.issues.append(Issue(ds, where, msg, "error"))

    def warn(self, ds: str, where: str, msg: str) -> None:
        self.report.issues.append(Issue(ds, where, msg, "warning"))

    def note(self, msg: str) -> None:
        self.report.notes.append(msg)

    def has(self, name: str) -> bool:
        return name in self._ids

    def ids_of(self, name: str) -> list[str]:
        return self._ids.get(name, [])

    # ---------------------------------------------------------------------------------------------- primitives
    @staticmethod
    def w(row: Any, i: int) -> str:
        rid = row.get("id") if isinstance(row, dict) else None
        return f"[{rid if isinstance(rid, str) and rid else '#' + str(i)}]"

    def rows(self, ds: str) -> list[dict[str, Any]] | None:
        """The dataset as a list of dicts, or None (with an error) when it has the wrong shape."""
        data = self.data[ds]
        if not isinstance(data, list):
            self.err(ds, "", f"must be a JSON array, got {type(data).__name__}")
            return None
        good = True
        for i, row in enumerate(data):
            if not isinstance(row, dict):
                self.err(ds, f"[#{i}]", f"must be an object, got {type(row).__name__}")
                good = False
        if not good:
            return None
        lo, hi = COUNTS.get(ds, (0, 10**9))
        if len(data) < lo:
            self.err(ds, "", f"has {len(data)} rows, needs at least {lo}")
        elif len(data) > hi:
            self.err(ds, "", f"has {len(data)} rows, expected at most {hi}")
        return data

    def ids(self, ds: str, rows: list[dict[str, Any]]) -> list[str]:
        seen: Counter[str] = Counter()
        out: list[str] = []
        for i, row in enumerate(rows):
            rid = row.get("id")
            if not isinstance(rid, str) or not rid:
                self.err(ds, self.w(row, i), "missing string id")
                continue
            if not SLUG.match(rid):
                self.err(ds, self.w(row, i), f"id {rid!r} must be a lowercase slug (a-z, 0-9, _)")
            seen[rid] += 1
            out.append(rid)
        for rid, n in seen.items():
            if n > 1:
                self.err(ds, f"[{rid}]", f"duplicate id ({n} rows)")
        self._ids[ds] = out
        return out

    def known(self, ds: str, w: str, row: dict[str, Any], allowed: Iterable[str]) -> None:
        extra = sorted(set(row) - set(allowed))
        if extra:
            self.warn(ds, w, f"unknown field(s) {', '.join(extra)} (typo? the engine will ignore them)")

    def text(
        self,
        ds: str,
        w: str,
        obj: Any,
        key: str | int,
        *,
        ph: frozenset[str] | None = None,
        max_len: int = 140,
        warn_len: int | None = None,
        optional: bool = False,
        label: str | None = None,
    ) -> str | None:
        name = label or (f".{key}" if isinstance(key, str) else f"[{key}]")
        if isinstance(key, str):
            if not isinstance(obj, dict) or key not in obj or obj[key] is None:
                if not optional:
                    self.err(ds, w + name, "missing")
                return None
            v = obj[key]
        else:
            v = obj[key]
        return self.check_text(
            ds, w + name, v, ph=ph if ph is not None else PLACEHOLDERS.get(ds, NONE), max_len=max_len, warn_len=warn_len
        )

    def check_text(
        self, ds: str, where: str, v: Any, *, ph: frozenset[str], max_len: int, warn_len: int | None
    ) -> str | None:
        if not isinstance(v, str):
            self.err(ds, where, f"must be a string, got {type(v).__name__}")
            return None
        if not v.strip():
            self.err(ds, where, "is empty")
            return None
        if v != v.strip():
            self.warn(ds, where, "has leading/trailing whitespace")
        if "  " in v:
            self.warn(ds, where, "contains a double space")
        if re.search(r"[\x00-\x08\x0b-\x1f]", v):
            self.err(ds, where, "contains control characters")
        if re.search(r"\b(TODO|FIXME|XXX|lorem ipsum|TBD)\b", v, re.I):
            self.err(ds, where, "contains a placeholder-ish word (TODO/TBD/lorem)")
        low = v.lower()
        for hint in BRAND_HINTS:
            if re.search(rf"\b{re.escape(hint)}", low):
                self.warn(ds, where, f"mentions {hint!r}: no real people, brands or copyrighted lines")
        if len(v) > max_len:
            self.err(ds, where, f"is {len(v)} chars, limit is {max_len}")
        elif warn_len is not None and len(v) > warn_len:
            self.warn(ds, where, f"is {len(v)} chars; aim for <= {warn_len}")
        names, problem = placeholders_in(v)
        if problem:
            self.err(ds, where, problem)
        bad = sorted(names - ph)
        if bad:
            allowed = ", ".join("{" + p + "}" for p in sorted(ph)) or "none"
            self.err(
                ds, where, f"unknown placeholder(s) {', '.join('{' + b + '}' for b in bad)} (allowed here: {allowed})"
            )
        return v

    def num(
        self,
        ds: str,
        w: str,
        row: dict[str, Any],
        key: str,
        lo: float,
        hi: float,
        *,
        integer: bool = False,
        optional: bool = False,
    ) -> float | None:
        if key not in row or row[key] is None:
            if not optional:
                self.err(ds, f"{w}.{key}", "missing")
            return None
        v = row[key]
        if not (is_int(v) if integer else is_num(v)):
            self.err(ds, f"{w}.{key}", f"must be {'an integer' if integer else 'a number'}, got {v!r}")
            return None
        if not lo <= v <= hi:
            self.err(ds, f"{w}.{key}", f"{v} is outside {lo}..{hi}")
        return v

    def choice(
        self,
        ds: str,
        w: str,
        row: dict[str, Any],
        key: str,
        vocab: Iterable[str],
        *,
        nullable: bool = False,
        optional: bool = False,
    ) -> str | None:
        if key not in row:
            if not optional:
                self.err(ds, f"{w}.{key}", "missing")
            return None
        v = row[key]
        if v is None and nullable:
            return None
        vocab = tuple(vocab)
        if not isinstance(v, str) or v not in vocab:
            self.err(ds, f"{w}.{key}", f"{v!r} is not one of {', '.join(vocab)}")
            return None
        return v

    def listf(
        self, ds: str, w: str, row: dict[str, Any], key: str, lo: int, hi: int, *, optional: bool = False
    ) -> list[Any] | None:
        if key not in row or row[key] is None:
            if not optional:
                self.err(ds, f"{w}.{key}", "missing")
            return None
        v = row[key]
        if not isinstance(v, list):
            self.err(ds, f"{w}.{key}", f"must be a list, got {type(v).__name__}")
            return None
        if not lo <= len(v) <= hi:
            self.err(ds, f"{w}.{key}", f"has {len(v)} items, needs {lo}..{hi}")
        return v

    def vocab_list(
        self,
        ds: str,
        w: str,
        row: dict[str, Any],
        key: str,
        vocab: Iterable[str],
        lo: int,
        hi: int,
        *,
        what: str = "tag",
        unique: bool = True,
        optional: bool = False,
    ) -> list[str]:
        v = self.listf(ds, w, row, key, lo, hi, optional=optional)
        if v is None:
            return []
        vocab = tuple(vocab)
        good: list[str] = []
        for item in v:
            if not isinstance(item, str) or item not in vocab:
                hint = (
                    f" (not in the {what} vocabulary: {', '.join(vocab)})"
                    if len(vocab) <= 40
                    else f" (not a known {what})"
                )
                self.err(ds, f"{w}.{key}", f"{item!r}{hint}")
            else:
                good.append(item)
        if unique and len(set(good)) != len(good):
            dupes = sorted(x for x, n in Counter(good).items() if n > 1)
            self.err(ds, f"{w}.{key}", f"duplicate entries: {', '.join(dupes)}")
        return good

    def hexcolor(self, ds: str, w: str, obj: Any, key: str, *, where: str | None = None) -> None:
        v = obj.get(key) if isinstance(obj, dict) else None
        if not isinstance(v, str) or not HEX.match(v):
            self.err(ds, where or f"{w}.{key}", f"must be a #rrggbb colour, got {v!r}")

    def palette(
        self, ds: str, w: str, row: dict[str, Any], keys: Iterable[str], key: str = "palette", *, exact: bool = True
    ) -> None:
        pal = row.get(key)
        if not isinstance(pal, dict):
            self.err(ds, f"{w}.{key}", "missing or not an object")
            return
        keys = tuple(keys)
        for k in keys:
            self.hexcolor(ds, w, pal, k, where=f"{w}.{key}.{k}")
        extra = sorted(set(pal) - set(keys))
        if extra and exact:
            self.warn(ds, f"{w}.{key}", f"unknown palette key(s) {', '.join(extra)}")

    def obj(self, ds: str, w: str, row: dict[str, Any], key: str, *, optional: bool = False) -> dict[str, Any] | None:
        v = row.get(key)
        if v is None:
            if not optional:
                self.err(ds, f"{w}.{key}", "missing")
            return None
        if not isinstance(v, dict):
            self.err(ds, f"{w}.{key}", f"must be an object, got {type(v).__name__}")
            return None
        return v

    def required_ids(self, ds: str, ids: list[str], required: Iterable[str]) -> None:
        missing = [r for r in required if r not in ids]
        if missing:
            self.err(ds, "", f"missing required id(s): {', '.join(missing)}")

    def string_list(
        self,
        ds: str,
        w: str,
        row: dict[str, Any],
        key: str,
        lo: int,
        hi: int,
        *,
        max_len: int = 140,
        warn_len: int | None = None,
        ph: frozenset[str] | None = None,
        optional: bool = False,
    ) -> list[str]:
        v = self.listf(ds, w, row, key, lo, hi, optional=optional)
        if v is None:
            return []
        out = []
        for j, item in enumerate(v):
            t = self.check_text(
                ds,
                f"{w}.{key}[{j}]",
                item,
                ph=ph if ph is not None else PLACEHOLDERS.get(ds, NONE),
                max_len=max_len,
                warn_len=warn_len,
            )
            if t is not None:
                out.append(t)
        if len({s.strip().lower() for s in out}) != len(out):
            self.warn(ds, f"{w}.{key}", "contains duplicate entries")
        return out

    # ---------------------------------------------------------------------------------------------- 1. performers
    def check_performers(self, rows: list[dict[str, Any]]) -> None:
        ds = "performers"
        ids = self.ids(ds, rows)
        self.required_ids(ds, ids, REQUIRED_PERFORMERS)
        extra = [i for i in ids if i not in REQUIRED_PERFORMERS]
        if extra:
            self.warn(ds, "", f"extra performer id(s) {', '.join(extra)}: DATA.md fixes the cast at eight")
        allowed = {
            "id",
            "name",
            "kind",
            "blurb",
            "palette",
            "build",
            "skills",
            "stage_fright",
            "roles",
            "flaws",
            "voice",
            "bio_seed",
        }
        by_id = {r["id"]: r for r in rows if isinstance(r.get("id"), str)}
        for i, row in enumerate(rows):
            w = self.w(row, i)
            self.known(ds, w, row, allowed)
            self.text(ds, w, row, "name", max_len=40)
            self.text(ds, w, row, "kind", max_len=24)
            self.text(ds, w, row, "blurb", max_len=140, warn_len=120)
            self.text(ds, w, row, "bio_seed", max_len=100)
            self.palette(ds, w, row, ("body", "accent", "hair"))
            build = self.obj(ds, w, row, "build")
            if build is not None:
                self.choice(ds, f"{w}.build", build, "head", T.HEADS)
                self.num(ds, f"{w}.build", build, "height", 0.6, 1.4)
                self.choice(ds, f"{w}.build", build, "arms", ARMS)
                self.choice(ds, f"{w}.build", build, "costume", T.COSTUMES)
                self.num(ds, f"{w}.build", build, "strings", 3, 7, integer=True)
            skills = self.obj(ds, w, row, "skills")
            if skills is not None:
                missing = [s for s in T.SKILLS if s not in skills]
                if missing:
                    self.err(ds, f"{w}.skills", f"missing skill(s): {', '.join(missing)}")
                extra_s = sorted(set(skills) - set(T.SKILLS))
                if extra_s:
                    self.err(
                        ds, f"{w}.skills", f"unknown skill(s) {', '.join(extra_s)} (vocabulary: {', '.join(T.SKILLS)})"
                    )
                for s in T.SKILLS:
                    if s in skills:
                        self.num(ds, f"{w}.skills", skills, s, 0, 100, integer=True)
            self.num(ds, w, row, "stage_fright", 10, 70, integer=True)
            roles = self.vocab_list(ds, w, row, "roles", T.ROLES, 0, 3, what="role")
            if row.get("id") == "gus" and roles:
                self.err(ds, w, "the understudy has roles [] (he is treated as 75 roleFit everywhere)")
            if row.get("id") != "gus" and isinstance(row.get("roles"), list) and not roles:
                self.err(ds, f"{w}.roles", "needs at least one role (only gus has [])")
            flaw_ids = self.listf(ds, w, row, "flaws", 1, 2)
            for fid in flaw_ids or []:
                if not isinstance(fid, str) or not SLUG.match(fid):
                    self.err(ds, f"{w}.flaws", f"{fid!r} must be a flaw id (checked against flaws.json below)")
            voice = self.obj(ds, w, row, "voice")
            if voice is not None:
                self.text(ds, f"{w}.voice", voice, "tone", max_len=70)
                self.string_list(ds, f"{w}.voice", voice, "catchphrases", 1, 4, max_len=100)
                self.string_list(ds, f"{w}.voice", voice, "tics", 1, 3, max_len=100, optional=True)
        # --- cast-wide balance
        if "gus" in by_id:
            gus = by_id["gus"]
            if "never_been_on_stage" not in (gus.get("flaws") or []):
                self.err(ds, "[gus].flaws", "the understudy's flaw must include never_been_on_stage")
        for role in T.ROLES:
            cands = [
                r["id"]
                for r in rows
                if isinstance(r.get("roles"), list) and role in r["roles"] and isinstance(r.get("id"), str)
            ]
            if len(cands) < 3:
                self.err(
                    ds,
                    "",
                    f"role {role!r} has {len(cands)} natural candidate(s) ({', '.join(cands) or 'none'}); needs >= 3",
                )
            for cid in cands:
                sk = by_id[cid].get("skills") if isinstance(by_id[cid].get("skills"), dict) else {}
                best = max((sk.get(s, 0) for s in ROLE_SKILLS[role] if is_num(sk.get(s))), default=0)
                if best < 55:
                    self.warn(
                        ds,
                        f"[{cid}]",
                        f"is a natural {role} but their best {role} skill ({'/'.join(ROLE_SKILLS[role])}) is only {best}",
                    )
            self.note(f"role {role}: natural candidates = {', '.join(cands)}")
        # dominance: nobody top in >= 4 of the 6 skills
        tops: Counter[str] = Counter()
        means: dict[str, float] = {}
        for s in T.SKILLS:
            vals = {
                r["id"]: r["skills"][s]
                for r in rows
                if isinstance(r.get("skills"), dict) and is_num(r["skills"].get(s)) and isinstance(r.get("id"), str)
            }
            if vals:
                best = max(vals.values())
                for pid, v in vals.items():
                    if v == best:
                        tops[pid] += 1
        for r in rows:
            if isinstance(r.get("skills"), dict) and isinstance(r.get("id"), str):
                vs = [r["skills"][s] for s in T.SKILLS if is_num(r["skills"].get(s))]
                if vs:
                    means[r["id"]] = sum(vs) / len(vs)
        for pid, n in tops.items():
            if n >= 4:
                self.err(ds, f"[{pid}]", f"is the best at {n} of 6 skills: nobody may dominate the roster")
        for pid, m in means.items():
            if pid != "gus" and not 38 <= m <= 62:
                self.warn(ds, f"[{pid}]", f"mean skill {m:.0f} is outside 38..62 (too weak / too strong overall)")
            sk = by_id[pid].get("skills", {})
            if pid != "gus" and is_num(sk.get("drama")):
                vals = [sk[s] for s in T.SKILLS if is_num(sk.get(s))]
                if vals and max(vals) < 65:
                    self.warn(ds, f"[{pid}]", f"has no real strength (best skill {max(vals)} < 65)")
                if vals and min(vals) > 35:
                    self.warn(ds, f"[{pid}]", f"has no real weakness (worst skill {min(vals)} > 35)")
        if means:
            self.note(
                "mean skill: " + ", ".join(f"{p} {m:.0f}" for p, m in sorted(means.items(), key=lambda kv: -kv[1]))
            )
            self.note("best-at-skill counts: " + (", ".join(f"{p} {n}" for p, n in tops.most_common()) or "none"))
        fears = {
            r["id"]: r["stage_fright"] for r in rows if is_int(r.get("stage_fright")) and isinstance(r.get("id"), str)
        }
        if fears:
            self.note("stage fright: " + ", ".join(f"{p} {v}" for p, v in sorted(fears.items(), key=lambda kv: kv[1])))

    # ---------------------------------------------------------------------------------------------- 2. staff
    def check_staff(self, rows: list[dict[str, Any]]) -> None:
        ds = "staff"
        ids = self.ids(ds, rows)
        self.required_ids(ds, ids, REQUIRED_STAFF)
        allowed = {"id", "name", "job", "kind", "palette", "voice", "emoji", "style", "favours", "blurb"}
        for i, row in enumerate(rows):
            w = self.w(row, i)
            self.known(ds, w, row, allowed)
            self.text(ds, w, row, "name", max_len=50)
            self.text(ds, w, row, "job", max_len=70)
            self.text(ds, w, row, "kind", max_len=24)
            self.text(ds, w, row, "emoji", max_len=8)
            pal = self.obj(ds, w, row, "palette")
            if pal is not None:
                if len(pal) < 2:
                    self.err(ds, f"{w}.palette", "needs at least two colours")
                for k in pal:
                    self.hexcolor(ds, w, pal, k, where=f"{w}.palette.{k}")
            voice = self.obj(ds, w, row, "voice")
            if voice is not None:
                self.text(ds, f"{w}.voice", voice, "tone", max_len=70)
                self.string_list(ds, f"{w}.voice", voice, "catchphrases", 1, 5, max_len=100)
            if row.get("id") in QUILLS:
                if row.get("kind") != "heron":
                    self.err(ds, f"{w}.kind", "the three Quills have kind 'heron'")
                self.text(ds, w, row, "style", max_len=160)
                if "favours" in row:
                    self.vocab_list(ds, w, row, "favours", T.TAGS, 2, 6)
            elif "style" in row:
                self.text(ds, w, row, "style", max_len=160)
        by_id = {r.get("id"): r for r in rows}
        if "clipboard" in by_id and isinstance(by_id["clipboard"].get("voice"), dict):
            for line in by_id["clipboard"]["voice"].get("catchphrases") or []:
                if isinstance(line, str) and not re.search(r"\d", line):
                    self.warn(ds, "[clipboard]", f"{line!r}: the stage manager speaks only in cue numbers")

    # ---------------------------------------------------------------------------------------------- 3. flaws
    def check_flaws(self, rows: list[dict[str, Any]]) -> None:
        ds = "flaws"
        ids = self.ids(ds, rows)
        for fid in REQUIRED_FLAWS:
            if fid not in ids:
                self.err(ds, "", f"missing required flaw {fid!r} (DATA.md section 3 examples)")
        for i, row in enumerate(rows):
            w = self.w(row, i)
            self.known(ds, w, row, {"id", "name", "text", "triggers", "intensity", "kinds"})
            self.text(ds, w, row, "name", max_len=40)
            self.text(ds, w, row, "text", max_len=140, warn_len=120)
            self.vocab_list(ds, w, row, "triggers", T.TAGS, 2, 5)
            self.num(ds, w, row, "intensity", 0.2, 0.7)
            self.vocab_list(ds, w, row, "kinds", T.MISHAP_KINDS, 1, 4, what="mishap kind")
        self.note(
            f"flaws: {len(rows)}; intensity mean {sum(r['intensity'] for r in rows if is_num(r.get('intensity'))) / max(1, len(rows)):.2f}"
        )

    # ---------------------------------------------------------------------------------------------- 4. mishaps
    def check_mishaps(self, rows: list[dict[str, Any]]) -> None:
        ds = "mishaps"
        self.ids(ds, rows)
        titles: Counter[str] = Counter()
        texts: Counter[str] = Counter()
        for i, row in enumerate(rows):
            w = self.w(row, i)
            self.known(
                ds, w, row, {"id", "flaw", "kind", "severity", "title", "text", "tags", "effects", "calamity", "anim"}
            )
            if not isinstance(row.get("flaw"), str) or not row.get("flaw"):
                self.err(ds, f"{w}.flaw", "missing")
            self.choice(ds, w, row, "kind", T.MISHAP_KINDS)
            self.choice(ds, w, row, "severity", SEVERITIES)
            title = self.text(ds, w, row, "title", max_len=60, warn_len=46)
            text = self.text(ds, w, row, "text", max_len=220, warn_len=150)
            if title:
                titles[title.lower()] += 1
            if text:
                texts[text.lower()] += 1
                if "{actor}" not in text:
                    self.warn(ds, f"{w}.text", "never mentions {actor}")
            self.vocab_list(ds, w, row, "tags", T.TAGS, 1, 4)
            eff = self.obj(ds, w, row, "effects")
            if eff is not None:
                self.num(ds, f"{w}.effects", eff, "warmth", -6, 4)
                self.num(ds, f"{w}.effects", eff, "chaos", -3, 15)
                extra = sorted(set(eff) - {"warmth", "chaos"})
                if extra:
                    self.warn(ds, f"{w}.effects", f"unknown effect key(s) {', '.join(extra)}")
                if row.get("severity") == "minor" and is_num(eff.get("chaos")) and eff["chaos"] > 7:
                    self.warn(
                        ds,
                        f"{w}.effects",
                        f"minor mishap with chaos {eff['chaos']}: Madame handles minors, keep them small",
                    )
                if row.get("severity") == "major" and is_num(eff.get("chaos")) and eff["chaos"] < 5:
                    self.warn(
                        ds,
                        f"{w}.effects",
                        f"major mishap with chaos {eff['chaos']}: the stage freezes for this one, make it count",
                    )
            self.choice(ds, w, row, "calamity", T.CALAMITIES)
            self.choice(ds, w, row, "anim", T.ANIMS)
        for t, n in titles.items():
            if n > 1:
                self.warn(ds, "", f"title {t!r} is used by {n} mishaps")
        for t, n in texts.items():
            if n > 1:
                self.err(ds, "", f"identical text used by {n} mishaps: {t[:50]!r}...")
        # coverage
        by_cal = Counter(r.get("calamity") for r in rows if isinstance(r.get("calamity"), str))
        for cal in T.CALAMITIES:
            if cal not in by_cal:
                self.err(
                    ds,
                    "",
                    f"calamity {cal!r} is never used (every one of the {len(T.CALAMITIES)} calamities needs >= 1 mishap)",
                )
        by_kind = Counter(r.get("kind") for r in rows if isinstance(r.get("kind"), str))
        for kind in T.MISHAP_KINDS:
            if by_kind[kind] == 0:
                self.err(ds, "", f"mishap kind {kind!r} is never used")
            elif by_kind[kind] < 3:
                self.warn(ds, "", f"mishap kind {kind!r} has only {by_kind[kind]} mishap(s)")
        by_anim = Counter(r.get("anim") for r in rows if isinstance(r.get("anim"), str))
        for anim in T.ANIMS:
            if by_anim[anim] == 0:
                self.warn(ds, "", f"anim {anim!r} is never used")
        sev = Counter(r.get("severity") for r in rows)
        if rows and not 0.25 <= sev["major"] / len(rows) <= 0.6:
            self.warn(ds, "", f"{sev['major']} of {len(rows)} mishaps are major; aim for roughly 30-55%")
        self.note(
            f"mishaps: {len(rows)} ({sev['minor']} minor / {sev['major']} major); calamities {len(by_cal)}/{len(T.CALAMITIES)}; "
            f"top calamities: {', '.join(f'{c} {n}' for c, n in by_cal.most_common(4))}"
        )
        self.note("mishap kinds: " + ", ".join(f"{k} {by_kind[k]}" for k in T.MISHAP_KINDS))

    # ---------------------------------------------------------------------------------------------- 5. whispers
    def check_whispers(self, rows: list[dict[str, Any]]) -> None:
        ds = "whispers"
        kinds = []
        for i, row in enumerate(rows):
            k = row.get("kind")
            w = f"[{k if isinstance(k, str) else '#' + str(i)}]"
            self.known(ds, w, row, {"kind", "options"})
            if not isinstance(k, str) or k not in WHISPER_KINDS:
                self.err(ds, w, f"kind {k!r} must be a mishap kind or 'generic' ({', '.join(WHISPER_KINDS)})")
                continue
            kinds.append(k)
            opts = self.listf(ds, w, row, "options", 3, 3)
            if opts is None:
                continue
            chain = cover = 0
            oids: list[str] = []
            kw_seen: dict[str, str] = {}
            for j, op in enumerate(opts):
                if not isinstance(op, dict):
                    self.err(ds, f"{w}.options[{j}]", "must be an object")
                    continue
                oid = op.get("id")
                ow = f"{w}.{oid if isinstance(oid, str) else '#' + str(j)}"
                self.known(ds, ow, op, {"id", "label", "hint", "effects", "adds_tag", "chain", "line", "keywords"})
                if not isinstance(oid, str) or not SLUG.match(oid):
                    self.err(ds, ow, f"option id {oid!r} must be a lowercase slug")
                else:
                    oids.append(oid)
                self.text(ds, ow, op, "label", max_len=28)
                self.text(ds, ow, op, "hint", max_len=60)
                self.text(ds, ow, op, "line", max_len=140, warn_len=110)
                self.choice(ds, ow, op, "adds_tag", T.TAGS, nullable=True)
                if not isinstance(op.get("chain"), bool):
                    self.err(ds, f"{ow}.chain", f"must be true or false, got {op.get('chain')!r}")
                eff = self.obj(ds, ow, op, "effects")
                warm = chaos = None
                if eff is not None:
                    warm = self.num(ds, f"{ow}.effects", eff, "warmth", -6, 8)
                    chaos = self.num(ds, f"{ow}.effects", eff, "chaos", -12, 10)
                    extra = sorted(set(eff) - {"warmth", "chaos"})
                    if extra:
                        self.warn(ds, f"{ow}.effects", f"unknown effect key(s) {', '.join(extra)}")
                if op.get("chain") is True:
                    chain += 1
                    if oid != WHISPER_CHAIN_ID:
                        self.err(
                            ds,
                            ow,
                            f"the chain:true option must have id {WHISPER_CHAIN_ID!r} (the autopilot picks it by id)",
                        )
                    if chaos is not None and chaos <= 0:
                        self.err(
                            ds, f"{ow}.effects", "the yes-and option should raise chaos (> 0): it is the risky one"
                        )
                if is_num(chaos) and chaos <= -5:
                    cover += 1
                    if oid != WHISPER_COVER_ID:
                        self.err(ds, ow, f"the chaos-reducing (<= -5) option must have id {WHISPER_COVER_ID!r}")
                    if op.get("chain") is True:
                        self.err(ds, ow, "cannot be both chain:true and chaos <= -5")
                    if is_num(warm) and warm > 1:
                        self.warn(
                            ds, f"{ow}.effects", "a cover-up that makes the room warmer is too good; keep warmth <= 1"
                        )
                if "keywords" in op:
                    kws = self.listf(ds, ow, op, "keywords", 1, 14)
                    for kw in kws or []:
                        if not isinstance(kw, str) or not kw or kw != kw.lower() or re.search(r"\s", kw):
                            self.err(ds, f"{ow}.keywords", f"{kw!r} must be a lowercase single word")
                        elif kw in kw_seen and kw_seen[kw] != oid:
                            self.warn(ds, f"{ow}.keywords", f"{kw!r} also maps to option {kw_seen[kw]!r} in this kind")
                        elif isinstance(kw, str):
                            kw_seen[kw] = str(oid)
            if len(set(oids)) != len(oids):
                self.err(ds, w, f"option ids are not unique: {oids}")
            if chain != 1:
                self.err(ds, w, f"needs exactly one chain:true option, has {chain}")
            if cover < 1:
                self.err(ds, w, "needs a chaos-reducing option (chaos <= -5)")
            lines = [op.get("line") for op in opts if isinstance(op, dict)]
            if len(set(lines)) != len(lines):
                self.warn(ds, w, "two options share the same line")
        missing = [k for k in WHISPER_KINDS if k not in kinds]
        if missing:
            self.err(
                ds, "", f"missing whisper kind(s): {', '.join(missing)} (one entry per mishap kind plus 'generic')"
            )
        dupes = sorted(k for k, n in Counter(kinds).items() if n > 1)
        if dupes:
            self.err(ds, "", f"duplicate whisper kind(s): {', '.join(dupes)}")
        self._ids[ds] = kinds
        if len(rows) != len(WHISPER_KINDS):
            self.err(ds, "", f"has {len(rows)} entries, needs {len(WHISPER_KINDS)}")

    # ---------------------------------------------------------------------------------------------- 6. cues
    def check_cues(self, rows: list[dict[str, Any]]) -> None:
        ds = "cues"
        ids = self.ids(ds, rows)
        self.required_ids(ds, ids, CUE_IDS)
        extra = [i for i in ids if i not in CUE_IDS]
        if extra:
            self.err(ds, "", f"unexpected cue id(s): {', '.join(extra)} (exactly {', '.join(CUE_IDS)})")
        for i, row in enumerate(rows):
            w = self.w(row, i)
            self.known(
                ds, w, row, {"id", "label", "emoji", "uses", "fits", "effects", "misfire", "misfire_text", "anim"}
            )
            self.text(ds, w, row, "label", max_len=24)
            self.text(ds, w, row, "emoji", max_len=8)
            self.num(ds, w, row, "uses", 1, 3, integer=True)
            self.vocab_list(ds, w, row, "fits", T.TAGS, 3, 9)
            for key, (wlo, whi, clo, chi) in (("effects", (3, 8, -10, 0)), ("misfire", (-6, -1, 0, 8))):
                eff = self.obj(ds, w, row, key)
                if eff is not None:
                    self.num(ds, f"{w}.{key}", eff, "warmth", wlo, whi)
                    self.num(ds, f"{w}.{key}", eff, "chaos", clo, chi)
            self.text(ds, w, row, "misfire_text", max_len=140, warn_len=120)
            anim = row.get("anim")
            if not isinstance(anim, str) or not SLUG.match(anim):
                self.err(ds, f"{w}.anim", f"must be a slug, got {anim!r}")
            elif row.get("id") in CUE_IDS and anim != CUE_ANIMS[CUE_IDS.index(row["id"])]:
                self.warn(
                    ds, f"{w}.anim", f"{anim!r}: the stage knows {CUE_ANIMS[CUE_IDS.index(row['id'])]!r} for this cue"
                )

    # ---------------------------------------------------------------------------------------------- 7. genres
    def check_genres(self, rows: list[dict[str, Any]]) -> None:
        ds = "genres"
        ids = self.ids(ds, rows)
        for g in T.GENRES:
            if g not in ids:
                self.err(ds, "", f"missing genre {g!r}")
        for gid in ids:
            if gid not in T.GENRES:
                self.err(ds, f"[{gid}]", f"not in GENRES ({', '.join(T.GENRES)})")
        prop_ids = set(self.ids_of("props")) if self.has("props") else set(T.PROPS)
        ph = PLACEHOLDERS["genres"]
        variant_ids: Counter[str] = Counter()
        for i, row in enumerate(rows):
            w = self.w(row, i)
            gid = row.get("id")
            self.known(ds, w, row, {"id", "name", "blurb", "palette", "roles", "skill_by_beat", "sets", "beats"})
            self.text(ds, w, row, "name", max_len=30)
            self.text(ds, w, row, "blurb", max_len=140, warn_len=100)
            self.palette(ds, w, row, ("sky", "flat", "floor", "accent"))
            roles = self.obj(ds, w, row, "roles")
            if roles is not None:
                if set(roles) != set(T.ROLES):
                    self.err(
                        ds, f"{w}.roles", f"keys must be exactly {', '.join(T.ROLES)}, got {', '.join(sorted(roles))}"
                    )
                for r in T.ROLES:
                    if r in roles:
                        self.text(ds, f"{w}.roles", roles, r, max_len=40, ph=NONE)
            for key, vocab, what in (("skill_by_beat", T.SKILLS, "skill"), ("sets", T.SETS, "set")):
                m = self.obj(ds, w, row, key)
                if m is None:
                    continue
                if set(m) != set(T.BEATS):
                    self.err(ds, f"{w}.{key}", f"keys must be exactly {', '.join(T.BEATS)}, got {', '.join(sorted(m))}")
                for b in T.BEATS:
                    if b in m and m[b] not in vocab:
                        self.err(ds, f"{w}.{key}.{b}", f"{m[b]!r} is not a {what} ({', '.join(vocab)})")
            beats = self.obj(ds, w, row, "beats")
            if beats is None:
                continue
            if set(beats) != set(T.BEATS):
                self.err(ds, f"{w}.beats", f"keys must be exactly {', '.join(T.BEATS)}, got {', '.join(sorted(beats))}")
            for b in T.BEATS:
                variants = beats.get(b)
                if not isinstance(variants, list):
                    self.err(ds, f"{w}.beats.{b}", "must be a list of variants")
                    continue
                if not 5 <= len(variants) <= 6:
                    self.err(ds, f"{w}.beats.{b}", f"has {len(variants)} variants, needs 5-6")
                tagsets: dict[frozenset[str], str] = {}
                for j, v in enumerate(variants):
                    vw = f"{w}.beats.{b}"
                    if not isinstance(v, dict):
                        self.err(ds, f"{vw}[{j}]", "must be an object")
                        continue
                    vid = v.get("id")
                    vw = f"[{vid if isinstance(vid, str) else gid}].{b}#{j}"
                    self.known(ds, vw, v, {"id", "logline", "tags", "props", "lines"})
                    if not isinstance(vid, str) or not SLUG.match(vid):
                        self.err(ds, vw, f"variant id {vid!r} must be a lowercase slug")
                    else:
                        variant_ids[vid] += 1
                        if not vid.startswith(f"{gid}_{b}_"):
                            self.warn(ds, vw, f"variant id {vid!r} should look like {gid}_{b}_<n>")
                    self.text(ds, vw, v, "logline", max_len=140, warn_len=120, ph=ph)
                    tags = self.vocab_list(ds, vw, v, "tags", T.TAGS, 2, 3)
                    key = frozenset(tags)
                    if len(tags) >= 2 and key in tagsets:
                        self.err(
                            ds,
                            vw,
                            f"has the same tag set {sorted(key)} as {tagsets[key]} in this beat (variants need different tag sets)",
                        )
                    elif len(tags) >= 2:
                        tagsets[key] = str(vid)
                    props = self.vocab_list(ds, vw, v, "props", prop_ids, 0, 4, what="prop")
                    lines = self.listf(ds, vw, v, "lines", 3, 4)
                    speakers = []
                    uses_object = False
                    for k, ln in enumerate(lines or []):
                        if not isinstance(ln, dict):
                            self.err(ds, f"{vw}.lines[{k}]", "must be an object {role, text}")
                            continue
                        self.known(ds, f"{vw}.lines[{k}]", ln, {"role", "text"})
                        role = self.choice(ds, f"{vw}.lines[{k}]", ln, "role", T.ROLES)
                        if role:
                            speakers.append(role)
                        t = self.text(ds, f"{vw}.lines[{k}]", ln, "text", max_len=140, warn_len=125, ph=ph)
                        if t and "{object}" in t:
                            uses_object = True
                    lg = v.get("logline")
                    if isinstance(lg, str) and "{object}" in lg:
                        uses_object = True
                    if uses_object and not props:
                        self.err(ds, vw, "uses {object} but lists no props to fill it")
                    if lines and len(set(speakers)) < 2:
                        self.warn(ds, vw, "only one role speaks; give the others a line")
        for vid, n in variant_ids.items():
            if n > 1:
                self.err(ds, f"[{vid}]", f"duplicate variant id ({n} times)")
        self._ids["genres.variants"] = list(variant_ids)

    # ---------------------------------------------------------------------------------------------- 8. towns
    def check_towns(self, rows: list[dict[str, Any]]) -> None:
        ds = "towns"
        ids = self.ids(ds, rows)
        if T.SPECIAL_TOWN not in ids:
            self.err(ds, "", f"the special town {T.SPECIAL_TOWN!r} is missing")
        taste_ids = set(self.ids_of("tastes")) if self.has("tastes") else None
        expects: Counter[str] = Counter()
        skies: Counter[str] = Counter()
        marks: Counter[str] = Counter()
        favours: Counter[str] = Counter()
        scorns: Counter[str] = Counter()
        for i, row in enumerate(rows):
            w = self.w(row, i)
            self.known(ds, w, row, {"id", "name", "blurb", "sky", "landmark", "temperament", "audience", "gossip"})
            self.text(ds, w, row, "name", max_len=50)
            self.text(ds, w, row, "blurb", max_len=100, warn_len=80)
            self.text(ds, w, row, "gossip", max_len=200, warn_len=150)
            sky = self.choice(ds, w, row, "sky", T.SKIES)
            mark = self.choice(ds, w, row, "landmark", T.LANDMARKS)
            if sky:
                skies[sky] += 1
            if mark:
                marks[mark] += 1
            temp = self.obj(ds, w, row, "temperament")
            if temp is not None:
                self.known(ds, f"{w}.temperament", temp, {"likes", "hates", "expects", "openness", "favours", "scorns"})
                fav = self.choice(ds, f"{w}.temperament", temp, "favours", T.GENRES)
                sco = self.choice(ds, f"{w}.temperament", temp, "scorns", T.GENRES)
                if fav:
                    favours[fav] += 1
                if sco:
                    scorns[sco] += 1
                if fav and fav == sco:
                    self.err(ds, f"{w}.temperament", f"a town cannot both favour and scorn {fav!r}")
                likes = self.vocab_list(ds, f"{w}.temperament", temp, "likes", T.TAGS, 1, 3)
                hates = self.vocab_list(ds, f"{w}.temperament", temp, "hates", T.TAGS, 1, 3)
                both = sorted(set(likes) & set(hates))
                if both:
                    self.err(
                        ds, f"{w}.temperament", f"likes and hates must be disjoint, both contain: {', '.join(both)}"
                    )
                exp = self.choice(ds, f"{w}.temperament", temp, "expects", T.CALAMITIES, nullable=True)
                if exp:
                    expects[exp] += 1
                self.num(ds, f"{w}.temperament", temp, "openness", 0, 1)
            aud = self.obj(ds, w, row, "audience")
            if aud is not None:
                self.known(ds, f"{w}.audience", aud, {"mix", "hat_bias"})
                mix = self.listf(ds, f"{w}.audience", aud, "mix", 2, 8)
                for m in mix or []:
                    if not isinstance(m, str) or not m:
                        self.err(ds, f"{w}.audience.mix", f"{m!r} must be a taste id")
                    elif taste_ids is not None and m not in taste_ids:
                        self.err(ds, f"{w}.audience.mix", f"unknown taste {m!r} (not in tastes.json)")
                self.choice(ds, f"{w}.audience", aud, "hat_bias", T.HATS)
        # the special town, exactly as DATA.md fixes it
        for row in rows:
            if row.get("id") == T.SPECIAL_TOWN:
                temp = row.get("temperament") if isinstance(row.get("temperament"), dict) else {}
                if sorted(temp.get("likes") or []) != sorted(["song", "crown", "speech"]):
                    self.err(ds, f"[{T.SPECIAL_TOWN}]", "likes must be exactly [song, crown, speech]")
                if sorted(temp.get("hates") or []) != sorted(["goose", "slapstick"]):
                    self.err(ds, f"[{T.SPECIAL_TOWN}]", "hates must be exactly [goose, slapstick]")
                if temp.get("expects") != "the_chandelier":
                    self.err(ds, f"[{T.SPECIAL_TOWN}]", "expects must be 'the_chandelier'")
                if temp.get("openness") != 0.2:
                    self.err(ds, f"[{T.SPECIAL_TOWN}]", "openness must be 0.2")
        if rows:
            # no genre may be right everywhere (a fun audit found gothic romance best in 30 of 30 towns)
            for kind, counts in (("favoured", favours), ("scorned", scorns)):
                for g in T.GENRES:
                    if not 3 <= counts[g] <= 8:
                        self.err(ds, "", f"genre {g!r} is {kind} by {counts[g]} towns; every genre needs 3 to 8 so the choice of genre is a decision")
            n_expect = sum(expects.values())
            if n_expect < 12:
                self.warn(
                    ds,
                    "",
                    f"only {n_expect} towns expect a calamity; Traditions matter more if most of them do (aim for >= 12)",
                )
            for sky in T.SKIES:
                if skies[sky] == 0:
                    self.warn(ds, "", f"no town has sky {sky!r}")
            for mark in T.LANDMARKS:
                if marks[mark] == 0:
                    self.warn(ds, "", f"no town has landmark {mark!r}")
            self.note(f"towns: {len(rows)}; {n_expect} expect a calamity; skies {dict(skies)}")

    # ---------------------------------------------------------------------------------------------- 9. tastes
    def check_tastes(self, rows: list[dict[str, Any]]) -> None:
        ds = "tastes"
        ids = self.ids(ds, rows)
        self.required_ids(ds, ids, REQUIRED_TASTES)
        for i, row in enumerate(rows):
            w = self.w(row, i)
            self.known(ds, w, row, {"id", "name", "hat", "palette", "likes", "hates", "laugh", "cry", "gasp", "boo"})
            self.text(ds, w, row, "name", max_len=50)
            self.choice(ds, w, row, "hat", T.HATS)
            self.palette(ds, w, row, ("coat", "skin"))
            likes = self.vocab_list(ds, w, row, "likes", T.TAGS, 1, 4)
            hates = self.vocab_list(ds, w, row, "hates", T.TAGS, 0, 3)
            both = sorted(set(likes) & set(hates))
            if both:
                self.err(ds, w, f"likes and hates overlap: {', '.join(both)}")
            for k in ("laugh", "cry", "gasp", "boo"):
                self.num(ds, w, row, k, 0, 1)

    # ---------------------------------------------------------------------------------------------- 10. critics
    def check_critics(self, rows: list[dict[str, Any]]) -> None:
        ds = "critics"
        ids = self.ids(ds, rows)
        self.required_ids(ds, ids, CRITIC_IDS)
        ph = PLACEHOLDERS["critics"]
        for i, row in enumerate(rows):
            w = self.w(row, i)
            self.known(ds, w, row, {"id", "name", "outlet", "style", "weights", "bias", "noise", "templates", "emoji"})
            self.text(ds, w, row, "name", max_len=50)
            self.text(ds, w, row, "outlet", max_len=50)
            self.text(ds, w, row, "style", max_len=60)
            weights = self.obj(ds, w, row, "weights")
            if weights is not None:
                if set(weights) != set(CRITIC_WEIGHTS):
                    self.err(
                        ds,
                        f"{w}.weights",
                        f"keys must be exactly {', '.join(CRITIC_WEIGHTS)}, got {', '.join(sorted(weights))}",
                    )
                for k in CRITIC_WEIGHTS:
                    if k in weights:
                        self.num(ds, f"{w}.weights", weights, k, 0, 1)
                tot = sum(v for v in weights.values() if is_num(v))
                if not 0.5 <= tot <= 1.5:
                    self.warn(ds, f"{w}.weights", f"weights sum to {tot:.2f}; aim for roughly 1")
            self.num(ds, w, row, "bias", -1, 1)
            self.num(ds, w, row, "noise", 0, 1)
            tpl = self.obj(ds, w, row, "templates")
            if tpl is None:
                continue
            if set(tpl) != {"1", "2", "3", "4", "5"}:
                self.err(ds, f"{w}.templates", f"keys must be exactly '1'..'5', got {', '.join(sorted(map(str, tpl)))}")
            for star in ("1", "2", "3", "4", "5"):
                if star not in tpl:
                    continue
                lines = tpl[star]
                if not isinstance(lines, list) or len(lines) < 4:
                    self.err(
                        ds,
                        f"{w}.templates.{star}",
                        f"needs a list of >= 4 templates, has {len(lines) if isinstance(lines, list) else lines!r}",
                    )
                    continue
                for j, line in enumerate(lines):
                    t = self.check_text(ds, f"{w}.templates.{star}[{j}]", line, ph=ph, max_len=200, warn_len=None)
                    if t:
                        words = len(re.sub(r"\{[a-z_]+\}", "word", t).split())
                        if words > 28 or words < 5:
                            self.warn(ds, f"{w}.templates.{star}[{j}]", f"{words} words (aim for ~8-20)")
                if len({str(x).strip().lower() for x in lines}) != len(lines):
                    self.warn(ds, f"{w}.templates.{star}", "contains duplicate templates")

    # ---------------------------------------------------------------------------------------------- 11. playbill
    def check_playbill(self, data: Any) -> None:
        ds = "playbill"
        if not isinstance(data, dict):
            self.err(ds, "", f"must be a JSON object, got {type(data).__name__}")
            return
        self.known(ds, "", data, {"bio", "headings", "back_page", "tonight_in", "previously"})
        bio = data.get("bio")
        if not isinstance(bio, dict):
            self.err(ds, ".bio", "missing or not an object with openers/trained_at/credits/quirks")
        else:
            self.known(ds, ".bio", bio, {"openers", "trained_at", "credits", "quirks"})
            for k in ("openers", "trained_at", "credits", "quirks"):
                self.string_list(ds, ".bio", bio, k, 10, 60, max_len=140, warn_len=110)
        for k in ("headings", "back_page", "tonight_in", "previously"):
            self.string_list(ds, "", data, k, 4, 80, max_len=160, warn_len=130)
        total = sum(len(v) for v in data.values() if isinstance(v, list)) + sum(
            len(v) for v in (bio or {}).values() if isinstance(v, list)
        )
        self.report.rows[ds] = len(data)
        self.note(f"playbill: {total} strings")

    # ---------------------------------------------------------------------------------------------- 12. road events
    def check_road_events(self, rows: list[dict[str, Any]]) -> None:
        ds = "road_events"
        self.ids(ds, rows)
        performers = set(self.ids_of("performers"))
        for i, row in enumerate(rows):
            w = self.w(row, i)
            self.known(ds, w, row, {"id", "title", "text", "weight", "choices"})
            self.text(ds, w, row, "title", max_len=60, warn_len=46)
            self.text(ds, w, row, "text", max_len=220, warn_len=170)
            self.num(ds, w, row, "weight", 1, 5, integer=True)
            choices = self.listf(ds, w, row, "choices", 2, 3)
            cids: list[str] = []
            for j, ch in enumerate(choices or []):
                if not isinstance(ch, dict):
                    self.err(ds, f"{w}.choices[{j}]", "must be an object")
                    continue
                cid = ch.get("id")
                cw = f"{w}.{cid if isinstance(cid, str) else 'choice#' + str(j)}"
                self.known(ds, cw, ch, {"id", "label", "effects"})
                if not isinstance(cid, str) or not SLUG.match(cid):
                    self.err(ds, cw, f"choice id {cid!r} must be a lowercase slug")
                else:
                    cids.append(cid)
                self.text(ds, cw, ch, "label", max_len=60, warn_len=48)
                eff = self.obj(ds, cw, ch, "effects")
                if eff is None:
                    continue
                self.known(ds, f"{cw}.effects", eff, {"funds", "morale", "rapport", "encore"})
                for k, lo, hi in (("funds", -5, 5), ("morale", -3, 3), ("encore", -1, 2)):
                    if k in eff:
                        self.num(ds, f"{cw}.effects", eff, k, lo, hi, integer=True)
                rap = eff.get("rapport")
                if rap is not None:
                    if not isinstance(rap, dict):
                        self.err(ds, f"{cw}.effects.rapport", "must be a map of performer id -> int")
                    else:
                        for pid, val in rap.items():
                            if performers and pid not in performers:
                                self.err(ds, f"{cw}.effects.rapport", f"unknown performer {pid!r}")
                            if not is_int(val) or not -3 <= val <= 3:
                                self.err(ds, f"{cw}.effects.rapport.{pid}", f"{val!r} must be an integer -3..3")
            if len(set(cids)) != len(cids):
                self.err(ds, w, f"choice ids are not unique: {cids}")
            self.check_road_trade_offs(ds, w, choices or [])

    @staticmethod
    def _road_vector(choice: dict[str, Any]) -> dict[str, int]:
        """A choice's effects as one flat vector: funds, morale, encore, and one axis per performer's rapport."""
        eff = choice.get("effects") if isinstance(choice.get("effects"), dict) else {}
        vec = {k: eff[k] for k in ("funds", "morale", "encore") if is_int(eff.get(k))}
        rap = eff.get("rapport") if isinstance(eff.get("rapport"), dict) else {}
        vec.update({f"rapport:{pid}": v for pid, v in rap.items() if is_int(v)})
        return {k: v for k, v in vec.items() if v}

    def check_road_trade_offs(self, ds: str, w: str, choices: list[Any]) -> None:
        """A choice that is strictly worse than a sibling is not a choice. (A playtest found 11 of 20 events like that.)

        Option A is *dominated* by B when B is at least as good on every axis and better on one. Also: a label that announces a
        funds / Encore change in brackets must match the effect, because the player reads the label, not the JSON.
        """
        good = [c for c in choices if isinstance(c, dict) and isinstance(c.get("id"), str)]
        vecs = {c["id"]: self._road_vector(c) for c in good}
        for a in vecs:
            for b in vecs:
                if a == b:
                    continue
                axes = set(vecs[a]) | set(vecs[b])
                if all(vecs[b].get(k, 0) >= vecs[a].get(k, 0) for k in axes) and any(vecs[b].get(k, 0) > vecs[a].get(k, 0) for k in axes):
                    self.err(ds, f"{w}.{a}", f"strictly worse than {b!r} on every axis: give it its own upside, or {b!r} a cost")
        for c in good:
            label = str(c.get("label", ""))
            eff = c.get("effects") if isinstance(c.get("effects"), dict) else {}
            for pattern, key in ((r"([+-]\d+) funds?\b", "funds"), (r"([+-]\d+) Encore", "encore")):
                said = [int(m) for m in re.findall(pattern, label)]
                if said and said[0] != eff.get(key, 0):
                    self.err(ds, f"{w}.{c['id']}", f"label says {said[0]:+d} {key} but the effect is {eff.get(key, 0):+d}")

    # ---------------------------------------------------------------------------------------------- 13. almanac seeds
    def check_almanac_seeds(self, rows: list[dict[str, Any]]) -> None:
        ds = "almanac_seeds"
        self.ids(ds, rows)
        towns = set(self.ids_of("towns")) if self.has("towns") else None
        cals: Counter[str] = Counter()
        for i, row in enumerate(rows):
            w = self.w(row, i)
            self.known(ds, w, row, {"id", "text", "calamity", "town"})
            rid = row.get("id")
            if isinstance(rid, str) and not re.fullmatch(r"legend_\d{3}", rid):
                self.err(ds, w, f"id {rid!r} must look like legend_001")
            self.text(ds, w, row, "text", max_len=220, warn_len=170)
            cal = self.choice(ds, w, row, "calamity", T.CALAMITIES)
            if cal:
                cals[cal] += 1
            town = row.get("town")
            if not isinstance(town, str) or not town:
                self.err(ds, f"{w}.town", "missing")
            elif towns is not None and town not in towns:
                self.err(ds, f"{w}.town", f"unknown town {town!r} (not in towns.json)")
        ordered = [r.get("id") for r in rows]
        if ordered and ordered != [f"legend_{n:03d}" for n in range(1, len(rows) + 1)]:
            self.warn(ds, "", "ids should run legend_001.. in order without gaps")
        for cal in T.CALAMITIES:
            if rows and cals[cal] == 0:
                self.warn(ds, "", f"calamity {cal!r} has no legend")
        texts = Counter(str(r.get("text", "")).lower() for r in rows)
        for t, n in texts.items():
            if n > 1:
                self.err(ds, "", f"duplicate legend text {t[:50]!r}")

    # ---------------------------------------------------------------------------------------------- 14. props
    def check_props(self, rows: list[dict[str, Any]]) -> None:
        ds = "props"
        ids = self.ids(ds, rows)
        for pid in T.PROPS:
            if pid not in ids:
                self.err(ds, "", f"missing prop {pid!r} (props.json carries exactly the {len(T.PROPS)} PROPS ids)")
        for pid in ids:
            if pid not in T.PROPS:
                self.err(ds, f"[{pid}]", f"not in PROPS ({', '.join(T.PROPS)})")
        empties = 0
        for i, row in enumerate(rows):
            w = self.w(row, i)
            self.known(ds, w, row, {"id", "name", "tags", "draw"})
            self.text(ds, w, row, "name", max_len=40, warn_len=32)
            tags = self.vocab_list(ds, w, row, "tags", T.TAGS, 0, 3)
            if not tags:
                empties += 1
            draw = self.choice(ds, w, row, "draw", T.PROPS)
            rid = row.get("id")
            if draw and rid and draw != rid:
                self.warn(ds, w, f"draws as {draw!r}; props normally draw as their own id")
            need = PROP_IMPLIED_TAGS.get(rid) or (rid if rid in T.TAGS else None)
            if need and need not in tags:
                self.err(ds, f"{w}.tags", f"must include {need!r} (the prop implies it)")
        if empties > 8:
            self.warn(ds, "", f"{empties} props have no tags; a prop tag is how props set off flaws")

    # ---------------------------------------------------------------------------------------------- 15. shows gold
    def check_shows_gold(self, rows: list[dict[str, Any]]) -> None:
        ds = "shows_gold"
        self.ids(ds, rows)
        towns = set(self.ids_of("towns")) if self.has("towns") else None
        performers = set(self.ids_of("performers")) if self.has("performers") else set(REQUIRED_PERFORMERS)
        autopilots = {"lean_in", "cover_up", "best"} | {
            o.get("id")
            for e in self.data.get("whispers", [])
            if isinstance(e, dict)
            for o in e.get("options", [])
            if isinstance(o, dict)
        }
        disasters = triumphs = 0
        for i, row in enumerate(rows):
            w = self.w(row, i)
            self.known(
                ds,
                w,
                row,
                {
                    "id",
                    "kind",
                    "seed",
                    "night",
                    "genre",
                    "town",
                    "cast",
                    "autopilot",
                    "quill",
                    "expect",
                    "label",
                    "note",
                },
            )
            if "kind" in row and row["kind"] not in ("regression", "disaster", "triumph"):
                self.err(ds, f"{w}.kind", f"{row['kind']!r} must be regression, disaster or triumph")
            rid = row.get("id")
            if isinstance(rid, str) and not re.fullmatch(r"gold_\d{3}", rid):
                self.err(ds, w, f"id {rid!r} must look like gold_001")
            self.num(ds, w, row, "seed", 0, 2**31, integer=True)
            self.num(ds, w, row, "night", 0, T.TOUR_NIGHTS - 1, integer=True)
            self.choice(ds, w, row, "genre", T.GENRES)
            town = row.get("town")
            if towns is not None and town not in towns:
                self.err(ds, f"{w}.town", f"unknown town {town!r}")
            cast = self.obj(ds, w, row, "cast")
            if cast is not None:
                if set(cast) != set(T.ROLES):
                    self.err(ds, f"{w}.cast", f"keys must be exactly {', '.join(T.ROLES)}")
                vals = [cast.get(r) for r in T.ROLES]
                if any(v not in performers for v in vals):
                    self.err(ds, f"{w}.cast", f"unknown performer in {vals}")
                if len(set(vals)) != len(vals):
                    self.err(ds, f"{w}.cast", "cast members must be distinct")
            ap = row.get("autopilot")
            if not isinstance(ap, str) or ap not in autopilots:
                self.err(ds, f"{w}.autopilot", f"{ap!r} must be a whisper option id or the policy 'best'")
            exp = self.obj(ds, w, row, "expect")
            if exp is not None:
                self.known(ds, f"{w}.expect", exp, {"mishaps_min", "stars_min", "stars_max", "calamities", "stars"})
                self.num(ds, f"{w}.expect", exp, "mishaps_min", 0, 10, integer=True)
                self.num(ds, f"{w}.expect", exp, "stars", 0, 5, optional=True)
                lo = self.num(ds, f"{w}.expect", exp, "stars_min", 0, 5)
                hi = self.num(ds, f"{w}.expect", exp, "stars_max", 0, 5)
                if is_num(lo) and is_num(hi):
                    if lo > hi:
                        self.err(ds, f"{w}.expect", f"stars_min {lo} > stars_max {hi}")
                    if hi <= 2.5:
                        disasters += 1
                    if lo >= 3.5:
                        triumphs += 1
                self.vocab_list(ds, f"{w}.expect", exp, "calamities", T.CALAMITIES, 0, 6, what="calamity")
        if rows and disasters < 6:
            self.err(ds, "", f"only {disasters} known disaster(s) (stars_max <= 2.5); needs >= 6")
        if rows and triumphs < 6:
            self.err(ds, "", f"only {triumphs} known triumph(s) (stars_min >= 3.5); needs >= 6")

    # ================================================================================================ cross checks
    def cross(self) -> None:
        d = self.data
        perf_rows = d.get("performers") if isinstance(d.get("performers"), list) else []
        flaw_rows = d.get("flaws") if isinstance(d.get("flaws"), list) else []
        mis_rows = d.get("mishaps") if isinstance(d.get("mishaps"), list) else []
        flaw_by_id = {f["id"]: f for f in flaw_rows if isinstance(f, dict) and isinstance(f.get("id"), str)}
        # global id collisions between people (the greenroom and the stage address them by id)
        staff_ids = set(self.ids_of("staff"))
        clash = staff_ids & set(self.ids_of("performers"))
        if clash:
            self.err("staff", "", f"id(s) {', '.join(sorted(clash))} are also performer ids")
        if self.has("performers") and self.has("flaws"):
            used: Counter[str] = Counter()
            for p in perf_rows:
                if not isinstance(p, dict):
                    continue
                for fid in p.get("flaws") or []:
                    if fid not in flaw_by_id:
                        self.err("performers", f"[{p.get('id')}].flaws", f"unknown flaw {fid!r} (not in flaws.json)")
                    else:
                        used[fid] += 1
            unused = [f for f in flaw_by_id if f not in used]
            if unused:
                self.note(
                    f"flaws not carried by any performer ({len(unused)}, usable as 'bad day' / guest flaws): {', '.join(unused)}"
                )
            shared = [f for f, n in used.items() if n > 1]
            if shared:
                self.warn("flaws", "", f"flaw(s) {', '.join(shared)} are carried by more than one performer")
        if self.has("flaws") and self.has("mishaps"):
            per_flaw: dict[str, list[dict[str, Any]]] = defaultdict(list)
            for m in mis_rows:
                if not isinstance(m, dict):
                    continue
                fid = m.get("flaw")
                if fid not in flaw_by_id:
                    self.err("mishaps", f"[{m.get('id')}].flaw", f"unknown flaw {fid!r} (not in flaws.json)")
                    continue
                per_flaw[fid].append(m)
                f = flaw_by_id[fid]
                if m.get("kind") in T.MISHAP_KINDS and isinstance(f.get("kinds"), list) and m["kind"] not in f["kinds"]:
                    self.err(
                        "mishaps",
                        f"[{m.get('id')}].kind",
                        f"{m['kind']!r} is not one of flaw {fid!r} kinds {f['kinds']}",
                    )
            for fid, ms_ in per_flaw.items():
                trig = (
                    set(flaw_by_id[fid].get("triggers") or [])
                    if isinstance(flaw_by_id[fid].get("triggers"), list)
                    else set()
                )
                tagged = [set(m.get("tags") or []) for m in ms_ if isinstance(m.get("tags"), list)]
                if trig and tagged and not any(t & trig for t in tagged):
                    self.warn(
                        "flaws",
                        f"[{fid}]",
                        f"none of its mishaps carry a tag from its triggers {sorted(trig)}; are they coherent?",
                    )
            for fid, f in flaw_by_id.items():
                ms = per_flaw.get(fid, [])
                if len(ms) < 2:
                    self.err("flaws", f"[{fid}]", f"has {len(ms)} mishap(s); every flaw needs >= 2")
                sev = {m.get("severity") for m in ms}
                if ms and "minor" not in sev:
                    self.err("flaws", f"[{fid}]", "has no minor mishap")
                if ms and "major" not in sev:
                    self.err("flaws", f"[{fid}]", "has no major mishap")
                kinds_used = {m.get("kind") for m in ms}
                for k in f.get("kinds") or []:
                    if k not in kinds_used and ms:
                        self.warn("flaws", f"[{fid}]", f"lists kind {k!r} but no mishap of that kind exists")
        if self.has("performers") and self.has("flaws") and self.has("mishaps"):
            carried_flaws = {
                fid for p in perf_rows if isinstance(p, dict) for fid in (p.get("flaws") or []) if isinstance(fid, str)
            }
            reach = Counter(
                m.get("calamity") for m in mis_rows if isinstance(m, dict) and m.get("flaw") in carried_flaws
            )
            stuck = [c for c in T.CALAMITIES if reach[c] == 0]
            if stuck:
                self.err(
                    "mishaps",
                    "",
                    "calamity/ies only caused by spare flaws no performer carries, so a town expecting "
                    f"them could never be satisfied: {', '.join(stuck)}",
                )
            once = [c for c in T.CALAMITIES if reach[c] == 1]
            self.note(
                f"calamities reachable through only one carried mishap ({len(once)}): {', '.join(once) or 'none'}"
            )
        if self.has("mishaps") and self.has("whispers"):
            wk = set(self.ids_of("whispers"))
            for m in mis_rows:
                if isinstance(m, dict) and m.get("kind") in T.MISHAP_KINDS and m["kind"] not in wk:
                    self.err("mishaps", f"[{m.get('id')}].kind", f"kind {m['kind']!r} has no entry in whispers.json")
        if self.has("towns") and self.has("mishaps"):
            cals = {m.get("calamity") for m in mis_rows if isinstance(m, dict)}
            for t in d.get("towns") or []:
                exp = (
                    (t.get("temperament") or {}).get("expects")
                    if isinstance(t, dict) and isinstance(t.get("temperament"), dict)
                    else None
                )
                if exp is not None and exp not in cals:
                    self.err(
                        "towns", f"[{t.get('id')}].temperament.expects", f"{exp!r} is not a calamity in mishaps.json"
                    )
        if self.has("genres"):
            self.genre_cross(flaw_by_id, perf_rows)
        if self.has("road_events") and self.has("performers"):
            pass  # rapport keys are checked in check_road_events when performers exist

    def genre_cross(self, flaw_by_id: dict[str, dict[str, Any]], perf_rows: list[Any]) -> None:
        variants: list[tuple[str, str, dict[str, Any]]] = []
        for g in self.data["genres"]:
            if not isinstance(g, dict) or not isinstance(g.get("beats"), dict):
                continue
            for b, vs in g["beats"].items():
                for v in vs if isinstance(vs, list) else []:
                    if isinstance(v, dict):
                        variants.append((str(g.get("id")), str(b), v))
        if not variants:
            return
        prop_tags: dict[str, set[str]] = {}
        if self.has("props"):
            prop_tags = {
                p["id"]: set(p.get("tags") or [])
                for p in self.data["props"]
                if isinstance(p, dict) and isinstance(p.get("id"), str)
            }
        freq: Counter[str] = Counter()
        variant_tagsets: list[set[str]] = []
        for _g, _b, v in variants:
            tags = set(v.get("tags") or []) if isinstance(v.get("tags"), list) else set()
            for pid in v.get("props") or []:
                tags |= prop_tags.get(pid, set())
            variant_tagsets.append(tags)
            freq.update(set(v.get("tags") or []) if isinstance(v.get("tags"), list) else set())
        unused_tags = [t for t in T.TAGS if freq[t] == 0 and not any(t in s for s in variant_tagsets)]
        if unused_tags:
            self.warn("genres", "", f"tag(s) never used by any beat variant or prop: {', '.join(unused_tags)}")
        # can every flaw fire?
        n = len(variants)
        rates: dict[str, float] = {}
        for fid, f in flaw_by_id.items():
            trig = set(f.get("triggers") or []) if isinstance(f.get("triggers"), list) else set()
            hits = sum(1 for s in variant_tagsets if s & trig)
            rates[fid] = hits / n
            if hits == 0:
                self.err(
                    "flaws",
                    f"[{fid}]",
                    f"triggers {sorted(trig)} appear in no beat variant or prop: this flaw can never fire",
                )
            elif rates[fid] < 0.06:
                self.warn(
                    "flaws", f"[{fid}]", f"fires in only {rates[fid]:.0%} of beat variants (triggers {sorted(trig)})"
                )
        carried = {fid for p in perf_rows if isinstance(p, dict) for fid in p.get("flaws") or []}
        for fid in carried:
            if rates.get(fid, 0) > 0.75:
                self.warn(
                    "flaws", f"[{fid}]", f"fires in {rates[fid]:.0%} of beat variants: it would trigger every night"
                )
        if rates:
            pr = []
            for p in perf_rows:
                if isinstance(p, dict) and p.get("flaws"):
                    avg = sum(rates.get(f, 0) for f in p["flaws"]) / len(p["flaws"])
                    pr.append((p.get("id"), avg))
            if pr:
                self.note(
                    "flaw exposure (share of variants that can set a puppet's flaws off): "
                    + ", ".join(f"{i} {a:.0%}" for i, a in pr)
                )
        # towns that hate something popular: the genre choice must matter
        if self.has("towns"):
            popular = {t for t, _ in freq.most_common(12)}
            count = 0
            for t in self.data["towns"]:
                temp = t.get("temperament") if isinstance(t, dict) else None
                if isinstance(temp, dict) and set(temp.get("hates") or []) & popular:
                    count += 1
            if count < 8:
                self.err(
                    "towns",
                    "",
                    f"only {count} towns hate one of the 12 most common beat tags ({', '.join(sorted(popular))}); needs >= 8",
                )
            else:
                self.note(f"towns that hate a popular beat tag: {count}")

    # ================================================================================================ driver
    def run(self) -> Report:
        for name in self.data:
            if name not in DATASET_NAMES:
                self.err(name, "", "unknown dataset name")
        order = [n for n in DATASET_NAMES if n in self.data]
        for name in order:
            if name == "playbill":
                continue
            data = self.data[name]
            self.report.rows[name] = len(data) if isinstance(data, (list, dict)) else 0
        # whispers first-class ids are kinds; run dataset checks in dependency order
        sequence = (
            "props",
            "performers",
            "staff",
            "flaws",
            "mishaps",
            "whispers",
            "cues",
            "tastes",
            "towns",
            "genres",
            "critics",
            "playbill",
            "road_events",
            "almanac_seeds",
            "shows_gold",
        )
        for name in sequence:
            if name not in self.data:
                self.report.skipped.append(name)
                continue
            try:
                if name == "playbill":
                    self.check_playbill(self.data[name])
                    continue
                rows = self.rows(name)
                if rows is not None:
                    getattr(self, f"check_{name}")(rows)
            except Exception as exc:  # the checker must never take the whole run down on weird input
                tb = traceback.extract_tb(exc.__traceback__)[-1]
                self.err(
                    name, "", f"checker crashed on malformed data: {type(exc).__name__}: {exc} (check.py:{tb.lineno})"
                )
        try:
            self.cross()
        except Exception as exc:
            tb = traceback.extract_tb(exc.__traceback__)[-1]
            self.err(
                "cross", "", f"checker crashed on malformed data: {type(exc).__name__}: {exc} (check.py:{tb.lineno})"
            )
        return self.report


def check_data(data: Mapping[str, Any]) -> Report:
    """Validate ``{dataset name: data}``. Pure: no disk, no imports of content."""
    return Checker(data).run()


# ================================================================================================================ CLI
def load_shows_gold_from_disk() -> list[dict[str, Any]] | None:
    from tragedy.data import build

    path = build.default_out() / build.file_name("shows_gold")
    if not path.exists():
        return None
    try:
        return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    except json.JSONDecodeError as exc:
        raise ValueError(f"datasets/shows_gold.jsonl is not valid JSON lines: {exc}") from exc


def _summarise_drift(diffs: list[str]) -> str:
    files = [d.split(":", 1)[0] for d in diffs]
    return f"{len(files)} file(s) missing or stale: {', '.join(files)} (run `python -m tragedy.data build`)"


def run_check(
    *, only: set[str] | None = None, files: bool = False, werror: bool = False, quiet: bool = False, out: Any = None
) -> int:
    """Collect the content modules, validate, print a report. Returns the process exit code."""
    import sys

    from tragedy.data import build

    out = out or sys.stdout
    data, problems = build.collect()
    gold_problem = None
    try:
        gold = load_shows_gold_from_disk()
        if gold is not None:
            data["shows_gold"] = gold
    except ValueError as exc:
        gold_problem = str(exc)
    report = check_data(data)
    for p in problems:
        report.issues.append(Issue("build", "", p, "error"))
    if gold_problem:
        report.issues.append(Issue("shows_gold", "", gold_problem, "error"))
    if files:
        diffs, dproblems = build.drift()
        if diffs:
            report.issues.append(Issue("datasets", "", _summarise_drift(diffs), "error"))
        for p in dproblems:
            if p not in problems:
                report.issues.append(Issue("build", "", p, "error"))
    elif data:
        diffs, _ = build.drift(skip_gold=True)
        if diffs:
            report.issues.append(Issue("datasets", "", _summarise_drift(diffs), "warning"))
    print(format_report(report, only=only, quiet=quiet), file=out)
    failed = bool(report.errors) or (werror and bool(report.warnings))
    return 1 if failed else 0


def format_report(report: Report, *, only: set[str] | None = None, quiet: bool = False) -> str:
    lines: list[str] = ["tragedy.data check", ""]
    by_ds: dict[str, list[Issue]] = defaultdict(list)
    for iss in report.issues:
        by_ds[iss.ds].append(iss)
    names = [n for n in DATASET_NAMES if n in report.rows or n in by_ds]
    names += [n for n in by_ds if n not in names]
    for name in names:
        if only and name not in only:
            continue
        issues = by_ds.get(name, [])
        errs = [i for i in issues if i.level == "error"]
        warns = [i for i in issues if i.level == "warning"]
        status = "ok" if not errs else f"{len(errs)} error(s)"
        if warns:
            status += f", {len(warns)} warning(s)"
        rows = report.rows.get(name)
        lines.append(f"  {name:<14} {(str(rows) + ' rows') if rows is not None else '':<9} {status}")
        for iss in errs:
            lines.append(f"      ERROR   {name}{iss.where}: {iss.msg}")
        if not quiet:
            for iss in warns:
                lines.append(f"      warn    {name}{iss.where}: {iss.msg}")
    if report.skipped:
        lines.append("")
        lines.append("  not written yet (skipped): " + ", ".join(report.skipped))
    if report.notes and not quiet:
        lines.append("")
        lines.append("  balance notes:")
        lines.extend(f"    - {n}" for n in report.notes)
    n_err, n_warn = len(report.errors), len(report.warnings)
    lines.append("")
    lines.append(f"RESULT: {'FAIL' if n_err else 'ok'} ({n_err} error(s), {n_warn} warning(s))")
    return "\n".join(lines)
