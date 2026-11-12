"""The dataset checker: it must pass the real content and catch each kind of authoring mistake on purpose."""

from __future__ import annotations

import copy
import io

import pytest

from tragedy.data import build, check
from tragedy.data.check import check_data, format_report

OWN = ("performers", "staff", "flaws", "mishaps", "whispers", "cues", "props")


@pytest.fixture(scope="module")
def real():
    data, problems = build.collect()
    assert not problems, problems
    return data


@pytest.fixture
def own(real):
    """A private deep copy of the cast/comedy tables to break."""
    return {k: copy.deepcopy(real[k]) for k in OWN}


def errors(data, needle=None):
    msgs = check_data(data).messages("error")
    return [m for m in msgs if needle in m] if needle else msgs


def test_real_cast_tables_pass(own):
    report = check_data(own)
    assert report.ok, "\n".join(report.messages("error"))
    assert not report.warnings, "\n".join(report.messages("warning"))


def test_whole_corpus_passes(real):
    """Everything every worker has written, together (cross-dataset integrity included)."""
    report = check_data(real)
    assert report.ok, "\n".join(report.messages("error"))


def test_catches_a_broken_tag(own):
    own["mishaps"][0]["tags"] = ["slapstick", "banana"]
    found = errors(own, "banana")
    assert found and "tag vocabulary" in found[0]


def test_catches_a_bad_calamity(own):
    own["mishaps"][0]["calamity"] = "the_unexpected_hedgehog"
    assert errors(own, "the_unexpected_hedgehog")


def test_catches_an_unused_calamity(own):
    for m in own["mishaps"]:
        if m["calamity"] == "the_moon":
            m["calamity"] = "the_lean"
    assert errors(own, "'the_moon' is never used")


def test_catches_a_missing_whisper_kind(own):
    own["whispers"] = [w for w in own["whispers"] if w["kind"] != "corpse"]
    found = errors(own)
    assert any("missing whisper kind(s): corpse" in m for m in found)
    assert any("kind 'corpse' has no entry in whispers.json" in m for m in found)


def test_catches_a_whisper_without_a_chain_or_cover_option(own):
    option = own["whispers"][0]["options"][0]
    option["chain"] = False
    assert any("exactly one chain:true" in m for m in errors(own))
    option["chain"] = True
    own["whispers"][0]["options"][1]["effects"]["chaos"] = -2
    assert any("chaos-reducing" in m for m in errors(own))


def test_whisper_needs_exactly_three_options(own):
    own["whispers"][3]["options"].pop()
    assert any("needs 3..3" in m or "has 2 items" in m for m in errors(own))


def test_catches_an_unknown_placeholder_and_malformed_braces(own):
    own["mishaps"][0]["text"] = "{actor} meets {nobody}."
    own["mishaps"][1]["text"] = "{actor} is unbalanced {"
    found = errors(own)
    assert any("unknown placeholder" in m and "{nobody}" in m for m in found)
    assert any("malformed braces" in m for m in found)


def test_catches_a_flaw_with_too_few_mishaps(own):
    seen, kept = 0, []
    for m in own["mishaps"]:
        if m["flaw"] == "corpses":
            seen += 1
            if seen > 1:
                continue
        kept.append(m)
    own["mishaps"] = kept
    assert any("flaws[corpses]" in m and ">= 2" in m for m in errors(own))


def test_flaw_needs_a_minor_and_a_major(own):
    for m in own["mishaps"]:
        if m["flaw"] == "leans_left":
            m["severity"] = "major"
    assert any("[leans_left]" in m and "no minor" in m for m in errors(own))


def test_mishap_kind_must_belong_to_its_flaw(own):
    mishap = next(m for m in own["mishaps"] if m["flaw"] == "speaks_in_rhyme")
    mishap["kind"] = "feast"
    assert any(f"[{mishap['id']}].kind" in m and "speaks_in_rhyme" in m for m in errors(own))


def test_unknown_flaw_references(own):
    own["performers"][0]["flaws"] = ["leans_left", "sneezes_in_italics"]
    assert errors(own, "sneezes_in_italics")
    own["mishaps"][0]["flaw"] = "nobody_has_this"
    assert errors(own, "nobody_has_this")


def test_every_role_needs_three_candidates(own):
    for p in own["performers"]:
        p["roles"] = [r for r in p["roles"] if r != "villain"]
    assert errors(own, "role 'villain' has 0 natural candidate")


def test_nobody_may_dominate(own):
    mabel = next(p for p in own["performers"] if p["id"] == "mabel")
    mabel["skills"] = dict.fromkeys(mabel["skills"], 99)
    assert errors(own, "best at 6 of 6 skills")


def test_range_checks(own):
    own["performers"][0]["stage_fright"] = 99
    own["flaws"][0]["intensity"] = 0.95
    own["mishaps"][0]["effects"] = {"warmth": -20, "chaos": 40}
    found = errors(own)
    assert any("stage_fright" in m for m in found)
    assert any("intensity" in m for m in found)
    assert any("effects.warmth" in m for m in found) and any("effects.chaos" in m for m in found)


def test_duplicate_ids(own):
    own["flaws"].append(copy.deepcopy(own["flaws"][0]))
    assert any("duplicate id" in m and "leans_left" in m for m in errors(own))


def test_counts(own):
    own["mishaps"] = own["mishaps"][:20]
    assert errors(own, "has 20 rows, needs at least 80")


def test_the_understudy_rules(own):
    gus = next(p for p in own["performers"] if p["id"] == "gus")
    gus["roles"] = ["lead"]
    gus["flaws"] = ["leans_left"]
    found = errors(own)
    assert any("roles []" in m for m in found)
    assert any("never_been_on_stage" in m for m in found)


