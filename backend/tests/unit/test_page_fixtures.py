"""The app still answers what the pages' tests pretend it answers.

`experiments.test.tsx` renders every exhibit against a fake API that answers
from `test-fixtures.json`, so a page test is only as true as that file. Without
this check a change to an exhibit's engine or wire model would leave the pages'
tests checking the old answers, green. So the file is written by
`scripts/write-test-fixtures.py`, and this fails until it is written again.
"""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path
from typing import Any

import pytest

from tests.unit.test_experiments_browser import _differences

pytestmark = pytest.mark.unit

ROOT = Path(__file__).resolve().parents[3]
SCRIPT = ROOT / "scripts" / "write-test-fixtures.py"


@pytest.fixture(scope="module")
def writer() -> Any:
    spec = importlib.util.spec_from_file_location("write_test_fixtures", SCRIPT)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope="module")
def fresh(writer: Any) -> Any:
    # The elephant, the smoke ring and the cannon take up to 200 ms each: ask once.
    return json.loads(writer.serialised())


def test_the_pages_fixtures_are_what_the_api_answers_for_the_defaults(writer: Any, fresh: Any):
    stored = json.loads(writer.TARGET.read_text(encoding="utf-8"))
    differences = _differences(stored, fresh)
    assert not differences, (
        "test-fixtures.json is not what the API answers; run "
        "`cd backend && uv run python ../scripts/write-test-fixtures.py`:\n" + "\n".join(differences[:20])
    )


def test_every_exhibit_s_route_has_its_answer_in_the_fixtures(writer: Any, fresh: Any):
    """A new exhibit's page test needs its answer here; the writer is where it
    goes, and the defaults name every exhibit that takes a body."""
    takes_a_body = set(fresh["defaults"]) - {"meter_range_a", "settle_s"}
    assert takes_a_body == set(writer.POSTED)
    assert set(fresh) == {"_note", "defaults", "chair", *writer.POSTED}
