"""Write what the API answers for every exhibit's defaults, so the pages' tests
can stand in for the server: `frontend/src/features/experiments/test-fixtures.json`.

`experiments.test.tsx` renders the pages against a fake API that answers from
this file, and reads its figures to check what a page prints. Hand-copied, the
file would go on answering an old model after the engine moved: every page test
green, drawing numbers the server no longer says. So it is written here, through
the app itself — `create_app()`, the routes and their wire models, exactly what
a browser receives — and `tests/unit/test_page_fixtures.py` fails the backend
suite when the app no longer answers what the file holds.

One request per route, each with the body `GET /experiments/defaults` answers
for it, which is what a page sends before anybody touches a slider. Not the
cases the simulations are held to (that is `write-experiments-cases.py`), and
no other input: a test that needs another answer builds it in the test.

Run from `backend/`:

    uv run python ../scripts/write-test-fixtures.py

In-process, over httpx: no server, no network, nothing random.
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path
from typing import Any

from httpx import ASGITransport, AsyncClient, Response

ROOT = Path(__file__).resolve().parents[1]
# `backend/` is not an installed package; the tests find it as their rootdir.
sys.path.insert(0, str(ROOT / "backend"))

from staunlabor.main import create_app  # noqa: E402

TARGET = ROOT / "frontend/src/features/experiments/test-fixtures.json"
API = "/api/v1/experiments"

#: The file's keys, in the file's order: the defaults, then one exhibit's answer
#: each — sent its own part of the defaults, or nothing for the chair, whose
#: route takes no input.
POSTED = ("coil", "sphere", "platform", "race", "elephant", "smoke", "cannon")


def _answer(response: Response) -> Any:
    # A refusal written into the file would be a page test's "engine answer".
    # A 429 cannot happen (nine requests, a budget of ninety), so any status but
    # 200 is the app's fault and stops the write.
    if response.status_code != 200:
        raise SystemExit(
            f"{response.request.method} {response.request.url.path}: {response.status_code} {response.text}"
        )
    return response.json()


async def _ask() -> tuple[Any, dict[str, Any], Any]:
    # The suite's own client (tests/conftest.py): starlette's TestClient warns
    # that its httpx is deprecated.
    async with AsyncClient(transport=ASGITransport(app=create_app()), base_url="http://test") as client:
        defaults = _answer(await client.get(f"{API}/defaults"))
        answers = {name: _answer(await client.post(f"{API}/{name}", json=defaults[name])) for name in POSTED}
        chair = _answer(await client.get(f"{API}/chair"))
    return defaults, answers, chair


def fixtures() -> dict[str, Any]:
    defaults, answers, chair = asyncio.run(_ask())
    return {
        "_note": (
            "Written by `cd backend && uv run python ../scripts/write-test-fixtures.py`: what the API answers "
            "for each exhibit's defaults; the pages' tests read it as the engine's answers. Do not edit by hand."
        ),
        "defaults": defaults,
        "coil": answers["coil"],
        "chair": chair,
        **{name: answers[name] for name in POSTED if name != "coil"},
    }


def serialised() -> str:
    return json.dumps(fixtures(), indent=2, ensure_ascii=False) + "\n"


if __name__ == "__main__":
    TARGET.write_text(serialised(), encoding="utf-8")
    sys.stdout.write(f"wrote {TARGET}\n")
