"""The experiments engine against the physics its pages will state.

Each model was first checked independently with SciPy (``docs/experiments.md``
says how and what it found); these tests hold the engine to the same facts,
and where a fact needs a second computation to be believed — the 5/7 rule, the
dipole's closed form — the second computation is written here, not borrowed
from the engine.
"""

from __future__ import annotations

import importlib
import itertools
import math
from typing import Any

import pytest

from staunlabor.domain import experiments as x
from staunlabor.domain.experiments import coil, perspective, sphere
from tests.unit.ode import rk4

pytestmark = pytest.mark.unit


# ── the ball in the sphere ───────────────────────────────────────────────────


def _cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def _dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def _rigid_body(s: x.Sphere, drive: x.Drive):
    """The full rolling ball: centre, velocity and angular velocity, the contact
    force solved from Newton–Euler and the rolling constraint at each instant.
    Nothing of the 5/7 reduction is in here."""
    rho, r, k = s.path_radius_m, s.ball_radius_m, s.inertia_factor
    g = (0.0, 0.0, -sphere.G)

    def f(t, y):
        p, pd, w = y[0:3], y[3:6], y[6:9]
        norm = math.sqrt(_dot(p, p))
        n = tuple(c / norm for c in p)
        radial = _dot(n, pd)
        nd = tuple((pd[i] - n[i] * radial) / rho for i in range(3))
        ax, ay = sphere.shell_acceleration(drive, t)
        shell = (ax, ay, 0.0)
        wxnd = _cross(w, nd)
        # a + ẇ × (r·n) + w × (r·ṅ) = A, with m·a = m·g + F and I·ẇ = r·n × F
        rhs = tuple(shell[i] - g[i] - r * wxnd[i] for i in range(3))
        rn = _dot(rhs, n)
        force = tuple(rn * n[i] + (rhs[i] - rn * n[i]) / (1 + 1 / k) for i in range(3))
        wd = tuple(c / (k * r) for c in _cross(n, force))
        pdd = tuple(g[i] + force[i] - shell[i] for i in range(3))
        return [*pd, *pdd, *wd]

    return f


def test_a_rolling_ball_s_centre_moves_like_a_pendulum_under_five_sevenths_of_gravity():
    """The reduction the whole page stands on, against the full rigid body,
    with the sphere being pushed round so the hand's term is in it too."""
    s = x.Sphere(rolling_resistance=0.0)
    drive = x.Drive(radius_m=0.01, end_hz=1.2, sweep_s=0.0, hold_s=3.0)
    reduced = x.run_sphere(s, drive, start_angle_deg=20.0)

    y0 = [*sphere.start_state(s, 20.0), 0.0, 0.0, 0.0]
    h = 2.5e-4
    full = rk4(_rigid_body(s, drive), y0, h, drive.duration_s, sample_every=round(0.02 / h))
    depths = [-z for z in full.states[2]]
    assert len(depths) == len(reduced.depth_below_equator_m)
    assert max(abs(a - b) for a, b in zip(depths, reduced.depth_below_equator_m, strict=True)) < 1e-9
    # The spin about the line to the contact point stays where it started.
    rho = s.path_radius_m
    spins = [sum(full.states[6 + i][j] * full.states[i][j] / rho for i in range(3)) for j in range(len(full.t))]
    assert max(abs(v) for v in spins) < 1e-9
    assert s.gravity_share == pytest.approx(5 / 7)


def test_a_circle_rides_below_the_equator_by_a_depth_its_rate_alone_sets():
    """ρ·cos θ = g'/Ω²: the size of the sphere does not enter."""
    for f in (1.5, 2.0, 3.0):
        small = x.orbit(x.Sphere(shell_radius_m=0.15), f)
        large = x.orbit(x.Sphere(shell_radius_m=0.40), f)
        expected = sphere.G * 5 / 7 / (2 * math.pi * f) ** 2
        assert small.depth_below_equator_m == pytest.approx(expected, rel=1e-12)
        assert large.depth_below_equator_m == pytest.approx(expected, rel=1e-12)
    # The page's numbers for the default sphere (Ø 40 cm, a 4 cm ball).
    s = x.Sphere()
    assert x.orbit(s, 2.0).depth_below_equator_m == pytest.approx(0.04436, abs=1e-5)
    assert x.orbit(s, 2.0).angle_deg == pytest.approx(75.73, abs=0.01)
    assert x.orbit(s, 3.0).angle_deg == pytest.approx(83.71, abs=0.01)


def test_below_the_lowest_rate_there_is_no_circle():
    s = x.Sphere()
    f0 = x.lowest_orbit_hz(s)
    assert f0 == pytest.approx(math.sqrt(sphere.G * 5 / 7 / 0.18) / (2 * math.pi))
    assert f0 == pytest.approx(0.9928, abs=1e-4)
    assert x.orbit(s, f0 * 0.99) is None
    assert x.orbit(s, f0 * 1.01) is not None


def test_a_hollow_ball_feels_three_fifths_of_gravity():
    s = x.Sphere(ball=x.BallKind.HOLLOW)
    assert s.gravity_share == pytest.approx(3 / 5)
    assert x.orbit(s, 2.0).depth_below_equator_m == pytest.approx(sphere.G * 3 / 5 / (4 * math.pi) ** 2)


def test_a_ball_started_on_its_orbit_stays_on_it():
    s = x.Sphere(rolling_resistance=0.0)
    o = x.orbit(s, 2.0)
    still = x.Drive(radius_m=0.0, sweep_s=0.0, hold_s=5.0)
    run = x.run_sphere(s, still, start_angle_deg=o.angle_deg, start_speed_m_s=o.speed_m_s)
    assert max(abs(a - o.angle_deg) for a in run.angle_deg) < 1e-6


def _period(ts, values):
    """The mean period of a signal, from its upward crossings of its mean."""
    mean = sum(values) / len(values)
    ups = []
    for i in range(1, len(values)):
        a, b = values[i - 1] - mean, values[i] - mean
        if a < 0 <= b:
            ups.append(ts[i - 1] + (ts[i] - ts[i - 1]) * (-a) / (b - a))
    return (ups[-1] - ups[0]) / (len(ups) - 1)


def test_a_tilted_orbit_wobbles_at_the_rate_the_orbit_figures_say():
    """Ω·√(1 + 3·cos²θ): near the equator, once a revolution — the orbit's
    plane tilted, the visitor's "not in the plane yet"."""
    s = x.Sphere(rolling_resistance=0.0)
    for f in (1.5, 2.0):
        o = x.orbit(s, f)
        run = x.run_sphere(
            s,
            x.Drive(radius_m=0.0, sweep_s=0.0, hold_s=20.0),
            start_angle_deg=o.angle_deg,
            start_speed_m_s=o.speed_m_s * 1.005,
        )
        assert 1 / _period(run.t, run.angle_deg) == pytest.approx(o.wobble_hz, rel=0.01)


def test_a_slow_sweep_carries_the_ball_to_its_final_rate_s_orbit_and_a_jump_does_not():
    """Autoresonance: the hand speeds up with the ball and the ball follows;
    the same final rate reached at once leaves it near the bottom."""
    s = x.Sphere()
    swept = x.run_sphere(s, x.Drive())  # 2 cm, 0.7 → 2.5 Hz over 30 s, then 10 s
    assert swept.final_angle_deg == pytest.approx(x.orbit(s, 2.5).angle_deg, abs=1.0)
    assert not swept.left_the_wall
    assert swept.friction_needed < 0.2, "it rolls on any wall a rubber or steel ball grips"
    jumped = x.run_sphere(s, x.Drive(sweep_s=0.0, hold_s=40.0))
    assert jumped.highest_angle_deg < 25


def test_the_sphere_s_step_is_fine_enough():
    s = x.Sphere()
    drive = x.Drive(sweep_s=20.0, hold_s=2.0)
    coarse = x.run_sphere(s, drive)
    fine = x.run_sphere(s, drive, step_s=sphere.STEP_S / 2)
    assert coarse.final_angle_deg == pytest.approx(fine.final_angle_deg, abs=0.05)


def test_a_swing_back_and_forth_slows_as_it_widens():
    """The opposite of the circle, and the pendulum's elliptic integral against
    a swing the engine actually runs."""
    s = x.Sphere(rolling_resistance=0.0)
    assert x.swing_hz(s, 0.0) == pytest.approx(x.lowest_orbit_hz(s))
    freqs = [x.swing_hz(s, a) for a in (10, 30, 60, 90)]
    assert freqs == sorted(freqs, reverse=True)
    run = x.run_sphere(s, x.Drive(radius_m=0.0, sweep_s=0.0, hold_s=12.0), start_angle_deg=60.0)
    assert 1 / _period(run.t, run.depth_below_equator_m) == pytest.approx(2 * x.swing_hz(s, 60.0), rel=0.005)


def test_holding_an_orbit_needs_a_circle_only_rolling_resistance_asks_for():
    o = x.orbit(x.Sphere(), 2.5)
    assert 0 < o.drive_radius_needed_m < 0.002
    assert x.orbit(x.Sphere(rolling_resistance=0.0), 2.5).drive_radius_needed_m == 0.0
    # Energy from rest: half of (1 + k)·v² plus the climb.
    assert o.energy_j_per_kg == pytest.approx(0.7 * o.speed_m_s**2 + sphere.G * o.height_above_bottom_m)


def test_the_sphere_refuses_what_is_not_an_exhibit():
    with pytest.raises(ValueError):
        x.Sphere(shell_radius_m=0.02, ball_radius_m=0.02)
    with pytest.raises(ValueError):
        x.orbit_at(x.Sphere(), 90.0)
    with pytest.raises(ValueError):
        x.Drive(sweep_s=100.0, hold_s=100.0)


# ── the magnet car and the coil ──────────────────────────────────────────────


def _flux_through_turns(ex: x.CoilExhibit, at: float) -> float:
    """The dipole's own field integrated over each turn's disc, summed over the
    turns — not the reciprocity shortcut the engine uses."""
    m = ex.magnet.moment_a_m2
    a = ex.coil.mean_diameter_m / 2
    length = ex.coil.length_m

    def through_loop(z):
        # Simpson over ln s: with the magnet in a turn's plane the disc's flux
        # is a large inward part near the axis less a larger outward one round
        # it, and an even grid in s cannot resolve the first.
        def integrand(u):
            s = math.exp(u)
            r = math.hypot(s, z)
            return coil.MU0 * m / (4 * math.pi * r**3) * (3 * (z / r) ** 2 - 1) * 2 * math.pi * s * s

        lo, hi, n = math.log(a * 1e-7), math.log(a), 2000
        h = (hi - lo) / n
        inner = sum((4 if i % 2 else 2) * integrand(lo + i * h) for i in range(1, n))
        return h / 3 * (integrand(lo) + integrand(hi) + inner)

    turns = 200
    hz = length / turns
    zs = [-length / 2 + hz * (i + 0.5) for i in range(turns)]
    return ex.coil.turns / turns * sum(through_loop(at - z) for z in zs)


def test_the_closed_form_flux_is_the_dipole_s_field_through_every_turn():
    ex = x.CoilExhibit()
    for at in (0.0, 0.02, 0.05, 0.1):
        assert x.flux_linkage(ex, at) == pytest.approx(_flux_through_turns(ex, at), rel=2e-4)


def test_the_coupling_is_the_flux_s_slope_and_changes_sign_in_the_middle():
    ex = x.CoilExhibit()
    for at in (-0.06, -0.027, -0.01, 0.01, 0.04):
        h = 1e-6
        slope = (x.flux_linkage(ex, at + h) - x.flux_linkage(ex, at - h)) / (2 * h)
        assert x.coupling(ex, at) == pytest.approx(slope, rel=1e-6)
    assert x.coupling(ex, 0.0) == pytest.approx(0.0, abs=1e-12)
    assert x.coupling(ex, -0.02) > 0 > x.coupling(ex, 0.02)


def test_the_coil_s_figures_for_the_default_build():
    fig = x.figures(x.CoilExhibit())
    assert fig.inductance_h == pytest.approx(0.1181, rel=1e-3)
    assert fig.time_constant_s == pytest.approx(1.257e-3, rel=1e-3)
    assert fig.full_current_a == pytest.approx(9.0 / 94.0)
    assert fig.peak_coupling_v_s_per_m == pytest.approx(1.8924, rel=1e-3)
    assert fig.top_speed_m_s == pytest.approx(9.0 / fig.peak_coupling_v_s_per_m)
    assert fig.ideal_gain_per_pass_j == pytest.approx(2 * fig.full_current_a * fig.peak_flux_wb)
    # What the page says about the game: the coil answers in a millisecond,
    # the hand has about fifty between the two buttons.
    assert fig.time_constant_s < 0.002
    assert 0.04 < fig.between_peaks_s < 0.07


def test_the_default_build_reads_on_the_exhibit_s_meter():
    """A digital ±100 mA meter: a held button and a coasting car both on scale."""
    ex = x.CoilExhibit()
    assert x.figures(ex).full_current_a < coil.METER_RANGE_A
    pumped = x.run_coil(ex, x.PressRule(), 12.0)
    coasting = x.run_coil(ex, None, 6.0)
    assert max(abs(i) for i in pumped.current_a) < coil.METER_RANGE_A
    assert 0.005 < max(abs(i) for i in coasting.current_a) < 0.05


def test_plus_coming_in_and_minus_going_out_pumps_the_car_up_both_ramps():
    ex = x.CoilExhibit()
    run = x.run_coil(ex, x.PressRule(), 12.0)
    climbing = run.peaks_m[:4]
    assert climbing == tuple(sorted(climbing)), "every pass sends it higher"
    assert run.tops >= 2
    # Both tops, within the millimetre the car covers between two samples.
    assert max(run.x_m) == pytest.approx(ex.track.end_m, abs=1e-3)
    assert min(run.x_m) == pytest.approx(-ex.track.end_m, abs=1e-3)


def test_the_buttons_the_wrong_way_round_trap_the_car_at_the_coil():
    ex = x.CoilExhibit()
    run = x.run_coil(ex, x.PressRule(reversed=True), 12.0)
    assert run.tops == 0
    assert abs(run.x_m[-1]) < ex.track.flat_length_m / 2


def test_a_closed_coil_brakes_the_car_it_shows_on_the_meter():
    """Lenz: the induced current is the meter's swing and a brake too; an open
    coil carries none and the car coasts longer."""
    closed = x.run_coil(x.CoilExhibit(idle=x.Idle.CLOSED), None, 12.0)
    opened = x.run_coil(x.CoilExhibit(idle=x.Idle.OPEN), None, 12.0)
    assert max(abs(i) for i in opened.current_a) == 0.0
    assert max(abs(i) for i in closed.current_a) > 0.005
    assert sum(closed.peaks_m) < sum(opened.peaks_m)
    assert closed.energy.heat_j > 0


