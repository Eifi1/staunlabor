"""The chaotic waterwheel: Lorenz's weather, made of cups.

The exhibit is a wheel on a tilted axle with leaking cups round its rim, water
pouring into the top one. Turn the tap up and the wheel starts to turn, slows,
stops, turns back, runs on — and never repeats.

**The model** (Malkus's wheel, as Strogatz writes it, §9.1). The water's mass
round the rim, ``m(θ) = M₀ + A·sin θ + B·cos θ`` (``θ`` from the top), the
wheel's rate ``Ω``; water pours in at the top (``q``), leaks out everywhere at
the rate ``K``, and the wheel is braked by ``ν·Ω``:

    A' = Ω·B − K·A,   B' = −Ω·A + q − K·B,   I·Ω' = −ν·Ω + π·g·r·A.

With ``τ = K·t``, ``x = Ω/K``, ``y = c·A``, ``z = ρ − c·B``, ``c = π·g·r/(ν·K)``
they are exactly Lorenz's equations

    x' = σ·(y − x),   y' = x·(ρ − z) − y,   z' = x·y − b·z,

with ``σ = ν/(K·I)``, ``ρ = π·g·r·q/(ν·K²)`` and ``b = 1`` — the same three
equations Lorenz cut down from the weather in 1963. The engine steps them (the
block's Runge–Kutta, a hundredth of a ``τ``) and turns them back into the wheel.

**What the tap does.** ``ρ`` grows with the inflow. Below 1 the wheel does not
turn at all: the leaks carry off the water before the top gets heavy enough.
Above 1 it can turn steadily one way or the other (``x = ±√(ρ − 1)``); above
``ρ_H = σ·(σ + b + 3)/(σ − b − 1)`` that steady turning is unstable too, and the
wheel wanders between turning one way and the other, never repeating:
Lorenz's butterfly.

**What it leaves out.** Cups — the model's water is spread smoothly round the
rim, its first harmonic all that matters; the wheel's tilt; splashing.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from staunlabor.domain.experiments.pendulum import MAX_DURATION_S, rk4

#: The wheel's b: one, for Malkus's wheel (Lorenz had 8/3 for the air).
B = 1.0

#: The step, in τ: a hundredth of the leaks' time.
STEP_TAU = 0.01

#: Samples a run returns per unit of τ.
SAMPLES_PER_TAU = 20

#: The nudge the wheel starts with: at rest, the water heaped at the top, a
#: hair's breadth turned.
NUDGE = 1e-3


@dataclass(frozen=True)
class WaterWheel:
    #: σ = ν/(K·I): the brake against the wheel's inertia and the leaks.
    sigma: float = 10.0
    #: ρ = π·g·r·q/(ν·K²): the tap.
    rho: float = 28.0
    #: K: how fast the cups leak, per second; one τ is 1/K seconds.
    leak_per_s: float = 0.2

    def __post_init__(self) -> None:
        if not 2.5 <= self.sigma <= 50:
            raise ValueError("σ lies between 2.5 and 50")
        if not 0 <= self.rho <= 200:
            raise ValueError("ρ lies between 0 and 200")
        if not 0.01 <= self.leak_per_s <= 10:
            raise ValueError("the cups leak at between 0.01 and 10 per second")


def rhs(w: WaterWheel):
    """Lorenz's equations in ``τ``, with ``b = 1``."""
    s, r = w.sigma, w.rho

    def f(_t: float, y: tuple[float, ...]) -> tuple[float, ...]:
        return (s * (y[1] - y[0]), y[0] * (r - y[2]) - y[1], y[0] * y[1] - B * y[2])

    return f


def hopf_rho(w: WaterWheel) -> float:
    """``ρ_H = σ·(σ + b + 3)/(σ − b − 1)``: above it steady turning is unstable."""
    return w.sigma * (w.sigma + B + 3) / (w.sigma - B - 1)


def steady_x(w: WaterWheel) -> float | None:
    """``√(b·(ρ − 1))``: the rate of steady turning, in units of ``K``; ``None``
    below ``ρ = 1``, where the wheel does not turn."""
    return math.sqrt(B * (w.rho - 1)) if w.rho > 1 else None


def regime(w: WaterWheel) -> str:
    """``"still"`` below ρ = 1, ``"steady"`` up to ``ρ_H``, ``"chaotic"`` above."""
    if w.rho <= 1:
        return "still"
    return "steady" if w.rho < hopf_rho(w) else "chaotic"


def cup_level(w: WaterWheel, y: float, z: float, theta: float) -> float:
    """How full the rim is at ``θ`` from the top, between 0 and 1: the mass's
    first harmonic, ``A·sin θ + B·cos θ`` ∝ ``y·sin θ + (ρ − z)·cos θ``, around
    half, scaled by the tap so the wheel at rest is full at the top."""
    scale = max(w.rho, 1.0)
    level = 0.5 + 0.45 * (y * math.sin(theta) + (w.rho - z) * math.cos(theta)) / scale
    return min(1.0, max(0.0, level))


@dataclass(frozen=True)
class WheelTurns:
    #: Seconds.
    t: tuple[float, ...]
    x: tuple[float, ...]
    y: tuple[float, ...]
    z: tuple[float, ...]
    #: The wheel's rate, rad/s: ``K·x``.
    rate_rad_s: tuple[float, ...]
    #: How far it has turned, in turns.
    turns: tuple[float, ...]
    #: When it changed direction, seconds.
    reversals_s: tuple[float, ...]


def run(w: WaterWheel, duration_s: float, step_tau: float = STEP_TAU) -> WheelTurns:
    """The wheel from rest, the water heaped at the top, nudged."""
    if not 0 < step_tau <= 0.05:
        raise ValueError("the step lies between 0 and 0.05 τ")
    if not 0 < duration_s <= MAX_DURATION_S:
        raise ValueError(f"a run lasts more than nothing and at most {MAX_DURATION_S:g} s")
    k = w.leak_per_s
    f = rhs(w)
    y: tuple[float, ...] = (NUDGE, 0.0, 0.0)
    steps = round(duration_s * k / step_tau)
    every = max(1, round(1 / (SAMPLES_PER_TAU * step_tau)))
    angle = 0.0
    out: dict[str, list[float]] = {key: [] for key in ("t", "x", "y", "z", "w", "n")}
    reversals: list[float] = []
    for i in range(steps + 1):
        tau = i * step_tau
        if i % every == 0:
            out["t"].append(tau / k)
            out["x"].append(y[0])
            out["y"].append(y[1])
            out["z"].append(y[2])
            out["w"].append(k * y[0])
            out["n"].append(angle / (2 * math.pi))
        if i < steps:
            nxt = rk4(f, tau, y, step_tau)
            # The angle by the trapezoid rule over the step, in radians: Ω·dt = x·dτ.
            angle += 0.5 * (y[0] + nxt[0]) * step_tau
            if (y[0] > 0 > nxt[0]) or (y[0] < 0 < nxt[0]):
                reversals.append((tau + step_tau * y[0] / (y[0] - nxt[0])) / k)
            y = nxt
    return WheelTurns(
        t=tuple(out["t"]),
        x=tuple(out["x"]),
        y=tuple(out["y"]),
        z=tuple(out["z"]),
        rate_rad_s=tuple(out["w"]),
        turns=tuple(out["n"]),
        reversals_s=tuple(reversals),
    )
