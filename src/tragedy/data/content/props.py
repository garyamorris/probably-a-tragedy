"""The thirty props (docs/DATA.md section 14): exactly the PROPS ids, each drawn by its own stage sprite.

Names are written to read after "the": "the Probably Secure Chandelier", "the Bottle Marked Poison". `tags` are what a
prop implies; they can set a flaw off (falls_in_love_with_props, allergic_to_feathers, eats_the_props...).
"""

from __future__ import annotations

_PROPS: list[tuple[str, str, list[str]]] = [
    ("sword", "Rubber Sword", ["sword"]),
    ("chair", "Wobbly Chair", ["chair"]),
    ("candle", "Supervised Candle", ["fire"]),
    ("door", "Freestanding Door", ["door"]),
    ("umbrella_stand", "Umbrella Stand", ["mistaken_identity"]),
    ("letter", "Sealed Letter", ["letter", "secret"]),
    ("mask", "Feathered Ball Mask", ["mask", "disguise"]),
    ("mirror", "Full-Length Mirror", ["mirror"]),
    ("crown", "Cardboard Crown", ["crown"]),
    ("chandelier", "Probably Secure Chandelier", ["chandelier"]),
    ("goose", "Spare Goose", ["goose"]),
    ("cake", "Three-Tier Cake", ["feast", "wedding"]),
    ("ghost_sheet", "Pre-Haunted Sheet", ["ghost"]),
    ("trunk", "Unclaimed Trunk", ["treasure", "secret"]),
    ("skull", "Philosophical Skull", ["death", "speech"]),
    ("bouquet", "Bouquet of Mild Surprise", ["romance", "wedding"]),
    ("ladder", "Ladder to Somewhere", ["stairs"]),
    ("teapot", "Suspicious Teapot", ["poison", "feast"]),
    ("lantern", "Storm Lantern", ["storm", "fire"]),
    ("tree", "Cardboard Tree", []),
    ("bed", "Reversible Deathbed", ["death", "romance"]),
    ("clock", "Clock Stuck at Murder", ["murder"]),
    ("harp", "Three-String Harp", ["song"]),
    ("trophy", "Trophy for Nobody", ["treasure"]),
    ("bottle", "Bottle Marked Poison", ["poison"]),
    ("book", "Book of Rules", ["trial"]),
    ("rope", "Ambitious Rope", ["chase"]),
    ("banner", "Welcome Home Banner", ["reunion"]),
    ("fish", "Wet Fish", ["slapstick"]),
    ("moon", "Spare Paper Moon", ["romance"]),
]

PROPS_TABLE = [{"id": pid, "name": name, "tags": tags, "draw": pid} for pid, name, tags in _PROPS]

DATASETS = {"props": PROPS_TABLE}