@pytest.mark.parametrize(
    ("idle", "visitor"),
    [
        (x.Idle.CLOSED, x.PressRule()),
        (x.Idle.CLOSED, x.PressRule(reversed=True)),
        (x.Idle.CLOSED, x.PressRule(late_s=0.03)),
        (x.Idle.OPEN, x.PressRule()),
        (x.Idle.CLOSED, None),
    ],
)
def test_the_energy_account_closes(idle, visitor):
    """Battery in = motion + height + heat + rolling + the field + sparks + end
    stops, to a part in a million at the engine's step."""
    run = x.run_coil(x.CoilExhibit(idle=idle), visitor, 12.0)
    scale = max(run.energy.battery_j, run.energy.heat_j + run.energy.rolling_j, 1e-3)
    assert abs(run.energy.unaccounted_j) < 1e-6 * scale


def test_switching_on_time_matters_by_tens_of_milliseconds_not_the_coil_s_one():
    ex = x.CoilExhibit()
    curve = x.timing_curve(ex, 1.0, (-0.04, -0.02, -0.01, 0.0, 0.01, 0.02, 0.04, 0.06))
    gains = {p.late_s: p.gain_j for p in curve}
    best = max(curve, key=lambda p: p.gain_j)
    assert abs(best.late_s) <= 0.01
    assert gains[0.06] < 0, "sixty milliseconds late, the pull that is left brakes the car"
    assert best.gain_j < x.figures(ex).ideal_gain_per_pass_j


def test_the_speed_for_the_top_is_the_one_that_just_gets_there():
    """The closed form against a car let go at the ramp's foot with that speed,
    the coil open so nothing but the track and rolling resistance acts — and
    without resistance it is √(2gh), as for any slope."""
    ex = x.CoilExhibit(idle=x.Idle.OPEN)
    track = ex.track
    speed = coil.speed_for_top(track)
    run = x.run_coil(ex, None, 3.0, start_x_m=track.flat_length_m / 2, start_speed_m_s=speed)
    assert run.tops == 1
    slower = x.run_coil(ex, None, 3.0, start_x_m=track.flat_length_m / 2, start_speed_m_s=speed * 0.99)
    assert slower.tops == 0
    assert slower.peaks_m[0] == pytest.approx(track.top_height_m, rel=0.03)
    frictionless = x.Track(rolling_resistance=0.0)
    assert coil.speed_for_top(frictionless) == pytest.approx(
        math.sqrt(2 * coil.G * frictionless.top_height_m), rel=1e-12
    )


def test_a_ramp_is_an_arc_that_starts_level():
    ex = x.CoilExhibit()
    t = ex.track
    foot = t.flat_length_m / 2
    assert coil.slope(ex, foot) == 0.0
    assert coil.slope(ex, foot + 1e-6) == pytest.approx(1e-6 / t.ramp_radius_m, rel=1e-6)
    assert coil.slope(ex, t.end_m) == pytest.approx(math.sin(t.ramp_length_m / t.ramp_radius_m))
    assert coil.height(ex, -t.end_m) == pytest.approx(t.top_height_m)
    with pytest.raises(ValueError):
        x.Track(ramp_length_m=0.6, ramp_radius_m=0.3)


def test_a_late_hand_never_reaches_the_top():
    run = x.run_coil(x.CoilExhibit(), x.PressRule(late_s=0.03), 12.0)
    assert run.tops == 0
    assert run.peaks_m[-1] < x.CoilExhibit().track.top_height_m


def test_a_recording_with_no_presses_is_no_visitor_at_all():
    ex = x.CoilExhibit()
    assert x.run_coil(ex, x.Scripted(), 2.0) == x.run_coil(ex, None, 2.0)


# ── the chair ────────────────────────────────────────────────────────────────


def test_the_three_boxes_show_one_picture():
    real, skewed, scattered = x.exhibit()
    for other in (skewed, scattered):
        for a, b in zip(real.segments, other.segments, strict=True):
            for p, q in ((a.a, b.a), (a.b, b.b)):
                ip, iq = x.image(x.EYE, p), x.image(x.EYE, q)
                assert ip[0] == pytest.approx(iq[0], abs=1e-12)
                assert ip[1] == pytest.approx(iq[1], abs=1e-12)
    # And they are three different objects.
    assert skewed.segments[0] != real.segments[0] != scattered.segments[1]


def test_the_skewed_chair_keeps_its_rods_straight_and_its_joints_joined():
    real, skewed, _ = x.exhibit()
    for seg in real.segments:
        mid = tuple((seg.a[i] + seg.b[i]) / 2 for i in range(3))
        pa, pb, pm = (perspective.skew_point(x.EYE, p) for p in (seg.a, seg.b, mid))
        ab = tuple(pb[i] - pa[i] for i in range(3))
        am = tuple(pm[i] - pa[i] for i in range(3))
        assert math.sqrt(_dot(_cross(ab, am), _cross(ab, am))) < 1e-15
    chair_joints = x.joints(real)
    assert len(chair_joints) == 20
    assert x.widest_gap(skewed, chair_joints, (0.01, 0.0, 0.0)) == pytest.approx(0.0, abs=1e-15)
    assert x.tolerance(skewed, chair_joints) == math.inf


def test_the_scattered_rods_meet_only_on_the_line_of_sight():
    real, _, scattered = x.exhibit()
    chair_joints = x.joints(real)
    assert x.widest_gap(scattered, chair_joints, x.EYE) == pytest.approx(0.0, abs=1e-12)
    assert x.widest_gap(scattered, chair_joints, (0.001, 0.0, 0.0)) > x.ACUITY_RAD


def test_a_joint_opens_by_the_offset_times_the_difference_of_inverse_distances():
    """The small-angle reading the page prints, against the exact angle."""
    p = (0.0, 0.0, 0.4)
    q = perspective.slide(x.EYE, p, 1.5)  # the same direction, 0.6 m away
    for delta in (1e-5, 1e-4, 1e-3):
        exact = perspective.angle_between((delta, 0.0, 0.0), p, q)
        assert exact == pytest.approx(delta * (1 / 0.4 - 1 / 0.6), rel=1e-4)


def test_the_hole_has_to_be_finer_than_the_eye_and_the_second_eye_sees_it_all():
    real, _, scattered = x.exhibit()
    chair_joints = x.joints(real)
    assert x.tolerance(scattered, chair_joints) == pytest.approx(1.62e-4, rel=0.01)
    assert math.degrees(x.binocular_gap(scattered, chair_joints)) == pytest.approx(6.56, abs=0.01)


def test_perspective_refuses_what_an_eye_cannot_do():
    with pytest.raises(ValueError):
        x.slide(x.EYE, (0.0, 0.0, 1.0), 0.0)
    with pytest.raises(ValueError):
        x.image(x.EYE, (0.0, 0.0, -1.0))


def test_every_line_of_sight_runs_through_a_chair_corner_and_the_rod_ends_on_it():
    """The side view's point: the scattered rods' ends lie on the real chair's
    lines of sight, only further along them or nearer."""
    analysis = x.chair_analysis()
    real, _, scattered = (b.figure for b in analysis.boxes)
    lines = analysis.boxes[2].sight_lines
    assert len(lines) == 12, "a chair of twelve rods has twelve corners"

    def on_a_line(p):
        return any(perspective.angle_between(x.EYE, p, line.b) < 1e-12 and line.b[2] >= p[2] for line in lines)

    assert all(on_a_line(p) for s in real.segments for p in (s.a, s.b))
    assert all(on_a_line(p) for s in scattered.segments for p in (s.a, s.b))


def test_each_box_stands_its_object_on_the_floor_and_holds_all_of_it():
    for peephole in x.chair_analysis().boxes:
        points = [p for s in peephole.figure.segments for p in (s.a, s.b)]
        b = peephole.box
        assert min(p[1] for p in points) == b.floor_m
        assert all(b.left_m < p[0] < b.right_m and p[1] < b.ceiling_m and 0 < p[2] < b.depth_m for p in points)
        assert b.depth_m < 0.8, "a table-top box"


# ── the spinning platform ────────────────────────────────────────────────────

from staunlabor.domain.experiments import platform as pl  # noqa: E402


def test_each_part_s_inertia_is_its_shape_s_integral():
    """The arm (a rod from the bar to the shoulder), the disc and the lean,
    each summed from small pieces here."""
    body, plat = x.Body(), x.Platform()
    lean = 0.27
    parts = x.inertia(body, plat, x.Posture(lean_m=lean))
    n = 20_000
    # An arm: n pieces from the hand at (0, s) to the shoulder at (d, s).
    arm = sum(body.arm_kg / n * ((lean * (j + 0.5) / n) ** 2 + body.shoulder_m**2) for j in range(n))
    assert parts.arms == pytest.approx(2 * arm, rel=1e-8)
    rings = sum(
        2 * plat.mass_kg / plat.radius_m**2 * ((j + 0.5) * plat.radius_m / n) ** 3 * plat.radius_m / n for j in range(n)
    )
    assert parts.platform == pytest.approx(rings, rel=1e-8)
    upright = x.inertia(body, plat, x.Posture()).trunk
    assert parts.trunk - upright == pytest.approx(body.trunk_kg * lean**2, rel=1e-12)
    # The feet do not move: the legs are the same whatever the lean.
    assert parts.legs == x.inertia(body, plat, x.Posture()).legs


def test_without_friction_the_momentum_is_kept_whatever_the_lean():
    body, plat = x.Body(), x.Platform(friction_n_m=0.0)
    moves = (x.Move(at_s=1.0, lean_m=0.0, over_s=2.0), x.Move(at_s=4.0, lean_m=0.3))
    run = x.run_platform(body, plat, x.Posture(lean_m=0.3), 20.0, moves, 6.0)
    assert set(run.momentum) == {20.0}
    for f, i in zip(run.rev_per_s, run.inertia_kg_m2, strict=True):
        assert 2 * math.pi * f * i == pytest.approx(20.0, rel=1e-12)
    assert max(run.rev_per_s) / min(run.rev_per_s) > 3


def test_the_spin_up_is_paid_for_by_the_arms():
    """E = L²/2I rises as the body comes upright, by exactly the work done
    against what holds it out: every piece of the trunk and the arms pulled in
    towards the axis against m·ω²·x, at the rate the lean has at each moment."""
    body, plat = x.Body(), x.Platform()
    momentum = 20.0
    pieces, steps = 200, 4000
    work = 0.0
    previous = None
    for k in range(steps + 1):
        d = 0.3 * (1 - k / steps)
        omega = momentum / x.inertia(body, plat, x.Posture(lean_m=d)).total
        # How far out each piece is: the trunk at d, the arms' pieces at t·d.
        xs = [(body.trunk_kg, d)] + [(2 * body.arm_kg / pieces, d * (j + 0.5) / pieces) for j in range(pieces)]
        if previous is not None:
            prev_xs, prev_omega = previous
            for (m, xx), (_, x0) in zip(xs, prev_xs, strict=True):
                work += m * 0.5 * (prev_omega**2 * x0 + omega**2 * xx) * (x0 - xx)
        previous = (xs, omega)
    gain = (
        x.spin(body, plat, x.Posture(), momentum).energy_j
        - x.spin(body, plat, x.Posture(lean_m=0.3), momentum).energy_j
    )
    assert gain > 0
    assert work == pytest.approx(gain, rel=1e-4)


def test_the_bearing_stops_the_spin_and_never_turns_it_back():
    plat = x.Platform(friction_n_m=0.5)
    run = x.run_platform(x.Body(), plat, x.Posture(), 4.0, (), 12.0)
    assert run.momentum[0] == 4.0
    assert run.momentum[50] == pytest.approx(3.5, abs=1e-12)
    assert run.momentum[-1] == 0.0
    assert min(run.rev_per_s) == 0.0
    assert pl.friction_step(-1.0, 0.5, 1.0) == -0.5
    assert pl.friction_step(0.2, 0.5, 1.0) == 0.0


def test_a_push_adds_its_momentum_when_it_comes():
    run = x.run_platform(
        x.Body(), x.Platform(friction_n_m=0.0), x.Posture(), 0.0, (x.Move(at_s=1.0, lean_m=0.0, push=5.0),), 2.0
    )
    assert run.momentum[49] == 0.0
    assert run.momentum[50] == 5.0


def test_the_default_visitor_spins_three_times_faster_upright():
    fig = x.platform_figures(x.Body(), x.Platform())
    assert fig.leaning.rev_per_s == pytest.approx(pl.START_REV_PER_S, rel=1e-12)
    assert fig.speed_ratio == pytest.approx(3.21, abs=0.01)
    assert fig.upright.energy_j / fig.leaning.energy_j == pytest.approx(fig.speed_ratio, rel=1e-12)
    assert fig.work_to_stand_up_j == pytest.approx(58.1, abs=0.1)
    assert fig.upright.pull_n == 0.0, "upright, the hands hold nothing out"
    assert fig.leaning.pull_n == pytest.approx(124.4, abs=0.1)
    rates = [p.rev_per_s for p in fig.lean_curve]
    assert rates == sorted(rates, reverse=True), "every centimetre of lean slows the spin"


def test_a_lean_moves_from_where_the_last_left_off():
    moves = (x.Move(at_s=1.0, lean_m=0.0, over_s=2.0),)
    start = x.Posture(lean_m=0.2)
    assert pl.posture_at(start, moves, 0.5) == start
    assert pl.posture_at(start, moves, 2.0) == x.Posture(lean_m=0.1)
    assert pl.posture_at(start, moves, 5.0) == x.Posture(lean_m=0.0)


def test_the_platform_refuses_what_is_not_a_visitor():
    with pytest.raises(ValueError):
        x.Posture(lean_m=0.6)
    with pytest.raises(ValueError):
        x.Body(arm_share=0.3, trunk_share=0.5)
    with pytest.raises(ValueError):
        x.run_platform(x.Body(), x.Platform(), x.Posture(), 1.0, (), 0.0)


# ── the race ─────────────────────────────────────────────────────────────────

rc = importlib.import_module("staunlabor.domain.experiments.race")

#: Each track's time for the default race (0.5 m drop, 1.2 m run, a solid
#: ball), by SciPy's adaptive quadrature before the engine was written.
REFERENCE_S = {
    "line": 0.9823743807542578,
    "cycloid": 0.7472609884498822,
    "circle": 0.8027384918776789,
    "parabola": 0.8231682445294336,
    "hyperbola": 0.7562574441466263,
    "hump": 1.370621184511573,
}


def test_every_track_s_time_is_the_independent_quadrature_s():
    run = x.run_race(x.Race())
    for track in run.tracks:
        assert track.time_s == pytest.approx(REFERENCE_S[track.kind.value], rel=1e-5), track.kind


def test_the_line_and_the_cycloid_keep_their_closed_forms():
    for drop, run_m in ((0.5, 1.2), (0.4, 0.45), (0.3, 1.5)):
        spec = x.Race(drop_m=drop, run_m=run_m)
        g = rc.G * spec.gravity_share
        tracks = {t.kind: t for t in x.run_race(spec).tracks}
        line = math.sqrt(2 * (run_m**2 + drop**2) / (g * drop))
        assert tracks[x.CurveKind.LINE].time_s == pytest.approx(line, rel=1e-6)
        r, end = x.cycloid_through(drop, run_m)
        assert tracks[x.CurveKind.CYCLOID].time_s == pytest.approx(end * math.sqrt(r / g), rel=1e-6)


