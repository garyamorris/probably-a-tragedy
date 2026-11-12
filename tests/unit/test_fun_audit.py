"""Pins for the fixes that came out of an independent fun audit (see docs/DESIGN.md section 8).

The audit measured, with the pure engine, that the old game was a solved puzzle: always gothic romance + Madame's cast + press 'Yes, and...'
averaged 15.9 stars a tour with no skill; the whisper was a fake choice (best in 100% of 1,252 decisions); rapport cut mishaps, and since
mishaps are where the warmth comes from, befriending the cast made shows worse; and some shows had no real decision at all.
"""

from __future__ import annotations

from collections import Counter
from statistics import fmean

from helpers import default_cast
from tragedy.common.rng import stable_int
from tragedy.data.tags import GENRES
from tragedy.engine import casting, world
from tragedy.engine import show as eng
from tragedy.engine.night import simulate_night
from tragedy.engine.script import QUILLS, draft_script


# ---------------------------------------------------------------------------------------------------------- towns have favourites
def test_every_town_loves_one_genre_and_scorns_another_and_no_genre_is_loved_everywhere():
    towns = world.towns()
    loved, scorned = Counter(), Counter()
    for tid, t in towns.items():
        temp = t["temperament"]
        assert temp["favours"] in GENRES and temp["scorns"] in GENRES and temp["favours"] != temp["scorns"], tid
        loved[temp["favours"]] += 1
        scorned[temp["scorns"]] += 1
    assert all(3 <= loved[g] <= 8 for g in GENRES), loved
    assert all(3 <= scorned[g] <= 8 for g in GENRES), scorned


def test_a_town_never_loves_a_genre_it_net_dislikes_or_scorns_one_it_net_likes():
    """The gossip and the genre cards must not contradict each other (the builder's rule: net affinity of likes minus hates)."""
    from tragedy.data.content.towns import GENRE_TAGS

    def affinity(temp: dict, genre: str) -> int:
        return 2 * len(set(temp["likes"]) & GENRE_TAGS[genre]) - 2 * len(set(temp["hates"]) & GENRE_TAGS[genre])

    for tid, t in world.towns().items():
        temp = t["temperament"]
        assert affinity(temp, temp["favours"]) >= 0, (tid, temp)
        assert affinity(temp, temp["scorns"]) <= 0, (tid, temp)


# ---------------------------------------------------------------------------------------------------------- genres are level
def _mean_show_quality(genre: str, seeds: range) -> float:
    """Mean beat quality over whole simulated shows (chaos and mishaps included), as the critics see it."""
    vals = []
    for s in seeds:
        cast = casting.recommend(casting.score_table(genre, s, 0))
        town = sorted(world.towns())[(s * 7) % 29]
        script = draft_script("quill_tender", seed=s, night=0, genre=genre, town=town, cast=cast, traditions=[])
        res = eng.simulate_show(seed=s, night=0, genre=genre, town=town, cast=cast, script=script, policy="lean_in")
        vals.extend(res["quality"])
    return fmean(vals)


def test_genres_are_level_so_no_genre_is_strong_by_default():
    means = {g: _mean_show_quality(g, range(60)) for g in GENRES}
    assert max(means.values()) - min(means.values()) < 1.5, ("beat quality is judged against the genre's usual quality", means)


def test_the_genre_centres_still_match_the_data(monkeypatch):
    """GENRE_CENTER is a measured constant; if the performers or genre skills change, re-measure it (the numbers print here)."""
    authored = dict(eng.GENRE_CENTER)
    monkeypatch.setattr(eng, "GENRE_CENTER", dict.fromkeys(GENRES, eng.GENRE_MEAN))  # raw, un-normalised quality
    raw = {g: round(_mean_show_quality(g, range(60)), 1) for g in GENRES}
    for g in GENRES:
        assert abs(raw[g] - authored[g]) < 1.5, (g, raw, "update engine.show.GENRE_CENTER")


