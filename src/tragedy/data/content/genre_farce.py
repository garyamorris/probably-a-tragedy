"""Farce: doors, wrong men, bedrooms, and everyone arriving at once (docs/DATA.md section 7).

Running motifs: the umbrella, the gas meter, the soufflé, Great-Uncle Percival, the blue bedroom at three, the vicar's
hat, the doorbell. Nobody ever finds out what anybody else is hiding; they are all hiding it in the same wardrobe.
Lines never use he/she for a cast member: performers can be anyone.
"""

from __future__ import annotations

L, V, F = "lead", "villain", "fool"


def _beat(beat: str, rows: list[tuple]) -> list[dict]:
    return [
        {
            "id": f"farce_{beat}_{n}",
            "logline": logline,
            "tags": tags,
            "props": props,
            "lines": [{"role": role, "text": text} for role, text in lines],
        }
        for n, (logline, tags, props, lines) in enumerate(rows, start=1)
    ]


SETUP = [
    (
        "A visitor arrives to read the gas meter and is instantly mistaken for the vicar.",
        ["door", "mistaken_identity"],
        ["door", "umbrella_stand"],
        [
            (F, "Good morning. I am only here to read the gas meter."),
            (V, "The vicar! At last! The wedding is in twelve minutes and we have not yet found a bride."),
            (L, "Wedding? What wedding? I only came to return an umbrella!"),
            (F, "I am not a vicar. But I will certainly consider it, if the hat is good."),
        ],
    ),
    (
        "The Flustered Hero has invited both fiancées to lunch, and describes this as a system.",
        ["lie", "romance"],
        ["bouquet", "chair"],
        [
            (L, "I have invited my fiancée to lunch. And my other fiancée. They arrive at one. I am perfectly calm."),
            (V, "Splendid. And which of them knows about the other?"),
            (L, "Neither. That is the foundation of the whole arrangement."),
            (F, "I am not engaged to anyone. May I sit by the window? I should like to be completely uninvolved."),
        ],
    ),
    (
        "Lunch for twelve, four chairs, and a soufflé that must on no account be sat on.",
        ["feast", "chair", "pun"],
        ["cake", "chair"],
        [
            (V, "Lunch for twelve and four chairs. We shall sit in shifts. I have drawn up a rota."),
            (L, "And the soufflé? It must not be disturbed, or it will fall, and so shall I."),
            (F, "I am sitting on the soufflé. It was the only free chair. It is very warm and surprisingly supportive."),
            (V, "Nobody move. It may yet rise."),
        ],
    ),
    (
        "A telegram arrives reading 'Believe nothing. Burn this.' and is burned before anyone finishes the sentence.",
        ["letter", "secret", "fire"],
        ["letter", "teapot"],
        [
            (V, "A telegram! 'ARRIVING TODAY STOP BELIEVE NOTHING STOP BURN THIS STOP.' Who sent it?"),
            (L, "Not me. Probably. It is in my handwriting, but I was very tired that week."),
            (F, "I have burned it, as instructed. It was easier than reading it."),
            (V, "Excellent. Now nobody knows what we are hiding. Least of all us."),
        ],
    ),
    (
        "The brother-in-law begins a welcome speech, and the doorbell keeps rewriting it.",
        ["speech", "door"],
        ["door", "umbrella_stand"],
        [
            (V, "Friends, welcome to a weekend of peace, quiet and uncomplicated relationships. Is that the doorbell?"),
            (L, "No. Nobody is expected. We shall not answer. It is a draught with ambitions."),
            (F, "That is the fourth draught. I am letting them in, and then hiding in the umbrella stand."),
            (V, "I said uncomplicated. I should like that on the record."),
        ],
    ),
]

