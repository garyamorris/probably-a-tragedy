"""Whodunit: a dead host, a helpful butler, and a goose who saw everything and will not be drawn (docs/DATA.md section 7).

Running motifs: Lord Pembry-Wattle, his last word ('marmalade'), Mrs. Grimble, the soup, 9:41, the biscuit tin, the
goose, the spoon, the chandelier that has been loose since Tuesday. The butler is, obviously, the butler.
Lines never use he/she for a cast member: performers can be anyone.
"""

from __future__ import annotations

L, V, F = "lead", "villain", "fool"


def _beat(beat: str, rows: list[tuple]) -> list[dict]:
    return [
        {
            "id": f"whodunit_{beat}_{n}",
            "logline": logline,
            "tags": tags,
            "props": props,
            "lines": [{"role": role, "text": text} for role, text in lines],
        }
        for n, (logline, tags, props, lines) in enumerate(rows, start=1)
    ]


SETUP = [
    (
        "His lordship raises a glass, announces that he knows what everyone did, and falls into the soup.",
        ["death", "feast", "poison"],
        ["bottle", "cake"],
        [
            (V, "His lordship raised his glass, said 'I know what every one of you did,' and fell into the soup."),
            (L, "Then nobody leaves this room. Nobody touches the soup. Nobody touches his lordship."),
            (F, "I touched the soup. It is lovely. It is a little murdery, but very well seasoned."),
            (V, "I should mention that I am the butler, that I was nowhere near the soup, and that nobody asked."),
        ],
    ),
    (
        "The storm has washed out the bridge, and the front door has locked itself in solidarity.",
        ["storm", "door"],
        ["door", "lantern"],
        [
            (V, "I regret to say the bridge to {town} has gone, the telephone has been eaten, and the weather has locked all the doors."),
            (L, "So we are trapped in a country house with a dead host and no way out?"),
            (V, "Not at all. There are eleven ways out. All of them lead into the weather."),
            (F, "I saw the storm lock the front door. It used a key shaped like lightning. I can describe the key."),
        ],
    ),
    (
        "There are exactly two witnesses to the crime, and one of them is a goose.",
        ["goose", "secret"],
        ["goose"],
        [
            (F, "I saw everything. I was in the corner, quiet as a hat. It happened at 9:41, and it was extremely rude."),
            (L, "What happened at 9:41?"),
            (F, "Everything. All of it, one thing after another, in the wrong order. Ask the {object}; it saw more than I did."),
            (V, "The witness is unreliable and the {object} is a goose. I would advise the detective to disregard both."),
        ],
    ),
    (
        "It is a masked ball, which is a lovely idea until somebody has to be identified.",
        ["mask", "disguise"],
        ["mask"],
        [
            (L, "A masked ball. Everyone in a face that is not theirs. How am I to find a murderer in all this?"),
            (V, "I have taken the liberty of collecting everyone's masks, shoes and, as a courtesy, their opinions."),
            (F, "I took mine off. There was another underneath. I am three masks deep and I have lost track of who I am."),
            (L, "Splendid. Then the first suspect is whoever asked for the masks. {villain}, please do not leave the room."),
        ],
    ),
    (
        "Every guest received an invitation reading 'I know what you did.' One of them is from an aunt.",
        ["letter", "secret"],
        ["letter", "cake"],
        [
            (L, "Each of you received an invitation reading 'I know what you did.' May I see them?"),
            (V, "I received one too. I assumed it was about the soup. It is always about the soup."),
            (F, "Mine says 'I know what you did, and I forgive you, and could you bring a cake.' It is from my aunt."),
            (L, "I will set that one aside."),
        ],
    ),
]

