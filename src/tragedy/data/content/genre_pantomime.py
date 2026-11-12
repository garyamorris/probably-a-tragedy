"""Pantomime: 'He's behind you!', a dame, audience participation, and a cow in two halves (docs/DATA.md section 7).

Running motifs: Buttercup the cow (front half, back half), the golden egg, the goose who is secretly the Good Fairy,
the Baron's wig, the boiled sweet, the Dame's hat. Characters address 'boys and girls' (the twelve paper seats).
Lines never use he/she for a cast member: performers can be anyone (the Baron and the Dame are titles, not genders).
"""

from __future__ import annotations

L, V, F = "lead", "villain", "fool"


def _beat(beat: str, rows: list[tuple]) -> list[dict]:
    return [
        {
            "id": f"pantomime_{beat}_{n}",
            "logline": logline,
            "tags": tags,
            "props": props,
            "lines": [{"role": role, "text": text} for role, text in lines],
        }
        for n, (logline, tags, props, lines) in enumerate(rows, start=1)
    ]


SETUP = [
    (
        "The village goose lays a golden egg, and it is in the wrong hands before the applause has finished.",
        ["goose", "treasure"],
        ["goose", "trophy"],
        [
            (F, "Good morning, boys and girls! Look, our little goose has laid an egg! A golden one! Nobody tell the Baron!"),
            (V, "Did somebody say Baron? Do not bother to boo, I have had my breakfast. I shall simply take the egg."),
            (L, "Put it down, Baron! It belongs to the village and to the goose's many friends!"),
            (F, "The goose says it was a one-off. She is retiring. She wants to go into catering."),
        ],
    ),
    (
        "The Dame enters in a hat shaped like a cottage loaf and delivers eleven puns, none of them necessary.",
        ["pun", "speech"],
        ["cake"],
        [
            (F, "Hello, boys and girls! I am the Dame! I have just come from the baker's. I was feeling a bit crusty!"),
            (L, "Good morning, Dame. That is a very large hat."),
            (F, "It is a loaf, dear. I wore it to sell the bread. I was selling like hot... rolls!"),
            (V, "I have been a wicked baron for thirty years, and I have never heard a pun that hurt like that."),
        ],
    ),
    (
        "The whole village launches into the opening number, and the Baron attends purely to ruin it.",
        ["song", "dance"],
        ["banner", "tree"],
        [
            (L, "Good morning, {town}! It is a lovely day for a song and a dance!"),
            (F, "Everybody on the green! Left foot! Right foot! Other left foot! I only have two, but I am trying!"),
            (V, "I hate this. The singing. The dancing. The rhyming. I shall ruin it, and I shall do it in time to the music."),
            (L, "Then join us, Baron! The chorus has a part for a villain. It is mostly 'boo'."),
        ],
    ),
    (
        "Buttercup the cow enters in two halves, who immediately disagree about the direction of the play.",
        ["slapstick", "pun"],
        ["tree"],
        [
            (F, "Everybody say hello to Buttercup, our cow! Front half, wave. Back half... lift your tail, dear."),
            (L, "She seems to be walking in two directions at once."),
            (V, "That is the back half. It wants the pantry. The front half wants the barn. They are both correct."),
            (F, "It is the first time she has given a straight answer. Well, a straight half-answer."),
        ],
    ),
    (
        "The King decrees that whoever finds the golden egg may marry the Principal Boy. Nobody tells the Principal Boy.",
        ["crown", "wedding"],
        ["crown", "banner"],
        [
            (F, "Oyez, oyez, boys and girls! By order of the King: whoever finds the golden egg may marry the Principal Boy!"),
            (L, "Has anyone asked the Principal Boy?"),
            (V, "Nobody asks the Principal Boy. It is tradition. Nobody asks the egg either."),
            (F, "I did ask the egg. It seemed keen. It also seemed like an egg."),
        ],
    ),
]

