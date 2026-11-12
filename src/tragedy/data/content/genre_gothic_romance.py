"""Gothic romance: moors, candles, brooding, a letter, and a ghost who is mostly disappointed (docs/DATA.md section 7).

Running motifs: the candle that goes out whenever anyone says something hopeful, the west wing, the Bishop of Mumbling,
the puddle that was a letter of reference, the chandelier, the goose on the moor, Dorothea the pony, Tuesday.
Lines never use he/she for a cast member: performers can be anyone.
"""

from __future__ import annotations

L, V, F = "lead", "villain", "fool"


def _beat(beat: str, rows: list[tuple]) -> list[dict]:
    return [
        {
            "id": f"gothic_romance_{beat}_{n}",
            "logline": logline,
            "tags": tags,
            "props": props,
            "lines": [{"role": role, "text": text} for role, text in lines],
        }
        for n, (logline, tags, props, lines) in enumerate(rows, start=1)
    ]


SETUP = [
    (
        "The new governess crosses the moor in a storm, clutching a letter of reference that has not survived the rain.",
        ["storm", "letter"],
        ["lantern", "letter"],
        [
            (L, "The directions said 'just past the second gorse bush.' I have passed eleven. They were all rather sinister."),
            (F, "It is the house with the light on. Do not go in. I would say that more ominously if I had the energy."),
            (V, "You are late. The last governess was late too. She is in the walls now, I think. She sends her regards."),
            (L, "I carry a letter of reference from the Bishop of Mumbling. It has, regrettably, become a puddle."),
        ],
    ),
    (
        "A figure on the hill broods at the horizon, in the rain, without an umbrella.",
        ["romance", "mourning"],
        ["moon", "tree"],
        [
            (L, "There is a figure on the hill, gazing at the horizon as though it owed them money."),
            (F, "That is {villain}, who has been brooding since Tuesday. It is a thorough job."),
            (V, "I am contemplating a loss I cannot name."),
            (L, "Is it the umbrella? You seem to have lost the umbrella."),
        ],
    ),
    (
        "The front door opens by itself, which is a ghost's way of saying 'I suppose you had better come in.'",
        ["ghost", "door"],
        ["door", "ghost_sheet"],
        [
            (F, "Oooooh. Welcome. I am the ghost. I was going to rattle some chains, but they are in the wash."),
            (L, "A ghost! How marvellous. Are you going to haunt me?"),
            (F, "I was going to. I have been trying since Tuesday. I am not very good. Nobody has been frightened since the Regency."),
            (V, "Do not encourage the ghost, {lead}. It will want to discuss its feelings."),
        ],
    ),
    (
        "Someone is singing in the closed west wing, very sincerely and about a quarter-tone flat.",
        ["song", "secret", "door"],
        ["harp", "candle"],
        [
            (L, "I can hear someone singing in the west wing. Very softly. Terribly flat."),
            (V, "There is nobody in the west wing. The door has been locked for years, and also for reasons."),
            (F, "That is me. I am practising. It is 'The Last Rose of Summer', but the rose keeps going off-key."),
            (L, "A ghost, singing flat, in a closed wing, for reasons. I could not be more delighted."),
        ],
    ),
    (
        "Tea is served on the moor in a gale, because the family believes in the weather.",
        ["feast", "speech"],
        ["teapot", "cake"],
        [
            (V, "Tea is served on the moor. It has been served on the moor since 1790. The weather is part of the family."),
            (L, "May we take it indoors? My cup is full of sideways rain."),
            (F, "I have attended this tea for two hundred years. The rain has not improved."),
            (V, "Then we shall observe a minute of silence for the scones, which have blown to Norfolk."),
        ],
    ),
]

