"""The unit tests' shared fixture: the exhibits' check results, computed once per
worker and exhibit.

The cases run the engine's time loops, seconds in all. ``pytest -n auto`` spreads
``test_checks.py``'s cases over the workers, so a fixture computing every exhibit
made each worker that drew one case compute all 35, and ``test_checks_file.py``
all 35 again. Kept by exhibit, a worker computes only the exhibits it draws, and
the file's test reads the same results."""

from __future__ import annotations

from collections.abc import Callable
from functools import cache

import pytest

from staunlabor.domain import checks


@pytest.fixture(scope="session")
def check_results() -> Callable[[str], tuple[checks.Result, ...]]:
    """``checks.results``, each exhibit computed at most once in this worker."""
    return cache(checks.results)
