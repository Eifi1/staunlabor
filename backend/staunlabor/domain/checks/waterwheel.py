"""The chaotic waterwheel, checked: its time loop, at the page's step, against
the linearised start, steady turning, the threshold the page names, the
volumes Lorenz's flow shrinks, and the wheel's own equations in seconds.

The chaos itself has no closed form. What is checked is what Lorenz's
equations with b = 1 must do where a reader can follow them, and that they are
the wheel's.
"""

from __future__ import annotations

import math

from staunlabor.domain.checks import Case, Source
from staunlabor.domain.checks._hand import G
from staunlabor.domain.experiments import waterwheel as engine

#: The wheel's b, from the wheel's own equations (Illing et al.), not the
#: engine's constant: Lorenz's air has 8/3.
B_WHEEL = 1.0
#: Turns a minute from radians a second, as the page's speed reads.
RPM = 60 / (2 * math.pi)
#: The run the page shows and charts, seconds (``SHOWN_S`` on the page).
SHOWN_S = 200.0

_ORIGIN = Source(
    cite="O. Knill, “The Lorenz system”, Harvard Math 118r handout (spring 2005), “The origin” (s there is σ)",
    url="https://abel.math.harvard.edu/archive/118r_spring_05/handouts/lorentz.pdf",
    quote="At the equilibrium point (0, 0, 0), the Jacobean DF (0, 0, 0) is block diagonal. The eigenvalues are −b, "
    "(−1−s±√((1−s)²+4rs))/2.",
)
_LINEAR = Source(
    cite="University of Warwick, CO903 Complexity and Chaos in Dynamical Systems, §4.1 Lorenz equations, "
    "“Linear stability of the origin”, p. 3",
    url="https://warwick.ac.uk/fac/cross_fac/complexity/study/msc_and_phd/co903/co903online/chaos_lorenz13.pdf",
    quote="The linearisation at the origin gives ẋ = σ(y − x), ẏ = rx − y, ż = −bz … with tr(A) = −σ − 1 < 0 and "
    "det(A) = σ(1 − r).",
)
_FIXED = Source(
    cite="University of Warwick, CO903 Complexity and Chaos in Dynamical Systems, §4.1 Lorenz equations, "
    "“Fixed points”, p. 3",
    url="https://warwick.ac.uk/fac/cross_fac/complexity/study/msc_and_phd/co903/co903online/chaos_lorenz13.pdf",
    quote="a symmetric pair of fixed points C⁺ ≡ (x* = y* = √(b(r − 1)), z* = r − 1) "
    "C⁻ ≡ (x* = y* = −√(b(r − 1)), z* = r − 1) when r > 1.",
)
_HOPF = Source(
    cite="University of Warwick, CO903 Complexity and Chaos in Dynamical Systems, §4.1 Lorenz equations, "
    "“Stability of C⁺ and C⁻”, p. 3",
    url="https://warwick.ac.uk/fac/cross_fac/complexity/study/msc_and_phd/co903/co903online/chaos_lorenz13.pdf",
    quote="We can find that they are linearly stable for 1 < r < r_H = σ(σ + b + 3)/(σ − b − 1) "
    "(assuming σ − b − 1 > 0). At r = r_H - subcritical Hopf bifurcation",
)
_HOPF_WIKI = Source(
    cite="Wikipedia, “Lorenz system”, §Analysis (citing Hirsch, Smale, Devaney 2003, pp. 307–308)",
    url="https://en.wikipedia.org/wiki/Lorenz_system",
    quote="This pair of equilibrium points is stable only if ρ < σ (σ + β + 3)/(σ − β − 1)",
)
_VOLUME = Source(
    cite="University of Warwick, CO903 Complexity and Chaos in Dynamical Systems, §4.1 Lorenz equations, "
    "“Volume contraction”, p. 2",
    url="https://warwick.ac.uk/fac/cross_fac/complexity/study/msc_and_phd/co903/co903online/chaos_lorenz13.pdf",
    quote="Since the divergence is constant we have V̇ = −(σ + 1 + b)V with solution V(t) = V(0)e^(−(σ+1+b)t). "
    "Thus volumes in phase space shrink exponentially fast.",
)
_DIVERGENCE = Source(
    cite="O. Knill, “The Lorenz system”, Harvard Math 118r handout (spring 2005), “Volume”",
    url="https://abel.math.harvard.edu/archive/118r_spring_05/handouts/lorentz.pdf",
    quote="The Lorenz flow is dissipative: indeed, the divergence of F is negative. The flow contracts volume. "
    "div(F) = −1 − σ − b",
)
_B_ONE = Source(
    cite="L. Illing, R. F. Fordyce, A. M. Saunders, R. Ormond, “Experiments with a Malkus-Lorenz water wheel: "
    "Chaos and Synchronization”, Am. J. Phys. (2012), doi:10.1119/1.3680533, §III.A, after Eq. (22) "
    "(p. 5 of arXiv:1202.5508v1)",
    url="https://arxiv.org/abs/1202.5508",
    quote="Equation (22) is identical to the Lorenz equations with the third parameter (often denoted as b) equal one.",
)
_WHEEL = Source(
    cite="L. Illing, R. F. Fordyce, A. M. Saunders, R. Ormond, “Experiments with a Malkus-Lorenz water wheel: "
    "Chaos and Synchronization”, Am. J. Phys. (2012), doi:10.1119/1.3680533, §III.A, Eq. (19) "
    "(p. 4 of arXiv:1202.5508v1)",
    url="https://arxiv.org/abs/1202.5508",
    quote="dω/dt = −(κ + Q_tot R²)/I_tot ω(t) + π R g sin α/I_tot a₁(t), da₁/dt = −k a₁(t) + ω(t) b₁(t), "
    "db₁/dt = q₁ − k b₁(t) − ω(t) a₁(t)",
)

