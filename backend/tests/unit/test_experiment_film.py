"""The soap film between two rings: the engine's catenoids, the tear and the
equal-area distance, every figure the page's prose states, and its refusals."""

from __future__ import annotations

import math

import pytest

from staunlabor.domain import checks
from staunlabor.domain.experiments import film

pytestmark = pytest.mark.unit

R = film.EXHIBIT_RADIUS_M


def _both(distance: float, radius: float = R) -> tuple[film.Catenoid, film.Catenoid]:
    both = film.catenoids(film.Rings(radius, distance))
    assert both is not None
    return both


def test_both_catenoids_reach_the_rings_and_the_wide_one_has_the_smaller_area():
    for ratio in (0.05, 0.3, 0.7, 1.0, 1.2, 1.32):
        h = ratio * R
        for c in _both(h):
            assert film.radius_at(c.neck_m, h / 2) == pytest.approx(R, rel=1e-12)
            assert film.radius_at(c.neck_m, -h / 2) == pytest.approx(R, rel=1e-12)
        wide, thin = _both(h)
        assert wide.neck_m > thin.neck_m and wide.area_m2 < thin.area_m2


def test_the_area_is_the_profile_s_own_integral():
    """π·c·(h + c·sinh(h/c)) against a midpoint sum of 2πr·√(1 + r'²)."""
    h = 0.8 * R
    for c in _both(h):
        n = 20000
        dz = h / n
        total = 0.0
        for j in range(n):
            z = -h / 2 + (j + 0.5) * dz
            r = film.radius_at(c.neck_m, z)
            slope = math.sinh(z / c.neck_m)
            total += 2 * math.pi * r * math.sqrt(1 + slope**2) * dz
        assert c.area_m2 == pytest.approx(total, rel=1e-7)


def test_the_film_tears_past_1_3255_radii_where_t_tanh_t_is_one():
    assert film.TANGENT_T * math.tanh(film.TANGENT_T) == pytest.approx(1, abs=1e-15)
    assert round(film.TANGENT_T, 4) == 1.1997
    assert round(film.TEAR_RATIO, 4) == 1.3255
    assert film.catenoids(film.Rings(R, film.TEAR_RATIO * R * (1 - 1e-9))) is not None
    assert film.tears(film.Rings(R, film.TEAR_RATIO * R * (1 + 1e-9)))
    # On the page's 5 cm rings: at 6.63 cm, two thirds of a diameter.
    assert round(film.figures(film.Rings()).tear_m * 100, 2) == 6.63
    assert round(film.TEAR_RATIO / 2, 2) == 0.66


def test_at_the_tear_the_two_catenoids_meet_the_waist_at_55_percent_and_a_fifth_more_area_than_the_discs():
    wide, thin = _both(film.TEAR_RATIO * R * (1 - 1e-12))
    # The two part as the square root of the distance short of the tear.
    assert wide.neck_m == pytest.approx(thin.neck_m, rel=1e-5)
    assert round(wide.neck_m / R * 100) == 55
    share = wide.area_m2 / film.discs_m2(R)
    assert share == pytest.approx(film.TANGENT_T, rel=1e-9)
    assert round(share, 2) == 1.20


def test_two_discs_have_less_area_from_1_055_radii_on():
    assert round(film.EQUAL_RATIO, 3) == 1.055
    assert round(film.EQUAL_RATIO * R * 100, 2) == 5.28
    below = film.figures(film.Rings(R, film.EQUAL_RATIO * R * (1 - 1e-9)))
    above = film.figures(film.Rings(R, film.EQUAL_RATIO * R * (1 + 1e-9)))
    assert below.least and not above.least
    assert below.area_m2 == pytest.approx(below.discs_m2, rel=1e-8)


def test_the_hand_starts_the_film_a_centimetre_apart_nearly_a_cylinder():
    f = film.figures(film.Rings())
    assert f.neck_m is not None and f.area_m2 is not None and f.least
    assert round(f.neck_m * 100, 2) == 4.97
    assert round(f.area_m2 * 1e4) == 31
    assert round(f.discs_m2 * 1e4) == 157


def test_mathworld_s_rings_a_radius_apart_have_its_two_waists_and_areas():
    """MathWorld's figures are cut off after four places ("0.2350..."), not rounded."""
    wide, thin = _both(1.0, 1.0)
    assert [math.floor(v * 1e4) for v in (wide.neck_m, thin.neck_m)] == [8483, 2350]
    assert [math.floor(v * 1e4) for v in (wide.area_m2, thin.area_m2)] == [59917, 68456]


def test_the_thin_catenoid_tends_to_the_two_discs_as_the_rings_close():
    _, thin = _both(0.0001, 1.0)
    assert thin.area_m2 == pytest.approx(film.discs_m2(1.0), rel=1e-3)


def test_the_film_refuses_what_it_cannot_be():
    for radius, distance in ((0.0, 0.01), (1.5, 0.01), (0.05, 0.0), (0.05, -0.01), (0.05, 2.5)):
        with pytest.raises(ValueError):
            film.Rings(radius, distance)


def test_every_check_holds_to_its_tolerance():
    for result in checks.results("film"):
        assert result.deviation <= result.tolerance, result.key
