# Probably a Tragedy on Cloud Run: the same `langgraph dev` server the game runs on locally (nine graphs + the custom FastAPI routes and the SPA).
# State (tours, threads) lives in memory and an ephemeral disk, so the service is pinned to ONE instance; a restart starts a fresh theatre.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 UV_LINK_MODE=copy UV_COMPILE_BYTECODE=1
RUN pip install --no-cache-dir uv

WORKDIR /app
# dependencies first (cached layer); the project installs editable, so src/ stays at /app/src and datasets/ resolves from there
COPY pyproject.toml uv.lock README.md ./
COPY src ./src
RUN uv sync --frozen --no-dev
COPY datasets ./datasets
COPY langgraph.json ./

ENV PATH="/app/.venv/bin:$PATH" \
    TRAGEDY_PROVIDER=openai \
    LANGSMITH_TRACING=false \
    LANGCHAIN_TRACING_V2=false \
    RESUMABLE_STREAM_TTL_SECONDS=7200

# OPENAI_API_KEY and TRAGEDY_PUBLIC_BASE_URL come from the service's secrets / env, never from the image.
CMD ["sh", "-c", "exec langgraph dev --host 0.0.0.0 --port ${PORT:-8080} --no-browser --no-reload --n-jobs-per-worker 8"]
