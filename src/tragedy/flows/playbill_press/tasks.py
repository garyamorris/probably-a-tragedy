"""The four `@task` units of `playbill_press`. Tasks return plain JSON (they are checkpointed) and are deterministic.

``bios``            one bio per cast member from the playbill.json grammar + the performer's ``bio_seed``; no part repeats within a playbill
``traditions_page`` the house's Traditions as printable lines
``review_wall``     last night's headline as the pull-quote
``layout``          assemble the playbill (title, tonight, back page, and ``previously`` from the memo)
"""

from __future__ import annotations

from typing import Any

from langgraph.func import task

from tragedy.common.rng import pick, pick_n
from tragedy.common.stream import emit
from tragedy.data.tags import ROLES
from tragedy.engine import world

BEAT_NAMES = ("The Setup", "The Complication", "The Reversal", "The Twist", "The Finale")
FALLBACK_QUOTE = "Reviews are pending, as is the goose."


def _fill(template: str, **ctx: Any) -> str:
    """str.format that leaves unknown {placeholders} alone instead of raising."""

    class _Keep(dict):
        def __missing__(self, key: str) -> str:
            return "{" + key + "}"

    return template.format_map(_Keep(ctx))


def _town_name(town_id: str | None) -> str:
    town = world.towns().get(town_id or "")
    return town["name"] if town else str(town_id or "somewhere").replace("_", " ").title()


def _stars_text(stars: Any) -> str:
    try:
        s = float(stars)
    except (TypeError, ValueError):
        return "0"
    return str(int(s)) if s == int(s) else str(s)


def _sentence(text: str) -> str:
    t = text.strip()
    return t if t.endswith((".", "!", "?")) else t + "."


def bio_text(pid: str, opener: str, credit: str, quirk: str, trained_at: str | None = None) -> str:
    """'{name}, {opener} {trained_at}. {credits} {quirk}' (docs/DATA.md section 11)."""
    p = world.performers().get(pid)
    name = p["name"] if p else pid.replace("_", " ").title()
    trained = (p or {}).get("bio_seed") or trained_at or "learned the trade somewhere damp"
    return f"{name}, {opener} {trained.strip().rstrip('.')}. {credit.strip()} {quirk.strip()}"


def _traditions(raw: Any) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for t in raw or []:
        if isinstance(t, str):
            out.append({"calamity": t, "title": world.calamity_title(t), "count": 2})
        elif isinstance(t, dict) and t.get("calamity"):
            out.append({"calamity": t["calamity"], "title": t.get("title") or world.calamity_title(t["calamity"]), "count": int(t.get("count", 2))})
    return out


# ------------------------------------------------------------------------------------------------------- bios
@task
async def bios(spec: dict[str, Any]) -> list[dict[str, Any]]:
    night, seed = spec["night"], spec["seed"]
    data = world.playbill_data()["bio"]
    cast = spec.get("cast") or {}
    ids = [(role, cast[role]) for role in ROLES if cast.get(role)]
    n = len(ids)
    # distinct parts for every member of THIS playbill (pick_n is a sample without replacement), different on every night
    openers = pick_n(data["openers"], n, seed, night, "bio-opener")
    credits = pick_n(data["credits"], n, seed, night, "bio-credit")
    quirks = pick_n(data["quirks"], n, seed, night, "bio-quirk")
    genre = world.genres().get(spec.get("genre") or "", {})
    out: list[dict[str, Any]] = []
    for i, (role, pid) in enumerate(ids):
        out.append(
            {
                "id": pid,
                "name": world.full_name(pid),
                "role": role,
                "role_label": genre.get("roles", {}).get(role, role),
                "bio": bio_text(pid, openers[i], credits[i], quirks[i], pick(data["trained_at"], seed, night, pid, "bio-trained")),
            }
        )
    emit("progress", f"playbill:{night}:task:bios", agent="bios", label="Bios written", pct=30)
    return out


# ------------------------------------------------------------------------------------------ traditions_page
@task
async def traditions_page(spec: dict[str, Any]) -> list[str]:
    """One printable line per Tradition (the town 'expects' it): 'The Lean (seen 3 times)'."""
    lines = [
        f"{t['title']} (seen {t['count']} times): the company will, regrettably, honour it again."
        for t in _traditions(spec.get("traditions"))
    ]
    emit("progress", f"playbill:{spec['night']}:task:traditions", agent="traditions_page", label="Traditions typeset", pct=45)
    return lines


# ----------------------------------------------------------------------------------------------- review_wall
@task
async def review_wall(spec: dict[str, Any]) -> str:
    headline = str(spec.get("headline") or "").strip()
    emit("progress", f"playbill:{spec['night']}:task:quote", agent="review_wall", label="Pull-quote chosen", pct=60)
    return headline or FALLBACK_QUOTE


# ----------------------------------------------------------------------------------------------------- layout
@task
async def layout(parts: dict[str, Any]) -> dict[str, Any]:
    spec, past = parts["spec"], parts["past"]
    night, seed = spec["night"], spec["seed"]
    data = world.playbill_data()
    script = spec.get("script") or {}
    town_id = spec.get("town") or ""
    town = _town_name(town_id)
    title = script.get("title") or "An Untitled Calamity"

    tonight = [_fill(pick(data["tonight_in"], seed, night, "tonight-in"), town=town)]
    for i, beat in enumerate(script.get("beats") or []):
        tonight.append(f"{BEAT_NAMES[i] if i < len(BEAT_NAMES) else beat.get('beat', 'Interlude')}: {beat.get('logline', '')}".strip())

    previously = [
        {
            "night": int(s["night"]),
            "town": s.get("town"),
            "title": s.get("title"),
            "stars": s.get("stars"),
            "text": _fill(
                pick(data["previously"], seed, int(s["night"]), "previously"),
                town=_town_name(s.get("town")), title=s.get("title") or "an untitled calamity", stars=_stars_text(s.get("stars")),
            ),
        }
        for s in past
    ]
    emit("progress", f"playbill:{night}:task:layout", agent="layout", label="Programme laid out", pct=80)
    return {
        "title": title,
        "tagline": script.get("tagline", ""),
        "heading": pick(data["headings"], seed, night, "heading"),
        "town": town_id,
        "night": night,
        "genre": spec.get("genre"),
        "stars": spec.get("stars"),
        "cast": parts["cast"],
        "tonight": tonight,
        "traditions": parts["traditions"],
        "quote": parts["quote"],
        "back_page": pick_n(data["back_page"], 3, seed, night, "back-page"),
        "previously": previously,
    }
