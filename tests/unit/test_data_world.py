"""World / audience / critics / lore datasets (docs/DATA.md sections 8-13): towns, tastes, critics, playbill, road_events,
almanac_seeds. Tests run against the authored content modules, so they need no generated files."""

from __future__ import annotations

import itertools
import re
from collections import Counter

import pytest

from tragedy.data import tags as T
from tragedy.data.content import almanac_seeds, critics, playbill, road_events, tastes, towns

PLACEHOLDER = re.compile(r"\{([A-Za-z_]+)\}")
CRITIC_PLACEHOLDERS = {"show", "lead", "villain", "fool", "town", "mishap", "calamity", "tradition", "snack"}
PERFORMER_IDS = {"mabel", "reginald", "gus", "goose", "hortensia", "bartleby", "poppet", "tock"}
HEX = re.compile(r"^#[0-9a-fA-F]{6}$")
SLUG = re.compile(r"^[a-z][a-z0-9_]*$")

# the tags each genre's beats lean on (docs/DATA.md section 7), so a town's temperament makes the genre choice matter
GENRE_TAGS = {
    "melodrama": {"murder", "death", "betrayal", "letter"},
    "farce": {"door", "chair", "slapstick", "mistaken_identity"},
    "whodunit": {"poison", "murder", "secret", "lie"},
    "gothic_romance": {"ghost", "storm", "romance", "mourning"},
    "pantomime": {"goose", "pun", "song", "dance", "feast"},
}

TOWNS = towns.DATASETS["towns"]
TASTES = tastes.DATASETS["tastes"]
CRITICS = critics.DATASETS["critics"]
PLAYBILL = playbill.DATASETS["playbill"]
ROAD = road_events.DATASETS["road_events"]
LEGENDS = almanac_seeds.DATASETS["almanac_seeds"]
TOWN_BY_ID = {t["id"]: t for t in TOWNS}
TASTE_BY_ID = {t["id"]: t for t in TASTES}


def words(template: str) -> int:
    return len(PLACEHOLDER.sub("word", template).split())


def placeholders(text: str) -> set[str]:
    return set(PLACEHOLDER.findall(text))


def assert_clean(text: str) -> None:
    assert isinstance(text, str) and text.strip(), "empty string"
    assert text == text.strip(), f"stray whitespace: {text!r}"
    assert "  " not in text, f"double space: {text!r}"
    assert text.count("{") == text.count("}"), f"unbalanced braces: {text!r}"


def test_module_exports_match_dataset_names():
    for mod, name in [
        (towns, "towns"), (tastes, "tastes"), (critics, "critics"), (playbill, "playbill"),
        (road_events, "road_events"), (almanac_seeds, "almanac_seeds"),
    ]:
        assert set(mod.DATASETS) == {name}


# ------------------------------------------------------------------------------------------------------------ towns
def test_town_count_and_ids():
    assert len(TOWNS) == 30
    ids = [t["id"] for t in TOWNS]
    assert len(set(ids)) == 30
    assert all(SLUG.match(i) for i in ids)
    assert len({t["name"] for t in TOWNS}) == 30


def test_town_fields_use_the_closed_vocabularies():
    for t in TOWNS:
        assert set(t) == {"id", "name", "blurb", "sky", "landmark", "temperament", "audience", "gossip"}
        for key in ("name", "blurb", "gossip"):
            assert_clean(t[key])
        assert t["sky"] in T.SKIES
        assert t["landmark"] in T.LANDMARKS
        temp = t["temperament"]
        assert set(temp) == {"likes", "hates", "expects", "openness", "favours", "scorns"}
        assert temp["favours"] in T.GENRES and temp["scorns"] in T.GENRES and temp["favours"] != temp["scorns"], t["id"]
        for side in ("likes", "hates"):
            assert 1 <= len(temp[side]) <= 3, t["id"]
            assert len(set(temp[side])) == len(temp[side])
            assert set(temp[side]) <= set(T.TAGS), (t["id"], set(temp[side]) - set(T.TAGS))
        assert not set(temp["likes"]) & set(temp["hates"]), t["id"]
        assert temp["expects"] is None or temp["expects"] in T.CALAMITIES
        assert 0 <= temp["openness"] <= 1
        aud = t["audience"]
        assert set(aud) == {"mix", "hat_bias"}
        assert aud["hat_bias"] in T.HATS
        assert len(aud["mix"]) == 3 and len(set(aud["mix"])) == 3
        assert set(aud["mix"]) <= set(TASTE_BY_ID), t["id"]


