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
