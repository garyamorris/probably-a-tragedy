"""The thirty towns of the Wibbling Players' circuit (docs/DATA.md section 8).

Each town has a *temperament*: `likes` / `hates` are TAGS (disjoint, 1-3 each) that interact with the genres
(melodrama: murder/death/betrayal/letter; farce: door/chair/slapstick/mistaken_identity; whodunit: poison/murder/secret/lie;
gothic_romance: ghost/storm/romance/mourning; pantomime: goose/pun/song/dance/feast), so the genre you pick for a town matters.
`expects` is the calamity the town is waiting for (repeat it: +8); `openness` is how readily the house warms (0-1).
`audience.mix` is exactly three taste ids (tastes.py) from which the engine seats its twelve; `hat_bias` is the town's hat.

The last town of every tour is the special `wibbling_opera`.
"""

from __future__ import annotations


def _town(id, name, blurb, sky, landmark, likes, hates, expects, openness, mix, hat_bias, gossip):
    return {
        "id": id,
        "name": name,
        "blurb": blurb,
        "sky": sky,
        "landmark": landmark,
        "temperament": {"likes": likes, "hates": hates, "expects": expects, "openness": openness},
        "audience": {"mix": mix, "hat_bias": hat_bias},
        "gossip": gossip,
    }


TOWNS = [
    _town(
        "marshwick", "Marshwick-on-Mire",
        "Damp, proud of it, and thoroughly in favour of a good pun.",
        "dusk", "windmill", ["pun", "goose"], ["death", "fire"], "the_chair", 0.4,
        ["pun_lover", "tearful_aunt", "man_who_hates_death"], "bonnet",
        "They still talk about the time a swan was cast as the vicar.",
    ),
    _town(
        "gloomsby", "Gloomsby-by-the-Sea",
        "Fog, funerals and a tea shop that closes whenever someone interesting dies.",
        "storm", "lighthouse", ["mourning", "death", "storm"], ["slapstick", "pun"], "the_candle", 0.3,
        ["tearful_aunt", "romantic", "retired_actor"], "top",
        "The lighthouse has not been lit since 1931, out of respect for something nobody will name.",
    ),
    _town(
        "snoring_magna", "Snoring Magna",
        "Population: mostly asleep. Do not take offence; it is the highest compliment.",
        "dawn", "silo", ["feast", "rhyme"], ["speech", "murder", "chase"], None, 0.8,
        ["sleepy_farmer", "snack_vendor", "mayor"], "flat",
        "The mayor has been elected nine times without once being fully awake.",
    ),
    _town(
        "wibbling_opera", "The Royal Opera House of Wibbling",
        "Velvet, gilt and a faint smell of disapproval. Dress as if you mean it.",
        "night", "spire", ["song", "crown", "speech"], ["goose", "slapstick"], "the_chandelier", 0.2,
        ["critic_in_disguise", "retired_actor", "mayor"], "top",
        "The chandelier has been scheduled for repair since 1887, and the ushers have a seating plan for that.",
    ),
    _town(
        "hinge_regis", "Hinge Regis",
        "Four hundred doors, one lock, no keys, and a very proud locksmith.",
        "noon", "clocktower", ["door", "slapstick"], ["lie", "poison"], "the_wrong_door", 0.6,
        ["child_in_the_front", "pun_lover", "snack_vendor"], "flat",
        "Nobody has found the front door since 1923, but everyone has found somebody else's.",
    ),
    _town(
        "hemlock_green", "Hemlock Green",
        "Famous for its gardens and, increasingly, for the absence of its gardeners.",
        "dusk", "chimneys", ["poison", "secret", "murder"], ["feast", "dance"], "the_corpse", 0.3,
        ["skeptic", "critic_in_disguise", "retired_actor"], "none",
        "The Horticultural Society holds its prize-giving in the dark, and no one has asked why.",
    ),
    _town(
        "lettersham", "Lettersham Parva",
        "The post office is the tallest building and the postmistress the most feared.",
        "noon", "spire", ["letter", "secret", "betrayal"], ["mistaken_identity", "chair"], None, 0.5,
        ["mayor", "retired_actor", "tearful_aunt"], "feather",
        "Letters arrive eventually, rarely for the person named on them, and nobody will discuss it.",
    ),
    _town(
        "gandersby", "Gandersby",
        "A town built around a pond, a green, and one very large opinion.",
        "dawn", "bridge", ["goose", "dance"], ["ghost", "mourning"], "the_goose_incident", 0.6,
        ["goose_fancier", "child_in_the_front", "snack_vendor"], "feather",
        "The goose on the village green has outlasted four mayors and a statue of itself.",
    ),
    _town(
        "candlewick", "Candlewick Down",
        "Every window holds a candle, and every candle has views on love.",
        "dusk", "chimneys", ["romance", "wedding", "letter"], ["chase", "betrayal"], "the_kiss", 0.5,
        ["romantic", "tearful_aunt", "pun_lover"], "bow",
        "Four hundred couples have met at the village pump, and the pump takes no credit.",
    ),
    _town(
        "twelve_bridges", "Twelve Bridges",
        "Twelve bridges, no river, and a firm sense of purpose.",
        "noon", "bridge", ["chase", "mistaken_identity"], ["storm", "mourning"], "the_lean", 0.5,
        ["child_in_the_front", "skeptic", "mayor"], "flat",
        "The river moved away in 1840; the bridges stayed, leaning left, in case it comes back.",
    ),
    _town(
        "puddlecombe", "Puddlecombe-under-Cloud",
        "It has rained since Tuesday. Nobody remembers which Tuesday.",
        "storm", "chimneys", ["storm", "rhyme"], ["door", "dance"], "the_umbrella", 0.4,
        ["sleepy_farmer", "skeptic", "tearful_aunt"], "bow",
        "The umbrella stand in the town hall is on the payroll and has been promised a pension.",
    ),
    _town(
        "pettifog", "Pettifog",
        "Every resident is a solicitor, and every sentence arrives with a clause.",
        "noon", "clocktower", ["trial", "speech", "secret"], ["song", "pun"], "the_wrong_play", 0.2,
        ["skeptic", "mayor", "critic_in_disguise"], "top",
        "The court has been hearing the wrong case since 1911, and a verdict is expected shortly.",
    ),
    _town(
        "fiddleton", "Fiddleton Tarn",
        "Everyone plays something. Nobody plays it in the same key.",
        "dusk", "pier", ["song", "dance", "rhyme"], ["murder", "speech"], "the_encore", 0.7,
        ["pun_lover", "snack_vendor", "child_in_the_front"], "fez",
        "No show here has ended in fewer than three encores, including the funerals.",
    ),
    _town(
        "cakeley", "Cakeley Wold",
        "Three bakeries, one rivalry, and a sponge with its own bodyguard.",
        "dawn", "windmill", ["feast", "wedding", "treasure"], ["poison", "fire", "death"], "the_cake", 0.6,
        ["snack_vendor", "tearful_aunt", "goose_fancier"], "bonnet",
        "The Great Sponge Dispute of 1952 ended only when both bakers married each other.",
    ),
    _town(
        "grimstone", "Grimstone Keep",
        "A castle with a town attached, and a mood attached to the castle.",
        "night", "castle", ["sword", "betrayal", "secret"], ["song", "dance", "pun"], "the_swordfight", 0.25,
        ["retired_actor", "skeptic", "critic_in_disguise"], "crown",
        "The Lord of the Keep is, by law, always away, and the portraits have taken over.",
    ),
    _town(
        "cragley_steps", "Cragley Steps",
        "Built on a hill so steep that even the pigeons walk.",
        "dawn", "spire", ["stairs", "chase", "dance"], ["romance", "kiss"], "the_banister", 0.5,
        ["child_in_the_front", "snack_vendor", "sleepy_farmer"], "bow",
        "Every banister has a name and a grudge, and the names are not for repeating.",
    ),
    _town(
        "periwick", "Periwick",
        "The only town where the barber outranks the vicar, and both wear wigs.",
        "noon", "clocktower", ["disguise", "mask", "mistaken_identity"], ["mirror", "chair"], "the_wig", 0.5,
        ["pun_lover", "critic_in_disguise", "mayor"], "top",
        "Three residents are secretly bald, and the whole town goes along with it.",
    ),
    _town(
        "mooncalf_bay", "Mooncalf Bay",
        "Sea, sand, and a moon that arrives early and stays late.",
        "night", "lighthouse", ["romance", "mirror", "letter"], ["slapstick", "poison"], "the_moon", 0.4,
        ["romantic", "tearful_aunt", "goose_fancier"], "feather",
        "On certain nights the moon hangs a little low, and the fishermen touch their caps to it.",
    ),
    _town(
        "tinderford", "Tinderford",
        "Rebuilt four times, a little more flammable each time, and never discouraged.",
        "dusk", "chimneys", ["fire", "chase", "slapstick"], ["storm", "mourning"], "the_curtain_stuck", 0.35,
        ["child_in_the_front", "sleepy_farmer", "goose_fancier"], "fez",
        "The fire brigade has a reserved seat at every performance, and a bucket under it.",
    ),
    _town(
        "crumbling_upton", "Crumbling Upton",
        "Everything is gently falling down, apart from the pie stall.",
        "dusk", "crane", ["feast", "song"], ["secret", "lie"], "the_snack", 0.6,
        ["snack_vendor", "sleepy_farmer", "child_in_the_front"], "flat",
        "The pie stall has outlasted the church, the pub, and two attempts to move it.",
    ),
    _town(
        "hullabaloo_gap", "Hullabaloo Gap",
        "A valley so echoing that gossip returns before it has left.",
        "noon", "silo", ["rhyme", "speech", "song"], ["ghost", "secret"], "the_echo", 0.5,
        ["pun_lover", "retired_actor", "mayor"], "fez",
        "The echo here has opinions of its own and is, on balance, unkind to baritones.",
    ),
    _town(
        "mutterby", "Mutterby",
        "The audience knows the lines and will happily help you with them.",
        "dusk", "spire", ["rhyme", "speech"], ["mistaken_identity", "lie"], "the_prompt", 0.35,
        ["retired_actor", "tearful_aunt", "skeptic"], "none",
        "Last Christmas they corrected the vicar mid-sermon, and he thanked them.",
    ),
    _town(
        "tumbledown_hatch", "Tumbledown Hatch",
        "Built on top of its own cellars. Mind the floor; it minds you.",
        "night", "silo", ["slapstick", "chase", "treasure"], ["mourning", "speech"], "the_trapdoor", 0.65,
        ["child_in_the_front", "pun_lover", "goose_fancier"], "flat",
        "The mayor vanished through the town hall floor in 1998 and gave the speech from below.",
    ),
    _town(
        "swoonsea", "Swoonsea",
        "Sea air so heavy that someone faints every quarter hour. Do hydrate.",
        "dusk", "pier", ["betrayal", "reunion", "romance"], ["fire", "sword", "murder"], "the_fainting", 0.55,
        ["tearful_aunt", "romantic", "man_who_hates_death"], "bonnet",
        "The fainting couch outside the town hall has been re-covered six times, always in a hurry.",
    ),
    _town(
        "pardonmere", "Pardonmere",
        "Everyone apologises first, and the weather is no exception.",
        "dawn", "windmill", ["reunion", "wedding"], ["betrayal", "slapstick", "fire"], "the_apology", 0.8,
        ["tearful_aunt", "mayor", "sleepy_farmer"], "none",
        "A man once apologised to a door for so long that the door apologised back, and it was lovely.",
    ),
    _town(
        "sheetley_moor", "Sheetley Moor",
        "A moor, a ruin, and a great deal of laundry nobody will claim.",
        "night", "castle", ["ghost", "mourning", "mask"], ["feast", "song", "goose"], "the_ghost_sheet", 0.3,
        ["romantic", "skeptic", "man_who_hates_death"], "none",
        "The ghost is real, polite, and has not been paid since the last census.",
    ),
    _town(
        "couplethwaite", "Couplethwaite",
        "Everything here rhymes, from the street names to the quarrels.",
        "noon", "spire", ["rhyme", "song", "pun"], ["lie", "murder"], "the_rhyme", 0.6,
        ["pun_lover", "child_in_the_front", "retired_actor"], "crown",
        "The town crier's announcements scan, and he has promised to resign the day one doesn't.",
    ),
    _town(
        "dewbury", "Dewbury-in-Bloom",
        "Prize marrows, a prize vicar, and a watering can for every occasion.",
        "dawn", "silo", ["feast", "wedding"], ["storm", "death"], "the_watering_can", 0.55,
        ["sleepy_farmer", "tearful_aunt", "pun_lover"], "bonnet",
        "The Dewbury Marrow Show has been rained on every year, which the committee calls consistency.",
    ),
    _town(
        "grimsditch", "Grimsditch",
        "An ordinary town, and ashamed of it. Please be gentle.",
        "noon", "chimneys", ["chair", "letter"], ["ghost", "fire"], None, 0.9,
        ["sleepy_farmer", "mayor", "snack_vendor"], "flat",
        "Nothing has happened here since 1974, and the town holds a small parade about it every spring.",
    ),
    _town(
        "plovers_rest", "Plover's Rest",
        "A bird sanctuary with a theatre attached, or possibly the other way round.",
        "dawn", "pier", ["goose", "secret"], ["song", "dance"], None, 0.6,
        ["goose_fancier", "retired_actor", "skeptic"], "feather",
        "A pigeon has sat in the third row since 1997, and nobody has liked to ask it to leave.",
    ),
]

