"""Deterministic 'randomness'. NO RNG OBJECT EVER GOES IN GRAPH STATE.

Every random-looking outcome is a pure function of (seed, ...labels) via SHA-256, so a forked or rewound timeline
replays bit-for-bit, `interrupt()` re-execution is harmless, and tests/evals have stable ground truth.
"""

from __future__ import annotations

import hashlib
from collections.abc import Sequence
from typing import Any, TypeVar

T = TypeVar("T")


def stable_int(*parts: Any) -> int:
    digest = hashlib.sha256("|".join(map(str, parts)).encode()).hexdigest()
    return int(digest[:12], 16)


def roll(*parts: Any) -> float:
    """Uniform float in [0, 1)."""
    return (stable_int(*parts) % 1_000_000) / 1_000_000


def chance(p: float, *parts: Any) -> bool:
    return roll(*parts) < p


def pick(seq: Sequence[T], *parts: Any) -> T:
    if not seq:
        raise ValueError("pick() from an empty sequence")
    return seq[stable_int(*parts) % len(seq)]


def pick_n(seq: Sequence[T], n: int, *parts: Any) -> list[T]:
    """Deterministic sample without replacement, order depends on the labels."""
    scored = sorted(range(len(seq)), key=lambda i: stable_int(*parts, i))
    return [seq[i] for i in scored[: max(0, min(n, len(seq)))]]


def weighted(items: Sequence[T], weights: Sequence[float], *parts: Any) -> T:
    total = sum(weights)
    r = roll(*parts) * total
    acc = 0.0
    for it, w in zip(items, weights, strict=True):
        acc += w
        if r < acc:
            return it
    return items[-1]


def sub_seed(seed: int, *labels: Any) -> int:
    return stable_int(seed, *labels) % 2_147_483_647


def clamp(x: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, x))