COMPLICATION = [
    (
        "A second body turns up in the library, between 'Poisons' and 'Poisoners: A Beginner's Guide.'",
        ["murder", "poison"],
        ["book", "bottle"],
        [
            (F, "I have found a second body, in the {place}, between 'Poisons' and 'Poisoners: A Beginner's Guide.'"),
            (V, "It is Mrs. Grimble, the cook. She knew the recipe for the soup, the wine and, I regret to say, me."),
            (L, "What exactly did she know about you?"),
            (V, "Only that I am extremely helpful. I shall fetch some tea and be somewhere else."),
        ],
    ),
    (
        "The detective leans on a book, the bookcase revolves, and the investigation takes a brief and unplanned turn.",
        ["secret", "slapstick"],
        ["book", "ladder"],
        [
            (L, "This book is conspicuously out of place. It is called 'Do Not Pull This Book.'"),
            (F, "Do not pull it. It says so on the spine."),
            (L, "Too late! The bookcase is turning! I am being taken somewhere, in the line of duty, and I shall report back!"),
            (V, "I shall note that the detective has gone into the wall. I will fetch the sherry; it is that sort of evening."),
        ],
    ),
    (
        "The detective interrogates the suspects and obtains two alibis for the same spoon.",
        ["lie", "trial"],
        ["teapot"],
        [
            (L, "Where were you at 9:41, {villain}?"),
            (V, "In the pantry, polishing a spoon. The spoon will confirm it."),
            (F, "I was also in the pantry. We were not together. We were politely adjacent."),
            (L, "So the spoon was polished twice, by two people who were not together. That spoon has seen more than anyone in this house."),
        ],
    ),
    (
        "Every clue the detective finds points firmly at the detective.",
        ["mistaken_identity", "murder", "mirror"],
        ["mirror", "book"],
        [
            (L, "A footprint, size seven. A button from a green coat. A monocle engraved with my initials. How curious."),
            (F, "Look in the mirror, detective. Green coat. Size seven shoes. One monocle. Quite a convincing murderer."),
            (V, "The detective is the culprit. I am shocked. I am also, privately, impressed by the efficiency."),
            (L, "Nonsense. I have been framed. Quite possibly by myself, but still."),
        ],
    ),
    (
        "A poem is found under the blotter, and it is somehow worse than the murder.",
        ["rhyme", "letter"],
        ["letter", "book"],
        [
            (L, "His lordship's last word was 'marmalade.' His last poem was worse. 'Roses are red, the soup has gone sour...'"),
            (F, "'...I shall be dead within the hour.' It scans! Whoever did it, his lordship died a poet."),
            (V, "Evidence in verse. I have never been so insulted on behalf of the law."),
            (L, "It is signed 'Yours, in agony and iambs.' I believe we are looking for an English teacher."),
        ],
    ),
]

REVERSAL = [
    (
        "The body is the gardener in his lordship's dinner jacket, which raises further questions about the jacket.",
        ["death", "mistaken_identity"],
        ["tree", "trunk"],
        [
            (F, "I looked closely at the body. It is wearing his lordship's dinner jacket. It has the gardener's hands."),
            (L, "So the dead man is not the host."),
            (V, "Then where is the host? And why does the gardener own such a very nice jacket?"),
            (L, "Two excellent questions. I shall write them on my cuff and refer to them later."),
        ],
    ),
    (
        "The butler's unbreakable alibi turns out to rest on a garden clock that has been wrong since 1923.",
        ["lie", "secret"],
        ["clock"],
        [
            (V, "I can prove I was nowhere near the library at 9:41. The garden clock confirms it."),
            (L, "The garden clock says 9:41. It also says it is Thursday. It has said so since 1923."),
            (F, "I have always liked that clock. It never lies. It simply refuses to move."),
            (V, "I stand by the clock. A clock that does not move is a clock that cannot move against you."),
        ],
    ),
    (
        "The motive flips: his lordship was penniless, and the family fortune is a very large stuffed pike.",
        ["treasure", "secret"],
        ["fish", "trunk"],
        [
            (F, "I have found the family fortune. It is in the greenhouse. It is a stuffed pike. The pike is wearing a monocle."),
            (L, "That is the fortune? I thought his lordship was rich!"),
            (V, "He was rich in spirit, and in pikes. Mostly in pikes."),
            (L, "Then someone killed him for a pike. I have never been so concerned for a fish."),
        ],
    ),
    (
        "The detective and the prime suspect waltz in the greenhouse, strictly in the interests of the investigation.",
        ["romance", "dance"],
        ["bouquet"],
        [
            (V, "May I have this dance, detective? Purely to establish where everyone was standing at 9:41."),
            (L, "Purely investigatory. One has to be thorough. Mind the geraniums."),
            (F, "I am witnessing this. I do not know what I am witnessing. It is mostly elbows."),
            (L, "I find myself, {villain}, entirely unable to suspect you. This is a serious professional problem."),
        ],
    ),
    (
        "The soup is cleared of all charges. The biscuit, however, has a great deal to answer for.",
        ["poison", "feast"],
        ["bottle", "cake"],
        [
            (L, "The laboratory report is in. The soup was perfectly wholesome. Slightly dull, but wholesome."),
            (F, "I knew it. I said it was only a little murdery. I now apologise to the soup."),
            (V, "Then what was it, detective? A tragic accident? A biscuit?"),
            (L, "Oh. Oh no. Why would you say 'a biscuit'? {villain}, why are you holding the biscuit tin?"),
        ],
    ),
]

