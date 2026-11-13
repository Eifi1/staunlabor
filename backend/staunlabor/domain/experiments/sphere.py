"""The ball in the hanging sphere: why it climbs, and why you have to circle faster.

The exhibit is a clear sphere hung between a rope to the ceiling and a rope to
the floor, with a ball inside. A visitor pushes the sphere left, right, forward
and back, or round in circles, and when they do it right the ball rises up the
inner wall until it runs round the equator in a horizontal circle.

**The model.** The ball rolls without slipping on the inside of the shell; the
shell is moved by the visitor's hand but not turned. Three facts carry the rest,
each held by ``tests/unit/test_experiments.py``:

* **The ball's centre moves like a spherical pendulum of length ρ = R − r under
  a reduced gravity g/(1 + k)** — 5/7 of g for a solid ball, k = I/(m·r²) = 2/5.
  The rest of gravity's pull goes into spinning the ball up. This holds exactly
  while the ball has no spin about the line to the contact point, and that spin
  never changes while it rolls on a shell that does not turn, so a ball that
  starts at rest keeps none. The test integrates the full rigid body — centre,
  angular velocity and the contact force solved from the rolling constraint —
  and finds the same path to 10⁻¹⁰ m.
* **Moving the shell is a second gravity.** In the shell's frame its
  acceleration ``A`` acts on the ball as ``−A`` through the centre, so the
  hand's push enters the same way gravity does, also at 1/(1 + k).
* **A circle at rate Ω rides at a depth of g/((1 + k)·Ω²) below the equator**,
  whatever the size of the sphere: ``ρ·cos θ = g'/Ω²``, the conical pendulum's
  height. Below ``Ω₀ = √(g'/ρ)`` there is no circle at all. Faster circles ride
  higher, and the equator itself would take an infinite rate.

That last point is the visitor's experience: the resonance moves while you pump.
A hand that keeps circling at one rate can only hold the ball at that rate's
height; to take it higher the hand has to speed up *with* it. A push does the
most work a quarter turn ahead of the ball (the sphere's displacement leading
the ball's azimuth by 90°); once the ball is up, a hand that pushes harder than
the losses need lets it ride nearly in step, and the lead shrinks to what the
rolling resistance takes. Sweep too fast and the ball loses step and falls
back — the test shows a slow sweep carrying the ball to its final rate's orbit
and a jump to the same rate leaving it near the bottom. Physicists call this
autoresonance.

The opposite holds for a ball rocked back and forth in one plane: a pendulum
swings *slower* the wider it swings (:func:`swing_hz`). Round and round it is
faster the higher it rides.

**What it leaves out.** The shell's own swing on its ropes: the hand is taken to
move the sphere where it likes, so the ropes are the hand's problem, not the
ball's. Slip: the ball is assumed to roll, and :class:`Orbit` says how much
friction that needs. Air. The rolling resistance is one coefficient, the one
number here nobody can compute, set to a guess and offered as a slider.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from enum import StrEnum

#: Standard gravity.
G = 9.80665

#: I/(m·r²) for the two balls the page offers.
SOLID = 2 / 5
HOLLOW = 2 / 3

#: The speed below which rolling resistance fades in rather than switching
#: sign: a ball at rest has no direction to resist, and a hard switch would
#: chatter. One millimetre a second is far below anything the page draws.
RESISTANCE_FADE_M_S = 1e-3

#: The integration step. 1 ms is 160 steps per revolution at 6 Hz, past which
#: nobody's hand goes; the test holds it against half that step.
STEP_S = 1e-3

#: How many samples a run returns per second, whatever its step.
SAMPLES_PER_S = 50

#: The longest run the engine takes, so a request cannot ask for an hour.
MAX_DURATION_S = 120.0


class BallKind(StrEnum):
    SOLID = "solid"
    HOLLOW = "hollow"


class DrivePath(StrEnum):
    """Round and round, or back and forth along one line."""

    CIRCLE = "circle"
    LINE = "line"


@dataclass(frozen=True)
class Sphere:
    shell_radius_m: float = 0.20
    ball_radius_m: float = 0.02
    ball: BallKind = BallKind.SOLID
    #: Resisting force over normal force, rolling on the inner wall.
    rolling_resistance: float = 0.005

    def __post_init__(self) -> None:
        if not self.shell_radius_m > 0 or not self.ball_radius_m > 0:
            raise ValueError("the sphere and the ball need a positive radius")
        if self.ball_radius_m >= self.shell_radius_m:
            raise ValueError("the ball has to fit inside the sphere")
        if self.rolling_resistance < 0:
            raise ValueError("rolling resistance cannot be negative")

    @property
    def path_radius_m(self) -> float:
        """ρ: how far the ball's centre stays from the sphere's centre."""
        return self.shell_radius_m - self.ball_radius_m

    @property
    def inertia_factor(self) -> float:
        return SOLID if self.ball is BallKind.SOLID else HOLLOW

    @property
    def gravity_share(self) -> float:
        """1/(1 + k): the part of any push that moves the centre rather than
        spinning the ball — 5/7 for a solid ball, 3/5 for a hollow one."""
        return 1 / (1 + self.inertia_factor)


@dataclass(frozen=True)
class Orbit:
    """A steady horizontal circle and what it takes."""

    rate_hz: float
    #: From the bottom: 0° at rest, 90° on the equator.
    angle_deg: float
    depth_below_equator_m: float
    height_above_bottom_m: float
    speed_m_s: float
    #: How often a slightly tilted circle bobs up and down: Ω·√(1 + 3·cos²θ).
    wobble_hz: float
    #: The wall's push on the ball over its weight.
    normal_per_weight: float
    #: The least friction coefficient at which the ball rolls rather than slips.
    friction_needed: float
    #: Kinetic and potential energy per kilogram of ball, from rest at the bottom.
    energy_j_per_kg: float
    #: The smallest circle the hand must push the sphere round, a quarter turn
    #: ahead of the ball, to hold this orbit against rolling resistance.
    drive_radius_needed_m: float


def lowest_orbit_hz(sphere: Sphere) -> float:
    """Ω₀/2π: the slowest circle there is, and the small-swing frequency at the bottom."""
    return math.sqrt(G * sphere.gravity_share / sphere.path_radius_m) / (2 * math.pi)


def _orbit(sphere: Sphere, rate: float, cos_t: float) -> Orbit:
    rho = sphere.path_radius_m
    sin_t = math.sqrt(max(0.0, 1 - cos_t * cos_t))
    speed = rate * rho * sin_t
    normal = rate * rate * rho * sin_t * sin_t + G * cos_t  # per kilogram
    share = sphere.gravity_share
    friction = (1 - share) * G * sin_t  # per kilogram: k/(1+k)·g·sinθ
    return Orbit(
        rate_hz=rate / (2 * math.pi),
        angle_deg=math.degrees(math.acos(cos_t)),
        depth_below_equator_m=rho * cos_t,
        height_above_bottom_m=rho * (1 - cos_t),
        speed_m_s=speed,
        wobble_hz=rate * math.sqrt(1 + 3 * cos_t * cos_t) / (2 * math.pi),
        normal_per_weight=normal / G,
        friction_needed=friction / normal,
        energy_j_per_kg=0.5 * (1 + sphere.inertia_factor) * speed * speed + G * rho * (1 - cos_t),
        drive_radius_needed_m=sphere.rolling_resistance * normal / (rate * rate),
    )


def orbit(sphere: Sphere, rate_hz: float) -> Orbit | None:
    """The circle a hand circling at ``rate_hz`` holds the ball on, or ``None``
    below :func:`lowest_orbit_hz`, where no circle exists."""
    if rate_hz <= 0:
        raise ValueError("the rate has to be positive")
    rate = 2 * math.pi * rate_hz
    cos_t = G * sphere.gravity_share / (sphere.path_radius_m * rate * rate)
    if cos_t > 1:
        return None
    return _orbit(sphere, rate, cos_t)


def orbit_at(sphere: Sphere, angle_deg: float) -> Orbit:
    """The circle at ``angle_deg`` from the bottom, and the rate it needs."""
    if not 0 <= angle_deg < 90:
        raise ValueError("an orbit lies between the bottom and the equator")
    cos_t = math.cos(math.radians(angle_deg))
    rate = math.sqrt(G * sphere.gravity_share / (sphere.path_radius_m * cos_t))
    return _orbit(sphere, rate, cos_t)


def backbone(sphere: Sphere, angles_deg: tuple[float, ...] | None = None) -> tuple[Orbit, ...]:
    """Every orbit from the bottom up to 88°: the curve the page draws the
    hand's rhythm against."""
    angles = angles_deg if angles_deg is not None else tuple(float(a) for a in range(0, 89))
    return tuple(orbit_at(sphere, a) for a in angles)


