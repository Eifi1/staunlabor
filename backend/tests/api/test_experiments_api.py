"""The experiments over the wire: public, each exhibit's route answering in its
shape with the engine's numbers, the engine's refusals as 400s, and the budget.

The time simulations have no route — the browser runs them — so nothing
here runs a ball or a car; ``tests/unit/test_experiments_browser.py`` holds the
port to the engine instead."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from staunlabor.domain import experiments as x

pytestmark = pytest.mark.api

API = "/api/v1/experiments"


async def test_the_experiments_need_no_account(client: AsyncClient):
    response = await client.get(f"{API}/defaults")
    assert response.status_code == 200
    body = response.json()
    assert set(body) == {
        "sphere",
        "coil",
        "platform",
        "race",
        "elephant",
        "smoke",
        "cannon",
        "meter_range_a",
        "settle_s",
    }
    assert [ball["diameter_m"] for ball in body["cannon"]["balls"]] == [0.10, 0.07, 0.05]
    assert body["elephant"]["ball"]["diameter_m"] == x.FloatingBall().diameter_m
    assert body["platform"]["body"]["mass_kg"] == x.Body().mass_kg
    assert body["sphere"]["shell_radius_m"] == x.Sphere().shell_radius_m
    assert body["coil"]["coil"]["turns"] == x.Coil().turns
    assert body["coil"]["idle"] == "closed"
    assert body["meter_range_a"] == 0.1


async def test_the_sphere_answers_its_orbits_and_its_swing(client: AsyncClient):
    response = await client.post(f"{API}/sphere", json={})
    assert response.status_code == 200
    body = response.json()
    assert body["lowest_orbit_hz"] == pytest.approx(x.lowest_orbit_hz(x.Sphere()))
    assert body["gravity_share"] == pytest.approx(5 / 7)
    assert len(body["backbone"]) == 89
    assert body["backbone"][0]["angle_deg"] == 0.0
    rates = [o["rate_hz"] for o in body["backbone"]]
    assert rates == sorted(rates), "every orbit higher up is a faster one"
    swing = [p["rate_hz"] for p in body["swing"]]
    assert swing == sorted(swing, reverse=True), "and every wider swing a slower one"


async def test_a_hollow_ball_is_answered_with_its_own_share(client: AsyncClient):
    body = (await client.post(f"{API}/sphere", json={"ball": "hollow"})).json()
    assert body["gravity_share"] == pytest.approx(3 / 5)


async def test_the_coil_answers_its_figures_and_its_curve(client: AsyncClient):
    response = await client.post(f"{API}/coil", json={})
    assert response.status_code == 200
    body = response.json()
    fig = x.figures(x.CoilExhibit())
    assert body["figures"]["full_current_a"] == pytest.approx(fig.full_current_a)
    assert body["figures"]["peak_coupling_v_s_per_m"] == pytest.approx(fig.peak_coupling_v_s_per_m)
    curve = body["curve"]
    assert len(curve["x_m"]) == len(curve["flux_wb"]) == len(curve["coupling_v_s_per_m"]) == 241
    middle = len(curve["x_m"]) // 2
    assert curve["x_m"][middle] == pytest.approx(0.0, abs=1e-12)
    assert max(curve["flux_wb"]) == curve["flux_wb"][middle]


async def test_a_changed_build_changes_the_answer(client: AsyncClient):
    half = await client.post(f"{API}/coil", json={"supply_v": 4.5})
    assert half.json()["figures"]["full_current_a"] == pytest.approx(4.5 / 94.0)


async def test_the_chair_answers_three_boxes_with_one_picture(client: AsyncClient):
    response = await client.get(f"{API}/chair")
    assert response.status_code == 200
    body = response.json()
    assert [b["figure"]["kind"] for b in body["boxes"]] == ["chair", "skewed", "scattered"]
    assert all(len(b["figure"]["segments"]) == 12 for b in body["boxes"])
    assert all(len(b["sight_lines"]) == 12 for b in body["boxes"])
    assert body["joint_count"] == 20
    assert body["tolerance_m"] == pytest.approx(1.62e-4, rel=0.01)
    # Every line of sight starts at the hole.
    assert all(line["a"] == [0.0, 0.0, 0.0] for b in body["boxes"] for line in b["sight_lines"])


async def test_the_ball_cannon_answers_how_high_one_two_and_three_balls_send_the_top_one(client: AsyncClient):
    response = await client.post(f"{API}/cannon", json={})
    assert response.status_code == 200, response.text
    body = response.json()
    assert [launch["balls"] for launch in body["launches"]] == [1, 2, 3]
    assert body["launches"][2]["times_drop"] == pytest.approx(2.205, abs=1e-3)
    assert {c["contact"] for c in body["contacts"]} == {0, 1, 2}
    assert len(body["impact"]["force_n"]) == 3
    two = await client.post(f"{API}/cannon", json={"balls": [{"diameter_m": 0.10}, {"diameter_m": 0.05}]})
    assert [launch["balls"] for launch in two.json()["launches"]] == [1, 2]


async def test_what_the_engine_refuses_is_a_400(client: AsyncClient):
    """Each field in its bounds, the two together not an exhibit."""
    too_big = await client.post(f"{API}/sphere", json={"shell_radius_m": 0.1, "ball_radius_m": 0.15})
    assert too_big.status_code == 400
    long_coil = await client.post(f"{API}/coil", json={"coil": {"length_m": 0.25}})
    assert long_coil.status_code == 400
    narrow_ball = await client.post(f"{API}/elephant", json={"jet": {"opening_m": 0.2}})
    assert narrow_ball.status_code == 400
    hole_past_ring = await client.post(f"{API}/smoke", json={"drum": {"hole_m": 0.5}})
    assert hole_past_ring.status_code == 400


@pytest.mark.parametrize(
    ("path", "payload"),
    [
        ("/sphere", {"shell_radius_m": 5}),
        ("/sphere", {"ball": "glass"}),
        ("/coil", {"supply_v": 230}),
        ("/coil", {"idle": "sometimes"}),
        ("/coil", {"coil": {"turns": 0}}),
        ("/coil", {"colour": "red"}),
        ("/elephant", {"jet": {"speed_m_s": 0}}),
        ("/elephant", {"ball": {"mass_kg": 2}}),
        ("/elephant", {"coanda": -1}),
        ("/smoke", {"room": {"draught_m_s": -1}}),
        ("/smoke", {"drum": {"diameter_m": 10}}),
        ("/cannon", {"balls": []}),
        ("/cannon", {"balls": [{"diameter_m": 0.1}] * 4}),
        ("/cannon", {"ball_restitution": 1.5}),
        ("/cannon", {"youngs_mpa": 0}),
        ("/cannon", {"drop_m": 10}),
    ],
)
async def test_what_the_schema_refuses_is_a_422(client: AsyncClient, path: str, payload: dict):
    assert (await client.post(API + path, json=payload)).status_code == 422


async def test_the_budget_runs_out_and_says_when_to_come_back(client: AsyncClient):
    from staunlabor.security import EXPERIMENT_RUNS

    allowed = [(await client.post(f"{API}/sphere", json={})).status_code for _ in range(EXPERIMENT_RUNS.max_hits)]
    refused = await client.get(f"{API}/chair")
    assert allowed == [200] * EXPERIMENT_RUNS.max_hits
    assert refused.status_code == 429
    assert "Try again in" in refused.json()["detail"]
    # The defaults are free: they spend nothing of the budget.
    assert (await client.get(f"{API}/defaults")).status_code == 200


async def test_the_platform_answers_its_spins_and_curves(client: AsyncClient):
    response = await client.post(f"{API}/platform", json={})
    assert response.status_code == 200
    body = response.json()
    fig = x.platform_figures(x.Body(), x.Platform())
    assert body["speed_ratio"] == pytest.approx(fig.speed_ratio)
    assert body["leaning"]["rev_per_s"] == pytest.approx(0.5)
    assert body["upright"]["pull_n"] == 0.0
    assert len(body["lean_curve"]) == 21
    assert body["stops_after_s"] == pytest.approx(fig.stops_after_s)


async def test_a_platform_without_friction_never_stops(client: AsyncClient):
    body = (await client.post(f"{API}/platform", json={"platform": {"friction_n_m": 0}})).json()
    assert body["stops_after_s"] is None


async def test_the_platform_refuses_what_is_out_of_bounds(client: AsyncClient):
    """The wire's bounds keep the arms and the trunk lighter than the body
    (at most 2 × 0.1 + 0.7), so the engine's own refusal is never reached here."""
    for payload in ({"body": {"arm_share": 0.3}}, {"body": {"mass_kg": 500}}, {"platform": {"radius_m": 0}}):
        assert (await client.post(f"{API}/platform", json=payload)).status_code == 422