COMPLICATION = [
    (
        "The governess descends the grand staircase with dignity and is caught at the bottom by the master of the house.",
        ["stairs", "romance"],
        ["candle"],
        [
            (L, "I shall descend the grand staircase with dignity, composure and the {object}..."),
            (V, "Mind the third step. It has taken a governess before."),
            (L, "You caught me. You have caught me quite by accident, and with surprisingly gentle hands."),
            (F, "I did not push you. I merely sighed in your direction. It is a very draughty staircase."),
        ],
    ),
    (
        "The harp plays itself in the empty ballroom, badly, and the master asks the governess to dance.",
        ["dance", "romance"],
        ["harp", "candle"],
        [
            (V, "The harp is playing itself again. Badly. It is usually a waltz. Will you... dance?"),
            (L, "I do not waltz. I have only ever danced with a coat stand, at school."),
            (F, "I would play the harp, but I have no hands. I shall do it mostly with mood."),
            (L, "Then let us be bad at it together."),
        ],
    ),
    (
        "A ghost is perched on the great chandelier, sulking in the draught.",
        ["chandelier", "ghost"],
        ["chandelier"],
        [
            (L, "There is a ghost on the {object}. It appears to be sulking."),
            (F, "I am not sulking. I am perching with disappointment. I have been up here since 1823 and no one has once looked up."),
            (V, "Do not stand beneath it, {lead}. It has fallen on two governesses and a delegation from {town}. We keep a ledger."),
            (L, "Then I shall admire it from the doorway, with great respect and a small umbrella."),
        ],
    ),
    (
        "The governess finds a letter in which the master of the house requests, from the Bishop, a dog instead of a governess.",
        ["letter", "secret"],
        ["letter", "candle"],
        [
            (L, "I found a letter in the hall, addressed to the Bishop. 'Do not send me a governess. Send me a dog. A calm one.'"),
            (V, "That was written before I met you. I would like to amend it: send me a dog and a governess."),
            (F, "{villain} has been writing it for years. I proofread. The dog was my suggestion."),
            (L, "I am not offended. I am slightly offended. But mostly I am flattered by the dog."),
        ],
    ),
    (
        "The great hall's fire will not light, because there is a storm in the chimney and the candle has opinions.",
        ["fire", "storm"],
        ["candle", "lantern"],
        [
            (V, "The fire will not light. There is a storm in the chimney. It has been there since Tuesday."),
            (L, "I could light it with this candle."),
            (F, "Oooh. The candle went out. That is the tenth time today. It is a very good effect. I am jealous."),
            (V, "It happens whenever anyone says something hopeful in this house."),
        ],
    ),
    (
        "The ghost tries to pull a chair out from under the governess. The chair, and the ghost, have other plans.",
        ["slapstick", "chair"],
        ["chair", "ghost_sheet"],
        [
            (F, "I have decided to haunt you properly. I shall move this chair. Watch closely. It is a very frightening chair."),
            (L, "I am watching. Oh, it moves. How unsettling. I shall sit down, to steady myself."),
            (F, "Not there! That is where I... oh. You have sat on the ghost. I am now underneath you."),
            (V, "Do not apologise, {lead}. It is the first time in two hundred years that anything has frightened the ghost."),
        ],
    ),
]

