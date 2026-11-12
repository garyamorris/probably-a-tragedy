"""The five genres' scripted beats (docs/DATA.md section 7): shape, vocabulary, voice limits and tag coverage.

These tests read the authored content (``tragedy.data.content.genres``), not the generated ``datasets/genres.json``, so
they hold whether or not ``python -m tragedy.data build`` has been run since the last edit.
"""

from __future__ import annotations

import re
from collections import Counter

import pytest

from tragedy.data import tags as T
from tragedy.data.content.genres import DATASETS

GENRES = DATASETS["genres"]
PLACEHOLDERS = {"lead", "villain", "fool", "place", "town", "object"}
HEX = re.compile(r"^#[0-9a-fA-F]{6}$")
BRACES = re.compile(r"\{([^{}]*)\}")
MIN_TAG_USES = 3
# tags a genre must carry somewhere (DATA.md: romance, death, door, feast, speech and slapstick-ish tags)
MUST_CARRY = ("romance", "death", "door", "feast", "speech", "slapstick")
SLAPSTICKISH = {"slapstick", "chase", "stairs", "chair", "chandelier"}


def _variants():
    for g in GENRES:
        for beat in T.BEATS:
            for v in g["beats"][beat]:
                yield g, beat, v


def _tag_counts() -> Counter[str]:
    return Counter(t for _g, _b, v in _variants() for t in v["tags"])


def test_five_genres_in_vocabulary_order():
    assert [g["id"] for g in GENRES] == list(T.GENRES)


@pytest.mark.parametrize("genre", GENRES, ids=lambda g: g["id"])
def test_genre_header(genre):
    assert set(genre) == {"id", "name", "blurb", "palette", "roles", "skill_by_beat", "sets", "beats"}
    assert genre["name"].strip() and genre["blurb"].strip() and len(genre["blurb"]) <= 140
    assert set(genre["palette"]) == {"sky", "flat", "floor", "accent"}
    assert all(HEX.match(c) for c in genre["palette"].values())
    assert set(genre["roles"]) == set(T.ROLES)
    assert all(label.strip() and len(label) <= 40 for label in genre["roles"].values())
    assert len(set(genre["roles"].values())) == 3
    assert set(genre["skill_by_beat"]) == set(T.BEATS)
    assert set(genre["skill_by_beat"].values()) <= set(T.SKILLS)
    assert set(genre["sets"]) == set(T.BEATS)
    assert set(genre["sets"].values()) <= set(T.SETS)
    assert set(genre["beats"]) == set(T.BEATS)


def test_genre_flavour_is_distinct():
    palettes = [tuple(g["palette"].values()) for g in GENRES]
    assert len(set(palettes)) == len(GENRES)
    labels = [label for g in GENRES for label in g["roles"].values()]
    assert len(set(labels)) == len(labels), "role labels should be genre-specific"
    # skill leanings from DATA.md: melodrama drama/menace, farce comedy/physical/improv, whodunit menace/improv/drama,
    # gothic_romance romance/drama, pantomime comedy/improv/physical
    lean = {
        "melodrama": {"drama", "menace", "romance"},
        "farce": {"comedy", "physical", "improv"},
        "whodunit": {"menace", "improv", "drama"},
        "gothic_romance": {"romance", "drama"},
        "pantomime": {"comedy", "improv", "physical"},
    }
    for g in GENRES:
        assert set(g["skill_by_beat"].values()) <= lean[g["id"]], g["id"]


@pytest.mark.parametrize("genre", GENRES, ids=lambda g: g["id"])
def test_five_to_six_variants_per_beat(genre):
    for beat in T.BEATS:
        assert 5 <= len(genre["beats"][beat]) <= 6, (genre["id"], beat)


def test_variant_totals():
    variants = list(_variants())
    assert len(variants) >= 125
    assert sum(len(v["lines"]) for _g, _b, v in variants) >= 440


def test_variant_ids_unique_and_well_formed():
    seen: set[str] = set()
    for g, beat, v in _variants():
        assert re.fullmatch(rf"{g['id']}_{beat}_\d+", v["id"]), v["id"]
        assert v["id"] not in seen, f"duplicate id {v['id']}"
        seen.add(v["id"])
    for g in GENRES:
        for beat in T.BEATS:
            ids = [v["id"] for v in g["beats"][beat]]
            assert ids == [f"{g['id']}_{beat}_{n}" for n in range(1, len(ids) + 1)]


