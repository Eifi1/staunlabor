"""The chaotic pendulum, checked: its time loop, at the page's step, against the
double pendulum's slow normal mode, the conservation of energy on a wild swing,
and a damped oscillator's decay.

Chaos itself has no hand formula; what can be checked by hand is that the loop
the page runs is the double pendulum's: its small swings, its energy and its
damping. The page steps the browser port (``simulate/chaos.ts``: ``rhs``,
``rk4``, ``stepFor``), held to this engine by ``engine-cases.json``; what is
measured here is the engine the port copies, stepped the same way.
"""

from __future__ import annotations

import itertools
import math

from staunlabor.domain.checks import Case, Source
from staunlabor.domain.experiments import chaos as engine

ENGINE = ("chaos",)

#: Standard gravity, as the engine takes it.
G = 9.80665

_MODES = Source(
    cite="S. Anlage, University of Maryland, Phys 410 (Fall 2015), Lecture #23 Summary, p. 3",
    url="https://www.physics.umd.edu/courses/Phys410/Anlage_Fall15/Phys%20410%20F15%20Lecture%2023%20Summary.pdf",
    quote="We then considered the special case of a double pendulum with equal masses (m) and equal lengths (L), and introduce the natural frequency (ω₀² ≡ g/L). The determinant yields two normal mode frequency solutions: ω₁ = ω₀√(2 − √2), and ω₂ = ω₀√(2 + √2). … The first is of the form φ = A₁(1, √2) cos(ω₁t − δ₁)",
)
_KINEMATICS = Source(
    cite="myPhysicsLab, “Double Pendulum”, §“Kinematics of the Double Pendulum”",
    url="https://www.myphysicslab.com/pendulum/double-pendulum-en.html",
    quote="x₁ = L₁ sin θ₁ y₁ = −L₁ cos θ₁ x₂ = x₁ + L₂ sin θ₂ y₂ = y₁ − L₂ cos θ₂ The velocity is the derivative with respect to time of the position. x₁' = θ₁' L₁ cos θ₁ y₁' = θ₁' L₁ sin θ₁ x₂' = x₁' + θ₂' L₂ cos θ₂ y₂' = y₁' + θ₂' L₂ sin θ₂",
)
_ENERGY = Source(
    cite="OpenStax, University Physics Volume 1, §8.3 Conservation of Energy",
    url="https://openstax.org/books/university-physics-volume-1/pages/8-3-conservation-of-energy",
    quote="The mechanical energy E of a particle stays constant unless forces outside the system or non-conservative forces do work on it",
)
_DAMPED = Source(
    cite="OpenStax, University Physics Volume 1, §15.5 Damped Oscillations, Eq. 15.23 and 15.24",
    url="https://openstax.org/books/university-physics-volume-1/pages/15-5-damped-oscillations",
    quote="m d²x/dt² + b dx/dt + kx = 0. … The solution is x(t) = A₀e^(−bt/2m) cos(ωt + ϕ).",
)

#: The page's pendulum: two 30 cm rods, two 500 g weights, no damping.
_FREE = engine.DoublePendulum()
_DAMPED_DP = engine.DoublePendulum(damping_per_s=0.1)
#: The slow mode's shape, upper arm to lower: 1 : √2 (the source's).
_SLOW = (1.0, math.sqrt(2))
#: The page's "wild" start.
_WILD = (120.0, 120.0)


def _steps(dp: engine.DoublePendulum, upper_deg: float, lower_deg: float, seconds: float):
    """The page's loop: the engine's equations by its Runge–Kutta, at the step
    the page takes for this build and start, from rest."""
    f = engine.rhs(dp)
    h = engine.step_for(dp, upper_deg, lower_deg)
    y = engine.start_state(upper_deg, lower_deg)
    out = [(0.0, y)]
    for i in range(round(seconds / h)):
        y = engine.rk4(f, i * h, y, h)
        out.append(((i + 1) * h, y))
    return out


def _slow_period_hand() -> float:
    w0 = math.sqrt(G / _FREE.length1_m)
    return 2 * math.pi / (w0 * math.sqrt(2 - math.sqrt(2)))


