"""Lesson 2: a mass on a spring with a damper — ω₀ and D, the step, the
magnification, and the decay test that measures D without knowing the mass.

The lesson's system is a torque measuring shaft: an inertia ``J`` on a torsional
stiffness ``c`` with a little damping ``d``, ``J·φ̈ + d·φ̇ + c·φ = M``. Two
numbers say everything about it — ``ω₀ = √(c/J)`` and ``D = d/(2√(cJ))`` — and
the reader can set it either way: as the parts it is built of, or as the two
numbers directly, with the inertia held so that the parts follow.

What it leaves out: the shaft's own distributed mass (a shaft is a chain of
infinitely many inertias; one lumped inertia is the first mode of it, which is
the one a measuring chain cares about), and friction that is not viscous.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass

from staunlabor.domain.course.lti import (
    Regime,
    SecondOrderFigures,
    linspace,
    log_decrement,
    logspace,
    magnification,
    second_order_figures,
    step_pt2,
)

CURVE_POINTS = 801
#: The damping ratios the magnification is drawn for beside the reader's own.
REFERENCE_DAMPINGS = (0.05, 0.1, 0.3, 0.7, 1.0)
#: The largest magnification drawn: an undamped curve at resonance is infinite.
V_CAP = 1e4


@dataclass(frozen=True)
class Oscillator:
    """The same system in both of its descriptions."""

    inertia: float
    stiffness: float
    damping_coefficient: float
    f0_hz: float
    damping_ratio: float


def oscillator(
    inertia: float,
    stiffness: float | None = None,
    damping_coefficient: float | None = None,
    f0_hz: float | None = None,
    damping_ratio: float | None = None,
) -> Oscillator:
    """From the parts (``stiffness`` and ``damping_coefficient``) or from the two
    numbers (``f0_hz`` and ``damping_ratio``), the inertia held either way."""
    if inertia <= 0:
        raise ValueError("The inertia must be positive.")
    if stiffness is not None and damping_coefficient is not None:
        if stiffness <= 0 or damping_coefficient < 0:
            raise ValueError("The stiffness must be positive and the damping not negative.")
        w0 = math.sqrt(stiffness / inertia)
        d_ratio = damping_coefficient / (2 * math.sqrt(stiffness * inertia))
        return Oscillator(inertia, stiffness, damping_coefficient, w0 / (2 * math.pi), d_ratio)
    if f0_hz is not None and damping_ratio is not None:
        if f0_hz <= 0 or damping_ratio < 0:
            raise ValueError("The natural frequency must be positive and the damping not negative.")
        w0 = 2 * math.pi * f0_hz
        c = inertia * w0 * w0
        return Oscillator(inertia, c, 2 * damping_ratio * math.sqrt(c * inertia), f0_hz, damping_ratio)
    raise ValueError("Give either the stiffness and the damping, or the natural frequency and the damping ratio.")


@dataclass(frozen=True)
class SecondOrderStep:
    """The response to a torque step, and the numbers it is read for.

    ``final_value`` is ``M/c``; ``envelope_upper``/``envelope_lower`` are
    ``final·(1 ± e^{−Dω₀t}/√(1 − D²))`` while the system is under-damped and
    empty otherwise, because an over-damped response has no envelope to draw.
    """

    system: Oscillator
    figures: SecondOrderFigures
    time_s: tuple[float, ...]
    value: tuple[float, ...]
    envelope_upper: tuple[float, ...]
    envelope_lower: tuple[float, ...]
    final_value: float
    peak_value: float | None


def _window(fig: SecondOrderFigures) -> float:
    """How long to draw: until it has settled, but never less than three
    periods nor more than forty — an undamped one never settles at all."""
    period = 2 * math.pi / fig.w0
    if fig.settling_time_s is None:
        return 10 * period
    return min(max(1.5 * fig.settling_time_s, 3 * period), 40 * period)


def second_order_step(system: Oscillator, torque: float) -> SecondOrderStep:
    fig = second_order_figures(2 * math.pi * system.f0_hz, system.damping_ratio)
    final = torque / system.stiffness
    ts = linspace(0.0, _window(fig), CURVE_POINTS)
    values = tuple(step_pt2(t, final, fig.w0, fig.damping) for t in ts)
    upper: tuple[float, ...] = ()
    lower: tuple[float, ...] = ()
    if fig.regime is Regime.underdamped:
        k = 1 / math.sqrt(1 - fig.damping**2)
        sigma = fig.damping * fig.w0
        upper = tuple(final * (1 + k * math.exp(-sigma * t)) for t in ts)
        lower = tuple(final * (1 - k * math.exp(-sigma * t)) for t in ts)
    return SecondOrderStep(
        system=system,
        figures=fig,
        time_s=tuple(ts),
        value=values,
        envelope_upper=upper,
        envelope_lower=lower,
        final_value=final,
        peak_value=final * (1 + fig.overshoot) if fig.overshoot is not None else None,
    )


@dataclass(frozen=True)
class MagnificationCurve:
    damping: float
    value: tuple[float, ...]


@dataclass(frozen=True)
class Magnification:
    """``V(η)`` on a logarithmic grid of ``η = f/f₀``, for the reader's damping
    and the references, and what it means at one excitation frequency.

    ``error_pct`` is ``(V − 1)·100``: a measuring chain read below its natural
    frequency reports ``V`` times what it is fed, so this is how far off it reads.
    ``phase_deg`` is the lag at the same point.
    """

    ratio: tuple[float, ...]
    curves: tuple[MagnificationCurve, ...]
    damping: float
    f0_hz: float
    excitation_hz: float
    excitation_ratio: float
    excitation_value: float | None
    error_pct: float | None
    phase_deg: float
    peak_ratio: float | None
    peak_value: float


def magnification_at(system: Oscillator, excitation_hz: float) -> Magnification:
    if excitation_hz <= 0:
        raise ValueError("An excitation frequency must be positive.")
    d = system.damping_ratio
    etas = logspace(0.05, 20.0, 400)
    dampings = (d, *(r for r in REFERENCE_DAMPINGS if abs(r - d) > 1e-9))
    eta = excitation_hz / system.f0_hz
    v = magnification(eta, d)
    # An undamped system driven exactly at resonance has no finite answer, and
    # the curves are capped where the chart could not show more anyway.
    finite = math.isfinite(v)
    # The maximum sits at η = √(1 − 2D²) where there is one (D < 1/√2).
    peak_eta = math.sqrt(1 - 2 * d * d) if d < math.sqrt(0.5) else None
    peak = magnification(peak_eta, d) if peak_eta is not None else 1.0
    return Magnification(
        ratio=tuple(etas),
        curves=tuple(MagnificationCurve(dd, tuple(min(magnification(e, dd), V_CAP) for e in etas)) for dd in dampings),
        damping=d,
        f0_hz=system.f0_hz,
        excitation_hz=excitation_hz,
        excitation_ratio=eta,
        excitation_value=v if finite else None,
        error_pct=(v - 1) * 100 if finite else None,
        phase_deg=-math.degrees(math.atan2(2 * d * eta, 1 - eta * eta)),
        peak_ratio=peak_eta,
        peak_value=min(peak, V_CAP),
    )


@dataclass(frozen=True)
class Peak:
    """One maximum of the decay: where it is, and the value a reader clicking
    on the noisy curve would read there."""

    time_s: float
    value: float


@dataclass(frozen=True)
class PeakPair:
    """Two successive maxima and the damping they say."""

    first: int
    decrement: float
    damping: float


@dataclass(frozen=True)
class DecayTest:
    """A free decay with noise, its maxima, and every pair's answer.

    The reader clicks two successive maxima; the page looks the pair up here
    rather than computing a logarithm itself. ``overall_damping`` is read from
    the first and the last maximum, ``Λ = ln(x₀/xₙ)/n`` — one logarithm over
    many periods, which is why it is the steadier answer.
    """

    seed: int
    time_s: tuple[float, ...]
    value: tuple[float, ...]
    peaks: tuple[Peak, ...]
    pairs: tuple[PeakPair, ...]
    overall_damping: float | None
    true_damping: float
    f0_hz: float
    noise: float


def decay_test(seed: int) -> DecayTest:
    rng = random.Random(seed)
    d = round(rng.uniform(0.02, 0.12), 3)
    f0 = round(rng.uniform(8.0, 25.0), 1)
    amplitude = 10.0
    noise = 0.004 * amplitude
    w0 = 2 * math.pi * f0
    wd = w0 * math.sqrt(1 - d * d)
    sigma = d * w0
    t_end = min(12 / f0 / 1, 3.5 / sigma) if sigma > 0 else 12 / f0
    t_end = max(t_end, 6 / f0)
    rate = 40 * f0
    n = int(t_end * rate) + 1
    ts = [k / rate for k in range(n)]

    def clean(t: float) -> float:
        return amplitude * math.exp(-sigma * t) * (math.cos(wd * t) + sigma / wd * math.sin(wd * t))

    values = [clean(t) + rng.gauss(0.0, noise) for t in ts]
    # The maxima of the clean decay are at multiples of the damped period;
    # each is read off the noisy record at the nearest sample.
    peaks = []
    k = 0
    while True:
        tp = k * 2 * math.pi / wd
        if tp > ts[-1]:
            break
        idx = min(range(max(0, round(tp * rate) - 1), min(n, round(tp * rate) + 2)), key=lambda i: abs(ts[i] - tp))
        if values[idx] <= 3 * noise:
            break
        peaks.append(Peak(ts[idx], values[idx]))
        k += 1
    pairs = []
    for i in range(len(peaks) - 1):
        lam, dd = log_decrement(peaks[i].value, peaks[i + 1].value)
        pairs.append(PeakPair(i, lam, dd))
    if len(peaks) >= 2:
        lam_all = math.log(peaks[0].value / peaks[-1].value) / (len(peaks) - 1)
        overall: float | None = lam_all / math.sqrt(4 * math.pi**2 + lam_all**2)
    else:
        overall = None
    return DecayTest(
        seed=seed,
        time_s=tuple(ts),
        value=tuple(values),
        peaks=tuple(peaks),
        pairs=tuple(pairs),
        overall_damping=overall,
        true_damping=d,
        f0_hz=f0,
        noise=noise,
    )
