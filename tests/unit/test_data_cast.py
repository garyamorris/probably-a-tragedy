"""Balance and hygiene of the cast / comedy-mechanics tables (performers, staff, flaws, mishaps, whispers, cues, props).

The checker enforces schema and referential integrity; these tests pin the *design* the engine leans on.
"""

from __future__ import annotations

import re
from collections import Counter

import pytest

from tragedy.data import build
from tragedy.data import tags as T


@pytest.fixture(scope="module")
def data():
    d, problems = build.collect()
    assert not problems, problems
    return d


@pytest.fixture(scope="module")
def performers(data):
    return {p["id"]: p for p in data["performers"]}


@pytest.fixture(scope="module")
def flaws(data):
    return {f["id"]: f for f in data["flaws"]}


# ------------------------------------------------------------------------------------------------ performers
def test_the_cast_is_the_cast(performers):
    assert list(performers) == ["mabel", "reginald", "gus", "goose", "hortensia", "bartleby", "poppet", "tock"]


@pytest.mark.parametrize("role", T.ROLES)
def test_every_role_has_at_least_three_natural_candidates(performers, role):
    candidates = [p for p in performers.values() if role in p["roles"]]
    assert len(candidates) >= 3


def test_natural_candidates_are_actually_good_at_it(performers):
    relevant = {"lead": ("drama", "romance"), "villain": ("menace", "drama"), "fool": ("comedy", "physical", "improv")}
    for p in performers.values():
        for role in p["roles"]:
            assert max(p["skills"][s] for s in relevant[role]) >= 55, (p["id"], role)


def test_nobody_is_best_at_everything(performers):
    tops = Counter()
    for skill in T.SKILLS:
        best = max(p["skills"][skill] for p in performers.values())
        tops.update(pid for pid, p in performers.items() if p["skills"][skill] == best)
    assert max(tops.values()) <= 2, tops
    assert len(tops) >= 4, "the skills should be spread across at least four puppets"


def test_strengths_and_weaknesses(performers):
    for pid, p in performers.items():
        if pid == "gus":
            continue
        assert max(p["skills"].values()) >= 65, f"{pid} needs a real strength"
        assert min(p["skills"].values()) <= 35, f"{pid} needs a real weakness"


def test_means_are_close(performers):
    means = {pid: sum(p["skills"].values()) / 6 for pid, p in performers.items()}
    assert max(means.values()) - min(means.values()) <= 15, means


def test_stage_fright_range_and_spread(performers):
    fears = [p["stage_fright"] for p in performers.values()]
    assert all(10 <= f <= 70 for f in fears)
    assert max(fears) - min(fears) >= 30
    assert performers["gus"]["stage_fright"] == max(fears), "the understudy has never been on stage"


def test_the_understudy(performers):
    gus = performers["gus"]
    assert gus["roles"] == []
    assert "never_been_on_stage" in gus["flaws"]
    assert all(p["roles"] for pid, p in performers.items() if pid != "gus")


def test_each_puppet_has_one_or_two_flaws_and_no_flaw_is_shared(performers):
    carried = [f for p in performers.values() for f in p["flaws"]]
    assert all(1 <= len(p["flaws"]) <= 2 for p in performers.values())
    assert len(carried) == len(set(carried))


def test_mabel_matches_the_design_doc(performers):
    mabel = performers["mabel"]
    assert mabel["kind"] == "marionette" and mabel["roles"] == ["lead"]
    assert mabel["skills"]["drama"] == 78 and mabel["skills"]["romance"] == 74
    assert mabel["stage_fright"] == 35 and "leans_left" in mabel["flaws"]


def test_heads_are_distinct_so_the_stage_can_tell_them_apart(performers):
    heads = [p["build"]["head"] for p in performers.values()]
    assert len(set(heads)) == len(heads)