def test_props_are_exactly_the_vocabulary(own):
    own["props"][0]["id"] = "trebuchet"
    own["props"][0]["draw"] = "trebuchet"
    found = errors(own)
    assert any("missing prop 'sword'" in m for m in found)
    assert any("trebuchet" in m for m in found)


def test_implied_prop_tags(own):
    sword = next(p for p in own["props"] if p["id"] == "sword")
    sword["tags"] = []
    assert errors(own, "must include 'sword'")


def test_cues_have_the_six_ids(own):
    own["cues"] = [c for c in own["cues"] if c["id"] != "fog"]
    assert any("missing required id(s): fog" in m for m in errors(own))


def test_garbage_does_not_crash_the_checker():
    report = check_data(
        {
            "performers": "not a list",
            "staff": [1, 2, 3],
            "flaws": [{"id": 5, "triggers": "everything"}],
            "mishaps": [{"id": "x", "effects": [], "tags": None}],
            "whispers": [{"kind": "collapse", "options": "none"}],
            "genres": {"farce": 1},
            "towns": [None],
            "playbill": [],
            "hats": [],
        }
    )
    assert not report.ok
    assert not any("checker crashed" in m for m in report.messages("error")), report.messages("error")
    assert any("unknown dataset name" in m for m in report.messages("error"))


def test_other_datasets_are_validated_when_present(real):
    towns = copy.deepcopy(real.get("towns"))
    if towns is None:
        pytest.skip("towns not written yet")
    towns[0]["temperament"]["expects"] = "the_hedgehog"
    towns[1]["temperament"]["likes"] = ["goose"]
    towns[1]["temperament"]["hates"] = ["goose"]
    found = errors({"towns": towns})
    assert any("the_hedgehog" in m for m in found)
    assert any("disjoint" in m for m in found)


def test_special_town_is_enforced(real):
    towns = copy.deepcopy(real.get("towns"))
    if towns is None:
        pytest.skip("towns not written yet")
    towns = [t for t in towns if t["id"] != "wibbling_opera"]
    assert any("wibbling_opera" in m for m in errors({"towns": towns}))


def test_genre_props_must_exist(real):
    genres = copy.deepcopy(real.get("genres"))
    if genres is None:
        pytest.skip("genres not written yet")
    variant = genres[0]["beats"]["setup"][0]
    variant["props"] = ["door", "flying_pig"]
    assert any("flying_pig" in m for m in errors({"genres": genres}))


def test_report_format(own):
    own["mishaps"][0]["tags"] = ["banana"]
    text = format_report(check_data(own))
    assert text.startswith("tragedy.data check")
    assert "ERROR   mishaps[" in text and "RESULT: FAIL" in text
    good = format_report(check_data({k: v for k, v in own.items() if k == "cues"}))
    assert "RESULT: ok" in good and "not written yet" in good


def test_run_check_exit_codes(monkeypatch, real):
    out = io.StringIO()
    monkeypatch.setattr(build, "collect", lambda **kw: (copy.deepcopy({k: real[k] for k in OWN}), []))
    monkeypatch.setattr(build, "drift", lambda *a, **kw: ([], []))
    assert check.run_check(out=out) == 0
    bad = copy.deepcopy({k: real[k] for k in OWN})
    bad["mishaps"][0]["tags"] = ["banana"]
    monkeypatch.setattr(build, "collect", lambda **kw: (bad, []))
    assert check.run_check(out=out, quiet=True) == 1
    monkeypatch.setattr(build, "collect", lambda **kw: ({}, ["content/oops.py failed to import: boom"]))
    assert check.run_check(out=out) == 1


# ---------------------------------------------------------------------------------------------- road events: real trade-offs
def _road(real):
    return {k: copy.deepcopy(real[k]) for k in ("performers", "road_events")}


def test_a_road_choice_strictly_worse_than_a_sibling_is_rejected(real):
    """A playtest found 11 of 20 events with an option nobody would ever pick ('Sit out the storm: -1 morale')."""
    data = _road(real)
    barn = next(e for e in data["road_events"] if e["id"] == "barn_pigeons")
    barn["choices"][1] = {"id": "sit_it_out", "label": "Sit out the storm", "effects": {"funds": 0, "morale": -1}}
    found = errors(data, "strictly worse")
    assert found and any("sit_it_out" in m for m in found)


def test_equal_choices_are_not_called_dominated_but_a_pure_cost_is(real):
    data = _road(real)
    ev = next(e for e in data["road_events"] if e["id"] == "goose_trophy")
    ev["choices"][1]["effects"] = dict(ev["choices"][0]["effects"])  # identical effects: a tie, not a domination
    assert not errors(data, "strictly worse")
    ev["choices"][1]["effects"] = {"funds": -1, "morale": 0}  # now only a cost
    assert errors(data, "strictly worse")


def test_a_label_that_announces_funds_or_encore_must_match_the_effect(real):
    data = _road(real)
    ev = next(e for e in data["road_events"] if e["id"] == "weighbridge_mystery")
    pay = next(c for c in ev["choices"] if c["id"] == "pay")
    assert "-2 funds" in pay["label"]
    pay["effects"]["funds"] = -1
    assert errors(data, "label says -2 funds but the effect is -1")
    trophy = next(e for e in data["road_events"] if e["id"] == "goose_trophy")
    accept = next(c for c in trophy["choices"] if c["id"] == "accept")
    accept["effects"].pop("encore")
    assert errors(data, "label says +1 encore but the effect is +0")


def test_every_real_road_event_is_a_real_decision(real):
    for ev in real["road_events"]:
        assert len(ev["choices"]) >= 2, ev["id"]
    assert not errors({k: real[k] for k in ("performers", "road_events")}, "strictly worse")
