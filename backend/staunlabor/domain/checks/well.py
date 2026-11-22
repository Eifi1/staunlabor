"""The gravity well, checked: its time loop, at the page's step, against
Kepler's third and second laws for a rolling ball, the energy of rolling, and
the rolling resistance's toll on a circle.

The funnel is the page's: z = −k/r with k = 0.01 m², the ball let go at
36 cm, nine tenths of the rim.
"""

from __future__ import annotations

import math

from staunlabor.domain.checks import Case, Source
from staunlabor.domain.checks._hand import G
from staunlabor.domain.experiments import well as engine

_KEPLER3 = Source(
    cite="OpenStax, University Physics Volume 1, §13.5 Kepler’s Laws of Planetary Motion, Eq. 13.11",
    url="https://openstax.org/books/university-physics-volume-1/pages/13-5-keplers-laws-of-planetary-motion",
    quote="Kepler’s third law states that the square of the period is proportional to the cube of the semi-major axis "
    "of the orbit. … For a circular orbit, the semi-major axis (a) is the same as the radius for the orbit. … "
    "T² = (4π²/GM) a³",
)
_KEPLER2 = Source(
    cite="OpenStax, University Physics Volume 1, §13.5 Kepler’s Laws of Planetary Motion, “Kepler’s Second Law”",
    url="https://openstax.org/books/university-physics-volume-1/pages/13-5-keplers-laws-of-planetary-motion",
    quote="areal velocity = ΔA/Δt = L/2m. Since the angular momentum is constant, the areal velocity must also be "
    "constant. This is exactly Kepler’s second law.",
)
_INCLINE = Source(
    cite="OpenStax, University Physics Volume 1, §11.1 Rolling Motion, Eq. 11.4",
    url="https://openstax.org/books/university-physics-volume-1/pages/11-1-rolling-motion",
    quote="a_CM = mg sin θ / (m + I_CM/r²)",
)
_SOLID = Source(
    cite="Wikipedia, “List of moments of inertia”, solid sphere (citing Serway, Physics for Scientists and Engineers)",
    url="https://en.wikipedia.org/wiki/List_of_moments_of_inertia",
    quote="I = 2/5 m r²",
)
_ENERGY = Source(
    cite="OpenStax, University Physics Volume 1, §11.1, “Conservation of Mechanical Energy in Rolling Motion”",
    url="https://openstax.org/books/university-physics-volume-1/pages/11-1-rolling-motion",
    quote="the total mechanical energy of an object rolling is E_T = ½mv_CM² + ½I_CMω² + mgh",
)
_RESISTANCE = Source(
    cite="Wikipedia, “Rolling resistance”, §Rolling resistance coefficient",
    url="https://en.wikipedia.org/wiki/Rolling_resistance",
    quote="The “rolling resistance coefficient” is defined by the following equation: F = C_rr N … N is the normal "
    "force, the force perpendicular to the surface on which the wheel is rolling.",
)
_BANKED = Source(
    cite="OpenStax, University Physics Volume 1, §6.3 Centripetal Force, “Banked curves”",
    url="https://openstax.org/books/university-physics-volume-1/pages/6-3-centripetal-force",
    quote="Only the normal force has a horizontal component, so this must equal the centripetal force, that is, "
    "N sin θ = mv²/r. … N cos θ = mg.",
)

#: A solid ball: I = (2/5)·m·r², so a push along the wall moves it at 5/7.
_SHARE = 1 / (1 + 2 / 5)

#: The page's funnel without rolling resistance, and with the page's own.
_FREE = engine.Funnel(rolling_resistance=0.0)
_BRAKED = engine.Funnel()
#: The rosette: pushed along the rim's direction, slower than the circle.
_ROSETTE = engine.Launch(speed_m_s=0.30, aim_deg=0.0)


def _circle_speed(f: engine.Funnel, r: float) -> float:
    """v² = (5/7)·g·k/r: the inverse square's orbit speed, GM → (5/7)·g·k."""
    return math.sqrt(_SHARE * G * f.k_m2 / r)


def _kepler_period(f: engine.Funnel, r: float) -> float:
    """T² = 4π²r³/GM with GM = (5/7)·g·k."""
    return math.sqrt(4 * math.pi**2 * r**3 / (_SHARE * G * f.k_m2))


def _circle_launch(f: engine.Funnel) -> engine.Launch:
    return engine.Launch(speed_m_s=_circle_speed(f, f.start_m), aim_deg=0.0)


def _first_lap_s(f: engine.Funnel, launch: engine.Launch) -> float:
    """The page's loop, step by step, until the first lap is counted."""
    ride = engine.begin(f, launch)
    while True:
        ride, lap = engine.advance(f, ride)
        if lap is not None:
            return lap.period_s


