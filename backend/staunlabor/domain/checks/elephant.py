"""The Bernoulli elephant, checked: the jet's momentum against its conservation
in a free jet, the speed that lifts the ball off the rim against the drag on it
and the jet's profile integrated over the ball in closed form, and where the
page's time loop lets the ball float against its weight less its buoyancy.

The page steps the browser port (``simulate/elephant.ts``: ``step`` at 2 ms),
held to this engine by ``engine-cases.json``; its figures are the route's,
:func:`figures`. What is measured here is the engine: the jet the cross-section
sums read, :func:`figures`, and :func:`run`, the page's loop.
"""

from __future__ import annotations

import math

from staunlabor.domain.checks import Case, Source
from staunlabor.domain.checks._hand import G
from staunlabor.domain.experiments import elephant as engine

#: Air, as the engine takes it.
RHO = 1.2

_MOMENTUM = Source(
    cite="Stern Lab, University of Iowa, lecture notes “Chapter 7: Free Shear Flows: Jets, Mixing Layers and Wakes (Pope)”, Part 1: Round and 2D Jets, p. 3",
    url="https://stern.lab.uiowa.edu/sites/stern.lab.uiowa.edu/files/2025-11/Chapter-7-Free-Shear-Flows-Part-1-final.pdf",
    quote="Therefore, momentum flux of the mean flow is independent of x: Ṁ = ∫₀^∞ 2πrρU² dr = constant ≠ f(x) … i.e., r₁/₂(x)~x and U₀(x)~x⁻¹ consistent with momentum flux being constant",
)
_DRAG = Source(
    cite="Wikipedia, “Drag equation”",
    url="https://en.wikipedia.org/wiki/Drag_equation",
    quote="F_d = ½ρu²c_dA where F_d is the drag force, which is by definition the force component in the direction of the flow velocity, ρ is the mass density of the fluid, u is the flow velocity relative to the object, A is the reference area, and c_d is the drag coefficient",
)
_SPHERE = Source(
    cite="Wikipedia, “Drag coefficient”, §“Drag coefficient examples”",
    url="https://en.wikipedia.org/wiki/Drag_coefficient",
    quote="A smooth sphere, for example, has a c_d that varies from high values for laminar flow to 0.47 for turbulent flow.",
)
_ARCHIMEDES = Source(
    cite="OpenStax, University Physics Volume 1, §14.4 Archimedes’ Principle and Buoyancy",
    url="https://openstax.org/books/university-physics-volume-1/pages/14-4-archimedes-principle-and-buoyancy",
    quote="Archimedes’ Principle The buoyant force on an object equals the weight of the fluid it displaces. In equation form, Archimedes’ principle is F_B = w_fl",
)

#: The page's elephant: 14.5 m/s out of a 10 cm trunk, a ball of 15 cm and 30 g.
_EL = engine.Elephant()
#: A sphere's drag coefficient, from the source.
_CD = 0.47


def _net_weight() -> float:
    """The ball's weight less the air it displaces (Archimedes)."""
    ball = _EL.ball
    displaced = RHO * 4 / 3 * math.pi * (ball.diameter_m / 2) ** 3
    return (ball.mass_kg - displaced) * G


def _flux_at_opening() -> float:
    """What the opening puts in: ρ·U₀² over its area."""
    jet = _EL.jet
    return RHO * jet.speed_m_s**2 * math.pi * jet.opening_m**2 / 4


def _flux_at_ball() -> float:
    """The jet's momentum flux at the height the ball floats, ∫2πr·ρ·u² dr with
    the engine's profile u = u_c·exp(−r²/b²), by Simpson's rule out to six
    widths."""
    s = engine.figures(_EL).float_height_m
    assert s is not None
    u_c, b = engine.centre_speed(_EL.jet, s), engine.width(_EL.jet, s)
    n = 6000
    h = 6 * b / n
    total = sum(
        (1 if j in (0, n) else 4 if j % 2 else 2)
        * 2
        * math.pi
        * (j * h)
        * RHO
        * (u_c * math.exp(-((j * h) ** 2) / b**2)) ** 2
        for j in range(n + 1)
    )
    return total * h / 3


def _lift_off_hand() -> float:
    """The air speed that just lifts the ball off the rim. The ball sits with
    its centre √(r² − (D/2)²) above the opening; there the page's jet has the
    width b = D/√2 + s/(√2·B), B = 6, and, keeping the opening's momentum, the
    centre speed u_c = U₀·D/(√2·b). Its u² averaged over the ball's disc, in
    closed form: u_c²·b²/(2r²)·(1 − e^(−2r²/b²)). That grows with U₀²; the
    lift ½·ρ·c_d·A·⟨u²⟩ meets the net weight at the speed sought."""
    jet, ball = _EL.jet, _EL.ball
    r, d = ball.diameter_m / 2, jet.opening_m
    s = math.sqrt(r * r - (d / 2) ** 2)
    b = d / math.sqrt(2) + s / (math.sqrt(2) * 6.0)
    per_speed = (d / (math.sqrt(2) * b)) ** 2 * b * b / (2 * r * r) * (1 - math.exp(-2 * r * r / (b * b)))
    area = math.pi * r * r
    return math.sqrt(_net_weight() / (0.5 * RHO * _CD * area * per_speed))


def _holding_air_hand() -> float:
    """The air speed at which the drag on a ball at rest equals its net
    weight: ½·ρ·u²·c_d·A = (m − ρ·V)·g."""
    area = math.pi * (_EL.ball.diameter_m / 2) ** 2
    return math.sqrt(_net_weight() / (0.5 * RHO * _CD * area))


def _holding_air_measured() -> float:
    """The page's loop from the rim, 20 s: the air at the ball where it has
    come to rest, the root mean square over its cross-section, as the page
    shows it."""
    return engine.run(_EL, (), 20.0).air_m_s[-1]


def _setting() -> dict[str, float | str]:
    """What the page's "Set it up" sets: the trunk, the air, the ball, the
    suction coefficient, and the trunk upright."""
    return {
        "opening_m": _EL.jet.opening_m,
        "speed_m_s": _EL.jet.speed_m_s,
        "diameter_m": _EL.ball.diameter_m,
        "mass_kg": _EL.ball.mass_kg,
        "coanda": _EL.coanda,
        "tilt": 0.0,
    }


CASES: tuple[Case, ...] = (
    Case(
        key="momentum_flux",
        unit="N",
        expected=_flux_at_opening,
        measured=_flux_at_ball,
        # Simpson's rule over 6000 pieces of a Gaussian, cut at six widths: exact to rounding.
        tolerance=1e-10,
        sources=(_MOMENTUM,),
        derived=True,
        setting=_setting(),
    ),
    Case(
        key="lift_off",
        unit="m/s",
        expected=_lift_off_hand,
        measured=lambda: engine.figures(_EL).lift_off_m_s,
        # The page sums the ball's cross-section at 288 points; the closed form
        # integrates the disc exactly: 10⁻³ in the push, 5 · 10⁻⁴ in the speed.
        tolerance=1e-3,
        sources=(_MOMENTUM, _DRAG, _SPHERE, _ARCHIMEDES),
        derived=True,
        setting=_setting(),
    ),
    Case(
        key="float_balance",
        unit="m/s",
        expected=_holding_air_hand,
        measured=_holding_air_measured,
        # After 20 s the bob the air damps has died away to 10⁻¹¹.
        tolerance=1e-8,
        sources=(_DRAG, _SPHERE, _ARCHIMEDES),
        setting=_setting(),
    ),
)