def test_reading_the_town_beats_always_gothic_romance():
    """The audit's solved recipe must stay dead: the best genre differs by town, and the town's favourite pays."""
    towns = sorted(world.towns())
    gains, best = [], Counter()
    always, fav = [], []
    for i, t in enumerate(towns):
        stars = {}
        for g in GENRES:
            res = [
                simulate_night(seed=s, night=0, genre=g, town=t, cast=casting.recommend(casting.score_table(g, s, 0)), policy="lean_in", quill=QUILLS[s % 3])["stars"]
                for s in range(i * 3, i * 3 + 3)
            ]
            stars[g] = fmean(res)
        best[max(stars, key=stars.get)] += 1
        always.append(stars["gothic_romance"])
        fav.append(stars[world.towns()[t]["temperament"]["favours"]])
        gains.append(max(stars.values()) - stars["gothic_romance"])
    assert best["gothic_romance"] <= 15, ("gothic romance must not be the best genre almost everywhere", best)
    assert len([g for g in GENRES if best[g] >= 1]) >= 4, best
    assert fmean(fav) > fmean(always) + 0.1, "going to the town's favourite genre must beat always-gothic"
    assert fmean(gains) > 0.15


# ---------------------------------------------------------------------------------------------------------- whispers are a real choice
def test_the_options_come_in_a_different_order_for_different_mishaps_but_the_same_on_replay():
    cast = default_cast("farce")
    show = eng.init_show(seed=3, night=0, genre="farce", town="marshwick", cast=cast)
    first_ids = Counter()
    for k, mid in enumerate(["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"]):
        m = {"beat": k % 5, "id": mid, "kind": "collapse"}
        a = [o["id"] for o in eng.shuffled_options(show, m)]
        b = [o["id"] for o in eng.shuffled_options(show, m)]
        assert a == b, "replaying a beat must show the same order"
        assert sorted(a) == sorted(o["id"] for o in eng.whisper_options("collapse")), "a permutation, nothing lost"
        first_ids[a[0]] += 1
    assert len(first_ids) == 3 and max(first_ids.values()) <= 8, ("'press 1' must not be the answer", first_ids)


def test_neither_whisper_is_best_everywhere():
    """With look-ahead scoring, lean-in is right about 60% of the time, cover-up about a quarter: the player has to read the stage."""
    best = Counter()
    for s in range(120):
        genre = GENRES[s % 5]
        cast = default_cast(genre, s)
        town = sorted(world.towns())[(s * 7) % 29]
        show = eng.init_show(seed=s, night=s % 5, genre=genre, town=town, cast=cast)
        script = draft_script("quill_tender", seed=s, night=s % 5, genre=genre, town=town, cast=cast, traditions=[])
        for i in range(5):
            ctx = eng.beat_context(show, script, i)
            for m in eng.detect_mishaps(show, ctx):
                if m["severity"] != "major":
                    continue
                chosen = eng.policy_choice(show, m, "best", ctx)
                best[chosen["option"] if chosen["option"] in ("lean_in", "cover_up") else "third"] += 1
            res = eng.run_beat(show, script, i, "lean_in")
            show = res["show"]
    total = sum(best.values())
    assert total >= 100, best
    assert best["lean_in"] / total < 0.8, ("lean-in must not be right nearly every time", best)
    assert best["cover_up"] / total > 0.08, ("cover-up must be the right call sometimes", best)


# ---------------------------------------------------------------------------------------------------------- rapport helps
def test_rapport_no_longer_makes_mishaps_rarer():
    cast = default_cast("farce")
    base = eng.init_show(seed=5, night=0, genre="farce", town="marshwick", cast=cast, rapport={})
    friends = eng.init_show(seed=5, night=0, genre="farce", town="marshwick", cast=cast, rapport=dict.fromkeys(cast.values(), 5))
    for aid in cast.values():
        for fid in world.performers()[aid]["flaws"]:
            assert eng.mishap_probability(base, aid, fid) == eng.mishap_probability(friends, aid, fid)


def test_rapport_makes_the_cast_likelier_to_join_a_yes_and():
    def joiners(rapport: int) -> int:
        n = 0
        for s in range(300):
            cast = default_cast("farce", s)
            show = eng.init_show(seed=s, night=0, genre="farce", town="marshwick", cast=cast, rapport=dict.fromkeys(cast.values(), rapport))
            script = draft_script("quill_tender", seed=s, night=0, genre="farce", town="marshwick", cast=cast, traditions=[])
            ctx = eng.beat_context(show, script, 1)
            mishap = {"id": "x", "actor": cast["lead"], "severity": "major", "effects": {"warmth": 0, "chaos": 0}, "tags": [], "calamity": "the_chair", "kind": "generic"}
            res = eng.resolve_mishap(show, ctx, mishap, {"option": "lean_in", "cue": None, "text": None})
            n += len(res["chain"]["actors"]) if res["chain"] else 0
        return n

    assert joiners(5) > joiners(0) * 1.15, "friends say 'yes, and...' more often"


