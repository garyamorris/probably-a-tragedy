"""Twelve audience archetypes (docs/DATA.md section 9).

A town's `audience.mix` names three of these; the engine seats twelve paper spectators from them. Each archetype reacts to
event tags it likes / hates, and `laugh`/`cry`/`gasp`/`boo` (0-1) say how readily it does each of those things.
"""

from __future__ import annotations


def _taste(id, name, hat, coat, skin, likes, hates, laugh, cry, gasp, boo):
    return {
        "id": id,
        "name": name,
        "hat": hat,
        "palette": {"coat": coat, "skin": skin},
        "likes": likes,
        "hates": hates,
        "laugh": laugh,
        "cry": cry,
        "gasp": gasp,
        "boo": boo,
    }


TASTES = [
    _taste(
        "man_who_hates_death", "The Man Who Hates Death", "none", "#4a4e69", "#e0b88f",
        ["reunion", "feast", "wedding"], ["death", "murder", "mourning"],
        laugh=0.5, cry=0.15, gasp=0.55, boo=0.8,
    ),
    _taste(
        "tearful_aunt", "The Tearful Aunt", "bonnet", "#8d5a6b", "#f1d3b3",
        ["wedding", "reunion", "mourning"], ["betrayal", "sword"],
        laugh=0.3, cry=0.95, gasp=0.6, boo=0.05,
    ),
    _taste(
        "pun_lover", "The Pun Enthusiast", "bonnet", "#6d597a", "#e8c9a0",
        ["pun", "rhyme"], ["death"],
        laugh=0.8, cry=0.2, gasp=0.4, boo=0.1,
    ),
    _taste(
        "child_in_the_front", "The Child in the Front Row", "bow", "#e07a5f", "#f4d6b8",
        ["goose", "slapstick", "chase"], ["kiss", "speech"],
        laugh=0.95, cry=0.3, gasp=0.85, boo=0.3,
    ),
    _taste(
        "retired_actor", "The Retired Actor", "top", "#3d405b", "#d9b38c",
        ["speech", "crown", "death"], ["pun", "goose"],
        laugh=0.3, cry=0.5, gasp=0.2, boo=0.6,
    ),
    _taste(
        "critic_in_disguise", "The Critic in an Obvious Moustache", "fez", "#5c5470", "#e5c4a0",
        ["speech", "trial", "letter"], ["slapstick", "goose", "pun"],
        laugh=0.15, cry=0.1, gasp=0.3, boo=0.7,
    ),
    _taste(
        "sleepy_farmer", "The Sleepy Farmer", "flat", "#81795b", "#d6a77a",
        ["feast", "rhyme", "song"], ["storm", "chase"],
        laugh=0.45, cry=0.2, gasp=0.15, boo=0.1,
    ),
    _taste(
        "goose_fancier", "The Goose Fancier", "feather", "#7a9e7e", "#ecd0aa",
        ["goose", "song", "disguise"], ["fire", "murder"],
        laugh=0.7, cry=0.25, gasp=0.9, boo=0.2,
    ),
    _taste(
        "romantic", "The Incurable Romantic", "feather", "#b56576", "#f3d9c2",
        ["romance", "kiss", "wedding"], ["slapstick", "betrayal"],
        laugh=0.35, cry=0.75, gasp=0.65, boo=0.15,
    ),
    _taste(
        "skeptic", "The Skeptic", "top", "#4f5d75", "#e1bf99",
        ["secret", "lie", "mirror"], ["ghost", "romance", "mask"],
        laugh=0.2, cry=0.1, gasp=0.1, boo=0.6,
    ),
    _taste(
        "snack_vendor", "The Snack Vendor", "flat", "#bc6c25", "#e3b887",
        ["feast", "dance", "song"], ["storm", "chase", "slapstick"],
        laugh=0.6, cry=0.1, gasp=0.3, boo=0.2,
    ),
    _taste(
        "mayor", "The Mayor, Wearing the Paper Crown", "crown", "#9c2a2a", "#eac8a2",
        ["speech", "crown", "wedding"], ["lie", "betrayal", "slapstick"],
        laugh=0.4, cry=0.3, gasp=0.4, boo=0.5,
    ),
]

DATASETS = {"tastes": TASTES}