def _agm(a: float, b: float) -> float:
    while abs(a - b) > 1e-15 * a:
        a, b = (a + b) / 2, math.sqrt(a * b)
    return a


def swing_hz(sphere: Sphere, amplitude_deg: float) -> float:
    """The frequency of a swing back and forth in one plane, ``amplitude_deg``
    each side of the bottom: the pendulum's ``π/(2K(sin(θ₀/2)))·f₀``, with K
    by the arithmetic-geometric mean. It falls as the swing widens."""
    if not 0 <= amplitude_deg < 180:
        raise ValueError("a swing's amplitude lies between 0° and 180°")
    k = math.sin(math.radians(amplitude_deg) / 2)
    # K(k) = π / (2·agm(1, √(1 − k²)))
    return lowest_orbit_hz(sphere) * _agm(1.0, math.sqrt(1 - k * k))


@dataclass(frozen=True)
class SwingPoint:
    amplitude_deg: float
    rate_hz: float


@dataclass(frozen=True)
class SphereFigures:
    """What the page draws for a sphere: the orbits from the bottom up (the
    "backbone" the hand's rhythm is drawn against) and the swing back and forth
    beside them, slowing where the circle speeds up."""

    path_radius_m: float
    gravity_share: float
    lowest_orbit_hz: float
    backbone: tuple[Orbit, ...]
    swing: tuple[SwingPoint, ...]


