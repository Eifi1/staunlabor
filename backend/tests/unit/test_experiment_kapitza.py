"""Kapitza's pendulum: the engine, the figures its page states, and its checks.

Every number in the page's prose (`experiments.kapitza.*`) and in its check
cases' words (`experiments.checks.cases.kapitza.*`) is asserted here.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import pytest

from staunlabor.domain import checks
from staunlabor.domain.experiments import kapitza as k

pytestmark = pytest.mark.unit

ROOT = Path(__file__).resolve().parents[3]
PAGE = k.KapitzaPendulum()
UNDAMPED = k.KapitzaPendulum(damping_per_s=0.0)


def _a0(q: float) -> float:
    """DLMF 28.6.1, written out again here."""
    return -(q**2) / 2 + 7 * q**4 / 128 - 29 * q**6 / 2304 + 68687 * q**8 / 18874368


def _at(share: float) -> k.KapitzaPendulum:
    return k.KapitzaPendulum(length_m=0.2, amplitude_m=0.2 * share, damping_per_s=0.0)


# ── the page's build and its prose ───────────────────────────────────────────


def test_the_page_s_rod_is_20_cm_shaken_by_a_centimetre_40_times_a_second() -> None:
    assert (PAGE.length_m, PAGE.amplitude_m, PAGE.frequency_hz) == (0.2, 0.01, 40.0)


def test_kapitza_s_bound_for_the_page_s_rod_is_31_5_hz_and_its_drive_holds_the_top() -> None:
    assert k.kapitza_frequency_hz(PAGE) == pytest.approx(31.52, abs=0.005)
    assert round(k.kapitza_frequency_hz(PAGE), 1) == 31.5
    assert k.stable(PAGE, "top")
    assert k.stable(PAGE, "bottom")


def test_the_exact_bound_lies_0_002_0_055_and_0_86_percent_above_kapitza_s() -> None:
    gaps = {
        share: k.least_frequency_hz(_at(share)) / k.kapitza_frequency_hz(_at(share)) - 1 for share in (0.01, 0.05, 0.2)
    }
    assert round(gaps[0.01] * 100, 3) == 0.002
    assert round(gaps[0.05] * 100, 3) == 0.055
    assert round(gaps[0.2] * 100, 2) == 0.86
    # The next term of the expansion, (7/32)(a/l)², says the same for small strokes.
    assert gaps[0.01] == pytest.approx(7 / 32 * 0.01**2, rel=1e-3)


def test_damping_raises_the_bound_a_little_and_the_page_s_rod_wobbles_in_1_15_s() -> None:
    raised = k.least_frequency_hz(PAGE) / k.least_frequency_hz(UNDAMPED) - 1
    assert f"{raised:.1e}" == "1.1e-06"
    assert round(k.least_frequency_hz(PAGE), 2) == 31.54
    assert round(2 * math.pi / k.floquet_rate_top(PAGE), 2) == 1.15
    band = k.swing_up_band_hz(PAGE)
    assert band is not None
    assert (round(band[0], 2), round(band[1], 2)) == (2.14, 2.34)


def test_the_time_loop_steps_a_hundredth_of_a_period_never_longer_than_a_millisecond() -> None:
    assert k.STEPS_PER_PERIOD == 100
    assert k.step_for(PAGE) == pytest.approx(1 / 40 / 100)
    assert k.step_for(k.KapitzaPendulum(frequency_hz=2.0)) == pytest.approx(0.5 / 500)
    assert k.step_for(k.KapitzaPendulum(frequency_hz=0.0)) == k.STEP_S
    assert k.FLOQUET_STEPS == 1000
    assert k.HALVINGS == 40


def test_the_rod_s_own_swing_and_the_band_that_swings_it_up_at_the_page_s_damping() -> None:
    assert round(k.own_frequency_hz(PAGE), 2) == 1.11
    band = k.swing_up_band_hz(PAGE)
    assert band is not None
    assert band[0] < 2 * k.own_frequency_hz(PAGE) < band[1]
    assert band[0] < 2.23 < band[1], "the page's preset swings it up"
    assert not k.stable(k.KapitzaPendulum(frequency_hz=2.23), "bottom")
    assert k.swing_up_band_hz(k.KapitzaPendulum(damping_per_s=1.0)) is None, "a damping that holds it"


def test_the_presets_hold_the_top_and_swing_the_hanging_rod_up() -> None:
    assert k.stable(k.KapitzaPendulum(amplitude_m=0.04, frequency_hz=9.0), "top")
    assert not k.stable(k.KapitzaPendulum(frequency_hz=25.0), "top")


# ── the engine ───────────────────────────────────────────────────────────────


def test_without_the_motor_the_top_falls_and_with_it_the_rod_stands_and_returns() -> None:
    off = k.run(k.KapitzaPendulum(frequency_hz=0.0), 177.0, 3.0)
    assert min(abs(a) for a in off.theta_deg) < 30, "it falls through the bottom"
    on = k.run(PAGE, 160.0, 10.0)
    assert all(abs(a - 180) < 22 for a in on.theta_deg), "20° off, it wobbles about the top"
    assert abs(on.theta_deg[-1] - 180) < 5, "and the damping settles it there: e^(−ct/2) of 20°"


def test_the_monodromy_s_determinant_is_liouville_s_e_to_the_minus_c_t() -> None:
    (m11, m12), (m21, m22) = k.monodromy(PAGE, "top")
    assert m11 * m22 - m12 * m21 == pytest.approx(math.exp(-PAGE.damping_per_s / PAGE.frequency_hz), rel=1e-10)
    (m11, m12), (m21, m22) = k.monodromy(UNDAMPED, "bottom")
    assert m11 * m22 - m12 * m21 == pytest.approx(1.0, abs=1e-10)


def test_the_floquet_boundary_is_mathieu_s_a0_curve() -> None:
    for share in (0.01, 0.05, 0.2):
        rod = _at(share)
        series = math.sqrt(4 * k.G / (rod.length_m * abs(_a0(2 * share)))) / (2 * math.pi)
        assert k.least_frequency_hz(rod) == pytest.approx(series, rel=2e-6)


def test_the_slow_wobble_from_the_multipliers_is_kapitza_s_to_two_thousandths() -> None:
    assert k.floquet_rate_top(UNDAMPED) == pytest.approx(k.slow_rate_top(UNDAMPED), rel=2e-3)
    assert k.slow_rate_bottom(UNDAMPED) > k.slow_rate_top(UNDAMPED)
    assert k.slow_rate_top(k.KapitzaPendulum(frequency_hz=25.0)) is None
    assert k.floquet_rate_top(k.KapitzaPendulum(frequency_hz=25.0)) is None


def test_the_multipliers_are_one_pair_on_the_circle_or_a_real_pair_one_outside() -> None:
    assert k.multipliers(UNDAMPED, "top") == pytest.approx((1.0, 1.0), abs=1e-9)
    big, small = k.multipliers(k.KapitzaPendulum(frequency_hz=25.0, damping_per_s=0.0), "top")
    assert big > 1 > small
    assert big * small == pytest.approx(1.0, rel=1e-9)


def test_kapitza_s_potential_is_a_hill_at_the_top_without_shaking_and_a_hollow_with_it() -> None:
    still = k.KapitzaPendulum(amplitude_m=0.0)
    top, beside = math.pi, math.pi - 0.1
    assert k.effective_potential(still, top) > k.effective_potential(still, beside)
    assert k.effective_potential(PAGE, top) < k.effective_potential(PAGE, beside)
    assert k.effective_potential(PAGE, top) == pytest.approx(k.G * PAGE.length_m)


def test_without_shaking_there_is_no_bound_and_the_top_never_holds() -> None:
    still = k.KapitzaPendulum(amplitude_m=0.0)
    assert k.kapitza_frequency_hz(still) is None
    assert k.least_frequency_hz(still) is None
    assert k.swing_up_band_hz(still) is None
    assert not k.stable(still, "top")
    assert k.stable(still, "bottom")


def test_it_refuses_what_it_cannot_model() -> None:
    with pytest.raises(ValueError):
        k.KapitzaPendulum(amplitude_m=0.07)
    with pytest.raises(ValueError):
        k.KapitzaPendulum(frequency_hz=250.0)
    with pytest.raises(ValueError):
        k.KapitzaPendulum(length_m=0.01)
    with pytest.raises(ValueError):
        k.KapitzaPendulum(damping_per_s=6.0)
    with pytest.raises(ValueError):
        k.start_state(190.0)
    with pytest.raises(ValueError):
        k.monodromy(k.KapitzaPendulum(frequency_hz=0.0))
    with pytest.raises(ValueError):
        k.monodromy(PAGE, "side")


# ── the checks and their words ───────────────────────────────────────────────


@pytest.fixture(scope="module")
def results() -> dict[str, checks.Result]:
    return {r.key: r for r in checks.results("kapitza")}


def test_every_case_holds_within_its_tolerance(results: dict[str, checks.Result]) -> None:
    assert set(results) == {"bound", "mathieu", "wobble", "swing_up"}
    for r in results.values():
        assert r.deviation <= r.tolerance, r.key


def test_the_figures_the_cases_words_state(results: dict[str, checks.Result]) -> None:
    bound, mathieu, wobble, band = results["bound"], results["mathieu"], results["wobble"], results["swing_up"]
    assert round(bound.expected, 2) == 157.61
    assert round(bound.deviation, 6) == pytest.approx(2.2e-5, abs=1e-7)
    assert round(mathieu.expected, 4) == 7.9478
    assert round(k.kapitza_frequency_hz(_at(0.2)), 2) == 7.88
    assert f"{mathieu.deviation:.1e}" == "7.5e-07"
    assert round(wobble.expected, 4) == 1.1486
    assert round(wobble.measured, 4) == 1.1483
    assert f"{wobble.deviation:.1e}" == "3.0e-04"
    assert round(wobble.expected * PAGE.frequency_hz) == 46
    assert round(band.expected, 5) == 0.22469
    assert band.deviation < 5e-12
    edges = k.swing_up_band_hz(k.KapitzaPendulum(frequency_hz=2.23, damping_per_s=0.0))
    assert edges is not None
    assert (round(edges[0], 4), round(edges[1], 4)) == (2.1264, 2.3511)


def test_a_case_s_setting_is_what_the_page_can_set(results: dict[str, checks.Result]) -> None:
    for r in results.values():
        rod = k.KapitzaPendulum(**{key: v for key, v in r.setting.items() if key != "start_deg"})
        assert 1 <= rod.frequency_hz <= 200, "the frequency slider's range"
        assert 0.001 <= rod.amplitude_m <= 0.04, "the stroke slider's range"
        assert -180 <= float(r.setting["start_deg"]) <= 180


def test_the_catalogue_has_every_case_in_every_language() -> None:
    for lang in ("de-CH", "en", "es", "fr", "hu", "it", "zh"):
        catalogue = json.loads((ROOT / f"frontend/src/shared/i18n/locales/{lang}.json").read_text(encoding="utf-8"))
        cases = catalogue["experiments"]["checks"]["cases"]["kapitza"]
        for case in checks.cases("kapitza"):
            words = cases[case.key]
            assert {"title", "setting", "reads", "why"} <= set(words), (lang, case.key)
            assert ("step" in words) == case.derived, (lang, case.key)
