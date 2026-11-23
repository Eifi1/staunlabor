"""Coupled pendulums: the swing wanders from one to the other and back.

The exhibit is two pendulums side by side, joined by a soft spring. Push one,
and the other starts to swing while the first comes to rest — then the other
way round, again and again.

**The model.** Two plane pendulums (:mod:`pendulum`) of length ``Lᵢ`` and mass
``mᵢ`` hang from one bar, a spring of stiffness ``k`` between them at the
distance ``a`` below the pivots. The spring is taken as horizontal, so it
pulls with ``k·a·(sin θ₂ − sin θ₁)`` and turns each pendulum with that times
``a·cos θᵢ``:

    θ₁'' = −(g/L₁)·sin θ₁ + κ₁·(sin θ₂ − sin θ₁)·cos θ₁ − c·θ₁'
    θ₂'' = −(g/L₂)·sin θ₂ − κ₂·(sin θ₂ − sin θ₁)·cos θ₂ − c·θ₂'

with ``κᵢ = k·a²/(mᵢ·Lᵢ²)``, stepped by the block's Runge–Kutta.

**The modes.** For small swings the two equations are linear, and they have
two motions in which both pendulums swing at one rate: together, the spring
idle, at ``ω₁ = √(g/L)``; against each other, the spring working, at
``ω₂ = √(g/L + 2κ)`` (equal pendulums). Every other motion is a sum of the two,
and a push to one pendulum alone is half of each: the two drift in and out of
step at ``ω₂ − ω₁``, and the swing wanders from one pendulum to the other and
back once in the beat ``T = 2π/(ω₂ − ω₁)``.

**Unequal pendulums** never hand over all of it: the share that reaches the
second is ``4·κ₁·κ₂/((a₁ − a₂)² + 4·κ₁·κ₂)``, ``aᵢ = g/Lᵢ + κᵢ``, the more
the more alike they are and the stronger the spring (Rabi's formula, for these
two oscillators).

**What it leaves out.** The spring's own mass, its sag and the slant it takes
as the pendulums swing; air, beyond the one linear damping.
"""

from __future__ import annotations

import enum
import math
from dataclasses import dataclass

from staunlabor.domain.experiments.constants import G
from staunlabor.domain.experiments.numerics import STEP_S, check_run, rk4, sample_every


class Start(enum.StrEnum):
    #: One pendulum pulled aside, the other at rest.
    ONE = "one"
    #: Both pulled aside the same way: the first mode alone.
    TOGETHER = "together"
    #: Pulled aside against each other: the second mode alone.
    AGAINST = "against"


@dataclass(frozen=True)
class Bob:
    length_m: float = 0.5
    mass_kg: float = 0.2

    def __post_init__(self) -> None:
        if not 0.05 <= self.length_m <= 5.0:
            raise ValueError("a pendulum is between 5 cm and 5 m long")
        if not 0.01 <= self.mass_kg <= 20.0:
            raise ValueError("a bob weighs between 10 g and 20 kg")


@dataclass(frozen=True)
class CoupledPendulums:
    left: Bob = Bob()
    right: Bob = Bob()
    #: k: the spring's stiffness.
    spring_n_m: float = 1.0
    #: a: how far below the pivots the spring is fixed.
    spring_at_m: float = 0.25
    #: c: the swings die away as e^(−c·t/2).
    damping_per_s: float = 0.0

    def __post_init__(self) -> None:
        if not 0 <= self.spring_n_m <= 100:
            raise ValueError("the spring's stiffness lies between 0 and 100 N/m")
        if not 0 < self.spring_at_m <= min(self.left.length_m, self.right.length_m):
            raise ValueError("the spring is fixed on both pendulums, between the pivot and the bob")
        if not 0 <= self.damping_per_s <= 1:
            raise ValueError("the damping lies between 0 and 1 per second")


def couplings(cp: CoupledPendulums) -> tuple[float, float]:
    """``κᵢ = k·a²/(mᵢ·Lᵢ²)``, per second squared."""
    ka2 = cp.spring_n_m * cp.spring_at_m**2
    return (
        ka2 / (cp.left.mass_kg * cp.left.length_m**2),
        ka2 / (cp.right.mass_kg * cp.right.length_m**2),
    )


def _diagonal(cp: CoupledPendulums) -> tuple[float, float]:
    k1, k2 = couplings(cp)
    return G / cp.left.length_m + k1, G / cp.right.length_m + k2