def test_variant_shape_tags_props_lines():
    for _g, _beat, v in _variants():
        assert set(v) == {"id", "logline", "tags", "props", "lines"}, v["id"]
        assert v["logline"].strip() and len(v["logline"]) <= 140, v["id"]
        assert 2 <= len(v["tags"]) <= 3, v["id"]
        assert len(set(v["tags"])) == len(v["tags"]), f"{v['id']} repeats a tag"
        assert set(v["tags"]) <= set(T.TAGS), (v["id"], set(v["tags"]) - set(T.TAGS))
        assert 1 <= len(v["props"]) <= 3, v["id"]
        assert len(set(v["props"])) == len(v["props"]), v["id"]
        assert set(v["props"]) <= set(T.PROPS), (v["id"], set(v["props"]) - set(T.PROPS))
        assert 3 <= len(v["lines"]) <= 4, v["id"]
        speakers = {ln["role"] for ln in v["lines"]}
        assert len(speakers) >= 2, f"{v['id']}: only one role speaks"


def test_tag_sets_differ_within_a_beat():
    for g in GENRES:
        for beat in T.BEATS:
            sets = [frozenset(v["tags"]) for v in g["beats"][beat]]
            assert len(set(sets)) == len(sets), (g["id"], beat)


def test_lines_are_speakable_and_short():
    for _g, _beat, v in _variants():
        for ln in v["lines"]:
            assert set(ln) == {"role", "text"}
            assert ln["role"] in T.ROLES
            text = ln["text"]
            assert text.strip() == text and text, v["id"]
            assert len(text) <= 140, (v["id"], len(text), text)
            assert "  " not in text, (v["id"], text)
        # a variant should not repeat itself
        texts = [ln["text"] for ln in v["lines"]]
        assert len(set(texts)) == len(texts), v["id"]


def test_placeholders_are_whitelisted_and_well_formed():
    for _g, _beat, v in _variants():
        strings = [v["logline"], *(ln["text"] for ln in v["lines"])]
        for s in strings:
            assert s.count("{") == s.count("}"), (v["id"], s)
            for name in BRACES.findall(s):
                assert name in PLACEHOLDERS, (v["id"], name, s)
            stripped = BRACES.sub("", s)
            assert "{" not in stripped and "}" not in stripped, (v["id"], s)
        used = {name for s in strings for name in BRACES.findall(s)}
        if "object" in used:
            assert v["props"], f"{v['id']} uses {{object}} but lists no props"


def test_object_lines_survive_any_prop_name():
    # {object} becomes a Title Case prop name ("Probably Secure Chandelier"): always introduce it with 'the', never a/an
    for _g, _beat, v in _variants():
        for ln in v["lines"]:
            for m in re.finditer(r"(\w+)\s+\{object\}", ln["text"]):
                assert m.group(1).lower() not in {"a", "an"}, (v["id"], ln["text"])


def test_every_tag_is_carried_by_enough_variants():
    counts = _tag_counts()
    thin = {t: counts[t] for t in T.TAGS if counts[t] < MIN_TAG_USES}
    assert not thin, f"tags carried by fewer than {MIN_TAG_USES} variants: {thin}"


def test_tag_coverage_is_broad_overall_and_per_genre():
    assert len({t for _g, _b, v in _variants() for t in v["tags"]}) == len(T.TAGS)
    for g in GENRES:
        used = {t for beat in T.BEATS for v in g["beats"][beat] for t in v["tags"]}
        assert len(used) >= 24, f"{g['id']} only touches {len(used)} of {len(T.TAGS)} tags"


@pytest.mark.parametrize("genre", GENRES, ids=lambda g: g["id"])
def test_genre_carries_the_core_hooks(genre):
    counts = Counter(t for beat in T.BEATS for v in genre["beats"][beat] for t in v["tags"])
    for tag in MUST_CARRY:
        assert counts[tag] >= 1, f"{genre['id']} never carries {tag!r}"
    assert sum(counts[t] for t in SLAPSTICKISH) >= 3, f"{genre['id']} is short on slapstick-ish tags"


@pytest.mark.parametrize("genre", GENRES, ids=lambda g: g["id"])
def test_beats_escalate_through_different_sets_and_skills(genre):
    # setup establishes, the middle beats move the play around the house, the finale may come home
    assert len(set(genre["sets"].values())) >= 4, genre["id"]
    assert len(set(genre["skill_by_beat"].values())) >= 2, genre["id"]


def test_flaw_hooks_appear_in_every_beat_of_the_file():
    """Mishaps fire when a flaw's triggers meet a beat's tags: every beat needs plenty of the classic hooks somewhere.

    (Setups establish rather than brawl, so the bar is 6 of the 12, not 12.)"""
    hooks = {"kiss", "stairs", "dance", "sword", "death", "rhyme", "door", "chair", "chandelier", "feast", "song", "speech"}
    for beat in T.BEATS:
        seen = {t for g in GENRES for v in g["beats"][beat] for t in v["tags"]}
        assert len(seen & hooks) >= 6, (beat, sorted(hooks - seen))
