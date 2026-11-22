"""The Coriolis carousel, checked: where a throw meets the rim, from outside a
chord and Euclid's angles, the riders' push at the throw against the equation
of motion in a turning frame, and the rolled ball's turn against the ball on a
turning plate.

The page draws the browser port (``simulate/coriolis.ts``), held to this engine
by ``engine-cases.json``; what is measured here is the engine the port copies,
the functions the page calls: the path, the miss and the time of flight.
"""

from __future__ import annotations

import math

from staunlabor.domain.checks import Case, Source
from staunlabor.domain.experiments import coriolis as engine

_NEWTON = Source(
    cite="OpenStax, University Physics Volume 1, §5.2 Newton’s First Law",
    url="https://openstax.org/books/university-physics-volume-1/pages/5-2-newtons-first-law",
    quote="A body at rest remains at rest or, if in motion, remains in motion at constant velocity unless acted on by a net external force.",
)
_CENTRE_ANGLE = Source(
    cite="Euclid, Elements, Book III, Proposition 20 (D. E. Joyce’s edition, Clark University)",
    url="https://mathcs.clarku.edu/~djoyce/java/elements/bookIII/propIII20.html",
    quote="In a circle the angle at the center is double the angle at the circumference when the angles have the same circumference as base.",
)
_SEMICIRCLE = Source(
    cite="Euclid, Elements, Book III, Proposition 31 (D. E. Joyce’s edition, Clark University)",
    url="https://mathcs.clarku.edu/~djoyce/java/elements/bookIII/propIII31.html",
    quote="In a circle the angle in the semicircle is right",
)
_ROTATING = Source(
    cite="M. Fowler, Graduate Classical Mechanics (LibreTexts), §29.2 “Uniformly Rotating Frame”",
    url="https://phys.libretexts.org/Bookshelves/Classical_Mechanics/Graduate_Classical_Mechanics_(Fowler)/29%3A_Non-Inertial_Frame_and_Coriolis_Effect/29.02%3A_Uniformly_Rotating_Frame",
    quote="For the important case of a frame having uniform rotation and no translation motion, m dv/dt = −∂U/∂r + 2m v × Ω + m(Ω × r) × Ω … The second term, 2m v × Ω Landau calls the Coriolis force … Remembering v₀ = v + Ω × r",
)
_TURN_BACK = Source(
    cite="Wikipedia, “Rotating reference frame”, §“Relation between positions in the two frames”",
    url="https://en.wikipedia.org/wiki/Rotating_reference_frame",
    quote="whereas the reverse transformation is x′ = x cos(−θ(t)) − y sin(−θ(t)) y′ = x sin(−θ(t)) + y cos(−θ(t))",
)
_TURNTABLE = Source(
    cite="M. Fowler, Graduate Classical Mechanics (LibreTexts), §30.5 “Ball Rolling on Rotating Plane”, after E. A. Milne, Vectorial Mechanics",
    url="https://phys.libretexts.org/Bookshelves/Classical_Mechanics/Graduate_Classical_Mechanics_(Fowler)/30%3A_A_Rolling_Sphere_on_a_Rotating_Plane/30.05%3A_Ball_Rolling_on_Rotating_Plane",
    quote="(1 + a²m/I) r̈ = ω n̂ × ṙ … For a uniform sphere, I = 2/5 Ma², so ṙ = 2/7 ω n̂ × (r − r₀) So the ball rolling on the rotating plate goes around in a circle, which could be any circle.",
)

#: The page's carousel: 2 m across to the axis, 6 turns a minute anticlockwise.
_SPIN = engine.Carousel()
_STILL = engine.Carousel(rpm=0.0)
#: The page's first throw: 3 m/s straight at the other seat.
_STRAIGHT = engine.Throw(speed_m_s=3.0, aim_deg=0.0, body=engine.Body.PUCK)
_ROLLED = engine.Throw(speed_m_s=3.0, aim_deg=0.0, body=engine.Body.BALL)
#: Aimed 30° anticlockwise of the other seat, on the platform at rest.
_AIMED = engine.Throw(speed_m_s=3.0, aim_deg=30.0, body=engine.Body.PUCK)


def _rate(rpm: float) -> float:
    """Ω in rad/s from turns a minute, worked out here."""
    return rpm * 2 * math.pi / 60


def _chord_miss_deg() -> float:
    """The straight throw by hand: it leaves with u toward the other seat and
    ΩR across (v₀ = v + Ω × r), so its chord leans δ = atan(ΩR/u) off the
    diameter and ends 2δ short of the other seat (Euclid III.20); the chord is
    2R·cos δ long (III.31), crossed at √(u² + Ω²R²), and meanwhile the other
    seat moves on by Ω·t. Clockwise is negative."""
    r, u, w = _SPIN.radius_m, _STRAIGHT.speed_m_s, _rate(_SPIN.rpm)
    delta = math.atan2(w * r, u)
    t = 2 * r * math.cos(delta) / math.hypot(u, w * r)
    return -math.degrees(2 * delta + w * t)


