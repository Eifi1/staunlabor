"""The standing string's engine against the physics its page states.

Every figure in the page's catalogue sentences is asserted here: the pulls for
one, two, three loops at the vibrator's hundred hertz, how wide the loops
swing there and between, the tones of the check cases, the wave's speed. The
steady swing's closed form is held to the wave equation it solves, by
differences written here, and the time loop to the closed form.
"""

from __future__ import annotations

import cmath
import math
from dataclasses import replace

import pytest

from staunlabor.domain import experiments as x
from staunlabor.domain.checks import results
from staunlabor.domain.experiments import string

pytestmark = pytest.mark.unit

CORD = string.Cord()
HZ = string.VIBRATOR_HZ


def test_the_page_s_cord_is_a_metre_of_thin_elastic_cord_shaken_a_hundred_times_a_second():
    assert (CORD.length_m, CORD.tension_n, CORD.density_kg_m, CORD.damping_per_s, CORD.drive_m) == (
        1.0,
        3.0,
        0.0005,
        12.0,
        0.002,
    )
    assert HZ == 100
    assert string.MODES == 40
    assert x.StringCord is string.Cord


def test_at_a_hundred_hertz_twenty_five_and_two_point_two_two_newtons_give_one_two_and_three_loops():
    f = string.figures(CORD)
    assert [round(p, 2) for p in f.pulls_n] == [20.0, 5.0, 2.22, 1.25, 0.8, 0.56]
    assert round(string.half_waves(CORD, HZ), 2) == 2.58
    # The peak the hand finds lies a little above the formula's pull, by the
    # same share for every loop count.
    for formula, peak in zip(f.pulls_n, f.peak_pulls_n, strict=True):
        assert 2.5e-4 < peak / formula - 1 < 3e-4
    for n, peak in enumerate(f.peak_pulls_n, start=1):
        assert string.loops(replace(CORD, tension_n=peak), HZ) == n
    assert round(string.pull_n(CORD, HZ, 2.5), 1) == 3.2


def test_one_loop_swings_67_mm_three_22_mm_eleven_times_the_vibrator_and_between_only_the_vibrator_s_2_mm():
    f = string.figures(CORD)
    assert [round(w * 1000) for w in f.peak_widths_m[:3]] == [67, 33, 22]
    assert round(f.peak_widths_m[2] / CORD.drive_m) == 11
    assert round(f.between_m * 1000, 1) == 2.0 == CORD.drive_m * 1000
    # At a given tone a loop swings as the wave's speed, so about 1/n as wide
    # as one (to 1 % up to six).
    for n, width in enumerate(f.peak_widths_m, start=1):
        assert width * n == pytest.approx(f.peak_widths_m[0], rel=1e-2)
    # The weak-damping limit 2vA/(γL) is the peak to 0.2 %.
    assert f.peak_widths_m[2] == pytest.approx(f.three_limit_m, rel=2e-3)


def test_four_times_the_pull_doubles_every_tone():
    for n in range(1, 7):
        assert string.mode_hz(replace(CORD, tension_n=4 * CORD.tension_n), n) == pytest.approx(
            2 * string.mode_hz(CORD, n), rel=1e-15
        )
    hi = string.figures(replace(CORD, tension_n=20.0))
    lo = string.figures(replace(CORD, tension_n=5.0))
    assert hi.tones_hz == pytest.approx(tuple(2 * f for f in lo.tones_hz), rel=1e-15)


def test_the_check_cases_figures_are_these():
    by_key = {r.key: r for r in results("string")}
    assert round(by_key["fundamental"].measured, 2) == 38.72
    assert round(by_key["fundamental"].expected, 2) == 38.73
    assert round(by_key["fundamental"].deviation * 100, 2) == 0.03
    assert round(by_key["third"].measured, 2) == 116.19
    assert by_key["third"].measured / by_key["fundamental"].expected == pytest.approx(3, rel=1e-4)
    assert round(by_key["pull"].measured, 4) == 2.2228 and round(by_key["pull"].expected, 4) == 2.2222
    assert by_key["loops"].measured == 3
    assert round(by_key["speed"].measured, 2) == 77.45 and round(by_key["speed"].expected, 2) == 77.46
    assert round(by_key["speed"].deviation * 100, 2) == 0.01
    assert round(by_key["settled"].measured, 3) == 22.215
    assert by_key["settled"].deviation < 1e-7
    assert all(r.deviation <= r.tolerance for r in by_key.values())


