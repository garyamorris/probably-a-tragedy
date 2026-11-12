"""Melodrama: moustaches, mortgages, wills and a 4:15 that has never been late for a tragedy (docs/DATA.md section 7).

Running motifs (so any setup can be paid off by any finale): the mortgage, the clock, the will, the hat stand,
the cat, the parrot, the 4:15, the moustache, the sausage rolls. Nobody underreacts. Nobody is cruel.
Lines never use he/she for a cast member: performers can be anyone.
"""

from __future__ import annotations

L, V, F = "lead", "villain", "fool"


def _beat(beat: str, rows: list[tuple]) -> list[dict]:
    return [
        {
            "id": f"melodrama_{beat}_{n}",
            "logline": logline,
            "tags": tags,
            "props": props,
            "lines": [{"role": role, "text": text} for role, text in lines],
        }
        for n, (logline, tags, props, lines) in enumerate(rows, start=1)
    ]


SETUP = [
    (
        "The mortgage falls due at noon, and the parlour clock has, suspiciously, started to hurry.",
        ["lie", "speech"],
        ["clock"],
        [
            (V, "The mortgage falls due at noon, {lead}. Pay it, or the parlour, the piano and the cat's little cushion are mine."),
            (L, "But it is barely nine o'clock, {villain}!"),
            (V, "Look at the {object}. Look at it very, very carefully."),
            (F, "It says noon. It has said noon since breakfast. I think it is frightened of you."),
        ],
    ),
    (
        "A letter arrives from the sailor Jack, three years late and still slightly damp.",
        ["romance", "letter"],
        ["letter", "bouquet"],
        [
            (L, "A letter from Jack! Posted three years ago, and only now has it stopped being damp."),
            (F, "I fetched it from the river. The river had already read it. It was very moved."),
            (L, "'Dearest, I return on the 4:15, with a ring, a medal and a very small parrot.'"),
            (V, "The 4:15. How interesting. I shall be on the platform, wearing my best moustache."),
        ],
    ),
    (
        "Papa's funeral tea is served, and the sausage rolls are vanishing at a speed Papa would have admired.",
        ["mourning", "feast"],
        ["cake", "bottle"],
        [
            (L, "Papa is cold in the ground, and the tea is warm on the table. Such is life, and such are sausage rolls."),
            (V, "My deepest condolences, {lead}. My deeper condolences about the rent. May I have a sausage roll?"),
            (F, "I have eaten four sausage rolls in Papa's memory. He would have wanted me to be strong."),
            (L, "He would have wanted you to stop at three."),
        ],
    ),
    (
        "Papa's study has been locked since the funeral, and the landlord has begun wearing the key on a chain.",
        ["door", "secret", "fire"],
        ["door"],
        [
            (L, "Papa's study has been locked since the funeral. What is behind that {object}, {villain}?"),
            (V, "Nothing. Paperwork. Dust. A small and entirely legal fire."),
            (F, "I can smell it from here. Paper, and wax, and the word 'whereas'."),
            (V, "Heel, {fool}. Sit. Go and be loyal somewhere else."),
        ],
    ),
    (
        "The landlord proposes marriage, citing an enormous fortune and, in a smaller voice, a patched elbow.",
        ["wedding", "lie"],
        ["bouquet"],
        [
            (V, "Marry me, {lead}, and I shall make you the owner of an enormous fortune. Ignore the patched elbow; it is fashionable."),
            (L, "I would sooner marry the hat stand!"),
            (F, "The hat stand is flattered, but it has asked me to say it is spoken for."),
            (V, "Then I shall wait. I am patient, {lead}. My moustache is not."),
        ],
    ),
]