def test_town_copy_is_short_and_one_sentence():
    for t in TOWNS:
        assert 7 <= len(t["blurb"].split()) <= 16, t["blurb"]
        assert len(t["blurb"]) <= 80, (t["id"], len(t["blurb"]))
        assert len(t["gossip"]) <= 140, (t["id"], len(t["gossip"]))
        assert t["gossip"].endswith("."), t["gossip"]
        assert not re.search(r"[.!?] ", t["gossip"]), f"gossip should be one sentence: {t['gossip']!r}"


def test_the_special_town_is_exactly_as_specified():
    wibbling = TOWN_BY_ID[T.SPECIAL_TOWN]
    assert wibbling["name"] == "The Royal Opera House of Wibbling"
    assert sorted(wibbling["temperament"]["likes"]) == ["crown", "song", "speech"]
    assert sorted(wibbling["temperament"]["hates"]) == ["goose", "slapstick"]
    assert wibbling["temperament"]["expects"] == "the_chandelier"
    assert wibbling["temperament"]["openness"] == 0.2


def test_expectations_are_spread_widely():
    expects = [t["temperament"]["expects"] for t in TOWNS]
    non_null = [e for e in expects if e]
    assert 22 <= len(non_null) <= 28
    assert len(set(non_null)) >= 22, "most towns should expect a different calamity"
    assert Counter(non_null).most_common(1)[0][1] <= 2


def test_skies_landmarks_and_hats_are_varied():
    assert set(T.SKIES) <= {t["sky"] for t in TOWNS}
    assert set(T.LANDMARKS) <= {t["landmark"] for t in TOWNS}
    assert len({t["audience"]["hat_bias"] for t in TOWNS}) >= 7
    openness = [t["temperament"]["openness"] for t in TOWNS]
    assert min(openness) <= 0.25 and max(openness) >= 0.8


def test_genre_choice_matters_for_towns():
    """Every genre has towns that warm to it and towns that recoil from it."""
    for genre, tag_set in GENRE_TAGS.items():
        net = [
            len(set(t["temperament"]["likes"]) & tag_set) - len(set(t["temperament"]["hates"]) & tag_set) for t in TOWNS
        ]
        assert sum(1 for n in net if n > 0) >= 4, f"{genre}: too few towns that like it"
        assert sum(1 for n in net if n < 0) >= 4, f"{genre}: too few towns that dislike it"
    popular = set().union(*GENRE_TAGS.values())
    assert sum(1 for t in TOWNS if set(t["temperament"]["hates"]) & popular) >= 8


def test_every_taste_is_used_by_some_town():
    used = {m for t in TOWNS for m in t["audience"]["mix"]}
    assert used == set(TASTE_BY_ID)


# ----------------------------------------------------------------------------------------------------------- tastes
def test_tastes_cover_the_required_archetypes():
    required = {
        "man_who_hates_death", "tearful_aunt", "pun_lover", "child_in_the_front", "retired_actor", "critic_in_disguise",
        "sleepy_farmer", "goose_fancier", "romantic", "skeptic", "snack_vendor", "mayor",
    }
    assert len(TASTES) == 12
    assert {t["id"] for t in TASTES} == required


def test_taste_fields():
    for t in TASTES:
        assert set(t) == {"id", "name", "hat", "palette", "likes", "hates", "laugh", "cry", "gasp", "boo"}
        assert_clean(t["name"])
        assert t["hat"] in T.HATS
        assert set(t["palette"]) == {"coat", "skin"} and all(HEX.match(v) for v in t["palette"].values())
        assert 1 <= len(t["likes"]) <= 3 and 1 <= len(t["hates"]) <= 3
        assert set(t["likes"]) | set(t["hates"]) <= set(T.TAGS)
        assert not set(t["likes"]) & set(t["hates"])
        for k in ("laugh", "cry", "gasp", "boo"):
            assert 0 <= t[k] <= 1


