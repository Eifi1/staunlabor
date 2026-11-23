"""Linear time-invariant systems: transfer functions, their frequency response
and poles, and the closed form of the second-order step every later lesson
returns to.

A transfer function is two polynomials, highest power first, the way they are
written on paper: ``K/(τs + 1)`` is ``Tf((K,), (τ, 1))``. Chaining two blocks is
multiplying them (:func:`series`), which is the whole of the Laplace lesson's
first claim; the frequency response is the function evaluated at ``s = jω``.

There is no Bode plot of a whole transfer function here, and so no phase
unwrapping: ``atan2`` folds every phase into ±180°, and a PT2 behind a PT1 would
jump from −180° to +180° where it should carry on to −200°. The chain lesson
sums each block's phase on its own continuous branch instead
(``frequency._block_phase``), which needs none, and a dead time's ``−ωT`` is one
more such term. The first-order step's closed form is written where it is drawn
(:mod:`.first_order`, :mod:`.frequency`), each with the initial value its lesson
starts from.

What it does not do: MIMO, discrete-time systems, or algebra on the polynomials
beyond the product — none of the lessons asks for a sum of two blocks.
"""

from __future__ import annotations

import cmath
import math
from collections.abc import Sequence
from dataclasses import dataclass
from enum import StrEnum

from staunlabor.domain.course.linalg import eigenvalues


@dataclass(frozen=True)
class Tf:
    """``num(s)/den(s)``, coefficients highest power first."""

    num: tuple[float, ...]
    den: tuple[float, ...]

    def __post_init__(self) -> None:
        if not self.den or all(c == 0 for c in self.den):
            raise ValueError("A transfer function needs a non-zero denominator.")


def _polymul(a: Sequence[float], b: Sequence[float]) -> tuple[float, ...]:
    out = [0.0] * (len(a) + len(b) - 1)
    for i, x in enumerate(a):
        for j, y in enumerate(b):
            out[i + j] += x * y
    return tuple(out)


def _polyval(p: Sequence[float], s: complex) -> complex:
    acc = 0j
    for c in p:
        acc = acc * s + c
    return acc


def series(*blocks: Tf) -> Tf:
    """Blocks one after the other: the product of their transfer functions."""
    num: tuple[float, ...] = (1.0,)
    den: tuple[float, ...] = (1.0,)
    for g in blocks:
        num = _polymul(num, g.num)
        den = _polymul(den, g.den)
    return Tf(num, den)


def response(g: Tf, w: float) -> complex:
    """``G(jω)`` at an angular frequency ``ω`` in rad/s."""
    return _polyval(g.num, 1j * w) / _polyval(g.den, 1j * w)


def static_gain(g: Tf) -> float:
    """``G(0)`` — the final value of the step response of a stable ``G``.
    Infinite for a block with an integrator, which has none."""
    den0 = g.den[-1]
    if den0 == 0:
        return math.inf
    return g.num[-1] / den0


def roots(poly: Sequence[float]) -> list[complex]:
    """The roots of a real polynomial, as the eigenvalues of its companion
    matrix — the same QR iteration the chains use, so a 2×2 lesson and a
    four-mass rig are answered by one method."""
    p = list(poly)
    while p and p[0] == 0:
        p.pop(0)
    if len(p) <= 1:
        return []
    lead = p[0]
    coeffs = [c / lead for c in p[1:]]
    n = len(coeffs)
    companion = [[0.0] * n for _ in range(n)]
    for j in range(n):
        companion[0][j] = -coeffs[j]
    for i in range(1, n):
        companion[i][i - 1] = 1.0
    return eigenvalues(companion)


def logspace(lo: float, hi: float, n: int) -> list[float]:
    """``n`` points from ``lo`` to ``hi``, evenly spaced in the logarithm."""
    if not 0 < lo < hi or n < 2:
        raise ValueError("A logarithmic grid needs 0 < lo < hi and at least two points.")
    a, b = math.log10(lo), math.log10(hi)
    return [10 ** (a + (b - a) * k / (n - 1)) for k in range(n)]


def linspace(lo: float, hi: float, n: int) -> list[float]:
    if n < 2:
        raise ValueError("A grid needs at least two points.")
    return [lo + (hi - lo) * k / (n - 1) for k in range(n)]


# ── the second-order shape ───────────────────────────────────────────────────


class Regime(StrEnum):
    """Which of the three solutions a second-order system's step response is."""

    underdamped = "underdamped"
    critical = "critical"
    overdamped = "overdamped"


#: How close to one a damping ratio counts as critical. Not a tolerance on the
#: arithmetic — each branch is exact on its own side — but the width of the band
#: in which the two neighbouring formulas lose digits to a near-cancellation.
_CRITICAL_BAND = 1e-6


def regime(damping: float) -> Regime:
    """By the size of ``D``: a negative damping ratio (a pole pair in the right
    half-plane, which the eigenvalue lesson drags its poles into) has the same
    three shapes, growing instead of decaying."""
    if abs(abs(damping) - 1) < _CRITICAL_BAND:
        return Regime.critical
    return Regime.underdamped if abs(damping) < 1 else Regime.overdamped


def step_pt1(t: float, tau: float, start: float, final: float) -> float:
    """``τ·ẏ + y = final`` from ``start``: ``final + (start − final)·e^(−t/τ)``,
    the first-order step every lesson that has one draws."""
    return final + (start - final) * math.exp(-t / tau)


