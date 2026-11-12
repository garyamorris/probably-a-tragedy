"""The engine against its own gold set: determinism, bands, and the known extremes."""

from __future__ import annotations

import pytest

from tragedy.data.loader import load
from tragedy.engine.night import simulate_night

ROWS = list(load("shows_gold"))


def test_gold_has_the_documented_shape():
    kinds = [r["kind"] for r in ROWS]
    assert len(ROWS) >= 36 and kinds.count("disaster") >= 6 and kinds.count("triumph") >= 6
    assert len({r["id"] for r in ROWS}) == len(ROWS)


@pytest.mark.parametrize("row", ROWS, ids=[r["id"] for r in ROWS])
def test_gold_row_reproduces(row):
    n = simulate_night(seed=row["seed"], night=row["night"], genre=row["genre"], town=row["town"], cast=row["cast"], policy=row["autopilot"], quill=row["quill"])
    e = row["expect"]
    assert len(n["result"]["mishaps"]) >= e["mishaps_min"]
    assert e["stars_min"] <= n["stars"] <= e["stars_max"], (n["stars"], e)
    assert simulate_night(seed=row["seed"], night=row["night"], genre=row["genre"], town=row["town"], cast=row["cast"], policy=row["autopilot"], quill=row["quill"])["stars"] == n["stars"]