COMPLICATION = [
    (
        "The heiress is tied to the railway line, and the 4:15 has never once been late for a tragedy.",
        ["death", "chase"],
        ["rope", "clock"],
        [
            (L, "Unhand me, {villain}! This rope is made of knots and bad intentions!"),
            (V, "The 4:15 is four minutes away, {lead}. It has never once been late for a tragedy."),
            (F, "I will save you! Right after I find a knife. Or a pair of scissors. Or, failing those, teeth."),
            (L, "Teeth are fine, {fool}. Please chew faster."),
        ],
    ),
    (
        "A blizzard of torn paper sweeps the moor, and the Faithful Hound starts to sing.",
        ["storm", "song"],
        ["lantern", "tree"],
        [
            (L, "The moor is wide, the night is cold, and my slippers are made entirely of hope."),
            (F, "I shall sing to keep your spirits up. 'Oh, the wind, the wind, the wind, and then the wind again.'"),
            (V, "Stop that. I am trying to menace you through a blizzard, and you are making it cosy."),
            (L, "It is rather cosy, actually. Do go on, {fool}."),
        ],
    ),
    (
        "The landlord offers the Faithful Hound a pork pie in exchange for one small betrayal.",
        ["betrayal", "feast"],
        ["cake"],
        [
            (V, "{fool}, I have a pork pie. A whole one. It is yours if you tell me where the will is hidden."),
            (F, "I could never betray {lead}. I am loyal. I am extremely loyal. How big is the pie?"),
            (L, "{fool}! You are my last friend on this wretched moor!"),
            (F, "I know. I know. It is a very good pie."),
        ],
    ),
    (
        "A duel is fought on the cliff edge with one rubber sword, one teapot and no clear rules.",
        ["sword", "slapstick"],
        ["sword", "teapot"],
        [
            (V, "En garde, {lead}! I have not duelled since the incident with the pudding."),
            (L, "I have never held a sword! I have held a teapot, once, in anger."),
            (F, "Use the teapot! No, the sword! No, the teapot! Please choose, I am extremely frightened."),
            (V, "Do hold still, {lead}. I am trying to be terrifying, and you are being difficult with a teapot."),
        ],
    ),
    (
        "A kindly widow offers the heiress shelter, a bonnet and an unexpectedly robust moustache.",
        ["disguise", "mistaken_identity"],
        ["lantern", "rope"],
        [
            (V, "Good evening, dear. I am an entirely different person: a kindly widow who knits and owns no railways."),
            (L, "What a relief! You have such a lovely bonnet. And such a... remarkable upper lip."),
            (V, "Hereditary. Come, let me take you somewhere with a great deal of rope."),
            (F, "The widow is so kind! Why is the rope always the first thing on the menu?"),
        ],
    ),
]

REVERSAL = [
    (
        "The will is found in the least-opened book in the library, and it leaves everything to the cat.",
        ["treasure", "letter"],
        ["book", "letter"],
        [
            (F, "I have found the will! It was inside 'Sensible Investments, Volume Nine.' Nobody ever opens that one."),
            (L, "Read it aloud, {fool}!"),
            (F, "'To my beloved daughter I leave my blessing and my watch. The fortune goes in trust to...' the cat."),
            (V, "The cat? Then I demand to be appointed the cat's guardian. Nobody tell the cat."),
        ],
    ),
    (
        "The landlord's terrible secret is revealed: a very large hat, and nowhere else to live.",
        ["speech", "secret"],
        ["trophy"],
        [
            (V, "I never wanted your parlour, {lead}. I wanted a parlour. Any parlour. I have been living in a very large hat."),
            (L, "A hat, {villain}?"),
            (V, "It is draughty. The brim leaks. I keep the {object} in it, for company."),
            (F, "I will fetch you a blanket, {villain}. Then I shall go back to hating you. It is a busy week."),
        ],
    ),
    (
        "The Wronged Heiress learns that the true heiress is, in fact, the Faithful Hound.",
        ["crown", "mistaken_identity"],
        ["crown"],
        [
            (V, "The birthmark, {lead}! The one shaped like a small crown! You do not have it. {fool} does."),
            (F, "That is a rash. I have had it since the bath."),
            (L, "All these years I walked you, I fed you, I gave you the good biscuits..."),
            (F, "Then I shall be generous in victory. You may keep the other biscuits."),
        ],
    ),
    (
        "The landlord throws the will on the fire, only to learn that the Faithful Hound has already eaten it.",
        ["fire", "feast"],
        ["candle", "letter"],
        [
            (V, "Behold, {lead}! I cast the will upon the fire! Now your claim is ash!"),
            (F, "Wait. I have already eaten it. I got there first. It tasted of wax and legal destiny."),
            (L, "Then the will lives on, inside {fool}!"),
            (V, "Then we shall all have to wait for nature to take its course. Everyone sit down. Nobody speak."),
        ],
    ),
    (
        "The library lamp goes out, and the heiress embraces the wrong moustache.",
        ["kiss", "mistaken_identity", "romance"],
        ["candle", "ladder"],
        [
            (L, "The lamp has gone out! Jack, my darling, is that you in the dark?"),
            (V, "...Possibly."),
            (L, "I knew it! Kiss me, before the 4:15 does something dramatic!"),
            (F, "Unhand {lead}! That is not Jack! Jack has a parrot! This one only has a faint smell of wax!"),
        ],
    ),
]