COMPLICATION = [
    (
        "Seven doors, one corridor, and everyone certain that the exit is behind somebody else's.",
        ["door", "chase"],
        ["door", "ladder"],
        [
            (L, "Quick, through here! No, not here, that is the cupboard. Which one is the corridor?"),
            (V, "You are in the corridor. You have been in it for two minutes. It is simply very long."),
            (F, "I have gone through the same door four times. I keep coming out of the other one. It is thrilling."),
            (L, "The corridor is round, {fool}. Somebody built this house in a circle, to be spiteful."),
        ],
    ),
    (
        "The hero poses as the maid to avoid a fiancée, and the brother-in-law develops a weakness.",
        ["disguise", "romance", "mirror"],
        ["mask", "mirror"],
        [
            (L, "I am Marguerite, the maid. I am not {lead}. {lead} left in a cab, with a cold. I have checked the mirror."),
            (V, "Marguerite! What a coincidence. I have a weakness for maids and a second, smaller weakness for lies."),
            (F, "Marguerite, the mirror is on your side, but you do have a moustache. I say it kindly. Put it away before lunch."),
            (L, "It is a family trait. We are a very hairy and extremely modest family."),
        ],
    ),
    (
        "The only chair in the corridor has wheels, and sitting down is everyone's only alibi.",
        ["chair", "slapstick"],
        ["chair"],
        [
            (V, "Sit, {lead}! Nobody can accuse a person who is sitting. It is the first law of hospitality."),
            (L, "The {object} is moving! The {object} is leaving the corridor, with me on it!"),
            (F, "I will catch you! There! Oh. I have caught the {object}. You are now over there, sitting in a plant."),
            (V, "Well, at least the plant is not accusing anybody."),
        ],
    ),
    (
        "A tureen of soup begins its journey up the stairs and has not yet been seen to arrive.",
        ["stairs", "feast"],
        ["teapot"],
        [
            (F, "Soup for the bedroom! I have carried the tureen up all eighteen stairs without spilling a drop."),
            (V, "Admirable. You are, however, holding only the lid."),
            (F, "I am holding... only the lid. Where is the soup?"),
            (L, "Down the banister, I should think. Listen. It is still going."),
        ],
    ),
    (
        "Three secret notes arrange three private meetings in the same bedroom at the same time.",
        ["letter", "romance"],
        ["letter", "bed"],
        [
            (L, "A note under the door: 'Meet me in the blue bedroom at three. Come alone. Bring nothing.' I am touched."),
            (V, "I also received a note. 'The blue bedroom at three. Come alone. Bring snacks.'"),
            (F, "Mine says 'The blue bedroom at three. Come alone. Tell no one.' I have told nobody. I have only told you."),
            (L, "So three people will be alone together in the blue bedroom at three. It is the cleverest plan I have ever not made."),
        ],
    ),
    (
        "The hero attempts a dignified farewell kiss from the top of the stairs and does not stop at the bottom.",
        ["kiss", "stairs"],
        ["bouquet", "ladder"],
        [
            (L, "I shall say farewell with a kiss, from the top of the stairs. Dignified. Heroic. Brief."),
            (V, "That is the banister, {lead}. You are kissing the banister."),
            (L, "It is an excellent banister. It has been waiting its whole life for this."),
            (F, "You are now at the bottom of the stairs. The banister is still at the top. You were not formally introduced."),
        ],
    ),
]

