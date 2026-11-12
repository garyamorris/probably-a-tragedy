"""The five pigeon critics (docs/DATA.md section 10).

Each critic weighs the same show metrics differently (`weights`: quality, lead, warmth, charm_chaos, tradition, snacks;
they sum to 1.0), adds a personal `bias` (stars) and `noise` (stars, deterministic), and then speaks from a bucket of
pull-quote `templates` keyed by whole stars "1".."5" (half-stars use the lower bucket).

Placeholders (substituted raw, no quotes or articles are added, so every template reads well when they are short phrases):
  {show}      the play's title, title-case ("The Goose Also Rises")
  {lead} {villain} {fool}   performer names; pass SHORT names ("Mabel", "Sir Reginald", "Gus"): the wounded parent says
              "my {lead}" and a full name makes her sound like a solicitor
  {town}      the town's name
  {mishap}    the title of the show's most notable mishap, a clause ("Mabel leans too far left"); the templates put it
              in single quotes themselves, so it reads as a quoted headline whatever the title is
  {calamity}  the most notable calamity as a name ("the lean" / "The Lean"; never sentence-initial, so either case works)
  {tradition} an enshrined Tradition's title ("The Lean"), may start a sentence; if none is enshrined pass a title-case
              fallback such as "The First Night"
  {snack}     a bare singular noun phrase with no article ("pork pie"); see SNACKS for a ready-made pool

Do not add quotes or articles around the substitutions: the templates already carry their own punctuation.
"""

from __future__ import annotations

# A ready-made pool for {snack}: bare, singular, no articles, so "the {snack} was warm" always reads.
SNACKS: tuple[str, ...] = (
    "pork pie", "toffee apple", "custard tart", "sausage roll", "jam doughnut", "cheese straw", "saffron bun",
    "pickled egg", "treacle flapjack", "iced bun", "mutton pasty", "buttered crumpet", "gingerbread goose",
    "seed cake", "sherbet lemon", "scotch egg",
)

POMPOUS = {
    "5": [
        "In forty years I have praised nothing. {show} compels me to open a new, smaller notebook.",
        "{lead} achieved, for nearly four seconds, what I once called Art. I have since lain down in a darkened room.",
        "Flawless, if one ignores '{mishap}', and tonight I was generous enough to ignore it. Do not expect this again.",
        "I wept at {show}. Briefly. Into my ruff. Tell no one, and if you must, blame the draught.",
        "{town} has produced theatre. I did not think the soil could do it. Five stars, and a lie-down.",
        "A masterpiece, and I resent it deeply. I shall write a longer review to prove that I do not.",
    ],
    "4": [
        "Competent, which in {town} amounts to heroism. {lead} stood up straight, and I noted it.",
        "{show} is nearly good. I look forward to being disappointed by its sequel.",
        "I came to sneer and stayed to adjust my spectacles. {lead} has a spine, or an excellent string.",
        "Only the business of '{mishap}' spoiled a defensible evening, and even that had structure. Four stars; I am unwell.",
        "Not bad. I realise this is the highest praise I have ever typed, and I have asked for water.",
        "{villain} menaced precisely as scripted. Rare. Almost unsettling. Four stars, and a handkerchief.",
    ],
    "3": [
        "{show} is the sort of evening one forgets while it is still happening. {lead} stood where the light was.",
        "Adequate. I have written that word so often it has begun to look like a small bird.",
        "{town} is owed an apology, or a better play. Probably both. Mostly the play.",
        "Some of {show} was theatre. I will not specify which. The rest was weather.",
        "{fool} entered, spoke, and left. All three events occurred in the correct order. Three stars.",
        "Three stars for {show}: one for the lighting, one for the interval, and one I am saving for later.",
    ],
    "2": [
        "I have seen wallpaper with more conviction than {lead}, and the wallpaper at least stayed upright.",
        "{show} was not so much staged as released. {villain} appeared to be negotiating with the scenery.",
        "'{mishap}' was the evening's only decision, and it was the wrong one. Two stars, both charitable.",
        "A play in the way that a puddle is a lake. {town} deserves better, or at least drier.",
        "The blocking resembled a funeral for a small, tangled animal. {lead} led the procession.",
        "{fool} fell over and the audience applauded, confirming everything I have ever feared about audiences.",
    ],
    "1": [
        "I have reviewed funerals with more momentum. {show} was a tragedy only in the sense that it was attended.",
        "One star, for the curtain, which closed. It was the only resolution {show} offered.",
        "{lead} and {villain} performed as though introduced in the interval. I left before '{mishap}', and was lucky.",
        "In my day we at least pretended the scenery was not afraid of us. {show} did not pretend.",
        "{show} was unwatchable, except that I watched it, and now I must carry that, like a heavy hat.",
        "I shall not describe {show}. I shall merely say that {town} should consider a stern letter.",
    ],
}

