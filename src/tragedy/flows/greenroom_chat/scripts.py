"""The puppet's OFFLINE voice: a `Script` for `OfflineChatModel`. Pure functions of the transcript (so replays and interrupt re-runs
give the same answers); the persona is read from the run context (`actor_id`) and `performers.json`, never hard-coded.

    keyword rules -> a tool call            calm / nerves / worried          -> calm_nerves
                                            prop / need / borrow / chandelier -> fetch_prop(prop)
                                            gossip / rumour / town / heard    -> recall_gossip(query)
    after a tool result -> an in-character wrap-up that quotes what the tool returned
    anything else      -> a catchphrase + tic (+ flaw) reply, varied by how many messages the Prompter has sent
"""

from __future__ import annotations

import re
from typing import Any

from tragedy.common.rng import pick
from tragedy.engine import world
from tragedy.flows.greenroom_chat.context import ctx_get
from tragedy.flows.greenroom_chat.persona import DEFAULT_ACTOR, flaw_texts, performer
from tragedy.flows.greenroom_chat.tools import prop_slug
from tragedy.models import offline as o

CALM_RE = re.compile(r"\b(calm\w*|nerves?|nervous\w*|worr(?:y|ied|ies)|anxious|anxiety|scared|afraid|frighten\w*|jitters|stage ?fright|relax\w*|panic\w*)\b", re.I)
PROP_RE = re.compile(r"\b(props?|need\w*|borrow\w*|fetch\w*|bring|chandelier|sword|crown|ladder|umbrella|lantern|candle|harp|trophy)\b", re.I)
GOSSIP_RE = re.compile(r"\b(gossip\w*|rumou?rs?|town|heard|legends?|folklore|what do they say)\b", re.I)
WANT_RE = re.compile(r"\b(?:need|borrow|fetch|bring(?:\s+me)?|get\s+me|want|find)\s+(?:an?|the|some|my|your)?\s*([a-z][a-z' -]{2,30})", re.I)
FILLER = {
    "any", "anything", "gossip", "gossipy", "rumour", "rumours", "rumor", "rumors", "heard", "hear", "legend", "legends", "folklore", "what", "have",
    "you", "your", "about", "tell", "the", "town", "towns", "there", "they", "say", "said", "know", "ever", "please", "can", "could", "and", "with",
    "for", "that", "this", "was", "were", "has", "had", "does", "did", "who", "how", "why", "when", "where", "some", "something",
}
STOP_WORDS = {"for", "to", "from", "please", "before", "tonight", "now", "because", "so", "and", "but", "if", "when", "that", "with"}


def _actor(c: o.Call) -> dict[str, Any]:
    return performer(str(ctx_get(c.context, "actor_id", DEFAULT_ACTOR)))


def _salt(c: o.Call) -> tuple[str, str, int]:
    """(tour, actor, how many messages the Prompter has sent): the labels every pick is a pure function of."""
    n = sum(1 for m in c.messages if m.type == "human")
    return str(ctx_get(c.context, "tour_id", "tour")), _actor(c)["id"], n


def _voice(c: o.Call) -> tuple[str, str, str]:
    p, (tour, actor, n) = _actor(c), _salt(c)
    v = p.get("voice", {})
    cat = pick(v.get("catchphrases") or ["Hm."], tour, actor, n, "catch")
    tic = pick(v.get("tics") or ["pauses meaningfully"], tour, actor, n, "tic")
    return cat, tic, world.nick(p["id"])


def gossip_query(text: str, actor_name: str = "") -> str:
    """The topic of a gossip question: the message minus the words that merely ask for gossip ("any gossip about the town of Marshwick?" -> "marshwick")."""
    skip = FILLER | {w.lower() for w in actor_name.replace(".", " ").split()}
    topic = [w for w in re.findall(r"[a-z0-9']+", text.lower()) if w not in skip and len(w) > 2]
    return " ".join(topic) or text.strip()[:200] or "gossip"