REVERSAL = [
    (
        "It turns out the Wrong Man was the groom all along, which is more than anyone mentioned.",
        ["wedding", "mistaken_identity"],
        ["bed", "trunk"],
        [
            (V, "Someone must be the groom. The bride has been waiting in the next room since breakfast, with the register."),
            (F, "Me? I only came about the gas meter."),
            (L, "Look at the register! The groom's name is {fool}! Right house, right man, wrong everything else."),
            (F, "I am delighted. And a little frightened. May I sit down on the bed?"),
        ],
    ),
    (
        "Three people hide in the wardrobe from a fourth person, who is also in the wardrobe.",
        ["secret", "slapstick"],
        ["door", "bed"],
        [
            (L, "Quick, in the wardrobe! Nobody will look in the wardrobe!"),
            (V, "{lead}, I am already in the wardrobe. I got here first. Please remove your elbow from my ear."),
            (F, "I too am in the wardrobe. I came for a coat. I stayed out of loyalty."),
            (L, "Then who is knocking from the back of the wardrobe?"),
        ],
    ),
    (
        "The hero discovers a handsome but shifty intruder in the bedroom mirror and demands an explanation.",
        ["mirror", "slapstick"],
        ["mirror", "bed"],
        [
            (L, "There is a stranger in the room! They are wearing my coat! They copy everything I do!"),
            (V, "That is a mirror, {lead}."),
            (L, "That is what they want us to think. Look, they are pointing at me. Stop pointing at me!"),
            (F, "Please don't shout at the mirror. It is very sensitive. I have been speaking kindly to it all week."),
        ],
    ),
    (
        "Great-Uncle Percival has died in the bed, and the wedding must not find out.",
        ["death", "lie"],
        ["bed", "chair"],
        [
            (V, "Great-Uncle Percival has died, quietly, in the bed. If the vicar finds out, the wedding is off."),
            (L, "Then Percival will attend the wedding. As a guest. A very still, very supportive guest."),
            (F, "I have dressed him. He looks marvellous. He has agreed with everything I have said."),
            (L, "Percival was always an excellent listener."),
        ],
    ),
    (
        "The hero serenades the bedroom window and, in the dark, the wrong wall.",
        ["song", "romance", "rhyme"],
        ["harp", "bouquet"],
        [
            (L, "Come to the window, my dearest dove, and hear the song of my undying love... whichever one you are!"),
            (V, "That is my bedroom wall. You are serenading plaster."),
            (F, "It is rather a good wall. It has not left yet."),
            (L, "Then I shall continue. It is the most attentive audience I have had all week."),
        ],
    ),
]

TWIST = [
    (
        "The trunk everyone has been guarding contains the body, which turns out to be potatoes in a good suit.",
        ["death", "secret"],
        ["trunk"],
        [
            (L, "Open the {object}. Slowly. Brace yourselves for the body."),
            (F, "It is not a body. It is potatoes. Very well-dressed potatoes, in Percival's good suit."),
            (V, "Then what have I been burying in the garden all morning?"),
            (F, "Probably more potatoes. It is that sort of week."),
        ],
    ),
    (
        "The deed to the house is found in the cellar, around the neck of a goose.",
        ["goose", "treasure"],
        ["goose", "trunk"],
        [
            (F, "I have found the owner of the house. It is down here. It is wearing the deed around its neck."),
            (V, "That is a goose. A goose cannot own a house. There are laws."),
            (L, "There are no laws on the subject, {villain}. I asked the solicitor to check. Twice."),
            (F, "It has allowed us to stay. It would only like the bread to be better."),
        ],
    ),
    (
        "The family puts the Wrong Man on trial in the cellar before a jury of twelve unimpressed barrels.",
        ["trial", "speech"],
        ["chair", "bottle"],
        [
            (V, "Members of the jury: the accused is charged with arriving at the wrong house. How do you plead?"),
            (F, "Innocent, by reason of directions. They said 'second left'. This was a second left."),
            (L, "The defence rests, my lord. The jury is twelve barrels, and I believe they were moved."),
            (V, "They have not moved an inch. Guilty, then, of everything."),
        ],
    ),
    (
        "Music is coming from under the floor. The cellar, it turns out, has a very busy social calendar.",
        ["dance", "secret"],
        ["harp", "banner"],
        [
            (L, "Music? Under the floor? Who is dancing in the {place}?"),
            (V, "The neighbours, and most of {town}. Every night since the wedding was announced. It is a secret society. They dance."),
            (F, "I am in it. I am the treasurer. Dues are two buttons and a good attitude."),
            (L, "I have always wanted to join a secret society. Is there a casserole rota?"),
        ],
    ),
    (
        "The brother-in-law's great scheme turns out to be a surprise party, which is worse.",
        ["feast", "lie"],
        ["cake", "banner"],
        [
            (L, "Why is the cellar full of bunting and a very large cake with my name on it?"),
            (V, "It was meant to be a surprise. I have been lying to you for three weeks. It was exhausting."),
            (F, "I was not invited. I came in through the coal chute. May I stay? I brought nothing, but I am very surprised."),
            (L, "You scheming, thoughtful soul. I shall never forgive you. Is it lemon?"),
        ],
    ),
]