# --- each town loves one genre and scorns another -------------------------------------------------------------------
# A fun audit measured that gothic romance was the best genre in 30 of 30 towns, so "towns have tastes" was decoration. Now every
# town has a visible favourite (`favours`, a warm house from the first beat) and a genre it scorns (`scorns`): reading the town
# is the skill. They are derived from the tags a town likes and hates (a ghost-loving town leans gothic), then balanced so each genre
# is the favourite of 4 to 8 towns and the scorned genre of 4 to 8 (never against a town's own likes and hates): no genre is right everywhere. Deterministic; edit by hand if you like.
GENRE_TAGS = {
    "melodrama": {"murder", "death", "betrayal", "letter"},
    "farce": {"door", "chair", "slapstick", "mistaken_identity"},
    "whodunit": {"poison", "murder", "secret", "lie"},
    "gothic_romance": {"ghost", "storm", "romance", "mourning"},
    "pantomime": {"goose", "pun", "song", "dance", "feast"},
}
GENRE_ORDER = ["melodrama", "farce", "whodunit", "gothic_romance", "pantomime"]


def _affinity(town: dict, genre: str) -> int:
    likes, hates = set(town["temperament"]["likes"]), set(town["temperament"]["hates"])
    return 2 * len(likes & GENRE_TAGS[genre]) - 2 * len(hates & GENRE_TAGS[genre])


