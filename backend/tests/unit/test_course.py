"""The course's engine against its reference values: lessons 0–6 of the
differential-equations course, its solvers, its linear algebra and its transfer
functions.

Ported with the lessons from Kurvenschmiede's ``tests/unit/test_dynamics.py``.
Every number the specification ("DGL-Lernapp – Spezifikation 1.0") printed for
these lessons is here (``G1``–``G13``), each recomputed by the engine from the
inputs the specification named — and, before any of it was written,
cross-checked independently with SciPy. Two of them did not reproduce, and the
tests assert what the physics says instead, each with the reason beside it:

* **G10** — Euler at ``h = 1 ms`` on the measuring shaft ends the second at
  1.00°, not 0.98°: ``|1 + hλ|² = 1 − 2hDω₀ + (hω₀)²`` is exactly one at
  ``hω₀ = 2D``, which is this step. RK4 ends at the exact 0.0067°, not 0.0066°.
* **G12** — 7.63 Hz is the *zero* of the shaft torque; with the default damping
  the minimum of ``|M_W|`` sits at 7.9 Hz. The tests hold both.

G14–G24 belong to lessons 7–10 and stayed in Kurvenschmiede with them, as did
the explorer's tests. Tolerance where the specification gave none: relative
1 %, its own default.

Beyond the engine's numbers, this file holds three things the move brought:
that the wire models still name every field their dataclasses do (the router
hands one to the other by name), that nothing an exhibit's check fingerprints
imports the course, and that the course imports nothing but the standard
library.
"""

from __future__ import annotations

import ast
import cmath
import importlib
import itertools
import math
import pkgutil
import sys
from dataclasses import fields, is_dataclass
from pathlib import Path

import pytest
from pydantic import BaseModel

from staunlabor.domain import course as d
from staunlabor.domain.course import linalg, lti, ode
from staunlabor.domain.course.chain import state_matrix
from staunlabor.domain.course.numerics import RK4_REAL_LIMIT, euler_regime
from staunlabor.domain.course.two_mass import MAX_SAMPLES
from staunlabor.domain.schemas import course as schemas

pytestmark = pytest.mark.unit


def close(value: float | None, expected: float, rel: float = 0.01, abs_: float | None = None) -> bool:
    assert value is not None
    if abs_ is not None:
        return abs(value - expected) <= abs_
    return abs(value - expected) <= rel * abs(expected)


# ── the reference values, G1–G13 ─────────────────────────────────────────────


def test_g1_a_sensor_reads_71_88_after_two_time_constants():
    step = d.first_order_step(4.0, 20.0, 80.0, 8.0)
    assert close(step.at_value, 71.88, abs_=0.005)
    assert [m.multiple for m in step.marks] == [1, 2, 3, 5]
    assert [round(m.fraction, 3) for m in step.marks] == [0.632, 0.865, 0.95, 0.993]
    assert step.tangent_end_s == 4.0


def test_g2_the_measuring_shaft_is_100_rad_s_with_five_percent_damping():
    osc = d.oscillator(0.05, stiffness=500.0, damping_coefficient=0.5)
    assert close(2 * math.pi * osc.f0_hz, 100.0, rel=1e-12)
    assert close(osc.f0_hz, 15.92, abs_=0.005)
    assert close(osc.damping_ratio, 0.05, rel=1e-12)
    assert close(lti.magnification(1.0, osc.damping_ratio), 10.0, rel=1e-12)


@pytest.mark.parametrize(
    ("damping", "overshoot_pct"), [(0.05, 85.5), (0.1, 72.9), (0.3, 37.2), (0.5, 16.3), (0.7, 4.60)]
)
def test_g3_the_overshoot_for_five_dampings(damping: float, overshoot_pct: float):
    fig = lti.second_order_figures(100.0, damping)
    assert close(fig.overshoot * 100, overshoot_pct)


def test_g3_the_overshoot_is_the_simulated_peak_not_only_the_formula():
    """The formula and the curve are two statements of one thing; the curve's
    own maximum is held to the formula so neither can drift."""
    osc = d.oscillator(0.05, f0_hz=10.0, damping_ratio=0.3)
    step = d.second_order_step(osc, 1.0)
    peak = max(step.value) / step.final_value - 1
    assert close(peak, step.figures.overshoot, rel=2e-3)


def test_g4_the_shaft_behind_a_5_hz_filter_reads_9_40_db_at_16_hz():
    shaft = d.Block(d.BlockKind.second_order, 1.0, f0_hz=100 / (2 * math.pi), damping=0.05)
    filt = d.Block(d.BlockKind.first_order, 1.0, time_constant_s=1 / (2 * math.pi * 5))
    assert close(d.chain_response([shaft, filt], 16.0).cursor.magnitude_db, 9.40, abs_=0.05)