async def test_the_race_answers_six_tracks_and_the_valley(client: AsyncClient):
    response = await client.post(f"{API}/race", json={})
    assert response.status_code == 200
    body = response.json()
    kinds = [t["kind"] for t in body["race"]["tracks"]]
    assert kinds == ["line", "cycloid", "circle", "parabola", "hyperbola", "hump"]
    fastest = min(body["race"]["tracks"], key=lambda t: t["time_s"])
    assert fastest["kind"] == "cycloid"
    assert body["race"]["cycloid_dips"] is True
    assert len(body["valley"]["starts"]) == 4
    assert all(abs(s["cycloid_time_s"] / body["valley"]["tautochrone_s"] - 1) < 1e-6 for s in body["valley"]["starts"])


async def test_a_sliding_block_is_faster_than_a_rolling_ball(client: AsyncClient):
    rolling = (await client.post(f"{API}/race", json={})).json()["race"]["tracks"][1]["time_s"]
    sliding = (await client.post(f"{API}/race", json={"ball": "sliding"})).json()["race"]["tracks"][1]["time_s"]
    assert rolling / sliding == pytest.approx((7 / 5) ** 0.5, rel=1e-9)


async def test_the_race_refuses_a_finish_out_of_reach(client: AsyncClient):
    assert (await client.post(f"{API}/race", json={"drop_m": 0.1, "run_m": 2.0})).status_code == 400
    assert (await client.post(f"{API}/race", json={"drop_m": 5})).status_code == 422


