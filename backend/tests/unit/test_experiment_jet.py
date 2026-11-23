"""The light in the water jet: the engine, every figure its page states, and its checks."""

from __future__ import annotations

import math

import pytest

from staunlabor.domain import checks
from staunlabor.domain.experiments import jet as j
from staunlabor.domain.experiments.constants import G

pytestmark = pytest.mark.unit


def _nearest_on_axis(jet: j.Jet, x: float, y: float) -> tuple[float, float]:
    """The point's distance from the axis, and the axis's nearest point's x,
    by a plain search over the axis, finely and then more finely round the
    best: a second way to the engine's Newton steps."""
    k = G / (2 * 2 * G * jet.level_m)

    def d2(u: float) -> float:
        return (x - u) ** 2 + (y + k * u * u) ** 2

    lo, hi = x - 0.05, x + 0.05
    best = x
    for _ in range(8):
        us = [lo + (hi - lo) * i / 200 for i in range(201)]
        best = min(us, key=d2)
        span = (hi - lo) / 100
        lo, hi = best - span, best + span
    return math.sqrt(d2(best)), best


def test_the_jet_leaves_at_torricelli_s_speed_bends_with_twice_the_level_and_lands_two_root_h_h_out():
    jet = j.Jet()
    assert j.speed_m_s(jet) == pytest.approx(math.sqrt(2 * G * 0.15))
    assert j.speed_m_s(jet) == pytest.approx(1.7152, abs=1e-4)
    assert j.bend_radius_m(jet) == pytest.approx(2 * jet.level_m, rel=1e-14)
    assert j.landing_m(jet) == pytest.approx(2 * math.sqrt(jet.level_m * jet.drop_m), rel=1e-14)
    assert j.landing_m(jet) == pytest.approx(0.49, abs=0.005)
    assert j.axis_y(jet, j.landing_m(jet)) == pytest.approx(-jet.drop_m, rel=1e-14)
    # The axis bends most sharply at the hole: the radius of y = −k·x² grows along it.
    radii = []
    for x in (0.0, 0.1, 0.2, 0.4):
        k = G / (2 * j.speed_m_s(jet) ** 2)
        radii.append((1 + 4 * k * k * x * x) ** 1.5 / (2 * k))
    assert radii == sorted(radii) and radii[0] == pytest.approx(0.3)


def test_the_critical_angle_of_water_is_48_6_degrees_and_of_glass_41_8():
    assert math.degrees(j.critical_angle(1.333)) == pytest.approx(48.6, abs=0.05)
    assert math.degrees(j.critical_angle(1.5)) == pytest.approx(41.8, abs=0.05)
    assert 90 - math.degrees(j.critical_angle(1.333)) == pytest.approx(41.4, abs=0.05)


def test_the_reflectance_is_fresnel_s_below_the_critical_angle_and_whole_beyond_it():
    n = 1.333
    # Straight on, ((n − 1)/(n + 1))²: 2 %.
    assert j.reflectance(n, 1.0) == pytest.approx(((n - 1) / (n + 1)) ** 2, rel=1e-14)
    assert j.reflectance(n, 1.0) == pytest.approx(0.020, abs=0.001)
    critical = j.critical_angle(n)
    assert j.reflectance(n, math.cos(critical + 1e-9)) == 1.0
    assert j.reflectance(n, math.cos(critical - 1e-6)) > 0.99
    assert j.reflectance(n, math.cos(critical - 1e-6)) < 1.0
    angles = [math.radians(a) for a in range(0, 48)]
    shares = [j.reflectance(n, math.cos(a)) for a in angles]
    assert shares[1:] == sorted(shares[1:]), "it rises towards the critical angle"


def test_a_traced_ray_meets_the_edge_where_it_lies_the_radius_from_the_axis_and_is_reflected_by_the_law():
    jet = j.Jet()
    ray = j.trace(jet, 0.4, math.radians(25))
    a = jet.hole_m / 2
    assert len(ray.xs) == len(ray.hits_cos) + 2
    for x, y in zip(ray.xs[1:-1], ray.ys[1:-1], strict=True):
        assert _nearest_on_axis(jet, x, y)[0] == pytest.approx(a, rel=1e-6)
    # The angle in equals the angle out at every hit.
    for i in range(1, len(ray.xs) - 2):
        ax, ay = ray.xs[i] - ray.xs[i - 1], ray.ys[i] - ray.ys[i - 1]
        bx, by = ray.xs[i + 1] - ray.xs[i], ray.ys[i + 1] - ray.ys[i]
        nx, ny = j.axis_normal(jet, _nearest_on_axis(jet, ray.xs[i], ray.ys[i])[1])
        cos_in = abs(ax * nx + ay * ny) / math.hypot(ax, ay)
        cos_out = abs(bx * nx + by * ny) / math.hypot(bx, by)
        assert cos_in == pytest.approx(cos_out, abs=1e-6)
        assert cos_in == pytest.approx(ray.hits_cos[i - 1], abs=1e-6)
    assert ray.end == "basin"