def figures(sphere: Sphere) -> SphereFigures:
    return SphereFigures(
        path_radius_m=sphere.path_radius_m,
        gravity_share=sphere.gravity_share,
        lowest_orbit_hz=lowest_orbit_hz(sphere),
        backbone=backbone(sphere),
        swing=tuple(SwingPoint(float(a), swing_hz(sphere, a)) for a in range(0, 176, 5)),
    )


@dataclass(frozen=True)
class Drive:
    """The visitor's hand: the sphere pushed round a circle (or along a line)
    whose rate sweeps from ``start_hz`` to ``end_hz`` over ``sweep_s``, then
    holds for ``hold_s``. A ``sweep_s`` of zero is a jump straight to ``end_hz``."""

    radius_m: float = 0.02
    start_hz: float = 0.7
    end_hz: float = 2.5
    sweep_s: float = 30.0
    hold_s: float = 10.0
    path: DrivePath = DrivePath.CIRCLE

    def __post_init__(self) -> None:
        if self.radius_m < 0 or self.start_hz < 0 or self.end_hz < 0:
            raise ValueError("the drive's radius and rates cannot be negative")
        if self.sweep_s < 0 or self.hold_s < 0:
            raise ValueError("the drive's times cannot be negative")
        if self.sweep_s + self.hold_s > MAX_DURATION_S:
            raise ValueError(f"a run lasts at most {MAX_DURATION_S:g} s")

    @property
    def duration_s(self) -> float:
        return self.sweep_s + self.hold_s