#: The page's tap and brake as it opens: σ 10, ρ 28, the cups leaking 0.2 a second.
_DEFAULT = engine.WaterWheel()
#: A small tap, where the wheel settles quickly into turning one way.
_SLOW = engine.WaterWheel(rho=5.0)
#: A stronger brake, so the threshold is not the default's 17.5.
_BRAKED = engine.WaterWheel(sigma=15.0)

#: A wheel to integrate in seconds, 0.5 m across the rim's radius and braked by
#: 1 N·m·s; its inertia and inflow follow from σ and ρ. Any other pair gives the
#: same rate: the wheel's equations hold σ, ρ and K, nothing else.
_RADIUS_M = 0.5
_BRAKE_NMS = 1.0


def _at(run: engine.WheelTurns, t_s: float) -> int:
    return min(range(len(run.t)), key=lambda n: abs(run.t[n] - t_s))


def _origin_rate(w: engine.WaterWheel) -> float:
    """The larger eigenvalue at rest, (−1 − σ + √((1 − σ)² + 4ρσ))/2, per τ."""
    s, r = w.sigma, w.rho
    return (-1 - s + math.sqrt((1 - s) ** 2 + 4 * r * s)) / 2


def _growth_per_s(t1_s: float = 1.5, t2_s: float = 2.5) -> float:
    """How fast the nudge grows on the page's run, from the samples at
    ``t1_s`` and ``t2_s``: ln(x₂/x₁)/(t₂ − t₁)."""
    run = engine.run(_DEFAULT, SHOWN_S)
    j1, j2 = _at(run, t1_s), _at(run, t2_s)
    return math.log(run.x[j2] / run.x[j1]) / (run.t[j2] - run.t[j1])


def _steady_hand_rpm(w: engine.WaterWheel) -> float:
    """x* = √(b(ρ − 1)) with the wheel's b = 1, in turns a minute: Ω = K·x."""
    return math.sqrt(B_WHEEL * (w.rho - 1)) * w.leak_per_s * RPM


def _hopf_hand(w: engine.WaterWheel) -> float:
    s, b = w.sigma, B_WHEEL
    return s * (s + b + 3) / (s - b - 1)


#: Half a τ, 2.5 s at the page's leaks: long enough to shrink a volume
#: four-hundredfold, short enough for the box to stay small.
_TAU = 0.5


def _volume_hand_percent(w: engine.WaterWheel) -> float:
    return math.exp(-(w.sigma + 1 + B_WHEEL) * _TAU) * 100


def _volume_run_percent(w: engine.WaterWheel, eps: float = 1e-5) -> float:
    """A small box of states round where the page's wheel is after 20 s, each
    stepped as the page steps it for half a τ: the box's volume afterwards, by
    the determinant of the central differences."""
    run = engine.run(w, 20.0)
    p = (run.x[-1], run.y[-1], run.z[-1])
    f = engine.rhs(w)
    h = engine.STEP_TAU

    def flow(y: tuple[float, ...]) -> tuple[float, ...]:
        for n in range(round(_TAU / h)):
            y = engine.rk4(f, n * h, y, h)
        return y

    cols = []
    for k in range(3):
        up = flow(tuple(v + (eps if i == k else 0.0) for i, v in enumerate(p)))
        down = flow(tuple(v - (eps if i == k else 0.0) for i, v in enumerate(p)))
        cols.append([(up[i] - down[i]) / (2 * eps) for i in range(3)])
    (a, b, c), (d, e, f_), (g, h_, i) = cols
    return (a * (e * i - f_ * h_) - b * (d * i - f_ * g) + c * (d * h_ - e * g)) * 100


