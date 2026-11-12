"""Chat models: offline (default) or Claude. The ENGINE decides outcomes; models only give them a VOICE.

`voice()` is the single seam: offline it 'rewrites' a draft by echoing it back token by token (so `messages` streaming
and jaw-flap animation work with no keys); online it asks Claude to rephrase in the persona's voice, with the draft as
ground truth. Scores, mishaps and stars never depend on model output, so the game is identical in both modes.
"""

from __future__ import annotations

import logging
import re
from functools import lru_cache
from typing import Any

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.runnables.config import merge_configs

from tragedy.models.offline import OfflineChatModel, Rule, Script, anywhere
from tragedy.settings import Settings, get_settings

log = logging.getLogger("tragedy.voice")
STATS = {
    "calls": 0,
    "fallbacks": 0,
    "changed": 0,
}  # how often a model actually (re)voiced a draft; surfaced by /api/boot
DRAFT_RE = re.compile(r"<<draft>>(.*?)<</draft>>", re.S)


def _echo_draft(call: Any) -> str:
    m = DRAFT_RE.search(call.text)
    return m.group(1).strip() if m else "..."


ECHO_SCRIPT = Script([Rule("echo_draft", anywhere("<<draft>>"), _echo_draft)])


@lru_cache(maxsize=8)
def _anthropic(name: str, timeout: float, max_tokens: int, api_key: str, workspace_id: str | None = None) -> BaseChatModel:
    from langchain_anthropic import ChatAnthropic  # lazy: offline mode never needs the key

    # No temperature/top_p: not accepted by Claude 5 models. A key that is not scoped to a workspace needs the header.
    headers = {"anthropic-workspace-id": workspace_id} if workspace_id else None
    return ChatAnthropic(
        model=name, api_key=api_key, timeout=timeout, max_retries=2, max_tokens=max_tokens, default_headers=headers
    )


@lru_cache(maxsize=8)
def _openai(name: str, timeout: float, max_tokens: int, api_key: str) -> BaseChatModel:
    from langchain_openai import ChatOpenAI  # lazy: offline mode never imports it

    # No temperature: current OpenAI reasoning models reject it. `max_completion_tokens` is the supported cap.
    return ChatOpenAI(model=name, api_key=api_key, timeout=timeout, max_retries=2, max_completion_tokens=max_tokens)


def get_chat_model(
    role: str = "fast", *, script: Script | None = None, settings: Settings | None = None
) -> BaseChatModel:
    s = settings or get_settings()
    if s.resolved_provider() == "offline":
        return OfflineChatModel(role=role, script=script or ECHO_SCRIPT, token_delay_s=s.offline_token_delay_s)
    if s.resolved_provider() == "openai":
        okey = s.openai_api_key
        assert okey is not None, "TRAGEDY_PROVIDER=openai needs OPENAI_API_KEY"
        oname = s.openai_model_smart if role == "smart" else s.openai_model_fast
        return _openai(oname, s.llm_timeout_s, s.openai_max_tokens, okey.get_secret_value())
    key = s.anthropic_api_key
    assert key is not None
    name = s.model_smart if role == "smart" else s.model_fast
    return _anthropic(name, s.llm_timeout_s, s.llm_max_tokens, key.get_secret_value(), s.anthropic_workspace_id)


async def voice(
    persona: str, draft: str, *, style: str = "", role: str = "fast", config: Any = None, actor: str | None = None
) -> str:
    """Give `draft` a voice. Always returns text; never raises (falls back to the draft).

    `actor` tags the model call (`actor:<id>`) so `messages` stream chunks can be attributed to a speaker.
    """
    try:
        if actor:
            config = merge_configs(config, {"tags": [f"actor:{actor}"]})
        model = get_chat_model(role)
        system = (
            f"You are {persona}, a character in a charming, wry toy-theatre comedy. Rewrite the DRAFT in your own voice "
            f"in at most 40 words. Keep every fact, name and number from the draft. {style}".strip()
        )
        msg = await model.ainvoke([SystemMessage(system), HumanMessage(f"<<draft>>{draft}<</draft>>")], config=config)
        text = str(msg.text).strip()
        STATS["calls"] += 1
        if text and text != draft:
            STATS["changed"] += 1
        return text or draft
    except Exception as exc:  # a flaky provider must never break a show, but it must not fail SILENTLY either
        STATS["fallbacks"] += 1
        log.warning("voice() fell back to the draft: %s: %s", type(exc).__name__, str(exc)[:200])
        return draft
