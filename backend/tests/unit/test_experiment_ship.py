"""The ship that rights itself: the engine, every figure its page states, and its checks."""

from __future__ import annotations

import math

import pytest

from staunlabor.domain import checks
from staunlabor.domain.experiments import ship as s
from staunlabor.domain.experiments.constants import G

pytestmark = pytest.mark.unit

HULL = s.Hull()
DECK = s.Weight()
KEEL = s.Weight(height_m=s.KEEL_M)


def _draft(hull: s.Hull, weight: s.Weight) -> float:
    return (hull.mass_kg + weight.mass_kg) / (s.WATER_DENSITY * hull.length_m * hull.beam_m)


def _grid_centre(hull: s.Hull, weight: s.Weight, phi: float, n: int = 400) -> tuple[float, float]:
    """B by brute force, sharing nothing with the engine's clipping: the
    section cut into n × n cells, the level found by halving until the cells
    whose centres lie below it make up the displaced area, their centroid."""
    sin_phi, cos_phi = math.sin(phi), math.cos(phi)
    cells = [
        ((i + 0.5) / n * hull.beam_m - hull.beam_m / 2, (j + 0.5) / n * hull.depth_m)
        for i in range(n)
        for j in range(n)
    ]
    heights = sorted(-y * sin_phi + z * cos_phi for y, z in cells)
    need = round(s.displaced_m2(hull, weight) / (hull.beam_m * hull.depth_m) * n * n)
    level = heights[need - 1]
    below = [(y, z) for y, z in cells if -y * sin_phi + z * cos_phi <= level]
    return sum(y for y, _ in below) / len(below), sum(z for _, z in below) / len(below)


def test_the_box_floats_at_archimedes_draft_with_b_half_way_and_bm_from_its_waterline():
    f = s.figures(HULL, DECK)
    d = _draft(HULL, DECK)
    assert f.draft_m == pytest.approx(d, rel=1e-14)
    assert f.kb_m == pytest.approx(d / 2, rel=1e-14)
    assert f.bm_m == pytest.approx(HULL.beam_m**2 / (12 * d), rel=1e-14)
    assert f.km_m == pytest.approx(f.kb_m + f.bm_m, rel=1e-15)
    assert f.gm_m == pytest.approx(f.km_m - f.kg_m, rel=1e-14)


@pytest.mark.parametrize("phi_deg", [-16.5, -7.0, 0.5, 3.0, 10.0, 15.0, 16.7])
def test_until_the_bottom_comes_out_b_runs_as_the_wall_sided_box_says(phi_deg: float):
    """For a wall-sided box the centre of buoyancy moves on a parabola:
    y_B = BM·tan φ, z_B = KB + ½·BM·tan²φ, and GZ = sin φ·(GM + ½·BM·tan²φ)."""
    f = s.figures(HULL, DECK)
    phi = math.radians(phi_deg)
    y_b, z_b = s.buoyancy_centre(HULL, DECK, phi)
    assert y_b == pytest.approx(f.bm_m * math.tan(phi), rel=1e-12)
    assert z_b == pytest.approx(f.kb_m + f.bm_m * math.tan(phi) ** 2 / 2, rel=1e-12)
    wall = math.sin(phi) * (f.gm_m + f.bm_m * math.tan(phi) ** 2 / 2)
    assert s.righting_arm_m(HULL, DECK, phi) == pytest.approx(wall, rel=1e-12)


def test_the_bottom_comes_out_at_16_7_degrees_and_past_it_the_wall_sided_formula_overshoots():
    bilge = math.degrees(math.atan(2 * _draft(HULL, DECK) / HULL.beam_m))
    assert round(bilge, 1) == 16.7
    f = s.figures(HULL, DECK)
    phi = math.radians(25.0)
    wall = math.sin(phi) * (f.gm_m + f.bm_m * math.tan(phi) ** 2 / 2)
    assert s.righting_arm_m(HULL, DECK, phi) < 0.95 * wall


@pytest.mark.parametrize(
    ("weight", "phi_deg"),
    [(DECK, 30.0), (DECK, 60.0), (DECK, 100.0), (DECK, 150.0), (KEEL, 75.0), (s.Weight(height_m=0.35), 135.0)],
)
def test_at_any_heel_b_is_the_centre_of_the_part_under_water_by_brute_force(weight: s.Weight, phi_deg: float):
    y_b, z_b = s.buoyancy_centre(HULL, weight, math.radians(phi_deg))
    y_grid, z_grid = _grid_centre(HULL, weight, math.radians(phi_deg))
    # A 400-cell side resolves 0.5 mm across and 0.3 mm up.
    assert y_b == pytest.approx(y_grid, abs=6e-4)
    assert z_b == pytest.approx(z_grid, abs=6e-4)


