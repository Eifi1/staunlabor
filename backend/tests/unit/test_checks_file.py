"""``checks.json``, which the pages read their cases from, is what the engine
and the cases answer now: an engine change that moves a check fails here
until the file is written again (``scripts/write-checks.py``)."""

from __future__ import annotations

import importlib.util
import json
import math
from pathlib import Path
from typing import Any

import pytest

SCRIPT = Path(__file__).resolve().parents[3] / "scripts" / "write-checks.py"


@pytest.fixture(scope="module")
def writer() -> Any:
    spec = importlib.util.spec_from_file_location("write_checks", SCRIPT)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _same(stored: Any, fresh: Any) -> bool:
    if isinstance(stored, float) and isinstance(fresh, float):
        return math.isclose(stored, fresh, rel_tol=1e-9, abs_tol=1e-14)
    if isinstance(stored, dict) and isinstance(fresh, dict):
        return stored.keys() == fresh.keys() and all(_same(stored[k], fresh[k]) for k in stored)
    if isinstance(stored, list) and isinstance(fresh, list):
        return len(stored) == len(fresh) and all(_same(a, b) for a, b in zip(stored, fresh, strict=True))
    return stored == fresh


def test_the_pages_checks_are_what_the_engine_and_the_cases_answer(writer: Any) -> None:
    stored = json.loads(writer.TARGET.read_text(encoding="utf-8"))
    fresh = json.loads(writer.serialised())
    assert _same(stored, fresh), (
        "checks.json is not what the cases answer; run `cd backend && uv run python ../scripts/write-checks.py`"
    )


def test_every_case_in_the_file_is_within_its_tolerance(writer: Any) -> None:
    stored = json.loads(writer.TARGET.read_text(encoding="utf-8"))
    for exhibit, cases in stored.items():
        for case in cases:
            assert case["deviation"] <= case["tolerance"], f"{exhibit}.{case['key']}"
