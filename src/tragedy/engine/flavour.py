"""Small authored grammars that live in code rather than datasets (titles, taglines, yes-and, headlines, snacks).

They are only *drafts*: the graphs hand them to `voice()` so Claude can rephrase them when a key is configured.
"""

from __future__ import annotations

from tragedy.common.rng import pick

ADJ = (
    "Wobbling",
    "Tragic",
    "Unfortunate",
    "Damp",
    "Haunted",
    "Magnificent",
    "Regrettable",
    "Borrowed",
    "Suspicious",
    "Gentle",
    "Furious",
    "Singing",
    "Misplaced",
    "Inevitable",
    "Third-Best",
    "Reluctant",
    "Improbable",
    "Hasty",
)

TITLE_PATTERNS: dict[str, tuple[str, ...]] = {
    "melodrama": (
        "The {adj} Will of {town}",
        "{villain}'s {adj} Revenge",
        "Unhand {lead}!",
        "A {adj} Inheritance",
        "The Last Train to {town}",
        "{lead}, or The {adj} Heiress",
    ),
    "farce": (
        "Who Left the {obj} in the {place}?",
        "Four Doors and a {obj}",
        "The {adj} Misunderstanding",
        "No, {lead}, the Other {obj}",
        "Trousers of {town}",
        "Everybody Out of the {place}",
    ),
    "whodunit": (
        "Murder at the {adj} {place}",
        "The {obj} Knew Too Much",
        "Death Comes to {town}",
        "Everyone Did It, Probably",
        "The Goose Saw Everything",
        "{villain} Regrets Nothing",
    ),
    "gothic_romance": (
        "The {adj} Heart of {town} Moor",
        "Candlelight and {villain}",
        "A Letter from the {adj} Tower",
        "{lead}, Alone on the Moor",
        "The Ghost Who Was Mostly Disappointed",
        "Brooding at {town}",
    ),
    "pantomime": (
        "{lead} and the {adj} {obj}",
        "He's Behind You, {lead}!",
        "The Great {town} Panto",
        "Oh Yes It Is: A {adj} Tale",
        "The Cow in Two Halves",
        "{lead} Goes to {town}",
    ),
}

TAGLINES: dict[str, tuple[str, ...]] = {
    "quill_pompous": (
        "A work of considerable gravity.",
        "Be seated. Be silent. Be improved.",
        "Art, in a small town, at some expense.",
        "Not suitable for those who giggle.",
        "A meditation, with props.",
        "Eleven pages, all of them important.",
    ),
    "quill_frantic": (
        "Hold on to something!",
        "Seven exits, no waiting.",
        "Written in the interval, performed in the interval.",
        "Mind the doors.",
        "Faster than the last one, and louder.",
        "Do not look away. We have not planned for that.",
    ),
    "quill_tender": (
        "A small thing, made with care.",
        "Bring someone you forgive.",
        "Soft lights, sharp feelings.",
        "For anyone who has ever waited at a window.",
        "Gentle, until it isn't.",
        "A play about holding on, and then not.",
    ),
}

YES_AND = (
    "Yes, and {actor} has always done that, ever since the incident.",
    "Yes, and that is exactly why {actor} was hired.",
    "Yes, and nobody in this room is surprised.",
    "Yes, and the audience may now consider it a feature.",
    "Yes, and {actor} will be keeping that.",
    "Yes, and I assumed it was in the script.",
    "Yes, and I would like it noted that I saw it coming.",
    "Yes, and therefore, naturally, the goose.",
    "Yes, and the moon is a witness.",
    "Yes, and this is how it went in the original.",
)

SNACKS = (
    "pork pie", "toffee apple", "custard tart", "sausage roll", "jam doughnut", "cheese straw", "saffron bun",
    "pickled egg", "treacle flapjack", "iced bun", "mutton pasty", "buttered crumpet", "gingerbread goose",
    "seed cake", "sherbet lemon", "scotch egg",
)  # bare singular nouns: the critics' templates say "the {snack} was warm"

HEADLINE_BANDS: tuple[tuple[float, tuple[str, ...]], ...] = (
    (
        4.5,
        (
            "{town} RISES FOR {title}",
            "STANDING OVATION: {title} 'MOSTLY ON PURPOSE'",
            "{town} WEEPS, LAUGHS, REQUESTS ENCORE",
        ),
    ),
    (3.5, ("{title} A HIT IN {town}", "{town} PLEASED; GOOSE UNHARMED", "A TRIUMPH, EVEN THOUGH {mishap}")),
    (2.5, ("{title}: {town} UNDECIDED", "MIXED NOTICES FOR {title}", "{town} SHRUGS, STAYS FOR INTERVAL")),
    (1.5, ("{title} 'BRAVE', SAYS {town}", "{title} OVERSHADOWED WHEN {mishap}", "{town} ASKS FOR A REFUND, THEN FOR MORE")),
    (0.0, ("{title} A TRAGEDY, AS ADVERTISED", "{town} LEAVES EARLY, FONDLY", "CRITICS FLEE; PIGEONS UNIMPRESSED")),
)


_QUILL_SLOT = {"quill_pompous": 0, "quill_frantic": 1, "quill_tender": 2}  # same order as script.QUILLS


def make_title(genre: str, seed: int, *labels: object, lead: str, villain: str, town: str, obj: str, place: str) -> str:
    pats = TITLE_PATTERNS[genre]
    pat = pick(pats, seed, *labels, "title")
    # The three quills draft side by side and the player lifts one by its title, so no two of them may share a pattern. Rolling the
    # pattern per quill collides on ~44% of nights (a playtest saw two drafts both called "Trousers of Twelve Bridges"). Quill labels
    # are the second entry of `labels` for drafts; offset by the quill's slot so the three always differ (6 patterns, steps of 2).
    slot = next((_QUILL_SLOT[x] for x in labels if x in _QUILL_SLOT), None)
    if slot is not None:
        base = pick(range(len(pats)), seed, *[x for x in labels if x not in _QUILL_SLOT], "title-base")
        pat = pats[(base + 2 * slot) % len(pats)]
    return pat.format(
        adj=pick(ADJ, seed, *labels, "adj"), lead=lead, villain=villain, town=town, obj=obj.title(), place=place.title()
    )


def make_tagline(quill: str, seed: int, *labels: object) -> str:
    return pick(TAGLINES[quill], seed, *labels, "tagline")


def yes_and_line(actor_name: str, seed: int, *labels: object) -> str:
    return pick(YES_AND, seed, *labels, "yes-and").format(actor=actor_name)


def snack(seed: int, *labels: object) -> str:
    return pick(SNACKS, seed, *labels, "snack")


def headline(stars: float, seed: int, *labels: object, title: str, town: str, mishap: str) -> str:
    for floor, pool in HEADLINE_BANDS:
        if stars >= floor:
            return pick(pool, seed, *labels, "headline").format(
                title=title.upper(), town=town.upper(), mishap=mishap.upper()
            )
    raise AssertionError("unreachable")
