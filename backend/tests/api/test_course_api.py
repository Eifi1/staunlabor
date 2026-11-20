"""The course over the wire: public, every widget's route answering in its shape,
the engine's refusals as 400s, and the calculation budget it shares with the
exhibits.

Ported with lessons 0–6 from Kurvenschmiede's ``tests/api/test_dynamics_api.py``,
under ``/course`` instead of ``/dynamics``. Its explorer and the simulation
budget its heavy examples spent stayed there, and with them the tests of both."""

from __future__ import annotations

import pytest
from fastapi.routing import APIRoute
from httpx import AsyncClient

from staunlabor.api import course_router, experiments_router
from staunlabor.api.experiments_router import limit_run
from staunlabor.domain.course import exercises
from staunlabor.security import EXPERIMENT_RUNS, PAGE_SETTLE_S

pytestmark = pytest.mark.api

API = "/api/v1/course"


async def test_the_course_needs_no_account(client: AsyncClient):
    response = await client.get(f"{API}/defaults")
    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"two_mass", "exercises", "settle_s"}
    assert [e["key"] for e in body["exercises"]] == [e.key for e in exercises()]
    assert body["settle_s"] == PAGE_SETTLE_S
    response = await client.post(f"{API}/tank", json={"inflow_lps": 5, "area_m2": 0.5, "outflow_lps_per_m": 10})
    assert response.status_code == 200


#: One typical request per widget, and a key its answer must carry.
WIDGETS = [
    ("/tank", {"inflow_lps": 5, "area_m2": 0.5, "outflow_lps_per_m": 10}, "time_constant_s"),
    ("/first-order", {"time_constant_s": 4, "start": 20, "final": 80, "at_s": 8}, "analogies"),
    ("/first-order/measurement", {"seed": 3}, "level_63"),
    ("/second-order", {"inertia": 0.05, "stiffness": 500, "damping_coefficient": 0.5}, "magnification"),
    ("/second-order", {"inertia": 0.05, "f0_hz": 15.9, "damping_ratio": 0.05, "excitation_hz": 3}, "step"),
    ("/second-order/decay", {"seed": 7}, "pairs"),
    ("/eigen/scalar", {"rate": -1.5}, "time_constant_s"),
    ("/eigen/poles", {"f0_hz": 10, "damping": 0.2}, "poles"),
    ("/eigen/poles", {"real": -5, "imag": 40}, "f0_hz"),
    ("/eigen/matrix", {"a11": 0, "a12": 1, "a21": -4, "a22": -1}, "trajectories"),
    ("/laplace", {"time_constant_s": 2, "gain": 1, "step": 3}, "residue_pole"),
    (
        "/laplace/chain",
        {
            "blocks": [{"kind": "first_order", "time_constant_s": 0.1}, {"kind": "dead_time", "dead_time_s": 0.02}],
            "cursor_hz": 3,
        },
        "cursor",
    ),
    ("/laplace/filter-loop", {"frequency_hz": 3, "corner_hz": 5, "mode": "torque_only"}, "apparent_hysteresis"),
    ("/numerics/sensor", {"step_s": 1, "steps": 2}, "rk4_steps"),
    ("/numerics/oscillator", {"step_s": 0.001}, "runs"),
    ("/numerics/stiff", {"step_s": 0.5}, "rk4_min_steps"),
    ("/two-mass", {"parameters": {}, "excitation_hz": 3}, "modes"),
    (
        "/two-mass/compensation",
        {
            "parameters": {},
            "excitation_hz": 3,
            "noise_rad": 1e-5,
            "sample_rate_hz": 1000,
            "differentiator": "zero_phase",
            "corner_hz": 30,
        },
        "compensated_error",
    ),
]


@pytest.mark.parametrize(("path", "payload", "key"), WIDGETS, ids=[f"{p} {k}" for p, _, k in WIDGETS])
async def test_every_widget_answers_in_its_shape(client: AsyncClient, path: str, payload: dict, key: str):
    response = await client.post(API + path, json=payload)
    assert response.status_code == 200, response.text
    assert key in response.json()


async def test_a_complex_number_travels_as_its_two_parts(client: AsyncClient):
    body = (await client.post(f"{API}/eigen/poles", json={"f0_hz": 10, "damping": 0.2})).json()
    first = body["poles"][0]
    assert set(first) == {"re", "im"}
    assert first["re"] < 0 < first["im"]


async def test_a_dragged_pole_is_held_to_what_the_slider_allows(client: AsyncClient):
    body = (await client.post(f"{API}/eigen/poles", json={"real": 500, "imag": 1})).json()
    assert body["damping"] == -0.3


