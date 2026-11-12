"""The cast: eight playable puppets and the staff who direct them (docs/DATA.md sections 1 and 2).

Balance, by design (the engine reads these numbers; `python -m tragedy.data check` enforces the invariants):

* every role (lead / villain / fool) has four natural candidates; nobody is the best at more than two skills;
* everyone but the understudy has one real strength (>= 65) and one real weakness (<= 35);
* stage fright runs 18 (the goose, who fears nothing) to 68 (Gus, who has never done this);
* sixteen flaws are carried, two per puppet. The understudy carries `never_been_on_stage`.

Extra optional field beyond DATA.md: the three staff quills carry `favours` (the tags that quill reaches for first), so
the writers' room can rank drafts by what a town likes. Prose refers to performers by the first word of their name.
"""

from __future__ import annotations


def _perf(id, name, kind, blurb, palette, build, skills, stage_fright, roles, flaws, voice, bio_seed):
    return {
        "id": id,
        "name": name,
        "kind": kind,
        "blurb": blurb,
        "palette": dict(zip(("body", "accent", "hair"), palette, strict=True)),
        "build": dict(zip(("head", "height", "arms", "costume", "strings"), build, strict=True)),
        "skills": dict(zip(("drama", "comedy", "menace", "romance", "physical", "improv"), skills, strict=True)),
        "stage_fright": stage_fright,
        "roles": roles,
        "flaws": flaws,
        "voice": {"tone": voice[0], "catchphrases": voice[1], "tics": voice[2]},
        "bio_seed": bio_seed,
    }


PERFORMERS = [
    _perf(
        "mabel",
        "Mabel Tuckett",
        "marionette",
        "Method actor. One string is too short, so she leans left.",
        ("#c0566e", "#f2c14e", "#3b2a3a"),
        ("round", 1.0, "long", "gown", 5),
        (78, 40, 22, 74, 35, 52),
        35,
        ["lead"],
        ["leans_left", "cries_by_watering_can"],
        (
            "breathless, theatrical",
            ["I feel it in my left side.", "Is the light behind me tragic enough?"],
            ["sighs at the wrong moment", "touches the nearest curtain for support"],
        ),
        "trained at the Royal Academy of Looking Out Windows",
    ),
    _perf(
        "reginald",
        "Sir Reginald Blort",
        "hand puppet",
        "Gentle villain. Apologises to everyone he is about to wrong, and tips.",
        ("#5b4b8a", "#d9b44a", "#2b2b3a"),
        ("long", 1.1, "normal", "coat", 3),
        (68, 52, 64, 25, 30, 38),
        55,
        ["villain"],
        ["apologises_mid_villainy", "afraid_of_the_chandelier"],
        (
            "courteous, trembling with menace",
            ["I do beg your pardon, but you must be destroyed.", "This hurts me more than it hurts you. Possibly."],
            ["bows before every threat", "straightens his cuffs when lying"],
        ),
        "once menaced a vicar so politely that the vicar sent a thank-you card",
    ),
    _perf(
        "gus",
        "Gus Pettifer",
        "shadow puppet",
        "The understudy. Knows every part, word for word. Has never once been on stage.",
        ("#6b6f80", "#cfd3e0", "#22242c"),
        ("shadow", 0.95, "normal", "robe", 4),
        (55, 52, 50, 54, 48, 38),
        68,
        [],
        ["never_been_on_stage", "says_everyones_lines"],
        (
            "earnest, whispering, word-perfect",
            ["I know it. I know all of it. Please do not ask me to say it.", "Is it my cue? It might be my cue."],
            ["mouths everyone else's lines", "stands exactly where the wings end"],
        ),
        "eleven years in the wings, with an excellent view of the ceiling",
    ),
    _perf(
        "goose",
        "Gwendolyn Honk",
        "goose",
        "A goose in a wig, widely described as the most convincing woman anyone has met.",
        ("#f4f1e8", "#e08e45", "#8a4b2d"),
        ("beak", 1.05, "short", "wig", 4),
        (30, 74, 54, 56, 66, 56),
        18,
        ["lead", "fool"],
        ["eats_the_props", "exits_through_the_wrong_door"],
        (
            "regal, honking, entirely unbothered",
            [
                "Honk.",
                "Honk, honk. (Loosely: I will be needing that cake.)",
                "HONK! (Translated by the management: no.)",
            ],
            ["adjusts the wig with one wing", "stares at whoever is holding the food"],
        ),
        "swan-adjacent, self-taught, banned from three ponds",
    ),
    _perf(
        "hortensia",
        "Hortensia Heel",
        "sock puppet",
        "Sock-puppet diva. One costume, three agents, and a grudge against the moon.",
        ("#4f9d8f", "#f08a5d", "#7a3b69"),
        ("sock", 0.8, "short", "frock", 3),
        (76, 58, 50, 60, 22, 48),
        28,
        ["lead", "villain"],
        ["upstages_the_moon", "allergic_to_feathers"],
        (
            "grand, wounded, entirely rehearsed",
            ["I do not do small parts. I do small puppets, in large parts.", "Darling, the moon can wait."],
            ["checks for a spotlight before every line", "fans herself with the nearest script"],
        ),
        "was one of a pair once, and has never discussed the other",
    ),
    _perf(
        "bartleby",
        "Captain Bartleby Nutt",
        "nutcracker",
        "Nutcracker soldier. Brave, loud, and word-perfect in precisely one act.",
        ("#b3342f", "#e8c15a", "#f1ead5"),
        ("nutcracker", 1.2, "normal", "uniform", 6),
        (50, 34, 70, 36, 72, 26),
        42,
        ["villain", "fool"],
        ["only_knows_act_two", "over_commits_to_death"],
        (
            "clipped, booming, secretly anxious",
            ["Forward! Or sideways. I was not told the direction.", "I have died for less, and louder."],
            ["salutes whichever way the audience is facing", "marches on the spot while thinking"],
        ),
        "twenty years of distinguished service, all of it Act Two",
    ),
    _perf(
        "poppet",
        "Poppet Ragsworth",
        "rag doll",
        "Child prodigy. Eight years old, forty years of notes, and no respect for stage directions.",
        ("#e3a6b4", "#7fb2d9", "#d9822b"),
        ("square", 0.7, "short", "rags", 5),
        (62, 70, 14, 34, 58, 80),
        20,
        ["fool", "lead"],
        ["speaks_in_rhyme", "stage_whispers_everything"],
        (
            "bright, precocious, slightly too loud",
            ["I have read the whole play. Why is everyone sad?", "I will do it in one take. In rhyme!"],
            ["whispers loudly to whoever is next to her", "corrects other puppets' scansion"],
        ),
        "made a debut at six months, in a basket, as a foundling",
    ),
    _perf(
        "tock",
        "Mr. Tock",
        "clockwork",
        "Clockwork man. Perfectly punctual, and occasionally affectionate toward furniture.",
        ("#b08d3c", "#4a6a7a", "#2a2a2a"),
        ("tin", 1.25, "long", "armour", 7),
        (40, 52, 66, 20, 64, 22),
        48,
        ["villain", "fool"],
        ["falls_in_love_with_props", "winds_down_mid_scene"],
        (
            "precise, tender, slightly ticking",
            ["It is eight minutes and eleven seconds. I am so sorry about the chair.", "Tick. (That was a feeling.)"],
            ["ticks louder when moved", "checks the nearest clock for permission"],
        ),
        "wound at dawn, and sometimes forgotten at dusk",
    ),
]