@pytest.mark.parametrize(("corner", "f", "phase", "delay_ms"), [(5.0, 3.0, -30.96, 28.67), (50.0, 5.0, -5.71, 3.17)])
def test_g5_g6_a_filter_s_phase_as_a_delay(corner: float, f: float, phase: float, delay_ms: float):
    block = d.Block(d.BlockKind.first_order, 1.0, time_constant_s=1 / (2 * math.pi * corner))
    cursor = d.chain_response([block], f).cursor
    assert close(cursor.phase_deg, phase, abs_=0.005)
    assert close(cursor.delay_s * 1000, delay_ms, abs_=0.005)


def test_g7_two_steps_of_one_second():
    r = d.sensor_methods(4.0, 20.0, 80.0, 1.0, 2)
    last = r.rows[-1]
    assert close(last.euler, 46.250, abs_=5e-4)
    assert close(last.rk4, 43.607, abs_=5e-4)
    assert close(last.exact, 43.608, abs_=5e-4)


def test_g8_eight_euler_steps_of_a_quarter_second():
    assert close(d.sensor_methods(4.0, 20.0, 80.0, 0.25, 8).rows[-1].euler, 44.20, abs_=0.005)


def test_g9_the_return_spring():
    r = d.sensor_methods(0.5, 90.0, 10.0, 0.25, 2)
    one, two = r.rows[1], r.rows[2]
    assert (round(one.euler, 2), round(two.euler, 2)) == (50.00, 30.00)
    assert (round(one.rk4, 2), round(two.rk4, 2)) == (58.54, 39.45)
    assert (round(one.exact, 2), round(two.exact, 2)) == (58.52, 39.43)


def test_g10_corrected_euler_at_one_millisecond_neither_gains_nor_loses():
    """The specification said 0.98°. Euler's growth per step is
    ``|1 + hλ| = √(1 − 2hDω₀ + (hω₀)²)``, which is exactly one at
    ``hω₀ = 2D`` — and ``0.001·100 = 2·0.05``. The numerical anti-damping
    cancels the physical damping, and the shaft rings at its starting amplitude
    for ever."""
    r = d.oscillator_methods(1e-3)
    runs = {run.method: run for run in r.runs}
    assert close(r.euler_gain, 1.0, rel=1e-12)
    assert close(r.euler_neutral_step_s, 1e-3, rel=1e-12)
    assert close(runs[d.OscillatorMethod.exact].final_amplitude_deg, 0.0067, abs_=0.0001)
    assert close(runs[d.OscillatorMethod.rk4].final_amplitude_deg, 0.0067, abs_=0.0001)
    assert close(runs[d.OscillatorMethod.euler].final_amplitude_deg, 1.00, abs_=0.01)
    assert close(runs[d.OscillatorMethod.euler].damping, 0.0, abs_=1e-9)
    assert close(runs[d.OscillatorMethod.rk4].damping, 0.05, abs_=1e-4)


def test_g10_a_coarser_euler_step_makes_the_shaft_ring_up():
    runs = {run.method: run for run in d.oscillator_methods(2e-3).runs}
    assert runs[d.OscillatorMethod.euler].final_amplitude_deg > 1.0
    assert runs[d.OscillatorMethod.euler].damping < 0


def test_g11_the_two_mass_rig_s_modes():
    modes = d.two_mass(d.TwoMassParameters(), 3.0).modes
    first, second = modes
    assert close(first.frequency_hz, 6.94, abs_=0.01)
    assert close(first.shape[1], 0.962, abs_=0.0005)
    assert close(first.damping, 0.057, abs_=0.0005)
    assert close(second.frequency_hz, 39.11, abs_=0.01)
    assert close(second.shape[1], -0.208, abs_=0.0005)
    assert close(second.damping, 0.051, abs_=0.0005)
    assert first.reference == second.reference == 0


def test_g12_the_absorber_point_and_the_motor_standing_still():
    r = d.two_mass(d.TwoMassParameters(), 3.0)
    assert close(r.absorber_hz, 7.63, abs_=0.005)
    assert close(r.motor_still_hz, 17.65, abs_=0.005)


def test_g12_at_the_absorber_point_the_undamped_shaft_reads_nothing():
    undamped = d.TwoMassParameters(shaft_damping=0.0, bar_damping=0.0)
    r = d.two_mass(undamped, d.two_mass(undamped, 3.0).absorber_hz)
    assert r.point.shaft_torque.magnitude < 1e-9


def test_g12_corrected_with_the_default_damping_the_shaft_reads_least_at_7_9_hz():
    """What ``two_mass``'s docstring and the lesson say beside the 7.63 Hz zero:
    the damped adapter's response is still falling steeply there, so the curve
    the page draws has its minimum a little higher."""
    r = d.two_mass(d.TwoMassParameters(), 3.0)
    # Between the two modes (6.94 and 39.11 Hz), where the dip is.
    _, lowest_hz = min((m, f) for f, m in zip(r.frequency_hz, r.shaft_magnitude, strict=True) if 7.0 < f < 39.0)
    assert round(lowest_hz, 1) == 7.9
    assert round(r.absorber_hz, 2) == 7.63