def extract_prop(text: str) -> str:
    low = text.lower()
    for row in world.props().values():
        pid, name = row["id"].replace("_", " "), row["name"].lower()
        if name in low or re.search(rf"\b{re.escape(pid)}\b", low):
            return name
    m = WANT_RE.search(text)
    if m:
        words = []
        for w in m.group(1).split():
            if w.lower().strip("'") in STOP_WORDS:
                break
            words.append(w)
        if words:
            return prop_slug(" ".join(words[:3]))
    return "a spare candle"


# ------------------------------------------------------------------------------------------------ plain chat
CHAT_TEMPLATES = (
    "{cat} {name} {tic}. {flaw}",
    "{name} {tic}, and then says: {cat}",
    "{cat} (And yes, {name} heard you. {name} {tic}.)",
    "You ask a great deal of a {kind}, Prompter. {cat} {flaw}",
    "{cat} {name} is, as ever, doing {name}'s best. {name} {tic}.",
    "Between the two of us, Prompter: {flaw} {cat}",
)


def chat_reply(c: o.Call) -> str:
    p, (tour, actor, n) = _actor(c), _salt(c)
    cat, tic, name = _voice(c)
    flaws = flaw_texts(p) or ["Nothing is wrong. Nothing has ever been wrong."]
    return pick(CHAT_TEMPLATES, tour, actor, n, "chat").format(
        cat=cat, tic=tic, name=name, kind=p.get("kind", "puppet"), flaw=pick(flaws, tour, actor, n, "flaw")
    )


# ------------------------------------------------------------------------------------------------ tool wrap-ups
def _tool_text(c: o.Call, name: str) -> str | None:
    for m in c.tool_results:
        if m.name == name:
            return str(m.content)
    return None


def _wrap_up(c: o.Call) -> str:
    cat, tic, name = _voice(c)
    calm, prop, gossip = _tool_text(c, "calm_nerves"), _tool_text(c, "fetch_prop"), _tool_text(c, "recall_gossip")
    if prop is not None:
        if prop.startswith("User rejected") or "unclear" in prop:
            return f"{cat} No? Fine. {name} shall emote at the absence of the prop. {name} {tic}."
        if "returns empty-handed" in prop or "no purse" in prop:
            return f"{cat} The purse is empty, so {name} will simply act as if the prop were there. Mrs. Gasket's spoon will have to do."
        got = re.search(r"returns with (.+?), and also", prop)
        what = got.group(1) if got else "something"
        return f"{cat} Mrs. Gasket has brought {what}. It is, of course, the wrong one. {name} {tic} and cradles it anyway."
    if calm is not None:
        m = re.search(r"(\d)/5", calm)
        r = m.group(1) if m else "?"
        return f"{cat} Breathing... in... and out. {name} is a pond. A calm pond. (Rapport {r}/5.) {name} {tic}."
    if gossip is not None:
        first = next((ln[2:] for ln in gossip.splitlines() if ln.startswith("- ")), None)
        if first:
            return f"{cat} Between us, Prompter: {first} Have I said too much? I have said exactly enough."
        return f"{cat} Nobody remembers a thing about that. Which, in this town, is itself a story."
    return chat_reply(c)


# ------------------------------------------------------------------------------------------------ the script
def build_script() -> o.Script:
    s = o.Script()
    s.when("wrap_up", lambda c: bool(c.tool_results), lambda c: o.say(_wrap_up(c)))
    s.when(
        "calm", lambda c: bool(CALM_RE.search(c.human)) and "calm_nerves" in c.tools,
        lambda c: o.call_tool("calm_nerves"),
    )
    s.when(
        "prop", lambda c: bool(PROP_RE.search(c.human)) and "fetch_prop" in c.tools,
        lambda c: o.call_tool("fetch_prop", prop=extract_prop(c.human)),
    )
    s.when(
        "gossip", lambda c: bool(GOSSIP_RE.search(c.human)) and "recall_gossip" in c.tools,
        lambda c: o.call_tool("recall_gossip", query=gossip_query(c.human, _actor(c)["name"])),
    )
    s.when("chat", lambda c: True, lambda c: o.say(chat_reply(c)))
    return s