def test_tastes_are_distinct_characters():
    assert set(T.HATS) <= {t["hat"] for t in TASTES}
    assert len({tuple(t["likes"]) for t in TASTES}) == 12
    assert max(t["cry"] for t in TASTES) >= 0.9 and max(t["laugh"] for t in TASTES) >= 0.9
    assert TASTE_BY_ID["man_who_hates_death"]["boo"] >= 0.7
    assert "death" in TASTE_BY_ID["man_who_hates_death"]["hates"]
    assert "pun" in TASTE_BY_ID["pun_lover"]["likes"]
    assert "goose" in TASTE_BY_ID["goose_fancier"]["likes"]


# ---------------------------------------------------------------------------------------------------------- critics
def test_critic_ids_and_fields():
    assert [c["id"] for c in CRITICS] == ["pompous", "wounded_parent", "snacks", "chaos_gourmand", "sentimentalist"]
    for c in CRITICS:
        assert set(c) == {"id", "name", "outlet", "style", "weights", "bias", "noise", "templates"}
        assert_clean(c["name"])
        assert_clean(c["outlet"])
        assert c["style"] == c["id"]
        assert set(c["weights"]) == {"quality", "lead", "warmth", "charm_chaos", "tradition", "snacks"}
        assert all(0 <= v <= 1 for v in c["weights"].values())
        assert sum(c["weights"].values()) == pytest.approx(1.0, abs=0.01), c["id"]
        assert -1 <= c["bias"] <= 1 and 0 <= c["noise"] <= 1


def test_critics_weigh_the_show_differently():
    by_id = {c["id"]: c["weights"] for c in CRITICS}
    assert by_id["pompous"]["quality"] == max(w["quality"] for w in by_id.values())
    assert by_id["wounded_parent"]["lead"] == max(w["lead"] for w in by_id.values())
    assert by_id["snacks"]["snacks"] == max(w["snacks"] for w in by_id.values())
    assert by_id["chaos_gourmand"]["charm_chaos"] == max(w["charm_chaos"] for w in by_id.values())
    assert by_id["sentimentalist"]["tradition"] == max(w["tradition"] for w in by_id.values())
    pompous = next(c for c in CRITICS if c["id"] == "pompous")
    assert pompous["bias"] < 0


def test_critic_templates_shape():
    seen: Counter[str] = Counter()
    for c in CRITICS:
        assert set(c["templates"]) == {"1", "2", "3", "4", "5"}
        for star, lines in c["templates"].items():
            assert len(lines) >= 5, (c["id"], star)
            for line in lines:
                assert_clean(line)
                assert 8 <= words(line) <= 20, (c["id"], star, words(line), line)
                assert len(line) <= 140, (c["id"], star, len(line), line)
                assert placeholders(line) <= CRITIC_PLACEHOLDERS, (c["id"], line)
                seen[line.lower()] += 1
        assert sum(len(v) for v in c["templates"].values()) >= 25
    assert max(seen.values()) == 1, "duplicate template across critics"


def test_critic_templates_use_their_placeholders_sensibly():
    by_id = {c["id"]: c for c in CRITICS}

    def share(critic_id: str, name: str) -> float:
        lines = [t for ts in by_id[critic_id]["templates"].values() for t in ts]
        return sum(1 for t in lines if name in placeholders(t)) / len(lines)

    assert share("snacks", "snack") >= 0.6
    assert share("sentimentalist", "tradition") >= 0.25
    assert share("wounded_parent", "lead") >= 0.8
    assert share("chaos_gourmand", "mishap") + share("chaos_gourmand", "calamity") >= 0.4
    for c in CRITICS:
        lines = [t for ts in c["templates"].values() for t in ts]
        assert sum(1 for t in lines if placeholders(t)) / len(lines) >= 0.85, c["id"]


