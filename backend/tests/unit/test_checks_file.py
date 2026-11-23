"""``checks.json``, which the pages read their cases from, is what the engine
and the cases answer now: an engine change that moves a check fails here
until the file is written again (``scripts/write-checks.py``)."""

from __future__ import annotations

import json
from collections.abc import Callable
from typing import Any

import pytest

from staunlabor.domain import checks
from tests.unit.written_files import differences, load_script


@pytest.fixture(scope="module")
def writer() -> Any:
    return load_script("write-checks.py")


def test_the_pages_checks_are_what_the_engine_and_the_cases_answer(
    writer: Any, check_results: Callable[[str], tuple[checks.Result, ...]], monkeypatch: pytest.MonkeyPatch
) -> None:
    # The worker's results, computed once beside test_checks.py's, not a second time.
    monkeypatch.setattr(writer.checks, "results", check_results)
    stored = json.loads(writer.TARGET.read_text(encoding="utf-8"))
    # The file keeps twelve significant digits (write-checks.py's _number).
    found = differences(stored, json.loads(writer.serialised()), rel_tol=1e-9, abs_tol=1e-14)
    assert not found, (
        "checks.json is not what the cases answer; run `cd backend && uv run python ../scripts/write-checks.py`:\n"
        + "\n".join(found[:20])
    )


def test_every_case_in_the_file_is_within_its_tolerance(writer: Any) -> None:
    stored = json.loads(writer.TARGET.read_text(encoding="utf-8"))
    for exhibit, cases in stored.items():
        for case in cases:
            assert case["deviation"] <= case["tolerance"], f"{exhibit}.{case['key']}"