def test_the_steady_swing_solves_the_damped_wave_equation_and_holds_both_ends():
    """μ·y_tt + μγ·y_t = T·y_xx for y = Im[Y·e^{iΩt}]: −Ω²Y + iγΩY = v²Y''. Y''
    by central differences."""
    for drive in (37.0, 100.0, 151.3):
        big = 2 * math.pi * drive
        v2 = CORD.tension_n / CORD.density_kg_m
        h = 1e-4
        for xm in (0.11, 0.37, 0.62, 0.9):
            y = string.steady(CORD, drive, xm)
            curve = (string.steady(CORD, drive, xm + h) - 2 * y + string.steady(CORD, drive, xm - h)) / h**2
            assert abs((-(big**2) + 1j * CORD.damping_per_s * big) * y - v2 * curve) < 1e-5 * abs(big**2 * y) + 1e-9
        assert string.steady(CORD, drive, 0.0) == pytest.approx(CORD.drive_m, abs=1e-15)
        assert abs(string.steady(CORD, drive, CORD.length_m)) < 1e-15


def test_the_widest_swing_is_the_largest_along_the_cord():
    for drive in (20.0, 38.7, 60.0, 100.0, 199.0):
        along = max(abs(string.steady(CORD, drive, CORD.length_m * k / 4000)) for k in range(4001))
        assert string.widest_m(CORD, drive) == pytest.approx(along, rel=1e-6)


def test_the_time_loop_settles_on_the_steady_swing_whatever_the_frames():
    cord = replace(CORD, tension_n=string.pull_n(CORD, HZ, 3))
    a, b = string.start(), string.start()
    for _ in range(300):
        a = string.step(cord, a, HZ, 1 / 60)
    for _ in range(100):
        b = string.step(cord, b, HZ, 0.05)
    # Exact steps: the frames' lengths do not matter.
    assert a.t == pytest.approx(b.t) and max(abs(p - q) for p, q in zip(a.q, b.q, strict=True)) < 1e-13
    # The modes left out: 10⁻⁴ of the widest swing along the cord, under 10⁻⁷ of
    # it at the middle antinode.
    widest = string.widest_m(cord, HZ)
    for k in range(101):
        xm = cord.length_m * k / 100
        assert abs(string.swing_m(cord, a, HZ, xm) - abs(string.steady(cord, HZ, xm))) < 2e-4 * widest
    assert string.swing_m(cord, a, HZ, 0.5) == pytest.approx(abs(string.steady(cord, HZ, 0.5)), rel=1e-7)
    for xm in (0.1, 0.5, 0.83):
        # The strobe at the vibrator's own phase is the cord as it stands.
        assert string.strobe_m(cord, a, HZ, xm, 0.0) == pytest.approx(string.place_m(cord, a, xm), abs=1e-15)
        # A quarter turn on, the steady cord: Im[Y·e^{i(θ + π/2)}].
        later = (string.steady(cord, HZ, xm) * cmath.exp(1j * (a.theta + math.pi / 2))).imag
        assert string.strobe_m(cord, a, HZ, xm, math.pi / 2) == pytest.approx(later, abs=2e-4 * widest)


def test_from_rest_a_loop_swings_up_to_one_less_a_e_th_in_0_14_seconds():
    cord = replace(CORD, tension_n=string.pull_n(CORD, HZ, 3))
    target = (1 - 1 / math.e) * abs(string.steady(cord, HZ, 0.5))
    s = string.start()
    while string.swing_m(cord, s, HZ, 0.5) < target:
        s = string.step(cord, s, HZ, 1e-3)
    assert round(s.t, 2) == 0.14


def test_half_waves_are_whole_exactly_at_the_cord_s_tones():
    for n in range(1, 7):
        assert string.half_waves(CORD, string.mode_hz(CORD, n)) == pytest.approx(n, rel=1e-15)
        assert string.half_waves(replace(CORD, tension_n=string.pull_n(CORD, HZ, n)), HZ) == pytest.approx(n)


def test_the_engine_refuses_what_is_no_cord_or_no_drive():
    with pytest.raises(ValueError, match="peg"):
        string.Cord(length_m=0.1)
    with pytest.raises(ValueError, match="pulled"):
        string.Cord(tension_n=200)
    with pytest.raises(ValueError, match="no longer swings"):
        string.Cord(tension_n=0.05, density_kg_m=0.1, length_m=5, damping_per_s=20)
    with pytest.raises(ValueError, match="vibrator runs"):
        string.steady(CORD, 0.0, 0.5)
    with pytest.raises(ValueError, match="step"):
        string.step(CORD, string.start(), 100.0, 0.1)
    with pytest.raises(ValueError, match="loop"):
        string.mode_hz(CORD, 0)
    with pytest.raises(ValueError, match="loop"):
        string.resonance_pull_n(CORD, HZ, 0)
    with pytest.raises(ValueError, match="half-waves"):
        string.node_spacing_m(CORD, 40.0)