def test_critic_templates_render_with_short_and_long_phrases():
    short = dict.fromkeys(CRITIC_PLACEHOLDERS, "X")
    long = dict.fromkeys(CRITIC_PLACEHOLDERS, "a rather long phrase of seven words")
    for c in CRITICS:
        for lines in c["templates"].values():
            for line in lines:
                for fill in (short, long):
                    out = line.format(**fill)
                    assert "{" not in out and "}" not in out
                    assert "  " not in out


def test_critic_voices_keep_their_signature_lines():
    parent = [t for ts in next(c for c in CRITICS if c["id"] == "wounded_parent")["templates"].values() for t in ts]
    assert any("ROBBED" in t for t in parent)
    pompous = [t for ts in next(c for c in CRITICS if c["id"] == "pompous")["templates"].values() for t in ts]
    assert any("wallpaper" in t for t in pompous)


def test_snack_pool_is_bare_nouns():
    assert len(critics.SNACKS) >= 12 and len(set(critics.SNACKS)) == len(critics.SNACKS)
    for s in critics.SNACKS:
        assert s == s.lower() and s.split()[0] not in {"a", "an", "the"} and not s.endswith("s")


# --------------------------------------------------------------------------------------------------------- playbill
def test_playbill_shape_and_counts():
    assert set(PLAYBILL) == {"bio", "headings", "back_page", "tonight_in", "previously"}
    assert set(PLAYBILL["bio"]) == {"openers", "trained_at", "credits", "quirks"}
    for k, lines in PLAYBILL["bio"].items():
        assert len(lines) >= 12, k
        assert len(set(lines)) == len(lines), k
    assert len(PLAYBILL["headings"]) >= 10
    assert len(PLAYBILL["back_page"]) >= 12
    assert len(PLAYBILL["tonight_in"]) >= 10
    assert len(PLAYBILL["previously"]) >= 10
    for lines in [*PLAYBILL["bio"].values(), PLAYBILL["headings"], PLAYBILL["back_page"], PLAYBILL["tonight_in"],
                  PLAYBILL["previously"]]:
        assert len(set(lines)) == len(lines)
        for line in lines:
            assert_clean(line)
            assert len(line) <= 110 or line in PLAYBILL["back_page"] or line in PLAYBILL["tonight_in"] or line in PLAYBILL["previously"]
            assert len(line) <= 130, line


def test_bio_grammar_assembles_cleanly():
    bio = PLAYBILL["bio"]
    assert all(o.endswith(",") for o in bio["openers"])
    assert all(not t.endswith(".") and t.split()[0].strip(",") in {"trained", "studied", "learned", "was", "graduated", "honed", "took"}
               for t in bio["trained_at"])
    assert all(c.endswith(".") for c in bio["credits"])
    assert all(q.endswith(".") for q in bio["quirks"])
    assert any("Royal Academy of Looking Out Windows" in t for t in bio["trained_at"])
    pronoun = re.compile(r"\b(he|she|his|her|him|hers|himself|herself)\b", re.IGNORECASE)
    rendered = set()
    for o, t, c, q in itertools.islice(itertools.product(*bio.values()), 0, None, 37):
        text = f"Mabel Tuckett, {o} {t}. {c} {q}"
        assert not placeholders(text) and "  " not in text and ",," not in text and ".." not in text
        assert not pronoun.search(text), text
        rendered.add(text)
    assert len(rendered) > 500


def test_bio_parts_allow_more_than_ten_thousand_bios():
    n = 1
    for lines in PLAYBILL["bio"].values():
        n *= len(lines)
    assert n >= 10_000


def test_playbill_placeholders():
    for line in PLAYBILL["tonight_in"]:
        assert placeholders(line) == {"town"}, line
    for line in PLAYBILL["previously"]:
        assert placeholders(line) == {"town", "title", "stars"}, line
        assert not re.search(r"\{stars\}\s+stars?", line), f"{{stars}} may be 1 or 1.5; do not pluralise: {line!r}"
        out = line.format(town="Marshwick-on-Mire", title="The Lean of Lord Wibble", stars="1.5")
        assert "{" not in out
    for key in ("headings", "back_page"):
        assert all(not placeholders(line) for line in PLAYBILL[key])


def test_back_page_is_absurd_notices():
    joined = " ".join(PLAYBILL["back_page"]).lower()
    assert "goose" in joined and "moon" in joined and "umbrella" in joined