FINALE = [
    (
        "Eleven people use seven doors simultaneously, and somehow end up where they started.",
        ["door", "slapstick"],
        ["door", "umbrella_stand"],
        [
            (L, "Everyone out through the doors, calmly, in an orderly fashion, one door each!"),
            (V, "There are eleven of us and seven doors. I will take two. I have earned two."),
            (F, "I went out of the front door and in through the window, and now I am the person in the middle."),
            (L, "We are all back in the {place}, from different directions, at once. It is the neatest thing we have ever done."),
        ],
    ),
    (
        "The wedding goes ahead with the right hat and, by a clerical oversight, the wrong couple.",
        ["wedding", "kiss"],
        ["bouquet"],
        [
            (V, "Do you, {lead}, take {fool} to be your lawfully wedded... oh. This is the wrong couple. The list was eaten."),
            (L, "I will if you will, {fool}. I do not know why, but it feels right. It feels damp."),
            (F, "I do. I came to read the gas meter, and I have stayed for the cake."),
            (V, "By the power vested in me by a borrowed hat, I pronounce you both... something. You may kiss, ideally each other."),
        ],
    ),
    (
        "Lunch is finally served, and the soufflé rises, and rises, and does not stop.",
        ["feast", "slapstick"],
        ["cake", "chair"],
        [
            (V, "Ladies, gentlemen and one goose: lunch is served. Sit where you can. Sit on whom you must."),
            (L, "The soufflé has risen! After eleven attempts, it has risen!"),
            (V, "It is still rising, {lead}. It has reached the ceiling."),
            (F, "It has left through the roof. It wishes us all well. It wants to see the world."),
        ],
    ),
    (
        "Everyone confesses everything at once, and the confessions cancel each other out.",
        ["lie", "speech"],
        ["umbrella_stand"],
        [
            (L, "I confess! I have two fiancées, a borrowed umbrella, and a deep, abiding fear of the cellar!"),
            (V, "I confess! I arranged everything: the wedding, the telegram, the soufflé and the goose!"),
            (F, "I confess! I am from the gas board! I do not know why I am saying this so loudly!"),
            (L, "Wonderful. Now we all know everything, and nobody has to do anything about it."),
        ],
    ),
    (
        "The chandelier, which has hung over the whole farce with intent, finally comes down.",
        ["chandelier", "door"],
        ["chandelier", "door"],
        [
            (V, "Does anyone else notice that the chandelier is lower than it was? Considerably lower?"),
            (F, "It was bolted to the ceiling. I have the bolts here in my pocket. I thought they were buttons."),
            (L, "Everyone stand perfectly still. Do not breathe. Do not, under any circumstances, ring the doorbell."),
            (F, "...I think that was the doorbell."),
        ],
    ),
]

GENRE = {
    "id": "farce",
    "name": "Farce",
    "blurb": "Doors. So many doors, and everyone arriving at once.",
    "palette": {"sky": "#f6d28b", "flat": "#e07a5f", "floor": "#3d2c2e", "accent": "#81b29a"},
    "roles": {"lead": "The Flustered Hero", "villain": "The Scheming Brother-in-Law", "fool": "The Wrong Man"},
    "skill_by_beat": {
        "setup": "comedy",
        "complication": "physical",
        "reversal": "improv",
        "twist": "comedy",
        "finale": "physical",
    },
    "sets": {
        "setup": "parlour",
        "complication": "corridor",
        "reversal": "bedroom",
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
