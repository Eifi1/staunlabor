"""The Wilberforce spring: the engine's modes, beat and share against its own
time loop and an independent integrator, every figure the page's prose states,
its checks against Berg and Marshall, and the browser cases' reach.

The figures are asserted twice where the catalogue states them: the engine's
number, and the German sentence that quotes it (the fallback language, from
which the six others are translated), so a sentence cannot keep a figure the
engine no longer gives.
"""

from __future__ import annotations

import json
import math
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest

from staunlabor.domain import checks
from staunlabor.domain.experiments import spring as sp
from tests.unit.ode import rk4

pytestmark = pytest.mark.unit

ROOT = Path(__file__).resolve().parents[3]
DE = json.loads((ROOT / "frontend/src/shared/i18n/locales/de-CH.json").read_text(encoding="utf-8"))["experiments"]
PAGE = DE["spring"]
CASES = DE["checks"]["cases"]["spring"]

S = sp.WilberforceSpring()


def _de(x: float, digits: int) -> str:
    """A number as the German page writes it: a decimal point, as de-CH's own
    formatting does (one sign on the page since 2026-11-23)."""
    return f"{x:.{digits}f}"


# ── the engine ───────────────────────────────────────────────────────────────


def test_the_page_s_spring_is_berg_and_marshall_s_and_nearly_tuned():
    assert sp.inertia_kg_m2(S) == pytest.approx(1.45e-4, rel=1e-12)
    wz, wt = sp.alone_rates(S)
    # Their §III: ω_z = √(k/m) = 2.33 and ω_θ = √(δ/I) = 2.33 rad/s.
    assert wz == pytest.approx(2.33, abs=0.005)
    assert wt == pytest.approx(2.33, abs=0.005)
    assert abs(wz - wt) / wz < 2e-4


def test_the_two_modes_are_the_roots_of_the_two_by_two_system():
    m, inertia = S.mass_kg, sp.inertia_kg_m2(S)
    w1, w2 = sp.mode_rates(S)
    assert w1 > w2
    for w in (w1, w2):
        # det(K − ω²M) = 0 for M = diag(m, I), K = [[k, ε/2], [ε/2, δ]].
        det = (S.stiffness_n_m - w * w * m) * (S.torsion_n_m - w * w * inertia) - (S.coupling_n / 2) ** 2
        assert det == pytest.approx(0, abs=1e-15)


def test_tuned_the_paper_s_approximation_of_the_beat_holds_to_a_tenth_of_a_percent():
    # Their Eq. (12): ω_B = ε/(2ω√(mI)), for ω_B ≪ ω.
    s = sp.WilberforceSpring(nut_radius_m=sp.tuned_radius_m(S))
    w = sp.alone_rates(s)[0]
    approx = S.coupling_n / (2 * w * math.sqrt(s.mass_kg * sp.inertia_kg_m2(s)))
    assert sp.beat_s(s) == pytest.approx(2 * math.pi / approx, rel=2e-3)


def test_tuned_a_pull_goes_wholly_into_the_twist_at_half_a_beat():
    s = sp.WilberforceSpring(nut_radius_m=sp.tuned_radius_m(S))
    beat = sp.beat_s(s)
    assert sp.exchange_share(s) == pytest.approx(1.0, abs=1e-12)
    run = sp.run(s, 0.02, 0.0, beat, 0.001)
    total = run.bob_j[0]
    half = min(range(len(run.t)), key=lambda i: abs(run.t[i] - beat / 2))
    window = range(half - 50, half + 50)
    assert max(run.twist_j[i] for i in window) / total > 0.99
    assert min(run.bob_j[i] for i in window) / total < 0.01
    # And back: at the full beat it bobs again.
    assert run.bob_j[-1] / total > 0.95 or max(run.bob_j[-60:]) / total > 0.99


def test_detuned_the_share_is_rabi_s_about():
    s = sp.WilberforceSpring(nut_radius_m=0.035)
    run = sp.run(s, 0.02, 0.0, 2 * sp.beat_s(s), 0.002)
    most = max(run.twist_j) / run.bob_j[0]
    # Rabi's share is of the amplitude, normalised; the twist's energy at its
    # peak differs from it by the two rates' mismatch: within a tenth.
    assert sp.exchange_share(s) == pytest.approx(0.48, abs=0.005)
    assert most == pytest.approx(sp.exchange_share(s), abs=0.1)
    assert most < 0.5


