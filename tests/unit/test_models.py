"""Provider resolution and voice() accounting: offline-safe (no network, no real keys)."""

from __future__ import annotations

import pytest

from tragedy.models import factory
from tragedy.settings import Settings


@pytest.fixture(autouse=True)
def _no_ambient_provider_env(monkeypatch):
    """A developer's real keys / TRAGEDY_* env must never leak into these tests."""
    for var in ("ANTHROPIC_API_KEY", "ANTHROPIC_WORKSPACE_ID", "OPENAI_API_KEY", "TRAGEDY_PROVIDER"):
        monkeypatch.delenv(var, raising=False)


def S(**kw):
    return Settings(_env_file=None, **kw)


def test_offline_is_the_default_even_when_keys_exist():
    s = S(anthropic_api_key="sk-a", openai_api_key="sk-o")
    assert s.provider == "offline" and s.resolved_provider() == "offline"


def test_explicit_providers():
    assert S(provider="openai", openai_api_key="sk-o").resolved_provider() == "openai"
    assert S(provider="anthropic", anthropic_api_key="sk-a").resolved_provider() == "anthropic"


def test_auto_prefers_anthropic_then_openai_then_offline():
    assert S(provider="auto", anthropic_api_key="a", openai_api_key="o").resolved_provider() == "anthropic"
    assert S(provider="auto", openai_api_key="o").resolved_provider() == "openai"
    assert S(provider="auto").resolved_provider() == "offline"


def test_factory_builds_the_right_model_class_without_calling_the_network():
    from langchain_openai import ChatOpenAI

    from tragedy.models.offline import OfflineChatModel

    assert isinstance(factory.get_chat_model("fast", settings=S()), OfflineChatModel)
    m = factory.get_chat_model("fast", settings=S(provider="openai", openai_api_key="sk-test", openai_model_fast="gpt-x"))
    assert isinstance(m, ChatOpenAI) and m.model_name == "gpt-x"


def test_missing_key_for_a_requested_provider_fails_loudly_not_silently():
    with pytest.raises(AssertionError, match="OPENAI_API_KEY"):
        factory.get_chat_model("fast", settings=S(provider="openai"))


async def test_voice_counts_a_changed_draft_and_a_fallback(monkeypatch):
    from langchain_core.messages import AIMessage

    class Rewriter:
        async def ainvoke(self, *_a, **_k):
            return AIMessage("Darling, no.")

    class Broken:
        async def ainvoke(self, *_a, **_k):
            raise RuntimeError("provider down")

    before = dict(factory.STATS)
    monkeypatch.setattr(factory, "get_chat_model", lambda *a, **k: Rewriter())
    assert await factory.voice("Madame", "Hello.") == "Darling, no."
    monkeypatch.setattr(factory, "get_chat_model", lambda *a, **k: Broken())
    assert await factory.voice("Madame", "Hello.") == "Hello."  # never breaks a show...
    assert factory.STATS["fallbacks"] == before["fallbacks"] + 1  # ...but is never silent about it
    assert factory.STATS["changed"] == before["changed"] + 1


def test_anthropic_gets_the_workspace_header_when_the_key_is_unscoped():
    """A key not scoped to a workspace is rejected (HTTP 400) unless every request carries `anthropic-workspace-id`."""
    from langchain_anthropic import ChatAnthropic

    factory._anthropic.cache_clear()
    with_ws = factory.get_chat_model("fast", settings=S(provider="anthropic", anthropic_api_key="sk-a", anthropic_workspace_id="wrkspc_123"))
    assert isinstance(with_ws, ChatAnthropic) and with_ws.default_headers.get("anthropic-workspace-id") == "wrkspc_123"
    without = factory.get_chat_model("fast", settings=S(provider="anthropic", anthropic_api_key="sk-b"))
    assert "anthropic-workspace-id" not in (without.default_headers or {})