def test_the_cycloid_is_the_fastest_and_dips_below_a_far_finish():
    for drop, run_m in ((0.5, 1.2), (0.5, 0.6), (0.3, 1.5), (0.6, 0.7)):
        run = x.run_race(x.Race(drop_m=drop, run_m=run_m))
        fastest = min(run.tracks, key=lambda t: t.time_s)
        assert fastest.kind is x.CurveKind.CYCLOID, (drop, run_m)
        # Past run/drop = π/2 the cycloid's lowest point lies below the finish.
        assert run.cycloid_dips == (run_m / drop > math.pi / 2)
    far = x.run_race(x.Race(drop_m=0.5, run_m=1.2))
    assert far.cycloid_lowest_m == pytest.approx(0.5519, abs=1e-4)


def test_rolling_slows_every_track_by_the_same_factor():
    rolling = {t.kind: t.time_s for t in x.run_race(x.Race(ball=x.RaceBall.SOLID)).tracks}
    sliding = {t.kind: t.time_s for t in x.run_race(x.Race(ball=x.RaceBall.SLIDING)).tracks}
    for kind, t in rolling.items():
        assert t / sliding[kind] == pytest.approx(math.sqrt(7 / 5), rel=1e-9)


def test_every_ball_crosses_the_finish_equally_fast_whatever_its_track():
    spec = x.Race()
    run = x.run_race(spec)
    g = rc.G * spec.gravity_share
    assert run.finish_speed_m_s == pytest.approx(math.sqrt(2 * g * spec.drop_m), rel=1e-12)
    # Each track's own time table says the same: its last step's speed.
    for track in run.tracks:
        p = track.path
        step = math.hypot(p.x_m[-1] - p.x_m[-2], p.y_m[-1] - p.y_m[-2])
        assert step / (p.t_s[-1] - p.t_s[-2]) == pytest.approx(run.finish_speed_m_s, rel=0.01), track.kind


def test_each_ball_s_velocity_and_acceleration_are_its_time_table_s_slopes():
    # Independent of how the engine computes them: the time table's own
    # central differences, away from the start where the samples crowd.
    for track in x.run_race(x.Race()).tracks:
        p, m = track.path, track.motion
        top_a = max(math.hypot(a, b) for a, b in zip(m.ax_m_s2, m.ay_m_s2, strict=True))
        for j in range(20, len(p.t_s) - 1):
            dt = p.t_s[j + 1] - p.t_s[j - 1]
            vx = (p.x_m[j + 1] - p.x_m[j - 1]) / dt
            vy = (p.y_m[j + 1] - p.y_m[j - 1]) / dt
            assert math.hypot(vx - m.vx_m_s[j], vy - m.vy_m_s[j]) < 0.01 * track.top_speed_m_s, (track.kind, j)
            ax = (m.vx_m_s[j + 1] - m.vx_m_s[j - 1]) / dt
            ay = (m.vy_m_s[j + 1] - m.vy_m_s[j - 1]) / dt
            assert math.hypot(ax - m.ax_m_s2[j], ay - m.ay_m_s2[j]) < 0.02 * top_a, (track.kind, j)


def test_the_track_only_pushes_square_to_itself_and_a_ball_rolls_with_g_prime_along_it():
    for ball in x.RaceBall:
        spec = x.Race(ball=ball)
        g = rc.G * spec.gravity_share
        for track in x.run_race(spec).tracks:
            m = track.motion
            for j in range(1, len(m.vx_m_s)):
                speed = math.hypot(m.vx_m_s[j], m.vy_m_s[j])
                tx, ty = m.vx_m_s[j] / speed, m.vy_m_s[j] / speed
                # Along the track only gravity's share g' acts: for a block
                # that slides, that is all of g, and the track's push, a − g,
                # stands square to it.
                along = m.ax_m_s2[j] * tx + m.ay_m_s2[j] * ty
                assert along == pytest.approx(-g * ty, abs=1e-9), (ball, track.kind, j)
            # Let go, the ball has no speed yet and falls along the track.
            assert (m.vx_m_s[0], m.vy_m_s[0]) == (0.0, 0.0)
            assert math.hypot(m.ax_m_s2[0], m.ay_m_s2[0]) <= g + 1e-12


pt = importlib.import_module("staunlabor.domain.experiments.pit")


def _lies_in_the_pit(run: Any, settled: Any) -> None:
    """Every ball at rest inside the pit, below the rim, pressed into the
    lining and into the others by a sliver at most, and all of them in one
    heap: each touching another."""
    b, r = run.basin, run.ball_radius_m
    ends = [(ball.x_m[-1], ball.y_m[-1]) for ball in settled.balls]
    for x_, y_ in ends:
        assert b.left_x_m < x_ < b.right_x_m
        assert y_ < b.rim_y_m
        assert all(sink < 0.05 * r for sink, _nx, _ny in pt._touching(b, r, x_, y_))
    for k, (x1, y1) in enumerate(ends):
        others = [math.hypot(x1 - x2, y1 - y2) for m, (x2, y2) in enumerate(ends) if m != k]
        assert min(others) > 2 * r * 0.95
        assert min(others) < 2 * r * 1.05, "a ball apart from the heap"


def test_the_race_s_balls_jump_into_the_pit_and_come_to_lie_together_at_its_bottom():
    run = x.run_race(x.Race())
    settled = x.settle_race(run)
    assert settled.still
    _lies_in_the_pit(run, settled)
    # At the bottom: the lowest of them on it.
    b = run.basin
    lowest = min(settled.balls, key=lambda ball: ball.y_m[-1])
    floor = b.bottom_y_m - b.bottom_radius_m + run.ball_radius_m
    assert lowest.y_m[-1] == pytest.approx(floor, abs=0.2 * run.ball_radius_m)


def test_a_ball_flies_from_the_finish_under_g_alone_until_it_lands():
    run = x.run_race(x.Race())
    settled = x.settle_race(run)
    for track, ball, entry in zip(run.tracks, settled.balls, x.race_entries(run), strict=True):
        assert entry.time_s == track.time_s
        assert ball.start_s >= entry.time_s
        for k in range(4):
            # The throw, while it is in the air; semi-implicit Euler's step
            # leaves a tenth of a millimetre.
            t = ball.start_s + k * settled.sample_s - entry.time_s
            assert ball.x_m[k] == pytest.approx(entry.x_m + entry.vx_m_s * t, abs=1e-9), track.kind
            assert ball.y_m[k] == pytest.approx(entry.y_m + entry.vy_m_s * t - rc.G * t * t / 2, abs=2e-4)
            assert ball.vy_m_s[k] == pytest.approx(entry.vy_m_s - rc.G * t, abs=2e-3)


def test_in_the_pit_energy_only_ever_leaves():
    run = x.run_race(x.Race())
    settled = x.settle_race(run)
    k = run.inertia
    # What the balls bring: speed, the spin of rolling, and height.
    brought = sum((1 + k) * (e.vx_m_s**2 + e.vy_m_s**2) / 2 + rc.G * e.y_m for e in x.race_entries(run))
    last_in = max(ball.start_s for ball in settled.balls)
    totals = {}
    for ball in settled.balls:
        for j, (y_, vx_, vy_) in enumerate(zip(ball.y_m, ball.vx_m_s, ball.vy_m_s, strict=True)):
            t = round(ball.start_s + j * settled.sample_s, 6)
            if t >= last_in:
                totals[t] = totals.get(t, 0.0) + (vx_**2 + vy_**2) / 2 + rc.G * y_
    # Speed and height alone can only be less than all there is (the spin and
    # the springs hold the rest), and all there is only falls.
    assert max(totals.values()) <= brought + 1e-6
    lying = sum(rc.G * ball.y_m[-1] for ball in settled.balls)
    assert totals[max(totals)] == pytest.approx(lying, abs=1e-4)


def test_every_kind_of_ball_comes_to_rest_in_the_pit_over_the_whole_run_allowed():
    for ball in x.RaceBall:
        for share in (rc.SHORTEST_RUN, rc.LONGEST_RUN):
            run = x.run_race(x.Race(drop_m=0.5, run_m=0.5 * share, ball=ball))
            settled = x.settle_race(run)
            assert settled.still, (ball, share)
            _lies_in_the_pit(run, settled)
    # A block that slides does not turn: nothing to give a spin to.
    assert x.run_race(x.Race(ball=x.RaceBall.SLIDING)).inertia == 0


def test_the_pit_s_bowl_reaches_past_the_farthest_throw():
    run = x.run_race(x.Race())
    b = run.basin
    assert b.left_x_m < 1.2 - run.ball_radius_m
    assert b.rim_y_m < -0.5
    assert b.top_y_m > -0.5
    # The bottom touches both sides: its centre a radius from each.
    s, c = math.sin(b.slope_rad), math.cos(b.slope_rad)
    for sign, rim_x in ((1, b.left_x_m), (-1, b.right_x_m)):
        # The side's line through the rim, its inward normal (±sin, cos).
        gap = sign * s * (b.bottom_x_m - rim_x) + c * (b.bottom_y_m - b.rim_y_m)
        assert gap == pytest.approx(b.bottom_radius_m, rel=1e-9)
    assert pytest.approx(run.ball_radius_m) == pt.BALL_SHARE * 1.2


def test_every_track_runs_from_the_start_to_the_finish_and_never_above_the_start():
    for track in x.run_race(x.Race()).tracks:
        p = track.path
        assert (p.x_m[0], p.y_m[0]) == pytest.approx((0.0, 0.0), abs=1e-12)
        assert (p.x_m[-1], p.y_m[-1]) == pytest.approx((1.2, -0.5), abs=1e-9)
        assert max(p.y_m[1:]) < 0, track.kind
        assert list(p.t_s) == sorted(p.t_s)
        assert p.t_s[-1] == pytest.approx(track.time_s, rel=1e-12)


def test_on_the_cycloid_every_start_takes_the_same_time_and_on_a_bowl_it_does_not():
    v = x.race_valley()
    for start in v.starts:
        assert start.cycloid_time_s == pytest.approx(v.tautochrone_s, rel=1e-6)
    bowl = [s.circle_time_s for s in v.starts]
    assert bowl == sorted(bowl, reverse=True), "the higher on the bowl, the later"
    # The bowl is a pendulum: a quarter swing is √(R/g')·K(sin(φ₀/2)), by SciPy.
    assert bowl == pytest.approx(
        [0.6964836016778231, 0.6853672770891945, 0.6625263074746162, 0.6513295921363024], rel=1e-6
    )


def _least_push(kind: x.CurveKind, drop: float, run_m: float) -> float:
    """The least push of the track on a block sliding down it, per unit mass:
    ``g·cos α + v²·κ`` (``κ > 0`` where the track curves up). Below zero the
    track would have to pull, so the block leaves it. A sliding block is the
    worst case: it is the fastest at every height. A track that curls back
    (``dx < 0``) has the ball under an overhang, which counts as no push."""
    shape = rc._shape(kind, drop, run_m)
    least = math.inf
    e = 1e-6
    for j in range(1, 2000):
        p = j / 2000
        _, y, dx, dy = shape(p)
        _, _, dx1, dy1 = shape(p + e)
        _, _, dx0, dy0 = shape(p - e)
        ddx, ddy = (dx1 - dx0) / (2 * e), (dy1 - dy0) / (2 * e)
        speed = math.hypot(dx, dy)
        kappa = (dx * ddy - dy * ddx) / speed**3
        push = rc.G * dx / speed + 2 * rc.G * -y * kappa
        least = min(least, push if dx > 0 else -math.inf)
    return least


def test_every_track_holds_its_ball_over_the_whole_run_the_race_allows():
    # The push depends on run/drop alone, so one drop covers every race.
    for share in (rc.SHORTEST_RUN, 1.5, 2.4, rc.LONGEST_RUN):
        for kind in x.CurveKind:
            assert _least_push(kind, 0.5, 0.5 * share) >= 0, (kind, share)
    # Just shorter, the hump throws a sliding block off its crest, and the
    # circle curls back over its start: why the race stops at 1.1.
    assert _least_push(x.CurveKind.HUMP, 0.5, 0.5 * 1.0) < 0
    assert _least_push(x.CurveKind.CIRCLE, 0.5, 0.5 * 0.95) < 0


def test_the_race_refuses_a_finish_it_cannot_reach():
    with pytest.raises(ValueError):
        x.Race(drop_m=0.0)
    with pytest.raises(ValueError):
        x.Race(drop_m=0.1, run_m=2.0)
    with pytest.raises(ValueError):
        x.Race(drop_m=0.5, run_m=0.5)


# ── the Bernoulli elephant ───────────────────────────────────────────────────

ELEPHANT = importlib.import_module("staunlabor.domain.experiments.elephant")


def test_the_jet_keeps_the_momentum_its_opening_put_in_at_every_height():
    # ∫ρu² dA over the whole plane, by a radial sum of its own, not the engine's rule.
    jet = x.Jet()
    put_in = x.Elephant().jet.speed_m_s ** 2 * ELEPHANT.RHO * math.pi * jet.opening_m**2 / 4
    assert ELEPHANT.momentum_flux_n(jet) == pytest.approx(put_in)
    for s in (0.01, 0.2, 0.5, 2.0):
        b, u_c = ELEPHANT.width(jet, s), ELEPHANT.centre_speed(jet, s)
        reach = 6 * b
        n = 4000

        def u(r: float, b: float = b, u_c: float = u_c) -> float:
            return u_c * math.exp(-(r * r) / (b * b))

        flux = sum(
            ELEPHANT.RHO * u((i + 0.5) * reach / n) ** 2 * 2 * math.pi * (i + 0.5) * reach / n for i in range(n)
        ) * (reach / n)
        assert flux == pytest.approx(put_in, rel=1e-4)


def test_the_centre_speed_slows_at_the_round_jet_s_rate_from_the_opening_s_own_speed():
    # The textbook law u_c = B·U₀·D/(s − s₀): 1/u_c grows by 1/(B·U₀·D) per metre.
    jet = x.Jet()
    assert ELEPHANT.centre_speed(jet, 0.0) == pytest.approx(jet.speed_m_s)
    for s in (0.1, 0.5, 3.0):
        slope = (1 / ELEPHANT.centre_speed(jet, s + 1e-3) - 1 / ELEPHANT.centre_speed(jet, s)) / 1e-3
        assert slope == pytest.approx(1 / (ELEPHANT.DECAY * jet.speed_m_s * jet.opening_m), rel=1e-6)
    # Its virtual origin lies B·D behind the opening.
    assert ELEPHANT.centre_speed(jet, 1.0) == pytest.approx(
        ELEPHANT.DECAY * jet.speed_m_s * jet.opening_m / (1.0 + ELEPHANT.DECAY * jet.opening_m)
    )


