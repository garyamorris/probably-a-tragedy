from __future__ import annotations

from itertools import product
from statistics import fmean

import pytest

from helpers import default_cast, make_script
from tragedy.common.rng import stable_int
from tragedy.data.tags import BEATS, GENRES, ROLES
from tragedy.engine import audience, casting, world
from tragedy.engine import show as eng

TOWN = "marshwick"


def _sim(genre, cast, seed, night=0, town=None, policy="lean_in", quill="quill_tender"):
    town = town or sorted(world.towns())[stable_int(seed) % 29]
    script = make_script(genre, town, cast, seed, night, quill)
    return eng.simulate_show(seed=seed, night=night, genre=genre, town=town, cast=cast, script=script, policy=policy), script, town


def test_simulation_is_deterministic():
    cast = default_cast("farce")
    a, _, _ = _sim("farce", cast, 11)
    b, _, _ = _sim("farce", cast, 11)
    assert a == b


@pytest.mark.parametrize("genre", GENRES)
def test_every_show_has_a_disaster_and_five_beats(genre):
    for seed in range(8):
        cast = default_cast(genre, seed)
        res, _, _ = _sim(genre, cast, seed)
        assert len(res["quality"]) == 5 and len(res["beats"]) == 5
        assert res["mishaps"], f"{genre} seed {seed}: a show without a disaster is not a Tragedy"
        assert 0 <= res["warmth"] <= 100 and 0 <= res["chaos"] <= 100


def test_at_most_two_mishaps_per_beat_and_one_per_actor():
    for seed in range(12):
        cast = default_cast("melodrama", seed)
        town = sorted(world.towns())[seed]
        script = make_script("melodrama", town, cast, seed)
        show = eng.init_show(seed=seed, night=0, genre="melodrama", town=town, cast=cast)
        for i in range(5):
            step = eng.run_beat(show, script, i)
            ms = step["mishaps"]
            assert len(ms) <= 2 and len({m["actor"] for m in ms}) == len(ms)
            show = step["show"]


def test_play_styles_are_ordered_and_no_cheap_recipe_wins():
    """Balance contract (see engine/balance.py). A fun audit found the old game SOLVED: always gothic romance + Madame's cast + 'Yes, and...'
    averaged 15.9 stars over a tour with no skill. So: reading the town must pay, the fixed recipes must not, and neither whisper may be a
    fixed answer (lean vs cover-up used to differ by 0.4 a night; now they are within a third of a star)."""
    from tragedy.engine import balance

    m = balance.measure(n=80)
    mean = {k: v["mean"] for k, v in m.items()}
    assert mean["skilled"] > mean["autopilot (lean_in)"] + 0.3, mean
    assert mean["skilled"] > mean["always gothic"] + 0.3, ("reading the town must beat the old no-skill recipe", mean)
    assert mean["always gothic"] < mean["autopilot (lean_in)"] + 0.25, ("always-gothic must not be a winning recipe again", mean)
    assert abs(mean["autopilot (lean_in)"] - mean["cover-up"]) < 0.35, ("lean-in must not dominate cover-up (or the reverse)", mean)
    assert mean["cover-up"] > mean["worst cast + cover-up"] + 0.8, mean
    assert 2.0 <= mean["autopilot (lean_in)"] <= 2.8, mean
    assert mean["skilled"] - mean["worst cast + cover-up"] >= 1.5, mean
    assert all(v["sd"] >= 0.4 for v in m.values()), "outcomes must vary night to night"


def test_a_good_cast_beats_a_bad_cast_on_average():
    good, bad = [], []
    for seed in range(30):
        genre = GENRES[seed % 5]
        scores = casting.score_table(genre, seed, 0)
        best = casting.recommend(scores)
        worst = {r: min(scores[r], key=scores[r].get) for r in ROLES}
        if len(set(worst.values())) < 3:
            continue
        g, _, _ = _sim(genre, best, seed, town=TOWN)
        b, _, _ = _sim(genre, worst, seed, town=TOWN)
        good.append(g["quality_avg"])
        bad.append(b["quality_avg"])
    assert good and fmean(good) > fmean(bad) + 3


