"""The race of the curves, checked: the engine's sums of ds/v against the
closed forms a reader knows — the straight incline, the brachistochrone's
cycloid, the tautochrone's valley — and the circular bowl against the
pendulum's exact period.

A solid ball, which feels 5/7 of gravity along the track; the page's build:
50 cm down, 120 cm along.
"""

from __future__ import annotations

import math

from staunlabor.domain.checks import Case, Source
from staunlabor.domain.experiments import race as engine

ENGINE = ("race",)

#: Standard gravity, as the engine takes it.
G = 9.80665

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
_KINEMATICS = Source(
    cite="OpenStax, University Physics Volume 1, §3.4 Motion with Constant Acceleration, Eq. 3.13",
    url="https://openstax.org/books/university-physics-volume-1/pages/3-4-motion-with-constant-acceleration",
    quote="x = x₀ + v₀t + ½at² (constant a)",
)
_BRACHISTOCHRONE = Source(
    cite="Wikipedia, “Brachistochrone curve”, §Johann Bernoulli’s solution",
    url="https://en.wikipedia.org/wiki/Brachistochrone_curve",
    quote="x = r(φ − sin φ), y = r(1 − cos φ) … In the brachistochrone problem, the motion of the body is given by "
    "the time evolution of the parameter: φ(t) = ωt, ω = √(g/r) where t is the time since the release of the body "
    "from the point (0,0).",
)
_TAUTOCHRONE = Source(
    cite="Wikipedia, “Tautochrone curve”, introduction",
    url="https://en.wikipedia.org/wiki/Tautochrone_curve",
    quote="the curve for which the time taken by an object sliding without friction in uniform gravity to its lowest "
    "point is independent of its starting point on the curve. The curve is a cycloid, and the time is equal to π "
    "times the square root of the radius of the circle which generates the cycloid, divided by the square root of "
    "the acceleration of gravity.",
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

#: The page's build: a solid ball, 50 cm down and 120 cm along.
_RACE = engine.Race()
#: A solid ball feels this share of gravity along any track: 1/(1 + 2/5).
_SHARE = 1 / (1 + 2 / 5)


def _time(kind: engine.CurveKind) -> float:
    """A track's time as the page shows it, from the engine's race."""
    return next(t.time_s for t in engine.race(_RACE).tracks if t.kind is kind)


def _line_hand() -> float:
    """Down the incline at a = g′·H/L from rest: L = ½·a·T², so T = √(2L²/(g′·H))."""
    d, h = _RACE.run_m, _RACE.drop_m
    return math.sqrt(2 * (d * d + h * h) / (_SHARE * G * h))


def _cycloid_angle(run: float, drop: float) -> float:
    """The angle φ_B at which r(φ − sin φ) : r(1 − cos φ) is run : drop, by
    halving: the ratio grows from 0 to ∞ as φ goes from 0 to 2π."""
    lo, hi = 1e-6, 2 * math.pi - 1e-6
    for _ in range(100):
        mid = (lo + hi) / 2
        if (mid - math.sin(mid)) / (1 - math.cos(mid)) < run / drop:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def _cycloid_hand() -> float:
    """φ = ω·t with ω = √(g′/r), so the finish at φ_B is reached after
    φ_B·√(r/g′), r = drop/(1 − cos φ_B)."""
    phi = _cycloid_angle(_RACE.run_m, _RACE.drop_m)
    r = _RACE.drop_m / (1 - math.cos(phi))
    return phi * math.sqrt(r / (_SHARE * G))


#: The valley's highest ball: let go at the cycloid's angle 0.3, 59 cm up.
_HIGHEST = 0


def _valley_start() -> engine.ValleyStart:
    return engine.valley(engine.RaceBall.SOLID).starts[_HIGHEST]


def _k_by_sum(modulus: float, n: int = 20000) -> float:
    """K(k) = ∫₀^{π/2} dφ/√(1 − k² sin²φ) by the midpoint rule."""
    h = math.pi / 2 / n
    return h * sum(1 / math.sqrt(1 - (modulus * math.sin((j + 0.5) * h)) ** 2) for j in range(n))


def _bowl_hand() -> float:
    """A quarter of the pendulum's period 4K(sin(½φ₀)) in units of √(R/g′):
    the bowl of radius R = 4r, from the height the valley's highest ball starts
    at, h = r(1 + cos 0.3), so cos φ₀ = 1 − h/R."""
    r = engine.VALLEY_RADIUS_M
    big_r = 4 * r
    height = r * (1 + math.cos(engine.VALLEY_STARTS[_HIGHEST]))
    phi0 = math.acos(1 - height / big_r)
    return math.sqrt(big_r / (_SHARE * G)) * _k_by_sum(math.sin(phi0 / 2))


def _setting() -> dict[str, float | str]:
    """What the page's "Set it up" sets: its build, which the valley shares
    (the valley takes the ball, and its own radius)."""
    return {"drop_m": _RACE.drop_m, "run_m": _RACE.run_m, "ball": _RACE.ball.value}


CASES: tuple[Case, ...] = (
    Case(
        key="line",
        unit="s",
        expected=_line_hand,
        measured=lambda: _time(engine.CurveKind.LINE),
        # After the engine's substitution the line's integrand is constant:
        # the trapezoid sum is exact but for rounding.
        tolerance=1e-12,
        sources=(_INCLINE, _KINEMATICS, _SOLID),
        derived=True,
        setting=_setting(),
    ),
    Case(
        key="cycloid",
        unit="s",
        expected=_cycloid_hand,
        measured=lambda: _time(engine.CurveKind.CYCLOID),
        # The cycloid's integrand is a straight line in u, which the trapezoid
        # sums exactly; near the cusp 1 − cos φ loses digits: 3 · 10⁻¹¹.
        tolerance=1e-10,
        sources=(_BRACHISTOCHRONE, _INCLINE),
        derived=True,
        setting=_setting(),
    ),
    Case(
        key="tautochrone",
        unit="s",
        expected=lambda: math.pi * math.sqrt(engine.VALLEY_RADIUS_M / (_SHARE * G)),
        measured=lambda: _valley_start().cycloid_time_s,
        # The trapezoid rule over the engine's 1440 intervals, its error falling
        # with their square: 7 · 10⁻⁸ here, 2 · 10⁻⁸ at twice as many.
        tolerance=1e-7,
        sources=(_TAUTOCHRONE, _INCLINE),
        derived=True,
        setting=_setting(),
    ),
    Case(
        key="bowl",
        unit="s",
        expected=_bowl_hand,
        measured=lambda: _valley_start().circle_time_s,
        # The same trapezoid rule: 5 · 10⁻⁸ here.
        tolerance=1e-7,
        sources=(_PERIOD, _INTEGRAL, _INCLINE),
        derived=True,
        setting=_setting(),
    ),
)
