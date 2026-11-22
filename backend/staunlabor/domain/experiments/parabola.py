"""The water parabola: water in a spinning vessel hollows into a bowl.

The exhibit is a round vessel of water on a turntable. As it spins, the surface
sinks in the middle and climbs the wall, deeper the faster it turns — until the
middle runs dry.

**The model.** Water turning with the vessel as one body, at ``ω``: in the
turning frame the surface is where gravity and the centrifugal pull together
are square to it, a paraboloid ``z(r) = z₀ + ω²·r²/(2g)``. The water's volume
fixes ``z₀``: the middle sinks by ``ω²·R²/(4g)`` and the rim rises by exactly as
much. At ``ω = 2·√(g·h)/R`` the middle touches the bottom; faster, a dry patch
of radius ``r₀`` opens, ``r₀² = R² − 2·R·√(g·h)/ω``, and the rim stands at
``R·ω·√(h/g)``. Where the rim passes the vessel's top, the water spills
(:attr:`Surface.spills`).

**The mirror.** A paraboloid ``z = r²/(4f)`` focuses light coming straight down
at ``f``: here ``f = g/(2ω²)``. A turning dish of a liquid that reflects is a
telescope's mirror, its focus set by the turntable's rate.

**Spinning up.** Water does not turn with the vessel at once: the vessel's
bottom drags it along through a thin boundary layer, and the water follows over
the time ``τ = h/√(ν·Ω)`` (Greenspan and Howard's spin-up, one Ekman layer at
the bottom, ``Ω`` the faster of the two rates). The page lets the water's rate
relax toward the vessel's at that time, ``dω/dt = (ω_v − ω)/τ``, and draws the
surface of water turning as one body at ``ω``. That is a model of how long it
takes, not of the flow while it does: during spin-up the real interior is not
quite rigid, and its surface not quite this parabola.

**What it leaves out.** Surface tension and the meniscus at the wall; the
vessel's wobble; the water's swirl after a sudden change.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from staunlabor.domain.experiments.constants import G
from staunlabor.domain.experiments.numerics import MAX_DURATION_S, rk4, sample_every

#: Water's kinematic viscosity at 20 °C, m²/s.
NU = 1.0e-6

#: The step of the spin-up: it takes tens of seconds, so 10 ms is fine.
SPIN_STEP_S = 0.01

#: The number of points a profile is drawn with, rim to rim.
PROFILE_POINTS = 61


@dataclass(frozen=True)
class Vessel:
    radius_m: float = 0.15
    height_m: float = 0.30
    #: h: how high the water stands at rest.
    fill_m: float = 0.10

    def __post_init__(self) -> None:
        if not 0.02 <= self.radius_m <= 2.0:
            raise ValueError("the vessel's radius lies between 2 cm and 2 m")
        if not 0 < self.fill_m < self.height_m <= 4.0:
            raise ValueError("the water stands above the bottom and below the vessel's top")


@dataclass(frozen=True)
class Surface:
    rate_rad_s: float
    #: The surface's height at the middle; 0 once the middle is dry.
    centre_m: float
    rim_m: float
    #: The radius of the dry patch in the middle; 0 while it is wet.
    dry_radius_m: float
    spills: bool
    #: Where light coming straight down is focused, above the paraboloid's vertex;
    #: ``None`` at rest.
    focus_m: float | None


def _check(rate: float) -> None:
    if rate < 0:
        raise ValueError("the rate is given as a positive number of radians a second")


def dry_rate(v: Vessel) -> float:
    """``ω`` at which the middle touches the bottom: ``2·√(g·h)/R``."""
    return 2 * math.sqrt(G * v.fill_m) / v.radius_m


def surface(v: Vessel, rate: float) -> Surface:
    """The surface of water turning with the vessel at ``rate`` (rad/s)."""
    _check(rate)
    w2 = rate * rate
    if rate <= dry_rate(v):
        centre = v.fill_m - w2 * v.radius_m**2 / (4 * G)
        rim = v.fill_m + w2 * v.radius_m**2 / (4 * G)
        dry = 0.0
    else:
        centre = 0.0
        rim = v.radius_m * rate * math.sqrt(v.fill_m / G)
        dry = math.sqrt(v.radius_m**2 - 2 * v.radius_m * math.sqrt(G * v.fill_m) / rate)
    return Surface(
        rate_rad_s=rate,
        centre_m=centre,
        rim_m=rim,
        dry_radius_m=dry,
        spills=rim > v.height_m,
        focus_m=G / (2 * w2) if rate > 0 else None,
    )


def height_at(s: Surface, r: float) -> float:
    """The surface's height at ``r`` from the axis: the paraboloid, or the bottom
    inside the dry patch."""
    rise = s.rate_rad_s**2 / (2 * G)
    if s.dry_radius_m > 0:
        return max(0.0, rise * (r * r - s.dry_radius_m**2))
    return s.centre_m + rise * r * r


def profile(v: Vessel, rate: float) -> tuple[float, ...]:
    """The surface's height at :data:`PROFILE_POINTS` places from rim to rim."""
    s = surface(v, rate)
    n = PROFILE_POINTS - 1
    return tuple(height_at(s, abs(-v.radius_m + 2 * v.radius_m * i / n)) for i in range(n + 1))