def test_the_rule_over_the_ball_agrees_with_the_closed_form_on_the_axis():
    # A centred disk under a Gaussian: ∫u² dA = u_c²·π·b²/2·(1 − e^(−2R²/b²)).
    el = x.Elephant()
    r = el.ball.radius_m
    for s in (0.06, 0.36, 1.0):
        b = ELEPHANT.width(el.jet, s)
        closed = ELEPHANT.centre_speed(el.jet, s) ** 2 * math.pi * b * b / 2 * (1 - math.exp(-2 * r * r / (b * b)))
        assert ELEPHANT.cover(el, s, 0.0).mean_square * math.pi * r * r == pytest.approx(closed, rel=2e-3)


def test_on_the_axis_nothing_pulls_sideways_and_off_it_the_air_pulls_the_ball_back():
    el = x.Elephant()
    h = ELEPHANT.float_height(el)
    assert ELEPHANT.side_n(el, h, 0.0) == pytest.approx(0.0, abs=1e-12)
    pulls = [-ELEPHANT.side_n(el, h, e) for e in (0.01, 0.03, 0.06, 0.12, 0.25)]
    assert all(p > 0 for p in pulls), "toward the axis, from either side"
    assert ELEPHANT.side_n(el, h, -0.03) == pytest.approx(-ELEPHANT.side_n(el, h, 0.03))
    assert pulls[0] < pulls[1] < pulls[2] and pulls[2] > pulls[4], "it grows, then fades out of the jet"
    assert ELEPHANT.side_n(x.Elephant(coanda=0.0), h, 0.03) == 0.0


def test_the_ball_floats_where_the_lift_is_its_weight_less_its_buoyancy_and_comes_back_to_it():
    el = x.Elephant()
    f = x.elephant_figures(el)
    net = f.weight_n - f.buoyancy_n
    assert ELEPHANT.lift_n(el, f.float_height_m) == pytest.approx(net, rel=1e-9)
    assert ELEPHANT.lift_n(el, f.float_height_m - 0.02) > net > ELEPHANT.lift_n(el, f.float_height_m + 0.02)
    # The displaced air: ρ·(4/3)·π·R³·g, about a fourteenth of the default ball's weight.
    assert f.buoyancy_n == pytest.approx(1.2 * 4 / 3 * math.pi * 0.075**3 * 9.80665)
    assert f.buoyancy_n / f.weight_n == pytest.approx(0.0707, abs=5e-4)


def test_the_default_build_floats_as_the_exhibit_does_and_states_its_figures():
    # As at the exhibit: a 10 cm opening, a 15 cm ball, floating 30 to 35 cm up.
    f = x.elephant_figures(x.Elephant())
    assert 0.30 < f.float_height_m < 0.40
    assert f.float_height_m == pytest.approx(0.357, abs=5e-4)
    assert f.float_height_m - 0.075 == pytest.approx(0.282, abs=5e-4)
    assert f.lift_off_m_s == pytest.approx(12.07, abs=0.005)
    assert f.air_m_s == pytest.approx(7.41, abs=0.005)
    assert f.flow_m3_s * 3600 == pytest.approx(410, abs=0.5)
    assert f.tilt_limit_deg == pytest.approx(43.7, abs=0.06)
    assert f.bob_hz == pytest.approx(0.54, abs=0.005)
    assert f.sway_hz == pytest.approx(1.85, abs=0.005)
    assert 5e4 < f.reynolds < 2e5, "below a smooth sphere's drag crisis, where C_d = 0.47 holds"


def test_the_air_lifts_the_ball_off_the_rim_only_from_the_lift_off_speed_on():
    el = x.Elephant()
    lift_off = x.elephant_figures(el).lift_off_m_s
    weak = x.Elephant(jet=x.Jet(speed_m_s=lift_off * 0.98))
    strong = x.Elephant(jet=x.Jet(speed_m_s=lift_off * 1.02))
    assert x.elephant_figures(weak).float_height_m is None
    assert x.elephant_figures(strong).float_height_m is not None
    resting = x.run_elephant(weak, (), 1.0)
    assert max(resting.y_m) == pytest.approx(ELEPHANT.rest_height(weak))
    assert ELEPHANT.rest_height(el) == pytest.approx(math.sqrt(0.075**2 - 0.05**2))


def test_a_ball_set_on_the_opening_rises_and_settles_at_the_stated_height():
    el = x.Elephant()
    r = x.run_elephant(el, (), 8.0)
    assert r.fell_at_s is None
    assert r.y_m[0] == pytest.approx(ELEPHANT.rest_height(el))
    assert max(r.y_m) > x.elephant_figures(el).float_height_m, "it overshoots once"
    assert r.y_m[-1] == pytest.approx(x.elephant_figures(el).float_height_m, abs=1e-3)
    assert r.x_m[-1] == pytest.approx(0.0, abs=1e-9)


def test_a_push_sideways_comes_back_and_a_slow_tilt_drops_the_ball_just_past_the_limit():
    el = x.Elephant()
    nudged = x.run_elephant(el, (x.ElephantMove(at_s=3.0, tilt_deg=0.0, over_s=0.0, nudge_m_s=0.8),), 8.0)
    assert nudged.fell_at_s is None
    assert max(abs(v) for v in nudged.x_m) > 0.05
    assert abs(nudged.x_m[-1]) < 0.02
    limit = x.elephant_figures(el).tilt_limit_deg
    tilted = x.run_elephant(el, (x.ElephantMove(at_s=1.0, tilt_deg=80.0, over_s=40.0),), 30.0)
    assert tilted.fell_at_s is not None
    assert limit < tilted.tilt_deg[-1] < limit + 3, "falls only once the jet cannot hold it, a little late"


def test_a_tilted_jet_holds_its_ball_lower_and_to_the_low_side():
    f = x.elephant_figures(x.Elephant())
    tilts = f.tilt_curve
    assert tilts[0].offset_m == 0.0
    assert all(b.offset_m > a.offset_m for a, b in itertools.pairwise(tilts))
    assert tilts[-1].height_m < tilts[0].height_m
    assert f.side_curve[0].side_n == pytest.approx(0.0, abs=1e-12)
    assert max(p.side_n for p in f.side_curve) > (f.weight_n - f.buoyancy_n) * math.sin(math.radians(30))


def test_the_elephant_refuses_what_it_cannot_be():
    with pytest.raises(ValueError, match="wider than the opening"):
        x.Elephant(jet=x.Jet(opening_m=0.2))
    with pytest.raises(ValueError, match="rises on its own"):
        x.FloatingBall(mass_kg=0.001)
    with pytest.raises(ValueError, match="a run lasts"):
        x.run_elephant(x.Elephant(), (), 61.0)
    with pytest.raises(ValueError, match="tilts at most"):
        x.run_elephant(x.Elephant(), (x.ElephantMove(at_s=0.0, tilt_deg=85.0),), 1.0)


# ── the smoke ring ───────────────────────────────────────────────────────────

SMOKE = importlib.import_module("staunlabor.domain.experiments.smoke")


def test_a_press_squeezes_out_the_volume_of_a_stretched_skin_and_its_ring():
    # The skin's shape w(r) = x·ln(R/r)/ln(R/a), integrated by a radial sum of its own.
    drum = x.Drum()
    big, a, h = drum.diameter_m / 2, drum.ring_m / 2, drum.hole_m / 2
    n = 20000
    step = (big - a) / n
    skin = sum(
        math.log(big / (a + (i + 0.5) * step)) / math.log(big / a) * 2 * math.pi * (a + (i + 0.5) * step) * step
        for i in range(n)
    )
    assert SMOKE.effective_area(drum) == pytest.approx(skin + math.pi * (a * a - h * h), rel=1e-6)
    assert SMOKE.effective_area(drum) == pytest.approx(0.799, abs=5e-4)
    assert SMOKE.effective_area(drum) / SMOKE.hole_area(drum) == pytest.approx(11.30, abs=0.005)


def test_the_ring_s_circulation_is_half_the_integral_of_the_jet_s_square_and_grows_with_the_pace():
    ex = x.SmokeExhibit()
    ratio = SMOKE.effective_area(ex.drum) / SMOKE.hole_area(ex.drum)
    for duration in (0.3, 0.6, 1.2):
        ring = x.ring_from_push(ex, x.Push(0.08, duration))
        # Half a cosine: ∫ẋ²dt = π²d²/(8T).
        assert ring.circulation_m2_s == pytest.approx(0.5 * ratio**2 * math.pi**2 * 0.08**2 / (8 * duration), rel=1e-4)
        assert ring.stroke_m == pytest.approx(ratio * 0.08, rel=1e-9)
        assert ring.reynolds == pytest.approx(ring.circulation_m2_s / SMOKE.NU)
    assert x.ring_from_push(ex, x.Push(0.08, 0.25)).circulation_m2_s == pytest.approx(
        2 * x.ring_from_push(ex, x.Push(0.08, 0.5)).circulation_m2_s, rel=1e-4
    )


def test_a_slug_longer_than_four_hole_diameters_leaves_the_rest_as_a_trailing_jet():
    narrow = x.SmokeExhibit(drum=x.Drum(hole_m=0.15, ring_m=0.3))
    ring = x.ring_from_push(narrow, x.Push(0.08, 0.5))
    assert ring.stroke_ratio > SMOKE.FORMATION and ring.trailing
    # The ring takes up the slug's first four diameters only, so less than
    # half the integral of the whole press's square: summed here at mid-steps.
    ratio = SMOKE.effective_area(narrow.drum) / SMOKE.hole_area(narrow.drum)
    pace = math.pi * 0.08 / (2 * 0.5)
    full = 0.5 * sum((ratio * pace * math.sin(math.pi * (k + 0.5) / 500)) ** 2 for k in range(500)) * 1e-3
    assert ring.circulation_m2_s < full * 0.95
    assert not x.ring_from_push(x.SmokeExhibit(), x.Push(0.08, 0.5)).trailing


def test_the_ring_flies_at_saffman_s_speed_for_its_size():
    ex = x.SmokeExhibit()
    ring = x.ring_from_push(ex, x.Push(0.08, 0.5))
    assert ring.radius_m == pytest.approx(0.6 * 0.30)
    r, a = ring.radius_m, 0.35 * ring.radius_m
    assert ring.speed_m_s == pytest.approx(ring.circulation_m2_s / (4 * math.pi * r) * (math.log(8 * r / a) - 0.25))


def test_too_fast_smears_too_slow_drifts_and_about_half_a_second_makes_a_ring():
    # At the exhibit a press of about half a second is best; too fast is
    # too turbulent, a slow press does nothing. The two thresholds are set to it.
    ex = x.SmokeExhibit()
    verdicts = {d: x.ring_from_push(ex, x.Push(0.08, d)).verdict for d in (0.1, 0.5, 1.0, 2.0)}
    assert verdicts == {0.1: x.Verdict.TOO_FAST, 0.5: x.Verdict.RING, 1.0: x.Verdict.RING, 2.0: x.Verdict.TOO_SLOW}
    f = x.smoke_figures(ex)
    assert f.fastest_s == pytest.approx(0.210, abs=5e-4)
    assert f.slowest_s == pytest.approx(1.284, abs=5e-4)
    assert f.best_s == pytest.approx(0.519, abs=5e-4)
    assert f.best.verdict is x.Verdict.RING
    assert f.stroke_ratio == pytest.approx(3.01, abs=0.005), "under the formation number: all of it rolls up"
    ring = x.ring_from_push(ex, x.Push(0.08, 0.5))
    assert ring.reynolds == pytest.approx(67224, abs=1)
    assert ring.speed_m_s == pytest.approx(1.28, abs=0.005)


def test_the_hand_feels_the_skin_and_an_air_pressure_that_grows_with_the_square_of_the_pace():
    ex = x.SmokeExhibit()
    spring = SMOKE.stiffness_n_m(ex.drum)
    assert spring == pytest.approx(2 * math.pi * 150 / math.log(1.9 / 0.4))
    slow = x.ring_from_push(ex, x.Push(0.08, 2.0))
    assert slow.peak_force_n == pytest.approx(spring * 0.08, rel=1e-3), "slowly, only the skin"
    fast = x.ring_from_push(ex, x.Push(0.08, 0.1))
    assert fast.peak_force_n > 2 * slow.peak_force_n
    assert fast.peak_force_n == pytest.approx(122, abs=0.5)


def test_only_air_going_out_makes_a_ring():
    ex = x.SmokeExhibit()
    up = SMOKE.ring_of(ex, (0.0, 0.25, 0.5), (0.08, 0.04, 0.0))
    assert up.verdict is x.Verdict.NONE and up.circulation_m2_s == 0
    held = SMOKE.ring_of(ex, (0.0, 1.0), (0.05, 0.05))
    assert held.verdict is x.Verdict.NONE


def test_a_laminar_ring_reaches_the_ceiling_and_a_turbulent_one_widens_keeping_its_impulse():
    ex = x.SmokeExhibit()
    calm = x.smoke_flight(ex, x.ring_from_push(ex, x.Push(0.08, 0.5)), 5.0)
    assert calm.z_m[-1] >= SMOKE.CEILING_M
    assert calm.radius_m[-1] == calm.radius_m[0]
    assert calm.speed_m_s[-1] < calm.speed_m_s[0], "its core thickens, and it slows a little"
    assert calm.x_m[-1] == pytest.approx(0.5 * calm.t[-1])
    rough = x.smoke_flight(ex, x.ring_from_push(ex, x.Push(0.08, 0.1)), 5.0)
    r0, r1 = rough.radius_m[0], rough.radius_m[-1]
    assert r1 > r0
    # Impulse ρπR²Γ kept and a/R fixed: the speed falls with the cube of the size.
    assert rough.speed_m_s[-1] / rough.speed_m_s[0] == pytest.approx((r0 / r1) ** 3, rel=1e-9)
    assert r1 - r0 == pytest.approx(SMOKE.TURBULENT_GROWTH * rough.z_m[-1], rel=1e-3)


def test_the_smoke_ring_refuses_what_it_cannot_be():
    with pytest.raises(ValueError, match="inside the ring"):
        x.Drum(hole_m=0.5)
    with pytest.raises(ValueError, match="less than the drum is deep"):
        x.Drum(stroke_m=0.4)
    with pytest.raises(ValueError, match="at most"):
        x.ring_from_push(x.SmokeExhibit(), x.Push(0.1, 0.5))
    with pytest.raises(ValueError, match="flight lasts"):
        x.smoke_flight(x.SmokeExhibit(), x.ring_from_push(x.SmokeExhibit(), x.Push()), 30.0)


# ── the ball cannon ──────────────────────────────────────────────────────────

CANNON = importlib.import_module("staunlabor.domain.experiments.cannon")


