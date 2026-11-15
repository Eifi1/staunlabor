"""The gyroscope wheel: a spinning wheel on a string goes sideways, not down.

The exhibit is a heavy wheel on an axle. Held by one end of the axle on a
string, a still wheel drops like a stone; spun, it stays up and turns slowly
round the string instead. In the same room a suitcase hides such a wheel, and
whoever carries it round a corner feels it tip sideways.

**The model.** Lagrange's heavy symmetric top: the axle's end is the pivot, the
wheel a ring of mass ``m`` and radius ``r`` at ``d`` along the axle, so
``I₃ = m·r²`` about the axle and ``I₁ = m·r²/2 + m·d²`` across it at the pivot.
Euler's angles: ``θ`` the axle from the upward vertical (90°: level), ``φ``
its turn round the string, ``ψ`` the wheel's turn on it. The spin
``ω₃ = ψ̇ + φ̇·cos θ`` and ``p_φ = I₁·φ̇·sin²θ + I₃·ω₃·cos θ`` are kept, which
gives ``φ̇`` from ``θ``; what is stepped is

    I₁·θ̈ = I₁·φ̇²·sin θ·cos θ − I₃·ω₃·φ̇·sin θ + m·g·d·sin θ

by Runge–Kutta, a millisecond at a time, with ``ψ`` beside it for the drawing.

**Why sideways.** Gravity's torque ``m·g·d`` about a level axle turns the
wheel's angular momentum ``I₃·ω₃``, not the wheel down: steadily, at
``Ω = m·g·d/(I₃·ω₃)``. Let go from rest, the axle first dips, overshoots the
steady turn and comes back, in small loops whose points touch the start's
height (nutation), about ``I₃·ω₃/I₁`` a second.

**The suitcase.** Turning a level axle at ``Ω_turn`` about the vertical takes
the torque ``I₃·ω₃·Ω_turn`` about the horizontal, across: the carrier's hands
must supply it, or the case tips.

**What it leaves out.** The string's swing and stretch (its end is the
pivot), friction at the pivot and in the bearing, air. The wheel's spokes and
hub count for nothing beside its rim.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from staunlabor.domain.experiments.pendulum import G

STEP_S = 1e-3

#: Samples a run returns per second.
SAMPLES_PER_S = 50

#: The longest run.
MAX_S = 120.0

#: (θ, θ̇, φ, ψ): rad, rad/s, rad, rad.
State = tuple[float, float, float, float]


@dataclass(frozen=True)
class Wheel:
    mass_kg: float = 2.0
    radius_m: float = 0.3
    #: d: from the pivot to the wheel's middle, along the axle.
    axle_m: float = 0.15
    rpm: float = 200.0

    def __post_init__(self) -> None:
        if not 0.1 <= self.mass_kg <= 20:
            raise ValueError("the wheel weighs between 100 g and 20 kg")
        if not 0.05 <= self.radius_m <= 1:
            raise ValueError("the wheel's radius lies between 5 cm and 1 m")
        if not 0.02 <= self.axle_m <= 1:
            raise ValueError("the axle reaches between 2 cm and 1 m")
        if not 0 <= self.rpm <= 3000:
            raise ValueError("the wheel turns at most 3000 times a minute")

    @property
    def spin_rad_s(self) -> float:
        return self.rpm * 2 * math.pi / 60

    @property
    def i3(self) -> float:
        return self.mass_kg * self.radius_m**2

    @property
    def i1(self) -> float:
        return self.mass_kg * self.radius_m**2 / 2 + self.mass_kg * self.axle_m**2

    @property
    def torque_n_m(self) -> float:
        """Gravity's torque about a level axle's pivot."""
        return self.mass_kg * G * self.axle_m


def precession_rad_s(w: Wheel) -> float:
    """The steady turn of a level axle: ``m·g·d/(I₃·ω₃)``."""
    if w.spin_rad_s == 0:
        raise ValueError("a still wheel does not turn: it falls")
    return w.torque_n_m / (w.i3 * w.spin_rad_s)


def nutation_rad_s(w: Wheel) -> float:
    """The fast wheel's nodding rate, ``I₃·ω₃/I₁``."""
    return w.i3 * w.spin_rad_s / w.i1


def suitcase_torque_n_m(w: Wheel, turn_deg_s: float) -> float:
    """What the hands must supply to turn a level axle at ``turn_deg_s``."""
    return w.i3 * w.spin_rad_s * math.radians(turn_deg_s)