def test_the_waterline_leaves_the_displacement_under_water_at_every_heel():
    polygon = s.section(HULL)
    area = s.displaced_m2(HULL, DECK)
    for k in range(-36, 37):
        phi = math.radians(5.0 * k)
        level = s.waterline(polygon, area, phi)
        under = s._clipped(polygon, level, math.sin(phi), math.cos(phi))
        assert s._area(under) == pytest.approx(area, rel=1e-12)


def test_the_curve_is_odd_and_zero_upright_and_keel_up():
    for a in (5.0, 40.0, 90.0, 130.0):
        assert s.righting_arm_m(HULL, DECK, math.radians(-a)) == pytest.approx(
            -s.righting_arm_m(HULL, DECK, math.radians(a)), abs=1e-15
        )
    assert s.righting_arm_m(HULL, DECK, 0.0) == pytest.approx(0.0, abs=1e-17)
    assert s.righting_arm_m(HULL, DECK, math.pi) == pytest.approx(0.0, abs=1e-15)


def test_lying_on_its_side_the_arm_is_half_the_depth_less_kg():
    for weight in (KEEL, DECK, s.Weight(height_m=0.3)):
        expected = HULL.depth_m / 2 - s.gravity_m(HULL, weight)
        assert s.righting_arm_m(HULL, weight, math.pi / 2) == pytest.approx(expected, rel=1e-12)


def test_undamped_the_roll_keeps_its_energy_to_large_angles():
    """½·I·φ'² + m·g·∫GZ dφ stays put from 60°, over the deck edge going under."""
    m = s.mass_kg(HULL, DECK)
    inertia = s.inertia_kg_m2(HULL, DECK)

    def potential(phi: float, n: int = 400) -> float:
        h = phi / n
        total = s.righting_arm_m(HULL, DECK, 0.0) + s.righting_arm_m(HULL, DECK, phi)
        for i in range(1, n):
            total += (4 if i % 2 else 2) * s.righting_arm_m(HULL, DECK, i * h)
        return m * G * total * h / 3

    states = s.run(HULL, DECK, 0.0, 60.0, 600)
    e0 = potential(states[0][0])
    for phi, rate in states[::60]:
        assert 0.5 * inertia * rate**2 + potential(phi) == pytest.approx(e0, rel=1e-6)


def test_damped_the_small_roll_dies_away_at_the_damping_rate():
    beta = s.DAMPING_PER_S
    states = s.run(HULL, DECK, beta, 0.5, 2000)
    peaks = [states[i][0] for i in range(1, len(states) - 1) if states[i - 1][0] < states[i][0] >= states[i + 1][0]]
    period = s.figures(HULL, DECK).period_s
    assert period is not None
    # Peak to peak over a damped period: e^(−β·T_d), T_d = T/√(1 − (β/ω₀)²).
    t_d = period / math.sqrt(1 - (beta * period / (2 * math.pi)) ** 2)
    assert peaks[2] / peaks[1] == pytest.approx(math.exp(-beta * t_d), rel=2e-3)


def test_with_the_weight_on_deck_it_comes_back_from_60_and_goes_over_from_80():
    back = s.run(HULL, DECK, s.DAMPING_PER_S, 60.0, 4000)
    assert abs(math.degrees(back[-1][0])) < 2
    over = s.run(HULL, DECK, s.DAMPING_PER_S, 80.0, 4000)
    assert abs(math.degrees(over[-1][0])) == pytest.approx(180, abs=10)


def test_high_up_the_mast_a_small_push_turns_it_keel_up():
    states = s.run(HULL, s.Weight(height_m=0.35), s.DAMPING_PER_S, 2.0, 6000)
    assert abs(math.degrees(states[-1][0])) == pytest.approx(180, abs=5)


def test_in_the_keel_it_comes_back_even_from_its_side():
    states = s.run(HULL, KEEL, s.DAMPING_PER_S, 90.0, 4000)
    assert abs(math.degrees(states[-1][0])) < 2