WOUNDED_PARENT = {
    "5": [
        "{lead} was a vision. I cried in the second row, in the interval, and once in the umbrella stand.",
        "My {lead} has never been better, and I have seen {lead} at every age. Five stars. Frame this.",
        "Did you see how {lead} held the light? That is nurture, that is. Five stars, and a new hat.",
        "I always said {lead} would be on a stage one day, and look, there {lead} was, being wonderful.",
        "Five stars, six if the paper allowed. I told the whole row about {lead}. They have moved.",
        "{lead} bowed, I stood, and now my knees would like a word. Worth it. Every creak.",
    ],
    "4": [
        "{lead} was lovely. {villain} could have been warmer, but then {villain} did not have my {lead}'s upbringing.",
        "Four, dear. It would be five, but '{mishap}' was a bit much, and was never {lead}'s fault.",
        "A fine show for {town}, and a splendid {lead}. I sat on my hands to stop clapping through the dialogue.",
        "{lead} was wonderful. {fool} was there too, I believe, and I am sure they did their best, bless them.",
        "I brought {lead} a flask of soup. It was not needed, so I drank it, proudly.",
        "Four stars. The fifth is for when {lead} gets better light, a better play, and better colleagues.",
    ],
    "3": [
        "{lead} was good. {show} was not. These are separate matters, and I will not have them confused.",
        "A middling evening. {lead} did all that could be done. The rest stood about like a coat rack.",
        "I would have given more, but {villain} stood on {lead}'s big moment, and I am not a forgiving woman.",
        "{lead} was fine, truly fine, and I will say nothing about the lighting, which was a crime.",
        "Not bad, but I have seen {lead} do better at breakfast, with a kipper, to nobody.",
        "I am told it was all right. I was not listening. I watched {lead} the whole time, as one does.",
    ],
    "2": [
        "My {lead} was ROBBED. Robbed, I tell you, of a light, a line and basic human decency.",
        "{show} did nothing for {lead}'s gifts, and {lead} has so many. I counted them in the interval.",
        "Why was {lead} placed beside {villain}? Everyone knows {villain} looms. I have written to the council.",
        "'{mishap}', in front of {lead}! I have not been so upset since the nativity incident.",
        "{lead} was perfect, and everything around {lead} was a hazard. I shall be having words with the scenery.",
        "I left at the interval, head high, handbag on {fool}'s foot. An accident, but I stand by it.",
    ],
    "1": [
        "I have seen my {lead} treated badly before, but never in front of paying customers. Appalling.",
        "No stars. Take it from a mother: {show} was a conspiracy, and {villain} knows what {villain} did.",
        "I demand to see whoever did the lights, whoever wrote this, and whoever told {lead} to stand there.",
        "Thank heaven {lead} was in it, or I would have had nothing to look at. The rest: a disgrace.",
        "'{mishap}' was the final insult. I have taken my cardigan home and shall not be speaking to {town}.",
        "My {lead} was ROBBED, and I shall tell the Gazette, the vicar, and a man at the bus stop.",
    ],
}

SNACKS_CRITIC = {
    "5": [
        "The {snack} was warm, the interval generous, and {show} happened somewhere in between. Perfect.",
        "I do not remember the plot. I remember the {snack}. I will remember the {snack} at my funeral.",
        "Five stars for the {snack}, which arrived hot, stayed hot, and asked nothing of me, unlike {lead}.",
        "A feast scene so convincing I checked my pockets for cutlery. The {snack} outside was heroic.",
        "Whoever fried the {snack} should be given {town} and a small boat. Utter triumph.",
        "{show} was a lovely way to digest the {snack}. I applauded, with grease, in both hands.",
    ],
    "4": [
        "Excellent {snack}, only slightly spoiled by {show} happening nearby.",
        "The {snack} was crisp, the tea was hot, the seats were hard. A proper night out. Four stars.",
        "{villain} ate a pie on stage with real feeling. I felt seen. The {snack} outside was also good.",
        "A generous {snack}, a fair price, and a plot I did not need. Pleasantly full.",
        "I could not hear {fool} over the {snack}, and nor, I think, could {fool}.",
        "Very decent {snack}. The programme was edible too, which I discovered by accident.",
    ],
    "3": [
        "The {snack} was fine. Not warm, not cold. Like {town} itself, or a letter from a cousin.",
        "{show} contained one feast scene, and the pudding was clearly cardboard. The real {snack} was adequate.",
        "I had the {snack}. It was the {snack}. I do not know what else to tell you.",
        "A queue of nine for the {snack}. A queue of none for {show}. Make of that what you will.",
        "Three stars: one for the {snack}, one for the napkin, and one because {lead} dropped nothing edible.",
        "The {snack} was unremarkable, but I remarked upon it anyway, loudly, for the record.",
    ],
    "2": [
        "The {snack} was cold in the middle, which is a kind of honesty, but not a kind I enjoy.",
        "{show} offered a banquet scene with no actual banquet. I felt like a man at a locked bakery.",
        "A cold {snack} and a warm lie from {villain} about the pudding. I have seen better crumbs.",
        "They ran out of {snack} at the interval. I was left with {show}, and no sauce.",
        "The {snack} was damp. The seat was damp. {town} is a damp place, and not at all sorry.",
        "I ate my own sandwich all through '{mishap}'. It was the best thing in the building.",
    ],
    "1": [
        "No {snack}. A sign said 'soon'. It was a lie, like most of {show}.",
        "Zero crumbs. I have never left a theatre this hungry, and I have been to the opera.",
        "The {snack} was a rumour. {show} was a long, dry cracker of a night.",
        "I asked for the {snack} and was handed a programme. I ate the programme. It was better than {show}.",
        "The pie in the feast scene was empty. I checked. I climbed on stage and checked. I regret it.",
        "Not one {snack} in all of {town}. I have written to the mayor, and I have written to the pie.",
    ],
}