@pytest.mark.parametrize(
    ("path", "payload"),
    [
        ("/numerics/oscillator", {"step_s": 0.01}),
        ("/numerics/stiff", {"step_s": 1e-4}),
        (
            "/two-mass/compensation",
            {
                "parameters": {},
                "excitation_hz": 0.01,
                "noise_rad": 0,
                "sample_rate_hz": 20_000,
                "differentiator": "none",
                "corner_hz": 30,
            },
        ),
    ],
)
async def test_what_the_engine_refuses_is_a_400_with_its_sentence(client: AsyncClient, path: str, payload: dict):
    response = await client.post(API + path, json=payload)
    assert response.status_code == 400
    assert isinstance(response.json()["detail"], str)


async def test_an_undamped_shaft_driven_at_resonance_is_answered_without_a_reading(client: AsyncClient):
    response = await client.post(
        f"{API}/second-order", json={"inertia": 1, "f0_hz": 2, "damping_ratio": 0, "excitation_hz": 2}
    )
    assert response.status_code == 200
    assert response.json()["magnification"]["excitation_value"] is None


@pytest.mark.parametrize(
    ("path", "payload"),
    [
        ("/second-order", {"inertia": 0.05}),
        (
            "/second-order",
            {"inertia": 0.05, "stiffness": 500, "damping_coefficient": 1, "f0_hz": 3, "damping_ratio": 0.1},
        ),
        ("/eigen/poles", {"f0_hz": 10}),
        ("/laplace/chain", {"blocks": [{"kind": "proportional"}] * 5, "cursor_hz": 1}),
        ("/tank", {"inflow_lps": 5, "area_m2": 0.5, "outflow_lps_per_m": 10, "colour": "red"}),
    ],
)
async def test_what_the_schema_refuses_is_a_422(client: AsyncClient, path: str, payload: dict):
    assert (await client.post(API + path, json=payload)).status_code == 422


@pytest.mark.parametrize(
    "path", ["/reduction", "/reduction/eps", "/worm-rig/stiffness", "/vacuum/pump-down", "/examples/sensor", "/valve"]
)
async def test_lessons_7_to_10_and_the_explorer_stayed_in_kurvenschmiede(client: AsyncClient, path: str):
    """No route of theirs came along: one left behind would be public CPU that
    no page here asks for."""
    assert (await client.post(API + path, json={})).status_code in {404, 405}


async def test_a_reader_dragging_a_slider_never_runs_out(client: AsyncClient):
    """The page re-runs a widget when a slider has held still for
    ``PAGE_SETTLE_S``; one window of that metronome must all be answered."""
    metronome = 1 + int(EXPERIMENT_RUNS.window_seconds / PAGE_SETTLE_S)
    answered = [(await client.post(f"{API}/eigen/scalar", json={"rate": -1})).status_code for _ in range(metronome)]
    assert answered == [200] * metronome


async def test_the_course_and_the_exhibits_spend_one_budget(client: AsyncClient):
    """An address that has spent the window on lessons has spent it on
    exhibits too, so two kinds of page buy it no more computing."""
    # A question each, never asked before: a kept answer would cost nothing.
    allowed = [
        (await client.post(f"{API}/eigen/scalar", json={"rate": -1 - i / 1000})).status_code
        for i in range(EXPERIMENT_RUNS.max_hits)
    ]
    assert allowed == [200] * EXPERIMENT_RUNS.max_hits
    refused = await client.post("/api/v1/experiments/sphere", json={})
    assert refused.status_code == 429
    assert "Try again in" in refused.json()["detail"]
    assert (
        await client.post(f"{API}/tank", json={"inflow_lps": 1, "area_m2": 1, "outflow_lps_per_m": 1})
    ).status_code == 429
    # The defaults are free: they spend nothing of the budget.
    assert (await client.get(f"{API}/defaults")).status_code == 200


def test_every_calculation_route_spends_the_budget():
    """Every route of the course's router and the exhibits' but the two
    ``/defaults`` depends on ``limit_run``: a widget added without it would be
    the one route a script could call without limit. Read off the routers
    themselves, so a new route is in this check the moment it exists."""
    routes = [
        route
        for module in (course_router, experiments_router)
        for route in module.router.routes
        if isinstance(route, APIRoute)
    ]
    unbudgeted = sorted(
        route.path
        for route in routes
        if not route.path.endswith("/defaults") and limit_run not in {dep.call for dep in route.dependant.dependencies}
    )
    assert unbudgeted == []
    assert len([r for r in routes if r.path.startswith("/course/")]) == 17