TWIST = [
    (
        "The grave begins to move. It has Papa's shoes.",
        ["death", "reunion", "mourning"],
        ["skull", "tree"],
        [
            (F, "{lead}, the grave is moving. I am not saying it is Papa. I am saying it has his shoes."),
            (L, "Papa! You are alive!"),
            (V, "Impossible. I paid for that headstone. I paid extra for the cherub."),
            (F, "Papa says he was hiding from the bank. He says the soil was surprisingly good for his back."),
        ],
    ),
    (
        "Inside the locket is a baby portrait. The baby has a moustache, and it is the landlord's.",
        ["reunion", "secret"],
        ["lantern"],
        [
            (L, "In my mother's locket there is a portrait of a baby. A baby with... a moustache."),
            (V, "That is my baby picture, {lead}. It was taken the day we were separated at the fair."),
            (F, "You are siblings! That explains the rent, the railway line, and the matching ears."),
            (V, "I was lonely. It is how I show affection. I am told it is not widely recommended."),
        ],
    ),
    (
        "A ghost rises over Papa's grave. It has a tail, and a bedsheet on backwards.",
        ["ghost", "disguise"],
        ["ghost_sheet", "lantern"],
        [
            (F, "Woooo. I am the ghost of Papa. I am extremely dead and not at all a hound under a sheet."),
            (V, "That ghost has a tail. I can see the tail."),
            (F, "The dead wag too, {villain}. It is well documented."),
            (L, "Thank you, {fool}. Your sheet is on backwards, but I am deeply moved."),
        ],
    ),
    (
        "The bottle that killed Papa is found, and it is signed, with a flourish, by the landlord.",
        ["poison", "murder", "trial"],
        ["bottle", "skull"],
        [
            (F, "I have found the bottle that killed Papa. It says 'Poison' on the front and 'Landlord's Own' on the back."),
            (V, "Anyone could have written that. Anyone with my handwriting."),
            (L, "It is signed, {villain}. 'Yours sincerely, the villain.'"),
            (V, "I sign everything. It is a compulsion. It is in the moustache."),
        ],
    ),
    (
        "The moustache comes off, and the landlord turns out to be the sailor Jack.",
        ["betrayal", "mask"],
        ["mask"],
        [
            (F, "Wait. If I take off the moustache, {villain} is Jack. {villain} is the sailor. I am so confused."),
            (L, "Jack?! You posted the letter, you wrote the mortgage, and you tied me to the tracks?"),
            (V, "I was lonely at sea, {lead}. I got into property. The parrot was a separate decision."),
            (F, "I am going to need everybody to sit down, and also the parrot."),
        ],
    ),
]