@pytest.mark.parametrize(("f", "ratio"), [(1.0, 0.98), (3.0, 0.85), (5.0, 0.57)])
def test_g13_the_shaft_misreads_the_test_object(f: float, ratio: float):
    assert close(d.two_mass(d.TwoMassParameters(), f).point.reading_ratio, ratio, abs_=0.005)


def test_g13_the_misreading_is_one_minus_f_over_fa_squared_when_undamped():
    p = d.TwoMassParameters(shaft_damping=0.0, bar_damping=0.0)
    fa = d.two_mass(p, 1.0).absorber_hz
    for f in (1.0, 3.0, 5.0):
        assert close(d.two_mass(p, f).point.reading_ratio, abs(1 - (f / fa) ** 2), rel=1e-9)


# ── the solvers ──────────────────────────────────────────────────────────────


def _pt1_error(method, h: float) -> float:
    tr = method(lambda _t, y: ((80.0 - y[0]) / 4.0,), (20.0,), h, 4.0)
    return abs(tr.states[0][-1] - (80 - 60 * math.exp(-1)))


def _pt2_error(method, h: float) -> float:
    w0, damping = 10.0, 0.2

    def f(_t, y):
        return (y[1], -(w0**2) * y[0] - 2 * damping * w0 * y[1] + w0**2)

    tr = method(f, (0.0, 0.0), h, 1.0)
    return abs(tr.states[0][-1] - lti.step_pt2(1.0, 1.0, w0, damping))


@pytest.mark.parametrize("error", [_pt1_error, _pt2_error])
def test_halving_the_step_halves_euler_s_error_and_sixteenths_rk4_s(error):
    # Steps small enough to be in the asymptotic range for the oscillator
    # (hω₀ ≤ 0.02 for the first-order methods).
    euler_ratio = error(ode.euler, 0.002) / error(ode.euler, 0.001)
    rk4_ratio = error(ode.rk4, 0.02) / error(ode.rk4, 0.01)
    heun_ratio = error(ode.heun, 0.002) / error(ode.heun, 0.001)
    assert 1.9 < euler_ratio < 2.1
    assert 3.8 < heun_ratio < 4.2
    assert 15.0 < rk4_ratio < 17.0


@pytest.mark.parametrize(("h", "grows"), [(7.9, False), (8.1, True)])
def test_euler_on_a_lag_is_stable_below_two_time_constants_only(h: float, grows: bool):
    tr = ode.euler(lambda _t, y: (-y[0] / 4.0,), (1.0,), h, 100 * h)
    assert (abs(tr.states[0][-1]) > 1.0) is grows


def test_euler_s_regime_names_the_five_cases():
    assert [euler_regime(h, 1.0) for h in (0.5, 1.0, 1.5, 2.0, 2.5)] == [
        d.EulerRegime.monotone,
        d.EulerRegime.one_step,
        d.EulerRegime.alternating,
        d.EulerRegime.neutral,
        d.EulerRegime.diverging,
    ]


def test_an_rk4_step_laid_open_is_the_step_taken():
    def f(_t, y):
        return ((80.0 - y[0]) / 4.0,)

    st = ode.rk4_step(f, 0.0, (20.0,), 1.0)
    assert st.stages[0].slope == (15.0,)
    assert [s.t for s in st.stages] == [0.0, 0.5, 0.5, 1.0]
    assert close(st.y_next[0], ode.rk4(f, (20.0,), 1.0, 1.0).states[0][-1], rel=1e-15)


def test_the_stiff_pair_s_rk4_is_the_method_itself():
    """Stepped by its stability function for speed — the identity on a linear
    decoupled system, held here to the general integrator."""
    pair = d.stiff_pair(2e-3, duration_s=0.05)
    tr = ode.rk4(lambda _t, y: (-y[0] / 1e-3, -y[1] / 10.0), (1.0, 1.0), 2e-3, 0.05)
    assert close(pair.rk4.fast[-1], tr.states[0][-1], rel=1e-12)
    assert close(pair.rk4.slow[-1], tr.states[1][-1], rel=1e-12)


def test_stiffness_rk4_needs_ten_thousand_steps_implicit_euler_as_few_as_it_likes():
    assert close(RK4_REAL_LIMIT, 2.785293563405282, rel=1e-12)
    assert abs(1 + (z := -RK4_REAL_LIMIT) + z * z / 2 + z**3 / 6 + z**4 / 24) == pytest.approx(1.0, abs=1e-12)
    within = d.stiff_pair(2.7e-3)
    beyond = d.stiff_pair(2.9e-3)
    assert within.rk4.stable and not beyond.rk4.stable
    assert within.rk4_min_steps == 10_771
    coarse = d.stiff_pair(0.5)
    assert coarse.implicit.steps == 60 and coarse.implicit.stable
    assert close(coarse.implicit.slow[-1], math.exp(-3), rel=0.1)


