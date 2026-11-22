"""The pendulum wave, checked: the row's lengths against the textbook's tuning
rule and the exact period, the row together again after its cycle, a third of
the way through against Jacobi's sn, and the skew a row tuned by the textbook
comes back with.

No air and no friction at the pivots, as in the engine: each pendulum is the
ideal one, and the pattern is in the lengths alone.
"""

from __future__ import annotations

import math

from staunlabor.domain.checks import Case, Source
from staunlabor.domain.checks._hand import G, bisect, elliptic_f_by_sum, elliptic_k_by_sum
from staunlabor.domain.experiments import pendulum
from staunlabor.domain.experiments import wave as engine

_DESIGN = Source(
    cite="Wikipedia, “Pendulum wave”, §Design (citing Harvard Natural Sciences Lecture Demonstrations, “Pendulum Waves”)",
    url="https://en.wikipedia.org/wiki/Pendulum_wave",
    quote="in a given time t, the first pendulum completes n oscillations, and each subsequent one completes one more "
    "oscillation than the previous. As all pendulums are started together, their relative phases change continuously, "
    "but after time t, they come back in sync and the sequence repeats.",
)
_LENGTH = Source(
    cite="Wikipedia, “Pendulum wave”, §Design (the period after Halliday, Resnick, Walker, Fundamentals of Physics, "
    "5th ed., p. 381)",
    url="https://en.wikipedia.org/wiki/Pendulum_wave",
    quote="For small perturbations, the period of a pendulum is given by T = 2π√(L/g) … As t/n is the period of a "
    "pendulum completing n oscillations in t, t/n = 2π√(L/g) ∴ L = g(t/(2πn))²",
)
_PERIOD = Source(
    cite="NIST Digital Library of Mathematical Functions, §22.19(i), after Eq. 22.19.2",
    url="https://dlmf.nist.gov/22.19",
    quote="The period is 4K(sin(½α))",
)
_SWING = Source(
    cite="NIST Digital Library of Mathematical Functions, §22.19(i), Eqs. 22.19.1 and 22.19.2",
    url="https://dlmf.nist.gov/22.19",
    quote="d²θ(t)/dt² = −sin θ(t) … sin(½θ(t)) = sin(½α) sn(t + K, sin(½α)) … for an initial angular displacement α, "
    "with dθ/dt = 0 at time 0",
)
_INTEGRAL = Source(
    cite="NIST Digital Library of Mathematical Functions, §19.2(ii), Eqs. 19.2.4 and 19.2.8",
    url="https://dlmf.nist.gov/19.2",
    quote="F(φ,k) = ∫₀^φ dθ/√(1 − k² sin²θ) … K(k) = F(π/2,k)",
)
_AMPLITUDE = Source(
    cite="NIST Digital Library of Mathematical Functions, §22.16(i), Eqs. 22.16.2 and 22.16.10–22.16.12",
    url="https://dlmf.nist.gov/22.16",
    quote="am(x + 2K,k) = am(x,k) + π … If −K ≤ x ≤ K, then the following four equations are equivalent: "
    "x = F(φ,k), am(x,k) = φ, sn(x,k) = sin φ = sin(am(x,k))",
)

#: The page's row: fifteen pendulums, a minute, the longest swinging 51 times,
#: tuned for and let go at 15°.
_ROW = engine.PendulumWave()
#: The same row tuned by the textbook's formula, for the smallest swing.
_TEXTBOOK = engine.PendulumWave(tuned_deg=0.0)


def _sn(u: float, modulus: float) -> float:
    """sn(u, k) as DLMF defines it: for u in [−K, K], sin φ with F(φ, k) = u,
    φ found by halving; beyond, carried on by am(u + 2K) = am(u) + π."""
    quarter = elliptic_k_by_sum(modulus)
    turns = math.floor((u + quarter) / (2 * quarter))
    x = u - 2 * quarter * turns
    phi = bisect(lambda p: math.copysign(elliptic_f_by_sum(abs(p), modulus), p) < x, -math.pi / 2, math.pi / 2, 50)
    return math.sin(phi + turns * math.pi)


def _modulus(amplitude_deg: float) -> float:
    return math.sin(math.radians(amplitude_deg) / 2)


def _factor(amplitude_deg: float) -> float:
    """T/T₀ = 4K(sin(½α))/(2π): how much longer the swing takes than a small one."""
    return 2 * elliptic_k_by_sum(_modulus(amplitude_deg)) / math.pi


def _textbook_cm(wave: engine.PendulumWave, n: int) -> float:
    """L = g(Γ/(2π(N + n)))²: the source's length for N + n swings in Γ."""
    return G * (wave.cycle_s / (2 * math.pi * (wave.longest_swings + n))) ** 2 * 100


