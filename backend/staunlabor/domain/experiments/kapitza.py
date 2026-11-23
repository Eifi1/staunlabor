"""Kapitza's pendulum: a stiff pendulum stands upside down while a motor shakes
its pivot up and down fast enough.

The exhibit is a light rod with a weight at its end on a pivot that a motor
shakes up and down by a centimetre, some forty times a second. Switched off,
the rod set upright falls over; shaken hard enough it stands upside down, and
nudged it wobbles back to the top.

**The model.** A point mass on a light rod of length ``l``; the pivot at
``y = a·cos ωt`` below its middle (``y`` downward, as Landau and Lifshitz
write it); ``θ`` the rod's angle from hanging straight down, so ``θ = π`` is
the top. In the pivot's frame the weight feels gravity and the pivot's
acceleration ``−a·ω²·cos ωt`` turned round, so

    θ'' = −(g + a·ω²·cos ωt)/l · sin θ − c·θ'

with ``c`` a linear damping for the bearing and the air. Stepped by the
shared Runge–Kutta (``numerics.rk4``) at a fixed share of the drive's period
(:func:`step_for`): a step of 1 ms would be a fortieth of a period at 40 Hz,
too coarse for the fast shaking that holds the rod up.

**Is the top stable?** Near ``θ = π`` the equation is linear with a periodic
coefficient (Mathieu's equation), and Floquet's theorem says what one period
does to every small deviation: it multiplies ``(φ, φ')`` by one fixed matrix,
the *monodromy matrix* ``M``. Its two eigenvalues, the Floquet multipliers,
decide: both of size below one (or on it, without damping), the deviation
stays small; one above, it grows period by period. :func:`monodromy` steps the
two columns ``(1, 0)`` and ``(0, 1)`` through one period; :func:`stable` reads
``|tr M| < 1 + det M``, which is both multipliers inside the unit circle
(``det M = e^(−cT)`` by Liouville's formula). :func:`least_frequency_hz`
halves its way to the lowest drive at which the top holds.

**Kapitza's bound.** Averaged over the fast shaking, the slow motion feels an
extra potential ``(a·ω·sin θ)²/4`` per unit mass, highest where the rod lies
flat and lowest at both ends: :func:`effective_potential`. The top is a
minimum of the sum once ``a²ω² > 2gl`` (:func:`kapitza_frequency_hz`), and the
rod then wobbles about the top at ``Ω² = a²ω²/(2l²) − g/l``
(:func:`slow_rate_top`). That is the first term of an expansion in ``a/l``:
the exact boundary from the multipliers lies higher by a factor of about
``1 + (7/32)(a/l)²``.

**What it leaves out.** The rod's own mass (a real rod is a physical pendulum:
its length here is the reduced length ``I/(m·d)``), a motor that slows under
the load, play in the pivot, air beyond the linear damping; and the upper
limit of the shaking, at about 0.45 of the length, past which the top is
unstable again: the amplitude is kept below :data:`MAX_SHARE` of the length.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from staunlabor.domain.experiments.constants import G
from staunlabor.domain.experiments.numerics import STEP_S, check_run, rk4, sample_every

#: The most the pivot may shake, as a share of the rod's length. Past about
#: 0.45 the top turns unstable again however fast the shaking (the upper
#: boundary of Mathieu's stable region); below this share the top, once
#: stable, stays so at every faster drive, which :func:`least_frequency_hz`
#: relies on.
MAX_SHARE = 0.3

#: Steps per period of the drive in the time loop, at least; never a step
#: longer than :data:`~staunlabor.domain.experiments.numerics.STEP_S`.
STEPS_PER_PERIOD = 100

#: Steps over the one period :func:`monodromy` follows: its multipliers are
#: then exact to some 10⁻¹¹, so the boundary they give is exact to 10⁻⁹,
#: far finer than the 2 · 10⁻⁵ by which Kapitza's bound misses it at a/l = 0.01.
FLOQUET_STEPS = 1000

#: Halvings of the bracket in :func:`least_frequency_hz`.
HALVINGS = 40


@dataclass(frozen=True)
class KapitzaPendulum:
    length_m: float = 0.2
    amplitude_m: float = 0.01
    frequency_hz: float = 40.0
    damping_per_s: float = 0.3

    def __post_init__(self) -> None:
        if not 0.05 <= self.length_m <= 2:
            raise ValueError("the rod is between 5 cm and 2 m long")
        if not 0 <= self.amplitude_m <= MAX_SHARE * self.length_m:
            raise ValueError(f"the pivot shakes by at most {MAX_SHARE:g} of the rod's length")
        if not 0 <= self.frequency_hz <= 200:
            raise ValueError("the motor runs at 0 to 200 Hz")
        if not 0 <= self.damping_per_s <= 5:
            raise ValueError("the damping lies between 0 and 5 per second")


def rate(k: KapitzaPendulum) -> float:
    """The drive's angular frequency ``ω``, rad/s."""
    return 2 * math.pi * k.frequency_hz


def pivot_m(k: KapitzaPendulum, t: float) -> float:
    """The pivot below its middle at ``t``, m: ``a·cos ωt``."""
    return k.amplitude_m * math.cos(rate(k) * t)


