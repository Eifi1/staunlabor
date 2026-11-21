"""The ball in the hanging sphere, checked: its time loop, at the page's step,
against the rolling ball in a bowl, the pendulum and the conical pendulum.

Without a push and without rolling resistance, so what is left is the model:
the centre on a sphere of radius ρ = R − r under g/(1 + k).
"""

from __future__ import annotations

import math

from staunlabor.domain.checks import Case, Source
from staunlabor.domain.experiments import sphere as engine

ENGINE = ("sphere",)

#: Standard gravity, as the engine takes it.
G = 9.80665

_BOWL = Source(
    cite="LibreTexts, General Physics I (Prince George's CC), §44.5 “Ball Rolling in a Bowl”",
    url="https://phys.libretexts.org/Courses/Prince_Georges_Community_College/General_Physics_I%3A_Classical_Mechanics/44%3A_Rolling_Bodies/44.05%3A_Ball_Rolling_in_a_Bowl",
    quote="d²θ/dt² = −g/((β+1)(R−r)) sin θ … L_eff = (β+1)(R−r) … T = 2π√(7(R−r)/5g)",
)
_INCLINE = Source(
    cite="OpenStax, University Physics Volume 1, §11.1 Rolling Motion, Eq. 11.4",
    url="https://openstax.org/books/university-physics-volume-1/pages/11-1-rolling-motion",
    quote="a_CM = mg sin θ / (m + I_CM/r²)",
)
_HOLLOW = Source(
    cite="Wikipedia, “List of moments of inertia”, hollow sphere (citing Serway, Physics for Scientists and Engineers, 2nd ed., p. 202)",
    url="https://en.wikipedia.org/wiki/List_of_moments_of_inertia",
    quote="I = 2/3 m r²",
)
_PERIOD = Source(
    cite="NIST Digital Library of Mathematical Functions, §22.19(i), Eq. 22.19.1",
    url="https://dlmf.nist.gov/22.19",
    quote="The period is 4K(sin(α/2))",
)
_AGM = Source(
    cite="NIST Digital Library of Mathematical Functions, §19.8, Eq. 19.8.5",
    url="https://dlmf.nist.gov/19.8",
    quote="K(k) = π/(2M(1,k′))",
)
_CONICAL = Source(
    cite="Wikipedia, “Conical pendulum” (citing Serway, Physics for Scientists and Engineers, 1986, p. 109)",
    url="https://en.wikipedia.org/wiki/Conical_pendulum",
    quote="t = 2π√(L cos θ / g)",
)
_ROUTH = Source(
    cite="Borisov, Mamaev, Kilin, “The rolling motion of a ball on a surface”, Regul. Chaotic Dyn. 7 (2002) 201, §3, Eq. 3.38 (Routh’s integrals)",
    url="https://arxiv.org/abs/nlin/0303024",
    quote="They possess the integrals H = ½(M, ω) + V(γ), F₁ = (M, γ) = c, F₂ = γ² = 1",
)
_WOBBLE = Source(
    cite="Stony Brook University, Physics Comprehensive Exam, Spring 2020, Classical Mechanics 1, Eq. 25",
    url="https://www.stonybrook.edu/commcms/grad-physics-astronomy/resources/_pdfs/ComprehensiveS2020.pdf",
    quote="ω_c = √((g cos θ_c/ℓ)(4 + tan² θ_c))",
)
_ENERGY = Source(
    cite="OpenStax, University Physics Volume 1, §11.1, “Conservation of Mechanical Energy in Rolling Motion”",
    url="https://openstax.org/books/university-physics-volume-1/pages/11-1-rolling-motion",
    quote="the total mechanical energy of an object rolling is E_T = ½mv_CM² + ½I_CMω² + mgh",
)
_GRIP = Source(
    cite="OpenStax, University Physics Volume 1, §11.1, Example 11.1",
    url="https://openstax.org/books/university-physics-volume-1/pages/11-1-rolling-motion",
    quote="μ_s ≥ tan θ / (1 + mr²/I_CM)",
)
_SLACK = Source(
    cite="javalab.org, “Force to move the pendulum”",
    url="https://javalab.org/en/pendulum_en",
    quote="½mv² = mgl(cos θ – cos θ_m) … = mg(3cos θ – 2cos θ_m)",
)

_STILL = engine.Drive(radius_m=0.0, start_hz=0.0, end_hz=0.0, sweep_s=0.0, hold_s=1.0)
_FREE = engine.Sphere(rolling_resistance=0.0)
_HOLLOW_BALL = engine.Sphere(rolling_resistance=0.0, ball=engine.BallKind.HOLLOW)
_BIG = engine.Sphere(shell_radius_m=0.50, rolling_resistance=0.0)