TWIST = [
    (
        "The Helpful Butler confesses to the murder but insists, in mitigation, that the victim asked.",
        ["murder", "betrayal", "speech"],
        ["bottle", "trunk"],
        [
            (V, "I did it, detective. But I wish it recorded that his lordship asked me to, in writing, with a lovely signature."),
            (L, "He asked to be murdered?"),
            (V, "He said it would raise the tone of the weekend. He wanted it done before the bread course."),
            (F, "He did say he wanted to go out with a bang. I thought he meant fireworks."),
        ],
    ),
    (
        "The goose finally testifies. It honks once, with enormous confidence, in the direction of the biscuit tin.",
        ["goose", "trial"],
        ["goose", "chair"],
        [
            (L, "Order! The court calls its only reliable witness. {fool}, please translate."),
            (F, "The goose says: 'HONK.' In my professional opinion, this means 'it was the one with the biscuit tin.'"),
            (V, "That is slander. From a goose. In a cellar. At an inconvenient time."),
            (L, "It is the first testimony all night that was not a lie or a poem. Hand over the biscuit tin, {villain}."),
        ],
    ),
    (
        "The butler removes the whiskers, and it is his lordship, who has been serving the soup for six years.",
        ["disguise", "secret", "mask"],
        ["mask"],
        [
            (F, "If you take off the whiskers... {villain} is his lordship. Lord Pembry-Wattle has been the butler all along."),
            (V, "I wished to hear what people said when they thought I was not listening. It was a mistake. They said nothing."),
            (L, "Then who is the man in the soup?"),
            (V, "A cousin. I am so sorry. I was behind the tureen for most of it and I missed the details."),
        ],
    ),
    (
        "His lordship's ghost appears in the cellar and points at the culprit, and at everyone else, in turn.",
        ["ghost", "death"],
        ["ghost_sheet"],
        [
            (F, "Detective, behind you. A ghost, in a dinner jacket, pointing."),
            (L, "Lord Pembry-Wattle! Who did this to you? Point at the culprit!"),
            (F, "He is pointing at me. Now at you. Now at {villain}. Now at the wine. Now at {town}, which is eleven miles away."),
            (V, "He is also saying 'marmalade' again. He does that. I believe it is a clue, or a preference."),
        ],
    ),
    (
        "Behind the wine rack lies the real motive: a crown, a duchy, and a pond.",
        ["crown", "treasure"],
        ["crown", "trunk"],
        [
            (L, "The motive, at last: behind the wine rack, the Crown of Little Mumbling. A duchy of six houses and a pond."),
            (V, "A duchy! Whoever wore that crown would be a duke. Of the pond."),
            (F, "I would murder for a pond. I am not saying I did. I am saying I understand."),
            (L, "The most pathetic motive I have ever heard, and the most believable."),
        ],
    ),
    (
        "The Helpful Butler produces a sword from the umbrella stand and politely threatens everyone with it.",
        ["sword", "murder"],
        ["sword", "umbrella_stand"],
        [
            (V, "I regret that I must now be unhelpful. Nobody move. This sword has been in the umbrella stand since Easter."),
            (L, "Put it down, {villain}! You are a butler! Butlers do not have swords!"),
            (V, "I do not have a licence for it, certainly. But I have a great deal of sympathy for the sword."),
            (F, "For the record, it took four attempts to draw. The umbrella stand held on very bravely."),
        ],
    ),
]