@dataclass(frozen=True)
class Release:
    #: θ₀: the axle from the upward vertical when let go; 90° is level.
    tilt_deg: float = 90.0
    #: Let go turning at the steady rate, or from rest.
    steady: bool = False

    def __post_init__(self) -> None:
        if not 30 <= self.tilt_deg <= 150:
            raise ValueError("the axle is let go between 30° and 150° from the vertical")


def _steady_rate(w: Wheel, theta: float) -> float:
    """The slow root of the steady turn at ``θ``: the one a released wheel
    settles near."""
    c = math.cos(theta)
    l3 = w.i3 * w.spin_rad_s
    if abs(c) < 1e-12:
        return w.torque_n_m / l3
    disc = l3 * l3 - 4 * w.i1 * w.torque_n_m * c
    if disc < 0:
        raise ValueError("too slow a wheel has no steady turn at this tilt")
    return (l3 - math.sqrt(disc)) / (2 * w.i1 * c)


@dataclass(frozen=True)
class Motion:
    #: p_φ: the angular momentum about the string, kept.
    p_phi: float
    #: I₃·ω₃, kept.
    l3: float


def start(w: Wheel, release: Release) -> tuple[State, Motion]:
    theta = math.radians(release.tilt_deg)
    rate = _steady_rate(w, theta) if release.steady and w.spin_rad_s > 0 else 0.0
    l3 = w.i3 * w.spin_rad_s
    p_phi = w.i1 * rate * math.sin(theta) ** 2 + l3 * math.cos(theta)
    return (theta, 0.0, 0.0, 0.0), Motion(p_phi=p_phi, l3=l3)


def turn_rate(w: Wheel, m: Motion, theta: float) -> float:
    """φ̇ from the kept momenta."""
    return (m.p_phi - m.l3 * math.cos(theta)) / (w.i1 * math.sin(theta) ** 2)


def _rates(w: Wheel, m: Motion, y: State) -> State:
    theta, td = y[0], y[1]
    s, c = math.sin(theta), math.cos(theta)
    pd = turn_rate(w, m, theta)
    tdd = (w.i1 * pd * pd * s * c - m.l3 * pd * s + w.torque_n_m * s) / w.i1
    spin = m.l3 / w.i3 if w.i3 > 0 else 0.0
    return td, tdd, pd, spin - pd * c


def _ahead(y: State, k: State, h: float) -> State:
    return (y[0] + h * k[0], y[1] + h * k[1], y[2] + h * k[2], y[3] + h * k[3])


def step(w: Wheel, m: Motion, y: State) -> State:
    h = STEP_S
    k1 = _rates(w, m, y)
    k2 = _rates(w, m, _ahead(y, k1, h / 2))
    k3 = _rates(w, m, _ahead(y, k2, h / 2))
    k4 = _rates(w, m, _ahead(y, k3, h))
    return (
        y[0] + h / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
        y[1] + h / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
        y[2] + h / 6 * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]),
        y[3] + h / 6 * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]),
    )


def energy_j(w: Wheel, m: Motion, y: State) -> float:
    theta, td = y[0], y[1]
    pd = turn_rate(w, m, theta)
    spin = m.l3 / w.i3 if w.i3 > 0 else 0.0
    return (
        0.5 * w.i1 * (td * td + pd * pd * math.sin(theta) ** 2)
        + 0.5 * w.i3 * spin * spin
        + w.torque_n_m * math.cos(theta)
    )


#: The wheel has dropped: the axle hangs within this of straight down. The
#: equations hold to the end, but the string would long have swung.
HANGING_DEG = 170.0


@dataclass(frozen=True)
class GyroRun:
    t: tuple[float, ...]
    tilt_deg: tuple[float, ...]
    turn_deg: tuple[float, ...]
    #: When the axle first hung down past HANGING_DEG, if it did.
    dropped_s: float | None


def run(w: Wheel, release: Release, duration_s: float) -> GyroRun:
    if not 0 < duration_s <= MAX_S:
        raise ValueError(f"a run lasts more than nothing and at most {MAX_S:g} s")
    y, m = start(w, release)
    steps = round(duration_s / STEP_S)
    every = max(1, round(1 / (SAMPLES_PER_S * STEP_S)))
    ts: list[float] = []
    tilts: list[float] = []
    turns: list[float] = []
    dropped = None
    for i in range(steps + 1):
        if i % every == 0:
            ts.append(i * STEP_S)
            tilts.append(math.degrees(y[0]))
            turns.append(math.degrees(y[2]))
        if math.degrees(y[0]) >= HANGING_DEG:
            dropped = i * STEP_S
            break
        if i < steps:
            y = step(w, m, y)
    return GyroRun(t=tuple(ts), tilt_deg=tuple(tilts), turn_deg=tuple(turns), dropped_s=dropped)
