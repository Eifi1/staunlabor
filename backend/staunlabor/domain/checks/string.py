"""The standing string, checked: the page's cord's lowest and third tones
against Mersenne's laws, the pull the hand finds three loops at against the
same law solved for the pull, the loops there against the nodes and antinodes
a standing wave between two held ends has, the wave's speed read off the
nodes' spacing against ``√(T/μ)``, and the page's time loop, stepped a frame
at a time, against the steady standing wave worked out by hand.

The page draws the browser port (``simulate/string.ts``), held to this engine
by ``engine-cases.json``. What is measured here is the engine the port copies.
"""

from __future__ import annotations

import cmath
import math
from dataclasses import replace

from staunlabor.domain.checks import Case, Source
from staunlabor.domain.experiments import string as engine

_URL_STRING = "https://en.wikipedia.org/wiki/String_vibration"
_URL_STANDING = "https://en.wikipedia.org/wiki/Standing_wave"

_SPEED = Source(
    cite="Wikipedia, “String vibration”, §Wave and §Derivation",
    url=_URL_STRING,
    quote="The velocity of propagation of a wave in a string (v) is proportional to the square root of the force of "
    "tension of the string (T) and inversely proportional to the square root of the linear density (μ) of the "
    "string: v = √(T/μ). … ∂²y/∂x² = (μ/T) ∂²y/∂t². this equation is known as the wave equation",
)
_MERSENNE = Source(
    cite="Wikipedia, “String vibration”, §Frequency of the wave",
    url=_URL_STRING,
    quote="v = λ/τ = λf. If the length of the string is L, the fundamental harmonic is the one produced by the "
    "vibration whose nodes are the two ends of the string, so L is half of the wavelength of the fundamental "
    "harmonic. Hence one obtains Mersenne's laws: f = v/(2L) = (1/(2L))√(T/μ)",
)
_HARMONICS = Source(
    cite="Wikipedia, “String vibration”, §Frequency of the wave",
    url=_URL_STRING,
    quote="if we take the nth harmonic as having a wavelength given by λₙ = 2L/n, then we easily get an expression "
    "for the frequency of the nth harmonic: fₙ = nv/(2L) And for a string under a tension T with linear density μ, "
    "then fₙ = (n/(2L))√(T/μ)",
)
_FIXED_ENDS = Source(
    cite="Wikipedia, “Standing wave”, §Standing wave on a string with two fixed ends (after Halliday, Resnick, "
    "Walker 2005, p. 434)",
    url=_URL_STANDING,
    quote="Suppose that at the x = 0 fixed end a sinusoidal force is applied that drives the string up and down in "
    "the y-direction with a small amplitude at some frequency f. … Eventually, a steady state is reached where the "
    "string has identical right- and left-traveling waves … f = v/λ = nv/(2L). … Any standing wave on the string "
    "will have n + 1 nodes including the fixed ends and n anti-nodes.",
)
_NODES = Source(
    cite="Wikipedia, “Standing wave”, §Standing wave on an infinite length string",
    url=_URL_STANDING,
    quote="These locations are called nodes. … These locations are called anti-nodes. The distance between two "
    "consecutive nodes or anti-nodes is half the wavelength, λ/2.",
)

#: The page's cord: 1 m, pulled with 3 N, half a gram a metre, damped 12 a
#: second, the vibrator 2 mm each way, a hundred times a second.
_CORD = engine.Cord()
_VIBRATOR_HZ = 100.0
#: Three loops.
_THREE = 3
#: The page's frame, and how long the time loop runs from rest: the start has
#: died to e^(−γt/2) = e^(−30) by then.
_FRAME_S = 1 / 60
_SETTLE_S = 5.0


def _speed(cord: engine.Cord) -> float:
    return math.sqrt(cord.tension_n / cord.density_kg_m)


def _tone_hand_hz(cord: engine.Cord, n: int) -> float:
    """fₙ = (n/(2L))·√(T/μ), as the source prints it."""
    return n / (2 * cord.length_m) * math.sqrt(cord.tension_n / cord.density_kg_m)


def _pull_hand_n(cord: engine.Cord, drive_hz: float, n: int) -> float:
    """The same solved for the pull: T = μ·(2Lf/n)²."""
    return cord.density_kg_m * (2 * cord.length_m * drive_hz / n) ** 2


def _at_three() -> engine.Cord:
    """The page's cord pulled for three loops by the source's formula."""
    return replace(_CORD, tension_n=_pull_hand_n(_CORD, _VIBRATOR_HZ, _THREE))