def test_the_exhibit_s_balls_are_solid_elastomer_and_weigh_about_eight_to_three_to_one():
    masses = [ball.mass_kg for ball in x.BallStack().balls]
    assert masses[0] == pytest.approx(1100 * math.pi / 6 * 0.10**3)
    assert masses[0] / masses[2] == pytest.approx(8.0, abs=0.01)
    assert masses[1] / masses[2] == pytest.approx(2.74, abs=0.01)
    assert x.cannon_figures(x.BallStack()).masses_kg == pytest.approx(masses)


def test_a_contact_is_hertz_s_stiffness_of_the_two_radii_and_the_elastomer():
    stack = x.BallStack()
    e_star = 3e6 / (1 - 0.5**2)
    assert CANNON.stiffness(stack, 0) == pytest.approx(4 / 3 * e_star * math.sqrt(0.05)), "a rigid floor"
    reduced = 0.05 * 0.035 / (0.05 + 0.035)
    assert CANNON.stiffness(stack, 1) == pytest.approx(4 / 3 * e_star / 2 * math.sqrt(reduced)), "two balls"


def test_one_lossless_ball_on_the_floor_squashes_as_hertz_says_and_comes_back_as_fast():
    # Hertz in closed form: δ_max = (5mv²/4K)^(2/5), F_max = K·δ_max^(3/2), the
    # contact lasting 2.94·δ_max/v — gravity, which presses on during the
    # contact, adding a little to the first two.
    stack = x.BallStack(balls=(x.Ball(0.10),), drop_m=0.5, floor_restitution=1.0)
    contact = x.cannon_drop(stack, 1.0).contacts[0]
    m, k, v = stack.balls[0].mass_kg, CANNON.stiffness(stack, 0), contact.closing_m_s
    deepest = (5 * m * v * v / (4 * k)) ** 0.4
    assert contact.peak_overlap_m == pytest.approx(deepest, rel=0.01)
    assert contact.peak_force_n == pytest.approx(k * deepest**1.5, rel=0.015)
    assert contact.end_s - contact.start_s == pytest.approx(2.9432 * deepest / v, rel=0.01)
    assert contact.parting_m_s == pytest.approx(v, rel=1e-3), "no damping, no loss"
    # The impulse is the momentum turned round, and gravity's while it lasts.
    duration = contact.end_s - contact.start_s
    assert contact.impulse_n_s == pytest.approx(m * (v + contact.parting_m_s) + m * CANNON.G * duration, rel=1e-5)


def test_the_damping_gives_back_about_e_of_the_closing_speed():
    # Flores et al.'s damping is fitted to give e back; it does to 2 %, and one
    # ball climbs about e² of its fall.
    one = x.BallStack(balls=(x.Ball(0.10),), drop_m=0.2)
    contact = x.cannon_drop(one, 1.0).contacts[0]
    assert contact.parting_m_s / contact.closing_m_s == pytest.approx(0.85, rel=0.02)
    assert x.cannon_launch(one).times_drop == pytest.approx(0.85**2, rel=0.05)


def test_the_exhibit_s_three_contacts_overlap_and_press_with_a_kilonewton_at_the_floor():
    f = x.cannon_figures(x.BallStack())
    first: dict[int, Any] = {}
    for contact in f.contacts:
        first.setdefault(contact.contact, contact)
    floor, lower, upper = first[0], first[1], first[2]
    assert floor.peak_force_n == pytest.approx(1239, abs=1) and floor.peak_overlap_m == pytest.approx(0.0101, abs=1e-4)
    assert lower.peak_force_n == pytest.approx(559, abs=1) and upper.peak_force_n == pytest.approx(281, abs=1)
    assert 0.009 < floor.end_s - floor.start_s < 0.011, "about ten milliseconds"
    # Touching, they are all closed at once: the middle ball presses into the
    # bottom one while that one is still squashing into the floor.
    assert lower.start_s < floor.end_s and upper.start_s < floor.end_s
    assert len(f.impact.t_ms) == 301 and f.impact.t_ms[-1] == pytest.approx(30.0)
    assert max(f.impact.force_n[0]) == pytest.approx(floor.peak_force_n, rel=0.01)


def test_touching_balls_send_the_top_one_up_far_less_than_hits_one_after_another_would():
    f = x.cannon_figures(x.BallStack())
    assert f.impact_m_s == pytest.approx(4.4202, abs=1e-4), "a metre's fall, the air taking 1 cm/s"
    one, two, three = f.launches
    assert one.times_drop == pytest.approx(0.698, abs=1e-3), "e² of its fall, less the air"
    assert [launch.balls for launch in f.launches] == [1, 2, 3]
    assert three.launch_m_s == pytest.approx(6.633, abs=1e-3)
    assert three.apex_m == pytest.approx(2.374, abs=1e-3) and three.times_drop == pytest.approx(2.205, abs=1e-3)
    assert two.times_drop == pytest.approx(1.300, abs=1e-3)
    # The textbook's model, instantaneous hits one after another: 10.85 m/s;
    # without losses 14.88; with each ball far lighter 7v = 30.9.
    assert three.sequential_launch_m_s == pytest.approx(10.853, abs=1e-3)
    assert three.ideal_launch_m_s == pytest.approx(14.877, abs=1e-3)
    assert three.textbook_launch_m_s == pytest.approx(7 * f.impact_m_s)
    assert f.energy_share == pytest.approx(0.192, abs=1e-3)


def test_a_gap_of_two_centimetres_parts_the_contacts_and_nearly_reaches_hits_one_after_another():
    touching = x.cannon_launch(x.BallStack())
    apart = x.cannon_launch(x.BallStack(gap_m=0.02))
    assert apart.launch_m_s > 1.5 * touching.launch_m_s
    assert apart.launch_m_s == pytest.approx(apart.sequential_launch_m_s, rel=0.04)
    # What the gap does: the balls' contact closes only once the bottom ball is
    # already springing back off the floor, past the middle of that contact —
    # touching, it closes in its first fifth.
    for gap, later in ((0.02, True), (0.0, False)):
        first: dict[int, Any] = {}
        for contact in x.cannon_drop(x.BallStack(gap_m=gap), 1.0).contacts:
            first.setdefault(contact.contact, contact)
        middle = (first[0].start_s + first[0].end_s) / 2
        assert (first[1].start_s > middle) is later, gap


def test_the_sequential_model_without_losses_is_the_closed_form():
    stack = x.BallStack(balls=(x.Ball(0.40), x.Ball(0.10), x.Ball(0.025)))
    second = (2 * 64 + 63) / 65
    third = (2 * 64 * second + 63) / 65
    assert CANNON.sequential_launch(stack, 1.0, lossless=True) == pytest.approx(third, rel=1e-12)
    assert [CANNON.textbook_factor(n) for n in (1, 2, 3)] == [1, 3, 7]


def test_the_big_ball_on_top_sends_nothing_up():
    upside_down = x.BallStack(balls=(x.Ball(0.05), x.Ball(0.07), x.Ball(0.10)))
    launches = x.cannon_figures(upside_down).launches
    assert launches[2].launch_m_s < launches[1].launch_m_s < launches[0].launch_m_s
    assert launches[2].times_drop < 0.2


def test_the_ball_cannon_refuses_what_it_cannot_be():
    with pytest.raises(ValueError, match="one, two or three"):
        x.BallStack(balls=())
    with pytest.raises(ValueError, match="between 1 and 40 cm"):
        x.Ball(0.5)
    with pytest.raises(ValueError, match="restitution"):
        x.BallStack(ball_restitution=0.1)
    with pytest.raises(ValueError, match="Young"):
        x.BallStack(youngs_mpa=1000)
    with pytest.raises(ValueError, match="dropped from"):
        x.BallStack(drop_m=5.0)
    with pytest.raises(ValueError, match="drop lasts"):
        x.cannon_drop(x.BallStack(), 30.0)


# ── the pendulum, the block the swinging exhibits stand on ───────────────────


def test_jacobi_s_functions_keep_their_identities_and_their_limits():
    for m in (0.1, 0.5, 0.9, 0.999):
        for u in (-2.2, 0.3, 1.7, 5.0):
            sn, cn, dn = x.jacobi(u, m)
            assert sn * sn + cn * cn == pytest.approx(1, abs=1e-14)
            assert dn * dn + m * sn * sn == pytest.approx(1, abs=1e-14)
    assert x.jacobi(0.7, 0.0) == pytest.approx((math.sin(0.7), math.cos(0.7), 1.0))
    sech = 1 / math.cosh(0.7)
    assert x.jacobi(0.7, 1.0) == pytest.approx((math.tanh(0.7), sech, sech))
    # sn reaches 1 at the quarter period K, and its slope is cn·dn.
    m, u, h = 0.7, 1.1, 1e-6
    assert x.jacobi(x.ellipk(m), m)[0] == pytest.approx(1, abs=1e-14)
    slope = (x.jacobi(u + h, m)[0] - x.jacobi(u - h, m)[0]) / (2 * h)
    sn, cn, dn = x.jacobi(u, m)
    assert slope == pytest.approx(cn * dn, rel=1e-8)


def test_a_wider_swing_takes_longer_by_the_elliptic_integral():
    # K(1/2) = 1.8540746773013719 (A&S table 17.1): a swing to the horizontal
    # takes 18 % longer than a small one.
    assert x.period_factor(90) == pytest.approx(2 * 1.8540746773013719 / math.pi, rel=1e-14)
    for degrees in (1, 5, 10, 16):
        a = math.radians(degrees)
        assert x.period_factor(degrees) == pytest.approx(1 + a**2 / 16 + 11 * a**4 / 3072, rel=2e-6)
    assert round(x.period_factor(16), 4) == 1.0049
    assert round(x.period_factor(30), 4) == 1.0174
    assert x.small_period_s(1.0) == pytest.approx(2.006, abs=1e-3)
    # A length tuned for a swing gives that swing its period exactly.
    assert x.period_s(x.length_for(1.5, 40.0), 40.0) == pytest.approx(1.5, rel=1e-14)


def test_the_exact_pendulum_is_the_stepped_one():
    for length, amplitude in ((0.5, 60.0), (0.2, 5.0), (2.0, 150.0)):
        run = x.swing(length, amplitude, 10.0)
        worst = max(abs(a - x.angle_deg(length, amplitude, t)) for t, a in zip(run.t, run.angle_deg, strict=True))
        assert worst < 1e-7


def test_the_exact_pendulum_is_as_exact_a_minute_in():
    length, amplitude = 0.34, 15.0
    period = x.period_s(length, amplitude)
    for t in (0.1, 0.7, 1.3):
        assert x.angle_deg(length, amplitude, t + 51 * period) == pytest.approx(
            x.angle_deg(length, amplitude, t), abs=1e-9
        )
    assert x.angle_deg(length, amplitude, period / 2) == pytest.approx(-amplitude, abs=1e-9)
    assert x.angle_deg(length, amplitude, period / 4) == pytest.approx(0, abs=1e-9)


def test_damping_lets_a_swing_die_away_as_its_exponential():
    # Small and lightly damped: the amplitude falls as e^(−c·t/2).
    run = x.swing(1.0, 2.0, 20.0, damping_per_s=0.1)
    tops = [
        abs(a)
        for i, a in enumerate(run.angle_deg[1:-1], 1)
        if abs(a) >= abs(run.angle_deg[i - 1]) and abs(a) >= abs(run.angle_deg[i + 1])
    ]
    assert tops[-1] == pytest.approx(2.0 * math.exp(-0.05 * 20.0), rel=0.05)


def test_the_pendulum_refuses_what_is_not_a_pendulum():
    with pytest.raises(ValueError, match="positive length"):
        x.small_period_s(0.0)
    with pytest.raises(ValueError, match="between 0° and 180°"):
        x.period_factor(180)
    with pytest.raises(ValueError, match="damping"):
        x.swing(1.0, 10.0, 1.0, damping_per_s=-1)
    with pytest.raises(ValueError, match="at most"):
        x.swing(1.0, 10.0, 1000.0)
    with pytest.raises(ValueError, match="between 0 and 1"):
        x.jacobi(1.0, 1.5)


# ── the pendulum wave ────────────────────────────────────────────────────────


def test_each_pendulum_of_the_wave_swings_its_own_whole_number_in_a_cycle():
    wave = x.PendulumWave()
    for swings, length in zip((51 + n for n in range(15)), x.lengths_m(wave), strict=True):
        assert swings * x.period_s(length, wave.tuned_deg) == pytest.approx(wave.cycle_s, rel=1e-13)
    figures = x.wave_figures(wave)
    assert round(figures.longest_m * 100) == 34
    assert round(figures.shortest_m * 100) == 21


def test_let_go_at_the_tuned_swing_the_row_is_together_again_after_a_cycle():
    wave = x.PendulumWave()
    for length in x.lengths_m(wave):
        assert x.angle_deg(length, 15.0, wave.cycle_s) == pytest.approx(15.0, abs=1e-6)
    assert x.wave_figures(wave).spread_deg < 1e-9


def test_half_a_cycle_in_the_row_stands_in_two_groups_a_third_in_three():
    wave = x.PendulumWave()
    for swings, length in zip((51 + n for n in range(15)), x.lengths_m(wave), strict=True):
        expected = 15.0 if swings % 2 == 0 else -15.0
        assert x.angle_deg(length, 15.0, wave.cycle_s / 2) == pytest.approx(expected, abs=1e-6)
    thirds = {round(x.angle_deg(length, 15.0, wave.cycle_s / 3), 6) for length in x.lengths_m(wave)}
    # Phases 0, 1/3 and 2/3 of a swing: the two thirds stand at the same angle,
    # going opposite ways — three groups, two angles.
    assert len(thirds) == 2
    assert [g.groups for g in x.wave_figures(wave).groups] == [2, 3, 4, 5]


def test_a_row_let_go_wider_or_narrower_than_its_tuning_comes_back_skewed():
    wave = x.PendulumWave()
    curve = {p.amplitude_deg: p.spread_deg for p in x.wave_figures(wave).spread_curve}
    assert curve[14.0] < curve[10.0] < curve[0.0]
    assert curve[16.0] < curve[20.0] < curve[30.0]
    assert round(curve[0.0]) == 22
    assert round(curve[30.0]) == 65
    # Tuned by the small swing's formula, as a textbook does, a row let go at
    # 15° comes back 22° apart.
    assert round(x.wave_figures(wave).textbook_spread_deg) == 22
    lags = x.lag_deg(wave, 30.0)
    assert all(b > a for a, b in itertools.pairwise(lags))  # the short ones fall behind the most


def test_the_pendulum_wave_refuses_what_is_not_a_row():
    with pytest.raises(ValueError, match="between 3 and 30"):
        x.PendulumWave(count=2)
    with pytest.raises(ValueError, match="outside"):
        x.PendulumWave(cycle_s=600.0, longest_swings=1)
    with pytest.raises(ValueError, match="between 0° and 90°"):
        x.PendulumWave(amplitude_deg=95)
    with pytest.raises(ValueError, match="at least once"):
        x.PendulumWave(longest_swings=0)
    with pytest.raises(ValueError, match="whole number"):
        x.groups_at(x.PendulumWave(), 0)


# ── the harmonograph ─────────────────────────────────────────────────────────