def test_with_the_laser_straight_every_ray_meets_the_edge_at_79_degrees_or_flatter_and_all_the_light_arrives():
    f = j.figures(j.Jet(), 0.0)
    assert f.arrives == 1.0
    assert f.steepest_deg == pytest.approx(79, abs=0.5)
    assert f.first_out_m is None


def test_up_to_a_tilt_of_40_degrees_the_light_stays_in_and_past_it_leaves_at_once():
    jet = j.Jet()
    tilted = j.figures(jet, 40.0)
    assert tilted.arrives == 1.0
    assert tilted.steepest_deg == pytest.approx(48.7, abs=0.05)
    assert tilted.steepest_deg > tilted.critical_deg
    # A tenth of a degree past 40° the first light gets out; at 42° none arrives,
    # and most of it is out within the first few centimetres.
    assert j.beam(jet, 40.1).arrives == 1.0
    assert j.beam(jet, 40.2).arrives < 1.0
    steep = j.beam(jet, 42.0)
    assert steep.arrives == 0.0
    assert steep.left[0] > 0.7 and sum(steep.left[:3]) > 0.95
    assert j.landing_m(jet) / j.BINS * 3 < 0.04
    # Tilted down as far, the same: the jet bends little over its width.
    assert j.beam(jet, -40.0).arrives == 1.0
    assert j.beam(jet, -42.0).arrives == 0.0


def test_below_a_level_of_about_6_mm_the_jet_bends_too_sharply_and_light_leaks_from_its_first_bend():
    for level in (0.007, 0.01):
        assert j.figures(j.Jet(level_m=level), 0.0).arrives == 1.0
    assert j.beam(j.Jet(level_m=0.006), 0.0).arrives < 1.0
    sharp = j.figures(j.Jet(level_m=0.005), 0.0)
    assert sharp.arrives == pytest.approx(0.83, abs=0.005)
    assert sharp.steepest_deg < sharp.critical_deg
    assert sharp.first_out_m == pytest.approx(0.011, abs=0.0005)


def test_the_beam_s_light_adds_up_to_one_and_none_is_lost():
    for jet, tilt in (
        (j.Jet(), 0.0),
        (j.Jet(), 41.0),
        (j.Jet(level_m=0.005, hole_m=0.01), 30.0),
        (j.Jet(level_m=0.005, hole_m=0.01, drop_m=1.0), -60.0),
        (j.Jet(level_m=0.5, hole_m=0.002, drop_m=1.0), 40.0),
    ):
        b = j.beam(jet, tilt)
        assert b.arrives + sum(b.left) == pytest.approx(1.0, abs=1e-12)
        assert b.lost == pytest.approx(0.0, abs=1e-12)
        assert all(r.end in ("basin", "faded") for r in b.rays)
        assert max(len(r.hits_cos) for r in b.rays) < j.MAX_HITS


def test_light_leaving_is_refracted_by_snell_s_law_and_carries_one_less_the_reflectance():
    jet = j.Jet()
    ray = j.trace(jet, 0.0, math.radians(45))
    first = ray.escapes[0]
    cos_i = ray.hits_cos[0]
    ox, oy = first.out
    nx, ny = first.normal
    assert math.hypot(ox, oy) == pytest.approx(1.0, rel=1e-14)
    sin_t = abs(ox * ny - oy * nx)
    assert sin_t == pytest.approx(jet.index * math.sqrt(1 - cos_i * cos_i), rel=1e-12)
    assert first.share == pytest.approx(1 - j.reflectance(jet.index, cos_i), rel=1e-14)
    assert first.light == pytest.approx(first.share, rel=1e-14)


def test_the_jet_refuses_what_it_cannot_be():
    with pytest.raises(ValueError):
        j.Jet(level_m=0.004)
    with pytest.raises(ValueError):
        j.Jet(hole_m=0.012)
    # The lowest level and the widest hole: the jet bends with twice its radius.
    widest = j.Jet(level_m=0.005, hole_m=0.01)
    assert j.bend_radius_m(widest) == pytest.approx(widest.hole_m, rel=1e-14)
    with pytest.raises(ValueError):
        j.Jet(drop_m=1.5)
    with pytest.raises(ValueError):
        j.Jet(index=1.0)
    with pytest.raises(ValueError):
        j.trace(j.Jet(), 1.0, 0.0)
    with pytest.raises(ValueError):
        j.trace(j.Jet(), 0.0, math.radians(61))


def test_the_jet_s_checks_hold_within_their_tolerances():
    for result in checks.results("jet"):
        assert result.deviation <= result.tolerance, result.key
        assert result.setting["level_m"] == 0.15


def test_the_jet_s_checks_quote_their_sources_and_name_the_engine_they_measure():
    cases = checks.cases("jet")
    assert {c.key for c in cases} == {"critical", "snell", "fresnel", "landing"}
    assert all(s.quote and s.url.startswith("https://") for c in cases for s in c.sources)
    assert checks.fingerprint("jet") != checks.fingerprint("rainbow")
