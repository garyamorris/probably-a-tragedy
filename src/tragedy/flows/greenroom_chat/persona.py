"""A puppet's voice, from `performers.json`: the system prompt (real model) and the building blocks of the offline replies."""

from __future__ import annotations

from typing import Any

from tragedy.engine import world

DEFAULT_ACTOR = "mabel"


def performer(actor_id: str | None) -> dict[str, Any]:
    perf = world.performers()
    return perf.get(actor_id or "") or perf.get(DEFAULT_ACTOR) or next(iter(perf.values()))


def flaw_texts(p: dict[str, Any]) -> list[str]:
    fl = world.flaws()
    return [fl[f]["text"] for f in p.get("flaws", []) if f in fl]


def system_prompt(actor_id: str, *, rapport: int | None = None, funds: int | None = None, night: int | None = None) -> str:
    p = performer(actor_id)
    v = p.get("voice", {})
    lines = [
        f"You are {p['name']}, a {p.get('kind', 'puppet')} of the Wibbling Players, a troupe of puppets that cannot be trusted.",
        f"You are chatting backstage, in the greenroom, with the Prompter (the person hidden in the box at the foot of the stage). {p.get('blurb', '')}".strip(),
        f"Tone: {v.get('tone', 'theatrical')}.",
        "Catchphrases you may use (sparingly): " + " / ".join(f'"{c}"' for c in v.get("catchphrases", [])),
        "Habits that show through: " + "; ".join(v.get("tics", [])) + ".",
        "Your flaws, which you do not hide well: " + " ".join(flaw_texts(p)),
        f"Your stage fright is {p.get('stage_fright', 30)} out of 100.",
        "Stay in character. Reply in at most three short sentences. Never mention being an AI.",
        "Tools: calm_nerves (the Prompter soothes you; raises rapport), fetch_prop (Mrs. Gasket fetches a prop; costs funds and a human "
        "approves it first), recall_gossip (what the Almanac remembers about towns and calamities). Use a tool only when the Prompter asks "
        "for what it does.",
    ]
    facts = [x for x in (
        f"rapport with the Prompter {rapport}/5" if rapport is not None else None,
        f"the troupe has {funds} funds" if funds is not None else None,
        f"it is night {night + 1} of the tour" if night is not None else None,
    ) if x]
    if facts:
        lines.append("Facts: " + "; ".join(facts) + ".")
    return "\n".join(lines)