def test_semi_implicit_euler_keeps_an_undamped_oscillation_bounded():
    tr = ode.symplectic_euler(lambda _t, x, _v: -100.0 * x, 1.0, 0.0, 0.01, 20.0)
    assert max(abs(x) for x in tr.states[0]) < 1.06
    explicit = ode.euler(lambda _t, y: (y[1], -100.0 * y[0]), (1.0, 0.0), 0.01, 20.0)
    assert max(abs(x) for x in explicit.states[0]) > 2.0


def test_a_run_longer_than_the_step_cap_is_refused_with_a_reason():
    with pytest.raises(ValueError, match="steps"):
        ode.euler(lambda _t, y: (0.0,), (0.0,), 1e-6, 10.0)


# ── the linear algebra ───────────────────────────────────────────────────────


def test_the_eigenvalues_of_a_spring_mass_damper_are_the_characteristic_roots():
    """§8.3's test: for ``A = [[0, 1], [−c/m, −d/m]]`` the eigenvalues are
    ``ω₀(−D ± √(D² − 1))`` to a relative 1e−9 — under-, critically and
    over-damped alike."""
    for c, m, dd in [(500.0, 0.05, 0.5), (4.0, 1.0, 4.0), (4.0, 1.0, 10.0), (1e6, 588.1, 7000.0)]:
        w0 = math.sqrt(c / m)
        damping = dd / (2 * math.sqrt(c * m))
        expected = sorted(lti.second_order_poles(w0, damping), key=lambda z: (z.real, z.imag))
        got = linalg.eigenvalues([[0.0, 1.0], [-c / m, -dd / m]])
        for g, e in zip(got, expected, strict=True):
            assert abs(g - e) <= 1e-9 * abs(e) + 1e-12


def test_the_qr_iteration_finds_the_eigenvalues_of_a_badly_scaled_chain():
    """A free chain with entries from 1 to 10¹⁰ and a rigid-body pair at zero —
    the case the polynomial's roots would get wrong. Kurvenschmiede's worm-gear
    rig, written out: its worm motor, worm shaft and worm reduced through the
    ratio of 20 (``×20²``), then the mesh, the wheel, the wheel shaft and the
    load motor."""
    i2 = 20.0**2
    chain = d.Chain(
        (1.2e-3 * i2, 1e-4 * i2, 0.005, 0.04),
        (2000.0 * i2, 8000.0, 10000.0),
        (0.15 * i2, 4.0, 4.0),
    )
    lams = linalg.eigenvalues(state_matrix(chain))
    a = state_matrix(chain)
    scale = max(abs(v) for row in a for v in row)
    for lam in lams:
        # (A − λI)·v ≈ 0 for a unit v, against the matrix's own size: the
        # rigid-body zero is a defective double eigenvalue, whose null vector
        # inverse iteration finds only to the scale of the matrix.
        shifted = [[a[i][j] - (lam if i == j else 0) for j in range(8)] for i in range(8)]
        v = linalg.null_vector(shifted)
        residual = max(abs(sum(shifted[i][j] * v[j] for j in range(8))) for i in range(8))
        assert residual < 1e-10 * scale
    assert sum(1 for lam in lams if abs(lam) < 1e-6) == 2


def test_a_singular_system_is_refused():
    with pytest.raises(ValueError, match="singular"):
        linalg.solve([[1.0, 2.0], [2.0, 4.0]], [1.0, 2.0])


def test_the_matrix_exponential_of_a_rotation_is_a_rotation():
    e = linalg.expm([[0.0, -math.pi / 2], [math.pi / 2, 0.0]])
    assert close(e[0][0], 0.0, abs_=1e-12) and close(e[1][0], 1.0, abs_=1e-12)


# ── the transfer functions and lessons ───────────────────────────────────────


def test_a_chain_in_series_is_the_product_and_its_bode_the_sum():
    blocks = [
        d.Block(d.BlockKind.proportional, 2.0),
        d.Block(d.BlockKind.first_order, 1.0, time_constant_s=0.1),
        d.Block(d.BlockKind.second_order, 1.0, f0_hz=5.0, damping=0.2),
    ]
    r = d.chain_response(blocks, 3.0)
    for i, f in enumerate(r.frequency_hz[::50]):
        k = i * 50
        assert close(r.magnitude_db[k], sum(b.magnitude_db[k] for b in r.blocks), abs_=1e-9)
        tf = lti.series(
            lti.Tf((2.0,), (1.0,)),
            lti.Tf((1.0,), (0.1, 1.0)),
            lti.Tf((4 * math.pi**2 * 25,), (1.0, 2 * 0.2 * 10 * math.pi, 4 * math.pi**2 * 25)),
        )
        assert close(r.magnitude_db[k], 20 * math.log10(abs(lti.response(tf, 2 * math.pi * f))), abs_=1e-9)
    assert r.static_gain == pytest.approx(2.0)
    assert close(r.step[-1], 2.0, rel=0.01)


