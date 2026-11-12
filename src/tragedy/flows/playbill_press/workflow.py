# NOTE: deliberately NO ``from __future__ import annotations`` in this module. ``@entrypoint`` reads the annotations of the
# entrypoint function at decoration time to build the input schema (Studio's form) and the output / saved-value channel
# types; postponed (string) annotations make that lookup fail.
"""`playbill_press`, written as plain Python (the Functional API).

    bios  +  traditions_page  +  review_wall   (three @task, started together)   ->   layout (@task)   ->   sections

* ``@entrypoint`` makes the whole workflow ONE node in Studio; the value is the task timeline (``tasks`` / ``updates`` streams).
  The input is a single TypedDict parameter so Studio renders an object form.
* ``previous``: the thread is per TOUR (``playbill-<tour>``), so the value saved by the last invocation (``entrypoint.final(save=...)``)
  comes back as ``previous`` on the next night. ``previously`` in the printed playbill is built from it: the programme remembers.
  The value RETURNED to the caller (the playbill) differs from the value SAVED (a small memo), which is what ``entrypoint.final`` is for.
* Everything is deterministic: bios and filler are ``tragedy.common.rng`` picks of (seed, night, labels), so a replay prints the same programme.
* The sections are streamed (``playbill.section``) AFTER the tasks, in poster order, so the UI can reveal them one by one.
"""

from typing import Any, TypedDict

from langgraph.func import entrypoint

from tragedy.common.stream import emit
from tragedy.engine import world
from tragedy.flows.playbill_press.tasks import bios, layout, review_wall, traditions_page

MAX_MEMO = 5  # nights in a tour


class PlaybillInput(TypedDict, total=False):
    tour_id: str
    night: int
    seed: int
    genre: str
    town: str
    cast: dict[str, str]
    script: dict[str, Any]
    stars: float
    headline: str
    traditions: list[Any]  # [{calamity, title, count}] or bare calamity slugs


class PlaybillOutput(TypedDict):
    playbill: dict[str, Any]


class PlaybillMemo(TypedDict):
    tour_id: str
    shows: list[dict[str, Any]]  # one summary per printed night: {night, town, title, stars, headline}


def _k(night: int, *parts: Any) -> str:
    return ":".join(str(p) for p in ("playbill", night, *parts))


def _past(memo: PlaybillMemo | None, night: int) -> list[dict[str, Any]]:
    """The earlier nights of THIS tour, oldest first (a reprint of night N only remembers nights before N)."""
    return sorted((s for s in (memo or {}).get("shows", []) if int(s.get("night", 0)) < night), key=lambda s: int(s["night"]))


async def playbill_press(inp: PlaybillInput, *, previous: PlaybillMemo | None) -> entrypoint.final[PlaybillOutput, PlaybillMemo]:
    night, seed = int(inp.get("night", 0)), int(inp.get("seed", 0))
    tour_id = str(inp.get("tour_id", "tour"))
    spec = {**inp, "night": night, "seed": seed}
    emit("progress", _k(night, "progress", 0), agent="playbill_press", label="Setting the type", pct=5)

    # three independent tasks: start them all, then await (tasks are futures in the Functional API)
    cast_f = bios(spec)
    trad_f = traditions_page(spec)
    quote_f = review_wall(spec)
    cast, traditions, quote = await cast_f, await trad_f, await quote_f

    past = _past(previous, night)
    pb = await layout({"spec": spec, "cast": cast, "traditions": traditions, "quote": quote, "past": past})

    town = world.towns().get(pb["town"], {}).get("name", pb["town"])
    sections: list[tuple[str, str | None, Any]] = [
        ("title", pb["title"], pb["title"]),
        ("cast", f"{len(pb['cast'])} players", pb["cast"]),
        ("tonight", pb["tonight"][0] if pb["tonight"] else None, pb["tonight"]),
        ("traditions", f"{len(pb['traditions'])} Tradition(s) of the house", pb["traditions"]),
        ("quote", pb["quote"], pb["quote"]),
        ("back_page", pb["back_page"][0] if pb["back_page"] else None, pb["back_page"]),
    ]
    if pb["previously"]:
        sections.append(("previously", f"{len(pb['previously'])} earlier night(s) in {town}'s memory", pb["previously"]))
    for i, (name, text, items) in enumerate(sections):
        emit("playbill.section", _k(night, "section", name), agent="playbill_press", name=name, text=text, items=items)
        emit("progress", _k(night, "progress", name), agent="playbill_press", label=f"Printed: {name}", pct=10 + round(90 * (i + 1) / len(sections)))

    memo_shows = [s for s in (previous or {}).get("shows", []) if int(s.get("night", -1)) != night]
    memo_shows.append({"night": night, "town": pb["town"], "title": pb["title"], "stars": pb.get("stars"), "headline": pb["quote"], "genre": pb["genre"]})
    memo: PlaybillMemo = {"tour_id": tour_id, "shows": sorted(memo_shows, key=lambda s: int(s["night"]))[-MAX_MEMO:]}
    return entrypoint.final(value={"playbill": pb}, save=memo)