# ------------------------------------------------------------------------------------------------------ road events
def test_road_event_shape():
    assert len(ROAD) == 20
    assert len({e["id"] for e in ROAD}) == 20
    for e in ROAD:
        assert set(e) == {"id", "title", "text", "weight", "choices"}
        assert SLUG.match(e["id"])
        assert_clean(e["title"])
        assert_clean(e["text"])
        assert len(e["title"]) <= 46 and len(e["text"]) <= 150, e["id"]
        assert isinstance(e["weight"], int) and 1 <= e["weight"] <= 5
        assert 2 <= len(e["choices"]) <= 3
        assert len({c["id"] for c in e["choices"]}) == len(e["choices"])
        assert placeholders(e["text"]) <= {"town", "from_town", "to_town"}


def test_road_event_effects_are_in_range():
    for e in ROAD:
        for c in e["choices"]:
            assert set(c) == {"id", "label", "effects"}
            assert SLUG.match(c["id"])
            assert_clean(c["label"])
            assert len(c["label"]) <= 48, c["label"]
            fx = c["effects"]
            assert fx, "every choice has some effect"
            assert set(fx) <= {"funds", "morale", "rapport", "encore"}
            for key, lo, hi in (("funds", -5, 5), ("morale", -3, 3), ("encore", -1, 2)):
                if key in fx:
                    assert isinstance(fx[key], int) and not isinstance(fx[key], bool) and lo <= fx[key] <= hi
            for pid, v in fx.get("rapport", {}).items():
                assert pid in PERFORMER_IDS and isinstance(v, int) and -3 <= v <= 3


def test_road_event_labels_are_honest_about_money_and_encores():
    for e in ROAD:
        for c in e["choices"]:
            fx, label = c["effects"], c["label"]
            m = re.search(r"([+-]\d+) funds?\b", label)
            if fx.get("funds"):
                assert m and int(m.group(1)) == fx["funds"], (e["id"], c["id"], label)
            else:
                assert not m, (e["id"], c["id"], label)
            e_m = re.search(r"([+-]\d+) Encore", label)
            if fx.get("encore"):
                assert e_m and int(e_m.group(1)) == fx["encore"], (e["id"], c["id"], label)
            else:
                assert not e_m, (e["id"], c["id"], label)


def test_road_events_have_geese_and_encores_and_a_spread_of_stakes():
    geese = [e for e in ROAD if "goose" in (e["title"] + " " + e["text"]).lower() or any(
        "goose" in c["effects"].get("rapport", {}) for c in e["choices"])]
    assert len(geese) >= 3
    encore_events = [e for e in ROAD if any(c["effects"].get("encore", 0) > 0 for c in e["choices"])]
    assert len(encore_events) >= 2
    assert any(c["effects"]["funds"] > 0 for e in ROAD for c in e["choices"])
    assert any(c["effects"]["funds"] < 0 for e in ROAD for c in e["choices"])
    assert {pid for e in ROAD for c in e["choices"] for pid in c["effects"].get("rapport", {})} == PERFORMER_IDS
    # a fair road: on average a choice is not a disaster (nor a windfall)
    deltas = [c["effects"]["funds"] for e in ROAD for c in e["choices"]]
    assert -1.0 <= sum(deltas) / len(deltas) <= 1.0
    # no event is a strictly dominated choice: each has at least two distinct profiles
    for e in ROAD:
        profiles = {str(sorted(c["effects"].items())) for c in e["choices"]}
        assert len(profiles) == len(e["choices"]), e["id"]


# ------------------------------------------------------------------------------------------------- almanac seeds
def test_almanac_seed_shape():
    assert len(LEGENDS) == 60
    assert [r["id"] for r in LEGENDS] == [f"legend_{i:03d}" for i in range(1, 61)]
    for r in LEGENDS:
        assert set(r) == {"id", "text", "calamity", "town"}
        assert_clean(r["text"])
        assert r["calamity"] in T.CALAMITIES
        assert r["town"] in TOWN_BY_ID, r["town"]
        assert 40 <= len(r["text"]) <= 150, (r["id"], len(r["text"]))
        assert not placeholders(r["text"])
    assert len({r["text"] for r in LEGENDS}) == 60