def test_the_chain_s_poles_are_the_roots_of_its_whole_denominator():
    """Found block by block (``frequency.chain_response``), they are still the
    product's: held here to the companion matrix of the product, where that
    converges."""
    blocks = [
        d.Block(d.BlockKind.second_order, 1.0, f0_hz=5.0, damping=0.2),
        d.Block(d.BlockKind.first_order, 1.0, time_constant_s=0.1),
        d.Block(d.BlockKind.integrator, 2.0),
    ]
    whole = lti.series(
        lti.Tf((1.0,), (1.0, 2 * 0.2 * 10 * math.pi, 100 * math.pi**2)),
        lti.Tf((1.0,), (0.1, 1.0)),
        lti.Tf((2.0,), (1.0, 0.0)),
    )
    got = d.chain_response(blocks, 1.0).poles
    for g, e in zip(got, lti.roots(whole.den), strict=True):
        assert abs(g - e) <= 1e-9 * max(1.0, abs(e))


def test_two_equal_second_order_blocks_have_their_pair_twice():
    """The chain the page offers by switching its second block to second order:
    the product's companion matrix is defective there, and found as the roots of
    the product the poles were a 400 (the QR iteration ran out of sweeps)."""
    shaft = d.Block(d.BlockKind.second_order, 1.0, f0_hz=15.92, damping=0.05)
    pair = lti.second_order_poles(2 * math.pi * 15.92, 0.05)
    for n in (2, 4):
        poles = d.chain_response([shaft] * n, 16.0).poles
        assert len(poles) == 2 * n
        for p in poles:
            assert min(abs(p - e) for e in pair) < 1e-9 * abs(pair[0])


def test_the_phase_carries_on_past_minus_180_rather_than_jumping():
    blocks = [
        d.Block(d.BlockKind.first_order, 1.0, time_constant_s=0.1),
        d.Block(d.BlockKind.second_order, 1.0, f0_hz=5.0, damping=0.2),
    ]
    phase = d.chain_response(blocks, 1.0).phase_deg
    assert phase[-1] < -200
    assert all(b <= a + 1e-9 for a, b in itertools.pairwise(phase))


def test_a_dead_time_delays_the_step_and_adds_phase_but_no_pole():
    lag = d.Block(d.BlockKind.first_order, 1.0, time_constant_s=0.1)
    plain = d.chain_response([lag], 2.0)
    delayed = d.chain_response([lag, d.Block(d.BlockKind.dead_time, dead_time_s=0.05)], 2.0)
    assert len(delayed.poles) == len(plain.poles)
    assert close(delayed.cursor.phase_deg - plain.cursor.phase_deg, -360 * 2.0 * 0.05, abs_=1e-9)
    assert delayed.step[0] == 0.0
    assert all(v == 0.0 for t, v in zip(delayed.time_s, delayed.step, strict=True) if t < 0.05)


def test_an_integrator_has_no_final_value():
    r = d.chain_response([d.Block(d.BlockKind.integrator, 2.0)], 1.0)
    assert r.static_gain is None
    assert close(r.step[-1], 2.0 * r.time_s[-1], rel=1e-9)


def test_a_fast_lag_behind_a_slow_one_is_stepped_exactly():
    blocks = [
        d.Block(d.BlockKind.first_order, 1.0, time_constant_s=1e-3),
        d.Block(d.BlockKind.first_order, 1.0, time_constant_s=10.0),
    ]
    r = d.chain_response(blocks, 1.0)
    for t, y in zip(r.time_s[::40], r.step[::40], strict=True):
        exact = 1 - (10.0 * math.exp(-t / 10.0) - 1e-3 * math.exp(-t / 1e-3)) / (10.0 - 1e-3)
        assert close(y, exact, abs_=1e-9)


def test_the_laplace_route_lands_on_the_time_domain_answer():
    r = d.laplace_steps(2.0, 3.0, 4.0, start=1.0)
    assert (r.residue_zero, r.residue_pole, r.pole) == (12.0, -11.0, -0.5)
    for t, y in zip(r.time_s, r.value, strict=True):
        assert close(y, 12.0 - 11.0 * math.exp(-t / 2.0), abs_=1e-12)


def test_a_filter_on_one_channel_invents_a_hysteresis_and_on_both_does_not():
    one = d.filter_loop(3.0, 5.0, d.FilterMode.torque_only)
    both = d.filter_loop(3.0, 5.0, d.FilterMode.both)
    offline = d.filter_loop(3.0, 5.0, d.FilterMode.zero_phase)
    assert one.true_hysteresis == 0.0
    expected = 2 * 30.0 * math.sin(math.atan(3 / 5)) / math.sqrt(1 + (3 / 5) ** 2)
    assert close(one.apparent_hysteresis, expected, rel=0.03)
    assert both.apparent_hysteresis < 1e-6
    assert offline.apparent_hysteresis < 1e-6
    assert close(one.delay_s * 1000, 28.67, abs_=0.01)