# ---------------------------------------------------------------------------------------------------------- every show has a decision
def test_every_show_gives_the_prompter_a_real_decision_by_the_second_beat():
    """Madame handles minor mishaps herself, so only a MAJOR mishap puts a whisper in front of the player. A played-through audit waited
    2 min 38 s (at 1x) for its first decision and a simulation found the first major mishap at the finale in 6% of shows and nowhere in 8%.
    Now every show has one by beat index FIRST_DECISION_BY (the second beat)."""
    severity = {r["id"]: r["severity"] for rows in world.mishaps_by_flaw().values() for r in rows}
    late = []
    for s in range(200):
        genre = GENRES[s % 5]
        cast = default_cast(genre, s)
        town = sorted(world.towns())[(s * 11) % 29]
        script = draft_script("quill_tender", seed=s, night=s % 5, genre=genre, town=town, cast=cast, traditions=[])
        res = eng.simulate_show(seed=s, night=s % 5, genre=genre, town=town, cast=cast, script=script, policy="lean_in")
        majors = [m["beat"] for m in res["mishaps"] if severity.get(m["id"]) == "major"]
        if not majors or min(majors) > eng.FIRST_DECISION_BY:
            late.append((s, genre, majors))
    assert not late, f"{len(late)} of 200 shows had no major mishap by beat {eng.FIRST_DECISION_BY}: {late[:3]}"


def test_stable_int_is_still_what_orders_the_options():
    assert stable_int(1, 2, 3) == stable_int(1, 2, 3)


# ---------------------------------------------------------------------------------------------------------- the player can learn why
def test_why_chips_name_the_reasons_biggest_first():
    bd = {
        "performance": 1.2, "mishaps": 3.4, "town": 2.5, "town_notes": ["likes goose", "hates death", "expected the_chair"], "genre_taste": 2.0,
        "audience": 0.27, "tangle": -1.5, "callbacks": ["the_chair"], "callback_bonus": 4.0, "real_props": ["chair"], "prop_bonus": 2.0,
    }
    chips = eng.why_chips(bd, town_name="Marshwick-on-Mire", genre_name="Farce")
    labels = [c["label"] for c in chips]
    assert labels[0] == "The town was waiting for the chair" and chips[0]["value"] == 8.0, chips
    assert "Marshwick-on-Mire loves Farce" in labels and "The town likes goose" in labels and "The town hates death" in labels
    assert "A real chair" in labels and "Strings in a knot" in labels and "The tradition returns: chair" in labels
    assert "The house" not in labels, "moves under half a point are noise, not a reason"
    assert [abs(c["value"]) for c in chips] == sorted((abs(c["value"]) for c in chips), reverse=True)
    scorn = eng.why_chips({"genre_taste": -2.0}, town_name="Gloomsby", genre_name="Farce")
    assert scorn == [{"label": "Gloomsby scorns Farce", "value": -2.0}]
    assert eng.why_chips({}, town_name="x", genre_name="y") == []


# ------------------------------------------------------------------------------------------- the three drafts are told apart by title
def test_the_three_drafts_of_a_night_never_share_a_title():
    """A playtest saw two drafts both called "Trousers of Twelve Bridges": the player lifts a draft by its title, so they must differ.
    Rolling a title pattern per quill collides on ~44% of nights; the slot offset makes it impossible."""
    town_ids = list(world.towns())[:6]
    for genre in GENRES:
        cast = default_cast(genre)
        for seed in range(40):
            for night in (0, 2):
                for attempt in (0, 1):
                    titles = [
                        draft_script(q, seed=seed, night=night, genre=genre, town=town_ids[seed % len(town_ids)], cast=cast, traditions=[], attempt=attempt)["title"]
                        for q in QUILLS
                    ]
                    assert len(set(titles)) == 3, (genre, seed, night, attempt, titles)