def _ending_on(duration: float) -> float:
    """A step that puts the last sample on the drawing's end: 25 steps a sample."""
    return duration / (25 * round(50 * duration))


def _closed(amplitudes=(12.0, 12.0)):
    """Two undamped pendulums tuned exactly 2:3 by the small swing's formula."""
    pen = x.HarmonographPendulum(length_m=0.8, amplitude_deg=amplitudes[0], damping_per_s=0.0)
    board = x.HarmonographPendulum(
        length_m=0.8 * (2 / 3) ** 2, amplitude_deg=amplitudes[1], phase_deg=90.0, damping_per_s=0.0
    )
    return x.Harmonograph(pen=pen, board=board)


def test_at_a_simple_ratio_the_undamped_figure_closes_on_itself():
    h = _closed()
    # Two of the pen's swings are three of the board's; both let go at 12°, so
    # both are slowed by the same 1 + θ₀²/16 and the ratio holds exactly.
    two = 2 * x.period_s(0.8, 12.0)
    run = x.harmonograph_draw(h, two, step_s=_ending_on(two))
    assert run.x_m[-1] == pytest.approx(run.x_m[0], abs=1e-9)
    assert run.y_m[-1] == pytest.approx(run.y_m[0], abs=1e-9)
    assert x.harmonograph_figures(h).turn_s is None


def test_let_go_at_different_widths_an_exact_ratio_drifts_open():
    # The wider swing is the slower one: the pen at 30° falls behind the board at 5°.
    h = _closed((30.0, 5.0))
    two = 2 * x.small_period_s(0.8)
    run = x.harmonograph_draw(h, two, step_s=_ending_on(two))
    assert abs(run.x_m[-1] - run.x_m[0]) > 1e-3


def test_a_damped_swing_draws_inward_and_fades_to_a_tenth_when_the_figures_say():
    h = x.Harmonograph()
    figures = x.harmonograph_figures(h)
    assert figures.pen_fades_s == pytest.approx(230.26, abs=0.01)
    run = x.harmonograph_draw(h, 60.0)
    first = max(abs(v) for v in run.x_m[:100])
    last = max(abs(v) for v in run.x_m[-100:])
    # A small swing dies away as e^(−c·t/2): 0.55 after 60 s at c = 0.02.
    assert last / first == pytest.approx(math.exp(-0.01 * 58), rel=0.02)


def test_the_default_drawing_is_near_two_to_three_and_turns_once_in_a_minute_and_a_half():
    figures = x.harmonograph_figures(x.Harmonograph())
    assert figures.ratio == (2, 3)
    assert figures.detune == pytest.approx(0.0067, abs=1e-4)
    assert round(figures.turn_s) == 90
    assert round(figures.pen_hz, 2) == 0.56


def test_the_nearest_simple_ratio_is_the_one_in_lowest_terms():
    assert x.nearest_ratio(1.0, 2.01) == (1, 2)
    assert x.nearest_ratio(1.0, 1.0) == (1, 1)
    assert x.nearest_ratio(3.0, 4.02) == (3, 4)
    assert x.nearest_ratio(1.0, 1.24) == (4, 5)


def test_the_harmonograph_refuses_what_it_cannot_be():
    with pytest.raises(ValueError, match="between 5 cm and 5 m"):
        x.HarmonographPendulum(length_m=0.01)
    with pytest.raises(ValueError, match="at most 45°"):
        x.HarmonographPendulum(amplitude_deg=60)
    with pytest.raises(ValueError, match="damping"):
        x.HarmonographPendulum(damping_per_s=-0.1)
    with pytest.raises(ValueError, match="at most"):
        x.harmonograph_draw(x.Harmonograph(), 1000.0)


# ── the double cone ──────────────────────────────────────────────────────────


def _lowest_axis(ex, xc: float) -> float:
    """The axis's height found the long way: as low as it can sit with no point
    of either rail inside the solid cone, by scanning the rail. Nothing of the
    engine's contact formula is in here."""
    ta = math.tan(math.radians(ex.cone.cone_deg))
    tb = math.tan(math.radians(ex.rails.spread_deg))
    tg = math.tan(math.radians(ex.rails.slope_deg))
    best = -math.inf
    for i in range(40001):
        xr = xc - 0.05 + 0.1 * i / 40000
        r = ex.cone.radius_m - (ex.rails.start_half_gap_m + xr * tb) * ta
        if r > abs(xr - xc):
            best = max(best, xr * tg + math.sqrt(r * r - (xr - xc) ** 2))
    return best


def test_the_cone_sits_where_the_rails_just_graze_it():
    for ex in (x.ConeExhibit(), x.ConeExhibit(x.DoubleCone(0.08, 30.0), x.Rails(25.0, 9.0, 0.02, 0.15))):
        for xc in (0.05, 0.1, 0.14):
            assert x.axis_height_m(ex, xc) == pytest.approx(_lowest_axis(ex, xc), abs=1e-8)


def test_the_axis_falls_as_the_rails_rise_and_the_textbook_says_where_that_stops():
    ex = x.ConeExhibit()
    assert x.axis_slope(ex) < 0 < x.rail_height_m(ex, 0.3)
    assert round(x.rail_height_m(ex, 0.3) * 100, 1) == 2.1
    assert round((x.axis_height_m(ex, 0) - x.axis_height_m(ex, 0.3)) * 100, 1) == 1.9
    assert round(x.contact_factor(ex), 3) == 1.002
    # At the textbook's boundary the exact contact is right under the axis.
    gamma = x.threshold_deg(ex)
    assert round(gamma, 1) == 7.5
    at = x.ConeExhibit(rails=x.Rails(slope_deg=gamma))
    assert x.axis_slope(at) == pytest.approx(0, abs=1e-15)
    assert x.contact_factor(at) == pytest.approx(1, abs=1e-15)
    assert x.axis_slope(x.ConeExhibit(rails=x.Rails(slope_deg=gamma + 0.1))) > 0


def test_the_cone_rolls_up_to_the_top_without_slipping_and_without_losing_energy():
    ex = x.ConeExhibit()
    run = x.roll(ex, 0.0, 10.0)
    assert run.final_x_m == 0.3
    assert round(run.stopped_at_s, 1) == 1.5
    spin = 0.3 * ex.cone.radius_m**2
    for xs, v in zip(run.x_m[:-1], run.speed_m_s[:-1], strict=True):
        rho = x.contact_radius_m(ex, xs)
        energy = 0.5 * (1 + spin / rho**2) * v * v + 9.80665 * (x.axis_height_m(ex, xs) - x.axis_height_m(ex, 0))
        assert energy == pytest.approx(0, abs=1e-10)
    # Near the top it spins fast on the thin part and moves slowly.
    assert round(run.speed_m_s[-2], 2) == 0.17
    assert round(run.spin_rev_s[-2], 1) == 2.8


def test_on_steeper_rails_the_cone_is_laid_at_the_top_and_rolls_down():
    steep = x.ConeExhibit(rails=x.Rails(slope_deg=10.0))
    assert x.start_for(steep) == 0.3
    run = x.roll(steep, x.start_for(steep), 10.0)
    assert run.final_x_m == 0.0
    assert x.start_for(x.ConeExhibit()) == 0.0
    # Laid at the low end of steep rails, it stays.
    assert x.roll(steep, 0.0, 1.0).final_x_m == 0.0


def test_the_double_cone_refuses_what_would_not_roll():
    with pytest.raises(ValueError, match="fall through"):
        x.ConeExhibit(rails=x.Rails(length_m=0.5))
    with pytest.raises(ValueError, match="between 5° and 45°"):
        x.DoubleCone(cone_deg=60)
    with pytest.raises(ValueError, match="rise at"):
        x.Rails(slope_deg=30)
    with pytest.raises(ValueError, match="laid on the rails"):
        x.roll(x.ConeExhibit(), 0.5, 1.0)


# ── the water parabola ───────────────────────────────────────────────────────


def _volume(v, rate: float) -> float:
    """The water under the surface, by the midpoint rule over thin rings: nothing
    of the engine's volume argument in here."""
    s = x.surface(v, rate)
    n = 20000
    dr = v.radius_m / n
    return sum(2 * math.pi * (i + 0.5) * dr * x.height_at(s, (i + 0.5) * dr) * dr for i in range(n))


def test_the_water_keeps_its_volume_however_fast_it_turns():
    v = x.Vessel(height_m=1.0)
    for rate in (0.0, 5.0, 13.0, 20.0, 40.0):
        assert _volume(v, rate) == pytest.approx(math.pi * v.radius_m**2 * v.fill_m, rel=1e-7)


def test_the_middle_sinks_as_far_as_the_rim_rises_until_it_runs_dry():
    v = x.Vessel()
    s = x.surface(v, 10.0)
    assert v.fill_m - s.centre_m == pytest.approx(s.rim_m - v.fill_m, rel=1e-14)
    dry = x.dry_rate(v)
    assert dry == pytest.approx(2 * math.sqrt(9.80665 * 0.1) / 0.15)
    assert round(dry * 60 / (2 * math.pi)) == 126
    assert x.surface(v, dry).centre_m == pytest.approx(0, abs=1e-15)
    assert x.surface(v, dry * 0.999).dry_radius_m == 0
    assert x.surface(v, dry * 1.001).dry_radius_m > 0
    # The rim goes on smoothly past the moment the middle touches the bottom.
    assert x.surface(v, dry * (1 + 1e-9)).rim_m == pytest.approx(2 * v.fill_m, rel=1e-6)


def test_the_bowl_is_a_mirror_whose_focus_the_rate_sets():
    v = x.Vessel()
    s = x.surface(v, 10.0)
    # z = z₀ + r²/(4f): the paraboloid of a mirror with its focus at f.
    for r in (0.03, 0.09, 0.15):
        assert x.height_at(s, r) == pytest.approx(s.centre_m + r * r / (4 * s.focus_m), rel=1e-14)
    # One turn in 8.5 s puts the focus 9 m up.
    assert round(x.surface(v, 2 * math.pi / 8.5).focus_m) == 9


def test_the_water_spills_once_its_rim_reaches_the_top():
    v = x.Vessel()
    spill = x.spill_rate(v)
    assert x.surface(v, spill).rim_m == pytest.approx(v.height_m, rel=1e-12)
    assert not x.surface(v, spill * 0.99).spills
    assert x.surface(v, spill * 1.01).spills
    # A full vessel spills before its middle runs dry.
    full = x.Vessel(fill_m=0.25)
    assert x.spill_rate(full) < x.dry_rate(full)


def test_the_water_follows_the_vessel_over_ekman_s_spin_up_time():
    v = x.Vessel()
    tau = x.spin_up_time_s(v, 10.0)
    assert tau == pytest.approx(0.1 / math.sqrt(1e-6 * 10.0))
    run = x.water_spin(v, 10.0, 2 * tau, step_s=tau / 1000)
    at = min(range(len(run.t)), key=lambda i: abs(run.t[i] - tau))
    assert run.water_rate[at] / 10.0 == pytest.approx(1 - math.exp(-run.t[at] / tau), rel=1e-6)
    assert round(x.spin_up_time_s(v, x.dry_rate(v))) == 28
    assert x.spin_up_time_s(v, 0.0) is None


def test_the_water_parabola_refuses_what_is_not_a_vessel_of_water():
    with pytest.raises(ValueError, match="below the vessel's top"):
        x.Vessel(fill_m=0.4)
    with pytest.raises(ValueError, match="radius"):
        x.Vessel(radius_m=0.0)
    with pytest.raises(ValueError, match="positive number"):
        x.surface(x.Vessel(), -1.0)


# ── the coupled pendulums ────────────────────────────────────────────────────


def test_equal_pendulums_swing_together_at_their_own_rate_and_against_each_other_faster():
    cp = x.CoupledPendulums()
    slow, fast = x.mode_rates(cp)
    kappa = x.couplings(cp)[0]
    assert slow == pytest.approx(math.sqrt(9.80665 / 0.5), rel=1e-14)
    assert fast == pytest.approx(math.sqrt(9.80665 / 0.5 + 2 * kappa), rel=1e-14)
    assert round(x.beat_s(cp)) == 23
    # Let go together, the spring never stretches and nothing is exchanged.
    run = x.coupled_swing(cp, x.Start.TOGETHER, 10.0, 20.0)
    assert max(run.spring_j) == 0
    assert run.left_j == run.right_j


def test_a_push_to_one_has_wandered_to_the_other_after_half_a_beat():
    cp = x.CoupledPendulums()
    half = x.beat_s(cp) / 2
    run = x.coupled_swing(cp, x.Start.ONE, 3.0, half)
    total = run.left_j[0]
    assert run.left_j[-1] / total < 0.001
    assert max(run.right_j[-60:]) / total > 0.99
    assert x.exchange_share(cp) == 1.0


def test_unequal_pendulums_hand_over_only_the_share_rabi_s_formula_gives():
    cp = x.CoupledPendulums(right=x.Bob(length_m=0.55))
    share = x.exchange_share(cp)
    assert round(share, 2) == 0.56
    run = x.coupled_swing(cp, x.Start.ONE, 2.0, 120.0)
    assert max(run.right_j) / run.left_j[0] == pytest.approx(share, abs=0.015)


def test_the_coupled_pair_keeps_its_energy_without_damping():
    cp = x.CoupledPendulums(spring_n_m=3.0)
    run = x.coupled_swing(cp, x.Start.ONE, 40.0, 20.0)
    totals = [a + b + s for a, b, s in zip(run.left_j, run.right_j, run.spring_j, strict=True)]
    assert max(totals) - min(totals) < 1e-9 * totals[0]


def test_the_coupled_pendulums_refuse_what_cannot_hang():
    with pytest.raises(ValueError, match="between the pivot and the bob"):
        x.CoupledPendulums(spring_at_m=0.6)
    with pytest.raises(ValueError, match="between 5 cm and 5 m"):
        x.Bob(length_m=10.0)
    with pytest.raises(ValueError, match="at most 60°"):
        x.coupled_swing(x.CoupledPendulums(), x.Start.ONE, 80.0, 1.0)


# ── Galileo's interrupted pendulum ───────────────────────────────────────────


def test_caught_by_the_peg_the_bob_rises_to_the_height_it_fell_from():
    p = x.PegPendulum()
    run = x.run_peg(p, 5.0)
    assert run.peg_side_top_m == pytest.approx(x.start_height_m(p), abs=1e-6)
    assert [e[1] for e in run.events[:2]] == ["caught", "released"]
    # Caught and released with the string straight down, at the bottom.
    assert all(abs(e[2]) < 1e-9 and e[3] == pytest.approx(-1.0, abs=1e-9) for e in run.events)
    assert x.outcome(p) == "same_height"


