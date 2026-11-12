"""Spawn a REAL `langgraph dev` (what Studio and the SPA talk to) once per session, offline, on a free port."""

from __future__ import annotations

import os
import shutil
import socket
import subprocess
import sys
import time
from pathlib import Path

import httpx
import pytest

ROOT = Path(__file__).resolve().parents[2]


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def spawn_server(tmp_path_factory, name: str, env_overrides: dict[str, str]):
    """Start a REAL `langgraph dev` in a throwaway cwd; yields its base URL; asserts no blocking IO was logged."""
    port = _free_port()
    work = tmp_path_factory.mktemp(name)
    (work / "src").symlink_to(ROOT / "src", target_is_directory=True)
    shutil.copy(ROOT / "langgraph.json", work / "langgraph.json")
    log = work / "server.log"
    exe = Path(sys.executable).with_name("langgraph")
    env = {
        **os.environ,
        "TRAGEDY_PROVIDER": "offline",
        "TRAGEDY_OFFLINE_TOKEN_DELAY_S": "0.0",
        "TRAGEDY_PUBLIC_BASE_URL": f"http://127.0.0.1:{port}",
        "ANTHROPIC_API_KEY": "",
        "LANGSMITH_API_KEY": "",  # no tracing credentials in test servers: nothing is ever traced
        "LANGSMITH_TRACING": "false",
        "LANGCHAIN_TRACING_V2": "false",
        "NO_COLOR": "1",
        **env_overrides,
    }
    with log.open("wb") as lf:
        proc = subprocess.Popen(
            [str(exe), "dev", "--no-browser", "--no-reload", "--n-jobs-per-worker", "4", "--port", str(port), "--config", "langgraph.json"],
            cwd=work, env=env, stdout=lf, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL,
        )
    base = f"http://127.0.0.1:{port}"
    try:
        for _ in range(90):
            if proc.poll() is not None:
                pytest.fail(f"server exited early (rc={proc.returncode}):\n{log.read_text()[-3000:]}")
            try:
                if httpx.get(f"{base}/ok", timeout=2).status_code == 200:
                    break
            except httpx.HTTPError:
                time.sleep(1)
        else:
            pytest.fail(f"server not ready:\n{log.read_text()[-3000:]}")
        yield base
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=15)
        except subprocess.TimeoutExpired:
            proc.kill()
        text = log.read_text(errors="replace")
        assert "BlockingError" not in text and "Blocking call" not in text, "blocking IO on the server event loop:\n" + text[-3000:]


@pytest.fixture(scope="session")
def dev_server(tmp_path_factory):
    yield from spawn_server(tmp_path_factory, "e2e", {})


@pytest.fixture(scope="session")
def openai_server(tmp_path_factory):
    """A server whose puppets are voiced by a REAL OpenAI model (opt-in: `pytest -m live`, needs OPENAI_API_KEY)."""
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        pytest.skip("OPENAI_API_KEY not set")
    yield from spawn_server(tmp_path_factory, "live-openai", {"TRAGEDY_PROVIDER": "openai", "OPENAI_API_KEY": key})


@pytest.fixture(scope="session")
def tracing_server(tmp_path_factory):
    """A server with LangSmith tracing ON, into a throwaway project, inputs/outputs hidden (opt-in: `pytest -m live`)."""
    key = os.environ.get("LANGSMITH_API_KEY")
    if not key:
        pytest.skip("LANGSMITH_API_KEY not set")
    yield from spawn_server(
        tmp_path_factory,
        "live-tracing",
        {
            "LANGSMITH_API_KEY": key, "LANGSMITH_TRACING": "true", "LANGCHAIN_TRACING_V2": "true",
            "LANGSMITH_PROJECT": os.environ.get("TRAGEDY_TRACE_VERIFY_PROJECT", "probably-a-tragedy-verify"),
            "LANGSMITH_HIDE_INPUTS": "true", "LANGSMITH_HIDE_OUTPUTS": "true",  # structure + metadata only, no game text
        },
    )


@pytest.fixture(scope="session")
def anthropic_server(tmp_path_factory):
    """A server whose puppets are voiced by REAL Claude (opt-in: `pytest -m live`, needs ANTHROPIC_API_KEY)."""
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        pytest.skip("ANTHROPIC_API_KEY not set")
    extra = {k: os.environ[k] for k in ("ANTHROPIC_WORKSPACE_ID", "ANTHROPIC_BASE_URL") if os.environ.get(k)}
    yield from spawn_server(tmp_path_factory, "live-anthropic", {"TRAGEDY_PROVIDER": "anthropic", "ANTHROPIC_API_KEY": key, **extra})
