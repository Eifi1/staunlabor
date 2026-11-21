"""The coupled pendulums, checked: the page's pair, pulled aside 10° as the
page pulls it, stepped at the page's step, against the lone pendulum's exact
period (let go together, the spring idle), the energy of the mode against each
other, the two modes' beat for small swings, and the energy kept.

Equal pendulums, 50 cm and 200 g, a spring of 1 N/m fixed 25 cm below the
pivots, no damping: the page's build.
"""

from __future__ import annotations

import math

from staunlabor.domain.checks import Case, Source
from staunlabor.domain.experiments import coupled as engine
from staunlabor.domain.experiments import pendulum

ENGINE = ("coupled",)

#: Standard gravity, as the engine takes it.
G = 9.80665

_MODES = Source(
    cite="E. Eyler (after T. Moran, D. Hamilton), “Physics 258/259: Coupled Oscillators”, University of Connecticut, "
    "§I, Eqs. (14)–(15) and (16)",
    url="https://www.phys.uconn.edu/~eyler/phys258/N/Coupled_Pendulums.pdf",
    quote="ω−² = mgL/I, ω+² = (mgL + 2kl²)/I … the number of nodes per second in the beat note is equal to the "
    "difference of the two normal mode frequencies measured in Hz, f1 − f2 = (ω1 − ω2)/2π.",
)
_SMALL = Source(
    cite="OpenStax, University Physics Volume 1, §15.4 Pendulums, Eqs. 15.18 and 15.19",
    url="https://openstax.org/books/university-physics-volume-1/pages/15-4-pendulums",
    quote="The angular frequency is ω = √(g/L) and the period is T = 2π√(L/g).",
)
_PERIOD = Source(
    cite="NIST Digital Library of Mathematical Functions, §22.19(i), Eq. 22.19.1 and after Eq. 22.19.2",
    url="https://dlmf.nist.gov/22.19",
    quote="With appropriate scalings, Newton’s equation of motion for a pendulum … is d²θ(t)/dt² = −sin θ(t) … "
    "The period is 4K(sin(½α))",
)
_INTEGRAL = Source(
    cite="NIST Digital Library of Mathematical Functions, §19.2(ii), Eqs. 19.2.4 and 19.2.8",
    url="https://dlmf.nist.gov/19.2",
    quote="F(φ,k) = ∫₀^φ dθ/√(1 − k² sin²θ) … K(k) = F(π/2,k)",
)
_POTENTIAL = Source(
    cite="OpenStax, University Physics Volume 1, §8.1 Potential Energy of a System, Eqs. 8.5 and 8.7",
    url="https://openstax.org/books/university-physics-volume-1/pages/8-1-potential-energy-of-a-system",
    quote="U(y) = mgy + const. … U(x) = ½kx² + const.",
)

#: The page's pair, and how far the page pulls a pendulum aside.
_PAIR = engine.CoupledPendulums()
_START_DEG = 10.0


def _kappa() -> float:
    """κ = k·a²/(m·L²): the spring's turn on a pendulum per radian, per second
    squared — the source's k·l²/I with I = m·L² for a bob on a light rod."""
    bob = _PAIR.left
    return _PAIR.spring_n_m * _PAIR.spring_at_m**2 / (bob.mass_kg * bob.length_m**2)


def _period_run(start: engine.Start, seconds: float = 12.0) -> float:
    """The left pendulum's period in the page's loop: Runge–Kutta at its step,
    upward crossings of the vertical, interpolated within the step."""
    f = engine.rhs(_PAIR)
    y = engine.start_state(start, _START_DEG)
    h, t, ups = pendulum.STEP_S, 0.0, []
    for _ in range(round(seconds / h)):
        nxt = pendulum.rk4(f, t, y, h)
        t += h
        if y[0] < 0 <= nxt[0]:
            ups.append(t - h * nxt[0] / (nxt[0] - y[0]))
        y = nxt
    return (ups[-1] - ups[0]) / (len(ups) - 1)


def _k_by_sum(modulus: float, n: int = 20000) -> float:
    """K(k) = ∫₀^{π/2} dφ/√(1 − k² sin²φ) by the midpoint rule."""
    h = math.pi / 2 / n
    return h * sum(1 / math.sqrt(1 - (modulus * math.sin((j + 0.5) * h)) ** 2) for j in range(n))


def _together_hand() -> float:
    """The spring idle, each pendulum alone: 4K(sin(½θ₀)) in units of √(L/g)."""
    theta0 = math.radians(_START_DEG)
    return 4 * math.sqrt(_PAIR.left.length_m / G) * _k_by_sum(math.sin(theta0 / 2))


