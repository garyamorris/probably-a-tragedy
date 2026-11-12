"""The closed vocabulary that couples every dataset: beats, flaws, towns, audiences, cues, props, mishaps.

A tag that is not in TAGS fails `python -m tragedy.data check`. Keep it small: shared vocabulary IS the game's depth.
"""

TAGS: tuple[str, ...] = (
    "romance", "kiss", "wedding", "reunion", "betrayal", "secret", "mistaken_identity", "letter", "mask", "mirror",
    "death", "murder", "poison", "sword", "ghost", "mourning", "trial", "chase", "fire", "storm",
    "door", "stairs", "chair", "feast", "treasure", "crown", "goose", "song", "dance", "rhyme",
    "pun", "slapstick", "speech", "disguise", "lie", "chandelier",
)
SKILLS: tuple[str, ...] = ("drama", "comedy", "menace", "romance", "physical", "improv")
ROLES: tuple[str, ...] = ("lead", "villain", "fool")
BEATS: tuple[str, ...] = ("setup", "complication", "reversal", "twist", "finale")
GENRES: tuple[str, ...] = ("melodrama", "farce", "whodunit", "gothic_romance", "pantomime")

# --- closed vocabularies shared by every dataset (so independently authored tables cannot drift) ---------------------
CALAMITIES: tuple[str, ...] = (
    "the_lean", "the_chair", "the_goose_incident", "the_wrong_door", "the_chandelier", "the_curtain_stuck",
    "the_apology", "the_watering_can", "the_rhyme", "the_corpse", "the_trapdoor", "the_wig", "the_wrong_play",
    "the_swordfight", "the_kiss", "the_cake", "the_candle", "the_ghost_sheet", "the_fainting", "the_echo",
    "the_prompt", "the_umbrella", "the_banister", "the_mask", "the_encore", "the_snack", "the_moon", "the_string_knot",
)
MISHAP_KINDS: tuple[str, ...] = (
    "collapse", "apology", "prop", "upstage", "rhyme", "exit", "freeze", "cry", "wrong_play", "corpse", "flirt", "feast",
)
ANIMS: tuple[str, ...] = (
    "lean_left", "collapse", "spin", "wobble", "hide", "fly", "freeze", "shake", "flip", "slide", "bow", "drop_prop",
)
PROPS: tuple[str, ...] = (
    "sword", "chair", "candle", "door", "umbrella_stand", "letter", "mask", "mirror", "crown", "chandelier", "goose", "cake",
    "ghost_sheet", "trunk", "skull", "bouquet", "ladder", "teapot", "lantern", "tree", "bed", "clock", "harp", "trophy",
    "bottle", "book", "rope", "banner", "fish", "moon",
)
SETS: tuple[str, ...] = (
    "parlour", "corridor", "bedroom", "cellar", "moor", "ballroom", "graveyard", "castle", "garden", "library", "attic",
    "harbour", "stage",
)
SKIES: tuple[str, ...] = ("dawn", "noon", "dusk", "night", "storm")
LANDMARKS: tuple[str, ...] = (
    "windmill", "clocktower", "lighthouse", "castle", "bridge", "chimneys", "spire", "crane", "pier", "silo",
)
HATS: tuple[str, ...] = ("top", "bonnet", "crown", "flat", "none", "feather", "fez", "bow")
HEADS: tuple[str, ...] = ("round", "long", "square", "beak", "sock", "nutcracker", "tin", "shadow")
COSTUMES: tuple[str, ...] = ("gown", "coat", "frock", "uniform", "rags", "armour", "robe", "wig")
EMOTIONS: tuple[str, ...] = ("neutral", "joy", "fear", "rage", "love", "grief", "smug")
SPECIAL_TOWN = "wibbling_opera"
BEAT_WEIGHTS: tuple[float, ...] = (0.15, 0.2, 0.2, 0.2, 0.25)
TOUR_NIGHTS = 5
STAR_TARGET = 15