def _wheel_hand_rpm(
    w: engine.WaterWheel,
    at_s: float,
    step_s: float = 1e-3,
    radius_m: float = _RADIUS_M,
    brake_nms: float = _BRAKE_NMS,
) -> float:
    """The wheel's own equations, mass and rate, by a classical Runge–Kutta of
    our own at a fiftieth of the page's step: from rest, the water heaped at the
    top (b₁ = q/k, a₁ = 0), turning at the page's nudge, Ω = K·10⁻³."""
    k = w.leak_per_s
    inertia = brake_nms / (k * w.sigma)
    q = w.rho * brake_nms * k * k / (math.pi * G * radius_m)
    pull = math.pi * G * radius_m / inertia

    def f(s: tuple[float, ...]) -> tuple[float, ...]:
        a, b, om = s
        return (om * b - k * a, -om * a + q - k * b, -brake_nms / inertia * om + pull * a)

    s: tuple[float, ...] = (0.0, q / k, k * engine.NUDGE)
    for _ in range(round(at_s / step_s)):
        k1 = f(s)
        k2 = f(tuple(v + step_s / 2 * d for v, d in zip(s, k1, strict=True)))
        k3 = f(tuple(v + step_s / 2 * d for v, d in zip(s, k2, strict=True)))
        k4 = f(tuple(v + step_s * d for v, d in zip(s, k3, strict=True)))
        s = tuple(
            v + step_s / 6 * (d1 + 2 * d2 + 2 * d3 + d4) for v, d1, d2, d3, d4 in zip(s, k1, k2, k3, k4, strict=True)
        )
    return s[2] * RPM


#: Twelve seconds: past the wheel's first two reversals (5.6 s and 7.2 s), turning
#: fast again.
_WHEEL_AT_S = 12.0


def _wheel_run_rpm(w: engine.WaterWheel) -> float:
    run = engine.run(w, SHOWN_S)
    return run.rate_rad_s[_at(run, _WHEEL_AT_S)] * RPM


def _setting(w: engine.WaterWheel) -> dict[str, float | str]:
    """What the page's "Set it up" sets: the tap and the brake."""
    return {"sigma": w.sigma, "rho": w.rho}


CASES: tuple[Case, ...] = (
    Case(
        key="start",
        unit="1/s",
        expected=lambda: _origin_rate(_DEFAULT) * _DEFAULT.leak_per_s,
        measured=_growth_per_s,
        # At 1.5 s the second, dying mode still bends the rate by 2.2·10⁻⁵;
        # the page's step (RK4's (λh)⁴/120 per e-fold) and the wheel's first
        # pull back on the nudge add less than 10⁻⁵.
        tolerance=1e-4,
        sources=(_ORIGIN, _LINEAR),
        setting=_setting(_DEFAULT),
    ),
    Case(
        key="steady",
        unit="1/min",
        expected=lambda: _steady_hand_rpm(_SLOW),
        measured=lambda: abs(engine.run(_SLOW, SHOWN_S).rate_rad_s[-1]) * RPM,
        # The spiral into steady turning dies as e^(−0.35 τ); after the page's
        # 200 s, 40 τ, a few parts in a million of it are left.
        tolerance=1e-5,
        sources=(_FIXED, _B_ONE),
        derived=True,
        setting=_setting(_SLOW),
    ),
    Case(
        key="threshold",
        unit="",
        expected=lambda: _hopf_hand(_BRAKED),
        measured=lambda: engine.hopf_rho(_BRAKED),
        tolerance=1e-12,
        sources=(_HOPF, _HOPF_WIKI, _B_ONE),
        derived=True,
        setting=_setting(_BRAKED),
    ),
    Case(
        key="volume",
        unit="%",
        expected=lambda: _volume_hand_percent(_DEFAULT),
        measured=lambda: _volume_run_percent(_DEFAULT),
        # RK4 keeps a volume only to fifth order in hλ per step: 2.4·10⁻⁵ over
        # these 50 steps. The box's own size, 10⁻⁵, adds less than 10⁻⁸.
        tolerance=1e-4,
        sources=(_VOLUME, _DIVERGENCE, _B_ONE),
        derived=True,
        setting=_setting(_DEFAULT),
    ),
    Case(
        key="wheel",
        unit="1/min",
        expected=lambda: _wheel_hand_rpm(_DEFAULT, _WHEEL_AT_S),
        measured=lambda: _wheel_run_rpm(_DEFAULT),
        # The page's step grows the nudge 1.6·10⁻⁶ too slowly per e-fold
        # (RK4's (λh)⁴/120); over the eight e-folds of the start that is
        # 1.3·10⁻⁵, which the chaos then carries on, larger or smaller.
        tolerance=5e-5,
        sources=(_WHEEL, _B_ONE),
        derived=True,
        setting=_setting(_DEFAULT),
    ),
)