def _tuned_cm(wave: engine.PendulumWave, n: int) -> float:
    """The same with the small swing's period T₀ = Γ/(N + n)·π/(2K): the
    length whose swing of ``tuned_deg`` takes Γ/(N + n)."""
    small = wave.cycle_s / (wave.longest_swings + n) / _factor(wave.tuned_deg)
    return G * (small / (2 * math.pi)) ** 2 * 100


def _apart_after_cycle() -> float:
    """The farthest any of the fifteen stands from 15° one cycle after the
    release: the engine's exact pendulum, as the page draws it."""
    return max(
        abs(pendulum.angle_deg(length, _ROW.amplitude_deg, _ROW.cycle_s) - _ROW.amplitude_deg)
        for length in engine.lengths_m(_ROW)
    )


#: The second pendulum: 52 swings in the cycle, 17⅓ of them by Γ/3.
_SECOND = 1


def _third_hand_deg() -> float:
    """DLMF's swing at Γ/3 for the second pendulum: in the time scaled by
    ω₀ = √(g/L), its 52 swings in Γ take 52·4K, so at Γ/3 the argument is
    52·4K/3 + K."""
    k = _modulus(_ROW.amplitude_deg)
    quarter = elliptic_k_by_sum(k)
    u = (_ROW.longest_swings + _SECOND) * 4 * quarter / 3 + quarter
    return math.degrees(2 * math.asin(k * _sn(u, k)))


def _third_engine_deg() -> float:
    length = engine.lengths_m(_ROW)[_SECOND]
    return pendulum.angle_deg(length, _ROW.amplitude_deg, _ROW.cycle_s / 3)


def _skew_hand_deg() -> float:
    """Tuned for the smallest swing, the n-th pendulum's swing of 15° takes
    T₀·2K/π, so in Γ it swings (N + n)·π/(2K) times: (N + n)(1 − π/(2K)) short,
    360° each. The shortest has count − 1 more swings than the longest."""
    return 360 * (_TEXTBOOK.count - 1) * (1 - 1 / _factor(_TEXTBOOK.amplitude_deg))


def _setting(wave: engine.PendulumWave, time_s: float | None = None) -> dict[str, float | str]:
    """What the page's "Set it up" sets: the row, the release, and, for a
    moment of the cycle, the clock stopped there as the page's jumps stop it."""
    out: dict[str, float | str] = {
        "count": wave.count,
        "cycle_s": wave.cycle_s,
        "longest_swings": wave.longest_swings,
        "tuned_deg": wave.tuned_deg,
        "amplitude_deg": wave.amplitude_deg,
    }
    if time_s is not None:
        out["time_s"] = time_s
    return out


CASES: tuple[Case, ...] = (
    Case(
        key="textbook_lengths",
        unit="cm",
        expected=lambda: _textbook_cm(_TEXTBOOK, _TEXTBOOK.count - 1),
        measured=lambda: engine.figures(_TEXTBOOK).shortest_m * 100,
        # The same closed form on both sides: only rounding is left.
        tolerance=1e-12,
        sources=(_LENGTH, _DESIGN),
        setting=_setting(_TEXTBOOK),
    ),
    Case(
        key="tuned_lengths",
        unit="cm",
        expected=lambda: _tuned_cm(_ROW, 0),
        measured=lambda: engine.figures(_ROW).longest_m * 100,
        # K summed here, by the AGM in the engine: both to the last digits.
        tolerance=1e-12,
        sources=(_LENGTH, _PERIOD, _INTEGRAL),
        derived=True,
        setting=_setting(_ROW),
    ),
    Case(
        key="together",
        unit="°",
        expected=lambda: 0.0,
        measured=_apart_after_cycle,
        # The engine takes the time modulo the period, so the sixtieth second
        # is as exact as the first: what is left is rounding, 2 · 10⁻¹⁵°.
        tolerance=1e-12,
        sources=(_DESIGN, _PERIOD),
        setting=_setting(_ROW, _ROW.cycle_s),
    ),
    Case(
        key="third",
        unit="°",
        expected=_third_hand_deg,
        measured=_third_engine_deg,
        # sn by halving on a midpoint sum here, cd by the AGM in the engine:
        # they meet to 4 · 10⁻¹³.
        tolerance=1e-11,
        sources=(_SWING, _AMPLITUDE, _INTEGRAL),
        derived=True,
        setting=_setting(_ROW, _ROW.cycle_s / 3),
    ),
    Case(
        key="textbook_skew",
        unit="°",
        expected=_skew_hand_deg,
        measured=lambda: engine.spread_deg(_TEXTBOOK),
        # Both exact: rounding over 65 swings, 5 · 10⁻¹⁴.
        tolerance=1e-11,
        sources=(_DESIGN, _PERIOD, _INTEGRAL),
        derived=True,
        setting=_setting(_TEXTBOOK),
    ),
)
