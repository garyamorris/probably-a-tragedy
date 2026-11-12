"""A WHOLE five-night tour over real HTTP: the loop the single-night test never reaches.

Checks the game's own invariants across nights: the night counter, the town order (the Royal Opera last), Traditions earned in
the Almanac and honoured on later nights, Encore tokens, funds, and the verdict at the end (triumph / respectable / tragedy).
"""

from __future__ import annotations

import pytest

from e2e.test_full_night import Client
from tragedy.data.tags import STAR_TARGET, TOUR_NIGHTS
from tragedy.engine import balance

pytestmark = pytest.mark.e2e


def answer(payload):
    kind = payload.get("kind")
    if kind == "confirm_cast":
        return {"cast": payload["proposed"]}
    if kind == "pick_draft":
        return {"draft_id": payload["drafts"][0]["draft_id"]}
    if kind == "prompters_box":
        return {"option": "lean_in", "cue": None, "text": None}
    if kind == "curate_traditions":
        return {"enshrine": [c["calamity"] for c in payload["candidates"]][:2]}
    if kind == "crossroads":
        return {"choice": payload["choices"][0]["id"]}
    pytest.fail(f"unexpected interrupt: {payload}")


def play_tour(base: str, seed: int = 31) -> dict:
    """Play a whole tour with a careful player's policy; reusable against any running server."""
    c = Client(base)
    tour = c.api("POST", "/api/tour", json={"seed": seed})
    tid = tour["id"]
    log = []
    for night in range(TOUR_NIGHTS):
        st = c.api("GET", f"/api/tour/{tid}")
        assert st["night"] == night, f"the night counter must advance exactly once per night (got {st['night']} on night {night})"
        town = st["towns"][night]
        nxt = st["towns"][night + 1] if night + 1 < TOUR_NIGHTS else None
        genre = balance.best_genre_for(town)  # what a careful player does with the town hints
        ctx = {"tour_id": tid, "night": night, "seed": st["seed"], "genre": genre, "town": town}

        def run(graph, inp, ctx=ctx):
            th = c.thread_for(tid, graph)
            _, values, asked = c.play(graph, th, {"input": inp}, answer)
            return values, asked

        cast = run("casting_call", ctx)[0]["cast"]
        script = run("writers_room", {**ctx, "cast": cast, "traditions": [t["calamity"] for t in st["traditions"]]})[0]["script"]
        result = run("performance", {**ctx, "cast": cast, "script": script})[0]["result"]
        rev = run("reviews", {**ctx, "cast": cast, "script": script, "result": result})[0]
        alm = run("almanac", {**ctx, "result": result, "next_town": nxt})[0]
        run("playbill_press", {**ctx, "cast": cast, "script": script, "stars": rev["stars"], "headline": rev["headline"], "traditions": alm["traditions"]})
        if nxt:  # the final night has no road: the tour ends at the Royal Opera
            run("the_road", {"tour_id": tid, "night": night, "seed": st["seed"], "from_town": town, "to_town": nxt})
        log.append({"night": night, "town": town, "genre": genre, "stars": rev["stars"], "hits": result["tradition_hits"], "traditions": len(alm["traditions"])})
    return {"c": c, "tid": tid, "log": log, "final": c.api("GET", f"/api/tour/{tid}"), "tour0": tour}


@pytest.fixture(scope="module")
def tour_run(dev_server):
    return play_tour(dev_server)


def test_five_nights_were_played_in_town_order_ending_at_the_opera(tour_run):
    f, t0 = tour_run["final"], tour_run["tour0"]
    assert [h["night"] for h in f["history"]] == list(range(TOUR_NIGHTS))
    assert [h["town"] for h in f["history"]] == t0["towns"] and t0["towns"][-1] == "wibbling_opera"
    assert f["night"] == TOUR_NIGHTS - 1, "the wagon does not leave the Royal Opera"


def test_the_verdict_matches_the_stars(tour_run):
    f = tour_run["final"]
    total = sum(h["stars"] for h in f["history"])
    expected = "triumph" if total >= STAR_TARGET else "respectable" if total >= 11 else "tragedy"
    print("\ntour:", [(r["night"], r["genre"], r["stars"], f"hits={r['hits']}", f"trad={r['traditions']}") for r in tour_run["log"]], "total", total, "->", f["status"])
    assert f["status"] == expected


def test_traditions_were_earned_and_encore_tokens_followed(tour_run):
    f = tour_run["final"]
    assert f["traditions"], "five nights of calamities must produce at least one Tradition"
    assert f["encore"] >= 2 + len(f["traditions"]) - 0, "each enshrined Tradition grants an Encore token (and none were spent)"
    assert all(t["count"] >= 2 for t in f["traditions"])


def test_economy_stays_sane(tour_run):
    f = tour_run["final"]
    assert f["funds"] >= 0 and -3 <= f["morale"] <= 3
    # funds must stay scarce enough for choices to matter (a 70-fund pile that buys nothing was the bug this pins)
    assert all(2 <= h["funds_delta"] <= 12 for h in f["history"]), [h["funds_delta"] for h in f["history"]]
    assert f["funds"] <= 8 + 5 * 12 and f["props"] == [], "no greenroom shopping in this run, so no props bought"
    assert all(0.5 <= h["stars"] <= 5 for h in f["history"])
    assert all(isinstance(h["headline"], str) and h["headline"] for h in f["history"])