def test_a_real_hysteresis_survives_identical_filtering():
    r = d.filter_loop(1.0, 50.0, d.FilterMode.both, friction_nm=2.0)
    assert close(r.true_hysteresis, 4.0, rel=1e-9)
    assert close(r.apparent_hysteresis, 4.0, rel=0.1)


def test_a_pole_dragged_gives_back_its_frequency_and_damping():
    f0, damping = d.pole_from(-5.0, 2 * math.pi * 8.0)
    pair = d.pole_pair(f0, damping)
    assert close(pair.poles[0].real, -5.0, rel=1e-12)
    assert close(pair.imag_hz, 8.0, rel=1e-12)


def test_a_pole_in_the_right_half_plane_grows_and_says_so():
    pair = d.pole_pair(10.0, -0.2)
    assert not pair.stable
    assert pair.overshoot is None
    assert max(abs(v) for v in pair.value) > 10


def test_the_step_response_is_continuous_through_critical_damping():
    w0 = 10.0
    for t in (0.05, 0.2, 0.7):
        values = [lti.step_pt2(t, 1.0, w0, dd) for dd in (1 - 1e-5, 1.0, 1 + 1e-5)]
        assert max(values) - min(values) < 1e-4


@pytest.mark.parametrize(
    ("matrix", "kind"),
    [
        ((0.0, 1.0, -4.0, -1.0), d.PortraitKind.stable_focus),
        ((1.0, 0.0, 0.0, -1.0), d.PortraitKind.saddle),
        ((0.0, 1.0, -1.0, 0.0), d.PortraitKind.centre),
        ((0.5, 1.0, -1.0, 0.5), d.PortraitKind.unstable_focus),
        ((-1.0, 0.0, 0.0, -3.0), d.PortraitKind.stable_node),
        ((2.0, 1.0, 0.0, 1.0), d.PortraitKind.unstable_node),
        ((0.0, 1.0, 0.0, -1.0), d.PortraitKind.degenerate),
    ],
)
def test_the_origin_is_named_by_its_eigenvalues(matrix, kind):
    assert d.matrix_portrait(*matrix).kind is kind


def test_a_trajectory_started_on_an_eigenvector_stays_on_it():
    portrait = d.matrix_portrait(1.0, 0.0, 0.0, -1.0)
    assert len(portrait.trajectories) == 12
    along = portrait.trajectories[0]  # started at (1, 0), the unstable eigenvector
    assert all(abs(y) < 1e-12 for y in along.x2)
    assert {(round(v.x1, 9), round(v.x2, 9)) for v in portrait.eigenvectors} == {(1.0, 0.0), (0.0, 1.0)}


def test_a_centre_is_drawn_closed_not_spiralling():
    portrait = d.matrix_portrait(0.0, 1.0, -1.0, 0.0)
    for tr in portrait.trajectories:
        radii = [math.hypot(x, y) for x, y in zip(tr.x1, tr.x2, strict=True)]
        assert max(radii) - min(radii) < 1e-12


def test_the_decay_test_s_pairs_bracket_the_true_damping():
    decay = d.decay_test(7)
    assert len(decay.peaks) >= 4
    assert close(decay.overall_damping, decay.true_damping, rel=0.1)
    for pair in decay.pairs:
        assert close(pair.damping, decay.true_damping, rel=0.5)


def test_the_same_seed_draws_the_same_measurement():
    assert d.first_order_measurement(5) == d.first_order_measurement(5)
    assert d.first_order_measurement(5) != d.first_order_measurement(6)


def test_the_analogies_all_make_the_same_time_constant():
    for a in d.analogies(4.0):
        product = a.storage * a.resistance if a.kind is d.AnalogyKind.electrical else a.storage / a.resistance
        assert close(product, 4.0, rel=1e-12)


def test_the_tank_settles_where_inflow_meets_outflow():
    r = d.tank(5.0, 0.5, 10.0)
    assert close(r.time_constant_s, 50.0, rel=1e-12)
    assert close(r.level_final_m, 0.5, rel=1e-12)
    assert close(r.outflow_lps[-1], 5.0, rel=0.01)


def test_the_magnification_s_peak_and_the_measuring_chain_rule():
    osc = d.oscillator(0.05, f0_hz=50.0, damping_ratio=0.05)
    m = d.magnification_at(osc, 10.0)
    assert close(m.error_pct, 4.2, abs_=0.1)  # f₀ ≥ 5·f: about four percent
    assert close(m.peak_value, 1 / (2 * 0.05 * math.sqrt(1 - 0.0025)), rel=1e-12)


