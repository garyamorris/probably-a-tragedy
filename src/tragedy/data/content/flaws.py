"""The 24 flaws (docs/DATA.md section 3).

A flaw fires only when its `triggers` meet the beat's tags (beat + script variant + props); `intensity` is the base
probability before chaos, stage fright, rapport and cues; `kinds` are the mishap kinds it can cause. Sixteen of the
twenty-four are carried by the cast (two each; the understudy carries two as well); the other eight are *spare* flaws
that no one owns yet: a bad day can hand one to anybody.

Texts are deadpan one-liners shown on the casting screen. No pronouns, so a spare flaw fits whoever catches it.
"""

from __future__ import annotations


def _flaw(id, name, text, triggers, intensity, kinds):
    return {"id": id, "name": name, "text": text, "triggers": triggers, "intensity": intensity, "kinds": kinds}


FLAWS = [
    # --- carried by the cast -------------------------------------------------------------------------------------
    _flaw(
        "leans_left",
        "Leans left",
        "One string is too short.",
        ["romance", "kiss", "stairs", "dance"],
        0.45,
        ["collapse", "upstage"],
    ),
    _flaw(
        "cries_by_watering_can",
        "Cries into a watering can",
        "Weeps beautifully, on cue, into a small brass watering can kept up one sleeve.",
        ["mourning", "death", "wedding", "reunion", "letter"],
        0.5,
        ["cry", "prop"],
    ),
    _flaw(
        "apologises_mid_villainy",
        "Apologises mid-villainy",
        "Cannot commit a crime without a heartfelt note of regret.",
        ["murder", "betrayal", "poison", "sword", "trial"],
        0.55,
        ["apology", "freeze"],
    ),
    _flaw(
        "afraid_of_the_chandelier",
        "Afraid of the chandelier",
        "Is quite sure it is looking at them. It is, a little.",
        ["chandelier", "wedding", "stairs", "storm"],
        0.6,
        ["freeze", "exit", "collapse"],
    ),
    _flaw(
        "never_been_on_stage",
        "Never been on stage",
        "Knows every part by heart. Has watched from the wings for eleven years.",
        ["speech", "stairs", "door", "song", "trial"],
        0.6,
        ["freeze", "wrong_play", "exit"],
    ),
    _flaw(
        "says_everyones_lines",
        "Says everyone's lines",
        "Knows every part and is generous with all of them.",
        ["speech", "lie", "secret", "trial", "reunion"],
        0.45,
        ["wrong_play", "upstage"],
    ),
    _flaw(
        "eats_the_props",
        "Eats the props",
        "Was told it was a prop. Has tested this.",
        ["feast", "treasure", "poison", "wedding"],
        0.5,
        ["feast", "prop"],
    ),
    _flaw(
        "exits_through_the_wrong_door",
        "Exits by the wrong door",
        "Very confident about doors. Not correct, but confident.",
        ["door", "chase", "stairs", "secret"],
        0.5,
        ["exit", "upstage"],
    ),
    _flaw(
        "upstages_the_moon",
        "Upstages the moon",
        "Regards the paper moon as a rival and behaves accordingly.",
        ["song", "speech", "dance", "crown"],
        0.55,
        ["upstage", "prop"],
    ),
    _flaw(
        "allergic_to_feathers",
        "Allergic to feathers",
        "Sneezes at plumes, masks, and anything that has met a goose.",
        ["goose", "mask", "disguise", "crown"],
        0.45,
        ["collapse", "prop"],
    ),
    _flaw(
        "only_knows_act_two",
        "Only knows Act Two",
        "Rehearsed one act, thoroughly. It is always that act.",
        ["secret", "trial", "chase", "reunion"],
        0.4,
        ["wrong_play", "exit"],
    ),
    _flaw(
        "over_commits_to_death",
        "Over-commits to death",
        "Dies at length, in character, with the last words of a small opera.",
        ["death", "murder", "poison", "sword"],
        0.55,
        ["corpse", "collapse"],
    ),
    _flaw(
        "speaks_in_rhyme",
        "Speaks in rhyme",
        "Once a line starts to scan, nothing can stop it. Orange has been a problem.",
        ["rhyme", "song", "pun", "romance", "speech"],
        0.5,
        ["rhyme"],
    ),
    _flaw(
        "stage_whispers_everything",
        "Stage-whispers everything",
        "Every secret is delivered at a whisper audible in the next county.",
        ["secret", "lie", "betrayal", "letter", "romance"],
        0.5,
        ["upstage", "apology"],
    ),
    _flaw(
        "falls_in_love_with_props",
        "Falls in love with props",
        "Gives the heart easily, and always to something with legs.",
        ["chair", "mirror", "mask", "crown", "letter"],
        0.45,
        ["flirt", "prop"],
    ),
    _flaw(
        "winds_down_mid_scene",
        "Winds down mid-scene",
        "Clockwork. Runs for about eleven minutes, then makes a long, sad noise.",
        ["speech", "trial", "mourning", "death"],
        0.5,
        ["freeze"],
    ),
    # --- spare flaws: nobody owns them yet ----------------------------------------------------------------------
    _flaw(
        "corpses",
        "Corpses",
        "Dies beautifully, then giggles. The trade calls this corpsing.",
        ["death", "murder", "poison", "mourning", "trial"],
        0.45,
        ["corpse"],
    ),
    _flaw(
        "forgets_which_play",
        "Forgets which play",
        "Fully committed to a play. Frequently a different one.",
        ["mistaken_identity", "disguise", "lie", "secret", "reunion"],
        0.5,
        ["wrong_play"],
    ),
    _flaw(
        "cannot_say_the_word_macbeth",
        "Won't say the Scottish play",
        "Will not name it. Calls it 'that one with the hands', spins thrice, and spits.",
        ["murder", "ghost", "sword", "crown", "storm"],
        0.4,
        ["freeze", "wrong_play"],
    ),
    _flaw(
        "takes_bows_early",
        "Takes bows early",
        "Hears one clap and assumes the show is over.",
        ["speech", "song", "death", "dance"],
        0.45,
        ["upstage", "corpse"],
    ),
    _flaw(
        "waves_at_the_front_row",
        "Waves at the front row",
        "Recognises someone in row C. It is always a cousin.",
        ["reunion", "wedding", "speech", "song"],
        0.4,
        ["upstage", "flirt", "feast"],
    ),
    _flaw(
        "answers_the_prompter_aloud",
        "Answers the Prompter aloud",
        "Hears the prompt, replies 'Thank you!', and then says the line.",
        ["secret", "lie", "speech", "trial"],
        0.4,
        ["upstage", "apology", "wrong_play"],
    ),
    _flaw(
        "sleepwalks_into_the_audience",
        "Sleepwalks into the audience",
        "Drifts off the stage during quiet bits and sits down in somebody's coat.",
        ["ghost", "mourning", "stairs", "door"],
        0.35,
        ["exit"],
    ),
    _flaw(
        "tangles_in_own_strings",
        "Tangles in own strings",
        "Walks through the strings, then the scenery, then the cast.",
        ["chase", "dance", "stairs", "slapstick"],
        0.5,
        ["collapse", "freeze"],
    ),
]

DATASETS = {"flaws": FLAWS}
