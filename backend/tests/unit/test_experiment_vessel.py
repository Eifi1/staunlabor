"""The draining vessel's engine against what its page says.

Every figure in the page's prose is asserted here; the stepped level is held to
the closed form for one hole and, with all holes open, to the tests' own
Runge–Kutta (``tests/unit/ode.py``); the jets to the throw they are.
"""

from __future__ import annotations

import itertools
import json
import math
from dataclasses import replace

import pytest

from staunlabor.domain.experiments import vessel as v
from staunlabor.domain.experiments.constants import G
from tests.unit.ode import rk4
from tests.unit.written_files import load_script

pytestmark = pytest.mark.unit

TUBE = v.DrainingVessel()
LOWEST = (True, False, False)
ALL = (True, True, True)


def _drain(vessel: v.DrainingVessel, opened: tuple[bool, ...]) -> tuple[int, float]:
    """Steps of the page until the level stops at the lowest open hole."""
    level, steps = vessel.fill_m, 0
    while level > min(y for y, o in zip(vessel.holes_m, opened, strict=True) if o):
        level = v.step(vessel, level, opened, v.STEP_S)
        steps += 1
    return steps, level


def test_the_exhibit_is_a_metre_tube_8_cm_wide_filled_to_90_cm_with_holes_at_5_35_and_65_cm():
    assert TUBE.height_m == 1.0 and TUBE.diameter_m == 0.08 and TUBE.fill_m == 0.9
    assert TUBE.holes_m == (0.05, 0.35, 0.65)
    assert TUBE.hole_diameter_m == 0.008 and TUBE.discharge == 0.61 and TUBE.stand_m == 0.2


def test_the_bottom_hole_alone_empties_the_tube_in_68_s_and_half_the_depth_is_gone_after_20_s():
    f = v.figures(TUBE)
    assert round(f.drain_s) == 68
    assert f.drain_s == pytest.approx(68.25, abs=0.005)
    assert round(f.half_s) == 20
    assert f.half_s == pytest.approx(19.99, abs=0.005)
    assert round(100 * f.half_s / f.drain_s) == 29
    assert pytest.approx(1 - 1 / math.sqrt(2), rel=1e-15) == v.HALF_SHARE


def test_the_last_tenth_of_the_water_takes_32_percent_of_the_time():
    head = TUBE.fill_m - TUBE.holes_m[0]
    tenth = v.figures(TUBE).drain_s - _time_to_depth(TUBE, head / 10)
    assert round(100 * tenth / v.figures(TUBE).drain_s) == 32
    assert tenth / v.figures(TUBE).drain_s == pytest.approx(math.sqrt(0.1), rel=1e-12)


def _time_to_depth(vessel: v.DrainingVessel, depth_m: float) -> float:
    """By bisection on the closed form: when the depth over the lowest hole is ``depth_m``."""
    lo, hi = 0.0, v.drain_time_s(vessel, vessel.holes_m[0])
    for _ in range(200):
        mid = (lo + hi) / 2
        if v.level_exact(vessel, vessel.holes_m[0], mid) - vessel.holes_m[0] > depth_m:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def test_with_all_three_holes_open_the_tube_is_down_to_the_bottom_hole_after_57_s():
    steps, level = _drain(TUBE, ALL)
    assert level == TUBE.holes_m[0]
    assert round(steps * v.STEP_S) == 57
    assert steps * v.STEP_S < v.figures(TUBE).drain_s


def test_the_first_jet_leaves_at_4_1_m_s_with_7_5_litres_a_minute_and_lands_0_92_m_away():
    f = v.figures(TUBE)
    assert round(f.speed_m_s, 1) == 4.1
    assert f.speed_m_s == pytest.approx(math.sqrt(2 * G * 0.85), rel=1e-15)
    assert round(f.outflow_l_min, 1) == 7.5
    assert round(f.ranges_m[0], 2) == 0.92
    assert round(f.volume_l, 2) == 4.27


def test_the_jet_shortens_at_a_steady_pace_and_lands_at_0_46_m_after_half_the_time_34_s():
    f = v.figures(TUBE)
    half_time = f.drain_s / 2
    assert round(half_time) == 34
    at_half = v.jet_range_m(TUBE, v.level_exact(TUBE, 0.05, half_time), 0.05)
    assert round(at_half, 2) == 0.46
    assert at_half == pytest.approx(f.ranges_m[0] / 2, rel=1e-12)
    # Linear in time: equal drops in equal times all the way.
    ranges = [v.jet_range_m(TUBE, v.level_exact(TUBE, 0.05, f.drain_s * k / 10), 0.05) for k in range(11)]
    drops = [a - b for a, b in itertools.pairwise(ranges)]
    assert max(drops) - min(drops) < 1e-12


