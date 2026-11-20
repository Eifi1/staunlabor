"""Foucault's pendulum, checked: the plane's turn read off the swing itself and
the page's figures against Foucault's sine law and the Earth's turn against the
stars, and the swing's period against the small pendulum's.

The page draws the browser port (``simulate/foucault.ts``), held to this engine
by ``engine-cases.json``. What is measured here is the engine the port copies:
the bob's place, :func:`position`, which the page draws every frame, and the
figures the page shows, :func:`degrees_per_hour` and :func:`full_turn_h`.
"""

from __future__ import annotations

import math

from staunlabor.domain.checks import Case, Source
from staunlabor.domain.experiments import foucault as engine

ENGINE = ("foucault",)

#: Standard gravity, as the engine takes it.
G = 9.80665
#: The Earth's turn against the stars (the IERS's stellar day), in seconds.
STELLAR_DAY_S = 86164.098903691

_SINE_LAW = Source(
    cite="D. Cline, Variational Principles in Classical Mechanics (LibreTexts), §12.13 “Foucault pendulum”",
    url="https://phys.libretexts.org/Bookshelves/Classical_Mechanics/Variational_Principles_in_Classical_Mechanics_(Cline)/12%3A_Non-inertial_Reference_Frames/12.13%3A_Foucault_pendulum",
    quote="At lower latitudes, the pendulum precesses at the lower angular frequency Ω_z = Ω sin λ that goes to zero at the equator.",
)
_POLE = Source(
    cite="D. Cline, Variational Principles in Classical Mechanics (LibreTexts), §12.13 “Foucault pendulum”",
    url="https://phys.libretexts.org/Bookshelves/Classical_Mechanics/Variational_Principles_in_Classical_Mechanics_(Cline)/12%3A_Non-inertial_Reference_Frames/12.13%3A_Foucault_pendulum",
    quote="At the north pole the earth rotates under the pendulum with angular velocity Ω and the axis of the pendulum is fixed in an inertial frame of reference.",
)
_CLOCKWISE = Source(
    cite="Wikipedia, “Foucault pendulum”, §“Mechanism”",
    url="https://en.wikipedia.org/wiki/Foucault_pendulum",
    quote="the angular speed, ω (measured in clockwise degrees per sidereal day), is proportional to the sine of the latitude, φ: ω = 360° sin φ / day, where latitudes north and south of the equator are defined as positive and negative, respectively.",
)
_STELLAR_DAY = Source(
    cite="Wikipedia, “Earth’s rotation”, §“Stellar and sidereal day” (after IERS)",
    url="https://en.wikipedia.org/wiki/Earth%27s_rotation",
    quote="Earth's rotation period relative to the International Celestial Reference Frame, called its stellar day by the International Earth Rotation and Reference Systems Service (IERS), is 86 164.098 903 691 seconds of mean solar time (UT1)",
)
_PERIOD = Source(
    cite="OpenStax, University Physics Volume 1, §15.4 Pendulums, Eq. 15.19",
    url="https://openstax.org/books/university-physics-volume-1/pages/15-4-pendulums",
    quote="and the period is T = 2π√(L/g).",
)

_WINTERTHUR = engine.FoucaultPendulum()
_POLE_P = engine.FoucaultPendulum(latitude_deg=90.0)
_SYDNEY = engine.FoucaultPendulum(latitude_deg=-33.9)

#: The swing is read after an hour, as the page holds its rate back until then.
_HOUR_S = 3600.0


def _sine_law_deg_h(latitude_deg: float) -> float:
    """360° · sin φ per turn of the Earth against the stars, in degrees an
    hour, clockwise positive."""
    return 360 * math.sin(math.radians(latitude_deg)) / (STELLAR_DAY_S / 3600)


def _small_period_s(p: engine.FoucaultPendulum) -> float:
    return 2 * math.pi * math.sqrt(p.length_m / G)


def _turning_point(p: engine.FoucaultPendulum, after_s: float) -> float:
    """The first time after ``after_s`` at which the bob is farthest out: a scan
    over half a swing (the small pendulum's, by hand), then golden sections on
    the distance from the middle, as the page's bob has it."""

    def out(t: float) -> float:
        x, y = engine.position(p, t)
        return x * x + y * y

    half = _small_period_s(p) / 2
    n = 2000
    ts = [after_s + half * j / n for j in range(n + 1)]
    best = max(range(1, n), key=lambda j: out(ts[j]))
    lo, hi = ts[best - 1], ts[best + 1]
    g = (math.sqrt(5) - 1) / 2
    for _ in range(80):
        a, b = hi - g * (hi - lo), lo + g * (hi - lo)
        if out(a) > out(b):
            hi = b
        else:
            lo = a
    return (lo + hi) / 2


def _rate_off_the_bob(p: engine.FoucaultPendulum) -> float:
    """Where the swing's turning point lies an hour on, as a turn an hour:
    clockwise positive, the far end of the swing folded onto the near one."""
    t = _turning_point(p, _HOUR_S)
    x, y = engine.position(p, t)
    return -math.degrees(math.atan(y / x)) / (t / 3600)


def _period_off_the_bob(p: engine.FoucaultPendulum) -> float:
    """From the release, itself a turning point, to the turning point an hour on,
    over the half swings between them."""
    t = _turning_point(p, _HOUR_S)
    halves = round(t / (_small_period_s(p) / 2))
    return 2 * t / halves


def _setting(p: engine.FoucaultPendulum) -> dict[str, float | str]:
    """What the page's "Set it up" sets: the pendulum's build and its place,
    and the clock at an hour a second."""
    return {
        "length_m": p.length_m,
        "amplitude_m": p.amplitude_m,
        "latitude_deg": p.latitude_deg,
        "speed": 3600.0,
    }


CASES: tuple[Case, ...] = (
    Case(
        key="winterthur",
        unit="°/h",
        expected=lambda: _sine_law_deg_h(_WINTERTHUR.latitude_deg),
        measured=lambda: _rate_off_the_bob(_WINTERTHUR),
        # The engine's Ω, 7.2921150 · 10⁻⁵ rad/s, is the stellar day's to its
        # eight digits: 2 · 10⁻⁸ apart; the turning point is found to 10⁻¹⁰ s.
        tolerance=1e-7,
        sources=(_SINE_LAW, _CLOCKWISE, _STELLAR_DAY),
        derived=True,
        setting=_setting(_WINTERTHUR),
    ),
    Case(
        key="pole",
        unit="h",
        expected=lambda: STELLAR_DAY_S / 3600,
        measured=lambda: engine.full_turn_h(_POLE_P),
        # The engine's Ω to its eight digits, as above.
        tolerance=1e-7,
        sources=(_POLE, _STELLAR_DAY),
        derived=True,
        setting=_setting(_POLE_P),
    ),
    Case(
        key="south",
        unit="°/h",
        expected=lambda: _sine_law_deg_h(_SYDNEY.latitude_deg),
        measured=lambda: engine.degrees_per_hour(_SYDNEY),
        # The engine's Ω to its eight digits, as above.
        tolerance=1e-7,
        sources=(_CLOCKWISE, _STELLAR_DAY),
        derived=True,
        setting=_setting(_SYDNEY),
    ),
    Case(
        key="period",
        unit="s",
        expected=lambda: _small_period_s(_WINTERTHUR),
        measured=lambda: _period_off_the_bob(_WINTERTHUR),
        # The Earth's turn quickens the swing to √(ω₀² + Ω_z²): 2 · 10⁻⁹ apart.
        tolerance=1e-8,
        sources=(_PERIOD,),
        setting=_setting(_WINTERTHUR),
    ),
)
