"""Resonance: of six rods on a trembling table, only the one in step swings.

The exhibit is a row of upright steel rods of different lengths, clamped in a
table that a motor shakes a little from side to side. At one beat one rod
swings wide while the others hardly stir; a little faster, and another takes
over.

**The model.** Each rod is a cantilever, clamped at the table and free at the
top, and only its first mode is kept: the clamped-free beam's shape ``φ``, 1 at
the tip, at ``f₁ = β₁²/(2π·L²)·√(E·I/(ρ·A))``, ``β₁`` the first root of
``cosh β·cos β = −1`` (1.8751). The table moves ``y_b = Y·sin θ``, ``θ̇ = Ω``;
in the table's frame its acceleration loads the rod along its length, and the
mode answers with the participation ``Γ = ∫φ / ∫φ²`` (1.566):
``q̈ + 2ζω·q̇ + ω²·q = −Γ·ÿ_b``, ``q`` the tip's swing against the table. The
damping is a ratio ``ζ``, the clamp's and the air's together. Stepped by
Runge–Kutta, a millisecond at a time, the drive's frequency held through each
step: a sweep changes it between steps, and the term of its change is a few
thousandths of the rest at the page's slowest.

**Why only one.** Steadily driven, the tip swings
``Γ·r²·Y / √((1 − r²)² + (2ζ·r)²)``, ``r = Ω/ω``: about ``Γ·Y/(2ζ)`` in step,
some ten times less a few per cent away. And it takes its time: from rest a
swing grows to ``1 − 1/e`` of its steady width in ``1/(ζ·ω)``.

**What it leaves out.** The higher modes (the second at 6.27 times the
first), the rod's stiffening at wide swings, the table's give.
"""

from __future__ import annotations

import math
from dataclasses import dataclass


def _first_root() -> float:
    """β₁: the first root of cosh β·cos β + 1, by bisection."""
    lo, hi = 1.5, 2.2
    for _ in range(80):
        mid = (lo + hi) / 2
        if (math.cosh(lo) * math.cos(lo) + 1) * (math.cosh(mid) * math.cos(mid) + 1) <= 0:
            hi = mid
        else:
            lo = mid
    return (lo + hi) / 2


BETA1 = _first_root()
_SIGMA = (math.cosh(BETA1) + math.cos(BETA1)) / (math.sinh(BETA1) + math.sin(BETA1))


def _raw_shape(xi: float) -> float:
    b = BETA1 * xi
    return math.cosh(b) - math.cos(b) - _SIGMA * (math.sinh(b) - math.sin(b))


_TIP = _raw_shape(1.0)


def shape(xi: float) -> float:
    """The first mode's deflection at ``xi = x/L`` from the clamp, 1 at the tip."""
    return _raw_shape(xi) / _TIP


def _participation() -> float:
    """Γ = ∫φ / ∫φ², by Simpson's rule over 400 strips."""
    n = 400
    over = squared = 0.0
    for i in range(n + 1):
        w = 1 if i in (0, n) else 4 if i % 2 else 2
        p = shape(i / n)
        over += w * p
        squared += w * p * p
    return over / squared


GAMMA = _participation()

STEP_S = 1e-3

#: Samples a run returns per second.
SAMPLES_PER_S = 50

#: The longest run.
MAX_S = 300.0


@dataclass(frozen=True)
class Rack:
    #: The rods, longest first.
    lengths_m: tuple[float, ...] = (1.0, 0.9, 0.8, 0.7, 0.6, 0.5)
    diameter_m: float = 0.002
    youngs_gpa: float = 200.0
    density_kg_m3: float = 7850.0
    #: ζ: the share of critical damping, the clamp's and the air's together.
    damping_ratio: float = 0.01
    #: Y: how far the table moves each way.
    table_m: float = 0.001

    def __post_init__(self) -> None:
        if not 1 <= len(self.lengths_m) <= 8:
            raise ValueError("a rack holds between one and eight rods")
        if not all(0.1 <= length <= 2 for length in self.lengths_m):
            raise ValueError("a rod is between 10 cm and 2 m long")
        if not 0.0005 <= self.diameter_m <= 0.02:
            raise ValueError("a rod is between 0.5 mm and 2 cm thick")
        if not 1 <= self.youngs_gpa <= 500:
            raise ValueError("Young's modulus lies between 1 and 500 GPa")
        if not 0.0005 <= self.damping_ratio <= 0.5:
            raise ValueError("the damping ratio lies between 0.0005 and 0.5")
        if not 0 < self.table_m <= 0.01:
            raise ValueError("the table moves more than nothing and at most 1 cm each way")


def natural_hz(rack: Rack, length_m: float) -> float:
    """f₁ of a round rod: ``E·I/(ρ·A) = E·d²/(16·ρ)``."""
    wave = math.sqrt(rack.youngs_gpa * 1e9 / rack.density_kg_m3) * rack.diameter_m / 4
    return BETA1**2 / (2 * math.pi * length_m**2) * wave


