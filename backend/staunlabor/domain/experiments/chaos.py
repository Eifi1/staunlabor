"""The chaotic pendulum: a double pendulum nobody can push the same way twice.

The exhibit is a pendulum with a second one hanging from its end. Pushed hard,
it flails and never repeats; whoever pushes it twice "the same" sees two
different dances.

**The model.** Two point masses ``m₁, m₂`` on light rods ``L₁, L₂``, the second
hung from the first; the angles ``θ₁, θ₂`` from the vertical. Lagrange's
equations give the two accelerations (the usual closed form, below), stepped
by the block's Runge–Kutta at 1 ms; the energy

    E = ½(m₁ + m₂)L₁²θ₁'² + ½m₂L₂²θ₂'² + m₂L₁L₂θ₁'θ₂'cos(θ₁ − θ₂)
        − (m₁ + m₂)gL₁cos θ₁ − m₂gL₂cos θ₂

is the check: without damping it must not drift.

**Chaos, measured.** The page lets go two pendulums whose starts differ by a
thousandth of a degree and follows how far apart they get, in the angles and
their rates (each rate over ``√(g/L₁)``, so all four count alike). Swinging
gently, the gap stays a thousandth or grows slowly. Swinging wildly, it grows
by a factor each second until it is as large as the swing itself. That factor,
the largest Lyapunov exponent, is measured, not asserted (:func:`lyapunov`):
Benettin's way, a twin kept a hundred-millionth away, its gap's growth summed
in logarithms and the twin set back to that distance every tenth of a second,
over a minute. (A slope fitted to one pair's gap varied from 1.9 to 3.8 a
second with the size of the first nudge: one stretch of one path says little.)

**What it leaves out.** The rods' mass and the bearings' friction (a linear
damping stands in for both), air; and the exhibit's real arms, which are
physical pendulums, not point masses — the same kind of chaos with other
numbers.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from staunlabor.domain.experiments.pendulum import MAX_DURATION_S, STEP_S, G, rk4, sample_every


@dataclass(frozen=True)
class DoublePendulum:
    length1_m: float = 0.3
    length2_m: float = 0.3
    mass1_kg: float = 0.5
    mass2_kg: float = 0.5
    damping_per_s: float = 0.0

    def __post_init__(self) -> None:
        if not (0.05 <= self.length1_m <= 3 and 0.05 <= self.length2_m <= 3):
            raise ValueError("each rod is between 5 cm and 3 m long")
        if not (0.01 <= self.mass1_kg <= 20 and 0.01 <= self.mass2_kg <= 20):
            raise ValueError("each mass lies between 10 g and 20 kg")
        if not 0 <= self.damping_per_s <= 1:
            raise ValueError("the damping lies between 0 and 1 per second")


def rhs(dp: DoublePendulum):
    """``(θ₁, θ₂, θ₁', θ₂')'``: Lagrange's equations for two point masses."""
    l1, l2, m1, m2, c = dp.length1_m, dp.length2_m, dp.mass1_kg, dp.mass2_kg, dp.damping_per_s

    def f(_t: float, y: tuple[float, ...]) -> tuple[float, ...]:
        t1, t2, w1, w2 = y
        d = t1 - t2
        den = 2 * m1 + m2 - m2 * math.cos(2 * d)
        a1 = (
            -G * (2 * m1 + m2) * math.sin(t1)
            - m2 * G * math.sin(t1 - 2 * t2)
            - 2 * math.sin(d) * m2 * (w2 * w2 * l2 + w1 * w1 * l1 * math.cos(d))
        ) / (l1 * den)
        a2 = (
            2
            * math.sin(d)
            * (w1 * w1 * l1 * (m1 + m2) + G * (m1 + m2) * math.cos(t1) + w2 * w2 * l2 * m2 * math.cos(d))
        ) / (l2 * den)
        return (w1, w2, a1 - c * w1, a2 - c * w2)

    return f


def energy(dp: DoublePendulum, y: tuple[float, ...]) -> float:
    l1, l2, m1, m2 = dp.length1_m, dp.length2_m, dp.mass1_kg, dp.mass2_kg
    t1, t2, w1, w2 = y
    kinetic = 0.5 * (m1 + m2) * (l1 * w1) ** 2 + 0.5 * m2 * (l2 * w2) ** 2 + m2 * l1 * l2 * w1 * w2 * math.cos(t1 - t2)
    potential = -(m1 + m2) * G * l1 * math.cos(t1) - m2 * G * l2 * math.cos(t2)
    return kinetic + potential


def separation(dp: DoublePendulum, a: tuple[float, ...], b: tuple[float, ...]) -> float:
    """How far apart two states are: the angles' gaps and the rates' gaps over
    ``√(g/L₁)``, as one length."""
    scale = math.sqrt(G / dp.length1_m)
    return math.sqrt(
        (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + ((a[2] - b[2]) / scale) ** 2 + ((a[3] - b[3]) / scale) ** 2
    )


def mode_rates(dp: DoublePendulum) -> tuple[float, float]:
    """The two small-swing modes' rates, rad/s: the roots of
    ``m₁L₁L₂ω⁴ − (m₁+m₂)g(L₁+L₂)ω² + (m₁+m₂)g² = 0``."""
    l1, l2, m1, m2 = dp.length1_m, dp.length2_m, dp.mass1_kg, dp.mass2_kg
    a = m1 * l1 * l2
    b = -(m1 + m2) * G * (l1 + l2)
    c = (m1 + m2) * G * G
    root = math.sqrt(b * b - 4 * a * c)
    return math.sqrt((-b - root) / (2 * a)), math.sqrt((-b + root) / (2 * a))


@dataclass(frozen=True)
class ChaosRun:
    t: tuple[float, ...]
    #: The pendulum let go as asked.
    theta1_deg: tuple[float, ...]
    theta2_deg: tuple[float, ...]
    #: Its twin, the upper arm nudged by ``nudge_deg``.
    twin1_deg: tuple[float, ...]
    twin2_deg: tuple[float, ...]
    separation: tuple[float, ...]
    #: The largest relative drift of the first's energy from its start.
    energy_drift: float


def start_state(start1_deg: float, start2_deg: float) -> tuple[float, float, float, float]:
    if not (-180 <= start1_deg <= 180 and -180 <= start2_deg <= 180):
        raise ValueError("the arms start between −180° and 180°")
    return (math.radians(start1_deg), math.radians(start2_deg), 0.0, 0.0)


def lyapunov(
    dp: DoublePendulum,
    start1_deg: float,
    start2_deg: float,
    duration_s: float = 60.0,
    gap: float = 1e-8,
    every_s: float = 0.1,
    step_s: float = STEP_S,
) -> float:
    """The largest Lyapunov exponent along the path from this start, per
    second: a twin ``gap`` away, its separation's growth over each ``every_s``
    added up in logarithms, the twin then set back to ``gap`` along the line
    between them; the sum over the time."""
    if not 0 < duration_s <= MAX_DURATION_S:
        raise ValueError(f"a measurement lasts more than nothing and at most {MAX_DURATION_S:g} s")
    f = rhs(dp)
    a: tuple[float, ...] = start_state(start1_deg, start2_deg)
    b: tuple[float, ...] = (a[0] + gap, a[1], a[2], a[3])
    per = max(1, round(every_s / step_s))
    total = 0.0
    steps = round(duration_s / step_s)
    for i in range(steps):
        t = i * step_s
        a = rk4(f, t, a, step_s)
        b = rk4(f, t, b, step_s)
        if (i + 1) % per == 0:
            d = separation(dp, a, b)
            total += math.log(d / gap)
            b = tuple(a[k] + (b[k] - a[k]) * gap / d for k in range(4))
    return total / (steps * step_s)


def run(
    dp: DoublePendulum,
    start1_deg: float,
    start2_deg: float,
    duration_s: float,
    nudge_deg: float = 0.001,
    step_s: float = STEP_S,
) -> ChaosRun:
    """The pendulum and its twin, let go from rest together, stepped side by side."""
    if not 0 < step_s <= 0.01:
        raise ValueError("the step lies between 0 and 10 ms")
    if not 0 < duration_s <= MAX_DURATION_S:
        raise ValueError(f"a run lasts more than nothing and at most {MAX_DURATION_S:g} s")
    if not 0 < abs(nudge_deg) <= 10:
        raise ValueError("the nudge is more than nothing and at most 10°")
    f = rhs(dp)
    a: tuple[float, ...] = start_state(start1_deg, start2_deg)
    b: tuple[float, ...] = (a[0] + math.radians(nudge_deg), a[1], 0.0, 0.0)
    e0 = energy(dp, a)
    scale = max(abs(e0), (dp.mass1_kg + dp.mass2_kg) * G * (dp.length1_m + dp.length2_m))
    drift = 0.0
    steps = round(duration_s / step_s)
    every = sample_every(step_s)
    ts: list[float] = []
    out: dict[str, list[float]] = {k: [] for k in ("a1", "a2", "b1", "b2", "s")}
    for i in range(steps + 1):
        t = i * step_s
        if i % every == 0:
            ts.append(t)
            out["a1"].append(math.degrees(a[0]))
            out["a2"].append(math.degrees(a[1]))
            out["b1"].append(math.degrees(b[0]))
            out["b2"].append(math.degrees(b[1]))
            out["s"].append(separation(dp, a, b))
            drift = max(drift, abs(energy(dp, a) - e0) / scale)
        if i < steps:
            a = rk4(f, t, a, step_s)
            b = rk4(f, t, b, step_s)
    return ChaosRun(
        t=tuple(ts),
        theta1_deg=tuple(out["a1"]),
        theta2_deg=tuple(out["a2"]),
        twin1_deg=tuple(out["b1"]),
        twin2_deg=tuple(out["b2"]),
        separation=tuple(out["s"]),
        energy_drift=drift,
    )
