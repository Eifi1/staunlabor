"""The metronomes (``domain/experiments/metronomes.py``): Pantaleone's model,
every figure the page and its checks state, and the cases the port is held to.

The runs here are the page's: the exhibit's build at its scattered start for
two minutes, on the cans and on the table, computed once for the module.
"""

from __future__ import annotations

import json
import math
from typing import Any

import pytest

from staunlabor.domain.checks import results
from staunlabor.domain.experiments import metronomes as m
from staunlabor.domain.experiments.numerics import rk4
from tests.unit.written_files import load_script

pytestmark = pytest.mark.unit


@pytest.fixture(scope="module")
def free_run() -> m.MetronomeRun:
    return m.run(m.Metronomes(), m.Start.SCATTERED, 120.0)


@pytest.fixture(scope="module")
def held_run() -> m.MetronomeRun:
    return m.run(m.Metronomes(free=False), m.Start.SCATTERED, 120.0)


@pytest.fixture(scope="module")
def checked() -> dict[str, Any]:
    return {r.key: r for r in results("metronomes")}


# ── Pantaleone's numbers ──────────────────────────────────────────────────────


def test_his_two_on_his_board_have_his_board_scale_and_coupling():
    two = m.Metronomes(count=2)
    assert round(m.board_scale_m(two) * 100, 3) == 0.088
    assert round(m.coupling(two), 3) == 0.011


def test_the_tempo_is_208_ticks_a_minute_an_angular_frequency_of_10_9_per_second():
    assert m.TICKS_PER_MIN == 208
    assert round(m.RATE_PER_S, 1) == 10.9
    # The docstring's 21.6 g·cm, the pendulum's m·r.
    assert round(m.PENDULUM_MOMENT_KG_M * 1e5, 1) == 21.6


def test_a_swing_takes_144_steps_of_4_ms():
    assert round(2 * math.pi / m.RATE_PER_S / m.STEP_S) == 144


def test_a_held_board_couples_nothing_and_does_not_move():
    held = m.Metronomes(free=False)
    assert m.coupling(held) == 0.0
    y = m.start_state(m.Start.SCATTERED, held.count)
    assert m.board_m(held, y) == 0.0


def test_a_heavier_board_couples_more_weakly():
    assert m.coupling(m.Metronomes(board_kg=2.0)) < m.coupling(m.Metronomes()) / 4


def test_the_tempi_are_spread_evenly_and_one_alone_keeps_the_tempo():
    assert m.detunings(m.Metronomes(count=5, spread=0.004)) == pytest.approx((-0.004, -0.002, 0.0, 0.002, 0.004))
    assert m.detunings(m.Metronomes(count=1, spread=0.02)) == (0.0,)


# ── the starts ────────────────────────────────────────────────────────────────


def test_the_scattered_start_nearly_cancels_for_five():
    y = m.start_state(m.Start.SCATTERED, 5)
    r, _ = m.order(y, (True,) * 5)
    assert round(r, 3) == 0.015


def test_the_opposite_start_sets_neighbours_170_degrees_apart_at_full_swing():
    y = m.start_state(m.Start.OPPOSITE, 2)
    assert math.degrees(m.phase(y[1], y[3]) - m.phase(y[0], y[2])) == pytest.approx(170.0)
    assert math.hypot(y[1], y[3]) == pytest.approx(2 * m.THETA0_RAD)


def test_together_every_metronome_is_at_one_phase_so_r_is_one():
    y = m.start_state(m.Start.TOGETHER, 7)
    assert m.order(y, (True,) * 7)[0] == pytest.approx(1.0)


def test_with_none_running_there_is_no_order():
    assert m.order((0.0, 0.0), (False,)) == (0.0, 0.0)


# ── the runs ──────────────────────────────────────────────────────────────────


def test_on_the_cans_five_are_in_step_in_less_than_a_minute(free_run: m.MetronomeRun):
    """The page: "Nach weniger als einer Minute schwingen alle im Gleichtakt"."""
    seconds = m.in_step_s(free_run)
    assert seconds is not None and seconds < 60
    assert round(seconds) == 53