def _push_hand() -> float:
    """The riders' acceleration across the throw at the moment it leaves the
    hand, per kilogram: 2 v′ × Ω + (Ω × r′) × Ω with v′ the throw and r′ the
    seat, its component along y (to the right of a throw toward −x)."""
    w = _rate(_SPIN.rpm)
    v = (-_STRAIGHT.speed_m_s, 0.0, 0.0)
    r = (_SPIN.radius_m, 0.0, 0.0)
    omega = (0.0, 0.0, w)

    def cross(p: tuple[float, float, float], q: tuple[float, float, float]) -> tuple[float, float, float]:
        return (p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0])

    coriolis = cross(v, omega)
    centrifugal = cross(cross(omega, r), omega)
    return 2 * coriolis[1] + centrifugal[1]


#: The step of the difference that reads the riders' acceleration.
_H = 1e-3


def _push_measured() -> float:
    """The same, from the engine's riders' view (the function the page's path
    samples): the second derivative of y′ at the throw, by the three-step
    forward difference (2y₀ − 5y₁ + 4y₂ − y₃)/h², which is second order."""
    y = [engine.turning(_SPIN, _STRAIGHT, n * _H)[1] for n in range(4)]
    return (2 * y[0] - 5 * y[1] + 4 * y[2] - y[3]) / _H**2


def _ball_turn_measured() -> float:
    """How fast the rolled ball's heading turns, seen from outside, in degrees a
    second: the first and the last piece of the path the page draws. A chord of
    a circle points exactly along the tangent at the middle of its arc, so the
    pieces' headings are the ball's at their middle times."""
    p = engine.path(_SPIN, _ROLLED)
    a = (p.outside_x[1] - p.outside_x[0], p.outside_y[1] - p.outside_y[0])
    b = (p.outside_x[-1] - p.outside_x[-2], p.outside_y[-1] - p.outside_y[-2])
    turned = math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1])
    dt = (p.t[-1] + p.t[-2]) / 2 - (p.t[0] + p.t[1]) / 2
    return math.degrees(turned / dt)


def _ball_turn_hand() -> float:
    """ω/(1 + a²m/I) with I = (2/5)·m·a², in degrees a second."""
    return math.degrees(_rate(_SPIN.rpm) / (1 + 1 / (2 / 5)))


def _setting(c: engine.Carousel, throw: engine.Throw, frame: str) -> dict[str, float | str]:
    """What the page's "Set it up" sets: the carousel's turns a minute, the
    throw (speed, aim, what is thrown) and the view."""
    return {
        "rpm": c.rpm,
        "speed_m_s": throw.speed_m_s,
        "aim_deg": throw.aim_deg,
        "body": throw.body.value,
        "frame": frame,
    }


CASES: tuple[Case, ...] = (
    Case(
        key="at_rest",
        unit="°",
        expected=lambda: 2 * _AIMED.aim_deg,
        measured=lambda: engine.miss_deg(_STILL, _AIMED),
        # The rim is found by halving the time sixty times: exact to rounding.
        tolerance=1e-9,
        sources=(_NEWTON, _CENTRE_ANGLE),
        derived=True,
        setting=_setting(_STILL, _AIMED, "riding"),
    ),
    Case(
        key="straight_puck",
        unit="°",
        expected=_chord_miss_deg,
        measured=lambda: engine.miss_deg(_SPIN, _STRAIGHT),
        tolerance=1e-9,
        sources=(_ROTATING, _CENTRE_ANGLE, _SEMICIRCLE, _TURN_BACK),
        derived=True,
        setting=_setting(_SPIN, _STRAIGHT, "riding"),
    ),
    Case(
        key="coriolis_push",
        unit="m/s²",
        expected=_push_hand,
        measured=_push_measured,
        # The three-step difference over 1 ms is second order in the step:
        # 7 · 10⁻⁷ off; rounding adds some 10⁻⁹.
        tolerance=2e-6,
        sources=(_ROTATING,),
        derived=True,
        setting=_setting(_SPIN, _STRAIGHT, "riding"),
    ),
    Case(
        key="ball_turn",
        unit="°/s",
        expected=_ball_turn_hand,
        measured=_ball_turn_measured,
        # Exact for a circle, whatever the samples' spacing: rounding only.
        tolerance=1e-9,
        sources=(_TURNTABLE,),
        setting=_setting(_SPIN, _ROLLED, "outside"),
    ),
)
