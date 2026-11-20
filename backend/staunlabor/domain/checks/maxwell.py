"""Maxwell's wheel, checked: the wheel as the page shows it, moment by moment,
against the yo-yo's fall and pull, the energy that brings it back up, and the
strings as a spring that turns it round.

Without the strings' rubbing (c = 0), so what is left is the model: rolling
off the axle without slipping, and a lossless spring at the bottom. Read from
``state_at``, the function the page calls every frame (through its port
``simulate/maxwell.ts``): its phases found by bisection, its highest point and
largest pull by golden-section search, none of the engine's closed forms for
them.
"""

from __future__ import annotations

import math
from collections.abc import Callable

from staunlabor.domain.checks import Case, Source
from staunlabor.domain.experiments import maxwell as engine

ENGINE = ("maxwell",)

#: Standard gravity, as the engine takes it.
G = 9.80665

_YOYO = Source(
    cite="UC Santa Barbara Physics, Lecture Demonstrations, 28.33 “Maxwell’s yo-yo”",
    url="https://web.physics.ucsb.edu/~lecturedemonstrations/Composer/Pages/28.33.html",
    quote="In this case, its moment of inertia is (1/2) MR², and the expressions above for v and t become … "
    "t = (1/r)√[L(2r² + R²)/g]",
)
_PULL = Source(
    cite="UC Santa Barbara Physics, Lecture Demonstrations, 28.33 “Maxwell’s yo-yo”",
    url="https://web.physics.ucsb.edu/~lecturedemonstrations/Composer/Pages/28.33.html",
    quote="We can also write this as T = IMg/(Mr² + I), which may make it easier to see that when I >> M or r² is "
    "very small, or both, T ≈ Mg.",
)
_FALL_ENERGY = Source(
    cite="UC Santa Barbara Physics, Lecture Demonstrations, 28.33 “Maxwell’s yo-yo”",
    url="https://web.physics.ucsb.edu/~lecturedemonstrations/Composer/Pages/28.33.html",
    quote="Thus the potential energy is converted into both linear and rotational kinetic energy thus: "
    "MgL = (1/2) Mv² + (1/2) Iω² … v = √[(2gL)/(1 + I/Mr²)]",
)
_PERIOD = Source(
    cite="OpenStax, University Physics Volume 1, §15.1 Simple Harmonic Motion, Eq. 15.10",
    url="https://openstax.org/books/university-physics-volume-1/pages/15-1-simple-harmonic-motion",
    quote="The angular frequency is defined as ω = 2π/T, which yields an equation for the period of the motion: "
    "T = 2π√(m/k).",
)
_SPRING_ENERGY = Source(
    cite="OpenStax, University Physics Volume 1, §15.2 Energy in Simple Harmonic Motion",
    url="https://openstax.org/books/university-physics-volume-1/pages/15-2-energy-in-simple-harmonic-motion",
    quote="The kinetic energy is maximum and equal to K = ½mv² = ½mA²ω² = ½kA². … The total energy of the system "
    "is constant.",
)

#: The page's wheel, without the strings' rubbing.
_FREE = engine.MaxwellWheel(loss=0.0)


def _boundary(w: engine.MaxwellWheel, left: float, right: float, before: tuple[engine.Phase, int]) -> float:
    """When ``state_at`` leaves the phase ``before`` (phase, bounce), found by
    bisection between ``left`` (still in it) and ``right`` (past it)."""
    for _ in range(200):
        mid = (left + right) / 2
        state = engine.state_at(w, mid)
        if (state.phase, state.bounce) == before:
            left = mid
        else:
            right = mid
        if right - left < 1e-13:
            break
    return (left + right) / 2


def _bottom_s(w: engine.MaxwellWheel) -> float:
    return _boundary(w, 0.0, 20.0, (engine.Phase.DOWN, 0))


def _jerk_window(w: engine.MaxwellWheel) -> tuple[float, float]:
    start = _bottom_s(w)
    return start, _boundary(w, start, start + 1.0, (engine.Phase.JERK, 0))


def _golden_max(f: Callable[[float], float], left: float, right: float) -> float:
    """The largest value of ``f`` on [left, right], by golden-section search."""
    ratio = (math.sqrt(5) - 1) / 2
    a, b = left, right
    c, d = b - ratio * (b - a), a + ratio * (b - a)
    for _ in range(200):
        if f(c) > f(d):
            b, d = d, c
            c = b - ratio * (b - a)
        else:
            a, c = c, d
            d = a + ratio * (b - a)
        if b - a < 1e-12:
            break
    return f((a + b) / 2)