def rhs(k: KapitzaPendulum):
    """``(θ, θ')'``: the pendulum in its shaken pivot's frame."""
    length, a, w, c = k.length_m, k.amplitude_m, rate(k), k.damping_per_s

    def f(t: float, y: tuple[float, ...]) -> tuple[float, ...]:
        theta, omega = y
        return (omega, -(G + a * w * w * math.cos(w * t)) / length * math.sin(theta) - c * omega)

    return f


def step_for(k: KapitzaPendulum) -> float:
    """The time loop's step: the drive's period in :data:`STEPS_PER_PERIOD`
    equal parts or more, so that no step is longer than 1 ms; 1 ms with the
    motor off. A whole number of steps a period keeps the drive's phase on the
    same steps every period."""
    if k.frequency_hz == 0:
        return STEP_S
    period = 1 / k.frequency_hz
    return period / max(STEPS_PER_PERIOD, math.ceil(period / STEP_S))


def start_state(start_deg: float) -> tuple[float, float]:
    if not -180 <= start_deg <= 180:
        raise ValueError("the rod starts between −180° and 180°")
    return (math.radians(start_deg), 0.0)


def _linear(length_m: float, amplitude_m: float, frequency_hz: float, damping_per_s: float, at: str):
    """The equation for a small deviation from hanging (``bottom``) or from
    upright (``top``): ``sin θ`` taken as ``±φ``."""
    if at not in ("top", "bottom"):
        raise ValueError("the rod rests at the top or the bottom")
    sign = 1.0 if at == "top" else -1.0
    a, w, c = amplitude_m, 2 * math.pi * frequency_hz, damping_per_s

    def f(t: float, y: tuple[float, ...]) -> tuple[float, ...]:
        # Both columns of the fundamental matrix at once: (φ₁, φ₁', φ₂, φ₂').
        s = sign * (G + a * w * w * math.cos(w * t)) / length_m
        return (y[1], s * y[0] - c * y[1], y[3], s * y[2] - c * y[3])

    return f


def _monodromy(
    length_m: float, amplitude_m: float, frequency_hz: float, damping_per_s: float, at: str
) -> tuple[tuple[float, float], tuple[float, float]]:
    """:func:`monodromy` over plain numbers, so the halving in
    :func:`least_frequency_hz` may look past the motor's 200 Hz."""
    if frequency_hz <= 0:
        raise ValueError("without the motor there is no period")
    f = _linear(length_m, amplitude_m, frequency_hz, damping_per_s, at)
    h = 1 / frequency_hz / FLOQUET_STEPS
    y: tuple[float, ...] = (1.0, 0.0, 0.0, 1.0)
    for i in range(FLOQUET_STEPS):
        y = rk4(f, i * h, y, h)
    return ((y[0], y[2]), (y[1], y[3]))


def _trace_det(m: tuple[tuple[float, float], tuple[float, float]]) -> tuple[float, float]:
    (m11, m12), (m21, m22) = m
    return m11 + m22, m11 * m22 - m12 * m21


def monodromy(k: KapitzaPendulum, at: str = "top") -> tuple[tuple[float, float], tuple[float, float]]:
    """``M``: what one period of the drive does to a small deviation
    ``(φ, φ')`` from the top or the bottom, its columns stepped from
    ``(1, 0)`` and ``(0, 1)`` in :data:`FLOQUET_STEPS` steps."""
    return _monodromy(k.length_m, k.amplitude_m, k.frequency_hz, k.damping_per_s, at)


def multipliers(k: KapitzaPendulum, at: str = "top") -> tuple[float, float]:
    """The sizes of the two Floquet multipliers, larger first: the eigenvalues
    of :func:`monodromy`, from its trace and determinant."""
    tr, det = _trace_det(monodromy(k, at))
    disc = tr * tr - 4 * det
    if disc < 0:
        # A complex pair, conjugate: both of size √det.
        size = math.sqrt(det)
        return (size, size)
    root = math.sqrt(disc)
    big, small = abs((tr + root) / 2), abs((tr - root) / 2)
    return (max(big, small), min(big, small))


def _holds(tr: float, det: float) -> bool:
    """Both multipliers inside the unit circle (on it, without damping, where
    ``det M = 1``): ``|tr M| < 1 + det M``."""
    return abs(tr) < 1 + det


def stable(k: KapitzaPendulum, at: str = "top") -> bool:
    """Whether a small deviation from the top (or the bottom) stays small.
    With the motor off, or nothing to shake, the bottom is stable and the top
    is not."""
    if k.frequency_hz == 0 or k.amplitude_m == 0:
        return at == "bottom"
    return _holds(*_trace_det(monodromy(k, at)))


def kapitza_frequency_hz(k: KapitzaPendulum) -> float | None:
    """Kapitza's least frequency for the top, ``a·ω = √(2gl)``, Hz; ``None``
    without shaking."""
    if k.amplitude_m == 0:
        return None
    return math.sqrt(2 * G * k.length_m) / k.amplitude_m / (2 * math.pi)