def mode_rates(cp: CoupledPendulums) -> tuple[float, float]:
    """The two modes' rates for small swings, slower first, rad/s: the roots of
    the 2 × 2 system's characteristic polynomial."""
    a1, a2 = _diagonal(cp)
    k1, k2 = couplings(cp)
    mean = (a1 + a2) / 2
    split = math.sqrt(((a1 - a2) / 2) ** 2 + k1 * k2)
    return math.sqrt(mean - split), math.sqrt(mean + split)


def beat_s(cp: CoupledPendulums) -> float | None:
    """``2π/(ω₂ − ω₁)``: the time for the swing to wander over and back;
    ``None`` with no spring."""
    w1, w2 = mode_rates(cp)
    return 2 * math.pi / (w2 - w1) if w2 > w1 else None


def exchange_share(cp: CoupledPendulums) -> float:
    """The most of a push to one pendulum that the other ever takes, for small
    swings: 1 for equal pendulums, less the more they differ."""
    a1, a2 = _diagonal(cp)
    k1, k2 = couplings(cp)
    both = 4 * k1 * k2
    return both / ((a1 - a2) ** 2 + both) if both > 0 else 0.0


def rhs(cp: CoupledPendulums):
    """The four first-order equations: ``(θ₁, θ₂, θ₁', θ₂')``."""
    g1, g2 = G / cp.left.length_m, G / cp.right.length_m
    k1, k2 = couplings(cp)
    c = cp.damping_per_s

    def f(_t: float, y: tuple[float, ...]) -> tuple[float, ...]:
        s1, s2 = math.sin(y[0]), math.sin(y[1])
        stretch = s2 - s1
        return (
            y[2],
            y[3],
            -g1 * s1 + k1 * stretch * math.cos(y[0]) - c * y[2],
            -g2 * s2 - k2 * stretch * math.cos(y[1]) - c * y[3],
        )

    return f


def start_state(start: Start, amplitude_deg: float) -> tuple[float, float, float, float]:
    if not 0 < amplitude_deg <= 60:
        raise ValueError("the pendulums are pulled aside by more than nothing and at most 60°")
    a = math.radians(amplitude_deg)
    if start is Start.ONE:
        return (a, 0.0, 0.0, 0.0)
    if start is Start.TOGETHER:
        return (a, a, 0.0, 0.0)
    return (a, -a, 0.0, 0.0)


def energies(cp: CoupledPendulums, y: tuple[float, ...]) -> tuple[float, float, float]:
    """Each pendulum's own energy — motion and height — and the spring's, J."""
    left, right = cp.left, cp.right
    e1 = 0.5 * left.mass_kg * (left.length_m * y[2]) ** 2 + left.mass_kg * G * left.length_m * (1 - math.cos(y[0]))
    e2 = 0.5 * right.mass_kg * (right.length_m * y[3]) ** 2 + right.mass_kg * G * right.length_m * (1 - math.cos(y[1]))
    stretch = cp.spring_at_m * (math.sin(y[1]) - math.sin(y[0]))
    return e1, e2, 0.5 * cp.spring_n_m * stretch * stretch


@dataclass(frozen=True)
class CoupledRun:
    t: tuple[float, ...]
    left_deg: tuple[float, ...]
    right_deg: tuple[float, ...]
    left_j: tuple[float, ...]
    right_j: tuple[float, ...]
    spring_j: tuple[float, ...]


def swing(
    cp: CoupledPendulums, start: Start, amplitude_deg: float, duration_s: float, step_s: float = STEP_S
) -> CoupledRun:
    """The pair let go from ``start``, stepped for ``duration_s``."""
    check_run(duration_s, step_s)
    f = rhs(cp)
    y: tuple[float, ...] = start_state(start, amplitude_deg)
    steps = round(duration_s / step_s)
    every = sample_every(step_s)
    out: dict[str, list[float]] = {k: [] for k in ("t", "l", "r", "le", "re", "se")}
    for i in range(steps + 1):
        t = i * step_s
        if i % every == 0:
            e1, e2, es = energies(cp, y)
            out["t"].append(t)
            out["l"].append(math.degrees(y[0]))
            out["r"].append(math.degrees(y[1]))
            out["le"].append(e1)
            out["re"].append(e2)
            out["se"].append(es)
        if i < steps:
            y = rk4(f, t, y, step_s)
    return CoupledRun(
        t=tuple(out["t"]),
        left_deg=tuple(out["l"]),
        right_deg=tuple(out["r"]),
        left_j=tuple(out["le"]),
        right_j=tuple(out["re"]),
        spring_j=tuple(out["se"]),
    )
