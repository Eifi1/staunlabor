"""The app still answers what the pages' tests pretend it answers.

`experiments.test.tsx` renders every exhibit against a fake API that answers
from `test-fixtures.json`, so a page test is only as true as that file. Without
this check a change to an exhibit's engine or wire model would leave the pages'
tests checking the old answers, green. So the file is written by
`scripts/write-test-fixtures.py`, and this fails until it is written again.

The course's lessons are tested the same way (`course.test.tsx` and
`course-controls.test.tsx` against `features/course/test-fixtures.json`,
written by `scripts/write-course-fixtures.py`), and held the same way here.
"""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path
from typing import Any

import pytest
from fastapi.routing import APIRoute

from staunlabor.api import course_router
from tests.unit.test_experiments_browser import _differences

pytestmark = pytest.mark.unit

ROOT = Path(__file__).resolve().parents[3]
SCRIPT = ROOT / "scripts" / "write-test-fixtures.py"
COURSE_SCRIPT = ROOT / "scripts" / "write-course-fixtures.py"


def _load(script: Path) -> Any:
    spec = importlib.util.spec_from_file_location(script.stem.replace("-", "_"), script)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope="module")
def writer() -> Any:
    return _load(SCRIPT)


@pytest.fixture(scope="module")
def course_writer() -> Any:
    return _load(COURSE_SCRIPT)


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
    goes, and the defaults name every exhibit that takes a body — or has none to
    take, its page computing in the browser (``UNROUTED``) or fetching what is
    the same for every build (``FETCHED``)."""
    takes_a_body = set(fresh["defaults"]) - {"meter_range_a", "settle_s", *writer.UNROUTED, *writer.FETCHED}
    assert takes_a_body == set(writer.POSTED)
    assert set(fresh) == {"_note", "defaults", "chair", *writer.FETCHED, *writer.POSTED}


def test_the_lessons_fixtures_are_what_the_api_answers_for_their_first_requests(course_writer: Any):
    stored = json.loads(course_writer.TARGET.read_text(encoding="utf-8"))
    differences = _differences(stored, json.loads(course_writer.serialised()))
    assert not differences, (
        "features/course/test-fixtures.json is not what the API answers; run "
        "`cd backend && uv run python ../scripts/write-course-fixtures.py`:\n" + "\n".join(differences[:20])
    )


def test_every_widget_s_route_has_its_answer_in_the_lessons_fixtures(course_writer: Any):
    """A new widget's lesson test needs its answer here; the writer is where it
    goes, and the course's router names every route that takes a body."""
    posted = {
        route.path.removeprefix("/course/") for route in course_router.router.routes if isinstance(route, APIRoute)
    }
    assert posted - {"defaults"} == {route for route, _ in course_writer.REQUESTS.values()}