COMPLICATION = [
    (
        "The Baron creeps up behind the Principal Boy, and the audience has several suggestions.",
        ["chase", "slapstick"],
        ["door"],
        [
            (L, "Is somebody behind me, boys and girls? Because I have a funny feeling about the back of my head."),
            (F, "He is behind you! Behind you! No, the other behind!"),
            (V, "I am merely standing here. I am doing nothing. If the Principal Boy turns around, I shall have to turn around too."),
            (L, "I am turning! He is turning! We are all turning! This is the longest circle I have ever made."),
        ],
    ),
    (
        "The Baron's banquet is musical chairs with one chair, twelve guests and no clear exit strategy.",
        ["chair", "feast"],
        ["chair", "cake"],
        [
            (V, "Welcome to my banquet. Please take a seat. There are twelve guests and one chair. It is a game. I call it 'Dinner'."),
            (F, "It is musical chairs! Boys and girls, start the music! When it stops, sit on the nearest Baron!"),
            (L, "Dum de dum dum... somebody stop the music!"),
            (V, "Get off me, {fool}. I am a villain with a bad back. We are the most dangerous kind."),
        ],
    ),
    (
        "The Baron consults the magic mirror and receives, for the first time, a complaint.",
        ["mirror", "disguise"],
        ["mirror"],
        [
            (V, "Magic mirror, tell me true: who is the loveliest in the land?"),
            (F, "It says... hang on... 'Please can you stop leaning on the glass.'"),
            (L, "That is not a mirror! That is the back half of Buttercup in a picture frame!"),
            (V, "It is a very good frame. It is the only part of this castle I paid for."),
        ],
    ),
    (
        "A sword fight is conducted entirely in rhyming couplets, and the Baron runs out of rhymes before the sword.",
        ["sword", "rhyme"],
        ["sword"],
        [
            (V, "En garde, you wretched Principal Boy! I will make you sorry! I will make you cry! I will run you over with a... lorry?"),
            (L, "That is a modern vehicle, Baron. We are in the Middle Ages."),
            (F, "It is the rhyme's fault, dear! {villain} is under pressure! Everybody help! What rhymes with 'sorry'?"),
            (V, "Do not ask them. They will say 'lorry'."),
        ],
    ),
    (
        "The Baron disguises as the Good Fairy, wearing wings made from a dustpan.",
        ["disguise", "lie"],
        ["mask", "banner"],
        [
            (V, "Greetings, children! I am the Good Fairy! I am not the Baron. I am a perfectly different shape."),
            (L, "Good Fairy, you are wearing a wicked cloak and three days of beard."),
            (V, "Fairies are naturally scruffy. It is the wings. They take it out of one."),
            (F, "Boys and girls, is that the Good Fairy? I can't hear you! IS THAT THE GOOD FAIRY?"),
        ],
    ),
]