def drive_state(drive: Drive, t: float) -> tuple[float, float, float]:
    """The hand's phase, rate (rad/s) and rate of change of rate at ``t``."""
    w0 = 2 * math.pi * (drive.start_hz if drive.sweep_s > 0 else drive.end_hz)
    w1 = 2 * math.pi * drive.end_hz
    if drive.sweep_s > 0 and t < drive.sweep_s:
        alpha = (w1 - w0) / drive.sweep_s
        return w0 * t + 0.5 * alpha * t * t, w0 + alpha * t, alpha
    swept = 0.5 * (w0 + w1) * drive.sweep_s if drive.sweep_s > 0 else 0.0
    return swept + w1 * (t - (drive.sweep_s if drive.sweep_s > 0 else 0.0)), w1, 0.0


def shell_acceleration(drive: Drive, t: float) -> tuple[float, float]:
    """The sphere's horizontal acceleration: the second derivative of
    ``a·(cos φ, sin φ)`` (or ``a·(cos φ, 0)`` on a line) with a sweeping rate."""
    phase, rate, alpha = drive_state(drive, t)
    a = drive.radius_m
    c, s = math.cos(phase), math.sin(phase)
    ax = a * (-rate * rate * c - alpha * s)
    if drive.path is DrivePath.LINE:
        return ax, 0.0
    return ax, a * (-rate * rate * s + alpha * c)


def acceleration(
    sphere: Sphere, p: tuple[float, float, float], v: tuple[float, float, float], shell_ax: float, shell_ay: float
) -> tuple[tuple[float, float, float], float]:
    """The ball centre's acceleration relative to the sphere, and the wall's
    push per kilogram. ``p`` is the centre relative to the sphere's centre and
    ``v`` its velocity; both are kept on the sphere of radius ρ and tangent to
    it by :func:`step`.

    In the sphere's frame the push is ``G − A``. Its part along the wall moves
    the centre at 1/(1 + k); its part across the wall, with the centripetal
    term, is what the wall answers (``N``). Rolling resistance ``C·N`` opposes
    the motion and goes through the same share."""
    rho = sphere.path_radius_m
    nx, ny, nz = p[0] / rho, p[1] / rho, p[2] / rho
    gx, gy, gz = -shell_ax, -shell_ay, -G
    g_n = gx * nx + gy * ny + gz * nz
    v2 = v[0] * v[0] + v[1] * v[1] + v[2] * v[2]
    # Across the wall: −v²/ρ = g_n − N, the wall pushing inward against n.
    normal = v2 / rho + g_n
    # The wall can only push: past zero the ball would leave it, and the caller
    # is told through the returned normal.
    resist = sphere.rolling_resistance * max(normal, 0.0) / math.sqrt(v2 + RESISTANCE_FADE_M_S**2)
    share = sphere.gravity_share
    tx = (gx - g_n * nx - resist * v[0]) * share - v2 / rho * nx
    ty = (gy - g_n * ny - resist * v[1]) * share - v2 / rho * ny
    tz = (gz - g_n * nz - resist * v[2]) * share - v2 / rho * nz
    return (tx, ty, tz), normal


@dataclass(frozen=True)
class SphereRun:
    t: tuple[float, ...]
    angle_deg: tuple[float, ...]
    depth_below_equator_m: tuple[float, ...]
    drive_hz: tuple[float, ...]
    #: How far the sphere's displacement leads the ball round, (−180°, 180°];
    #: +90° is the push that does the most work.
    lead_deg: tuple[float, ...]
    final_angle_deg: float
    highest_angle_deg: float
    #: The most friction the run needed, so the page can say whether it rolled.
    friction_needed: float
    left_the_wall: bool


def start_state(sphere: Sphere, angle_deg: float = 0.0, speed_m_s: float = 0.0) -> tuple[float, ...]:
    """The ball ``angle_deg`` up the wall towards +x, rolling round at
    ``speed_m_s`` (along +y, the horizontal there)."""
    rho = sphere.path_radius_m
    th = math.radians(angle_deg)
    return (rho * math.sin(th), 0.0, -rho * math.cos(th), 0.0, speed_m_s, 0.0)