def _swing_hz(sphere: engine.Sphere, amplitude_deg: float, periods: int = 6) -> float:
    """Let go at rest ``amplitude_deg`` up the wall, and time ``periods``
    swings by the centre's crossings of the bottom, interpolated."""
    h = engine.STEP_S
    y = engine.start_state(sphere, amplitude_deg, 0.0)
    t, prev, crossings = 0.0, y[0], []
    while len(crossings) <= periods:
        y = engine.step(sphere, _STILL, t, y, h)
        t += h
        if prev < 0 <= y[0]:
            crossings.append(t - h * y[0] / (y[0] - prev))
        prev = y[0]
    return periods / (crossings[-1] - crossings[0])


def _k_by_sum(modulus: float, n: int = 20000) -> float:
    """K(k) = ∫₀^{π/2} dφ/√(1 − k² sin²φ) by the midpoint rule: a reader's own
    integral, not the engine's arithmetic-geometric mean."""
    h = math.pi / 2 / n
    return h * sum(1 / math.sqrt(1 - (modulus * math.sin((j + 0.5) * h)) ** 2) for j in range(n))


def _small_hz(share: float, rho: float) -> float:
    return math.sqrt(share * G / rho) / (2 * math.pi)


def _circle_hz(sphere: engine.Sphere, angle_deg: float) -> float:
    """The conical pendulum's rate, Ω² = g′/(ρ·cos θ), worked out here."""
    rho = sphere.path_radius_m
    return math.sqrt(5 / 7 * G / (rho * math.cos(math.radians(angle_deg)))) / (2 * math.pi)


def _circle_depth(sphere: engine.Sphere, rate_hz: float, seconds: float = 10.0) -> float:
    """Start the ball on the circle the hand's rate asks for, let it run, and
    read how far below the equator it is at the end."""
    orbit = engine.orbit(sphere, rate_hz)
    assert orbit is not None
    y = engine.start_state(sphere, orbit.angle_deg, orbit.speed_m_s)
    h = engine.STEP_S
    for n in range(round(seconds / h)):
        y = engine.step(sphere, _STILL, n * h, y, h)
    return -y[2]


def _wobble_hz(sphere: engine.Sphere, angle_deg: float, kick_deg: float = 0.3, seconds: float = 8.0) -> float:
    """The circle at ``angle_deg`` started ``kick_deg`` too high: how often it
    bobs about its mean height."""
    orbit = engine.orbit_at(sphere, angle_deg)
    rho = sphere.path_radius_m
    y = engine.start_state(sphere, angle_deg + kick_deg, orbit.speed_m_s)
    mean = math.cos(math.radians(angle_deg))
    h, t, prev, ups = engine.STEP_S, 0.0, None, []
    while t < seconds:
        y = engine.step(sphere, _STILL, t, y, h)
        t += h
        z = -y[2] / rho - mean
        if prev is not None and prev < 0 <= z:
            ups.append(t)
        prev = z
    return (len(ups) - 1) / (ups[-1] - ups[0])


def _energy(sphere: engine.Sphere, y: tuple[float, ...]) -> float:
    """Per kilogram: ½(1 + k)v² for rolling, and the height above the bottom."""
    v2 = y[3] ** 2 + y[4] ** 2 + y[5] ** 2
    return 0.5 * (1 + sphere.inertia_factor) * v2 + G * (y[2] + sphere.path_radius_m)


def _energy_after(sphere: engine.Sphere, seconds: float = 20.0) -> float:
    y = engine.start_state(sphere, 60.0, 0.3)
    h = engine.STEP_S
    for n in range(round(seconds / h)):
        y = engine.step(sphere, _STILL, n * h, y, h)
    return _energy(sphere, y)


#: The swing launched from the bottom would turn at 120° if the wall held it.
_TURN_DEG = 120.0


def _launch_speed(sphere: engine.Sphere) -> float:
    """At the bottom, the speed that would carry the ball to :data:`_TURN_DEG`:
    ½(1 + k)v² = gρ(1 − cos θ₀)."""
    rho, k = sphere.path_radius_m, sphere.inertia_factor
    return math.sqrt(2 * G * rho * (1 - math.cos(math.radians(_TURN_DEG))) / (1 + k))


def _leaves_at_deg(sphere: engine.Sphere) -> float:
    """Where the engine's wall push first falls to zero on that swing."""
    rho = sphere.path_radius_m
    y = engine.start_state(sphere, 0.0, _launch_speed(sphere))
    h, t = engine.STEP_S / 10, 0.0
    prev_angle, prev_normal = 0.0, None
    while t < 2.0:
        _, normal = engine.acceleration(sphere, (y[0], y[1], y[2]), (y[3], y[4], y[5]), 0.0, 0.0)
        angle = math.degrees(math.acos(max(-1.0, min(1.0, -y[2] / rho))))
        if prev_normal is not None and normal <= 0 < prev_normal:
            return prev_angle + (angle - prev_angle) * prev_normal / (prev_normal - normal)
        prev_angle, prev_normal = angle, normal
        y = engine.step(sphere, _STILL, t, y, h)
        t += h
    raise AssertionError("the ball never left the wall")


