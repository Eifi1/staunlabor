"""The metronomes, checked against Pantaleone's own analysis of his model: the
swing a lone metronome settles at, two on a held board drifting apart at
their difference in tempo, two on his free board locked with the faster a
little ahead (his Eq. (33)), two identical ones started nearly half a swing
apart ending in step (his Fig. 2), and five identical ones started at random
ending as one (his order parameter, Eq. (38), at 1).

Everything is stepped as the page steps it: the engine's equations, its
Runge–Kutta, its 4 ms. The expected values are worked out here from his
numbers, written out again (θ₀ = 0.39 rad, μ = 0.010, x₀ = 0.088 cm, 104
swings a minute), not taken from the engine.

His analysis is the method of averaging, first order in the small numbers
γ = θ₀²/6, Δ, β and μ; where the engine, which steps the full equations,
lies off it by a term of the next order, the case says how much and why.
"""

from __future__ import annotations

import math

from staunlabor.domain.checks import Case, Source
from staunlabor.domain.checks._hand import G
from staunlabor.domain.experiments import metronomes as engine
from staunlabor.domain.experiments import numerics

_URL = "https://www.uaa.alaska.edu/academics/college-of-arts-and-sciences/departments/physics-and-astronomy/_documents/metro.pdf"
_CITE = "J. Pantaleone, “Synchronization of metronomes”, Am. J. Phys. 70 (10), 992–1000 (2002), the author's proof copy"

_MODEL = Source(
    cite=f"{_CITE}, §II A, Eqs. (1) and (6)",
    url=_URL,
    quote="This term is of the van der Pol type and increases the angular velocity for θ < θ0 and decreases it for "
    "θ > θ0. For small ε, this term will produce stable oscillations with an amplitude of approximately 2θ0 in the "
    "isolated oscillator",
)
_NUMBERS = Source(
    cite=f"{_CITE}, §II B, Eqs. (9), (12), (14) and (15)",
    url=_URL,
    quote="For this setting the maximum swing amplitude of a single, uncoupled metronome was about 45 degrees, which "
    "corresponds to θ0 = 0.39 rad … γ = θ0²/6 … β = x0ω²/g … x0 = 0.088 cm, β = 0.011 … the value μ = 0.010 was "
    "chosen to best fit the data",
)
_RATE = Source(
    cite=f"{_CITE}, §II B, Eqs. (8)–(10)",
    url=_URL,
    quote="ωpen ≈ ω(1 − 3/2 γ), where γ = θ0²/6 parametrizes the leading large angle corrections to pendulum motion "
    "… The relative frequency difference between the oscillators is Δ ≈ (ω1 − ω2)/ω.",
)
_UNCOUPLED = Source(
    cite=f"{_CITE}, §IV B, after Eq. (25)",
    url=_URL,
    quote="we see that in the long time limit, the phase difference of the uncoupled oscillators simply evolves at a "
    "constant rate equal to the frequency difference, Δ. There is no synchronization for uncoupled oscillators.",
)
_LAG = Source(
    cite=f"{_CITE}, §IV B, Eqs. (32) and (33)",
    url=_URL,
    quote="dψ/dτ ≈ Δ − (β/μ)(3γ + β) sin ψ … ψ → ψ* ≈ arcsin(μΔ/(β(3γ + β))).",
)
_INPHASE = Source(
    cite=f"{_CITE}, §III A, Fig. 2",
    url=_URL,
    quote="The metronomes’ pendulums are started with equal but opposite deflections, and they evolve to "
    "synchronized oscillations a half cycle away. The evolution is away from the unstable antiphase oscillations "
    "and toward the stable in-phase oscillations.",
)
_ORDER = Source(
    cite=f"{_CITE}, §III C and §IV C, Eq. (38)",
    url=_URL,
    quote="in-phase synchronization of seven metronomes was consistently observed … We introduce the order "
    "parameter Re^{iψ} = (1/N) Σ_{j=1}^{N} e^{iφj}",
)

#: His numbers, written out again.
_THETA0 = 0.39
_MU = 0.010
_X0_M = 0.088e-2
_OMEGA = 2 * math.pi * 104 / 60
_GAMMA = _THETA0**2 / 6

#: The tempi of the two-metronome cases: half a per cent apart, in ω².
_SPREAD = 0.005

#: How long a case runs, s: long enough for the escapement and the board to
#: have settled (their times are 1/μ = 100 swing radians, 9 s, and the lock's).
_SETTLE_S = 200.0


def _ups(mt: engine.Metronomes, start: engine.Start, seconds: float) -> list[list[float]]:
    """Each metronome's upward crossings of the vertical, s: the engine's
    loop at its step, each crossing interpolated within its step."""
    f = engine.rhs(mt, (True,) * mt.count)
    y = engine.start_state(start, mt.count)
    h = engine.STEP_S * engine.RATE_PER_S
    ups: list[list[float]] = [[] for _ in range(mt.count)]
    for k in range(round(seconds / engine.STEP_S)):
        nxt = numerics.rk4(f, k * h, y, h)
        for i in range(mt.count):
            if y[i] < 0 <= nxt[i]:
                ups[i].append((k + y[i] / (y[i] - nxt[i])) * engine.STEP_S)
        y = nxt
    return ups


def _period(ups: list[float], last: int = 20) -> float:
    return (ups[-1] - ups[-1 - last]) / last


def _lead_deg(ups: list[list[float]], last: int = 20) -> float:
    """How far the second metronome swings ahead of the first, degrees of a
    swing, averaged over the last ``last`` swings: each of its crossings
    against the first's nearest."""
    slow, fast = ups
    period = _period(slow, last)
    leads = []
    for t in fast[-last:]:
        nearest = min(slow, key=lambda s: abs(s - t))
        leads.append((nearest - t) / period * 360)
    return sum(leads) / len(leads)