def _ride(f: engine.Funnel, launch: engine.Launch, seconds: float) -> engine.Ride:
    ride = engine.begin(f, launch)
    for _ in range(round(seconds / engine.STEP_S)):
        ride, _lap = engine.advance(f, ride)
    return ride


def _speed2(f: engine.Funnel, y: engine.State) -> float:
    """v² on the wall: the meridian's share (1 + z′²)·ṙ² and the round's r²φ̇²."""
    r, rd, _, pd = y
    slope = f.k_m2 / (r * r)
    return (1 + slope * slope) * rd * rd + r * r * pd * pd


def _energy(f: engine.Funnel, y: engine.State) -> float:
    """Per kilogram: ½v² + ½·(2/5)v² for the spin, and the height −k/r."""
    return 0.5 * (1 + 2 / 5) * _speed2(f, y) - G * f.k_m2 / y[0]


def _areal(y: engine.State) -> float:
    """r²·φ̇: twice the area the line to the middle sweeps a second."""
    return y[0] ** 2 * y[3]


def _rosette_after(what, seconds: float = 20.0) -> float:
    return what(_ride(_FREE, _ROSETTE, seconds).y)


#: The braked circle is read over the page's first step: the loss, 9 µJ/kg,
#: stands far above rounding, and the ball has hardly slowed yet.
_BRAKE_STEPS = 1


def _toll_run() -> float:
    """−dE/dt at the start of the braked circle, J/(kg·s): the loss over the
    first step of the page's loop, per second."""
    launch = _circle_launch(_BRAKED)
    first = engine.begin(_BRAKED, launch).y
    later = _ride(_BRAKED, launch, _BRAKE_STEPS * engine.STEP_S).y
    return -(_energy(_BRAKED, later) - _energy(_BRAKED, first)) / (_BRAKE_STEPS * engine.STEP_S)


def _toll_hand() -> float:
    """C·N·v on the circle: the wall's push N per kilogram is g·cos α + (v²/r)·sin α,
    with tan α = z′ = k/r² the wall's slope."""
    f = _BRAKED
    r = f.start_m
    v = _circle_speed(f, r)
    alpha = math.atan(f.k_m2 / r**2)
    normal = G * math.cos(alpha) + v * v / r * math.sin(alpha)
    return f.rolling_resistance * normal * v


def _setting(f: engine.Funnel, launch: engine.Launch) -> dict[str, float | str]:
    """What the page's "Set it up" sets: the push and the rolling resistance."""
    return {
        "speed_m_s": launch.speed_m_s,
        "aim_deg": launch.aim_deg,
        "rolling_resistance": f.rolling_resistance,
    }


CASES: tuple[Case, ...] = (
    Case(
        key="kepler_period",
        unit="s",
        expected=lambda: _kepler_period(_FREE, _FREE.start_m),
        measured=lambda: _first_lap_s(_FREE, _circle_launch(_FREE)),
        # Runge–Kutta at 1 ms, the lap's end interpolated between two steps
        # where φ runs evenly: 10⁻¹³ here.
        tolerance=1e-10,
        sources=(_KEPLER3, _INCLINE, _SOLID),
        derived=True,
        setting=_setting(_FREE, _circle_launch(_FREE)),
    ),
    Case(
        key="equal_areas",
        unit="m²/s",
        expected=lambda: _FREE.start_m * _ROSETTE.speed_m_s,
        measured=lambda: _rosette_after(_areal),
        # Twenty thousand Runge–Kutta steps: 10⁻¹³ here.
        tolerance=1e-10,
        sources=(_KEPLER2,),
        derived=True,
        setting=_setting(_FREE, _ROSETTE),
    ),
    Case(
        key="energy",
        unit="J/kg",
        expected=lambda: 0.5 * (1 + 2 / 5) * _ROSETTE.speed_m_s**2 - G * _FREE.k_m2 / _FREE.start_m,
        measured=lambda: _rosette_after(lambda y: _energy(_FREE, y)),
        # Twenty thousand Runge–Kutta steps: 4 · 10⁻¹³ here.
        tolerance=1e-10,
        sources=(_ENERGY, _SOLID),
        setting=_setting(_FREE, _ROSETTE),
    ),
    Case(
        key="brake",
        unit="mW/kg",
        expected=lambda: _toll_hand() * 1000,
        measured=lambda: _toll_run() * 1000,
        # The brake slows the ball at (5/7)·C·N, 3 % of its speed a second, and
        # its toll with it: over the first millisecond the mean is 1.6 · 10⁻⁵
        # below the start's. The engine's fade below 1 mm/s takes 3 · 10⁻⁶.
        tolerance=3e-5,
        sources=(_RESISTANCE, _BANKED),
        derived=True,
        setting=_setting(_BRAKED, _circle_launch(_BRAKED)),
    ),
)
