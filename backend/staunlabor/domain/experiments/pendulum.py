"""The pendulum: the block every swinging exhibit stands on.

A plane pendulum — a small bob on a light rod or string of length ``L`` — obeys

    θ'' = −(g/L)·sin θ − c·θ'

with ``c`` its damping per second. The exhibits built on it (the pendulum wave,
the harmonograph, the coupled pendulums, Galileo's interrupted pendulum) each
add something, and this module answers the pendulum itself in two ways, each
the other's check:

* **Exactly**, undamped and released from rest at ``θ₀``:
  ``sin(θ/2) = k·cd(ω₀·t | m)``, with ``k = sin(θ₀/2)``, ``m = k²``,
  ``ω₀ = √(g/L)`` and ``cd = cn/dn`` Jacobi's elliptic functions, computed by
  the arithmetic-geometric mean (Abramowitz & Stegun 16.4, the descending
  Landen transformation). The period is ``T = 4·K(m)/ω₀``, which grows with the
  swing: ``T₀·(1 + θ₀²/16 + 11·θ₀⁴/3072 + …)``. A page can ask for any instant
  without stepping to it — the pendulum wave's "a minute later" is one call.
* **Stepped**: :func:`rk4`, classical Runge–Kutta over any system of
  first-order equations at a fixed step, for what has no closed form: damping,
  a peg that shortens the string, a spring between two pendulums.
  ``tests/unit/test_experiments.py`` holds the two together.

Both are ported to ``frontend/src/features/experiments/simulate/pendulum.ts``
line for line and held to this module by ``engine-cases.json``.

What it is not: a pendulum with a heavy rod, a stretching string or air drag
that grows with the square of the speed. Damping here is linear, one number,
and where an exhibit needs more its module says so.
"""

from __future__ import annotations

import math
from collections.abc import Callable
from dataclasses import dataclass

#: Standard gravity.
G = 9.80665

#: The step the stepped pendulums take: 1 ms is a thousand steps a second, and
#: the shortest pendulum here swings in about half a second.
STEP_S = 1e-3

#: Samples a run returns per second, whatever its step.
SAMPLES_PER_S = 50

#: The longest run the engine takes, so a request cannot ask for an hour.
MAX_DURATION_S = 300.0

#: Where the AGM's sequences have met: a few units of the last place.
_AGM_TOLERANCE = 1e-15

Rhs = Callable[[float, tuple[float, ...]], tuple[float, ...]]


def agm(a: float, b: float) -> float:
    """The arithmetic-geometric mean of two positive numbers."""
    if not (a > 0 and b >= 0):
        raise ValueError("the AGM takes a positive and a non-negative number")
    while abs(a - b) > _AGM_TOLERANCE * a:
        a, b = (a + b) / 2, math.sqrt(a * b)
    return a


def ellipk(m: float) -> float:
    """``K(m)``, the complete elliptic integral of the first kind, parameter
    ``m = k²``: ``π / (2·agm(1, √(1 − m)))``."""
    if not 0 <= m < 1:
        raise ValueError("K(m) is finite for 0 ≤ m < 1")
    return math.pi / (2 * agm(1.0, math.sqrt(1 - m)))


def jacobi(u: float, m: float) -> tuple[float, float, float]:
    """``(sn, cn, dn)`` of ``u`` at parameter ``m`` (0 ≤ m ≤ 1), by the AGM:
    the sequences ``aₙ, bₙ, cₙ`` down to ``cₙ ≈ 0``, then
    ``φₙ = 2ⁿ·aₙ·u`` and back up by ``φₙ₋₁ = (φₙ + asin(cₙ/aₙ·sin φₙ))/2``.
    ``m = 0`` is the circle (sin, cos, 1), ``m = 1`` the hyperbola
    (tanh, sech, sech)."""
    if not 0 <= m <= 1:
        raise ValueError("the parameter lies between 0 and 1")
    if m == 0:
        return math.sin(u), math.cos(u), 1.0
    if m == 1:
        sech = 1 / math.cosh(u)
        return math.tanh(u), sech, sech
    a = [1.0]
    c = [math.sqrt(m)]
    b = math.sqrt(1 - m)
    while abs(c[-1]) > _AGM_TOLERANCE:
        an, bn = a[-1], b
        a.append((an + bn) / 2)
        c.append((an - bn) / 2)
        b = math.sqrt(an * bn)
    n = len(a) - 1
    phi = (2**n) * a[n] * u
    previous = phi
    for i in range(n, 0, -1):
        previous = phi
        phi = (phi + math.asin(c[i] / a[i] * math.sin(phi))) / 2
    sn, cn = math.sin(phi), math.cos(phi)
    # dn = cn(φ₀)/cos(φ₁ − φ₀); with no step taken (n = 0) the AGM had met at
    # once, which only m = 0 does, handled above.
    dn = cn / math.cos(previous - phi) if n > 0 else 1.0
    return sn, cn, dn


def natural_rate(length_m: float, g: float = G) -> float:
    """``ω₀ = √(g/L)``: the small swing's angular frequency, rad/s."""
    if not length_m > 0:
        raise ValueError("a pendulum needs a positive length")
    return math.sqrt(g / length_m)


