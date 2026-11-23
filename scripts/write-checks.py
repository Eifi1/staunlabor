"""The exhibits' checks as the pages show them: every case computed, with its
sources, into ``frontend/src/features/experiments/checks.json``.

The cases' runs take seconds (a swing timed over six periods, a car run for
twenty), too dear for a public route; a page reads them from this file, which
``backend/tests/unit/test_checks_file.py`` holds to the engine. Run it after a
change to an engine module with checks or to its cases:

    cd backend && uv run python ../scripts/write-checks.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
# `backend/` is not an installed package; the tests find it as their rootdir.
sys.path.insert(0, str(ROOT / "backend"))

from staunlabor.domain import checks  # noqa: E402

TARGET = ROOT / "frontend" / "src" / "features" / "experiments" / "checks.json"


def _number(x: float) -> float:
    """Twelve significant digits: what a page shows is four, and a rerun on
    another machine must not change the file in its last bits."""
    return float(f"{x:.12g}")


def everything() -> dict[str, Any]:
    out: dict[str, Any] = {}
    for exhibit in checks.exhibits():
        out[exhibit] = [
            {
                "key": r.key,
                "unit": r.unit,
                "expected": _number(r.expected),
                "measured": _number(r.measured),
                "deviation": _number(r.deviation),
                "tolerance": r.tolerance,
                "derived": r.derived,
                "setting": dict(r.setting),
                "sources": [{"cite": s.cite, "url": s.url, "quote": s.quote} for s in r.sources],
            }
            for r in checks.results(exhibit)
        ]
    return out


def serialised() -> str:
    return json.dumps(everything(), indent=1, ensure_ascii=False) + "\n"


if __name__ == "__main__":
    TARGET.write_text(serialised(), encoding="utf-8")
    print(f"wrote {TARGET.relative_to(ROOT)}")
