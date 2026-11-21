"""The bouncing ball, checked: the table-tennis ball's drop, rise and first
flight against the textbook solutions of a fall and a throw with the air's
quadratic drag, and the steel ball's time until still against the geometric
series of a ball the air hardly touches.

What the page shows: the figures of its port (``simulate/bounce.ts``), the
engine's ``figures``.
"""

from __future__ import annotations

import math

from staunlabor.domain.checks import Case, Source
from staunlabor.domain.experiments import bounce as engine

ENGINE = ("bounce",)

#: Standard gravity, as the engine takes it.
G = 9.80665
#: Air at 20 °C, kg/m³, and a smooth sphere's drag coefficient, as the engine takes them.
AIR_DENSITY = 1.204
DRAG_COEFFICIENT = 0.47

_FALL = Source(
    cite="Wikipedia, “Free fall”, §Uniform gravitational field with air resistance",
    url="https://en.wikipedia.org/wiki/Free_fall",
    quote="Assuming an object falling from rest and no change in air density with altitude …, the solution is: "
    "v(t) = v∞ tanh(gt/v∞), where the terminal speed is given by v∞ = √(2mg/(ρC_D A)). … "
    "y = y0 + (v∞²/g) ln cosh(gt/v∞).",
)
_THROW = Source(
    cite="Wikipedia, “Projectile motion”, §Trajectory of a projectile with Newton drag, Special cases "
    "(citing Greiner, Classical Mechanics, 2004, p. 181)",
    url="https://en.wikipedia.org/wiki/Projectile_motion",
    quote="Vertical motion upward: … v∞ ≡ √(g/μ) and t_f = 1/√(μg), t_peak ≡ t_f arctan(v_y,0/v∞) … and "
    "y_peak ≡ −(1/μ) ln cos(t_peak/t_f) = (1/(2μ)) ln(1 + (μ/g) v_y,0²) … Vertical motion downward: … "
    "y(t) = y_peak − (1/μ) ln(cosh((t − t_peak)/t_f))",
)
_RESTITUTION = Source(
    cite="Wikipedia, “Bouncing ball”, §Impact",
    url="https://en.wikipedia.org/wiki/Bouncing_ball",
    quote="In the specific case where a ball impacts on an immovable surface, the COR simplifies to e = −v_f/v_i.",
)
_SERIES = Source(
    cite="Wikipedia, “Bouncing ball”, §Impact",
    url="https://en.wikipedia.org/wiki/Bouncing_ball",
    quote="For a straight drop on the ground with no rotation, with only the force of gravity acting on the ball, "
    "the COR can be related to several other quantities by: e = |v_f/v_i| = √(K_f/K_i) = √(U_f/U_i) = "
    "√(H_f/H_i) = T_f/T_i = √(gT_f²/(8H_i)).",
)
_VACUUM = Source(
    cite="Wikipedia, “Free fall”, §Uniform gravitational field without air resistance",
    url="https://en.wikipedia.org/wiki/Free_fall",
    quote="If the initial velocity is zero, then the distance fallen from the initial position will grow as the "
    "square of the elapsed time: v(t) = −gt and y0 − y(t) = ½gt².",
)

_TENNIS = engine.TABLE_TENNIS
_FROM_M = 0.30
#: The steel ball, made dull and dropped from low: its speeds stay small
#: against the air's 60 m/s, which then hardly touches it.
_DULL = engine.BouncingBall(restitution=0.5)
_LOW_M = 0.05


def _terminal(ball: engine.BouncingBall) -> float:
    """v∞ = √(2mg/(ρ·C_D·A)), worked out here."""
    area = math.pi * ball.diameter_m**2 / 4
    return math.sqrt(2 * ball.mass_kg * G / (AIR_DENSITY * DRAG_COEFFICIENT * area))


def _landing_s(ball: engine.BouncingBall, height_m: float) -> float:
    """y(t) = (v∞²/g)·ln cosh(gt/v∞) = h, solved for t."""
    v = _terminal(ball)
    return v / G * math.acosh(math.exp(G * height_m / v**2))


def _first_throw(ball: engine.BouncingBall, height_m: float) -> tuple[float, float, float]:
    """The first bounce: thrown up at e times the landing speed v∞·tanh(gt/v∞);
    its time to the top, its height and its time down again."""
    v = _terminal(ball)
    mu = G / v**2
    t_f = 1 / math.sqrt(mu * G)
    up = ball.restitution * v * math.tanh(G * _landing_s(ball, height_m) / v)
    t_peak = t_f * math.atan(up / v)
    y_peak = math.log(1 + mu / G * up * up) / (2 * mu)
    # y_peak − ln(cosh(t/t_f))/μ = 0, solved for t.
    t_down = t_f * math.acosh(math.exp(mu * y_peak))
    return t_peak, y_peak, t_down


def _flight_s(ball: engine.BouncingBall, height_m: float) -> float:
    t_peak, _, t_down = _first_throw(ball, height_m)
    return t_peak + t_down


def _still_without_air_s(ball: engine.BouncingBall, height_m: float) -> float:
    """The drop √(2h/g), and the flights after it: the first 2e·√(2gh)/g, each
    next e times the last, summed."""
    drop = math.sqrt(2 * height_m / G)
    first = 2 * ball.restitution * math.sqrt(2 * G * height_m) / G
    return drop + first / (1 - ball.restitution)


def _setting(kind: str, ball: engine.BouncingBall, height_m: float) -> dict[str, float | str]:
    return {"kind": kind, "restitution": ball.restitution, "height_m": height_m}


CASES: tuple[Case, ...] = (
    Case(
        key="landing",
        unit="s",
        expected=lambda: _landing_s(_TENNIS, _FROM_M),
        measured=lambda: engine.figures(_TENNIS, _FROM_M).landing_s,
        tolerance=1e-12,
        sources=(_FALL,),
        setting=_setting("tennis", _TENNIS, _FROM_M),
    ),
    Case(
        key="apex",
        unit="cm",
        expected=lambda: _first_throw(_TENNIS, _FROM_M)[1] * 100,
        measured=lambda: engine.figures(_TENNIS, _FROM_M).first_apex_m * 100,
        tolerance=1e-12,
        sources=(_FALL, _RESTITUTION, _THROW),
        derived=True,
        setting=_setting("tennis", _TENNIS, _FROM_M),
    ),
    Case(
        key="flight",
        unit="s",
        expected=lambda: _flight_s(_TENNIS, _FROM_M),
        measured=lambda: engine.figures(_TENNIS, _FROM_M).first_flight_s,
        tolerance=1e-12,
        sources=(_FALL, _RESTITUTION, _THROW),
        derived=True,
        setting=_setting("tennis", _TENNIS, _FROM_M),
    ),
    Case(
        key="still",
        unit="s",
        expected=lambda: _still_without_air_s(_DULL, _LOW_M),
        measured=lambda: engine.figures(_DULL, _LOW_M).still_s,
        # The air, which the hand leaves out: it changes a flight by a share of
        # (v/v∞)² = 2gh/v∞² = 2.7 · 10⁻⁴ at most.
        tolerance=3e-4,
        sources=(_VACUUM, _SERIES),
        derived=True,
        setting=_setting("steel", _DULL, _LOW_M),
    ),
)