def test_recommendation_is_the_best_triple():
    scores = casting.score_table("farce", 3, 1)
    rec = casting.recommend(scores)
    best = max(
        (sum(scores[r][a] for r, a in zip(ROLES, trio, strict=True)), trio)
        for trio in product(sorted(world.performers()), repeat=3) if len(set(trio)) == 3
    )
    assert sum(scores[r][a] for r, a in zip(ROLES, rec.values(), strict=True)) == pytest.approx(best[0])
    assert casting.valid_cast(rec) and not casting.valid_cast({"lead": "mabel", "villain": "mabel", "fool": "gus"})


def test_every_whisper_option_resolves_for_every_mishap():
    cast = default_cast("farce")
    show = eng.init_show(seed=1, night=0, genre="farce", town=TOWN, cast=cast)
    script = make_script("farce", TOWN, cast)
    ctx = eng.beat_context(show, script, 1)
    for row in world.mishaps().values():
        m = {"id": row["id"], "kind": row["kind"], "severity": row["severity"], "actor": cast["lead"], "tags": row["tags"],
             "calamity": row["calamity"], "effects": row["effects"]}
        for opt in eng.whisper_options(row["kind"]):
            res = eng.resolve_mishap(show, ctx, m, {"option": opt["id"], "cue": None, "text": None})
            assert set(res["effects"]) == {"warmth", "chaos"}


def test_free_text_maps_to_an_option_and_earns_a_personal_touch():
    cast = default_cast("farce")
    show = eng.init_show(seed=1, night=0, genre="farce", town=TOWN, cast=cast)
    ctx = eng.beat_context(show, make_script("farce", TOWN, cast), 1)
    row = next(r for r in world.mishaps().values() if r["severity"] == "major")
    m = {"id": row["id"], "kind": row["kind"], "severity": "major", "actor": cast["lead"], "tags": row["tags"], "calamity": row["calamity"], "effects": row["effects"]}
    plain = eng.resolve_mishap(show, ctx, m, {"option": eng.whisper_options(row["kind"])[0]["id"]})
    typed = eng.resolve_mishap(show, ctx, m, {"option": None, "text": "blame the goose, quickly"})
    assert typed["text"] == "blame the goose, quickly" and typed["option"]
    assert typed["effects"]["warmth"] != plain["effects"]["warmth"] or typed["option"] != plain["option"]


def test_cue_that_fits_is_a_miracle_and_one_that_does_not_is_a_misfire():
    cast = default_cast("whodunit")
    show = eng.init_show(seed=2, night=0, genre="whodunit", town=TOWN, cast=cast)
    ctx = eng.beat_context(show, make_script("whodunit", TOWN, cast), 0)
    ctx["tags"] = ["death", "storm"]
    row = next(iter(world.mishaps().values()))
    m = {"id": row["id"], "kind": row["kind"], "severity": "major", "actor": cast["lead"], "tags": ["death"], "calamity": row["calamity"], "effects": {"warmth": 0, "chaos": 0}}
    opt = eng.whisper_options(row["kind"])[0]["id"]
    ok = eng.resolve_mishap(show, ctx, m, {"option": opt, "cue": "thunder"})
    ctx["tags"], m["tags"] = ["wedding", "kiss"], ["kiss"]
    bad = eng.resolve_mishap(show, ctx, m, {"option": opt, "cue": "thunder"})
    assert ok["cue"]["outcome"] == "miracle" and bad["cue"]["outcome"] == "misfire"
    show["cues_left"]["thunder"] = 0
    assert eng.resolve_mishap(show, ctx, m, {"option": opt, "cue": "thunder"})["cue"] is None


def test_tradition_honoured_pays_off():
    cast = default_cast("farce")
    show = eng.init_show(seed=3, night=0, genre="farce", town=TOWN, cast=cast, traditions=[{"calamity": "the_chair", "count": 3}])
    ctx = eng.beat_context(show, make_script("farce", TOWN, cast), 1)
    m = {"id": "x", "kind": "collapse", "severity": "major", "actor": cast["lead"], "tags": [], "calamity": "the_chair", "effects": {"warmth": 0, "chaos": 0}}
    chain_opt = next(o for o in eng.whisper_options("collapse") if o.get("chain"))["id"]
    res = eng.resolve_mishap(show, ctx, m, {"option": chain_opt})
    assert res["tradition"] == {"calamity": "the_chair", "bonus": 10.0}