def _assign(towns: list[dict], key: str, sign: int, forbid: dict[str, str], cap: int = 6) -> None:
    """Greedy balanced assignment, best (town, genre) pairs first, at most `cap` towns per genre.

    A town never loves a genre whose tags it hates, nor scorns one whose tags it likes (`sign * affinity >= 0`), so the
    gossip and the genre cards never contradict each other.
    """
    ok = lambda i, j: sign * _affinity(towns[i], GENRE_ORDER[j]) >= 0 and forbid.get(towns[i]["id"]) != GENRE_ORDER[j]  # noqa: E731
    pairs = sorted(
        ((sign * _affinity(t, g), (i * 7 + j * 3) % 11, i, j) for i, t in enumerate(towns) for j, g in enumerate(GENRE_ORDER)),
        key=lambda x: (-x[0], x[1], x[2], x[3]),
    )
    used: dict[int, int] = {}
    placed: set[int] = set()
    for _score, _tie, i, j in pairs:
        if i in placed or used.get(j, 0) >= cap or not ok(i, j):
            continue
        towns[i]["temperament"][key] = GENRE_ORDER[j]
        used[j] = used.get(j, 0) + 1
        placed.add(i)
    for i, t in enumerate(towns):  # anything left: the least-used genre that does not contradict the town
        if i not in placed:
            j = min((j for j in range(len(GENRE_ORDER)) if ok(i, j)), key=lambda j: (used.get(j, 0), j))
            t["temperament"][key] = GENRE_ORDER[j]
            used[j] = used.get(j, 0) + 1


def _assign_genre_tastes(towns: list[dict]) -> None:
    _assign(towns, "favours", +1, {})
    _assign(towns, "scorns", -1, {t["id"]: t["temperament"]["favours"] for t in towns})


_assign_genre_tastes(TOWNS)

DATASETS = {"towns": TOWNS}