def steady_m(rack: Rack, length_m: float, drive_hz: float) -> float:
    """The tip's steady swing against the table, each way."""
    r = drive_hz / natural_hz(rack, length_m)
    return GAMMA * r * r * rack.table_m / math.sqrt((1 - r * r) ** 2 + (2 * rack.damping_ratio * r) ** 2)


@dataclass(frozen=True)
class Shaking:
    t: float
    #: θ: the table's phase.
    theta: float
    #: Each rod's tip, against the table, and its speed.
    q: tuple[float, ...]
    v: tuple[float, ...]


def start(rack: Rack) -> Shaking:
    n = len(rack.lengths_m)
    return Shaking(t=0.0, theta=0.0, q=(0.0,) * n, v=(0.0,) * n)


def _rates(
    rack: Rack, omegas: list[float], drive: float, theta: float, q: list[float], v: list[float]
) -> tuple[float, list[float], list[float]]:
    # The table's acceleration, −Ω²·Y·sin θ, felt by the rod as −Γ times it.
    push = GAMMA * drive * drive * rack.table_m * math.sin(theta)
    z = rack.damping_ratio
    acc = [push - 2 * z * w * vi - w * w * qi for w, qi, vi in zip(omegas, q, v, strict=True)]
    return drive, v, acc


def step(rack: Rack, s: Shaking, drive_hz: float) -> Shaking:
    """One millisecond, the drive held at ``drive_hz``."""
    omegas = [2 * math.pi * natural_hz(rack, length) for length in rack.lengths_m]
    drive = 2 * math.pi * drive_hz
    h = STEP_S
    q0, v0 = list(s.q), list(s.v)
    d1, q1, a1 = _rates(rack, omegas, drive, s.theta, q0, v0)
    d2, q2, a2 = _rates(
        rack,
        omegas,
        drive,
        s.theta + h / 2 * d1,
        [q + h / 2 * dq for q, dq in zip(q0, q1, strict=True)],
        [v + h / 2 * dv for v, dv in zip(v0, a1, strict=True)],
    )
    d3, q3, a3 = _rates(
        rack,
        omegas,
        drive,
        s.theta + h / 2 * d2,
        [q + h / 2 * dq for q, dq in zip(q0, q2, strict=True)],
        [v + h / 2 * dv for v, dv in zip(v0, a2, strict=True)],
    )
    d4, q4, a4 = _rates(
        rack,
        omegas,
        drive,
        s.theta + h * d3,
        [q + h * dq for q, dq in zip(q0, q3, strict=True)],
        [v + h * dv for v, dv in zip(v0, a3, strict=True)],
    )
    n = len(q0)
    return Shaking(
        t=s.t + h,
        theta=s.theta + h / 6 * (d1 + 2 * d2 + 2 * d3 + d4),
        q=tuple(q0[i] + h / 6 * (q1[i] + 2 * q2[i] + 2 * q3[i] + q4[i]) for i in range(n)),
        v=tuple(v0[i] + h / 6 * (a1[i] + 2 * a2[i] + 2 * a3[i] + a4[i]) for i in range(n)),
    )


def swing_m(s: Shaking, rod: int, drive_hz: float) -> float:
    """The width of a rod's swing now: its tip's place and speed taken together
    at the drive's frequency, ``√(q² + (v/Ω)²)``, which a steady swing keeps
    exactly. Taken at the rod's own frequency, as it first was, it measured a
    rod driven well above its tone up to 4.6 times as wide as it swings."""
    return math.hypot(s.q[rod], s.v[rod] / (2 * math.pi * drive_hz))


@dataclass(frozen=True)
class ShakeRun:
    t: tuple[float, ...]
    drive_hz: tuple[float, ...]
    #: Each rod's tip against the table, m, one tuple per rod.
    tips_m: tuple[tuple[float, ...], ...]


def run(rack: Rack, drive_hz: float, duration_s: float, sweep_hz_per_s: float = 0.0) -> ShakeRun:
    """From rest, the table at ``drive_hz`` and that moving ``sweep_hz_per_s``
    a second."""
    if not 0 < duration_s <= MAX_S:
        raise ValueError(f"a run lasts more than nothing and at most {MAX_S:g} s")
    if not 0 < drive_hz <= 50 or not 0 < drive_hz + sweep_hz_per_s * duration_s <= 50:
        raise ValueError("the table shakes between 0 and 50 times a second")
    s = start(rack)
    steps = round(duration_s / STEP_S)
    every = max(1, round(1 / (SAMPLES_PER_S * STEP_S)))
    ts: list[float] = []
    drives: list[float] = []
    tips: list[list[float]] = [[] for _ in rack.lengths_m]
    for i in range(steps + 1):
        f = drive_hz + sweep_hz_per_s * i * STEP_S
        if i % every == 0:
            ts.append(s.t)
            drives.append(f)
            for rod, q in enumerate(s.q):
                tips[rod].append(q)
        if i < steps:
            s = step(rack, s, f)
    return ShakeRun(t=tuple(ts), drive_hz=tuple(drives), tips_m=tuple(tuple(tip) for tip in tips))