def least_frequency_hz(k: KapitzaPendulum) -> float | None:
    """The lowest drive at which the top holds, Hz, by the multipliers: the
    bracket from half to twice Kapitza's frequency halved :data:`HALVINGS`
    times. ``None`` without shaking."""
    kapitza = kapitza_frequency_hz(k)
    if kapitza is None:
        return None

    def holds(f_hz: float) -> bool:
        return _holds(*_trace_det(_monodromy(k.length_m, k.amplitude_m, f_hz, k.damping_per_s, "top")))

    lo, hi = 0.5 * kapitza, 2.0 * kapitza
    if holds(lo) or not holds(hi):
        raise ValueError("the boundary lies outside half to twice Kapitza's frequency")
    for _ in range(HALVINGS):
        mid = (lo + hi) / 2
        if holds(mid):
            hi = mid
        else:
            lo = mid
    return (lo + hi) / 2


def own_frequency_hz(k: KapitzaPendulum) -> float:
    """The pendulum's own small swing with the motor off, Hz: ``√(g/l)/2π``."""
    return math.sqrt(G / k.length_m) / (2 * math.pi)


def swing_up_band_hz(k: KapitzaPendulum) -> tuple[float, float] | None:
    """The drives at which the hanging rod swings itself up, Hz: parametric
    resonance about twice its own frequency, where the bottom's multipliers
    leave the unit circle. Each edge by :data:`HALVINGS` halvings, the lower
    between 0.6 and 1 times twice the own frequency, the upper between 1 and
    2 times. ``None`` without shaking, or where the damping holds the rod at
    twice its own frequency itself."""
    if k.amplitude_m == 0:
        return None
    twice = 2 * own_frequency_hz(k)

    def holds(f_hz: float) -> bool:
        return _holds(*_trace_det(_monodromy(k.length_m, k.amplitude_m, f_hz, k.damping_per_s, "bottom")))

    if holds(twice):
        return None
    edges = []
    for lo, hi in ((0.6 * twice, twice), (2 * twice, twice)):
        # ``lo`` holds, ``hi`` swings up.
        if not holds(lo):
            raise ValueError("the band reaches beyond its bracket")
        for _ in range(HALVINGS):
            mid = (lo + hi) / 2
            if holds(mid):
                lo = mid
            else:
                hi = mid
        edges.append((lo + hi) / 2)
    return (edges[0], edges[1])


def slow_rate_top(k: KapitzaPendulum) -> float | None:
    """Kapitza's rate of the slow wobble about the top, rad/s:
    ``Ω² = a²ω²/(2l²) − g/l``; ``None`` where the top does not hold."""
    square = (k.amplitude_m * rate(k)) ** 2 / (2 * k.length_m**2) - G / k.length_m
    return math.sqrt(square) if square > 0 else None


def slow_rate_bottom(k: KapitzaPendulum) -> float:
    """Kapitza's rate of the slow swing about the bottom, rad/s:
    ``Ω² = a²ω²/(2l²) + g/l``."""
    return math.sqrt((k.amplitude_m * rate(k)) ** 2 / (2 * k.length_m**2) + G / k.length_m)


def floquet_rate_top(k: KapitzaPendulum) -> float | None:
    """The slow wobble's rate about the top from the multipliers, rad/s:
    ``cos(ν·T) = tr M/(2·√det M)``, the exact counterpart of
    :func:`slow_rate_top`. ``None`` where the top does not hold."""
    if not stable(k, "top"):
        return None
    tr, det = _trace_det(monodromy(k, "top"))
    return math.acos(max(-1.0, min(1.0, tr / (2 * math.sqrt(det))))) * k.frequency_hz


def effective_potential(k: KapitzaPendulum, theta_rad: float) -> float:
    """Kapitza's potential per unit mass of the slow motion, J/kg: gravity's
    ``−g·l·cos θ`` and the shaking's ``(a·ω·sin θ)²/4``."""
    return -G * k.length_m * math.cos(theta_rad) + (k.amplitude_m * rate(k) * math.sin(theta_rad)) ** 2 / 4


@dataclass(frozen=True)
class KapitzaRun:
    t: tuple[float, ...]
    theta_deg: tuple[float, ...]
    pivot_m: tuple[float, ...]


def run(k: KapitzaPendulum, start_deg: float, duration_s: float, step_s: float | None = None) -> KapitzaRun:
    """The rod let go at rest from ``start_deg`` (180° is the top), stepped by
    :func:`step_for` unless a step is given; sampled 50 times a second."""
    step_s = step_for(k) if step_s is None else step_s
    check_run(duration_s, step_s)
    f = rhs(k)
    y: tuple[float, ...] = start_state(start_deg)
    steps = round(duration_s / step_s)
    every = sample_every(step_s)
    ts: list[float] = []
    thetas: list[float] = []
    pivots: list[float] = []
    for i in range(steps + 1):
        t = i * step_s
        if i % every == 0:
            ts.append(t)
            thetas.append(math.degrees(y[0]))
            pivots.append(pivot_m(k, t))
        if i < steps:
            y = rk4(f, t, y, step_s)
    return KapitzaRun(t=tuple(ts), theta_deg=tuple(thetas), pivot_m=tuple(pivots))