def test_audience_is_deterministic_and_tallies():
    seats = audience.make_seats(5, 0, TOWN)
    assert len(seats) == 12 and seats == audience.make_seats(5, 0, TOWN)
    rs = [audience.seat_reaction(s, tags=["pun", "death"], mishap_tags=["slapstick"], chain=True, beat=1, seed=5, night=0) for s in seats]
    t = audience.tally(rs)
    assert sum(t["counts"].values()) == 12 and rs == [audience.seat_reaction(s, tags=["pun", "death"], mishap_tags=["slapstick"], chain=True, beat=1, seed=5, night=0) for s in seats]


def test_scripts_cover_all_beats_and_quills_differ():
    cast = default_cast("pantomime")
    drafts = {q: make_script("pantomime", TOWN, cast, quill=q) for q in ("quill_pompous", "quill_frantic", "quill_tender")}
    for d in drafts.values():
        assert [b["beat"] for b in d["beats"]] == list(BEATS) and d["title"] and d["tagline"]
    assert len({tuple(b["variant"] for b in d["beats"]) for d in drafts.values()}) >= 2


def test_morale_is_clamped_and_shifts_every_puppets_nerves():
    from tragedy.engine import tour as tour_rules

    t = tour_rules.new_tour(1)
    for _ in range(10):
        t = tour_rules.apply_effects(t, {"morale": 1})
    assert t["morale"] == 3
    cast = default_cast("farce")
    low = eng.init_show(seed=1, night=0, genre="farce", town=TOWN, cast=cast, morale=-3)
    high = eng.init_show(seed=1, night=0, genre="farce", town=TOWN, cast=cast, morale=3)
    assert eng.stage_fright(low, "gus") - eng.stage_fright(high, "gus") == 30


def test_bad_days_use_only_spare_flaws_and_are_deterministic():
    carried = {f for p in world.performers().values() for f in p["flaws"]}
    seen = 0
    for seed in range(60):
        cast = default_cast("farce", seed)
        days = eng.bad_days(seed, 0, cast)
        assert days == eng.bad_days(seed, 0, cast)
        for flaw in days.values():
            assert flaw not in carried and flaw in world.flaws()
        seen += len(days)
    assert 20 <= seen <= 90, f"~35% of 3 puppets over 60 nights, got {seen}"


def test_flaws_of_includes_the_bad_day_flaw():
    cast = default_cast("farce")
    show = eng.init_show(seed=1, night=0, genre="farce", town=TOWN, cast=cast)
    show["bad_day"] = {cast["lead"]: "corpses"}
    assert eng.flaws_of(show, cast["lead"])[-1] == "corpses"


def test_owned_props_warm_the_house_whenever_a_scene_needs_them():
    """Money must buy something: a real prop the troupe owns adds PROP_BONUS warmth per matching scene (max 2 a beat)."""
    cast = default_cast("farce", 5)
    script = make_script("farce", TOWN, cast, 5)
    # a prop that a beat of this script actually uses
    used = [p for b in script["beats"] for p in b["props"]]
    assert used
    base = eng.init_show(seed=5, night=0, genre="farce", town=TOWN, cast=cast)
    rich = eng.init_show(seed=5, night=0, genre="farce", town=TOWN, cast=cast, props_owned=sorted(set(used)))
    assert rich["props_owned"] == sorted(set(used)) and base["props_owned"] == []
    gained = 0.0
    for i in range(5):
        a, b = eng.run_beat(base, script, i), eng.run_beat(rich, script, i)
        assert a["breakdown"].get("prop_bonus", 0) == 0
        hit = [p for p in script["beats"][i]["props"] if p in rich["props_owned"]][:2]
        assert b["breakdown"]["real_props"] == hit and b["breakdown"]["prop_bonus"] == eng.PROP_BONUS * len(hit)
        gained += b["breakdown"]["prop_bonus"]
        base, rich = a["show"], b["show"]
    assert gained >= eng.PROP_BONUS, "a script's own props, once owned, must pay off at least once"
    assert rich["warmth"] > base["warmth"] - 1e-9 or gained == 0


def test_buying_a_prop_records_it_once_and_funds_are_scarce():
    from tragedy.engine import review
    from tragedy.engine import tour as tour_rules

    t = tour_rules.new_tour(1)
    assert t["props"] == []
    t = tour_rules.own_prop(tour_rules.own_prop(t, "chandelier"), "chandelier")
    assert t["props"] == ["chandelier"], "owning a prop twice does not duplicate it"
    # income: a great night (5 stars, warmth 90) earns ~9, not ~18: the purse must not run away over a tour
    assert 5 <= review.funds_delta(4.0, 80) <= 9 and review.funds_delta(5.0, 100) <= 12