def _fall_hand_s(w: engine.MaxwellWheel) -> float:
    """t = (1/r)·√(L(2r² + R²)/g) for a disc, worked out here."""
    r, big_r = w.axle_radius_m, w.wheel_radius_m
    return math.sqrt(w.drop_m * (2 * r * r + big_r * big_r) / G) / r


def _pull_hand_n(w: engine.MaxwellWheel) -> float:
    """T = I·M·g/(M·r² + I), I = ½·M·R²."""
    inertia = 0.5 * w.mass_kg * w.wheel_radius_m**2
    return inertia * w.mass_kg * G / (w.mass_kg * w.axle_radius_m**2 + inertia)


def _bottom_speed_hand(w: engine.MaxwellWheel) -> float:
    """v = √(2gL/(1 + I/(M·r²))) for a disc."""
    k = 0.5 * (w.wheel_radius_m / w.axle_radius_m) ** 2
    return math.sqrt(2 * G * w.drop_m / (1 + k))


def _climb_top_m(w: engine.MaxwellWheel) -> float:
    """The highest the wheel gets on its first climb, by golden-section search
    over the page's own heights between the jerk's end and the time a fall
    from rest would take again."""
    _, end = _jerk_window(w)
    return _golden_max(lambda t: engine.state_at(w, t).height_m, end, end + 1.5 * _fall_hand_s(w))


def _jerk_s(w: engine.MaxwellWheel) -> float:
    start, end = _jerk_window(w)
    return end - start


def _peak_n(w: engine.MaxwellWheel) -> float:
    start, end = _jerk_window(w)
    return _golden_max(lambda t: engine.state_at(w, t).tension_n, start, end)


def _setting(w: engine.MaxwellWheel) -> dict[str, float | str]:
    """The build, in the page's inputs."""
    return {
        "shape": w.shape.value,
        "mass_kg": w.mass_kg,
        "wheel_radius_m": w.wheel_radius_m,
        "axle_radius_m": w.axle_radius_m,
        "drop_m": w.drop_m,
        "loss": w.loss,
        "stiffness_n_m": w.stiffness_n_m,
    }


CASES: tuple[Case, ...] = (
    Case(
        key="fall_time",
        unit="s",
        expected=lambda: _fall_hand_s(_FREE),
        measured=lambda: _bottom_s(_FREE),
        # The bisection ends within 10⁻¹³ s; the rest is rounding.
        tolerance=1e-9,
        sources=(_YOYO,),
        setting=_setting(_FREE),
    ),
    Case(
        key="pull",
        unit="N",
        expected=lambda: _pull_hand_n(_FREE),
        measured=lambda: engine.state_at(_FREE, 1.0).tension_n,
        tolerance=1e-12,
        sources=(_PULL,),
        setting=_setting(_FREE),
    ),
    Case(
        key="back_up",
        unit="m",
        expected=lambda: _FREE.drop_m,
        measured=lambda: _climb_top_m(_FREE),
        # The golden-section search ends within 10⁻¹² s of the top, where the
        # height is flat: far below 10⁻¹².
        tolerance=1e-9,
        sources=(_FALL_ENERGY, _SPRING_ENERGY),
        derived=True,
        setting=_setting(_FREE),
    ),
    Case(
        key="jerk_time",
        unit="ms",
        expected=lambda: math.pi * math.sqrt(_FREE.mass_kg / _FREE.stiffness_n_m) * 1000,
        measured=lambda: _jerk_s(_FREE) * 1000,
        # The strings catch the wheel's fall and the last of its downward pull
        # a↓ = g/(1 + k) besides: the jerk lasts 2·a↓/(π·v·w) = 1.4 · 10⁻³ longer
        # than half a swing.
        tolerance=2e-3,
        sources=(_PERIOD,),
        derived=True,
        setting=_setting(_FREE),
    ),
    Case(
        key="peak",
        unit="N",
        expected=lambda: _FREE.mass_kg * G + _bottom_speed_hand(_FREE) * math.sqrt(_FREE.stiffness_n_m * _FREE.mass_kg),
        measured=lambda: _peak_n(_FREE),
        # The same a↓ adds (a↓/(v·w))²/2 = 2 · 10⁻⁶ to the stretch.
        tolerance=1e-5,
        sources=(_FALL_ENERGY, _SPRING_ENERGY),
        derived=True,
        setting=_setting(_FREE),
    ),
)