REVERSAL = [
    (
        "The master's diary reveals the house's terrible secret: a goose.",
        ["goose", "secret"],
        ["book", "goose"],
        [
            (L, "I found your diary. 'Today I stared at the moor again. I was not looking at the moor. I was watching for the goose.'"),
            (V, "It is a very large goose. It has a look. I have not set foot on the moor in eleven years."),
            (F, "I have met the goose. It is quite nice. It only wants to be loved, and also your hat."),
            (L, "So the dark secret of the house is a goose. I feel strangely relieved, and slightly cheated."),
        ],
    ),
    (
        "The portrait of the woman the master lost is revealed to be a portrait of a pony.",
        ["mistaken_identity", "mourning"],
        ["candle"],
        [
            (V, "That portrait is of the woman I lost, {lead}. You are the image of her. Same cheekbones. Same disapproving eyebrow."),
            (F, "That is not a woman. That is Dorothea, the pony. The family is very attached."),
            (V, "She was a good pony. She had a way of looking at one."),
            (L, "Then I am honoured to resemble Dorothea."),
        ],
    ),
    (
        "The master of the house tries to declare an affection and can only do it in rhyme.",
        ["rhyme", "romance"],
        ["book", "candle"],
        [
            (V, "I cannot say it plainly, so I shall say it in rhyme: I find you quite agreeable, most of the time."),
            (L, "That is the most romantic thing anyone has ever said to me, and it scanned."),
            (V, "I have a drawer of poems. Everything rhymes with 'moor'. I have been to the very bottom of 'more'."),
            (F, "I wrote half of them. 'Door' and 'floor' were mine. 'Gore' was entirely {villain}'s."),
        ],
    ),
    (
        "The Bishop of Mumbling arrives to examine the governess's credentials, which are a puddle.",
        ["trial", "lie"],
        ["book", "letter"],
        [
            (V, "The Bishop of Mumbling has arrived to examine your credentials, {lead}. He is in the library with a clipboard."),
            (L, "I have excellent credentials. I have a letter. It is a puddle, but it is a very distinguished puddle."),
            (F, "I looked over the Bishop's shoulder. He has written 'Governess: unqualified. Lovely smile.' All on one line."),
            (V, "I have decided to overlook the first part."),
        ],
    ),
    (
        "The master unmasks to reveal the terrible scar that has shaped everything, and it is a pencil mark.",
        ["mask", "secret"],
        ["mask"],
        [
            (L, "You wear a mask in the house, {villain}. I think I deserve to know why."),
            (V, "Beneath this mask is a terrible scar. A duel. A storm. A great betrayal."),
            (F, "It is a pencil mark. {villain} sat on a pencil at school, in a hurry."),
            (V, "It was a very sharp pencil, {fool}. Do not mock the pencil."),
        ],
    ),
    (
        "The master challenges the ghost to a duel over a review of some poetry. Neither can hit the other.",
        ["sword", "rhyme"],
        ["sword", "book"],
        [
            (V, "Ghost, you insulted my verse! I shall make your afterlife worse! En garde!"),
            (F, "I said it was 'a bold use of the word moor'. That is not an insult. That is a review."),
            (L, "Please, both of you. One of you cannot be hit, and the other cannot hit."),
            (V, "The sword goes straight through you, {fool}. It is the most insulting thing that has ever happened to my sword."),
        ],
    ),
]

TWIST = [
    (
        "The attic is full of love letters addressed to a governess the master had not yet met.",
        ["letter", "romance"],
        ["trunk", "letter"],
        [
            (L, "The attic is full of letters. Hundreds of them. All addressed to 'The Governess I Have Not Yet Met.'"),
            (V, "I wrote one every night. It is a hobby. I realise it is not a conventional hobby."),
            (F, "There are also forty-one addressed to 'The Dog.' {villain} was very optimistic."),
            (L, "Then I am, apparently, the first reply."),
        ],
    ),
    (
        "The attic mirror reflects only the governess, which is two reflections fewer than anyone had prepared for.",
        ["mirror", "ghost"],
        ["mirror", "trunk"],
        [
            (L, "The mirror shows only me. It does not show you, {fool}, which I expected. It does not show you, {villain}, which I did not."),
            (V, "...I had hoped to raise it at a more suitable moment. I am also a ghost. It has been a long time. I did not like to say."),
            (F, "Since 1871. I promised not to tell. I am bad at secrets but excellent at not bothering."),
            (L, "Then the brooding was not a character flaw. It was a lifestyle."),
        ],
    ),
    (
        "The family silver is found in the attic, and the thief is the household ghost.",
        ["treasure", "betrayal"],
        ["trunk", "candle"],
        [
            (L, "The attic contains the family silver. Every spoon. Two hundred years' worth."),
            (F, "I can explain. I was lonely. A ghost needs something to hold. Spoons are excellent company."),
            (V, "I thought the burglars were thorough. It was you, {fool}. You have been robbing us from the inside."),
            (F, "From beyond, actually. It is different. There is a lot of paperwork."),
        ],
    ),
    (
        "The governess confesses to being an acrobat, and the chandelier is mentioned with interest.",
        ["lie", "chandelier"],
        ["rope", "ladder"],
        [
            (L, "I must confess something. I am not a qualified governess. I am a trained acrobat. The references were my cousin's."),
            (F, "That explains the window on the first night. And the banister. I thought it was the draught."),
            (L, "I am so sorry. I could teach the children the trapeze, if there are any children."),
            (V, "There are no children. But there is a very sturdy chandelier."),
        ],
    ),
    (
        "Uncle Ambrose is found in the attic rocking chair, wearing a cardigan and a long silence.",
        ["death", "chair"],
        ["skull", "chair"],
        [
            (L, "In the rocking chair there is a skeleton, wearing a very nice cardigan."),
            (V, "That is Uncle Ambrose. He did not like to be moved. He has been very consistent about it."),
            (F, "I know him! We were at school together. He is the reason I became a ghost. He made it look so easy."),
            (L, "He is very still. He is the best houseguest I have ever had."),
        ],
    ),
]

