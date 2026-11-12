"""Shared fixtures/helpers. Graphs are compiled WITH an in-memory checkpointer + store, exactly like the server does."""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.store.memory import InMemoryStore

sys.path.insert(0, str(Path(__file__).parent))

# A developer's .env (real keys, TRAGEDY_PROVIDER=openai) must NEVER leak into the suite: tests are offline, free and deterministic.
# Real environment variables outrank the .env file in pydantic-settings, so pinning them here is enough. (The live tests that need
# a real model start their own servers with their own environment.)
os.environ["TRAGEDY_PROVIDER"] = "offline"
os.environ["LANGSMITH_TRACING"] = "false"
os.environ["LANGCHAIN_TRACING_V2"] = "false"


@pytest.fixture
def saver() -> InMemorySaver:
    return InMemorySaver()


@pytest.fixture
def store() -> InMemoryStore:
    return InMemoryStore()