def small_period_s(length_m: float, g: float = G) -> float:
    """``T₀ = 2π·√(L/g)``: the period of a swing too small to matter."""
    return 2 * math.pi / natural_rate(length_m, g)


def _modulus(amplitude_deg: float) -> float:
    if not 0 <= amplitude_deg < 180:
        raise ValueError("a swing's amplitude lies between 0° and 180°")
    return math.sin(math.radians(amplitude_deg) / 2)


def period_factor(amplitude_deg: float) -> float:
    """``T/T₀``: how much longer a swing of ``amplitude_deg`` each side takes than
    a small one, ``2·K(k²)/π`` — 1.0049 at 16°, 1.0174 at 30°, 1.1803 at 90°."""
    k = _modulus(amplitude_deg)
    return 1 / agm(1.0, math.sqrt(1 - k * k))


def period_s(length_m: float, amplitude_deg: float, g: float = G) -> float:
    """The exact period of a swing ``amplitude_deg`` each side of the bottom."""
    return small_period_s(length_m, g) * period_factor(amplitude_deg)


def length_for(period: float, amplitude_deg: float = 0.0, g: float = G) -> float:
    """The length whose swing of ``amplitude_deg`` takes ``period`` seconds: what
    a builder tunes a pendulum to, by the exact period rather than the small
    one."""
    if not period > 0:
        raise ValueError("a period is positive")
    small = period / period_factor(amplitude_deg)
    return g * (small / (2 * math.pi)) ** 2


def angle_deg(length_m: float, amplitude_deg: float, t: float, g: float = G) -> float:
    """Where a pendulum released from rest at ``amplitude_deg`` is ``t`` seconds
    later, exactly (undamped): ``θ = 2·asin(k·cn(u)/dn(u))``, ``u = ω₀·t`` taken
    modulo the period ``4K`` so that a minute in is as exact as a second."""
    k = _modulus(amplitude_deg)
    if k == 0:
        return 0.0
    m = k * k
    quarter = ellipk(m)
    u = math.fmod(natural_rate(length_m, g) * t, 4 * quarter)
    _, cn, dn = jacobi(u, m)
    return math.degrees(2 * math.asin(max(-1.0, min(1.0, k * cn / dn))))


def rk4(f: Rhs, t: float, y: tuple[float, ...], h: float) -> tuple[float, ...]:
    """One classical Runge–Kutta step of ``y' = f(t, y)``."""
    n = len(y)
    k1 = f(t, y)
    k2 = f(t + h / 2, tuple(y[i] + h / 2 * k1[i] for i in range(n)))
    k3 = f(t + h / 2, tuple(y[i] + h / 2 * k2[i] for i in range(n)))
    k4 = f(t + h, tuple(y[i] + h * k3[i] for i in range(n)))
    return tuple(y[i] + h / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]) for i in range(n))


def swing_rhs(length_m: float, damping_per_s: float = 0.0, g: float = G) -> Rhs:
    """``(θ, θ')' = (θ', −(g/L)·sin θ − c·θ')``: one pendulum as a system."""
    w2 = natural_rate(length_m, g) ** 2

    def f(_t: float, y: tuple[float, ...]) -> tuple[float, ...]:
        return (y[1], -w2 * math.sin(y[0]) - damping_per_s * y[1])

    return f


@dataclass(frozen=True)
class SwingRun:
    """A stepped pendulum: its angle and rate, sampled."""

    t: tuple[float, ...]
    angle_deg: tuple[float, ...]
    rate_deg_s: tuple[float, ...]


def _check_run(duration_s: float, step_s: float) -> None:
    if not 0 < step_s <= 0.01:
        raise ValueError("the step lies between 0 and 10 ms")
    if not 0 < duration_s <= MAX_DURATION_S:
        raise ValueError(f"a run lasts more than nothing and at most {MAX_DURATION_S:g} s")


def sample_every(step_s: float) -> int:
    """Steps between two samples: :data:`SAMPLES_PER_S` a second."""
    return max(1, round(1 / (SAMPLES_PER_S * step_s)))


def swing(
    length_m: float,
    amplitude_deg: float,
    duration_s: float,
    damping_per_s: float = 0.0,
    step_s: float = STEP_S,
    g: float = G,
) -> SwingRun:
    """One pendulum released from rest at ``amplitude_deg``, stepped by
    :func:`rk4` for ``duration_s``."""
    _check_run(duration_s, step_s)
    if damping_per_s < 0:
        raise ValueError("damping cannot be negative")
    _modulus(amplitude_deg)
    f = swing_rhs(length_m, damping_per_s, g)
    y: tuple[float, ...] = (math.radians(amplitude_deg), 0.0)
    steps = round(duration_s / step_s)
    every = sample_every(step_s)
    ts: list[float] = []
    angles: list[float] = []
    rates: list[float] = []
    for i in range(steps + 1):
        t = i * step_s
        if i % every == 0:
            ts.append(t)
            angles.append(math.degrees(y[0]))
            rates.append(math.degrees(y[1]))
        if i < steps:
            y = rk4(f, t, y, step_s)
    return SwingRun(t=tuple(ts), angle_deg=tuple(angles), rate_deg_s=tuple(rates))