FINALE = [
    (
        "The wedding takes place in the graveyard, with a vicar, a ghost and an unconvincing rain machine.",
        ["wedding", "ghost"],
        ["banner", "bouquet"],
        [
            (V, "I, {villain}, take you, {lead}, to be my governess, my companion and my reason to come in from the rain."),
            (L, "I, {lead}, take you. I should like it noted that I am doing so under a very small umbrella."),
            (F, "I object! No, wait, I do not. I have always wanted to say that. I object to nothing. It is lovely."),
            (V, "Then by the authority of the moor, and a vicar in a hat, I suppose we are married."),
        ],
    ),
    (
        "At last the master says it aloud, and the sky can think of nothing to add but lightning.",
        ["kiss", "storm"],
        ["lantern", "tree"],
        [
            (V, "I have waited my whole life to say it. I love you, {lead}. There. The sky may now do as it likes."),
            (F, "That is the best lightning I have ever seen, and I was here for the 1790s."),
            (L, "Then kiss me quickly, before the weather gets any better."),
            (F, "Sorry. I am standing on {villain}'s foot. I was trying to be supportive."),
        ],
    ),
    (
        "The household ghost is finally laid to rest, mildly disappointed that it was not harder.",
        ["death", "song"],
        ["skull", "candle"],
        [
            (F, "I think it has worked. I am... going. I always thought it would be more dramatic."),
            (L, "You were a wonderful ghost, {fool}. The best I have ever had."),
            (F, "I am the only one you have ever had. But thank you. It is the first review I have ever received."),
            (V, "Let us sing. It is customary. Somebody start the hymn, and start it badly, for {fool}."),
        ],
    ),
    (
        "The master of the house delivers a long-awaited speech on love and loss. It is short.",
        ["speech", "mourning"],
        ["skull", "candle"],
        [
            (V, "I have a few words to say about love and loss. They are: love, and loss."),
            (L, "That was beautiful. Is there more?"),
            (V, "No. That is the full text. I have been working on it for years."),
            (F, "It is the best speech anyone has given in this graveyard. And I have heard the one about the fox."),
        ],
    ),
    (
        "The previous governess emerges from the churchyard wall with a clipboard, a grievance and no tea.",
        ["reunion", "feast"],
        ["teapot", "candle"],
        [
            (F, "The previous governess has come out of the churchyard wall. She has a clipboard. She has notes."),
            (L, "Hello. I do hope you were not too uncomfortable in there."),
            (V, "She is very cross. She says the wall is damp, the company poor, and the biscuits a long time ago."),
            (L, "May I offer you tea? I am told the ghost makes a decent one, mostly by sighing at the kettle."),
        ],
    ),
]

GENRE = {
    "id": "gothic_romance",
    "name": "Gothic Romance",
    "blurb": "Moors, candles and a ghost who is mostly disappointed. Everyone is brooding; some of them on time.",
    "palette": {"sky": "#5c5f7a", "flat": "#2d2a3e", "floor": "#16141f", "accent": "#f0c987"},
    "roles": {
        "lead": "The Governess of Doubtful Credentials",
        "villain": "The Brooding Master of the House",
        "fool": "The Disappointed Ghost",
    },
    "skill_by_beat": {
        "setup": "drama",
        "complication": "romance",
        "reversal": "drama",
        "twist": "drama",
        "finale": "romance",
    },
    "sets": {
        "setup": "moor",
        "complication": "castle",
        "reversal": "library",
        "twist": "attic",
        "finale": "graveyard",
    },
    "beats": {
        "setup": _beat("setup", SETUP),
        "complication": _beat("complication", COMPLICATION),
        "reversal": _beat("reversal", REVERSAL),
        "twist": _beat("twist", TWIST),
        "finale": _beat("finale", FINALE),
    },
}
