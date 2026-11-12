"""Balance report: star / warmth / mishap distributions per play style. `uv run python -m tragedy.engine.balance`.

Targets (retune the knobs in engine/show.py, engine/review.py, then `make data`). A fun audit found the old balance was a SOLVED game
(always gothic romance + Madame's cast + "Yes, and..." averaged 15.9 stars with no skill), so the contract is now about what must NOT pay:
    skilled        (the town's favourite genre, best of 3 drafts, Madame's cast, look-ahead whispers + cues)   mean ~3.0 (5 nights ~ 15)
    autopilot      (genre by whim, Madame's cast, always 'Yes, and...')                                        mean ~2.3 (5 nights ~ 12)
    always gothic  (the audit's old winning recipe, no skill)                                                  must NOT beat autopilot by much
    cover-up       (never lean in)                                                                             within ~0.3 of autopilot: neither is a fixed answer
    random cast                                                                                                mean ~1.7
    worst cast + cover-up                                                                                      mean ~1.1
"""

from __future__ import annotations

from collections import Counter
from collections.abc import Callable
from statistics import fmean, pstdev
from typing import Any

from tragedy.common.rng import pick_n
from tragedy.data.tags import GENRES, ROLES
from tragedy.engine import casting, world
from tragedy.engine.night import simulate_night
from tragedy.engine.script import QUILLS, draft_script, score_script

Case = dict[str, Any]


def _towns() -> list[str]:
    return sorted(world.towns())


def _base(seed: int) -> tuple[str, str]:
    return GENRES[seed % 5], _towns()[(seed * 7) % len(_towns())]


def best_genre_for(town: str) -> str:
    """What the tour screen now tells a careful player: the genre the town loves (`temperament.favours`)."""
    return world.towns()[town]["temperament"]["favours"]


def _best_cast(g: str, s: int) -> dict[str, str]:
    return casting.recommend(casting.score_table(g, s, 0))


def autopilot(seed: int, policy: str = "lean_in") -> Case:
    g, t = _base(seed)
    return {"genre": g, "town": t, "cast": _best_cast(g, seed), "policy": policy, "quill": QUILLS[seed % 3]}


def skilled(seed: int) -> Case:
    _, t = _base(seed)
    g = best_genre_for(t)
    cast = _best_cast(g, seed)
    drafts = [(score_script(draft_script(q, seed=seed, night=0, genre=g, town=t, cast=cast, traditions=[]), town=t, cast=cast, genre=g, traditions=[]), q) for q in QUILLS]
    return {"genre": g, "town": t, "cast": cast, "policy": "best", "quill": max(drafts)[1]}


def always_gothic(seed: int) -> Case:
    """No skill at all: the audit's old winning recipe. If this ever beats autopilot by much, the game is solved again."""
    _, t = _base(seed)
    g = "gothic_romance"
    return {"genre": g, "town": t, "cast": _best_cast(g, seed), "policy": "lean_in", "quill": QUILLS[seed % 3]}


def coverup(seed: int) -> Case:
    return autopilot(seed, "cover_up")


def random_cast(seed: int) -> Case:
    g, t = _base(seed)
    return {"genre": g, "town": t, "cast": dict(zip(ROLES, pick_n(sorted(world.performers()), 3, seed, "randcast"), strict=True)), "policy": "lean_in", "quill": QUILLS[seed % 3]}


def worst(seed: int) -> Case | None:
    g, t = _base(seed)
    sc = casting.score_table(g, seed, 0)
    c = {r: min(sc[r], key=lambda a, r=r: sc[r][a]) for r in ROLES}
    return {"genre": g, "town": t, "cast": c, "policy": "cover_up", "quill": QUILLS[seed % 3]} if len(set(c.values())) == 3 else None


STYLES: dict[str, Callable[[int], Case | None]] = {
    "skilled": skilled, "autopilot (lean_in)": autopilot, "always gothic": always_gothic, "cover-up": coverup, "random cast": random_cast, "worst cast + cover-up": worst,
}


def measure(n: int = 150) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for label, fn in STYLES.items():
        stars, warm, chaos, mishaps = [], [], [], []
        for seed in range(n):
            c = fn(seed)
            if c is None:
                continue
            r = simulate_night(seed=seed, night=0, **c)
            stars.append(r["stars"])
            warm.append(r["result"]["warmth"])
            chaos.append(r["result"]["chaos"])
            mishaps.append(len(r["result"]["mishaps"]))
        out[label] = {"n": len(stars), "mean": fmean(stars), "sd": pstdev(stars), "hist": dict(sorted(Counter(stars).items())),
                      "warmth": fmean(warm), "chaos": fmean(chaos), "mishaps": fmean(mishaps)}
    return out


if __name__ == "__main__":
    for label, m in measure().items():
        print(f"{label:24s} n={m['n']:3d} stars mean={m['mean']:.2f} sd={m['sd']:.2f} warmth={m['warmth']:.0f} chaos={m['chaos']:.0f} mishaps={m['mishaps']:.1f}")
        print("   ", m["hist"])