def test_staff(data):
    staff = {s["id"]: s for s in data["staff"]}
    assert {"madame", "quill_pompous", "quill_frantic", "quill_tender", "clipboard", "gasket", "narrator"} <= set(staff)
    for qid in ("quill_pompous", "quill_frantic", "quill_tender"):
        assert staff[qid]["kind"] == "heron" and staff[qid]["style"]
    assert "Darling, no." in staff["madame"]["voice"]["catchphrases"]
    assert all(re.search(r"\d", line) for line in staff["clipboard"]["voice"]["catchphrases"])
    assert len({tuple(staff[q]["favours"]) for q in ("quill_pompous", "quill_frantic", "quill_tender")}) == 3


# ------------------------------------------------------------------------------------------------ flaws & mishaps
def test_flaw_count_and_ranges(flaws):
    assert 24 <= len(flaws) <= 30
    assert all(0.2 <= f["intensity"] <= 0.7 for f in flaws.values())
    assert all(2 <= len(f["triggers"]) <= 5 for f in flaws.values())


def test_the_carried_flaws_are_not_all_on_one_difficulty(flaws, performers):
    for pid, p in performers.items():
        load = sum(flaws[f]["intensity"] for f in p["flaws"])
        assert 0.8 <= load <= 1.25, (pid, load)


def test_mishap_counts_and_mix(data):
    mishaps = data["mishaps"]
    assert 80 <= len(mishaps) <= 110
    major = sum(m["severity"] == "major" for m in mishaps)
    assert 0.3 <= major / len(mishaps) <= 0.55
    assert {m["calamity"] for m in mishaps} == set(T.CALAMITIES)
    assert {m["kind"] for m in mishaps} == set(T.MISHAP_KINDS)
    assert {m["anim"] for m in mishaps} == set(T.ANIMS)


def test_every_flaw_has_a_minor_and_a_major(data, flaws):
    by_flaw: dict[str, set[str]] = {f: set() for f in flaws}
    for m in data["mishaps"]:
        by_flaw[m["flaw"]].add(m["severity"])
    assert all(sev == {"minor", "major"} for sev in by_flaw.values()), by_flaw


def test_every_calamity_is_reachable_through_a_carried_flaw(data, performers):
    carried = {f for p in performers.values() for f in p["flaws"]}
    reachable = {m["calamity"] for m in data["mishaps"] if m["flaw"] in carried}
    assert reachable == set(T.CALAMITIES), "a town can expect any calamity, so the cast must be able to cause all 28"


def test_minor_and_major_effects(data):
    for m in data["mishaps"]:
        e = m["effects"]
        if m["severity"] == "minor":
            assert -1 <= e["warmth"] <= 2 and 2 <= e["chaos"] <= 6, m["id"]
        else:
            assert -3 <= e["warmth"] <= 2 and 8 <= e["chaos"] <= 11, m["id"]


def test_mishaps_are_written_to_be_read_aloud(data):
    pronouns = re.compile(r"\b(he|she|his|her|hers|him|himself|herself|he's|she's)\b", re.I)
    for m in data["mishaps"]:
        assert "{actor}" in m["text"] or "{actor}" in m["title"], m["id"]
        assert not pronouns.search(m["text"] + " " + m["title"]), (
            f"{m['id']}: no pronouns, any puppet may catch the flaw"
        )
        assert len(m["text"]) <= 150 and len(m["title"]) <= 46, m["id"]
        assert m["text"].rstrip().endswith((".", "'", "!", "?")), m["id"]


def test_flaws_text_has_no_pronouns(flaws):
    pronouns = re.compile(r"\b(he|she|his|her|him|himself|herself)\b", re.I)
    assert not [f["id"] for f in flaws.values() if pronouns.search(f["text"])]


def test_objects_are_introduced_not_assumed(data):
    """A mishap that needs a specific hand prop brings it on itself (Mrs. Gasket) instead of assuming it is on stage."""
    for m in data["mishaps"]:
        if m["calamity"] == "the_cake":
            assert "cake" in m["text"].lower() and ("Gasket" in m["text"] or "wedding cake" in m["text"]), m["id"]


# ------------------------------------------------------------------------------------------------ whispers
def test_one_entry_per_mishap_kind_plus_generic(data):
    assert [w["kind"] for w in data["whispers"]] == [*T.MISHAP_KINDS, "generic"]