def _setting(sphere: engine.Sphere, angle_deg: float, speed_m_s: float) -> dict[str, float | str]:
    """What the page's "Set it up" sets: the build, and the ball let go without
    a hand at ``angle_deg`` up the wall, rolling round at ``speed_m_s``."""
    return {
        "shell_radius_m": sphere.shell_radius_m,
        "ball_radius_m": sphere.ball_radius_m,
        "ball": sphere.ball.value,
        "rolling_resistance": sphere.rolling_resistance,
        "start_angle_deg": angle_deg,
        "start_speed_m_s": speed_m_s,
    }


_CIRCLE = engine.orbit(_BIG, 2.0)
assert _CIRCLE is not None
_SIXTY = engine.orbit_at(_FREE, 60.0)


CASES: tuple[Case, ...] = (
    Case(
        key="small_swing",
        unit="Hz",
        expected=lambda: _small_hz(5 / 7, _FREE.path_radius_m),
        measured=lambda: _swing_hz(_FREE, 2.0),
        # A swing of 2° is 0.008 % slower than the smallest.
        tolerance=2e-4,
        sources=(_BOWL, _INCLINE),
        setting=_setting(_FREE, 2.0, 0.0),
    ),
    Case(
        key="hollow_ball",
        unit="Hz",
        expected=lambda: _small_hz(3 / 5, _HOLLOW_BALL.path_radius_m),
        measured=lambda: _swing_hz(_HOLLOW_BALL, 2.0),
        tolerance=2e-4,
        sources=(_BOWL, _HOLLOW),
        derived=True,
        setting=_setting(_HOLLOW_BALL, 2.0, 0.0),
    ),
    Case(
        key="wide_swing",
        unit="Hz",
        expected=lambda: _small_hz(5 / 7, _FREE.path_radius_m) * math.pi / (2 * _k_by_sum(math.sin(math.radians(45)))),
        measured=lambda: _swing_hz(_FREE, 90.0),
        tolerance=1e-5,
        sources=(_BOWL, _PERIOD, _AGM),
        derived=True,
        setting=_setting(_FREE, 90.0, 0.0),
    ),
    Case(
        key="circle_any_size",
        unit="cm",
        expected=lambda: 5 / 7 * G / (2 * math.pi * 2.0) ** 2 * 100,
        measured=lambda: _circle_depth(_BIG, 2.0) * 100,
        tolerance=1e-5,
        sources=(_CONICAL, _ROUTH),
        derived=True,
        setting=_setting(_BIG, _CIRCLE.angle_deg, _CIRCLE.speed_m_s),
    ),
    Case(
        key="wobble",
        unit="Hz",
        expected=lambda: _circle_hz(_FREE, 60.0) * math.sqrt(1 + 3 * math.cos(math.radians(60)) ** 2),
        measured=lambda: _wobble_hz(_FREE, 60.0),
        # A kick of 0.3° is not infinitely small: the bob it starts is 0.02 % off.
        tolerance=1e-3,
        sources=(_WOBBLE, _ROUTH),
        derived=True,
        setting=_setting(_FREE, 60.3, _SIXTY.speed_m_s),
    ),
    Case(
        key="energy",
        unit="J/kg",
        expected=lambda: _energy(_FREE, engine.start_state(_FREE, 60.0, 0.3)),
        measured=lambda: _energy_after(_FREE),
        tolerance=1e-8,
        sources=(_ENERGY,),
        setting=_setting(_FREE, 60.0, 0.3),
    ),
    Case(
        key="grip",
        unit="",
        expected=lambda: math.tan(math.radians(60)) / (1 + 1 / (2 / 5)),
        measured=lambda: engine.run(_FREE, _STILL, start_angle_deg=60.0).friction_needed,
        tolerance=1e-6,
        sources=(_GRIP,),
        derived=True,
        setting=_setting(_FREE, 60.0, 0.0),
    ),
    Case(
        key="leaves_wall",
        unit="°",
        expected=lambda: math.degrees(math.acos(2 * math.cos(math.radians(_TURN_DEG)) / (3 + 2 / 5))),
        measured=lambda: _leaves_at_deg(_FREE),
        tolerance=1e-4,
        sources=(_SLACK, _ENERGY),
        derived=True,
        setting=_setting(_FREE, 0.0, _launch_speed(_FREE)),
    ),
)
