"""The gravity well: a ball circling a funnel, a planet's orbit in a coin's spiral.

The exhibit is a wide funnel whose wall rises ever more gently outward. A ball
started along the rim circles the hole for a long while, ever faster and ever
lower, until it drops in.

**The model.** The wall is ``z = −k/r``, from the rim down to the hole. The
ball is small beside the wall's curvature and rolls without slipping: its spin
counts as 2/5 more inertia, ``T = (7/10)·m·v²``, the sphere exhibit's way, so
every push along the wall moves it at 5/7. Lagrange's equations in ``(r, φ)``
on the surface. Rolling resistance ``C·N`` against the motion, ``N`` the wall's
push — the weight's share across it and what holds the ball on its curved path,
which near the hole, where the wall stands steep and the ball runs fast, is
most of it.

**Why Kepler.** On a circle the slope supplies the pull to the middle:
``r·φ̇² = (5/7)·g·f′(r) = (5/7)·g·k/r²``, the inverse square of a planet's
gravity, so ``v ∝ r^{−1/2}`` and ``T² ∝ r³`` exactly: Kepler's third law. Not
his first: off the circle the wall's steepness ``1 + f′²`` and its curvature
enter, and a path is a rosette that turns, not a closed ellipse.

**What it leaves out.** The ball's spin about the wall's normal and every term
of the ball's radius over the wall's curvature; air; the ball's bouncing at the
rim. A coin, which rolls on its edge and leans, is another problem.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from staunlabor.domain.experiments.pendulum import G
from staunlabor.domain.experiments.sphere import RESISTANCE_FADE_M_S

#: 1/(1 + 2/5): the share of a push along the wall that moves a rolling ball.
SHARE = 5 / 7

STEP_S = 1e-3

#: Samples a run returns per second.
SAMPLES_PER_S = 50

#: The longest run.
MAX_S = 300.0

#: Where the ball is started: this share of the rim's radius.
START_SHARE = 0.9

#: (r, ṙ, φ, φ̇): m, m/s, rad, rad/s.
State = tuple[float, float, float, float]


@dataclass(frozen=True)
class Funnel:
    #: k: the wall is z = −k/r.
    k_m2: float = 0.01
    rim_m: float = 0.4
    hole_m: float = 0.03
    #: C: the rolling resistance's share of the wall's push.
    rolling_resistance: float = 0.002

    def __post_init__(self) -> None:
        if not 0.001 <= self.k_m2 <= 0.05:
            raise ValueError("the funnel's k lies between 0.001 and 0.05 m²")
        if not 0.1 <= self.rim_m <= 2:
            raise ValueError("the rim is between 10 cm and 2 m from the middle")
        if not 0.005 <= self.hole_m <= self.rim_m / 4:
            raise ValueError("the hole is at least 5 mm across and at most a quarter of the rim")
        if not 0 <= self.rolling_resistance <= 0.05:
            raise ValueError("the rolling resistance lies between 0 and 0.05")

    @property
    def start_m(self) -> float:
        return START_SHARE * self.rim_m


def height_m(f: Funnel, r: float) -> float:
    return -f.k_m2 / r


def circular_speed_m_s(f: Funnel, r: float) -> float:
    """The speed that keeps the ball on a circle of radius ``r``."""
    return math.sqrt(SHARE * G * f.k_m2 / r)


def circular_period_s(f: Funnel, r: float) -> float:
    return 2 * math.pi * r / circular_speed_m_s(f, r)


@dataclass(frozen=True)
class Launch:
    speed_m_s: float = 0.44
    #: From the rim's direction, positive towards the hole.
    aim_deg: float = 0.0

    def __post_init__(self) -> None:
        if not 0 <= self.speed_m_s <= 3:
            raise ValueError("a launch is between 0 and 3 m/s")
        if not -90 <= self.aim_deg <= 90:
            raise ValueError("a launch is aimed at most 90° in or out")


def start(f: Funnel, launch: Launch) -> State:
    """``(r, ṙ, φ, φ̇)`` at the launch."""
    r = f.start_m
    w = math.sqrt(1 + (f.k_m2 / (r * r)) ** 2)
    aim = math.radians(launch.aim_deg)
    along = launch.speed_m_s * math.cos(aim)
    inward = launch.speed_m_s * math.sin(aim)
    return r, -inward / w, 0.0, along / r


def _rates(f: Funnel, y: State) -> State:
    r, rd, _, pd = y
    k = f.k_m2
    slope = k / (r * r)
    bend = -2 * k / (r * r * r)
    q = 1 + slope * slope
    w = math.sqrt(q)
    u_s = w * rd
    u_p = r * pd
    v2 = u_s * u_s + u_p * u_p
    # The wall's push: the weight's share across it, and the curvature of the
    # path along the meridian (convex: it lessens the push) and round the
    # funnel (concave: it adds).
    normal = G / w + bend / (q * w) * u_s * u_s + slope / (r * w) * u_p * u_p
    resist = f.rolling_resistance * max(normal, 0.0) / math.sqrt(v2 + RESISTANCE_FADE_M_S**2)
    q_r = -resist * u_s * w
    q_p = -resist * u_p * r
    rdd = (SHARE * (-G * slope + q_r) - slope * bend * rd * rd + r * pd * pd) / q
    pdd = (SHARE * q_p - 2 * r * rd * pd) / (r * r)
    return rd, rdd, pd, pdd


def _ahead(y: State, k: State, h: float) -> State:
    return (y[0] + h * k[0], y[1] + h * k[1], y[2] + h * k[2], y[3] + h * k[3])


def _rk4(f: Funnel, y: State, h: float) -> State:
    k1 = _rates(f, y)
    k2 = _rates(f, _ahead(y, k1, h / 2))
    k3 = _rates(f, _ahead(y, k2, h / 2))
    k4 = _rates(f, _ahead(y, k3, h))
    return (
        y[0] + h / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
        y[1] + h / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
        y[2] + h / 6 * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]),
        y[3] + h / 6 * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]),
    )


def energy_per_kg(f: Funnel, y: State) -> float:
    """Motion and spin, ``(7/10)·v²``, and height, per kilogram."""
    r, rd, _, pd = y
    slope = f.k_m2 / (r * r)
    v2 = (1 + slope * slope) * rd * rd + r * r * pd * pd
    return 0.7 * v2 + G * height_m(f, r)


@dataclass(frozen=True)
class Lap:
    #: When the ball came round, s.
    end_s: float
    period_s: float
    #: The lap's mean radius over time, m.
    radius_m: float


@dataclass(frozen=True)
class Ride:
    t: float
    y: State
    #: "rolling", "hole" (dropped in) or "rim" (rolled out over it).
    outcome: str
    laps_done: int
    lap_start_s: float
    #: ∫ r dt over the lap so far.
    r_sum: float


def begin(f: Funnel, launch: Launch) -> Ride:
    return Ride(t=0.0, y=start(f, launch), outcome="rolling", laps_done=0, lap_start_s=0.0, r_sum=0.0)


def advance(f: Funnel, ride: Ride) -> tuple[Ride, Lap | None]:
    """One step, and the lap it completes if it completes one."""
    if ride.outcome != "rolling":
        return ride, None
    y = _rk4(f, ride.y, STEP_S)
    t = ride.t + STEP_S
    r_sum = ride.r_sum + (ride.y[0] + y[0]) / 2 * STEP_S
    outcome = "hole" if y[0] <= f.hole_m else "rim" if y[0] >= f.rim_m else "rolling"
    lap = None
    laps_done = ride.laps_done
    lap_start = ride.lap_start_s
    if math.floor(y[2] / (2 * math.pi)) > laps_done:
        # When φ crossed the next whole turn, between the two steps.
        mark = 2 * math.pi * (laps_done + 1)
        crossed = ride.t + (mark - ride.y[2]) / (y[2] - ride.y[2]) * STEP_S
        period = crossed - lap_start
        lap = Lap(end_s=crossed, period_s=period, radius_m=r_sum / (t - lap_start))
        laps_done += 1
        lap_start = crossed
        r_sum = 0.0
    return Ride(t=t, y=y, outcome=outcome, laps_done=laps_done, lap_start_s=lap_start, r_sum=r_sum), lap


@dataclass(frozen=True)
class WellRun:
    t: tuple[float, ...]
    r_m: tuple[float, ...]
    phi_rad: tuple[float, ...]
    laps: tuple[Lap, ...]
    outcome: str
    #: When the ball dropped in or rolled out, or the run's end.
    end_s: float


def run(f: Funnel, launch: Launch, duration_s: float) -> WellRun:
    if not 0 < duration_s <= MAX_S:
        raise ValueError(f"a run lasts more than nothing and at most {MAX_S:g} s")
    ride = begin(f, launch)
    every = max(1, round(1 / (SAMPLES_PER_S * STEP_S)))
    ts: list[float] = []
    rs: list[float] = []
    ps: list[float] = []
    laps: list[Lap] = []
    steps = round(duration_s / STEP_S)
    for i in range(steps + 1):
        if i % every == 0:
            ts.append(ride.t)
            rs.append(ride.y[0])
            ps.append(ride.y[2])
        if ride.outcome != "rolling" or i == steps:
            break
        ride, lap = advance(f, ride)
        if lap is not None:
            laps.append(lap)
    # The last moment, the drop or the roll out, whether or not it fell on a sample.
    if ts[-1] != ride.t:
        ts.append(ride.t)
        rs.append(ride.y[0])
        ps.append(ride.y[2])
    return WellRun(
        t=tuple(ts),
        r_m=tuple(rs),
        phi_rad=tuple(ps),
        laps=tuple(laps),
        outcome=ride.outcome,
        end_s=ride.t,
    )