def test_all_open_the_middle_jet_reaches_farthest_1_1_m_and_the_top_and_bottom_ones_land_together():
    f = v.figures(TUBE)
    assert f.ranges_m[1] == pytest.approx(1.1, rel=1e-15)
    assert f.ranges_m[0] == pytest.approx(f.ranges_m[2], rel=1e-15)
    assert round(f.ranges_m[2], 2) == 0.92
    assert f.farthest_hole_m == pytest.approx(0.35, rel=1e-15) and f.farthest_m == pytest.approx(1.1, rel=1e-15)
    # The farthest is the farthest: no height throws farther.
    assert max(v.jet_range_m(TUBE, TUBE.fill_m, k / 1000) for k in range(901)) <= f.farthest_m + 1e-15


def test_twice_the_tube_takes_four_times_as_long_and_twice_the_hole_a_quarter():
    base = v.figures(TUBE).drain_s
    assert v.figures(replace(TUBE, diameter_m=0.16)).drain_s == pytest.approx(4 * base, rel=1e-12)
    assert v.figures(replace(TUBE, hole_diameter_m=0.016)).drain_s == pytest.approx(base / 4, rel=1e-12)


def test_the_water_s_own_speed_down_the_tube_is_under_a_ten_thousandth_and_kept_under_half_a_percent():
    assert v.figures(TUBE).approach < 1e-4
    widest = replace(TUBE, hole_diameter_m=v.WIDEST_HOLE * TUBE.diameter_m, discharge=1.0)
    assert v.figures(widest).approach < 0.005


def test_the_steps_keep_to_the_exact_solution_to_a_billionth_until_a_second_before_the_end():
    drain = v.drain_time_s(TUBE, 0.05)
    level, worst = TUBE.fill_m, 0.0
    for n in range(1, int((drain - 1) / v.STEP_S)):
        level = v.step(TUBE, level, LOWEST, v.STEP_S)
        exact = v.level_exact(TUBE, 0.05, n * v.STEP_S)
        worst = max(worst, abs(level - exact) / (exact - 0.05))
    assert worst < 1e-9


def test_the_steps_empty_the_tube_within_one_step_of_the_closed_form():
    steps, level = _drain(TUBE, LOWEST)
    assert level == 0.05
    assert abs(steps * v.STEP_S - v.drain_time_s(TUBE, 0.05)) < v.STEP_S


def test_with_every_hole_open_the_steps_agree_with_the_tests_own_runge_kutta():
    k = v.rate_constant(TUBE)

    def fall(_t: float, y: list[float]) -> list[float]:
        return [-k * sum(math.sqrt(2 * G * max(0.0, y[0] - hole)) for hole in TUBE.holes_m)]

    trace = rk4(fall, [TUBE.fill_m], v.STEP_S, 40.0, sample_every=200)
    run = v.run(TUBE, tuple(v.Plug(0.0, i, True) for i in range(3)), 40.0)
    for t, ref in zip(trace.t, trace.states[0], strict=True):
        n = round(t * v.SAMPLES_PER_S)
        assert run.t_s[n] == pytest.approx(t, abs=1e-9)
        assert run.level_m[n] == pytest.approx(ref, rel=1e-9)
    assert run.level_m[-1] > TUBE.holes_m[0]


def test_what_leaves_the_holes_is_what_the_tube_loses():
    """A·dh/dt over a step against the outflow summed by Simpson's rule over it."""
    area = math.pi * TUBE.diameter_m**2 / 4
    level, lost, out = TUBE.fill_m, 0.0, 0.0
    h = 0.01
    for _ in range(3000):
        a = v.outflow_l_min(TUBE, level, ALL) / 60000
        after_half = v.step(TUBE, level, ALL, h / 2)
        b = v.outflow_l_min(TUBE, after_half, ALL) / 60000
        after = v.step(TUBE, level, ALL, h)
        c = v.outflow_l_min(TUBE, after, ALL) / 60000
        out += h / 6 * (a + 4 * b + c)
        lost += area * (level - after)
        level = after
    assert out == pytest.approx(lost, rel=1e-6)


