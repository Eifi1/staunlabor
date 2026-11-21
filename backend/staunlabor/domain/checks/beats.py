"""Beats, checked: the two forks' sum against the beat frequency of two tones,
and the rider's pitch against a clamped prong's first mode and its mass as felt
where the rider sits.

The page draws the browser port (``simulate/beats.ts``), held to this engine by
``engine-cases.json``. What is measured here is the engine the port copies: the
sum the page draws and plays, :func:`sound`, and the second fork's pitch,
:func:`frequency_hz`.
"""

from __future__ import annotations

import math

from staunlabor.domain.checks import Case, Source
from staunlabor.domain.experiments import beats as engine

ENGINE = ("beats",)

_BEATS = Source(
    cite="OpenStax, University Physics Volume 1, §17.6 Beats, Eq. 17.17",
    url="https://openstax.org/books/university-physics-volume-1/pages/17-6-beats",
    quote="y(t) = 2A cos(2πf_avg t) cos(2π(|f₂ − f₁|/2) t), where the beat frequency is f_beat = |f₂ − f₁|.",
)
_CANTILEVER = Source(
    cite="Wikipedia, “Euler–Bernoulli beam theory”, §“Example: Cantilevered beam”",
    url="https://en.wikipedia.org/wiki/Euler%E2%80%93Bernoulli_beam_theory",
    quote="non-trivial solutions are found to exist only if cosh(βₙL) cos(βₙL) + 1 = 0. … ŵₙ = A₁[(cosh βₙx − cos βₙx) + (cos βₙL + cosh βₙL)/(sin βₙL + sinh βₙL) (sin βₙx − sinh βₙx)]",
)
_EFFECTIVE_MASS = Source(
    cite="Wikipedia, “Effective mass (spring–mass system)”, §“Uniform spring (homogeneous)”",
    url="https://en.wikipedia.org/wiki/Effective_mass_(spring%E2%80%93mass_system)",
    quote="The effective mass of the spring can be determined by finding its kinetic energy. … So the effective mass of the spring added to the mass of the load gives us the “effective total mass” of the system that must be used in the standard formula 2π√(m/k) to determine the period of oscillation.",
)

#: The page's fork: 440 Hz, prongs of 20 g, ringing down in 6 s.
_FORK = engine.Fork()
#: The page's rider: 1 g on each prong, 30 % up from the stem.
_RIDER = engine.Rider()
_AT_TIP = engine.Rider(mass_kg=0.001, position=1.0)

#: How long the sum is read for silences: the page's chart of ten seconds.
_SPAN_S = 10.0


def _silences(f1: float, f2: float, decay_s: float) -> list[float]:
    """Where the page's sum falls silent. The sum is the mean tone times a slow
    envelope, so read at each crest of the mean tone, sin(2π f̄ t) = ±1, the
    sum is ± the envelope; a silence is where that changes sign between two
    crests, interpolated."""
    mean = (f1 + f2) / 2
    out = []
    prev_t = prev_e = None
    n = 0
    while True:
        t = (2 * n + 1) / (4 * mean)
        if t > _SPAN_S:
            return out
        envelope = (-1) ** n * engine.sound(f1, f2, decay_s, t) * math.exp(t / decay_s)
        if prev_e is not None and (prev_e > 0) != (envelope > 0):
            out.append(prev_t + (t - prev_t) * prev_e / (prev_e - envelope))
        prev_t, prev_e = t, envelope
        n += 1


def _beats_measured() -> float:
    """Silences a second in the page's sum, over the ten seconds it charts."""
    f2 = engine.frequency_hz(_FORK, _RIDER)
    quiet = _silences(_FORK.frequency_hz, f2, _FORK.decay_s)
    return (len(quiet) - 1) / (quiet[-1] - quiet[0])


def _beats_hand() -> float:
    """|f₂ − f₁| for the two pitches the page shows."""
    return abs(engine.frequency_hz(_FORK, _RIDER) - _FORK.frequency_hz)


def _mode_root() -> float:
    """βL, the first root of cosh x·cos x + 1 = 0, by bisection between 1 and 2."""
    lo, hi = 1.0, 2.0
    for _ in range(100):
        mid = (lo + hi) / 2
        if math.cosh(mid) * math.cos(mid) + 1 > 0:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def _shape(xi: float, beta: float) -> float:
    """The source's first mode at ``xi`` of the prong's length, unscaled."""
    b = beta * xi
    ratio = (math.cos(beta) + math.cosh(beta)) / (math.sin(beta) + math.sinh(beta))
    return (math.cosh(b) - math.cos(b)) + ratio * (math.sin(b) - math.sinh(b))


def _rider_hand_hz(rider: engine.Rider) -> float:
    """The prong as felt at its tip, M·∫φ² with φ = 1 at the tip (Simpson's
    rule over the mode), plus the rider as felt there, m·φ(s)²: the same
    stiffness carries the larger mass, f = f₀·√(M*/(M* + m·φ(s)²))."""
    beta = _mode_root()
    tip = _shape(1.0, beta)
    n = 2000
    h = 1 / n
    total = sum((1 if j in (0, n) else 4 if j % 2 else 2) * (_shape(j * h, beta) / tip) ** 2 for j in range(n + 1))
    felt = _FORK.prong_kg * total * h / 3
    phi = _shape(rider.position, beta) / tip
    return _FORK.frequency_hz * math.sqrt(felt / (felt + rider.mass_kg * phi * phi))


def _setting(rider: engine.Rider) -> dict[str, float | str]:
    """What the page's "Set it up" sets: the rider's mass and where it sits."""
    return {"mass_kg": rider.mass_kg, "position": rider.position}


CASES: tuple[Case, ...] = (
    Case(
        key="beat_rate",
        unit="Hz",
        expected=_beats_hand,
        measured=_beats_measured,
        # The silences are interpolated between crests 1.1 ms apart, where the
        # envelope crosses zero straight: 4 · 10⁻¹² off.
        tolerance=1e-9,
        sources=(_BEATS,),
        setting=_setting(_RIDER),
    ),
    Case(
        key="tip_rider",
        unit="Hz",
        expected=lambda: _rider_hand_hz(_AT_TIP),
        measured=lambda: engine.frequency_hz(_FORK, _AT_TIP),
        # Simpson's rule over 2000 pieces of the smooth mode: exact to rounding.
        tolerance=1e-10,
        sources=(_CANTILEVER, _EFFECTIVE_MASS),
        derived=True,
        setting=_setting(_AT_TIP),
    ),
    Case(
        key="rider_on_prong",
        unit="Hz",
        expected=lambda: _rider_hand_hz(_RIDER),
        measured=lambda: engine.frequency_hz(_FORK, _RIDER),
        # As above.
        tolerance=1e-10,
        sources=(_CANTILEVER, _EFFECTIVE_MASS),
        derived=True,
        setting=_setting(_RIDER),
    ),
)