CHAOS_GOURMAND = {
    "5": [
        "Magnificent calamity! '{mishap}' arrived at precisely the right temperature, and {villain} wept into the sauce.",
        "I have not tasted such lovely ruin since the Great Soufflé Incident. {show} is a tasting menu of disaster.",
        "Again, {calamity}! And yet it surprised me, like a favourite uncle falling through a trellis. Bravo.",
        "Everything went wrong in exactly the right order. {lead} slipped, {fool} caught it, and I wept into my napkin.",
        "A beautifully ruined evening. I want '{mishap}' on a plate, with a small fork.",
        "{show} was a lovely mess. I licked my fingers. I shall return, and I shall bring friends.",
    ],
    "4": [
        "Delicious chaos, slightly overdone. '{mishap}' could have rested a minute before serving. Four stars.",
        "A solid disaster! {fool} fell with feeling, and {calamity} crept in like a well-timed truffle.",
        "I have had worse nights and called them wonderful. {show} is nearly wonderful.",
        "Excellent wreckage. Something in the rafters swung, and so did my heart. Four stars, and a second helping.",
        "Good, spicy ruin from {villain}. Next time, more fire, fewer instructions.",
        "A fine rolling boil of mishap. '{mishap}' was the garlic: unmistakable, and instantly forgiven.",
    ],
    "3": [
        "Some trouble, not enough catastrophe. '{mishap}' was a pinch of salt where I wanted a whole cow.",
        "A respectable mess. I came for a banquet of collapse and left with a snack of mild embarrassment.",
        "The chaos was there, even {calamity}, but nothing committed. It hovered like a waiter who has forgotten the dish.",
        "Three stars: the disaster was good; the rest was seating. '{mishap}' deserved better company.",
        "{show} simmered. I like a simmer. But I came for a boil, and I will say so over cheese.",
        "Perfectly average peril. {lead} wobbled, {villain} stumbled, and I nibbled a bread roll and waited for ruin.",
    ],
    "2": [
        "Under-seasoned. '{mishap}' was a fine ingredient, left alone in a cold kitchen with nobody to love it.",
        "I came hungry for disaster. {show} served '{mishap}', a mild inconvenience, and a lukewarm apology.",
        "A mess, but not the good kind. The good kind has a plan and a pudding. {town} had neither.",
        "Too little, too late: '{mishap}' arrived after everyone had left the table. I ate it alone.",
        "{villain} had a chance at greatness and chose the sensible option. I do not forgive sensible options.",
        "A bland disaster. I sent it back, and the kitchen said that was the disaster. I left.",
    ],
    "1": [
        "Nothing was cooked, nothing was ruined. It was simply there, like a raw egg on a plate.",
        "The soufflé neither rose nor fell. It sat. {show} sat. I wept for the eggs.",
        "A disaster with no taste, no structure and no ending. '{mishap}' was a bone in a bowl of milk.",
        "I have tasted shame, and it was better seasoned than {show}. One star, for the bread.",
        "Do not call that chaos. Chaos has manners. {show} had only {lead}, a sigh, and a vague apology.",
        "Not a ruin, not a feast. A plate of beige. {lead} served it with a straight face. One star.",
    ],
}