def test_a_closed_hole_or_one_above_the_level_lets_nothing_out_and_the_level_stops_at_the_lowest_open_hole():
    assert v.fall_rate_m_s(TUBE, 0.9, (False, False, False)) == 0
    assert v.step(TUBE, 0.9, (False, False, False), v.STEP_S) == 0.9
    assert v.fall_rate_m_s(TUBE, 0.3, (False, False, True)) == 0
    assert v.step(TUBE, 0.3, (False, False, True), v.STEP_S) == 0.3
    assert v.step(TUBE, 0.35 + 1e-9, (False, True, False), 1.0) == 0.35
    run = v.run(TUBE, (v.Plug(0.0, 1, True),), 200.0)
    assert min(run.level_m) == 0.35
    assert run.ranges_m[1][-1] == 0.0


def test_a_plug_put_back_stops_the_level_where_it_is():
    run = v.run(TUBE, (v.Plug(0.0, 0, True), v.Plug(10.0, 0, False)), 20.0)
    at = run.t_s.index(10.0)
    assert len(set(run.level_m[at:])) == 1
    assert run.outflow_l_min[-1] == 0.0
    assert run.level_m[at] < TUBE.fill_m


def test_the_jet_lands_where_its_range_says():
    for level, hole in ((0.9, 0.05), (0.6, 0.35), (0.7, 0.65)):
        x = v.jet_range_m(TUBE, level, hole)
        assert v.jet_path(TUBE, level, hole, x) == pytest.approx(0.0, abs=1e-12)
        assert v.jet_path(TUBE, level, hole, 0.99 * x) > 0
        assert v.jet_path(TUBE, level, hole, 0.0) == TUBE.stand_m + hole
    assert v.jet_path(TUBE, 0.3, 0.35, 0.5) == TUBE.stand_m + 0.35


def test_a_hole_above_the_fill_takes_no_time_and_leaves_the_level():
    assert v.drain_time_s(TUBE, 0.95) == 0
    assert v.level_exact(TUBE, 0.95, 5.0) == TUBE.fill_m
    stood = replace(TUBE, stand_m=1.5)
    assert v.figures(stood).farthest_hole_m is None
    assert v.figures(stood).farthest_m == pytest.approx(v.jet_range_m(stood, stood.fill_m, 0.0), rel=1e-15)


@pytest.mark.parametrize(
    "change",
    [
        {"diameter_m": 0.005},
        {"height_m": 6.0},
        {"fill_m": 0.0},
        {"fill_m": 1.2},
        {"hole_diameter_m": 0.03},
        {"holes_m": ()},
        {"holes_m": (0.1,) * 7},
        {"holes_m": (0.3, 0.2)},
        {"holes_m": (0.1, 1.0)},
        {"discharge": 0.0},
        {"discharge": 1.2},
        {"stand_m": -0.1},
    ],
)
def test_the_vessel_refuses_what_it_cannot_be(change: dict[str, object]):
    with pytest.raises(ValueError):
        replace(TUBE, **change)


def test_a_run_refuses_a_plug_it_has_no_hole_for_and_times_it_cannot_take():
    with pytest.raises(ValueError):
        v.run(TUBE, (v.Plug(0.0, 3, True),), 1.0)
    with pytest.raises(ValueError):
        v.run(TUBE, (v.Plug(-1.0, 0, True),), 1.0)
    with pytest.raises(ValueError):
        v.run(TUBE, (), 0.0)
    with pytest.raises(ValueError):
        v.run(TUBE, (), 1.0, step_s=0.1)
    with pytest.raises(ValueError):
        v.level_exact(TUBE, 0.05, -1.0)


def test_the_browser_s_cases_cross_every_branch_the_page_can_reach():
    stored = json.loads(load_script("write-experiments-cases.py").TARGET.read_text(encoding="utf-8"))["vessel"]
    ends = [c["run"]["level_m"]["values"][-1] for c in stored]
    holes = [c["vessel"]["holes_m"] for c in stored]
    assert any(end == hs[0] for end, hs in zip(ends, holes, strict=True)), "a tube run down to its lowest hole"
    assert any(end not in hs for end, hs in zip(ends, holes, strict=True)), "a level stopped by a plug put back"
    assert any(any(y >= c["vessel"]["fill_m"] for y in c["vessel"]["holes_m"]) for c in stored), "a dry hole"
    assert any(any(not p["opened"] for p in c["plugs"]) for c in stored), "a plug put back"
    assert any(c["figures"]["farthest_hole_m"] is not None for c in stored)