def test_every_whisper_kind_has_the_same_three_way_shape(data):
    for w in data["whispers"]:
        opts = {o["id"]: o for o in w["options"]}
        assert len(w["options"]) == 3 and len(opts) == 3, w["kind"]
        chain = [o for o in w["options"] if o["chain"]]
        assert [o["id"] for o in chain] == ["lean_in"], w["kind"]
        cover = [o for o in w["options"] if o["effects"]["chaos"] <= -5]
        assert [o["id"] for o in cover] == ["cover_up"], w["kind"]
        lean, cov, third = (
            opts["lean_in"],
            opts["cover_up"],
            next(o for i, o in opts.items() if i not in ("lean_in", "cover_up")),
        )
        # retuned after the fun audit (data/content/whispers.py): lean is louder, cover-up is warmer, so neither is a fixed answer
        assert lean["effects"]["warmth"] >= 2 and lean["effects"]["chaos"] >= 7
        assert cov["effects"]["warmth"] <= 1 and cov["effects"]["warmth"] >= -1 and cov["effects"]["chaos"] <= -5
        assert third["effects"]["chaos"] <= 4 and third["effects"]["warmth"] >= 2, "the third way is the gentle middle"
        assert len({o["line"] for o in w["options"]}) == 3
        assert all(o["line"].startswith("(whispering)") for o in w["options"]), w["kind"]


def test_whispers_add_tags_with_variety(data):
    tags = Counter(o["adds_tag"] for w in data["whispers"] for o in w["options"] if o["adds_tag"])
    assert len(tags) >= 8, "different whispers should land differently on different towns"
    assert tags["goose"] >= 2, "blame the goose is a recurring classic"


def test_keywords_are_lowercase_single_words(data):
    for w in data["whispers"]:
        for o in w["options"]:
            assert o["keywords"], (w["kind"], o["id"])
            assert all(k == k.lower() and " " not in k for k in o["keywords"])


# ------------------------------------------------------------------------------------------------ cues & props
def test_cues(data):
    cues = {c["id"]: c for c in data["cues"]}
    assert list(cues) == ["lights", "thunder", "trapdoor", "fog", "spotlight", "curtain"]
    assert cues["thunder"]["misfire_text"] == "Thunder, at a wedding. Someone's aunt faints."
    for c in cues.values():
        assert c["effects"]["warmth"] > 0 > c["effects"]["chaos"]
        assert c["misfire"]["warmth"] < 0 <= c["misfire"]["chaos"]
        assert 1 <= c["uses"] <= 3 and len(c["fits"]) >= 3
    assert cues["curtain"]["uses"] == 1 and cues["curtain"]["effects"]["chaos"] <= -8, (
        "the curtain is the nuclear cover-up"
    )


def test_every_tag_is_fit_by_some_cue_or_whisper_or_none_needed(data):
    """Cues should collectively cover the common dramatic tags, or they can never be a miracle."""
    fits = {t for c in data["cues"] for t in c["fits"]}
    assert {"storm", "death", "romance", "slapstick", "speech", "ghost", "secret", "wedding"} <= fits


def test_props(data):
    props = {p["id"]: p for p in data["props"]}
    assert set(props) == set(T.PROPS) and all(p["draw"] == p["id"] for p in props.values())
    assert {"sword", "chandelier", "goose"} <= {t for pid, p in props.items() for t in p["tags"] if pid == t}
    assert len({p["name"] for p in props.values()}) == 30
    assert sum(not p["tags"] for p in props.values()) <= 4


def test_prop_tags_let_the_props_set_off_flaws(data, flaws):
    """Props are how a flaw gets set off on stage: every carried prop-flavoured trigger has a prop that carries it."""
    prop_tags = {t for p in data["props"] for t in p["tags"]}
    for fid in ("falls_in_love_with_props", "allergic_to_feathers", "afraid_of_the_chandelier", "eats_the_props"):
        assert set(flaws[fid]["triggers"]) & prop_tags, fid
