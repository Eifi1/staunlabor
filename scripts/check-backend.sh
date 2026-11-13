#!/usr/bin/env bash
#
# The backend part of `npm run check`: lint, format, and the whole suite with
# coverage (the floor is `fail_under` in backend/pyproject.toml) and a JUnit
# report. CI's backend job runs this same script, so a green check here is a
# green backend job there. There is no database: the engine is pure, and the
# API tests run the real app in-process.
set -euo pipefail
cd "$(dirname "$0")/../backend"

uv run ruff check .
uv run ruff format --check .
# junit.xml is what CI's tests-ran guard reads.
uv run pytest -q -n auto --cov=staunlabor --cov-report=term-missing --junitxml=junit.xml "$@"