def _slow_period_measured() -> float:
    """Let go in the slow mode's shape, 1° and √2°: the time between the upper
    arm's upward crossings of the vertical, interpolated, over 15 s."""
    path = _steps(_FREE, _SLOW[0], _SLOW[1], 15.0)
    ups = [
        t0 + (t1 - t0) * -y0[0] / (y1[0] - y0[0])
        for (t0, y0), (t1, y1) in itertools.pairwise(path)
        if y0[0] < 0 <= y1[0]
    ]
    return (ups[-1] - ups[0]) / (len(ups) - 1)


def _energy(dp: engine.DoublePendulum, y: tuple[float, ...]) -> float:
    """½mv² + mgy for both weights, the places and velocities from the source's
    kinematics, worked out here (not the engine's :func:`energy`)."""
    l1, l2, m1, m2 = dp.length1_m, dp.length2_m, dp.mass1_kg, dp.mass2_kg
    t1, t2, w1, w2 = y
    y1 = -l1 * math.cos(t1)
    y2 = y1 - l2 * math.cos(t2)
    vx1, vy1 = w1 * l1 * math.cos(t1), w1 * l1 * math.sin(t1)
    vx2, vy2 = vx1 + w2 * l2 * math.cos(t2), vy1 + w2 * l2 * math.sin(t2)
    return 0.5 * m1 * (vx1**2 + vy1**2) + 0.5 * m2 * (vx2**2 + vy2**2) + m1 * G * y1 + m2 * G * y2


def _energy_at_start() -> float:
    """At rest from 120° and 120°: height alone."""
    t1, t2 = math.radians(_WILD[0]), math.radians(_WILD[1])
    l1, l2, m1, m2 = _FREE.length1_m, _FREE.length2_m, _FREE.mass1_kg, _FREE.mass2_kg
    return -(m1 + m2) * G * l1 * math.cos(t1) - m2 * G * l2 * math.cos(t2)


def _energy_after() -> float:
    return _energy(_FREE, _steps(_FREE, _WILD[0], _WILD[1], 20.0)[-1][1])


def _decay_measured() -> float:
    """Let go in the slow mode with damping: the upper arm's swing at its
    seventh return to rest against its start, as a rate, ln(θ₀/θ₇)/t₇. Each
    turn's top by a parabola through three steps."""
    path = _steps(_DAMPED_DP, _SLOW[0], _SLOW[1], 11.0)
    h = path[1][0]
    tops = []
    for (_, a), (t, b), (_, c) in zip(path, path[1:], path[2:], strict=False):
        if b[0] > a[0] and b[0] >= c[0]:
            s = 0.5 * (a[0] - c[0]) / (a[0] - 2 * b[0] + c[0])
            tops.append((t + s * h, b[0] - 0.25 * (a[0] - c[0]) * s))
    t7, top7 = tops[6]
    return math.log(math.radians(_SLOW[0]) / top7) / t7


def _setting(dp: engine.DoublePendulum, start: tuple[float, float]) -> dict[str, float | str]:
    """What the page's "Set it up" sets: the build and where the arms start."""
    return {
        "length1_m": dp.length1_m,
        "length2_m": dp.length2_m,
        "mass1_kg": dp.mass1_kg,
        "mass2_kg": dp.mass2_kg,
        "damping_per_s": dp.damping_per_s,
        "upper": start[0],
        "lower": start[1],
    }


CASES: tuple[Case, ...] = (
    Case(
        key="slow_mode",
        unit="s",
        expected=_slow_period_hand,
        measured=_slow_period_measured,
        # A swing of 1° and 1.4° is not infinitely small: 2.5 · 10⁻⁵ slower.
        tolerance=1e-4,
        sources=(_MODES,),
        setting=_setting(_FREE, _SLOW),
    ),
    Case(
        key="energy",
        unit="J",
        expected=_energy_at_start,
        measured=_energy_after,
        # Runge–Kutta at 1 ms through 20 000 wild steps: 1.0 · 10⁻⁷ off.
        tolerance=1e-6,
        sources=(_ENERGY, _KINEMATICS),
        derived=True,
        setting=_setting(_FREE, _WILD),
    ),
    Case(
        key="damping",
        unit="1/s",
        expected=lambda: _DAMPED_DP.damping_per_s / 2,
        measured=_decay_measured,
        # A swing of 1° is not infinitely small: 5 · 10⁻⁵.
        tolerance=2e-4,
        sources=(_DAMPED, _MODES),
        derived=True,
        setting=_setting(_DAMPED_DP, _SLOW),
    ),
)
