"""Write what the API answers for every widget of the course as its lesson first
asks, so the lessons' tests can stand in for the server:
`frontend/src/features/course/test-fixtures.json`.

`course.test.tsx` and `course-controls.test.tsx` render the lessons against a
fake API that answers from this file, by route (`"POST /course/tank":
fixtures.tank`). Hand-copied, the file would go on answering an old model after
the engine moved: every lesson test green, drawing numbers the server no longer
says. So it is written here, through the app itself — `create_app()`, the routes
and their wire models, exactly what a browser receives.

One request per route, each with the body its widget sends before anybody
touches a slider (`REQUESTS`: the lessons' own starting values, as
Kurvenschmiede's pages sent them; the two-mass widgets send the rig
`GET /course/defaults` answers). A test that needs another answer builds it in
the test.

The file keeps the shape Kurvenschmiede's `features/dynamics/test-fixtures.json`
had, so the moved tests read it unchanged: a key per widget, `json.dumps(…,
indent=1)`, and every series longer than :data:`KEEP` points thinned to about
that many (every n-th point and the last) and rounded to six decimals, every
other number to nine. A chart test needs the curve's shape, not its 801 points;
the whole answers made a file of some fifty thousand lines.

Run from `backend/`:

    uv run python ../scripts/write-course-fixtures.py [OUTPUT]

`OUTPUT` defaults to the frontend's file. In-process, over httpx: no server, no
network, nothing random (the noisy widgets are seeded).
"""

from __future__ import annotations

import asyncio
import json
import math
import sys
from pathlib import Path
from typing import Any

from httpx import ASGITransport, AsyncClient, Response

ROOT = Path(__file__).resolve().parents[1]
# `backend/` is not an installed package; the tests find it as their rootdir.
sys.path.insert(0, str(ROOT / "backend"))

from staunlabor.main import create_app  # noqa: E402

TARGET = ROOT / "frontend/src/features/course/test-fixtures.json"
API = "/api/v1/course"

#: How many points a long series keeps, about.
KEEP = 30

#: The chain widget's two starting blocks: the measuring shaft of lesson 2
#: behind a 5 Hz filter (the specification's G4), each with the page's
#: `block()` values for the fields its kind does not read.
_BLOCK = {"gain": 1, "time_constant_s": 0.1, "f0_hz": 15.92, "damping": 0.05, "dead_time_s": 0.01}
_CHAIN = [
    {**_BLOCK, "kind": "second_order"},
    {**_BLOCK, "kind": "first_order", "time_constant_s": 1 / (2 * math.pi * 5)},
]

#: The file's keys in the file's order, each with its route and the body its
#: widget starts with. `None` marks where the two-mass rig from the defaults
#: goes.
REQUESTS: dict[str, tuple[str, dict[str, Any]]] = {
    "tank": ("tank", {"inflow_lps": 5, "area_m2": 0.5, "outflow_lps_per_m": 10, "level0_m": 0}),
    "first_order": ("first-order", {"time_constant_s": 4, "start": 20, "final": 80, "at_s": 8}),
    "measurement": ("first-order/measurement", {"seed": 1}),
    "second_order": (
        "second-order",
        {"inertia": 0.05, "stiffness": 500, "damping_coefficient": 0.5, "torque": 10, "excitation_hz": 3},
    ),
    "decay": ("second-order/decay", {"seed": 1}),
    "scalar": ("eigen/scalar", {"rate": -1}),
    "poles": ("eigen/poles", {"f0_hz": 10, "damping": 0.2}),
    "matrix": ("eigen/matrix", {"a11": 0, "a12": 1, "a21": -4, "a22": -1}),
    "laplace": ("laplace", {"time_constant_s": 2, "gain": 1, "step": 3, "start": 0}),
    "chain": ("laplace/chain", {"blocks": _CHAIN, "cursor_hz": 16, "f_min_hz": 0.1, "f_max_hz": 1000}),
    "filter_loop": (
        "laplace/filter-loop",
        {"frequency_hz": 3, "corner_hz": 5, "mode": "torque_only", "friction_nm": 0},
    ),
    "sensor": ("numerics/sensor", {"step_s": 1, "steps": 8}),
    "oscillator": ("numerics/oscillator", {"step_s": 0.001}),
    "stiff": ("numerics/stiff", {"step_s": 0.002}),
    "two_mass": ("two-mass", {"parameters": None, "excitation_hz": 3}),
    "compensation": (
        "two-mass/compensation",
        {
            "parameters": None,
            "excitation_hz": 5,
            "noise_rad": 2e-5,
            "sample_rate_hz": 1000,
            "differentiator": "zero_phase",
            "corner_hz": 30,
        },
    ),
}


def _answer(response: Response) -> Any:
    # A refusal written into the file would be a lesson test's "engine answer".
    # A 429 cannot happen (seventeen requests, a budget of a hundred and eighty), so any
    # status but 200 is the app's fault and stops the write.
    if response.status_code != 200:
        raise SystemExit(
            f"{response.request.method} {response.request.url.path}: {response.status_code} {response.text}"
        )
    return response.json()


async def _ask() -> tuple[Any, dict[str, Any]]:
    # The suite's own client (tests/conftest.py): starlette's TestClient warns
    # that its httpx is deprecated.
    async with AsyncClient(transport=ASGITransport(app=create_app()), base_url="http://test") as client:
        defaults = _answer(await client.get(f"{API}/defaults"))
        answers = {}
        for key, (route, body) in REQUESTS.items():
            sent = {**body, "parameters": defaults["two_mass"]} if "parameters" in body else body
            answers[key] = _answer(await client.post(f"{API}/{route}", json=sent))
    return defaults, answers


def _thinned(value: Any) -> Any:
    """Long series cut to about :data:`KEEP` points, the last always kept, at
    six decimals; every other number at nine."""
    if isinstance(value, dict):
        return {key: _thinned(item) for key, item in value.items()}
    if isinstance(value, list):
        if len(value) > KEEP and all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in value):
            every = math.ceil(len(value) / KEEP)
            kept = value[::every]
            if (len(value) - 1) % every:
                kept.append(value[-1])
            return [round(v, 6) if isinstance(v, float) else v for v in kept]
        return [_thinned(item) for item in value]
    if isinstance(value, float):
        return round(value, 9)
    return value


def fixtures() -> dict[str, Any]:
    defaults, answers = asyncio.run(_ask())
    return _thinned({"defaults": defaults, **answers})


def serialised() -> str:
    return json.dumps(fixtures(), indent=1, ensure_ascii=False) + "\n"


if __name__ == "__main__":
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else TARGET
    target.write_text(serialised(), encoding="utf-8")
    sys.stdout.write(f"wrote {target}\n")