def test_a_mode_alone_trades_nothing():
    for start in (sp.Start.FAST, sp.Start.SLOW):
        pull, twist, _, _ = sp.start_state(S, start)
        run = sp.run(S, pull, twist, 30.0)
        ratios = [z / th for z, th in zip(run.z_m, run.theta_rad, strict=True) if abs(th) > 0.2]
        assert max(ratios) - min(ratios) < 1e-6 * abs(ratios[0]), start
        # Their Eqs. (36)–(37): z₀ = ±0.0168 θ₀ for their pendulum.
        assert abs(pull) == pytest.approx(0.0168, abs=0.0001)


def test_the_engine_s_loop_is_the_tests_own_integrator_s():
    f = sp.rhs(sp.WilberforceSpring(nut_radius_m=0.03, damping_per_s=0.1))
    trace = rk4(lambda t, y: f(t, tuple(y)), [0.03, -0.5, 0.0, 0.0], 0.001, 5.0)
    run = sp.run(sp.WilberforceSpring(nut_radius_m=0.03, damping_per_s=0.1), 0.03, -0.5, 5.0)
    assert run.z_m[-1] == pytest.approx(trace.states[0][-1], rel=1e-9)
    assert run.theta_rad[-1] == pytest.approx(trace.states[1][-1], rel=1e-9)


def test_the_energy_is_kept_without_damping_and_fades_with_it():
    run = sp.run(S, 0.04, 1.5, 60.0)
    totals = [b + w + c for b, w, c in zip(run.bob_j, run.twist_j, run.coupling_j, strict=True)]
    assert max(totals) - min(totals) < 1e-10 * totals[0]
    damped = sp.run(sp.WilberforceSpring(damping_per_s=0.1), 0.02, 0.0, 20.0)
    end = damped.bob_j[-1] + damped.twist_j[-1] + damped.coupling_j[-1]
    # Both motions die away as e^(−c·t): the energy too.
    assert end / damped.bob_j[0] == pytest.approx(math.exp(-0.1 * 20.0), rel=0.02)


def test_with_no_coupling_nothing_wanders_and_there_is_no_beat():
    s = sp.WilberforceSpring(coupling_n=0.0)
    assert sp.beat_s(s) is None
    assert sp.exchange_share(s) == 0.0
    run = sp.run(s, 0.02, 0.0, 10.0)
    assert max(run.twist_j) == 0.0


def test_the_nuts_tune_only_where_the_arm_reaches():
    assert sp.tuned_radius_m(sp.WilberforceSpring(body_inertia_kg_m2=2e-4)) is None
    assert sp.tuned_radius_m(sp.WilberforceSpring(nut_kg=0.0)) is None


def test_a_far_detuned_mode_is_scaled_back_to_a_hand_s_pull():
    s = sp.WilberforceSpring(nut_radius_m=0.1, nut_kg=0.1)
    pull, twist, _, _ = sp.start_state(s, sp.Start.FAST)
    assert abs(pull) == pytest.approx(sp.MAX_PULL_M)
    assert 0 < twist < sp.START_TWIST_RAD


@pytest.mark.parametrize(
    ("kwargs", "words"),
    [
        ({"mass_kg": 0.01}, "50 g"),
        ({"stiffness_n_m": 0.1}, "stiffness"),
        ({"torsion_n_m": 1.0}, "torsion"),
        ({"coupling_n": 0.06}, "coupling"),
        ({"stiffness_n_m": 0.5, "torsion_n_m": 1e-5, "coupling_n": 0.01}, "no rest"),
        ({"body_inertia_kg_m2": 1.0}, "inertia"),
        ({"nut_kg": 0.5}, "nut"),
        ({"nut_radius_m": 0.2}, "10 cm"),
        ({"damping_per_s": 2.0}, "damping"),
    ],
)
def test_the_spring_refuses_what_cannot_hang(kwargs: dict[str, float], words: str):
    with pytest.raises(ValueError, match=words):
        sp.WilberforceSpring(**kwargs)


def test_a_run_refuses_a_pull_or_twist_past_a_hand_s():
    with pytest.raises(ValueError, match="6 cm"):
        sp.run(S, 0.07, 0.0, 1.0)
    with pytest.raises(ValueError, match="half a turn"):
        sp.run(S, 0.0, 4.0, 1.0)
    with pytest.raises(ValueError):
        sp.run(S, 0.02, 0.0, 1000.0)