def test_the_bob_keeps_its_energy_until_the_string_jerks():
    p = x.PegPendulum(start_deg=90.0, peg_depth_m=0.58)
    run = x.run_peg(p, 4.0)
    h = x.start_height_m(p)
    taut = next(e[0] for e in run.events if e[1] == "taut")
    for t, xs, ys, mode in zip(run.t, run.x_m, run.y_m, run.mode, strict=True):
        if t >= taut:
            break
        # The speed from the energy: what the bob has if nothing was lost.
        assert ys + p.length_m <= h + 1e-9, (t, mode, xs)
    assert run.went_slack


def test_it_goes_over_the_peg_from_two_and_a_half_radii_and_slack_below():
    # Let go from the horizontal: h = L, so over the top when r ≤ 0.4·L.
    over = x.PegPendulum(start_deg=90.0, peg_depth_m=0.61)
    slack = x.PegPendulum(start_deg=90.0, peg_depth_m=0.59)
    assert x.outcome(over) == "over_the_top"
    assert x.outcome(slack) == "slack"
    assert x.run_peg(over, 3.0).over_the_top
    assert not x.run_peg(slack, 3.0).over_the_top


def test_the_string_goes_slack_at_a_third_of_r_plus_twice_the_height():
    p = x.PegPendulum(start_deg=90.0, peg_depth_m=0.58)
    run = x.run_peg(p, 4.0)
    slack = next(e for e in run.events if e[1] == "slack")
    assert slack[3] + p.length_m == pytest.approx(x.slack_height_m(p), abs=1e-9)
    assert round(x.slack_height_m(p), 3) == 0.807


def test_the_jerk_taut_costs_the_bob_its_speed_along_the_string():
    p = x.PegPendulum(start_deg=90.0, peg_depth_m=0.58)
    s = x.PegState(x.Mode.BIG, (math.radians(90.0), 0.0))
    t, before, after = 0.0, None, None
    while after is None:
        state, happened = x.peg_step(p, s, t, 1e-3)
        for _at, kind, *_ in happened:
            if kind == "taut":
                before = 0.5 * (s.y[2] ** 2 + s.y[3] ** 2) + 9.80665 * (s.y[1] + 1.0)
                after = 0.5 * (p.small_radius_m * state.y[1]) ** 2 + 9.80665 * (x.position(p, state)[1] + 1.0)
        s, t = state, t + 1e-3
    assert after < before - 0.1


def test_the_peg_pendulum_refuses_what_cannot_hang():
    with pytest.raises(ValueError, match="below the pivot and above the bob"):
        x.PegPendulum(peg_depth_m=1.2)
    with pytest.raises(ValueError, match="at most 90°"):
        x.PegPendulum(start_deg=120)
    with pytest.raises(ValueError, match="at most"):
        x.run_peg(x.PegPendulum(), 1000.0)


# ── Maxwell's wheel ──────────────────────────────────────────────────────────


def test_the_wheel_falls_slowly_because_nearly_all_its_energy_goes_into_its_spin():
    w = x.MaxwellWheel(loss=0.0)
    k = x.inertia_ratio(w)
    assert k == pytest.approx(0.5 * (0.065 / 0.005) ** 2)
    assert x.fall_acceleration(w) == pytest.approx(9.80665 / (1 + k))
    assert round(x.rotation_share(w) * 100, 1) == 98.8
    # Energy, from rest at the top: M·g·h = ½·(M + I/r²)·v².
    b = x.wheel_bounce(w, 0.6)
    assert 0.5 * (1 + k) * b.bottom_speed_m_s**2 == pytest.approx(9.80665 * 0.6, rel=1e-14)
    assert round(x.wheel_bounce(x.MaxwellWheel(), 0.6).fall_s, 1) == 3.3


def test_without_losses_it_climbs_back_to_where_it_started():
    w = x.MaxwellWheel(loss=0.0)
    assert x.wheel_bounce(w, 0.6).to_m == pytest.approx(0.6, rel=1e-14)


def test_the_strings_rubbing_costs_each_climb_the_same_share():
    w = x.MaxwellWheel()
    k = x.inertia_ratio(w)
    share = (1 + k / 1.03) / (1 + k / 0.97)
    heights = [b.from_m for b in x.bounces(w, 4)]
    for a, b in itertools.pairwise(heights):
        assert b / a == pytest.approx(share, rel=1e-12)
    assert round(share * 100) == 94


def test_the_jerk_at_the_bottom_is_a_spring_s_and_pulls_six_times_the_weight():
    w = x.MaxwellWheel()
    b = x.wheel_bounce(w, 0.6)
    s, m, v = w.stiffness_n_m, w.mass_kg, b.bottom_speed_m_s

    def spring(_t, y):
        return [y[1], -9.80665 - (s / m) * y[0] if y[0] < 0 else -9.80665]

    trace = rk4(spring, [0.0, -v], 1e-6, b.jerk_s)
    assert trace.states[0][-1] == pytest.approx(0, abs=1e-9)
    assert trace.states[1][-1] == pytest.approx(v, rel=1e-6)
    assert max(-s * z for z in trace.states[0]) == pytest.approx(b.peak_tension_n, rel=1e-9)
    assert round(b.peak_tension_n / (m * 9.80665), 1) == 6.4
    assert round(b.jerk_s * 1000) == 25


def test_the_wheel_is_where_its_closed_form_puts_it():
    w = x.MaxwellWheel()
    b = x.wheel_bounce(w, 0.6)
    assert x.state_at(w, 0).height_m == 0.6
    assert x.state_at(w, b.fall_s + b.jerk_s / 2).height_m == pytest.approx(-b.stretch_m, rel=1e-9)
    top = x.state_at(w, b.fall_s + b.jerk_s + b.climb_s - 1e-9)
    assert top.height_m == pytest.approx(b.to_m, rel=1e-6)


def test_maxwell_s_wheel_refuses_what_cannot_hang():
    with pytest.raises(ValueError, match="thinner than the wheel"):
        x.MaxwellWheel(axle_radius_m=0.1)
    with pytest.raises(ValueError, match="rubbing"):
        x.MaxwellWheel(loss=0.6)
    with pytest.raises(ValueError, match="let go at t = 0"):
        x.state_at(x.MaxwellWheel(), -1.0)


# ── the chaotic pendulum ─────────────────────────────────────────────────────


def test_a_gentle_double_pendulum_swings_in_its_two_modes():
    dp = x.DoublePendulum()
    slow, fast = x.double_mode_rates(dp)
    assert slow == pytest.approx(math.sqrt(9.80665 / 0.3 * (2 - math.sqrt(2))), rel=1e-14)
    assert fast == pytest.approx(math.sqrt(9.80665 / 0.3 * (2 + math.sqrt(2))), rel=1e-14)
    # Let go in the slow mode — the lower arm √2 times as far out — it is back
    # after one of its periods.
    period = 2 * math.pi / slow
    run = x.run_chaos(dp, 1.0, math.sqrt(2), period, step_s=period / round(period * 1000))
    assert run.theta1_deg[-1] == pytest.approx(1.0, abs=0.005)
    assert run.theta2_deg[-1] == pytest.approx(math.sqrt(2), abs=0.005)


def test_the_double_pendulum_keeps_its_energy_however_wildly_it_swings():
    run = x.run_chaos(x.DoublePendulum(), 120.0, 120.0, 20.0)
    assert run.energy_drift < 1e-7


def test_two_wild_pendulums_a_thousandth_of_a_degree_apart_part_company():
    wild = x.run_chaos(x.DoublePendulum(), 120.0, 120.0, 20.0)
    gentle = x.run_chaos(x.DoublePendulum(), 5.0, 7.0, 20.0)
    assert max(wild.separation) > 1
    assert max(gentle.separation) < 1e-4


def test_the_lyapunov_exponent_is_measured_whatever_the_twin_s_distance():
    dp = x.DoublePendulum()
    near = x.lyapunov(dp, 120.0, 120.0, 60.0, gap=1e-10)
    far = x.lyapunov(dp, 120.0, 120.0, 60.0, gap=1e-6)
    assert near == pytest.approx(far, abs=0.005)
    assert round(far, 1) == 2.8
    assert x.lyapunov(dp, 5.0, 7.0, 60.0) < 0.01


def test_the_double_pendulum_refuses_what_it_cannot_be():
    with pytest.raises(ValueError, match="5 cm and 3 m"):
        x.DoublePendulum(length1_m=5.0)
    with pytest.raises(ValueError, match="nudge"):
        x.run_chaos(x.DoublePendulum(), 10.0, 10.0, 1.0, nudge_deg=0.0)
    with pytest.raises(ValueError, match="−180° and 180°"):
        x.run_chaos(x.DoublePendulum(), 200.0, 10.0, 1.0)


# ── the chaotic waterwheel ───────────────────────────────────────────────────


def test_malkus_s_waterwheel_is_lorenz_s_equations():
    """The wheel's own equations — mass, rate, a leak and a tap — integrated in
    seconds, against the engine's Lorenz variables turned back into the wheel."""
    w = x.WaterWheel()
    g, r, nu, k = 9.80665, 0.5, 1.0, w.leak_per_s
    inertia = nu / (k * w.sigma)
    q = w.rho * nu * k * k / (math.pi * g * r)
    c = math.pi * g * r / (nu * k)

    def malkus(_t, s):
        a, b, om = s
        return [om * b - k * a, -om * a + q - k * b, (-nu * om + math.pi * g * r * a) / inertia]

    trace = rk4(malkus, [0.0, q / k, k * 1e-3], 0.01 / k, 5.0, sample_every=10)
    run = x.run_waterwheel(w, 5.0)
    for i, t in enumerate(trace.t):
        j = round(t * k * 20)
        assert run.x[j] == pytest.approx(trace.states[2][i] / k, abs=1e-9)
        assert run.y[j] == pytest.approx(c * trace.states[0][i], abs=1e-9)
        assert run.z[j] == pytest.approx(w.rho - c * trace.states[1][i], abs=1e-8)


def test_the_tap_decides_whether_the_wheel_stands_turns_or_wanders():
    still = x.WaterWheel(rho=0.5)
    steady = x.WaterWheel(rho=10.0)
    wild = x.WaterWheel()
    assert x.hopf_rho(wild) == pytest.approx(17.5)
    assert [x.regime(w) for w in (still, steady, wild)] == ["still", "steady", "chaotic"]
    assert abs(x.run_waterwheel(still, 200.0).x[-1]) < 1e-6
    assert abs(x.run_waterwheel(steady, 200.0).x[-1]) == pytest.approx(x.steady_x(steady), abs=1e-3)
    reversals = x.run_waterwheel(wild, 200.0).reversals_s
    assert len(reversals) > 10
    # Not to a beat: the gaps between reversals range widely.
    gaps = [b - a for a, b in itertools.pairwise(reversals)]
    assert max(gaps) > 3 * min(gaps)


def test_the_cups_are_full_at_the_top_while_the_wheel_stands():
    w = x.WaterWheel()
    assert x.cup_level(w, 0.0, 0.0, 0.0) == pytest.approx(0.95)
    assert x.cup_level(w, 0.0, 0.0, math.pi) == pytest.approx(0.05)


def test_the_waterwheel_refuses_what_it_cannot_be():
    with pytest.raises(ValueError, match="σ"):
        x.WaterWheel(sigma=1.0)
    with pytest.raises(ValueError, match="at most"):
        x.run_waterwheel(x.WaterWheel(), 1000.0)


# ── Foucault's pendulum ──────────────────────────────────────────────────────


def test_the_closed_foucault_swing_is_the_stepped_one():
    p = x.FoucaultPendulum()
    wz = x.vertical_rate(p)
    w2 = 9.80665 / p.length_m

    def coriolis(_t, s):
        return [s[2], s[3], -w2 * s[0] + 2 * wz * s[3], -w2 * s[1] - 2 * wz * s[2]]

    trace = rk4(coriolis, [p.amplitude_m, 0.0, 0.0, 0.0], 1e-3, 600.0, sample_every=7000)
    for t, xs, ys in zip(trace.t, trace.states[0], trace.states[1], strict=True):
        cx, cy = x.foucault_position(p, t)
        assert cx == pytest.approx(xs, abs=1e-9)
        assert cy == pytest.approx(ys, abs=1e-9)


def test_in_winterthur_the_plane_turns_eleven_degrees_an_hour():
    p = x.FoucaultPendulum()
    assert round(x.degrees_per_hour(p), 1) == 11.1
    assert round(x.full_turn_h(p), 1) == 32.5
    # Clockwise seen from above in the north: the plane's angle falls.
    assert x.plane_deg(p, 3600) == pytest.approx(-x.degrees_per_hour(p))
    # A swing's turning points lie along the turning plane.
    half = x.foucault_period_s(p) * round(1800 / x.foucault_period_s(p))
    px, py = x.foucault_position(p, half)
    assert math.degrees(math.atan2(py, px)) == pytest.approx(x.plane_deg(p, half), abs=0.01)


def test_at_the_pole_once_a_sidereal_day_at_the_equator_never_in_the_south_the_other_way():
    pole = x.FoucaultPendulum(latitude_deg=90.0)
    assert round(x.full_turn_h(pole), 2) == 23.93
    assert x.full_turn_h(x.FoucaultPendulum(latitude_deg=0.0)) is None
    assert x.degrees_per_hour(x.FoucaultPendulum(latitude_deg=-33.9)) < 0
    curve = x.latitude_curve(x.FoucaultPendulum())
    assert len(curve) == 37
    assert curve[0].degrees_per_hour == pytest.approx(-curve[-1].degrees_per_hour)


def test_foucault_s_pendulum_refuses_what_it_cannot_be():
    with pytest.raises(ValueError, match="latitude"):
        x.FoucaultPendulum(latitude_deg=100.0)
    with pytest.raises(ValueError, match="tenth"):
        x.FoucaultPendulum(amplitude_m=5.0)


# ── the Coriolis carousel ────────────────────────────────────────────────────


def test_a_rider_sees_the_puck_pushed_by_the_coriolis_and_the_centrifugal_force():
    c = x.Carousel()
    throw = x.Throw()
    w = c.rate
    ux, uy = -throw.speed_m_s, 0.0

    def turning_frame(_t, s):
        # a′ = −2Ω × v′ − Ω × (Ω × r′), Ω along z: (2Ω·vy + Ω²x, −2Ω·vx + Ω²y).
        return [s[2], s[3], 2 * w * s[3] + w * w * s[0], -2 * w * s[2] + w * w * s[1]]

    trace = rk4(turning_frame, [c.radius_m, 0.0, ux, uy], 1e-4, 1.0, sample_every=1000)
    for t, xs, ys in zip(trace.t, trace.states[0], trace.states[1], strict=True):
        px, py = x.turning(c, throw, t)
        assert px == pytest.approx(xs, abs=1e-9)
        assert py == pytest.approx(ys, abs=1e-9)