REVERSAL = [
    (
        "At the ball the Baron asks the Dame to dance, and everyone agrees to pretend this is normal.",
        ["dance", "romance", "kiss"],
        ["bouquet", "harp"],
        [
            (V, "Dame, may I have the honour? I have been a villain for forty years, and I should like to be a nuisance in a different way."),
            (F, "Oh, Baron! I have not danced since the Great Pudding Fire!"),
            (L, "Boys and girls, the Baron is in love with the Dame! This is either a triumph or a very large mistake!"),
            (V, "Do not mock this, Principal Boy. The Dame has beautiful hands, and I intend to kiss both of them."),
        ],
    ),
    (
        "At the masked ball everyone is unmasked on the count of three, to a disappointing silence.",
        ["mask", "disguise"],
        ["mask"],
        [
            (L, "Everyone take off your masks on the count of three! One, two, three!"),
            (F, "My mask is off! Oh. It is still me. It is me underneath. I was hoping for somebody more glamorous."),
            (V, "Mine is off too. Underneath is a smaller, sadder Baron. Please do not look."),
            (L, "And mine... oh. It is all of us. Nobody is anyone else. This is the dullest unmasking in the history of balls."),
        ],
    ),
    (
        "The Principal Boy swings out on the ballroom chandelier, which turns out to have been sold.",
        ["chandelier", "slapstick"],
        ["chandelier"],
        [
            (L, "Stand back! I shall swing across the ballroom on the chandelier and rescue the Dame!"),
            (F, "Be careful, dear, it is an antique! It is from the age before swinging!"),
            (V, "It is no longer attached to anything. I sold it on Tuesday. The buyer collects at eight."),
            (L, "That would explain why I am taking the ceiling with me."),
        ],
    ),
    (
        "The Baron tries a clog on every foot in the kingdom, and it fits the back half of a cow.",
        ["stairs", "mistaken_identity", "crown"],
        ["crown"],
        [
            (V, "Whoever fits this clog is the rightful heir! Everyone form a queue on the stairs! One foot at a time!"),
            (F, "It fits Buttercup's back left! Oh, what a terrible thing to happen to a cow!"),
            (L, "The heir to the throne is a cow!"),
            (V, "The back half of a cow. I demand a recount."),
        ],
    ),
    (
        "The sing-along begins, and the Baron joins in for a boiled sweet, to everyone's surprise, especially the Baron's.",
        ["song", "feast"],
        ["banner", "cake"],
        [
            (L, "Boys and girls, it is time for the sing-along! The words are on the banner! Left side, you are the Baron's team!"),
            (V, "I refuse to sing. I am wicked. I have standards. ...Oh, there is a prize? What kind of prize?"),
            (F, "A boiled sweet! Whoever sings loudest wins a boiled sweet!"),
            (V, "Then I shall sing. Tell the boys and girls to stop making that noise. ...Oh. That is me making that noise."),
        ],
    ),
    (
        "The Baron dies, spectacularly and repeatedly, and keeps opening one eye to check the reviews.",
        ["death", "slapstick"],
        ["skull"],
        [
            (V, "Aargh! I am slain! I am dead! I have never been so dead in all my life!"),
            (F, "Boys and girls, is the Baron dead? Oh no he isn't! Oh yes he is! Oh no he isn't! I can't keep up!"),
            (L, "The Baron has been dead for three minutes, and has opened one eye to check whether we are watching."),
            (V, "I am still dead. I am only resting my eyes. I shall be dead again in the finale."),
        ],
    ),
]

TWIST = [
    (
        "A ghost drifts through the cellar, and the Dame is the only one who cannot see it.",
        ["ghost", "door"],
        ["ghost_sheet", "door"],
        [
            (F, "Oooh, it is spooky down here! Boys and girls, is there a ghost? I don't see a ghost!"),
            (L, "There is a ghost behind you, Dame!"),
            (F, "Where? Oh no there isn't! Oh, there is! It has gone through the door, and me, and the Baron!"),
            (V, "I felt that. It was clammy. I request that the ghost apologise."),
        ],
    ),
    (
        "It is discovered that the goose has been the Good Fairy all along, and the Baron has been tying her to a fence.",
        ["goose", "mistaken_identity"],
        ["goose", "rope"],
        [
            (F, "I have just had a thought, boys and girls. Has anybody ever seen the goose and the Good Fairy in the same room?"),
            (L, "Never! Do you mean the goose..."),
            (V, "...is the Good Fairy? I have been tying a fairy to a fence post for three years."),
            (F, "She is very forgiving. She would like to be untied now, please, and also a sandwich."),
        ],
    ),
    (
        "The Baron's deadly potion turns out to be lemonade, and the lemonade turns out to be the plot.",
        ["poison", "pun"],
        ["bottle"],
        [
            (V, "Behold! The {object}! One sip and you shall be turned into... into... something worse."),
            (F, "Is it a toad, Baron? A newt? A very small bishop?"),
            (V, "It is lemonade. I mixed up the labels. Give it back; that was to be my elevenses."),
            (L, "So the poison is lemonade, and the lemonade is poison. Boys and girls, that is what we call a sour twist."),
        ],
    ),
    (
        "The Dame is revealed as the Baron's double agent, to the surprise of everyone except the audience.",
        ["betrayal", "lie"],
        ["cake", "trunk"],
        [
            (L, "Dame! You have been helping the Baron all this time?"),
            (F, "Oh, I can explain, dear. The pay is terrible, but the hat budget is marvellous."),
            (V, "The Dame has been my double agent for eleven years. Paid in buns."),
            (L, "Boys and girls, did you know about this? You did? Then why didn't you shout?"),
        ],
    ),
    (
        "A dragon named Gerald guards the cellar. It has a cough, and every cough costs somebody a wig.",
        ["fire", "chase"],
        ["lantern", "ladder"],
        [
            (V, "The cellar is guarded by a fire-breathing dragon. It is called Gerald."),
            (F, "Gerald is lovely! He has a bad cough, though. Every time he coughs, somebody's wig goes up."),
            (L, "Everyone back! I can feel the heat! I am only a Principal Boy and I am not insured!"),
            (V, "It has my wig. It has my good wig. Somebody fetch the second-best wig."),
        ],
    ),
]