SENTIMENTALIST = {
    "5": [
        "I wept at {tradition}, and then at the tradition of weeping at {tradition}. A perfect night.",
        "{town} has a heart the size of a hat, and tonight it fit. I used three handkerchiefs and a programme.",
        "When {lead} honoured {tradition}, an old man in row F whispered 'there it is'. I have not recovered.",
        "Every seat in {town} was wet. The show was wet. Even the moon looked tearful. Five stars, and a blanket.",
        "Some things happen once, and some happen every night. {tradition} is the second kind of miracle.",
        "I shall keep {show} in the drawer where I keep my mother's gloves.",
    ],
    "4": [
        "A tender night. {tradition} returned, and I rose, and I sat, and I rose again.",
        "{lead} wore {tradition} like my grandmother's hat: slightly crooked, entirely dear. Four stars, and a sniff.",
        "Not quite a tradition yet, but '{mishap}' has the look of one. I shall come back next year, with soup.",
        "I cried twice: once for {fool}, and once because {fool} reminded me of a dog I loved.",
        "Warm, imperfect, and mine. {show} earns four stars and a rather large handkerchief.",
        "{villain} apologised to the audience, the audience forgave {villain}, and I forgave everybody. Lovely.",
    ],
    "3": [
        "{show} had its moments, and I kept them in a box. The box is small. The moments are sweet.",
        "I wanted to cry at {tradition} and very nearly did. Something got in my eye. It was the programme.",
        "A pleasant night with little to remember it by. I tied a ribbon around '{mishap}' anyway.",
        "{show} was kind, which is a rarer thing than good. Three stars, and a small, polite sniff.",
        "A fond evening. {tradition} was nodded at, politely. I shall tell my niece, who will forget, and that is fine.",
        "I felt a little. Not enough for a handkerchief, but I held one, on principle.",
    ],
    "2": [
        "Where was {tradition}? Where was the lump in the throat? {show} left me as dry as a biscuit.",
        "{town} had a custom, and {show} stepped on it. I have spoken to the custom. It is hurt.",
        "I wanted to feel something, and instead I got '{mishap}', which is not the same thing at all.",
        "Cold. A cold show for a warm town. {lead} tried; I saw {lead} try; that was the saddest part.",
        "They did {calamity} without love, like a recipe read aloud by a stranger. Two stars and a sigh.",
        "Nobody cried. The programme sellers cried. That is the whole review.",
    ],
    "1": [
        "I came for the old ways and found a new, terrible haste. I wept, but not the good kind.",
        "{show} trampled {tradition} and did not say sorry. I have cried into pillows for less.",
        "{lead} did not look at the audience once. I felt it in my hat. One star and a damp sleeve.",
        "Nobody in {show} remembers anything, least of all {villain}. Even the dust looked newly bought.",
        "I would sooner lose my umbrella than see {show} again, and I have lost it. Twice. In {town}.",
        "The evening broke my heart in a dull, administrative way. One star, and a very small candle.",
    ],
}

CRITICS = [
    {
        "id": "pompous",
        "name": "Sir Coo-Lambert Pidgeon",
        "outlet": "The Wibbling Gazette",
        "style": "pompous",
        "weights": {"quality": 0.65, "lead": 0.10, "warmth": 0.10, "charm_chaos": 0.0, "tradition": 0.15, "snacks": 0.0},
        "bias": -0.3,
        "noise": 0.4,
        "templates": POMPOUS,
    },
    {
        "id": "wounded_parent",
        "name": "Mrs. Philomena Roost",
        "outlet": "The Parish Pigeonhole",
        "style": "wounded_parent",
        "weights": {"quality": 0.15, "lead": 0.55, "warmth": 0.20, "charm_chaos": 0.0, "tradition": 0.05, "snacks": 0.05},
        "bias": 0.4,
        "noise": 0.5,
        "templates": WOUNDED_PARENT,
    },
    {
        "id": "snacks",
        "name": "Pip Peckish",
        "outlet": "The Interval Intelligencer",
        "style": "snacks",
        "weights": {"quality": 0.05, "lead": 0.0, "warmth": 0.15, "charm_chaos": 0.10, "tradition": 0.05, "snacks": 0.65},
        "bias": 0.0,
        "noise": 0.7,
        "templates": SNACKS_CRITIC,
    },
    {
        "id": "chaos_gourmand",
        "name": "Madame Colombe Roucoule",
        "outlet": "The Smouldering Ladle",
        "style": "chaos_gourmand",
        "weights": {"quality": 0.10, "lead": 0.05, "warmth": 0.10, "charm_chaos": 0.60, "tradition": 0.10, "snacks": 0.05},
        "bias": -0.1,
        "noise": 0.5,
        "templates": CHAOS_GOURMAND,
    },
    {
        "id": "sentimentalist",
        "name": "Mr. Ambrose Lachrymose-Dove",
        "outlet": "The Quarterly Sniffle",
        "style": "sentimentalist",
        "weights": {"quality": 0.10, "lead": 0.10, "warmth": 0.30, "charm_chaos": 0.05, "tradition": 0.40, "snacks": 0.05},
        "bias": 0.3,
        "noise": 0.3,
        "templates": SENTIMENTALIST,
    },
]

DATASETS = {"critics": CRITICS}
