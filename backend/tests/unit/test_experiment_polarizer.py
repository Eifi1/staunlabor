"""The third polarising filter: the engine, every figure its page states, and its checks."""

from __future__ import annotations

import itertools
import math

import pytest

from staunlabor.domain import checks
from staunlabor.domain.experiments import polarizer as p

pytestmark = pytest.mark.unit


def _mueller_through(angles_deg: list[float], sheet: p.Sheet) -> list[float]:
    """The same stack by Mueller matrices on the Stokes vector (I, Q, U): a
    linear diattenuator with principal transmittances k₁ and k₂, a second way
    to the engine's Jones matrices that shares nothing with them but the sheet."""
    k1 = sheet.transmission
    k2 = sheet.transmission * sheet.extinction
    stokes = (1.0, 0.0, 0.0)
    out = []
    for angle in angles_deg:
        c, s = math.cos(math.radians(2 * angle)), math.sin(math.radians(2 * angle))
        a, b, r = (k1 + k2) / 2, (k1 - k2) / 2, math.sqrt(k1 * k2)
        m = (
            (a, b * c, b * s),
            (b * c, a * c * c + r * s * s, (a - r) * s * c),
            (b * s, (a - r) * s * c, a * s * s + r * c * c),
        )
        stokes = (
            m[0][0] * stokes[0] + m[0][1] * stokes[1] + m[0][2] * stokes[2],
            m[1][0] * stokes[0] + m[1][1] * stokes[1] + m[1][2] * stokes[2],
            m[2][0] * stokes[0] + m[2][1] * stokes[1] + m[2][2] * stokes[2],
        )
        out.append(stokes[0])
    return out


@pytest.mark.parametrize("sheet", [p.IDEAL, p.POLAROID, p.Sheet(transmission=0.5, extinction=0.1)])
def test_the_jones_chain_is_the_mueller_chain_for_ideal_and_real_sheets(sheet: p.Sheet):
    for angles in ([0.0], [0.0, 90.0], [0.0, 45.0, 90.0], [10.0, -35.0, 120.0, 181.5, 90.0], p.evenly(7)):
        assert p.through(angles, sheet) == pytest.approx(_mueller_through(angles, sheet), abs=1e-15)


def test_an_ideal_chain_is_malus_s_law_filter_by_filter():
    angles = [0.0, 20.0, 75.0, 130.0, 90.0]
    light = p.through(angles)
    assert light[0] == 0.5
    for before, after, turn in zip(light[:-1], light[1:], [b - a for a, b in itertools.pairwise(angles)], strict=True):
        assert after == pytest.approx(before * math.cos(math.radians(turn)) ** 2, abs=1e-15)


def test_the_ideal_figures_the_page_states():
    f = p.figures(p.IDEAL)
    assert f.one == 0.5 and f.parallel == 0.5
    assert f.crossed < 1e-30
    assert f.third == pytest.approx(1 / 8) and f.third_of_first == pytest.approx(1 / 4)
    # The middle at 30 degrees lets through 9.4 per cent.
    assert round(100 * p.three(30.0), 1) == 9.4
    # Ten between let through 40 per cent, sixty 48.
    assert round(100 * p.stacked(10)) == 40
    assert round(100 * p.stacked(60)) == 48
    assert f.best_between == p.MOST_BETWEEN == 60


def test_the_middle_filter_s_curve_is_an_eighth_of_sin_squared_twice_its_angle():
    for k in range(181):
        assert p.three(float(k)) == pytest.approx(math.sin(math.radians(2 * k)) ** 2 / 8, abs=1e-15)
    best = max(range(91), key=lambda k: p.three(float(k)))
    assert best == 45
    assert p.three(0.0) < 1e-30 and p.three(90.0) < 1e-30


def test_the_middle_filter_turns_the_light_to_its_own_axis():
    """The trick: after the middle filter the light is polarised along the
    middle's axis, not the first's: the last, crossed with the first, takes it
    as Malus says for 45°, and one along the middle would take all of it."""
    after_middle = p.through((0.0, 45.0))[-1]
    assert p.through((0.0, 45.0, 45.0))[-1] == pytest.approx(after_middle)
    assert p.through((0.0, 45.0, 135.0))[-1] < 1e-30
    assert p.three(45.0) == pytest.approx(after_middle / 2)


def test_many_filters_between_tend_to_a_half_and_match_the_closed_form():
    lights = [p.stacked(n) for n in range(p.MOST_BETWEEN + 1)]
    closed = [0.5 * math.cos(math.radians(90 / (n + 1))) ** (2 * (n + 1)) for n in range(p.MOST_BETWEEN + 1)]
    assert lights == pytest.approx(closed, abs=1e-14)
    assert all(a < b for a, b in itertools.pairwise(lights))
    assert 0.48 < lights[-1] < 0.5
    # For many filters what is lost is about pi squared over eight times the steps.
    assert 0.5 - lights[-1] == pytest.approx(math.pi**2 / (8 * 61), rel=0.02)


def test_the_polaroid_figures_the_page_states():
    f = p.figures(p.POLAROID)
    assert (p.POLAROID.transmission, p.POLAROID.extinction) == (0.76, 0.002)
    assert round(100 * f.one) == 38
    assert round(100 * f.parallel) == 29
    assert round(100 * f.crossed, 2) == 0.12
    assert f.crossed == pytest.approx(0.76**2 * 0.002)
    assert round(100 * f.third, 1) == 5.0
    assert round(100 * f.third_of_first) == 13
    assert f.best_between == 2 and round(100 * f.best, 1) == 6.6
    # With the third between, 44 times as bright as the crossed pair alone.
    assert round(f.third / f.crossed) == 44
    # Ten Polaroid sheets between let through 1.5 per cent, against the ideal 40.
    assert round(100 * p.stacked(10, p.POLAROID), 1) == 1.5


def test_the_sheets_and_stacks_refuse_what_they_cannot_be():
    with pytest.raises(ValueError):
        p.Sheet(transmission=0.05)
    with pytest.raises(ValueError):
        p.Sheet(transmission=1.2)
    with pytest.raises(ValueError):
        p.Sheet(extinction=0.6)
    with pytest.raises(ValueError):
        p.Sheet(extinction=-0.01)
    with pytest.raises(ValueError):
        p.through(())
    with pytest.raises(ValueError):
        p.through([0.0] * (p.MOST_BETWEEN + 3))
    with pytest.raises(ValueError):
        p.evenly(-1)
    with pytest.raises(ValueError):
        p.stacked(p.MOST_BETWEEN + 1)


def test_every_check_case_holds_within_its_tolerance():
    results = checks.results("polarizer")
    assert [r.key for r in results] == [
        "half",
        "malus",
        "crossed",
        "third",
        "slanted",
        "many",
        "polaroid_one",
        "polaroid_crossed",
    ]
    for r in results:
        assert r.deviation <= r.tolerance, r.key
    by_key = {r.key: r for r in results}
    assert by_key["third"].measured == pytest.approx(0.125)
    assert by_key["slanted"].expected == pytest.approx(3 / 32)
    assert round(100 * by_key["polaroid_one"].measured, 2) == 38.08