def step(sphere: Sphere, drive: Drive, t: float, y: tuple[float, ...], h: float) -> tuple[float, ...]:
    """One classical Runge–Kutta step, then the centre put back on its sphere
    and the velocity back on its tangent plane, which RK4 drifts off by its
    truncation error each step."""

    def f(tt: float, yy: tuple[float, ...]) -> tuple[float, ...]:
        ax, ay = shell_acceleration(drive, tt)
        acc, _ = acceleration(sphere, (yy[0], yy[1], yy[2]), (yy[3], yy[4], yy[5]), ax, ay)
        return (yy[3], yy[4], yy[5], acc[0], acc[1], acc[2])

    k1 = f(t, y)
    k2 = f(t + h / 2, tuple(y[i] + h / 2 * k1[i] for i in range(6)))
    k3 = f(t + h / 2, tuple(y[i] + h / 2 * k2[i] for i in range(6)))
    k4 = f(t + h, tuple(y[i] + h * k3[i] for i in range(6)))
    n = tuple(y[i] + h / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]) for i in range(6))
    rho = sphere.path_radius_m
    r = math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2])
    px, py, pz = n[0] * rho / r, n[1] * rho / r, n[2] * rho / r
    radial = (n[3] * px + n[4] * py + n[5] * pz) / (rho * rho)
    return (px, py, pz, n[3] - radial * px, n[4] - radial * py, n[5] - radial * pz)


def _wrap_deg(angle: float) -> float:
    a = math.fmod(angle + 180.0, 360.0)
    return (a + 360.0 if a <= 0 else a) - 180.0


def run(
    sphere: Sphere,
    drive: Drive,
    start_angle_deg: float = 0.0,
    start_speed_m_s: float = 0.0,
    step_s: float = STEP_S,
) -> SphereRun:
    """The ball under the hand's drive, from ``start_angle_deg`` up the wall,
    rolling round at ``start_speed_m_s`` (at rest by default)."""
    if not 0 < step_s <= 0.01:
        raise ValueError("the step lies between 0 and 10 ms")
    if not 0 <= start_angle_deg < 180:
        raise ValueError("the ball starts between the bottom and the top")
    rho = sphere.path_radius_m
    y = start_state(sphere, start_angle_deg, start_speed_m_s)
    steps = round(drive.duration_s / step_s)
    every = max(1, round(1 / (SAMPLES_PER_S * step_s)))
    ts: list[float] = []
    angles: list[float] = []
    depths: list[float] = []
    rates: list[float] = []
    leads: list[float] = []
    friction = 0.0
    left = False
    share = sphere.gravity_share
    for i in range(steps + 1):
        t = i * step_s
        if i % every == 0:
            phase, rate, _ = drive_state(drive, t)
            ball = math.atan2(y[1], y[0])
            ts.append(t)
            angles.append(math.degrees(math.acos(max(-1.0, min(1.0, -y[2] / rho)))))
            depths.append(-y[2])
            rates.append(rate / (2 * math.pi))
            leads.append(_wrap_deg(math.degrees(phase - ball)))
        ax, ay = shell_acceleration(drive, t)
        p, v = (y[0], y[1], y[2]), (y[3], y[4], y[5])
        _, normal = acceleration(sphere, p, v, ax, ay)
        if normal <= 0:
            left = True
        else:
            # The friction the rolling asks for: k/(1+k) of the push along the wall.
            gx, gy, gz = -ax, -ay, -G
            g_n = (gx * p[0] + gy * p[1] + gz * p[2]) / rho
            tangential = math.sqrt(max(0.0, gx * gx + gy * gy + gz * gz - g_n * g_n))
            friction = max(friction, (1 - share) * tangential / normal)
        if i < steps:
            y = step(sphere, drive, t, y, step_s)
    return SphereRun(
        t=tuple(ts),
        angle_deg=tuple(angles),
        depth_below_equator_m=tuple(depths),
        drive_hz=tuple(rates),
        lead_deg=tuple(leads),
        final_angle_deg=angles[-1],
        highest_angle_deg=max(angles),
        friction_needed=friction,
        left_the_wall=left,
    )