def free_decay(t: float, x0: float, sigma: float, wd: float) -> float:
    """An underdamped second-order system let go from ``x0`` at rest:
    ``x0·e^(−σt)·(cos ω_d t + σ/ω_d·sin ω_d t)``, with ``σ = Dω₀`` and
    ``ω_d = ω₀√(1 − D²)``. The step response is ``K·(1 − free_decay(t, 1, …))``."""
    return x0 * math.exp(-sigma * t) * (math.cos(wd * t) + sigma / wd * math.sin(wd * t))


def lowpass(values: list[float], a: float) -> list[float]:
    """A first-order low-pass sampled exactly for an input held over each step,
    ``y ← a·y + (1 − a)·u`` with ``a = e^(−h/τ)``, starting at the first value so
    it begins settled. The caller computes ``a`` from its own ``τ`` or corner
    frequency, so each keeps its own arithmetic to the last bit."""
    out = []
    y = values[0]
    for u in values:
        y = a * y + (1 - a) * u
        out.append(y)
    return out


def step_pt2(t: float, gain: float, w0: float, damping: float) -> float:
    """``ÿ + 2Dω₀ẏ + ω₀²y = K·ω₀²·u`` from rest after a unit step, in each of
    the three cases. ``D = 0`` is the undamped oscillation about ``K``; a
    negative ``D`` is allowed because the eigenvalue lesson shows what an
    unstable pair does, and the formulas hold on that side too."""
    if w0 <= 0:
        raise ValueError("A natural frequency must be positive.")
    if t < 0:
        return 0.0
    kind = regime(damping)
    if kind is Regime.critical:
        p = -math.copysign(1.0, damping) * w0
        return gain * (1 - (1 - p * t) * math.exp(p * t))
    if kind is Regime.underdamped:
        wd = w0 * math.sqrt(1 - damping * damping)
        sigma = damping * w0
        return gain * (1 - free_decay(t, 1.0, sigma, wd))
    q = w0 * math.sqrt(damping * damping - 1)
    s1 = -damping * w0 + q
    s2 = -damping * w0 - q
    return gain * (1 + (s2 * math.exp(s1 * t) - s1 * math.exp(s2 * t)) / (s1 - s2))


@dataclass(frozen=True)
class SecondOrderFigures:
    """What a second-order step response is read for.

    ``overshoot`` is a fraction of the final value and ``peak_time_s``
    ``π/ω_d``; both are ``None`` where there is no overshoot (``D ≥ 1``).
    ``settling_time_s`` is the envelope's ``4/(Dω₀)`` — the time to within
    about 2 % — and ``None`` for an undamped one, which never settles. For an
    overdamped one it is the slow pole's ``4/|s₁|``, the honest generalisation
    rather than a formula from the other side of ``D = 1``.
    """

    w0: float
    f0_hz: float
    damping: float
    regime: Regime
    damped_w: float | None
    overshoot: float | None
    peak_time_s: float | None
    settling_time_s: float | None
    poles: tuple[complex, complex]


def second_order_poles(w0: float, damping: float) -> tuple[complex, complex]:
    """``λ₁,₂ = ω₀·(−D ± √(D² − 1))``, the pair with the positive imaginary part
    first."""
    root = cmath.sqrt(damping * damping - 1)
    a = w0 * (-damping + root)
    b = w0 * (-damping - root)
    return (a, b) if a.imag >= b.imag else (b, a)


def second_order_figures(w0: float, damping: float) -> SecondOrderFigures:
    if w0 <= 0:
        raise ValueError("A natural frequency must be positive.")
    if damping < 0:
        raise ValueError("A damping ratio cannot be negative.")
    kind = regime(damping)
    wd = overshoot = peak = None
    if kind is Regime.underdamped:
        wd = w0 * math.sqrt(1 - damping * damping)
        overshoot = math.exp(-math.pi * damping / math.sqrt(1 - damping * damping))
        peak = math.pi / wd
    if damping == 0:
        settle = None
    elif kind is Regime.overdamped:
        slow = w0 * (damping - math.sqrt(damping * damping - 1))
        settle = 4 / slow
    else:
        settle = 4 / (damping * w0)
    return SecondOrderFigures(
        w0=w0,
        f0_hz=w0 / (2 * math.pi),
        damping=damping,
        regime=kind,
        damped_w=wd,
        overshoot=overshoot,
        peak_time_s=peak,
        settling_time_s=settle,
        poles=second_order_poles(w0, damping),
    )


def magnification(eta: float, damping: float) -> float:
    """``V(η) = 1/√((1 − η²)² + (2Dη)²)``: how much more a spring-mass system
    moves than its static deflection, at ``η = f/f₀``."""
    den = math.hypot(1 - eta * eta, 2 * damping * eta)
    return math.inf if den == 0 else 1 / den


def log_decrement(x_n: float, x_next: float) -> tuple[float, float]:
    """``Λ = ln(xₙ/xₙ₊₁)`` and the damping ratio it says, ``D = Λ/√(4π² + Λ²)``
    — from two successive maxima of a decay, the one measurement that needs
    neither the mass nor the stiffness."""
    if x_n <= 0 or x_next <= 0:
        raise ValueError("Two successive maxima must both be positive.")
    lam = math.log(x_n / x_next)
    return lam, lam / math.sqrt(4 * math.pi**2 + lam * lam)