def _against_hand(n: int = 80000) -> float:
    """Against each other, θ₂ = −θ₁ = −θ: per m·L² and pendulum the energy is
    ½θ̇² + V(θ), V = −(g/L)·cos θ + κ·sin²θ (the weight's height and half the
    spring's ½k·(2a·sin θ)²). From rest at θ₀, the period is
    4·∫₀^θ₀ dθ/√(2(V(θ₀) − V(θ))), summed with θ = θ₀·sin φ, which takes the
    turning point's root out of the sum; the midpoint rule's error, falling
    with the square of the step, is 10⁻¹¹ at this many."""
    theta0 = math.radians(_START_DEG)
    w2, kappa = G / _PAIR.left.length_m, _kappa()

    def v(theta: float) -> float:
        return -w2 * math.cos(theta) + kappa * math.sin(theta) ** 2

    h = math.pi / 2 / n
    total = 0.0
    for j in range(n):
        phi = (j + 0.5) * h
        theta = theta0 * math.sin(phi)
        total += theta0 * math.cos(phi) / math.sqrt(2 * (v(theta0) - v(theta)))
    return 4 * total * h


def _beat_hand() -> float:
    """2π over the difference of the source's two rates, I = m·L²:
    ω₋² = g/L, ω₊² = g/L + 2κ."""
    w2 = G / _PAIR.left.length_m
    return 2 * math.pi / (math.sqrt(w2 + 2 * _kappa()) - math.sqrt(w2))


def _energy(y: tuple[float, ...]) -> float:
    """Both pendulums' motion and height, and the spring stretched by
    a·(sin θ₂ − sin θ₁), J."""
    total = 0.0
    for bob, theta, rate in ((_PAIR.left, y[0], y[2]), (_PAIR.right, y[1], y[3])):
        total += 0.5 * bob.mass_kg * (bob.length_m * rate) ** 2
        total += bob.mass_kg * G * bob.length_m * (1 - math.cos(theta))
    stretch = _PAIR.spring_at_m * (math.sin(y[1]) - math.sin(y[0]))
    return total + 0.5 * _PAIR.spring_n_m * stretch**2


def _energy_hand() -> float:
    """The left pendulum pulled aside 10°: its height L(1 − cos θ₀), and the
    spring stretched by a·sin θ₀."""
    bob, theta0 = _PAIR.left, math.radians(_START_DEG)
    height = bob.mass_kg * G * bob.length_m * (1 - math.cos(theta0))
    return height + 0.5 * _PAIR.spring_n_m * (_PAIR.spring_at_m * math.sin(theta0)) ** 2


def _energy_run(seconds: float = 30.0) -> float:
    f = engine.rhs(_PAIR)
    y = engine.start_state(engine.Start.ONE, _START_DEG)
    h = pendulum.STEP_S
    for i in range(round(seconds / h)):
        y = pendulum.rk4(f, i * h, y, h)
    return _energy(y)


def _setting(start: engine.Start) -> dict[str, float | str]:
    """What the page's "Set it up" sets: the build, and how the pair is let go."""
    return {
        "spring_n_m": _PAIR.spring_n_m,
        "spring_at_m": _PAIR.spring_at_m,
        "right_length_m": _PAIR.right.length_m,
        "mass_kg": _PAIR.left.mass_kg,
        "damping_per_s": _PAIR.damping_per_s,
        "start": start.value,
    }


CASES: tuple[Case, ...] = (
    Case(
        key="together",
        unit="s",
        expected=_together_hand,
        measured=lambda: _period_run(engine.Start.TOGETHER),
        # Runge–Kutta at 1 ms and the crossings interpolated within a step:
        # 10⁻¹¹ here.
        tolerance=1e-9,
        sources=(_SMALL, _PERIOD, _INTEGRAL),
        derived=True,
        setting=_setting(engine.Start.TOGETHER),
    ),
    Case(
        key="against",
        unit="s",
        expected=_against_hand,
        measured=lambda: _period_run(engine.Start.AGAINST),
        # The same, at the faster mode: 2.5 · 10⁻¹⁰ here.
        tolerance=1e-9,
        sources=(_POTENTIAL, _MODES),
        derived=True,
        setting=_setting(engine.Start.AGAINST),
    ),
    Case(
        key="beat",
        unit="s",
        expected=_beat_hand,
        measured=lambda: engine.beat_s(_PAIR),
        # Both closed forms: rounding only.
        tolerance=1e-12,
        sources=(_MODES,),
        derived=True,
        setting=_setting(engine.Start.ONE),
    ),
    Case(
        key="energy",
        unit="mJ",
        expected=lambda: _energy_hand() * 1000,
        measured=lambda: _energy_run() * 1000,
        # Thirty thousand Runge–Kutta steps: 4 · 10⁻¹² here.
        tolerance=1e-10,
        sources=(_POTENTIAL,),
        setting=_setting(engine.Start.ONE),
    ),
)