STOP = {"the", "royal", "of", "on", "in", "upon", "under", "by", "sea"}


def town_token(town_id: str) -> str:
    """The first distinctive word of a town's name: legends must keep it so semantic search can find them."""
    for tok in re.split(r"[\s-]+", TOWN_BY_ID[town_id]["name"]):
        if tok.lower() not in STOP:
            return tok.lower()
    raise AssertionError(town_id)


def test_legends_keep_the_town_name():
    for r in LEGENDS:
        assert town_token(r["town"]) in r["text"].lower(), (r["id"], r["town"])


def test_two_legends_per_town_and_the_expected_gag_is_among_them():
    per_town = Counter(r["town"] for r in LEGENDS)
    assert set(per_town) == set(TOWN_BY_ID)
    assert set(per_town.values()) == {2}
    for t in TOWNS:
        expects = t["temperament"]["expects"]
        if expects:
            assert expects in {r["calamity"] for r in LEGENDS if r["town"] == t["id"]}, t["id"]


def test_every_calamity_has_a_legend():
    assert set(T.CALAMITIES) <= {r["calamity"] for r in LEGENDS}


CALAMITY_KEYWORDS = {
    "the_lean": ["lean"], "the_chair": ["chair"], "the_goose_incident": ["goose", "geese"],
    "the_wrong_door": ["door"], "the_chandelier": ["chandelier"], "the_curtain_stuck": ["curtain"],
    "the_apology": ["apolog"], "the_watering_can": ["watering can"], "the_rhyme": ["rhym"], "the_corpse": ["corpse"],
    "the_trapdoor": ["trapdoor"], "the_wig": ["wig"], "the_wrong_play": ["wrong play", "different play"],
    "the_swordfight": ["sword"], "the_kiss": ["kiss"], "the_cake": ["cake"], "the_candle": ["candle"],
    "the_ghost_sheet": ["ghost sheet"], "the_fainting": ["faint"], "the_echo": ["echo"], "the_prompt": ["prompt"],
    "the_umbrella": ["umbrella"], "the_banister": ["banister"], "the_mask": ["mask"], "the_encore": ["encore"],
    "the_snack": ["pie", "ate the props", "snack"], "the_moon": ["moon"], "the_string_knot": ["string", "knot"],
}


def test_legends_mention_their_gag():
    assert set(CALAMITY_KEYWORDS) == set(T.CALAMITIES)
    for r in LEGENDS:
        text = r["text"].lower()
        assert any(k in text for k in CALAMITY_KEYWORDS[r["calamity"]]), (r["id"], r["calamity"], r["text"])


def test_legends_sound_like_oral_history():
    dated = sum(1 for r in LEGENDS if re.search(r"\b1[89]\d\d\b|\bsince\b|\bonce\b|\bevery\b|\balways\b|\bthey say\b|\bswears\b|\brecalls\b|\bremember", r["text"]))
    assert dated >= 40


# -------------------------------------------------------------------------------------------------- content hygiene
def all_strings(obj):
    if isinstance(obj, str):
        yield obj
    elif isinstance(obj, dict):
        for v in obj.values():
            yield from all_strings(v)
    elif isinstance(obj, (list, tuple)):
        for v in obj:
            yield from all_strings(v)


def test_no_brands_real_people_or_stray_markup():
    banned = ["disney", "muppet", "pixar", "netflix", "google", "amazon", "shakespeare", "macbeth", "hamlet", "dickens",
              "<", ">", "\t", "\n"]
    for dataset in (TOWNS, TASTES, CRITICS, PLAYBILL, ROAD, LEGENDS):
        for s in all_strings(dataset):
            low = s.lower()
            for b in banned:
                assert b not in low, f"{b!r} in {s!r}"


def test_content_modules_are_deterministic_values():
    import copy
    import json

    for dataset in (TOWNS, TASTES, CRITICS, PLAYBILL, ROAD, LEGENDS):
        assert json.dumps(copy.deepcopy(dataset), sort_keys=True) == json.dumps(dataset, sort_keys=True)
