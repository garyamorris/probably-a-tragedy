"""The six stage cues (docs/DATA.md section 6).

A cue whose `fits` intersect the beat or the mishap is a miracle (`effects`); any other is a misfire (`misfire`, and
`misfire_text` is what the audience gets instead). `uses` is per night. `anim` is the stage effect id.
"""

from __future__ import annotations

CUES = [
    {
        "id": "lights",
        "label": "Lights",
        "emoji": "💡",
        "uses": 2,
        "fits": ["romance", "kiss", "secret", "mask", "mirror", "murder", "ghost"],
        "effects": {"warmth": 4, "chaos": -3},
        "misfire": {"warmth": -2, "chaos": 3},
        "misfire_text": "Lights up on the wedding breakfast. The groom is revealed to be a coat stand.",
        "anim": "lights_flash",
    },
    {
        "id": "thunder",
        "label": "Thunder sheet",
        "emoji": "⛈",
        "uses": 2,
        "fits": ["storm", "death", "murder", "ghost", "betrayal"],
        "effects": {"warmth": 5, "chaos": -4},
        "misfire": {"warmth": -3, "chaos": 4},
        "misfire_text": "Thunder, at a wedding. Someone's aunt faints.",
        "anim": "lightning",
    },
    {
        "id": "trapdoor",
        "label": "Trapdoor",
        "emoji": "🕳",
        "uses": 1,
        "fits": ["ghost", "chase", "disguise", "betrayal", "death", "mistaken_identity"],
        "effects": {"warmth": 6, "chaos": -6},
        "misfire": {"warmth": -4, "chaos": 6},
        "misfire_text": "The trapdoor opens under the vicar's tea table. The tea goes first. The vicar, with dignity, follows.",
        "anim": "trapdoor",
    },
    {
        "id": "fog",
        "label": "Fog machine",
        "emoji": "🌫",
        "uses": 2,
        "fits": ["ghost", "mourning", "secret", "disguise", "mistaken_identity", "murder"],
        "effects": {"warmth": 4, "chaos": -6},
        "misfire": {"warmth": -2, "chaos": 3},
        "misfire_text": "Fog, at the picnic scene. Everyone is found, eventually, by the sandwiches.",
        "anim": "fog",
    },
    {
        "id": "spotlight",
        "label": "Spotlight",
        "emoji": "🔦",
        "uses": 2,
        "fits": ["speech", "song", "dance", "kiss", "crown", "rhyme", "reunion"],
        "effects": {"warmth": 5, "chaos": -2},
        "misfire": {"warmth": -3, "chaos": 3},
        "misfire_text": "The spotlight finds the chaperone, who has a speech, and it is nine minutes long.",
        "anim": "spotlight",
    },
    {
        "id": "curtain",
        "label": "Curtain",
        "emoji": "🎭",
        "uses": 1,
        "fits": ["slapstick", "wedding", "feast", "death", "reunion", "chase"],
        "effects": {"warmth": 7, "chaos": -10},
        "misfire": {"warmth": -5, "chaos": 2},
        "misfire_text": "The curtain falls mid-proposal. The house is left holding a ring and no answer.",
        "anim": "curtain",
    },
]

DATASETS = {"cues": CUES}
