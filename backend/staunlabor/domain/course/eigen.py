"""Lesson 3: eigenvalues as a decay rate and a frequency, eigenvectors as the
directions a system moves in without turning.

Three steps up. ``ẋ = a·x`` has one eigenvalue, ``a`` itself, and the whole
lesson is already in it: negative decays, positive grows. A second-order system
has a pair, ``λ = σ ± jω``, and the pair *is* the step response — ``σ`` the
envelope, ``ω`` the ringing — which is why the page draws the two side by side
and lets the reader drag the poles. And a general 2×2 matrix shows what the
eigenvectors are for: a trajectory that starts on one stays on it.

The 2×2 trajectories are computed from the closed-form matrix exponential, not
integrated: a centre drawn by an integrator spirals in or out by the method's
own error, and on this page that would look like physics.

What it does not do: matrices larger than 2×2 (the two-mass lesson's chain has those),
or repeated eigenvalues with a single eigenvector drawn as anything but a line.
"""

from __future__ import annotations

import cmath
import math
from dataclasses import dataclass
from enum import StrEnum

from staunlabor.domain.course.lti import Regime, linspace, regime, second_order_poles, step_pt2

CURVE_POINTS = 301
#: The pole lesson's fixed window, so a dragged pole changes the curve and not
#: the axis under it.
POLE_WINDOW_S = 0.5
#: The scalar lesson's fixed window, for the same reason.
SCALAR_WINDOW_S = 3.0
TRAJECTORIES = 12
TRAJECTORY_POINTS = 160
#: Half the width of the square the phase portrait is drawn in; a trajectory
#: that leaves it is cut where it leaves.
PORTRAIT_BOX = 3.0


@dataclass(frozen=True)
class ScalarGrowth:
    """``x(t) = e^{at}`` from ``x(0) = 1``. ``time_constant_s`` is ``−1/a`` for a
    decay and ``doubling_time_s`` is ``ln 2/a`` for a growth; the other is
    ``None``, and both are for ``a = 0``, which neither decays nor grows."""

    rate: float
    time_s: tuple[float, ...]
    value: tuple[float, ...]
    stable: bool
    time_constant_s: float | None
    doubling_time_s: float | None


def scalar_growth(rate: float) -> ScalarGrowth:
    ts = linspace(0.0, SCALAR_WINDOW_S, CURVE_POINTS)
    return ScalarGrowth(
        rate=rate,
        time_s=tuple(ts),
        value=tuple(math.exp(rate * t) for t in ts),
        stable=rate < 0,
        time_constant_s=-1 / rate if rate < 0 else None,
        doubling_time_s=math.log(2) / rate if rate > 0 else None,
    )


@dataclass(frozen=True)
class PolePair:
    """A second-order system seen as its two poles and its step response.

    ``envelope_upper``/``envelope_lower`` are ``1 ± e^{σt}/√(1 − D²)`` while the
    pair is complex, the curve's own bounds, and empty for two real poles.
    ``overshoot`` is a fraction, ``None`` unless the pair is complex and stable.
    """

    f0_hz: float
    damping: float
    poles: tuple[complex, complex]
    real_part: float
    imag_hz: float
    stable: bool
    regime: Regime
    overshoot: float | None
    time_s: tuple[float, ...]
    value: tuple[float, ...]
    envelope_upper: tuple[float, ...]
    envelope_lower: tuple[float, ...]


def pole_pair(f0_hz: float, damping: float) -> PolePair:
    if f0_hz <= 0:
        raise ValueError("A natural frequency must be positive.")
    w0 = 2 * math.pi * f0_hz
    p1, p2 = second_order_poles(w0, damping)
    kind = regime(damping)
    ts = linspace(0.0, POLE_WINDOW_S, CURVE_POINTS)
    upper: tuple[float, ...] = ()
    lower: tuple[float, ...] = ()
    if kind is Regime.underdamped:
        k = 1 / math.sqrt(1 - damping * damping)
        upper = tuple(1 + k * math.exp(p1.real * t) for t in ts)
        lower = tuple(1 - k * math.exp(p1.real * t) for t in ts)
    overshoot = None
    if kind is Regime.underdamped and damping > 0:
        overshoot = math.exp(-math.pi * damping / math.sqrt(1 - damping * damping))
    return PolePair(
        f0_hz=f0_hz,
        damping=damping,
        poles=(p1, p2),
        real_part=p1.real,
        imag_hz=abs(p1.imag) / (2 * math.pi),
        stable=max(p1.real, p2.real) < 0,
        regime=kind,
        overshoot=overshoot,
        time_s=tuple(ts),
        value=tuple(step_pt2(t, 1.0, w0, damping) for t in ts),
        envelope_upper=upper,
        envelope_lower=lower,
    )


def pole_from(real: float, imag: float) -> tuple[float, float]:
    """The ``(f₀, D)`` of the pair a dragged pole belongs to: ``ω₀ = |λ|`` and
    ``D = −Re(λ)/|λ|``."""
    w0 = math.hypot(real, imag)
    if w0 == 0:
        raise ValueError("A pole at the origin has no natural frequency.")
    return w0 / (2 * math.pi), -real / w0


class PortraitKind(StrEnum):
    """What a 2×2 linear system's origin is."""

    saddle = "saddle"
    stable_node = "stable_node"
    unstable_node = "unstable_node"
    stable_focus = "stable_focus"
    unstable_focus = "unstable_focus"
    centre = "centre"
    degenerate = "degenerate"


