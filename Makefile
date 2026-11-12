# One entry point for humans and CI. `make help` lists targets.
.DEFAULT_GOAL := help
UV ?= uv run
PORT ?= 2027

.PHONY: deploy copy-key live help install dev data data-check lint fmt test test-fast ui-test e2e eval check clean

help:  ## show targets
	@grep -E '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-12s %s\n", $$1, $$2}'

install:  ## create the venv
	uv sync

dev:  ## run the game (Studio-compatible). Tracing follows .env (LANGSMITH_TRACING); TRACE=1 forces it on, NOTRACE=1 off. Open http://127.0.0.1:2027/app/
	RESUMABLE_STREAM_TTL_SECONDS=7200 $(if $(TRACE),LANGSMITH_TRACING=true) $(if $(NOTRACE),LANGSMITH_TRACING=false) $(UV) langgraph dev --port $(PORT) --no-browser --no-reload --n-jobs-per-worker 8

dev-reload:  ## like dev, with hot reload
	RESUMABLE_STREAM_TTL_SECONDS=7200 $(if $(TRACE),LANGSMITH_TRACING=true) $(if $(NOTRACE),LANGSMITH_TRACING=false) $(UV) langgraph dev --port $(PORT) --no-browser --n-jobs-per-worker 8

data:  ## regenerate datasets (deterministic)
	$(UV) python -m tragedy.data build

data-check:  ## validate datasets + committed files equal generator output
	$(UV) python -m tragedy.data check --files --werror

lint:  ## ruff
	$(UV) ruff check src tests

fmt:  ## ruff autofix + format
	$(UV) ruff check --fix src tests
	$(UV) ruff format src tests

test-fast:  ## everything except e2e
	$(UV) pytest -m "not e2e and not live" -q

test: test-fast ui-test  ## python + node tests

ui-test:  ## node --test for the pure JS modules
	node --test tests/ui/*.test.mjs

e2e:  ## spawns a real langgraph dev on a free port (offline)
	$(UV) pytest -m e2e -q

copy-key:  ## put a key from .env on the clipboard WITHOUT printing it (make copy-key K=OPENAI_API_KEY), to paste into Studio's LangSmith Chat panel
	@scripts/copy_key.sh $(or $(K),OPENAI_API_KEY)

GCP_PROJECT ?= $(shell gcloud config get-value project 2>/dev/null)
GCP_REGION ?= europe-west2
GCP_SERVICE ?= probably-a-tragedy
deploy:  ## redeploy to Google Cloud Run (public, one instance, OpenAI key from Secret Manager `tragedy-openai-api-key`; see README "Deploy")
	gcloud run deploy $(GCP_SERVICE) --project $(GCP_PROJECT) --region $(GCP_REGION) --source . --allow-unauthenticated \
	  --max-instances 1 --min-instances 0 --memory 1Gi --cpu 1 --cpu-boost --timeout 900 \
	  --set-env-vars TRAGEDY_PUBLIC_BASE_URL=https://$(GCP_SERVICE)-$$(gcloud projects describe $(GCP_PROJECT) --format='value(projectNumber)').$(GCP_REGION).run.app \
	  --set-secrets OPENAI_API_KEY=tragedy-openai-api-key:latest --quiet

live:  ## LIVE, opt-in, costs cents: the game on real OpenAI + tracing into a throwaway LangSmith project
	$(UV) pytest -m live tests/e2e -s -q

eval:  ## engine vs the gold shows (offline)
	$(UV) pytest tests/evals -q

check: lint data-check test e2e  ## what CI runs

clean:
	rm -rf .pytest_cache .ruff_cache .coverage htmlcov .langgraph_api var