def test_the_figures_the_page_states():
    deck = s.figures(HULL, DECK)
    # The hull: draft 3.0 cm (3.006), KB 1.5, BM 11.1 (11.09), KM 12.6.
    assert round(deck.draft_m * 100, 1) == 3.0 and round(deck.draft_m * 100, 3) == 3.006
    assert round(deck.kb_m * 100, 1) == 1.5
    assert round(deck.bm_m * 100, 1) == 11.1 and round(deck.bm_m * 100, 2) == 11.09
    assert round(deck.km_m * 100, 1) == 12.6
    # On the deck: KG 7.3, GM 5.3 (5.259), a roll every 0.58 s (0.5774), back up to 75°.
    assert round(deck.kg_m * 100, 1) == 7.3
    assert round(deck.gm_m * 100, 1) == 5.3 and round(deck.gm_m * 100, 3) == 5.259
    assert deck.period_s is not None and round(deck.period_s, 2) == 0.58 and round(deck.period_s, 4) == 0.5774
    assert deck.vanishing_deg is not None and round(deck.vanishing_deg) == 75
    # The weight's limit: 27.8 cm up.
    assert deck.weight_limit_m is not None and round(deck.weight_limit_m * 100, 1) == 27.8
    keel = s.figures(HULL, KEEL)
    # In the keel: G under the bottom (−1.67 cm), GM 14.3, back from anywhere, 7.7 (7.667) on its side.
    assert keel.kg_m < 0 and round(keel.kg_m * 100, 2) == -1.67
    assert round(keel.gm_m * 100, 1) == 14.3
    assert keel.vanishing_deg is None and not keel.keel_up
    side = s.righting_arm_m(HULL, KEEL, math.pi / 2) * 100
    assert round(side, 1) == 7.7 and round(side, 3) == 7.667
    # 25 cm up: GM 0.9, a roll every 2.3 s.
    tender = s.figures(HULL, s.Weight(height_m=0.25))
    assert round(tender.gm_m * 100, 1) == 0.9
    assert tender.period_s is not None and round(tender.period_s, 1) == 2.3
    # 35 cm up: GM −2.4, no loll, and keel up it floats stably.
    high = s.figures(HULL, s.Weight(height_m=0.35))
    assert round(high.gm_m * 100, 1) == -2.4
    assert high.loll_deg is None and high.vanishing_deg == 0.0 and high.keel_up
    # The weight on deck floats stably keel up too, the keel's not.
    assert deck.keel_up
    # At 15°, GM·sin φ alone is 7 % short of the arm, 1.464 cm.
    arm = s.righting_arm_m(HULL, DECK, math.radians(15))
    assert round(arm * 100, 3) == 1.464
    assert round(1 - deck.gm_m * math.sin(math.radians(15)) / arm, 2) == 0.07
    # The hull and the weight as the page says: 20 × 12 × 50 cm, 2 kg, its centre 5 cm up, 1 kg from −15 to 40 cm.
    assert (HULL.beam_m, HULL.depth_m, HULL.length_m, HULL.mass_kg, HULL.centre_m) == (0.2, 0.12, 0.5, 2.0, 0.05)
    assert HULL.gyration_m == 0.07 and DECK.mass_kg == 1.0 and DECK.height_m == 0.12
    assert (s.KEEL_M, s.MAST_M) == (-0.15, 0.40)


def test_just_past_the_limit_it_lolls_at_a_small_angle():
    f = s.figures(HULL, s.Weight(height_m=0.278))
    assert f.gm_m < 0 and f.loll_deg is not None and 0 < f.loll_deg < 5
    assert f.vanishing_deg is not None and f.vanishing_deg > f.loll_deg


def test_its_checks_hold_and_their_figures_are_the_pages():
    results = {r.key: r for r in checks.results("ship")}
    assert set(results) == {"metacentric_height", "wall_sided", "on_its_side", "roll_period"}
    for r in results.values():
        assert r.deviation <= r.tolerance, r.key
    # The words' figures: 3·10⁻⁸ at 0.01°, 2.5·10⁻⁵ at 0.5°.
    assert round(results["metacentric_height"].deviation, 8) == 3e-8
    assert round(results["roll_period"].deviation, 6) == 2.5e-5
    assert round(results["roll_period"].expected, 4) == 0.5774
    assert round(results["on_its_side"].expected * 100, 3) == 7.667


@pytest.mark.parametrize(
    "build",
    [
        lambda: s.Hull(beam_m=0.01),
        lambda: s.Hull(depth_m=2.0),
        lambda: s.Hull(length_m=0.05),
        lambda: s.Hull(mass_kg=0.0),
        lambda: s.Hull(centre_m=0.2),
        lambda: s.Hull(gyration_m=0.0),
        lambda: s.Weight(mass_kg=-1.0),
        lambda: s.Weight(height_m=0.5),
        lambda: s.Weight(height_m=-0.2),
        lambda: s.figures(s.Hull(beam_m=0.05, depth_m=0.02), s.Weight(mass_kg=5.0)),
        lambda: s.run(HULL, DECK, 0.5, 200.0, 10),
        lambda: s.run(HULL, DECK, 0.5, 10.0, 100_001),
        lambda: s.step(HULL, DECK, 11.0, 0.0, 0.0),
    ],
)
def test_it_refuses_what_is_no_hull_no_weight_or_no_run(build):
    with pytest.raises(ValueError):
        build()