def test_an_undamped_system_driven_at_resonance_has_no_finite_reading():
    osc = d.oscillator(1.0, f0_hz=2.0, damping_ratio=0.0)
    assert d.magnification_at(osc, 2.0).excitation_value is None


def test_the_mass_compensation_removes_the_misreading_and_costs_noise():
    p = d.TwoMassParameters()
    clean = d.mass_compensation(p, 3.0, 0.0, 1000.0, d.Differentiator.none, 50.0)
    assert clean.compensated_error < 0.05 * clean.uncompensated_error
    noisy = d.mass_compensation(p, 3.0, 1e-4, 1000.0, d.Differentiator.none, 50.0)
    filtered = d.mass_compensation(p, 3.0, 1e-4, 1000.0, d.Differentiator.zero_phase, 20.0)
    assert noisy.compensated_error > noisy.uncompensated_error
    assert filtered.compensated_error < noisy.compensated_error


def test_the_compensation_s_record_is_capped_at_the_lesson_s_own_corner():
    """Seven periods at the rate asked for: the lesson's corner (10 kHz, 1 Hz)
    is the cap, and what the fields' bounds would still allow beyond it — a
    hundredth of a hertz at 20 kHz, fourteen million samples — is refused
    before a sample is drawn."""
    p = d.TwoMassParameters()
    corner = d.mass_compensation(p, 1.0, 1e-5, 10_000.0, d.Differentiator.zero_phase, 30.0)
    assert MAX_SAMPLES == 70_000
    assert len(corner.time_s) == 3 * 10_000 + 1
    with pytest.raises(ValueError, match="samples"):
        d.mass_compensation(p, 0.01, 1e-5, 20_000.0, d.Differentiator.none, 30.0)


def test_a_complex_mode_says_how_complex_it_is():
    modes = d.two_mass(d.TwoMassParameters(), 3.0).modes
    assert all(0 <= m.phase_spread_deg < 5 for m in modes)
    proportional = d.TwoMassParameters(shaft_damping=0.0, bar_damping=0.0)
    assert all(m.phase_spread_deg < 1e-6 for m in d.two_mass(proportional, 3.0).modes)
    assert all(cmath.isfinite(m.eigenvalue) for m in modes)


# ── the exercises ────────────────────────────────────────────────────────────

#: The specification's answers, by exercise: lessons 0–6's. Lessons 7–10's
#: four (``steering_wheel``, ``pump_time``, ``ultimate``, ``valve_dead_time``)
#: stayed in Kurvenschmiede.
ANSWERS = {
    "pt1_reading": (71.9,),
    "decrement": (0.050,),
    "double_frequency": (4.0,),
    "filter_delay": (3.2,),
    "filter_phase": (-31.0, 28.7),
    "euler_steps": (46.25,),
    "euler_gain": (1.005,),
    "hand_estimate": (6.3,),
    "light_adapter": (9.0,),
}


def test_every_exercise_s_computed_answer_is_the_specification_s():
    found = {e.key: e for e in d.exercises()}
    assert set(found) == set(ANSWERS)
    for key, expected in ANSWERS.items():
        answers = found[key].answers
        assert len(answers) == len(expected)
        for answer, value in zip(answers, expected, strict=True):
            # The printed answer is rounded; it must sit inside the tolerance
            # a reader's entry is held to, around the computed one.
            slack = answer.absolute if answer.absolute is not None else answer.relative * abs(answer.value)
            assert abs(answer.value - value) <= max(slack, 0.006 * abs(value)), (key, answer.value, value)


# ── the wire models mirror the dataclasses ───────────────────────────────────

