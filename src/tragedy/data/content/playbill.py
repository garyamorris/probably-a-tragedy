"""Programme furniture for the playbill (docs/DATA.md section 11).

Bios are assembled as ``"{name}, {opener} {trained_at}. {credits} {quirk}"``:
  * `openers` end with a comma ("a performer of uncommon stillness,") so the sentence reads "Name, <opener> trained at ...";
  * `trained_at` begins with a past-tense verb and has no final full stop ("trained at the Royal Academy of Looking Out Windows");
  * `credits` and `quirks` are complete sentences with their own full stops.
All four are species-, size- and pronoun-neutral so they suit a marionette, a sock or a goose in a wig.

`headings` are interchangeable banner lines for the top of the programme (pick one by stable hash).
`tonight_in` templates take {town}; `previously` templates take {town}, {title}, {stars} where {stars} is the number
(never followed by the word "stars" here, so 1, 1.5 and 4.5 all read well: "rated {stars}/5").
"""

from __future__ import annotations

BIO = {
    "openers": [
        "a performer of uncommon stillness,",
        "who has been described as 'present, mostly',",
        "a veteran of nine crowded stages and one empty one,",
        "who is known in three counties and one canal,",
        "an artist whom critics have called 'unavoidable',",
        "a natural talent, assisted by several unnatural ones,",
        "whose commitment frightens the scenery,",
        "a tireless professional who has been tired since the Tuesday before last,",
        "who needs no introduction but will be given one,",
        "an artist of great sincerity and middling balance,",
        "a late bloomer, though not that late,",
        "once mistaken for a much taller performer,",
        "a stalwart of the provincial circuit, which is mostly fog,",
        "who prefers to be introduced by a drumroll or a cough,",
        "whom the Wibbling Players rescued from a much better offer,",
    ],
    "trained_at": [
        "trained at the Royal Academy of Looking Out Windows",
        "studied under a retired lighthouse keeper who taught only the pause",
        "learned everything at the Hartley School of Standing Near Furniture",
        "was apprenticed to a ventriloquist who never spoke back",
        "was trained by a travelling dentist with strong views on projection",
        "graduated, with distinction, from the Institute of Dramatic Fainting",
        "studied at the Conservatory of Entrances and Exits (mostly exits)",
        "honed the craft in the back room of a pie shop with excellent acoustics",
        "learned stagecraft from a bus conductor who called every stop a cue",
        "studied mime at a school that has since gone very quiet",
        "was educated at the Wibbling Night School for Unconvincing Villains",
        "trained beneath a very strict clock",
        "took a first-class diploma in Gazing at the Middle Distance",
        "learned the trade from a grandmother who ran the town's only echo",
        "was raised in a hatbox and has never quite stopped projecting",
    ],
    "credits": [
        "Recent credits include Third Tree in a Forest Nobody Asked For.",
        "Previously seen as the Noise Off-Stage in over two hundred plays.",
        "Audiences will remember an unforgettable turn as Man Beside a Cart.",
        "Notable roles include a very convincing Tuesday and the back half of a horse.",
        "Fans still cite the celebrated Lamp, in a lamp-heavy season.",
        "Credits include Body Number Two (uncredited), Body Number Two (credited), and a stern portrait.",
        "Was last seen as Understudy to a Large Stone, to rave notices.",
        "Has appeared in seventeen well-received weddings, four of them on purpose.",
        "Played the Moon in a regional tour of the Moon.",
        "Once stood in for a door, and has been compared favourably with it.",
        "Starred in A Long Corridor, which lived up to its name.",
        "Has appeared in more candlelit scenes than most candles.",
        "Gave a haunting performance as a cough in the back stalls.",
        "Celebrated for the part of Cousin Walter, who is never explained.",
        "Created the role of The Weather, which was received with a shrug.",
    ],
    "quirks": [
        "Will not discuss the swan.",
        "Cannot be photographed from the left.",
        "Insists on a window seat, even in a box.",
        "Travels with a small, private fog.",
        "Dislikes applause that begins too early.",
        "Answers to no name but a firm 'there you are'.",
        "Must be fed before dramatic scenes and after tragic ones.",
        "Bows to doors, just in case.",
        "Is allergic to confidence, but manages.",
        "Says a short prayer to every trapdoor.",
        "Keeps a spare bow in every pocket.",
        "Has never lost an argument with a curtain, and has never won one.",
        "Always enters a moment before the music and a moment after the plot.",
        "Is rumoured to know the second act.",
        "Hums when nervous, and is nervous in A minor.",
    ],
}

