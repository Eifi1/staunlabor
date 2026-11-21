"""The ball cannon, checked: the stack's fall against the textbook fall with
the air's drag, and one ball meeting the floor without loss against Hertz's
contact, its deepest squash and duration, and the momentum the floor turns
round.

What the page shows: the figures of its route (``figures``), the contact table
among them. One ball alone, so that every contact is one a reader can work out.
"""

from __future__ import annotations

import math

from staunlabor.domain.checks import Case, Source
from staunlabor.domain.experiments import cannon as engine

ENGINE = ("cannon",)

#: Standard gravity; the air's density and a sphere's drag coefficient;
#: rubber's Poisson's ratio: all as the engine takes them.
G = 9.80665
AIR_DENSITY = 1.2
DRAG_COEFFICIENT = 0.47
NU = 0.5

_FALL = Source(
    cite="Wikipedia, “Free fall”, §Uniform gravitational field with air resistance",
    url="https://en.wikipedia.org/wiki/Free_fall",
    quote="Assuming an object falling from rest and no change in air density with altitude …, the solution is: "
    "v(t) = v∞ tanh(gt/v∞), where the terminal speed is given by v∞ = √(2mg/(ρC_D A)). … "
    "y = y0 + (v∞²/g) ln cosh(gt/v∞).",
)
_HALF_SPACE = Source(
    cite="Wikipedia, “Contact mechanics”, §Contact between a sphere and a half-space (citing Hertz, 1882)",
    url="https://en.wikipedia.org/wiki/Contact_mechanics",
    quote="An elastic sphere of radius R indents an elastic half-space where total deformation is d … The applied "
    "force F is related to the displacement d by F = 4/3 E* R^½ d^{3/2} where 1/E* = (1 − ν₁²)/E₁ + (1 − ν₂²)/E₂",
)
_ENERGY = Source(
    cite="P. Patrício, “The Hertz contact in chain elastic collisions”, arXiv:physics/0402036 (doi:10.1119/1.1778394), "
    "§III.A, Eq. (5) and (7)",
    url="https://arxiv.org/abs/physics/0402036",
    quote="the elastic potential energy Ep depends on the combined deformation h as: Ep = 2/5 e r^½ h^{5/2} … "
    "the energy conservation principle reads: ½µ(dh/dt)² + 2/5 e r^½ h^{5/2} = ½µν²",
)
_CONTACT_TIME = Source(
    cite="P. Patrício, “The Hertz contact in chain elastic collisions”, arXiv:physics/0402036, §III.A, Eq. (9)",
    url="https://arxiv.org/abs/physics/0402036",
    quote="The collision time corresponds to the time in which the deformation goes from 0 to hM and back to 0 again. "
    "It is given by: τ = 2 (25µ²/(16e²rν))^{1/5} ∫₀¹ dx/√(1 − x^{5/2}) ≈ 3.21 (µ²/(e²rν))^{1/5}",
)
_IMPULSE = Source(
    cite="OpenStax, University Physics Volume 1, §9.2 Impulse and Collisions, Eq. 9.7",
    url="https://openstax.org/books/university-physics-volume-1/pages/9-2-impulse-and-collisions",
    quote="Impulse-Momentum Theorem An impulse applied to a system changes the system’s momentum, and that change "
    "of momentum is exactly equal to the impulse that was applied: J⃗ = Δp⃗.",
)

#: The exhibit's stack, three balls from a metre.
_EXHIBIT = engine.BallStack()
#: Its bottom ball alone, meeting the floor without loss.
_ONE = engine.BallStack(balls=(engine.Ball(0.10),), floor_restitution=1.0)


def _mass(ball: engine.Ball) -> float:
    return ball.density_kg_m3 * math.pi * ball.diameter_m**3 / 6


def _impact_m_s(stack: engine.BallStack) -> float:
    """The bottom ball's speed at the floor: the fall with drag, y = h at
    t = (v∞/g)·arcosh(exp(g·h/v∞²)), and v = v∞·tanh(g·t/v∞)."""
    ball = stack.balls[0]
    area = math.pi * ball.diameter_m**2 / 4
    v_inf = math.sqrt(2 * _mass(ball) * G / (AIR_DENSITY * DRAG_COEFFICIENT * area))
    t = v_inf / G * math.acosh(math.exp(G * stack.drop_m / v_inf**2))
    return v_inf * math.tanh(G * t / v_inf)