def test_seen_from_outside_the_puck_goes_straight_and_the_rolled_ball_in_a_circle():
    c = x.Carousel()
    puck = [x.outside(c, x.Throw(), t) for t in (0.0, 0.4, 0.8)]
    (ax, ay), (bx, by), (cx, cy) = puck
    assert (bx - ax) * (cy - ay) - (by - ay) * (cx - ax) == pytest.approx(0, abs=1e-12)
    ball = x.Throw(body=x.ThrownBody.BALL)
    h = 1e-5

    def velocity(t):
        (x1, y1), (x2, y2) = x.outside(c, ball, t - h), x.outside(c, ball, t + h)
        return (x2 - x1) / (2 * h), (y2 - y1) / (2 * h)

    v0, v1 = velocity(0.1), velocity(1.1)
    turned = math.atan2(v1[1], v1[0]) - math.atan2(v0[1], v0[0])
    assert turned == pytest.approx(2 / 7 * c.rate, rel=1e-6)
    assert math.hypot(*v1) == pytest.approx(math.hypot(*v0), rel=1e-8)


def test_to_hit_the_other_seat_a_rider_aims_well_ahead_of_it():
    c = x.Carousel()
    straight = x.miss_deg(c, x.Throw())
    # Clockwise, to the right as the riders see it: the platform turns anticlockwise.
    assert round(straight) == -86
    puck = x.lead_deg(c, 3.0, x.ThrownBody.PUCK)
    ball = x.lead_deg(c, 3.0, x.ThrownBody.BALL)
    assert round(puck) == 50
    assert round(ball) == 43
    assert x.miss_deg(c, x.Throw(3.0, puck)) == pytest.approx(0, abs=1e-6)
    assert x.lead_deg(x.Carousel(rpm=0), 3.0, x.ThrownBody.PUCK) == pytest.approx(0, abs=1e-9)
    # Too fast a platform for too slow a throw: no aim reaches the other seat.
    assert x.lead_deg(x.Carousel(rpm=20), 1.0, x.ThrownBody.PUCK) is None


def test_the_carousel_refuses_what_it_cannot_be():
    with pytest.raises(ValueError, match="60 times a minute"):
        x.Carousel(rpm=100)
    with pytest.raises(ValueError, match="89°"):
        x.Throw(aim_deg=95)


# ── Newton's cradle ──────────────────────────────────────────────────────────


def test_with_a_hair_s_gap_one_ball_in_sends_exactly_one_out():
    cr = x.Cradle(gap_m=1e-4, restitution=1.0)
    im = x.cradle_impact(cr, x.Pull())
    assert im.after_m_s[-1] == pytest.approx(im.before_m_s[0], rel=1e-4)
    assert all(abs(v) < 1e-3 for v in im.after_m_s[:-1])
    two = x.cradle_impact(cr, x.Pull(balls=2))
    assert two.far_share == pytest.approx(1, abs=1e-4)


def test_touching_balls_keep_momentum_and_energy_but_send_out_not_quite_all():
    cr = x.Cradle(restitution=1.0)
    im = x.cradle_impact(cr, x.Pull())
    assert sum(im.after_m_s) == pytest.approx(im.before_m_s[0], rel=1e-4)
    assert sum(v * v for v in im.after_m_s) == pytest.approx(im.before_m_s[0] ** 2, rel=1e-3)
    assert round(im.far_share, 3) == 0.978
    assert min(im.after_m_s[:-1]) < -0.01


def test_a_lone_pair_s_peak_force_is_hertz_s():
    cr = x.Cradle(count=2, gap_m=1e-4, restitution=1.0)
    im = x.cradle_impact(cr, x.Pull())
    v, m, k = im.before_m_s[0], cr.mass_kg, cr.stiffness
    deepest = (5 * (m / 2) * v * v / (4 * k)) ** 0.4
    assert im.peak_n == pytest.approx(k * deepest**1.5, rel=0.01)


def test_the_exhibit_s_one_ball_sends_97_percent_out_and_a_hair_s_gap_99_9():
    im = x.cradle_impact(x.Cradle(), x.Pull())
    assert round(im.far_share, 2) == 0.97
    assert im.after_m_s[0] < 0
    assert round(x.cradle_impact(x.Cradle(gap_m=1e-4), x.Pull()).far_share, 3) == 0.999


def test_a_steel_contact_lasts_0_2_ms_and_presses_with_nearly_900_n():
    cr = x.Cradle()
    im = x.cradle_impact(cr, x.Pull())
    assert round(cr.mass_kg, 3) == 0.064
    assert round(im.duration_s * 1e3, 1) == 0.2
    assert round(im.peak_n, -2) == 900
    assert im.peak_n < 900


def test_two_in_come_out_as_two_but_not_at_the_same_speed():
    im = x.cradle_impact(x.Cradle(), x.Pull(balls=2))
    assert round(im.before_m_s[0], 2) == 0.63
    assert round(im.after_m_s[-1], 2) == 0.70
    assert round(im.after_m_s[-2], 2) == 0.49
    assert round(im.far_share, 2) == 0.97


def test_with_lossy_contacts_the_middle_ball_comes_to_swing_and_without_it_stays_nearly_still():
    # The fourth second's widest swing of the middle ball: what the page's chart
    # draws, and what its "after three seconds" says.
    def middle(cr: x.Cradle) -> float:
        run = x.run_cradle(cr, x.Pull(), 4.0)
        return max(abs(a) for a in run.angles_deg[2][300:])

    assert round(middle(x.Cradle()), 1) == 2.5
    assert middle(x.Cradle(restitution=1.0)) < 0.2


def test_the_cradle_refuses_what_cannot_hang():
    with pytest.raises(ValueError, match="between 2 and 9"):
        x.Cradle(count=12)
    with pytest.raises(ValueError, match="left hanging"):
        x.cradle_impact(x.Cradle(count=3), x.Pull(balls=3))


# ── the gravity well ─────────────────────────────────────────────────────────


def _well_ride(f: x.Funnel, launch: x.WellLaunch, seconds: float) -> list[tuple[float, float, float]]:
    """(r, φ, t) a millisecond apart, from the engine's own steps."""
    from staunlabor.domain.experiments import well

    ride = well.begin(f, launch)
    out = []
    for _ in range(round(seconds / well.STEP_S)):
        ride, _lap = well.advance(f, ride)
        out.append((ride.y[0], ride.y[2], ride.t))
    return out


def test_without_rolling_resistance_the_ball_keeps_its_energy_and_its_angular_momentum():
    from staunlabor.domain.experiments import well

    f = x.Funnel(rolling_resistance=0.0)
    ride = well.begin(f, x.WellLaunch(0.3, 10.0))
    e0, h0 = x.well_energy(f, ride.y), ride.y[0] ** 2 * ride.y[3]
    for _ in range(30_000):
        ride, _lap = well.advance(f, ride)
    assert ride.outcome == "rolling"
    assert x.well_energy(f, ride.y) == pytest.approx(e0, rel=1e-9)
    assert ride.y[0] ** 2 * ride.y[3] == pytest.approx(h0, rel=1e-9)


def test_a_ball_at_the_circular_speed_stays_on_its_circle_for_kepler_s_period():
    f = x.Funnel(rolling_resistance=0.0)
    r0 = f.start_m
    run = x.run_well(f, x.WellLaunch(x.well_circular_speed(f, r0), 0.0), 30.0)
    assert max(abs(r - r0) for r in run.r_m) < 1e-6
    assert all(lap.period_s == pytest.approx(x.well_circular_period(f, r0), abs=1e-3) for lap in run.laps)


def test_on_the_circles_the_funnel_keeps_kepler_s_third_law():
    f = x.Funnel()
    assert round(x.well_circular_speed(f, f.start_m), 2) == 0.44
    assert round(x.well_circular_period(f, f.start_m), 1) == 5.1
    assert round(x.well_circular_period(f, f.hole_m), 2) == 0.12
    # Twelve times nearer the hole, a lap 12^(3/2) times shorter: 42.
    assert round(f.start_m / f.hole_m) == 12
    assert round(x.well_circular_period(f, f.start_m) / x.well_circular_period(f, f.hole_m)) == 42


def test_off_the_circle_the_path_does_not_close_but_turns_40_degrees_a_round():
    ride = _well_ride(x.Funnel(rolling_resistance=0.0), x.WellLaunch(0.3, 0.0), 30.0)
    nearest = [b for a, b, c in zip(ride, ride[1:], ride[2:], strict=False) if b[0] < a[0] and b[0] < c[0]]
    turns = [math.degrees(q[1] - p[1]) - 360 for p, q in itertools.pairwise(nearest)]
    assert len(turns) >= 5
    assert all(round(turn) == 40 for turn in turns)


def test_rolling_resistance_spirals_the_ball_in_lap_by_lap_on_kepler_s_periods():
    f = x.Funnel()
    run = x.run_well(f, x.WellLaunch(x.well_circular_speed(f, f.start_m), 0.0), 120.0)
    assert run.outcome == "hole"
    assert round(run.end_s) == 46
    assert len(run.laps) == 75
    assert sum(1 for lap in run.laps if lap.end_s > run.end_s - 10) == 42
    assert all(lap.period_s == pytest.approx(x.well_circular_period(f, lap.radius_m), rel=0.03) for lap in run.laps)


def test_the_spiral_takes_as_long_as_the_circles_energy_drained_by_the_resistance():
    # An independent count: on circle r the ball has −g·k/(2r) a kilogram and
    # loses C·N·v a second, N the weight's share across the wall and the push
    # that holds it on the circle. Simpson's rule from the hole to the start.
    from staunlabor.domain.experiments.pendulum import G

    f = x.Funnel()
    k, c = f.k_m2, f.rolling_resistance

    def seconds_per_metre(r: float) -> float:
        slope = k / (r * r)
        normal = G / math.sqrt(1 + slope * slope) * (1 + 5 / 7 * slope * slope)
        return G * k / (2 * r * r) / (c * normal * x.well_circular_speed(f, r))

    n = 2000
    h = (f.start_m - f.hole_m) / n
    weights = [1 if i in (0, n) else 4 if i % 2 else 2 for i in range(n + 1)]
    expected = h / 3 * sum(w * seconds_per_metre(f.hole_m + i * h) for i, w in enumerate(weights))
    run = x.run_well(f, x.WellLaunch(x.well_circular_speed(f, f.start_m), 0.0), 120.0)
    assert run.end_s == pytest.approx(expected, rel=0.01)


def test_the_funnel_refuses_what_it_cannot_be():
    with pytest.raises(ValueError, match="quarter of the rim"):
        x.Funnel(hole_m=0.2)
    with pytest.raises(ValueError, match="at most 90°"):
        x.WellLaunch(0.3, 120.0)
    with pytest.raises(ValueError, match="at most 300 s"):
        x.run_well(x.Funnel(), x.WellLaunch(), 400.0)


def test_the_resistance_brakes_the_ball_and_yet_it_runs_ever_faster():
    from staunlabor.domain.experiments import well

    f = x.Funnel()
    ride = well.begin(f, x.WellLaunch(x.well_circular_speed(f, f.start_m), 0.0))

    def speed(y: tuple[float, float, float, float]) -> float:
        slope = f.k_m2 / (y[0] * y[0])
        return math.sqrt((1 + slope * slope) * y[1] ** 2 + (y[0] * y[3]) ** 2)

    first = speed(ride.y)
    fastest_per_lap = []
    fastest = 0.0
    while ride.outcome == "rolling":
        ride, lap = well.advance(f, ride)
        fastest = max(fastest, speed(ride.y))
        if lap is not None:
            fastest_per_lap.append(fastest)
            fastest = 0.0
    # More than three times as fast in its last lap as at the start.
    assert fastest_per_lap[-1] > 3 * first
    # Lap by lap it wobbles a little (the start is not quite a circle with the
    # resistance on); ten laps apart, it is always faster.
    assert all(b > a for a, b in itertools.pairwise(fastest_per_lap[::10]))


# ── resonance ────────────────────────────────────────────────────────────────


def test_a_clamped_rod_s_first_mode_has_the_textbook_constants():
    # β₁² = 3.516 and, for the shape 1 at the tip, Γ = 1.566: any table of
    # cantilever modes.
    from staunlabor.domain.experiments import resonance

    assert round(resonance.BETA1**2, 3) == 3.516
    assert round(resonance.GAMMA, 3) == 1.566
    assert resonance.shape(0.0) == pytest.approx(0.0, abs=1e-12)
    assert resonance.shape(1.0) == pytest.approx(1.0)


def test_the_six_rods_ring_between_1_4_and_5_7_hz():
    rack = x.ResonanceRack()
    assert [round(x.rod_hz(rack, length), 2) for length in rack.lengths_m] == [1.41, 1.74, 2.21, 2.88, 3.92, 5.65]


def test_in_step_one_rod_swings_78_mm_on_a_table_moving_1_mm_and_its_neighbours_at_most_4():
    rack = x.ResonanceRack()
    beat = x.rod_hz(rack, 0.8)
    swings = [x.rod_steady_m(rack, length, beat) * 1000 for length in rack.lengths_m]
    assert rack.table_m == 0.001
    assert round(swings[2]) == 78
    assert round(max(swings[:2] + swings[3:])) == 4
    # Three per cent off the beat: a third of it.
    assert round(x.rod_steady_m(rack, 0.8, beat * 1.03) * 1000) == 26


def test_stepped_from_rest_the_rods_settle_on_the_closed_form():
    rack = x.ResonanceRack()
    run = x.run_resonance(rack, 2.0, 60.0)
    for rod, length in enumerate(rack.lengths_m):
        late = max(abs(q) for q in run.tips_m[rod][-200:])
        assert late == pytest.approx(x.rod_steady_m(rack, length, 2.0), rel=0.01)


def test_in_step_a_swing_grows_to_two_thirds_in_one_over_zeta_omega():
    from staunlabor.domain.experiments import resonance

    rack = x.ResonanceRack()
    beat = x.rod_hz(rack, 0.8)
    tau = 1 / (rack.damping_ratio * 2 * math.pi * beat)
    assert round(tau, 1) == 7.2
    s = resonance.start(rack)
    for _ in range(round(tau / resonance.STEP_S)):
        s = resonance.step(rack, s, beat)
    grown = resonance.swing_m(rack, s, 2) / x.rod_steady_m(rack, 0.8, beat)
    assert grown == pytest.approx(1 - math.exp(-1), abs=0.02)


def test_swept_at_a_twentieth_of_a_hertz_a_second_the_rod_reaches_half_its_swing_and_late():
    from staunlabor.domain.experiments import resonance

    rack = x.ResonanceRack()
    s = resonance.start(rack)
    widest, at = 0.0, 0.0
    for i in range(round(30 / resonance.STEP_S)):
        drive = 1.5 + 0.05 * i * resonance.STEP_S
        s = resonance.step(rack, s, drive)
        swing = resonance.swing_m(rack, s, 2)
        if swing > widest:
            widest, at = swing, drive
    assert round(widest * 1000) == 40
    assert round(at, 1) == 2.4


def test_the_rack_refuses_what_it_cannot_hold():
    with pytest.raises(ValueError, match="between 10 cm and 2 m"):
        x.ResonanceRack(lengths_m=(3.0,))
    with pytest.raises(ValueError, match="between 0 and 50"):
        x.run_resonance(x.ResonanceRack(), 60.0, 1.0)