def spill_rate(v: Vessel) -> float:
    """``ω`` at which the rim reaches the vessel's top: before the middle is dry,
    ``2·√(g·(H − h))/R``; after it, ``H/(R·√(h/g))``."""
    wet = 2 * math.sqrt(G * (v.height_m - v.fill_m)) / v.radius_m
    if wet <= dry_rate(v):
        return wet
    return v.height_m / (v.radius_m * math.sqrt(v.fill_m / G))


def spin_up_time_s(v: Vessel, rate: float) -> float | None:
    """``τ = h/√(ν·Ω)``: how long the water takes to follow the vessel to about
    two thirds of a change; ``None`` with nothing turning."""
    return v.fill_m / math.sqrt(NU * rate) if rate > 0 else None


def spin_rhs(v: Vessel, vessel_rate: float):
    """``dω/dt = (ω_v − ω)/τ``, τ at the faster of the two rates."""

    def f(_t: float, y: tuple[float, ...]) -> tuple[float, ...]:
        fastest = max(abs(vessel_rate), abs(y[0]))
        if fastest == 0:
            return (0.0,)
        return ((vessel_rate - y[0]) * math.sqrt(NU * fastest) / v.fill_m,)

    return f


@dataclass(frozen=True)
class SpinRun:
    t: tuple[float, ...]
    water_rate: tuple[float, ...]
    centre_m: tuple[float, ...]
    rim_m: tuple[float, ...]


def spin(
    v: Vessel, vessel_rate: float, duration_s: float, start_rate: float = 0.0, step_s: float = SPIN_STEP_S
) -> SpinRun:
    """The water following a vessel switched to ``vessel_rate`` (rad/s) from
    ``start_rate``, and the surface it has on the way."""
    _check(vessel_rate)
    _check(start_rate)
    if not 0 < step_s <= 0.1:
        raise ValueError("the step lies between 0 and 100 ms")
    if not 0 < duration_s <= MAX_DURATION_S:
        raise ValueError(f"a spin lasts more than nothing and at most {MAX_DURATION_S:g} s")
    f = spin_rhs(v, vessel_rate)
    y: tuple[float, ...] = (start_rate,)
    steps = round(duration_s / step_s)
    every = sample_every(step_s)
    ts: list[float] = []
    rates: list[float] = []
    centres: list[float] = []
    rims: list[float] = []
    for i in range(steps + 1):
        t = i * step_s
        if i % every == 0:
            s = surface(v, y[0])
            ts.append(t)
            rates.append(y[0])
            centres.append(s.centre_m)
            rims.append(s.rim_m)
        if i < steps:
            y = rk4(f, t, y, step_s)
    return SpinRun(t=tuple(ts), water_rate=tuple(rates), centre_m=tuple(centres), rim_m=tuple(rims))