#: ``(dataclass, wire model)``: the router hands each answer to its model by
#: attribute name (``from_attributes``) and each input to its dataclass as
#: ``**model_dump()``, so a field renamed on one side is either an error or —
#: on an answer, where the model would just leave it out — a number that
#: silently stops reaching the page. None of the pairs has a field of its own.
MIRRORS = [
    (d.TankRun, schemas.TankRunOut),
    (d.TauMark, schemas.TauMarkOut),
    (d.FirstOrderStep, schemas.FirstOrderStepOut),
    (d.Analogy, schemas.AnalogyOut),
    (d.Measurement, schemas.MeasurementOut),
    (d.Oscillator, schemas.OscillatorOut),
    (d.SecondOrderFigures, schemas.SecondOrderFiguresOut),
    (d.SecondOrderStep, schemas.SecondOrderStepOut),
    (d.MagnificationCurve, schemas.MagnificationCurveOut),
    (d.Magnification, schemas.MagnificationOut),
    (d.Peak, schemas.PeakOut),
    (d.PeakPair, schemas.PeakPairOut),
    (d.DecayTest, schemas.DecayTestOut),
    (d.ScalarGrowth, schemas.ScalarGrowthOut),
    (d.PolePair, schemas.PolePairOut),
    (d.Trajectory, schemas.TrajectoryOut),
    (d.Eigenvector, schemas.EigenvectorOut),
    (d.MatrixPortrait, schemas.MatrixPortraitOut),
    (d.LaplaceSteps, schemas.LaplaceStepsOut),
    (d.Block, schemas.BlockIn),
    (d.BlockCurve, schemas.BlockCurveOut),
    (d.Cursor, schemas.CursorOut),
    (d.ChainResponse, schemas.ChainResponseOut),
    (d.FilterLoop, schemas.FilterLoopOut),
    (d.ErrorRow, schemas.ErrorRowOut),
    (d.Rk4Stage, schemas.Rk4StageOut),
    (d.Rk4Step, schemas.Rk4StepOut),
    (d.SensorMethods, schemas.SensorMethodsOut),
    (d.MethodRun, schemas.MethodRunOut),
    (d.OscillatorMethods, schemas.OscillatorMethodsOut),
    (d.StiffRun, schemas.StiffRunOut),
    (d.StiffPair, schemas.StiffPairOut),
    (d.TwoMassParameters, schemas.TwoMassParametersIn),
    (d.Phasor, schemas.PhasorOut),
    (d.Mode, schemas.ModeOut),
    (d.ForcedPoint, schemas.ForcedPointOut),
    (d.TwoMass, schemas.TwoMassOut),
    (d.Compensation, schemas.CompensationOut),
    (d.Answer, schemas.AnswerOut),
    (d.Exercise, schemas.ExerciseOut),
]


@pytest.mark.parametrize(("dataclass_type", "model"), MIRRORS, ids=lambda p: getattr(p, "__name__", ""))
def test_the_wire_model_names_every_field_its_dataclass_does(dataclass_type, model):
    engine = {field.name for field in fields(dataclass_type)}
    wire = set(model.model_fields)
    assert engine == wire, (
        f"{dataclass_type.__name__} and {model.__name__} have drifted: "
        f"only on the dataclass {sorted(engine - wire)}, only on the model {sorted(wire - engine)}"
    )


def test_a_mirror_the_table_does_not_hold_is_a_mirror_nothing_checks():
    """Every dataclass of the engine with a wire model named after it (``…In``
    or ``…Out``) that shares a field with it is in :data:`MIRRORS` — found, not
    listed, because a list is as easy to forget as the check it feeds."""
    declared = {(dataclass_type, model) for dataclass_type, model in MIRRORS}
    wire = {
        value.__name__: value
        for value in vars(schemas).values()
        if isinstance(value, type) and issubclass(value, BaseModel) and value.__module__ == schemas.__name__
    }
    missed = []
    for info in pkgutil.iter_modules(d.__path__):
        module = importlib.import_module(f"{d.__name__}.{info.name}")
        for value in vars(module).values():
            if not (isinstance(value, type) and is_dataclass(value) and value.__module__ == module.__name__):
                continue
            for suffix in ("In", "Out"):
                model = wire.get(value.__name__ + suffix)
                if (
                    model
                    and (value, model) not in declared
                    and {f.name for f in fields(value)} & set(model.model_fields)
                ):
                    missed.append(f"{value.__name__} / {model.__name__}")
    assert not missed, "These look like mirrors and no row of MIRRORS holds them: " + "; ".join(missed)


# ── the course stays apart from the exhibits, and pure ───────────────────────

PACKAGE = Path(d.__file__).resolve().parent
DOMAIN = PACKAGE.parent


def _imports(path: Path) -> set[str]:
    """Every module a file imports, and every name it imports from one as that
    module's member: ``from staunlabor.domain import course`` is the course."""
    tree = ast.parse(path.read_text(encoding="utf-8"))
    found: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            found.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
            found.add(node.module)
            found.update(f"{node.module}.{alias.name}" for alias in node.names)
    return found


@pytest.mark.parametrize("package", ["experiments", "checks"])
def test_nothing_an_exhibit_s_check_fingerprints_imports_the_course(package: str):
    """An admin's check holds for the code of the exhibit's engine modules and
    every module they import (``domain/checks``): one import of the course from
    there and every change to a lesson would uncheck that exhibit."""
    offenders = [
        f"{path.relative_to(DOMAIN)} imports {name}"
        for path in sorted((DOMAIN / package).rglob("*.py"))
        for name in _imports(path)
        if name == "staunlabor.domain.course" or name.startswith("staunlabor.domain.course.")
    ]
    assert offenders == []


def test_the_course_imports_the_standard_library_and_itself_only():
    """The engine stays pure (``CLAUDE.md``): no numpy, no framework, nothing
    of the site's beyond its own package."""
    foreign = [
        f"{path.name} imports {name}"
        for path in sorted(PACKAGE.glob("*.py"))
        for name in _imports(path)
        if name.split(".")[0] not in sys.stdlib_module_names
        and not (name == "staunlabor.domain.course" or name.startswith("staunlabor.domain.course."))
    ]
    assert foreign == []
