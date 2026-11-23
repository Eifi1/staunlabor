"""``checks.json``, which the pages read their cases from, is what the engine
and the cases answer now: an engine change that moves a check fails here
until the file is written again (``scripts/write-checks.py``)."""

from __future__ import annotations

import json
import math
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
    fresh = json.loads(writer.serialised())
    # The margin is a peak search's, not the last bit's: a golden-section
    # search finds a maximum only to some √ε ≈ 1.5e-8 of its place, the curve
    # being flat there, and CI's libm moved the string's searched pull by
    # 1e-9 relatively (PR #9). 1e-7 holds that with room; an engine change
    # that matters moves a check far more.
    margin = 1e-7
    # A deviation is |measured − expected| / |expected|, a small difference of
    # two near numbers: it carries the measured value's relative error as an
    # absolute one, so it is held absolutely, to the same margin.
    found = []
    for exhibit in sorted(stored.keys() & fresh.keys()):
        for i, (a, b) in enumerate(zip(stored[exhibit], fresh[exhibit], strict=False)):
            was, now = a.pop("deviation"), b.pop("deviation")
            if not math.isclose(was, now, rel_tol=0, abs_tol=margin):
                found.append(f".{exhibit}[{i}].deviation: {was!r} in the file, {now!r} now")
    # The file keeps twelve significant digits (write-checks.py's _number).
    found += differences(stored, fresh, rel_tol=margin, abs_tol=1e-14)
    assert not found, (
        "checks.json is not what the cases answer; run `cd backend && uv run python ../scripts/write-checks.py`:\n"
        + "\n".join(found[:20])
    )


def test_every_case_in_the_file_is_within_its_tolerance(writer: Any) -> None:
    stored = json.loads(writer.TARGET.read_text(encoding="utf-8"))
    for exhibit, cases in stored.items():
        for case in cases:
            assert case["deviation"] <= case["tolerance"], f"{exhibit}.{case['key']}"
