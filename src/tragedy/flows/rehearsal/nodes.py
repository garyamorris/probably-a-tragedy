"""Nodes of the `rehearsal` graph: plan -> simulate x N (Send) -> summarize [defer].

Pure of the tour: no Store access, no candle accounting (the API spends the candle). Each imaginary night is the very same
engine as the real show, with a policy standing in for the Prompter, judged by the very same five pigeons.
"""

from __future__ import annotations

from collections import Counter
from statistics import fmean
from typing import Any, Literal

from langgraph.types import Command, Overwrite, Send

from tragedy.common.rng import sub_seed
from tragedy.common.stream import emit
from tragedy.engine import casting, world
from tragedy.engine import review as rv
from tragedy.engine import script as scr
from tragedy.engine import show as eng
from tragedy.flows.rehearsal.state import RehearsalState, SimulateInput

DEFAULT_SAMPLES = 12
MAX_SAMPLES = 24  # the safety clamp: a client cannot ask for a thousand imaginary nights
POLICY = "best"  # the imaginary Prompter always whispers the warmest option
RISKS_SHOWN = 4

VERDICTS: tuple[tuple[float, str], ...] = (
    (4.25, "Madame has stopped pretending not to be moved. Open the champagne; keep the trapdoor shut."),
    (3.5, "A likely hit. The pigeons are cooing, and only mildly about the goose."),
    (2.75, "Respectable, in the way a damp umbrella is respectable."),
    (2.0, "Mixed. The town will clap politely and leave by the side door."),
    (1.25, "Brave. Take the cast, a different script, and a very long think."),
    (0.0, "A tragedy, as advertised. Perhaps lean on the audience's mercy."),
)


def _int(x: Any, default: int) -> int:
    return x if isinstance(x, int) and not isinstance(x, bool) else default


def clamp_samples(raw: Any) -> int:
    """`samples` -> 1..24; anything that is not a whole number means the default of 12."""
    return max(1, min(MAX_SAMPLES, _int(raw, DEFAULT_SAMPLES)))


def _key(night: int, *parts: Any) -> str:
    return ":".join(str(p) for p in (night, "rehearsal", *parts))


def bucket(stars: float) -> int:
    """Histogram bucket 1..5 (half-stars fall to the lower bucket, exactly like the pigeons' pull-quotes)."""
    return max(1, min(5, int(stars)))


def verdict_for(mean: float) -> str:
    return next(text for floor, text in VERDICTS if mean >= floor)


# --------------------------------------------------------------------------------------------------------- plan
async def plan(state: RehearsalState) -> Command[Literal["simulate"]]:
    night, seed = _int(state.get("night"), 0), _int(state.get("seed"), 0)
    genre = state.get("genre") if state.get("genre") in world.genres() else sorted(world.genres())[0]
    town = state.get("town") if state.get("town") in world.towns() else sorted(world.towns())[0]
    cast = state.get("cast")
    if not (isinstance(cast, dict) and all(isinstance(v, str) for v in cast.values()) and casting.valid_cast(cast)):
        cast = casting.recommend(casting.score_table(genre, seed, night))
    script = state.get("script")
    if not (isinstance(script, dict) and isinstance(script.get("beats"), list) and len(script["beats"]) == 5):
        script = scr.draft_script("quill_tender", seed=seed, night=night, genre=genre, town=town, cast=cast, traditions=[])
    n = clamp_samples(state.get("samples"))
    sends = [
        Send("simulate", SimulateInput(i=i, seed=seed, night=night, genre=genre, town=town, cast=cast, script=script))
        for i in range(n)
    ]
    emit("progress", _key(night, "progress", 0), agent="clipboard", label=f"{n} imaginary nights", pct=0)
    return Command(
        update={
            "night": night, "seed": seed, "genre": genre, "town": town, "cast": cast, "script": script,
            "n_samples": n, "sims": Overwrite([]),  # a re-run on the same thread starts clean
        },
        goto=sends,
    )


# --------------------------------------------------------------------------------------------------------- simulate
async def simulate(p: SimulateInput) -> dict[str, Any]:
    """One imaginary night: a headless show with a different show seed, then the five pigeons' verdicts."""
    show_seed = sub_seed(p["seed"], "rehearsal", p["i"])
    result = eng.simulate_show(
        seed=show_seed, night=p["night"], genre=p["genre"], town=p["town"], cast=p["cast"], script=p["script"], policy=POLICY
    )
    reviews = [
        rv.review_one(c, result, script=p["script"], cast=p["cast"], town=p["town"], traditions=[], seed=show_seed, night=p["night"])
        for c in world.critics()
    ]
    stars = rv.final_stars(reviews)
    top = rv.notable_mishap(result)
    top_mishap = top["title"] if top else None
    emit(
        "rehearsal.sample", _key(p["night"], "sample", p["i"]), agent="clipboard",
        i=p["i"], stars=stars, warmth=result["warmth"], chaos=result["chaos"], top_mishap=top_mishap,
    )
    return {
        "sims": [
            {
                "i": p["i"], "stars": stars, "warmth": result["warmth"], "chaos": result["chaos"], "top_mishap": top_mishap,
                "mishaps": sorted({m["title"] for m in result["mishaps"]}),
            }
        ]
    }


# --------------------------------------------------------------------------------------------------------- summarize
def summarize_sims(sims: list[dict[str, Any]]) -> dict[str, Any]:
    """Pure: histogram of final stars (1..5), their mean, the likeliest disasters and a verdict."""
    n = len(sims)
    histogram = [0] * 5
    for s in sims:
        histogram[bucket(s["stars"]) - 1] += 1
    mean = round(fmean(s["stars"] for s in sims), 2) if sims else 0.0
    seen = Counter(t for s in sims for t in s["mishaps"])  # in how many nights each mishap happened
    risk = [{"title": t, "freq": round(c / max(1, n), 2)} for t, c in sorted(seen.items(), key=lambda kv: (-kv[1], kv[0]))]
    return {"histogram": histogram, "mean": mean, "risk": risk[:RISKS_SHOWN], "verdict": verdict_for(mean)}


async def summarize(state: RehearsalState) -> dict[str, Any]:
    """defer=True: runs once every imaginary night is in."""
    summary = summarize_sims(state["sims"])
    emit("rehearsal.summary", _key(state["night"], "summary"), agent="clipboard", **summary)
    emit("progress", _key(state["night"], "progress", 1), agent="clipboard", label="Rehearsals done", pct=100)
    return {"summary": summary}