@dataclass(frozen=True)
class Trajectory:
    x1: tuple[float, ...]
    x2: tuple[float, ...]


@dataclass(frozen=True)
class Eigenvector:
    """A real eigenvector, unit length, and its eigenvalue."""

    eigenvalue: float
    x1: float
    x2: float


@dataclass(frozen=True)
class MatrixPortrait:
    """A 2×2 system's eigenvalues, its real eigenvectors (none for a complex
    pair), what kind of point the origin is, and twelve trajectories started on
    the unit circle."""

    matrix: tuple[tuple[float, float], tuple[float, float]]
    eigenvalues: tuple[complex, complex]
    eigenvectors: tuple[Eigenvector, ...]
    kind: PortraitKind
    trace: float
    determinant: float
    horizon_s: float
    trajectories: tuple[Trajectory, ...]


#: Below this, an eigenvalue's real part or a determinant counts as zero.
_ZERO = 1e-9


def _classify(l1: complex, l2: complex, scale: float) -> PortraitKind:
    tol = _ZERO * max(1.0, scale)
    if abs(l1.imag) > tol:
        if abs(l1.real) <= tol:
            return PortraitKind.centre
        return PortraitKind.stable_focus if l1.real < 0 else PortraitKind.unstable_focus
    a, b = l1.real, l2.real
    if abs(a) <= tol or abs(b) <= tol:
        return PortraitKind.degenerate
    if a * b < 0:
        return PortraitKind.saddle
    return PortraitKind.stable_node if a < 0 else PortraitKind.unstable_node


def _expm2(a11: float, a12: float, a21: float, a22: float, t: float) -> tuple[float, float, float, float]:
    """``e^{At}`` of a 2×2 by Cayley–Hamilton: with ``M = A − (tr/2)·I``,
    ``M² = q²·I`` for ``q² = (tr/2)² − det``."""
    half = (a11 + a22) / 2
    q2 = half * half - (a11 * a22 - a12 * a21)
    if abs(q2) < 1e-14 * max(1.0, half * half):
        c, s = 1.0, t
    elif q2 > 0:
        q = math.sqrt(q2)
        c, s = math.cosh(q * t), math.sinh(q * t) / q
    else:
        p = math.sqrt(-q2)
        c, s = math.cos(p * t), math.sin(p * t) / p
    e = math.exp(half * t)
    return (e * (c + s * (a11 - half)), e * s * a12, e * s * a21, e * (c + s * (a22 - half)))


def matrix_portrait(a11: float, a12: float, a21: float, a22: float) -> MatrixPortrait:
    tr = a11 + a22
    det = a11 * a22 - a12 * a21
    root = cmath.sqrt(tr * tr / 4 - det)
    l1, l2 = tr / 2 + root, tr / 2 - root
    if l1.imag < l2.imag:
        l1, l2 = l2, l1
    scale = max(abs(a11), abs(a12), abs(a21), abs(a22))
    kind = _classify(l1, l2, scale)
    vectors: list[Eigenvector] = []
    if abs(l1.imag) <= _ZERO * max(1.0, scale):
        for lam in sorted({l1.real, l2.real}):
            # A row of (A − λI) that is not zero gives the direction orthogonal
            # to it; both rows zero means every direction is an eigenvector.
            r1 = (a11 - lam, a12)
            r2 = (a21, a22 - lam)
            row = r1 if math.hypot(*r1) >= math.hypot(*r2) else r2
            if math.hypot(*row) <= _ZERO * max(1.0, scale):
                continue
            vx, vy = -row[1], row[0]
            n = math.hypot(vx, vy)
            if vx < 0 or (vx == 0 and vy < 0):
                vx, vy = -vx, -vy
            vectors.append(Eigenvector(lam, vx / n, vy / n))
    biggest = max(abs(l1), abs(l2))
    horizon = 8.0 / biggest if biggest > _ZERO else 1.0
    if kind is PortraitKind.centre or kind in (PortraitKind.stable_focus, PortraitKind.unstable_focus):
        horizon = max(horizon, 1.5 * 2 * math.pi / abs(l1.imag))
    horizon = min(horizon, 60.0)
    ts = linspace(0.0, horizon, TRAJECTORY_POINTS)
    steps = [_expm2(a11, a12, a21, a22, t) for t in ts]
    trajectories = []
    for k in range(TRAJECTORIES):
        angle = 2 * math.pi * k / TRAJECTORIES
        x0, y0 = math.cos(angle), math.sin(angle)
        xs: list[float] = []
        ys: list[float] = []
        for e11, e12, e21, e22 in steps:
            x = e11 * x0 + e12 * y0
            y = e21 * x0 + e22 * y0
            xs.append(x)
            ys.append(y)
            if abs(x) > PORTRAIT_BOX or abs(y) > PORTRAIT_BOX:
                break
        trajectories.append(Trajectory(tuple(xs), tuple(ys)))
    return MatrixPortrait(
        matrix=((a11, a12), (a21, a22)),
        eigenvalues=(l1, l2),
        eigenvectors=tuple(vectors),
        kind=kind,
        trace=tr,
        determinant=det,
        horizon_s=horizon,
        trajectories=tuple(trajectories),
    )