async def test_the_elephant_answers_where_its_ball_floats_and_the_tilt_it_falls_at(client: AsyncClient):
    response = await client.post(f"{API}/elephant", json={})
    assert response.status_code == 200
    body = response.json()
    figures = x.elephant_figures(x.Elephant())
    assert body["float_height_m"] == pytest.approx(figures.float_height_m)
    assert body["tilt_limit_deg"] == pytest.approx(figures.tilt_limit_deg)
    assert len(body["lift_curve"]) == 41
    assert body["side_curve"][0]["side_n"] == pytest.approx(0.0, abs=1e-12)
    assert body["tilt_curve"][0] == {"tilt_deg": 0.0, "height_m": figures.float_height_m, "offset_m": 0.0}


async def test_a_ball_the_air_cannot_lift_is_answered_with_nothing_to_float_at(client: AsyncClient):
    body = (await client.post(f"{API}/elephant", json={"jet": {"speed_m_s": 8}})).json()
    assert body["float_height_m"] is None
    assert body["tilt_limit_deg"] is None
    assert body["lift_off_m_s"] > 8
    assert body["side_curve"] == [] and body["tilt_curve"] == []


async def test_the_smoke_ring_answers_the_window_a_press_makes_a_ring_in(client: AsyncClient):
    response = await client.post(f"{API}/smoke", json={})
    assert response.status_code == 200
    body = response.json()
    figures = x.smoke_figures(x.SmokeExhibit())
    assert body["fastest_s"] == pytest.approx(figures.fastest_s)
    assert body["slowest_s"] == pytest.approx(figures.slowest_s)
    assert body["best"]["verdict"] == "ring"
    assert {p["verdict"] for p in body["presses"]} == {"too_fast", "ring", "too_slow"}


async def test_a_turbulence_threshold_below_every_ring_leaves_no_window(client: AsyncClient):
    body = (await client.post(f"{API}/smoke", json={"room": {"turbulent_reynolds": 1000}})).json()
    assert body["best_s"] is None and body["best"] is None