FINALE = [
    (
        "The landlord is defeated and begins to die, in no particular hurry.",
        ["death", "speech", "sword"],
        ["sword", "banner"],
        [
            (V, "Aargh! You have bested me, {lead}! I am slain! I am dying! I am dying slightly more!"),
            (L, "Is that the end of it, {villain}?"),
            (V, "No. There is a speech. Gather round. It is mostly apologies and a recipe."),
            (F, "Please die, {villain}. The 4:15 is in the next scene and it hates to be kept waiting."),
        ],
    ),
    (
        "The landlord's fiendish chandelier trap goes off, and the chandelier picks the landlord.",
        ["chandelier", "slapstick", "stairs"],
        ["chandelier", "rope"],
        [
            (V, "Stand upon the grand staircase, {lead}, beneath the chandelier! My fiendish contraption will finally..."),
            (F, "Cutting the rope, {lead}! Brace yourselves!"),
            (L, "{fool}, no! {villain} is the one standing under..."),
            (V, "I am wearing the chandelier. I came down the stairs in it. I would like it noted that I have never been so well lit."),
        ],
    ),
    (
        "The parlour is saved, the mortgage is torn, and the wedding has a bride, a vicar and no agreed groom.",
        ["wedding", "song"],
        ["bouquet", "banner"],
        [
            (L, "The parlour is saved, the mortgage is torn, and Papa is merely resting. Let the wedding begin!"),
            (V, "Who is the groom? I put myself forward. I have a moustache and a good deal of remorse."),
            (F, "The hat stand has also put itself forward. We have agreed to let the audience decide."),
            (L, "Then let us sing, and settle it during the second verse."),
        ],
    ),
    (
        "The 4:15 arrives early for once, through the castle gates, driven by a very small parrot.",
        ["reunion", "slapstick", "door"],
        ["banner", "bouquet"],
        [
            (F, "Hark! The 4:15! It is early, for the first time in its life, and it is coming through the front door!"),
            (L, "Jack? Is that you at last, on the footplate?"),
            (V, "It is a parrot, {lead}. The train is being driven by a very small parrot."),
            (F, "The parrot is doing wonderfully. It has only run over the one flowerbed."),
        ],
    ),
    (
        "With the plot exhausted, the cast appeals directly to the audience, and a hat goes round.",
        ["speech", "treasure"],
        ["trunk", "banner"],
        [
            (L, "Friends, neighbours, patrons of {town}: the mortgage remains unpaid, and the 4:15 has been cancelled."),
            (V, "It is true. I have no more moustache to twirl. I do, however, have a hat. Pass it round."),
            (F, "Every penny goes to the parlour. One penny to me, for the ham."),
            (L, "And should we not be saved by the end of the hat, we shall simply perform it all again."),
        ],
    ),
]

GENRE = {
    "id": "melodrama",
    "name": "Melodrama",
    "blurb": "Moustaches, mortgages and a 4:15 that is never late for a tragedy.",
    "palette": {"sky": "#3a2a4a", "flat": "#8c2f39", "floor": "#2a1b1b", "accent": "#f2c14e"},
    "roles": {"lead": "The Wronged Heiress", "villain": "The Moustachioed Landlord", "fool": "The Faithful Hound"},
    "skill_by_beat": {
        "setup": "drama",
        "complication": "menace",
        "reversal": "romance",
        "twist": "menace",
        "finale": "drama",
    },
    "sets": {
        "setup": "parlour",
        "complication": "moor",
        "reversal": "library",
        "twist": "graveyard",
        "finale": "castle",
    },
    "beats": {
        "setup": _beat("setup", SETUP),
        "complication": _beat("complication", COMPLICATION),
        "reversal": _beat("reversal", REVERSAL),
        "twist": _beat("twist", TWIST),
        "finale": _beat("finale", FINALE),
    },
}