# ── the prose ────────────────────────────────────────────────────────────────


def test_at_the_exhibit_over_and_back_takes_27_3_s():
    assert round(sp.beat_s(S), 1) == 27.3
    assert f"{_de(sp.beat_s(S), 1)} s" in PAGE["at"]["trade"]


def test_the_nuts_tune_the_page_s_spring_at_20_0_mm():
    tuned = sp.tuned_radius_m(S)
    assert round(tuned * 1000, 1) == 20.0
    assert f"{_de(tuned * 1000, 1)} mm" in PAGE["change"]["nuts_hint"]


def test_at_35_mm_about_half_goes_over_and_the_bobbing_returns_after_19_9_s():
    s = sp.WilberforceSpring(nut_radius_m=0.035)
    assert round(100 * sp.exchange_share(s)) == 48
    assert round(sp.beat_s(s), 1) == 19.9
    assert "48 %" in PAGE["sweet"]["tuned"]
    assert "19.9 s" in PAGE["sweet"]["tuned"]


def test_a_nut_weighs_10_g_and_the_buttons_pull_2_cm_and_twist_1_rad():
    assert S.nut_kg == 0.010 and sp.NUTS == 4
    assert "10 g" in PAGE["symbols"]["mn"]
    assert sp.START_PULL_M == 0.02 and sp.START_TWIST_RAD == 1.0
    assert "2 cm" in CASES["energy"]["setting"]
    assert "1 rad" in CASES["fast_mode"]["setting"]


# ── the checks ───────────────────────────────────────────────────────────────


@pytest.fixture
def result_of(check_results: Callable[[str], tuple[checks.Result, ...]]) -> Callable[[str], checks.Result]:
    def find(key: str) -> checks.Result:
        (found,) = [r for r in check_results("spring") if r.key == key]
        return found

    return find


def test_every_spring_case_holds_within_its_tolerance(check_results: Callable[[str], tuple[checks.Result, ...]]):
    results = check_results("spring")
    assert [r.key for r in results] == ["fast_mode", "slow_mode", "beat", "measured", "energy"]
    for r in results:
        assert r.deviation <= r.tolerance, r.key
        assert r.sources and all(s.url.startswith("https://") for s in r.sources)


def test_the_cases_words_state_the_figures_the_checks_compute(result_of: Callable[[str], checks.Result]):
    assert _de(result_of("fast_mode").expected, 6) in CASES["fast_mode"]["why"]
    assert _de(result_of("slow_mode").expected, 6) in CASES["slow_mode"]["why"]
    assert _de(result_of("beat").expected, 5) in CASES["beat"]["why"]
    measured = result_of("measured")
    assert _de(measured.expected, 2) in CASES["measured"]["reads"]
    assert _de(measured.measured, 2) in CASES["measured"]["why"]
    assert f"{_de(100 * measured.deviation, 1)} %" in CASES["measured"]["why"]
    energy = result_of("energy")
    assert f"{_de(energy.expected, 6)} mJ" in CASES["energy"]["why"]
    assert f"{_de(energy.expected, 2)} mJ" in CASES["energy"]["reads"]


def test_the_slower_mode_is_pushed_up_and_the_faster_pulled_down():
    assert sp.start_state(S, sp.Start.FAST)[0] > 0
    assert sp.start_state(S, sp.Start.SLOW)[0] < 0


# ── the browser's cases ──────────────────────────────────────────────────────


def test_the_browser_s_cases_cross_every_branch_the_page_can_reach():
    stored: dict[str, Any] = json.loads(
        (ROOT / "frontend/src/features/experiments/simulate/engine-cases.json").read_text(encoding="utf-8")
    )
    cases = stored["spring"]
    assert {c["start"] for c in cases} == {"down", "twisted", "fast", "slow", None}, "every start and a hand"
    assert any(c["beat_s"] is None for c in cases), "no coupling"
    assert any(c["s"]["damping_per_s"] > 0 for c in cases), "a damped spring"
    assert any(c["exchange_share"] < 0.5 for c in cases), "detuned"
    assert any(abs(c["pull_m"]) == pytest.approx(sp.MAX_PULL_M) for c in cases), "a mode's pull scaled back"
    assert any(c["step_s"] != sp.STEP_S for c in cases), "a coarse step"