FINALE = [
    (
        "The detective gathers the suspects and announces that everyone in this room is a suspect, including the room.",
        ["speech", "murder"],
        ["chair"],
        [
            (L, "I have gathered you all in the {place} because everyone in this room is a suspect. Including the room."),
            (V, "The room has an alibi, detective. It was in the house the whole time."),
            (L, "The killer had access to the soup, knew the library, and is at this moment handing round the biscuits."),
            (V, "...I do so like to be useful."),
        ],
    ),
    (
        "The guilty party is exposed, and the chandelier, sensing a climax, joins in.",
        ["chandelier", "slapstick"],
        ["chandelier", "rope"],
        [
            (L, "The weapon was never the soup. It was the chandelier, which has been loose since Tuesday!"),
            (F, "I did say it looked lower. I said it to the goose. The goose said nothing."),
            (V, "I did not touch the chandelier. I merely polished it, thoroughly, with intent."),
            (L, "Everybody stand clear of the... oh. It has fallen. It was the only predictable thing all evening."),
        ],
    ),
    (
        "The detective proposes tea as a test of guilt, and the teapot proposes a goose.",
        ["feast", "goose"],
        ["teapot", "goose"],
        [
            (L, "The tea is poured. The killer, I believe, will be the one who does not drink it."),
            (V, "I do not take tea. It is a long-standing and entirely unrelated principle."),
            (L, "Everyone will drink, on my count. One, two... why is there a goose in the teapot?"),
            (F, "It saw everything. It is trying to leave."),
        ],
    ),
    (
        "The guilty party flees, and every door in the house turns out to be a cupboard.",
        ["door", "chase"],
        ["door", "umbrella_stand"],
        [
            (V, "I shall be leaving by the front door. Do not follow. I have a head start and an umbrella."),
            (L, "Stop! Every exit is guarded!"),
            (F, "Detective, that door is a cupboard. That door is a cupboard. That one is a cupboard that thinks it is a door."),
            (V, "This is the third cupboard. I have never been so thoroughly defeated by joinery."),
        ],
    ),
    (
        "His lordship wakes up. He was only asleep in the soup, and is mortified about the fuss.",
        ["death", "reunion"],
        ["bottle"],
        [
            (F, "His lordship has woken up. He was asleep in the soup. He says he is very sorry about the fuss."),
            (L, "Asleep? For three hours? In the soup?"),
            (V, "He is a very sound sleeper. I should have mentioned it. I was busy being suspicious."),
            (L, "Then I have solved nothing. I shall bill for the weekend regardless."),
        ],
    ),
]

GENRE = {
    "id": "whodunit",
    "name": "Whodunit",
    "blurb": "A dead host, a helpful butler, and a goose who saw everything and will not be drawn.",
    "palette": {"sky": "#26303b", "flat": "#6b705c", "floor": "#1c1a1a", "accent": "#b23a48"},
    "roles": {"lead": "The Out-of-Depth Detective", "villain": "The Helpful Butler", "fool": "The Witness Who Saw Everything"},
    "skill_by_beat": {
        "setup": "drama",
        "complication": "improv",
        "reversal": "menace",
        "twist": "drama",
        "finale": "menace",
    },
    "sets": {
        "setup": "ballroom",
        "complication": "library",
        "reversal": "garden",
        "twist": "cellar",
        "finale": "parlour",
    },
    "beats": {
        "setup": _beat("setup", SETUP),
        "complication": _beat("complication", COMPLICATION),
        "reversal": _beat("reversal", REVERSAL),
        "twist": _beat("twist", TWIST),
        "finale": _beat("finale", FINALE),
    },
}