def _floor_k(stack: engine.BallStack) -> float:
    """Hertz's K for a ball on a rigid floor: the half-space's E₂ endless, so
    1/E* = (1 − ν²)/E, and R the ball's radius."""
    e_star = 1 / ((1 - NU**2) / (stack.youngs_mpa * 1e6))
    return 4 / 3 * e_star * math.sqrt(stack.balls[0].diameter_m / 2)


def _deepest_m(stack: engine.BallStack) -> float:
    """Where the ball's energy ½mv², and the weight's work m·g·δ on the way in,
    are all in the dent, (2/5)·K·δ^{5/2}: by bisection."""
    m, k, v = _mass(stack.balls[0]), _floor_k(stack), _impact_m_s(stack)
    low, high = 0.0, stack.balls[0].diameter_m / 2
    for _ in range(200):
        mid = (low + high) / 2
        if 0.4 * k * mid**2.5 < 0.5 * m * v * v + m * G * mid:
            low = mid
        else:
            high = mid
    return (low + high) / 2


def _contact_s(stack: engine.BallStack) -> float:
    """Patrício's τ, the floor endlessly heavy (µ = m) and its radius endless
    (e·r^½ = K); ∫₀¹ dx/√(1 − x^{5/2}) by the midpoint rule after x = 1 − s²."""
    m, k, v = _mass(stack.balls[0]), _floor_k(stack), _impact_m_s(stack)
    n = 20000
    integral = sum(2 * s / math.sqrt(1 - (1 - s * s) ** 2.5) for s in ((j + 0.5) / n for j in range(n))) / n
    return 2 * (25 * m * m / (16 * k * k * v)) ** 0.2 * integral


def _floor_contact(stack: engine.BallStack) -> engine.Contact:
    return next(c for c in engine.figures(stack).contacts if c.contact == 0)


def _floor_ms(stack: engine.BallStack) -> float:
    contact = _floor_contact(stack)
    assert contact.end_s is not None
    return (contact.end_s - contact.start_s) * 1000


def _setting(stack: engine.BallStack) -> dict[str, float | str]:
    out: dict[str, float | str] = {
        "count": len(stack.balls),
        "drop_m": stack.drop_m,
        "gap_m": stack.gap_m,
        "floor_restitution": stack.floor_restitution,
        "ball_restitution": stack.ball_restitution,
        "youngs_mpa": stack.youngs_mpa,
    }
    for i, ball in enumerate(stack.balls):
        out[f"diameter_{i}_m"] = ball.diameter_m
    return out


CASES: tuple[Case, ...] = (
    Case(
        key="impact",
        unit="m/s",
        expected=lambda: _impact_m_s(_EXHIBIT),
        measured=lambda: engine.figures(_EXHIBIT).impact_m_s,
        # RK4 at half a millisecond on a smooth fall, the floor found by halving: 10⁻¹⁵.
        tolerance=1e-10,
        sources=(_FALL,),
        setting=_setting(_EXHIBIT),
    ),
    Case(
        key="floor_peak",
        unit="N",
        expected=lambda: _floor_k(_ONE) * _deepest_m(_ONE) ** 1.5,
        measured=lambda: _floor_contact(_ONE).peak_force_n,
        # The air still brakes the ball in the dent, and the page reads the
        # force every 10 µs, not at its top: 4 · 10⁻⁵ together.
        tolerance=1e-4,
        sources=(_HALF_SPACE, _ENERGY),
        derived=True,
        setting=_setting(_ONE),
    ),
    Case(
        key="floor_time",
        unit="ms",
        expected=lambda: _contact_s(_ONE) * 1000,
        measured=lambda: _floor_ms(_ONE),
        # The page counts the contact in steps of 10 µs: up to 1.4 · 10⁻³ of 7 ms.
        # The weight, which the formula leaves out, presses the dent a little deeper.
        tolerance=2e-3,
        sources=(_CONTACT_TIME, _HALF_SPACE),
        derived=True,
        setting=_setting(_ONE),
    ),
    Case(
        key="floor_impulse",
        unit="N·s",
        expected=lambda: _mass(_ONE.balls[0]) * (2 * _impact_m_s(_ONE) + G * _contact_s(_ONE)),
        measured=lambda: _floor_contact(_ONE).impulse_n_s,
        # The weight's impulse over the contact is taken over Patrício's τ, which
        # leaves the weight out (the weight is 0.8 % of the whole); the air brakes a little: 2 · 10⁻⁵.
        tolerance=1e-4,
        sources=(_IMPULSE, _CONTACT_TIME),
        derived=True,
        setting=_setting(_ONE),
    ),
)