def _lone_deg() -> float:
    """One metronome on a held board, started from 10°: its largest swing
    over the last five seconds of two minutes."""
    mt = engine.Metronomes(count=1, free=False)
    f = engine.rhs(mt, (True,))
    y = engine.start_state(engine.Start.SMALL, 1)
    h = engine.STEP_S * engine.RATE_PER_S
    seconds = 120.0
    steps = round(seconds / engine.STEP_S)
    peak = 0.0
    for k in range(steps):
        y = numerics.rk4(f, k * h, y, h)
        if (k + 1) * engine.STEP_S > seconds - 5:
            peak = max(peak, abs(y[0]))
    return math.degrees(peak)


def _drift_s() -> float:
    """Two metronomes half a per cent apart on a held board: the time in
    which the faster gains a whole swing, from each one's own period."""
    mt = engine.Metronomes(count=2, spread=_SPREAD, free=False)
    slow, fast = _ups(mt, engine.Start.TOGETHER, _SETTLE_S)
    return 1 / (1 / _period(fast) - 1 / _period(slow))


def _drift_hand() -> float:
    """2π/(ω·Δ·(1 − 3γ/2)): his Δ, the difference of the two rates in units of
    ω, slowed as each rate is by a swing of 2θ₀ (his Eq. (8))."""
    return 2 * math.pi / (_OMEGA * _SPREAD * (1 - 1.5 * _GAMMA))


def _lag_hand() -> float:
    """His Eq. (33), with β = x₀ω²/g from his x₀ (Eqs. (12), (14))."""
    beta = _X0_M * _OMEGA**2 / G
    return math.degrees(math.asin(_MU * _SPREAD / (beta * (3 * _GAMMA + beta))))


def _lag_run() -> float:
    mt = engine.Metronomes(count=2, board_kg=engine.BOARD_KG, spread=_SPREAD)
    return _lead_deg(_ups(mt, engine.Start.TOGETHER, _SETTLE_S))


def _inphase_run() -> float:
    """Two identical metronomes on his board, let go 170° apart: how far apart
    they swing after 200 s, degrees."""
    mt = engine.Metronomes(count=2, spread=0.0)
    return abs(_lead_deg(_ups(mt, engine.Start.OPPOSITE, _SETTLE_S), last=5))


def _five_run() -> float:
    """Five identical metronomes on his board, let go at the exhibit's
    scattered phases: the order parameter after two minutes."""
    mt = engine.Metronomes(count=5, spread=0.0)
    f = engine.rhs(mt, (True,) * 5)
    y = engine.start_state(engine.Start.SCATTERED, 5)
    h = engine.STEP_S * engine.RATE_PER_S
    for k in range(round(120.0 / engine.STEP_S)):
        y = numerics.rk4(f, k * h, y, h)
    re = sum(math.cos(math.atan2(-y[5 + i], y[i])) for i in range(5))
    im = sum(math.sin(math.atan2(-y[5 + i], y[i])) for i in range(5))
    return math.hypot(re, im) / 5


def _setting(count: int, spread: float, free: bool, start: engine.Start) -> dict[str, float | str]:
    """What the page's "Set it up" sets: the build, and how they are let go."""
    return {
        "count": count,
        "board_kg": engine.BOARD_KG,
        "spread": spread,
        "board": "free" if free else "held",
        "start": start.value,
    }


CASES: tuple[Case, ...] = (
    Case(
        key="lone",
        unit="°",
        expected=lambda: math.degrees(2 * _THETA0),
        measured=_lone_deg,
        # The van der Pol swing is 2θ₀ at the first order in μ; the full
        # pendulum's sine makes it 0.3 % wider here.
        tolerance=1e-2,
        sources=(_MODEL, _NUMBERS),
        setting=_setting(1, 0.0, False, engine.Start.SMALL),
    ),
    Case(
        key="drift",
        unit="s",
        expected=_drift_hand,
        measured=_drift_s,
        # Δ² and γ² are left out by the source's first order: 1.4 · 10⁻⁴ here.
        tolerance=1e-3,
        sources=(_UNCOUPLED, _RATE, _NUMBERS),
        derived=True,
        setting=_setting(2, _SPREAD, False, engine.Start.TOGETHER),
    ),
    Case(
        key="lag",
        unit="°",
        expected=_lag_hand,
        measured=_lag_run,
        # The averaging keeps the swing's size only in its rate; in the
        # board's push the sine and cosine of a 45° swing are taken as for a
        # small one, which is a term of γ's order times a few: 5.4 % here.
        tolerance=0.08,
        sources=(_LAG, _NUMBERS),
        setting=_setting(2, _SPREAD, True, engine.Start.TOGETHER),
    ),
    Case(
        key="inphase",
        unit="°",
        expected=lambda: 0.0,
        measured=_inphase_run,
        # Near the in-phase swing the lag shrinks as e^(−μτ/2) (his Eq. (21)):
        # from 170° to 6 · 10⁻⁴ ° in 200 s.
        tolerance=1e-2,
        sources=(_INPHASE, _NUMBERS),
        setting=_setting(2, 0.0, True, engine.Start.OPPOSITE),
    ),
    Case(
        key="five",
        unit="",
        expected=lambda: 1.0,
        measured=_five_run,
        # Identical metronomes end exactly as one; after two minutes
        # 5 · 10⁻⁶ is left.
        tolerance=1e-4,
        sources=(_ORDER, _NUMBERS),
        setting=_setting(5, 0.0, True, engine.Start.SCATTERED),
    ),
)
