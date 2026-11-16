"""Beats: two tuning forks a little apart in pitch sound as one tone that swells and fades.

The exhibit is two tuning forks on their sounding boxes, the same pitch but
for a small rider clamped to one fork's prongs. Struck together, they sound as
one tone that grows loud and soft again, slowly; slide the rider and the
swelling quickens or slows.

**Why.** Two waves of nearly the same frequency are now in step, adding, and
half a beat later out of step, cancelling: their sum is a wave of the mean
frequency whose loudness rises and falls ``|f₁ − f₂|`` times a second,
``sin a + sin b = 2·sin((a + b)/2)·cos((a − b)/2)``. The closer the pitches,
the slower the beats — which is how instruments are tuned: until the beats
stop.

**The rider.** A fork's prong swings like a beam clamped at one end, in its
first mode (``1 + cos βL·cosh βL = 0``, ``βL = 1.8751``). A small mass ``m`` on
each prong at ``s`` along it slows it by Rayleigh's estimate, the mode kept:
``f = f₀/√(1 + m·φ(s)²/m*)``, ``φ`` the mode's shape with ``φ(tip) = 1`` and
``m* = m_prong/4`` the prong's mass as felt at its tip (``∫φ² = ¼``). Near the
base ``φ`` is small and the rider hardly matters; at the tip it counts in full.

**The sound.** Each fork rings down as ``e^{−t/τ}``, both struck alike, so the
sum is ``½·e^{−t/τ}·(sin 2πf₁t + sin 2πf₂t)``, its loudness
``e^{−t/τ}·|cos(π·(f₁ − f₂)·t)|``.

**What it leaves out.** The forks' boxes and the room; the rider's own size
and its pull on the mode's shape (Rayleigh's estimate is a little high: on
the tip of a 20 g prong it comes out under 0.1 % above the exact frequency of
a beam with a mass at its end for 1 g, under 0.4 % for 5 g); the second
prong's coupling and
the fork's stem; the ear, which hears beats as such only while they are slower
than about fifteen a second, and two tones beyond. The values are an assumed
fork: 440 Hz, prongs of 20 g, ringing down in 6 s.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

#: The first root of ``1 + cos x·cosh x = 0``: a clamped beam's first mode.
MODE_ROOT = 1.8751040687119611
_SIGMA = (math.cosh(MODE_ROOT) + math.cos(MODE_ROOT)) / (math.sinh(MODE_ROOT) + math.sin(MODE_ROOT))
#: Down to this share of its first loudness the beats are counted as heard (−40 dB).
HEARD_DOWN_TO = 0.01


@dataclass(frozen=True)
class Fork:
    frequency_hz: float = 440.0
    #: One prong's mass.
    prong_kg: float = 0.020
    #: The time its sound takes to fall to 1/e.
    decay_s: float = 6.0

    def __post_init__(self) -> None:
        if not 100 <= self.frequency_hz <= 2000:
            raise ValueError("a fork sounds at 100 to 2000 Hz")
        if not 0.002 <= self.prong_kg <= 1:
            raise ValueError("a prong weighs 2 g to 1 kg")
        if not 0.5 <= self.decay_s <= 60:
            raise ValueError("a fork rings for half a second to a minute")


@dataclass(frozen=True)
class Rider:
    #: On each prong.
    mass_kg: float = 0.001
    #: Along the prong, from its root (0) to its tip (1).
    position: float = 0.3

    def __post_init__(self) -> None:
        if not 0 <= self.mass_kg <= 0.005:
            raise ValueError("a rider weighs nothing to 5 g")
        if not 0 <= self.position <= 1:
            raise ValueError("a rider sits on the prong, from its root to its tip")


def mode_shape(xi: float) -> float:
    """The prong's first mode at ``xi`` of its length from the root, 1 at the tip."""
    b = MODE_ROOT * xi
    return 0.5 * (math.cosh(b) - math.cos(b) - _SIGMA * (math.sinh(b) - math.sin(b)))


def frequency_hz(fork: Fork, rider: Rider) -> float:
    """The fork's pitch with the rider on: ``f₀/√(1 + m·φ(s)²/(m_prong/4))``."""
    phi = mode_shape(rider.position)
    return fork.frequency_hz / math.sqrt(1 + rider.mass_kg * phi * phi / (fork.prong_kg / 4))


def loudness(f1_hz: float, f2_hz: float, decay_s: float, t_s: float) -> float:
    """The sum's loudness (its envelope) at ``t_s``: ``e^{−t/τ}·|cos(π·(f₁ − f₂)·t)|``."""
    return math.exp(-t_s / decay_s) * abs(math.cos(math.pi * (f1_hz - f2_hz) * t_s))


def sound(f1_hz: float, f2_hz: float, decay_s: float, t_s: float) -> float:
    """The two forks together at ``t_s``: ``½·e^{−t/τ}·(sin 2πf₁t + sin 2πf₂t)``."""
    return 0.5 * math.exp(-t_s / decay_s) * (math.sin(2 * math.pi * f1_hz * t_s) + math.sin(2 * math.pi * f2_hz * t_s))


@dataclass(frozen=True)
class BeatsFigures:
    #: The fork with the rider.
    detuned_hz: float
    #: Beats a second, and the time from one to the next (none when in tune), s.
    beat_hz: float
    beat_s: float | None
    #: How far apart the two, in cents (a hundredth of a semitone).
    cents: float
    #: Beats while the sound falls to ``HEARD_DOWN_TO`` of its start.
    beats_heard: float


def figures(fork: Fork, rider: Rider) -> BeatsFigures:
    detuned = frequency_hz(fork, rider)
    beat = abs(fork.frequency_hz - detuned)
    return BeatsFigures(
        detuned_hz=detuned,
        beat_hz=beat,
        beat_s=1 / beat if beat > 0 else None,
        cents=1200 * math.log2(fork.frequency_hz / detuned),
        beats_heard=beat * fork.decay_s * math.log(1 / HEARD_DOWN_TO),
    )