def test_on_the_table_the_same_five_stay_scattered_for_the_same_two_minutes(held_run: m.MetronomeRun):
    assert m.in_step_s(held_run) is None
    assert max(held_run.order) < 0.21


def test_in_step_the_board_swings_about_1_4_mm_to_and_fro(free_run: m.MetronomeRun):
    last = free_run.board_mm[-250:]
    assert round(max(abs(x) for x in last), 1) == 1.4


def test_a_lone_metronome_settles_at_about_45_degrees():
    lone = m.run(m.Metronomes(count=1, free=False), m.Start.SMALL, 120.0)
    assert round(max(abs(a) for a in lone.angles_deg[0][-250:])) == 45


def test_a_held_metronome_stays_upright_while_the_others_rock_the_board():
    mt = m.Metronomes(count=3)
    running = (True, False, True)
    f = m.rhs(mt, running)
    y = m.start_state(m.Start.TOGETHER, 3)
    y = (y[0], 0.0, y[2], y[3], 0.0, y[5])
    h = m.STEP_S * m.RATE_PER_S
    for k in range(500):
        y = rk4(f, k * h, y, h)
    assert y[1] == 0.0 and y[4] == 0.0
    assert m.board_m(mt, y) != 0.0


def test_in_step_is_none_for_a_run_that_ends_below_the_level():
    run = m.MetronomeRun(t=(0.0, 1.0), order=(1.0, 0.5), board_mm=(0.0, 0.0), angles_deg=((0.0, 0.0),))
    assert m.in_step_s(run) is None


def test_the_engine_refuses_what_no_board_holds():
    with pytest.raises(ValueError):
        m.Metronomes(count=0)
    with pytest.raises(ValueError):
        m.Metronomes(count=8)
    with pytest.raises(ValueError):
        m.Metronomes(board_kg=-0.1)
    with pytest.raises(ValueError):
        m.Metronomes(spread=0.2)
    with pytest.raises(ValueError):
        m.rhs(m.Metronomes(), (True,))
    with pytest.raises(ValueError):
        m.start_state(m.Start.SMALL, 9)
    with pytest.raises(ValueError):
        m.run(m.Metronomes(), m.Start.SCATTERED, 1000.0)


# ── the checks' figures, as their words state them ────────────────────────────


def test_every_check_holds_and_its_words_state_its_figures(checked: dict[str, Any]):
    assert all(r.deviation <= r.tolerance for r in checked.values())
    lone, drift, lag = checked["lone"], checked["drift"], checked["lag"]
    assert (round(lone.expected, 2), round(lone.measured, 2)) == (44.69, 44.84)
    assert round(100 * (lone.measured / lone.expected - 1), 1) == 0.3
    assert (round(drift.expected, 2), round(drift.measured, 2)) == (119.95, 119.96)
    assert (round(lag.expected, 2), round(lag.measured, 2)) == (3.11, 3.27)
    assert round(100 * (lag.measured / lag.expected - 1), 1) == 5.4
    assert round(checked["inphase"].measured, 4) == 0.0006
    assert round((1 - checked["five"].measured) * 1e6) == 5


def test_the_page_s_lag_of_his_two_is_3_1_by_the_formula_and_3_3_in_the_engine(checked: dict[str, Any]):
    assert (round(checked["lag"].expected, 1), round(checked["lag"].measured, 1)) == (3.1, 3.3)


# ── the cases the port is held to ─────────────────────────────────────────────


def test_the_port_s_cases_cross_every_branch_the_page_can_reach():
    stored = json.loads(load_script("write-experiments-cases.py").TARGET.read_text(encoding="utf-8"))
    cases = stored["metronomes"]
    assert {c["start"] for c in cases} == {"scattered", "opposite", "together", "small"}, "every start"
    assert any(not c["mt"]["free"] for c in cases) and any(c["mt"]["free"] for c in cases), "held and free"
    assert any(c["mt"]["count"] == 1 for c in cases) and any(c["mt"]["count"] == 7 for c in cases), "one and seven"
    assert any(c["step_s"] != m.STEP_S for c in cases), "a coarse step"
    hand = stored["metronomes_hand"]
    assert False in hand["running"] and True in hand["running"], "held and started at once"
    assert hand["in_step_s"] is not None, "a run that ends in step"