def _steady_hand_m(cord: engine.Cord, drive_hz: float, x_m: float) -> float:
    """The source's wave equation with a damping term, μ·y_tt + μγ·y_t = T·y_xx,
    driven y(0, t) = A·sin Ωt and held y(L, t) = 0: y = Im[Y(x)·e^{iΩt}] with
    Y'' = −κ²·Y, κ² = (Ω² − iγΩ)·μ/T, so Y = A·sin(κ(L − x))/sin(κL); its
    width at x."""
    big = 2 * math.pi * drive_hz
    kappa = cmath.sqrt((big * big - 1j * cord.damping_per_s * big) * cord.density_kg_m / cord.tension_n)
    return abs(cord.drive_m * cmath.sin(kappa * (cord.length_m - x_m)) / cmath.sin(kappa * cord.length_m))


def _settled_m() -> float:
    """The page's cord from rest, pulled for three loops, the vibrator at its
    hundred hertz, stepped a frame at a time for :data:`_SETTLE_S`: the swing
    in its middle, the middle loop's antinode."""
    cord = _at_three()
    s = engine.start()
    for _ in range(round(_SETTLE_S / _FRAME_S)):
        s = engine.step(cord, s, _VIBRATOR_HZ, _FRAME_S)
    return engine.swing_m(cord, s, _VIBRATOR_HZ, cord.length_m / 2)


def _setting(tension_n: float, drive_hz: float = _VIBRATOR_HZ) -> dict[str, float | str]:
    """What the page's "Set it up" sets: the hand's pull and the vibrator's
    tone, the cord at rest."""
    return {"tension_n": tension_n, "drive_hz": drive_hz}


CASES: tuple[Case, ...] = (
    Case(
        key="fundamental",
        unit="Hz",
        expected=lambda: _tone_hand_hz(_CORD, 1),
        measured=lambda: engine.resonance_hz(_CORD, 1),
        # The damping moves the peak below the undamped tone by about
        # γ²/(8Ω²), 3.0·10⁻⁴ at 39 Hz with γ = 12/s.
        tolerance=5e-4,
        sources=(_MERSENNE, _SPEED),
        setting=_setting(_CORD.tension_n, _tone_hand_hz(_CORD, 1)),
    ),
    Case(
        key="third",
        unit="Hz",
        expected=lambda: _tone_hand_hz(_CORD, _THREE),
        measured=lambda: engine.resonance_hz(_CORD, _THREE),
        # The same shift, nine times smaller at three times the tone: 3.4·10⁻⁵.
        tolerance=1e-4,
        sources=(_HARMONICS, _FIXED_ENDS),
        setting=_setting(_CORD.tension_n, _tone_hand_hz(_CORD, _THREE)),
    ),
    Case(
        key="pull",
        unit="N",
        expected=lambda: _pull_hand_n(_CORD, _VIBRATOR_HZ, _THREE),
        measured=lambda: engine.resonance_pull_n(_CORD, _VIBRATOR_HZ, _THREE),
        # As the hand pulls, the swing grows with the wave's speed as well as
        # with the tuning, which moves the peak 2.7·10⁻⁴ above the formula's pull.
        tolerance=5e-4,
        sources=(_HARMONICS,),
        derived=True,
        setting=_setting(_pull_hand_n(_CORD, _VIBRATOR_HZ, _THREE)),
    ),
    Case(
        key="loops",
        unit="",
        expected=lambda: float(_THREE),
        measured=lambda: float(engine.loops(_at_three(), _VIBRATOR_HZ)),
        # A count: it is three or it is wrong.
        tolerance=0.0,
        sources=(_FIXED_ENDS,),
        setting=_setting(_pull_hand_n(_CORD, _VIBRATOR_HZ, _THREE)),
    ),
    Case(
        key="speed",
        unit="m/s",
        expected=lambda: _speed(_CORD),
        measured=lambda: 2 * engine.node_spacing_m(_CORD, _VIBRATOR_HZ) * _VIBRATOR_HZ,
        # The damping stretches the wave by about γ²/(8Ω²), 5·10⁻⁵ at 100 Hz,
        # and its fading along the cord moves the nodes a little more: 1.4·10⁻⁴.
        tolerance=5e-4,
        sources=(_SPEED, _MERSENNE, _NODES),
        derived=True,
        setting=_setting(_CORD.tension_n),
    ),
    Case(
        key="settled",
        unit="mm",
        expected=lambda: _steady_hand_m(_at_three(), _VIBRATOR_HZ, _CORD.length_m / 2) * 1000,
        measured=lambda: _settled_m() * 1000,
        # The steps are exact; the start has died to e^(−30), and at the middle
        # antinode the modes left out are under 10⁻⁷ of the swing.
        tolerance=1e-6,
        sources=(_SPEED, _FIXED_ENDS),
        derived=True,
        setting=_setting(_pull_hand_n(_CORD, _VIBRATOR_HZ, _THREE)),
    ),
)