HEADINGS = [
    "An Evening of Unreliable Wonders",
    "By Popular Insistence",
    "Presented With Only Slightly Unsteady Hands",
    "Positively One Night Only, Again",
    "A Programme of Reasonable Hopes",
    "Under the Distant Patronage of the Moon",
    "Not Responsible for Lost Hats, Plots or Parents",
    "The Wibbling Players Respectfully Request Your Patience",
    "Performed Entirely On Purpose",
    "With Apologies in Advance",
    "A Tragedy, Probably",
    "Please Hold Your Applause Until It Is Safe",
    "Strings Attached",
    "Mind the Gap Between the Acts",
]

BACK_PAGE = [
    "Patrons are reminded that the exits are where they were last time.",
    "Lost: one boot, left, tragic. Enquire at the box office, or at the boot.",
    "The management regrets that the interval is not an interval but a state of mind.",
    "Please do not feed the scenery. It will only want more.",
    "Latecomers will be seated at the next convenient tragedy.",
    "The theatre cat is not part of the production, though the cat disagrees.",
    "Refreshments are served in the foyer, the stalls and, occasionally, the plot.",
    "Anyone finding a stray moon is asked to return it to the stage manager, who is a tortoise.",
    "Whistling is forbidden backstage. Humming is tolerated. Sighing is encouraged.",
    "In case of fire, leave in order of seniority. In case of goose, leave in order of speed.",
    "Photography is permitted, but only of things that wish to be photographed.",
    "The lost property box contains mostly umbrellas and several apologies.",
    "Programme sellers are not responsible for the plot, the weather, or the second act.",
    "Please switch off your hat. Hats may flap.",
    "The management thanks the pigeons for their continued, unsolicited feedback.",
    "Patrons with weak constitutions are advised to sit near the exit, and then near the other exit.",
]

TONIGHT_IN = [
    "Tonight in {town}: doors at seven, curtain at eight, or whenever the weather allows.",
    "Tonight, by kind permission of {town} and its several opinions, we present a play.",
    "Tonight in {town}: one performance, two intervals, three exits, no guarantees.",
    "Tonight {town} hosts the Wibbling Players, who have promised to behave and haven't.",
    "In {town} tonight the lamps are lit, the seats are dusted, and hope is on a very short rope.",
    "Tonight in {town}, in the presence of the mayor, the weather, and a dog of no fixed address.",
    "{town} tonight: a company of puppets, a text of uncertain origin, and a promise of no refunds.",
    "{town} is honoured tonight, or at least informed.",
    "Tonight in {town}, the puppets will do their best, and the rest will do theirs.",
    "A brand new entertainment for {town}, as new as the last one and nearly as safe.",
    "Tonight in {town}, the moon has been asked to attend. It has not confirmed.",
    "Tonight in {town}, we begin when the last latecomer has finished apologising.",
    "Tonight in {town}, an evening of drama, comedy, and several things in between that nobody ordered.",
]

PREVIOUSLY = [
    "In {town}, {title} was rated {stars}/5 and earned a stern letter from the vicar.",
    "{town} witnessed {title}: rated {stars}/5, one fainting, and a lasting rumour.",
    "{town}: {title}, rated {stars}/5. The town has since asked us not to mention it.",
    "At {town}, {title} scored {stars} out of 5. The pigeons were divided; one was asleep.",
    "{title} played {town} to a rating of {stars}/5 and a single, enormous silence.",
    "In {town} we gave {title}. The Gazette gave {stars} out of 5, and the weather gave rain.",
    "{town} saw {title} and returned a verdict of {stars}/5. The programme sellers cried.",
    "Last time, in {town}: {title}. Verdict {stars}/5, with reservations and a casserole.",
    "{title}, {town}: {stars}/5. Remembered fondly by those who left early.",
    "In {town}, {title} met with {stars} out of 5 and a long, thoughtful cough.",
    "{town} received {title} warmly, rated it {stars}/5, and asked for the chairs back.",
    "From {town}: {title}, {stars} out of 5. A critic fainted, but only a little.",
    "{title} toured {town} to a rating of {stars}/5 and an unexplained goose.",
    "{town}'s verdict on {title}: {stars} out of 5, delivered by hand, in rhyme.",
]

PLAYBILL = {
    "bio": BIO,
    "headings": HEADINGS,
    "back_page": BACK_PAGE,
    "tonight_in": TONIGHT_IN,
    "previously": PREVIOUSLY,
}

DATASETS = {"playbill": PLAYBILL}