def _staff(id, name, job, kind, palette, tone, catchphrases, emoji, **extra):
    row = {
        "id": id,
        "name": name,
        "job": job,
        "kind": kind,
        "palette": palette,
        "voice": {"tone": tone, "catchphrases": catchphrases},
        "emoji": emoji,
    }
    row.update(extra)
    return row


STAFF = [
    _staff(
        "madame",
        "Madame Odalys Prunt",
        "director (supervisor agent)",
        "hand",
        {"coat": "#5a2a4a", "accent": "#e0b24d", "hair": "#d8d2c4"},
        "imperious, wounded",
        ["Darling, no.", "I once received a good review. In 1987. It is framed.", "We do not panic. We rearrange."],
        "🎩",
    ),
    _staff(
        "quill_pompous",
        "Bartholomew Quill (Magnificent)",
        "playwright heron, in his grand mood",
        "heron",
        {"plumage": "#6d7a8a", "accent": "#b8860b"},
        "grand, capitalised, rhymes when nervous",
        ["Behold: a prologue.", "Let there be Capital Letters."],
        "🪶",
        style="Grand and capitalised: prologues, oaths, a death in every act and a rhyme for every emotion; brevity is for the weak.",
        favours=["death", "crown", "speech", "betrayal"],
    ),
    _staff(
        "quill_frantic",
        "Bartholomew Quill (Frantic)",
        "playwright heron, three plots in",
        "heron",
        {"plumage": "#9a7d6a", "accent": "#d1495b"},
        "breathless, door-slamming",
        ["Door! Another door! Write down the door!", "No, wait, the other twin!"],
        "🪶",
        style="Breathless and door-slamming: three plots at once, mistaken identities, and an exclamation mark holding up Act Two.",
        favours=["door", "mistaken_identity", "chase", "slapstick"],
    ),
    _staff(
        "quill_tender",
        "Bartholomew Quill (Tender)",
        "playwright heron, gently",
        "heron",
        {"plumage": "#8fa3a0", "accent": "#e9c46a"},
        "quiet, strange, kind to everyone",
        ["Perhaps the teapot remembers.", "It is not sad. It is only very gentle."],
        "🪶",
        style="Quiet, strange and kind to everyone: one small object that means everything, and a ghost who only wants to say sorry.",
        favours=["mourning", "letter", "reunion", "ghost"],
    ),
    _staff(
        "clipboard",
        "Clipboard",
        "stage manager (tortoise)",
        "tortoise",
        {"shell": "#6b8e4e", "accent": "#e2d9b6"},
        "terse, numerical, never early",
        ["Cue 14.", "Standby 9.", "Cue 14 was cue 13. Cue 14 now."],
        "🐢",
    ),
    _staff(
        "gasket",
        "Mrs. Gasket",
        "props master (clockwork spider)",
        "spider",
        {"body": "#8c6a3f", "accent": "#d4a72c"},
        "brisk, apologetic, eight hands full",
        ["Here, take this. No, not that. Not that either.", "I had it a moment ago, in this hand."],
        "🕷",
    ),
    _staff(
        "narrator",
        "The Paper Moon",
        "narrator",
        "moon",
        {"face": "#f3ead2", "accent": "#b9a77a"},
        "dry, serene, mildly bored",
        ["And so the evening continued, as evenings do.", "I have seen this play. It ends."],
        "🌙",
    ),
]

DATASETS = {"performers": PERFORMERS, "staff": STAFF}
