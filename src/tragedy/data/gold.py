"""The gold set: `datasets/shows_gold.jsonl`, built BY the engine so it is a regression snapshot with known extremes.

Rows are frozen outcomes bands (+/- 0.75 stars). `kind` is `regression`, `disaster` (a bad cast with a cover-up policy,
stars_max <= 2.5) or `triumph` (the best cast with the best policy, stars_min >= 3.5). `tests/evals` re-runs every row
and `python -m tragedy.data check` flags drift. If the engine is retuned on purpose, rebuild (`make data`).
"""

from __future__ import annotations

from typing import Any

from tragedy.data.tags import GENRES, ROLES
from tragedy.engine import casting, world
from tragedy.engine.night import simulate_night
from tragedy.engine.script import QUILLS

BAND = 0.75


def _clear_caches() -> None:
    from tragedy.data import loader

    loader._load.cache_clear()
    for fn in vars(world).values():
        if hasattr(fn, "cache_clear"):
            fn.cache_clear()


def _row(i: int, kind: str, seed: int, genre: str, town: str, cast: dict[str, str], policy: str, quill: str) -> dict[str, Any]:
    n = simulate_night(seed=seed, night=0, genre=genre, town=town, cast=cast, policy=policy, quill=quill)
    stars = n["stars"]
    if kind == "disaster":
        lo, hi = 0.5, 2.5
    elif kind == "triumph":
        lo, hi = 3.5, 5.0
    else:
        lo, hi = max(0.5, stars - BAND), min(5.0, stars + BAND)
    return {
        "id": f"gold_{i:03d}", "kind": kind, "seed": seed, "night": 0, "genre": genre, "town": town, "cast": cast,
        "autopilot": policy, "quill": quill,
        "expect": {"mishaps_min": 1, "stars_min": lo, "stars_max": hi, "calamities": sorted(set(n["result"]["calamities"]))[:3], "stars": stars},
    }


def build_gold() -> list[dict[str, Any]]:
    _clear_caches()
    towns = sorted(world.towns())
    rows: list[dict[str, Any]] = []
    for i in range(28):  # regression snapshot over every genre / many towns / three policies / three quills
        seed, genre = 100 + i, GENRES[i % 5]
        cast = casting.recommend(casting.score_table(genre, seed, 0))
        rows.append(_row(len(rows) + 1, "regression", seed, genre, towns[(i * 7) % len(towns)], cast, ("lean_in", "best", "cover_up")[i % 3], QUILLS[i % 3]))
    for kind, want in (("disaster", 6), ("triumph", 6)):
        start = 1000 if kind == "disaster" else 2000
        found, seed = 0, start
        while found < want and seed < start + 4000:  # bounded search: fail loudly below rather than loop forever
            seed += 1
            genre, town = GENRES[seed % 5], towns[(seed * 11) % len(towns)]
            scores = casting.score_table(genre, seed, 0)
            if kind == "disaster":
                cast = {r: min(scores[r], key=lambda a, r=r: scores[r][a]) for r in ROLES}
                if len(set(cast.values())) < 3:
                    continue
                policy = "cover_up"
            else:
                cast, policy = casting.recommend(scores), "best"
            n = simulate_night(seed=seed, night=0, genre=genre, town=town, cast=cast, policy=policy, quill=QUILLS[seed % 3])
            if (kind == "disaster" and n["stars"] <= 2.0) or (kind == "triumph" and n["stars"] >= 4.0):
                rows.append(_row(len(rows) + 1, kind, seed, genre, town, cast, policy, QUILLS[seed % 3]))
                found += 1
        if found < want:
            raise RuntimeError(f"could not find {want} '{kind}' cases in 4000 seeds: the engine balance has drifted")
    return rows
