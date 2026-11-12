"""Typed configuration. One place that reads the environment; everything else takes a Settings."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

Provider = Literal["auto", "offline", "anthropic", "openai"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_prefix="TRAGEDY_", extra="ignore", env_file_encoding="utf-8", populate_by_name=True
    )

    # --- models: offline by default (deterministic, free, no keys). Real Claude is opt-in. -------------------
    provider: Provider = "offline"
    model_fast: str = "claude-haiku-5-5"
    model_smart: str = "claude-sonnet-5-5"
    llm_timeout_s: float = 60.0
    llm_max_tokens: int = 400  # puppets are brief; Claude 5's own default (128000) must never leak through
    offline_token_delay_s: float = Field(0.012, ge=0, le=1)  # makes streamed jaw-flaps visible

    # OpenAI: ids are whatever your key can use (`GET /v1/models`); these are small/cheap defaults for short puppet lines
    openai_model_fast: str = "gpt-5.4-mini"
    openai_model_smart: str = "gpt-5.4-mini"
    openai_max_tokens: int = 1200  # reasoning models spend part of this budget thinking; the 40-word prompt keeps replies short

    anthropic_api_key: SecretStr | None = Field(None, validation_alias="ANTHROPIC_API_KEY")
    # Keys that are not scoped to a workspace must send `anthropic-workspace-id` on every request (else HTTP 400).
    anthropic_workspace_id: str | None = Field(None, validation_alias="ANTHROPIC_WORKSPACE_ID")
    openai_api_key: SecretStr | None = Field(None, validation_alias="OPENAI_API_KEY")

    # --- links the UI offers (all optional, all "light") ---------------------------------------------------
    public_base_url: str = "http://127.0.0.1:2027"
    studio_url: str = "https://smith.langchain.com/studio/"
    langsmith_project: str = "probably-a-tragedy"
    langsmith_url: str = "https://smith.langchain.com/"

    data_dir: Path = Path("var")

    def resolved_provider(self) -> Literal["offline", "anthropic", "openai"]:
        """`offline` unless a real provider is asked for. `auto` prefers Anthropic, then OpenAI, when a key is present."""
        if self.provider in {"anthropic", "openai"}:
            return self.provider
        if self.provider == "auto":
            if self.anthropic_api_key and self.anthropic_api_key.get_secret_value():
                return "anthropic"
            if self.openai_api_key and self.openai_api_key.get_secret_value():
                return "openai"
        return "offline"


@lru_cache
def get_settings() -> Settings:
    return Settings()