FINALE = [
    (
        "The Baron is beaten, the goose is free, and the whole cast gets married at once, mostly to each other.",
        ["song", "wedding", "romance"],
        ["bouquet", "banner"],
        [
            (L, "Boys and girls, the Baron is beaten, the goose is free, and we are going to have a wedding!"),
            (F, "Who is marrying whom? Nobody has told me! I was only told to wear this!"),
            (V, "I am to marry the Dame, which is the best-run plot twist of the evening, and I stand by it."),
            (L, "Then let us sing the wedding song! Everybody! Left side, right side, and the people in the middle who always forget!"),
        ],
    ),
    (
        "The traditional slosh scene begins with forty custard pies and ends with everyone the same colour.",
        ["slapstick", "feast"],
        ["cake", "chair"],
        [
            (F, "And now the traditional slosh scene! I have prepared forty custard pies and one very polite bucket!"),
            (V, "I refuse to be hit by a pie. I have dignity. I have a reputation. I have... oh. Oh, I have a pie."),
            (L, "Boys and girls, shall we? Three, two, one! Aim for the Baron, but be kind to the bucket!"),
            (F, "Everybody is covered! Even the bucket is covered! We are all the same colour! It is beautiful!"),
        ],
    ),
    (
        "The King abdicates in favour of the goose, which accepts with the dignity of a creature that expected nothing less.",
        ["crown", "goose"],
        ["crown", "goose"],
        [
            (L, "People of {town}: the King has been found, and he has abdicated in favour of the goose."),
            (F, "The goose is wearing the crown! It looks wonderful! It looks like it has been waiting all its life!"),
            (V, "A goose queen. I am too tired to object. I shall be a loyal subject, as soon as somebody finds me a chair."),
            (L, "Long live the goose! Boys and girls, you know the next bit! Long live the..."),
        ],
    ),
    (
        "The Dame delivers the traditional closing couplet in place of the Good Fairy, who is off sick.",
        ["rhyme", "speech"],
        ["banner"],
        [
            (F, "The Good Fairy is off sick, so: the play is done, the day is won, the Baron's gone, and we've had fun!"),
            (V, "It lacks a moral."),
            (L, "Then here is one: never tie a fairy to a fence."),
            (F, "That does not rhyme, but it is true, which is better."),
        ],
    ),
    (
        "Buttercup the cow finally agrees on a direction, which is two directions, and goes.",
        ["slapstick", "pun"],
        ["banner", "tree"],
        [
            (F, "And finally, boys and girls, Buttercup the cow has decided where she is going!"),
            (L, "Which way, Buttercup?"),
            (V, "Front half, left. Back half, the pub. They have parted. It is the happiest break-up I have ever seen."),
            (F, "She will be fine! She is two cows now! Wave goodbye to the front half! And to the back half, who does not care!"),
        ],
    ),
]

GENRE = {
    "id": "pantomime",
    "name": "Pantomime",
    "blurb": "He's behind you! A dame, a cow in two halves, and a great deal of shouting.",
    "palette": {"sky": "#9bdcf5", "flat": "#f4a261", "floor": "#6a3d3d", "accent": "#ef476f"},
    "roles": {"lead": "The Principal Boy", "villain": "The Wicked Baron", "fool": "The Dame"},
    "skill_by_beat": {
        "setup": "comedy",
        "complication": "physical",
        "reversal": "improv",
        "twist": "comedy",
        "finale": "improv",
    },
    "sets": {
        "setup": "garden",
        "complication": "castle",
        "reversal": "ballroom",
        "twist": "cellar",
        "finale": "stage",
    },
    "beats": {
        "setup": _beat("setup", SETUP),
        "complication": _beat("complication", COMPLICATION),
        "reversal": _beat("reversal", REVERSAL),
        "twist": _beat("twist", TWIST),
        "finale": _beat("finale", FINALE),
    },
}
