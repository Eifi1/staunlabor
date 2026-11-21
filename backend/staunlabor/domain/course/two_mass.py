"""Lesson 6: two inertias on two springs — modes, antiresonances, and why a
torque shaft between a motor and a heavy adapter misreads at a few hertz.

The rig: a motor ``J₁``, a measuring shaft ``c₁, d₁``, a column or adapter
``J₂``, the test object as a torsion bar ``c₂, d₂`` to ground. The motor's
torque drives it; the shaft *reads* ``M_W = (c₁ + jωd₁)(φ₁ − φ₂)`` while what
the test object actually carries is ``M_T = (c₂ + jωd₂)·φ₂``. Between the two
sits ``J₂``, and ``J₂·φ̈₂ = M_W − M_T``: whatever it takes to accelerate the
adapter is in the reading and not in the test object.

Undamped, the ratio is exact and one line: ``M_W/M_T = (c₂ − J₂ω²)/c₂ =
1 − (f/f_a)²`` with ``f_a = √(c₂/J₂)/2π`` — the frequency at which the adapter
rings on the test object alone and the shaft reads nothing at all. That zero is
what the specification called the *Tilgerpunkt*, at 7.63 Hz; with the default
damping the minimum of ``|M_W|`` sits a little higher, at 7.9 Hz, because the
response of ``φ₂`` is still falling steeply there — the page marks the zero and
says that.

What it leaves out: the shaft's own inertia (split half to each end, it would
shift both modes by a few percent), and the motor's current loop — the drive is
an ideal torque.
"""

from __future__ import annotations

import cmath
import math
import random
from dataclasses import dataclass
from enum import StrEnum

from staunlabor.domain.course.chain import Chain, Ground, Mode, forced, modes, series_stiffness
from staunlabor.domain.course.lti import logspace

BODE_POINTS = 600
BODE_RANGE_HZ = (1.0, 60.0)
#: How many periods the compensation runs: the three it shows, and two either
#: side of them for the filters' run-in.
COMPENSATION_PERIODS = 7
#: The most samples one compensation run may take. The record is ``7·rate/f``
#: long, and the fields' bounds allow a hundredth of a hertz sampled at 20 kHz:
#: fourteen million samples, gigabytes of lists, from one public request. The
#: cap is the lesson's own corner, 10 kHz for seven periods of 1 Hz, which
#: takes about 130 ms — the order of the dearest exhibit's route.
MAX_SAMPLES = 70_000


@dataclass(frozen=True)
class TwoMassParameters:
    motor_inertia: float = 0.01
    adapter_inertia: float = 0.05
    shaft_stiffness: float = 500.0
    bar_stiffness: float = 115.0
    shaft_damping: float = 0.2
    bar_damping: float = 0.3

    def chain(self) -> Chain:
        return Chain(
            inertia=(self.motor_inertia, self.adapter_inertia),
            stiffness=(self.shaft_stiffness,),
            damping=(self.shaft_damping,),
            ground_right=Ground(self.bar_stiffness, self.bar_damping),
        )


@dataclass(frozen=True)
class Phasor:
    """A complex amplitude as the page draws it: its size and its angle."""

    magnitude: float
    phase_deg: float


def _phasor(z: complex) -> Phasor:
    return Phasor(abs(z), math.degrees(cmath.phase(z)))


@dataclass(frozen=True)
class ForcedPoint:
    """The rig under 1 N·m of motor torque at one frequency.

    ``ratio`` is ``φ₂/φ₁`` and ``in_phase`` whether its real part is positive
    (the two inertias turn the same way). ``reading_ratio`` is ``|M_W/M_T|``
    and ``error_pct`` ``(|M_W/M_T| − 1)·100`` — how far the shaft misreads the
    test object, negative below ``f_a``.
    """

    frequency_hz: float
    motor: Phasor
    adapter: Phasor
    ratio: Phasor
    in_phase: bool
    shaft_torque: Phasor
    bar_torque: Phasor
    reading_ratio: float | None
    error_pct: float | None


@dataclass(frozen=True)
class TwoMass:
    parameters: TwoMassParameters
    modes: tuple[Mode, ...]
    hand_estimate_hz: float
    hand_deviation_pct: float | None
    absorber_hz: float
    motor_still_hz: float
    frequency_hz: tuple[float, ...]
    shaft_magnitude: tuple[float, ...]
    bar_magnitude: tuple[float, ...]
    point: ForcedPoint


def _point(p: TwoMassParameters, chain: Chain, f: float) -> ForcedPoint:
    phi1, phi2 = forced(chain, f, (1.0, 0.0))
    w = 2 * math.pi * f
    mw = complex(p.shaft_stiffness, w * p.shaft_damping) * (phi1 - phi2)
    mt = complex(p.bar_stiffness, w * p.bar_damping) * phi2
    ratio = phi2 / phi1 if phi1 != 0 else 0j
    reading = abs(mw / mt) if mt != 0 else None
    return ForcedPoint(
        frequency_hz=f,
        motor=_phasor(phi1),
        adapter=_phasor(phi2),
        ratio=_phasor(ratio),
        in_phase=ratio.real > 0,
        shaft_torque=_phasor(mw),
        bar_torque=_phasor(mt),
        reading_ratio=reading,
        error_pct=(reading - 1) * 100 if reading is not None else None,
    )


def two_mass(p: TwoMassParameters, excitation_hz: float) -> TwoMass:
    if excitation_hz <= 0:
        raise ValueError("The excitation frequency must be positive.")
    chain = p.chain()
    found = modes(chain)
    # Every inertia on the series spring: the whole rig as one mass.
    hand = math.sqrt(series_stiffness(p.shaft_stiffness, p.bar_stiffness) / (p.motor_inertia + p.adapter_inertia))
    hand_hz = hand / (2 * math.pi)
    freqs = logspace(*BODE_RANGE_HZ, BODE_POINTS)
    shaft_mag = []
    bar_mag = []
    for f in freqs:
        pt = _point(p, chain, f)
        shaft_mag.append(pt.shaft_torque.magnitude)
        bar_mag.append(pt.bar_torque.magnitude)
    return TwoMass(
        parameters=p,
        modes=tuple(found),
        hand_estimate_hz=hand_hz,
        hand_deviation_pct=(hand_hz / found[0].frequency_hz - 1) * 100 if found else None,
        absorber_hz=math.sqrt(p.bar_stiffness / p.adapter_inertia) / (2 * math.pi),
        motor_still_hz=math.sqrt((p.shaft_stiffness + p.bar_stiffness) / p.adapter_inertia) / (2 * math.pi),
        frequency_hz=tuple(freqs),
        shaft_magnitude=tuple(shaft_mag),
        bar_magnitude=tuple(bar_mag),
        point=_point(p, chain, excitation_hz),
    )


class Differentiator(StrEnum):
    """What the twice-differentiated angle is cleaned with before ``J₂·φ̈₂`` is
    subtracted: nothing, a PT1 run forward (which delays it), or a PT1 run
    forward and backward (which does not, and works only offline)."""

    none = "none"
    lowpass = "lowpass"
    zero_phase = "zero_phase"


@dataclass(frozen=True)
class Compensation:
    """Three periods of the rig at one frequency: what the test object carries,
    what the shaft reads, and the reading with ``J₂·φ̈₂`` taken off it, the
    acceleration from a noisy angle differentiated twice.

    The ``*_error`` figures are root-mean-square differences from ``M_T``:
    ``uncompensated_error`` is the shaft's own misreading, ``compensated_error``
    what is left after the correction, noise included — the price of the
    correction is the gap between the two at high noise.
    """

    frequency_hz: float
    sample_rate_hz: float
    time_s: tuple[float, ...]
    bar_torque: tuple[float, ...]
    shaft_torque: tuple[float, ...]
    compensated: tuple[float, ...]
    uncompensated_error: float
    compensated_error: float
    noise_torque: float


def _lowpass(values: list[float], h: float, corner_hz: float) -> list[float]:
    a = math.exp(-h * 2 * math.pi * corner_hz)
    y = values[0]
    out = []
    for u in values:
        y = a * y + (1 - a) * u
        out.append(y)
    return out


def mass_compensation(
    p: TwoMassParameters,
    excitation_hz: float,
    noise_rad: float,
    sample_rate_hz: float,
    differentiator: Differentiator,
    corner_hz: float,
    seed: int = 1,
) -> Compensation:
    if excitation_hz <= 0 or sample_rate_hz < 20 * excitation_hz:
        raise ValueError("Sample at least twenty times the excitation frequency.")
    if noise_rad < 0 or corner_hz <= 0:
        raise ValueError("The noise cannot be negative and the corner frequency must be positive.")
    n = round(COMPENSATION_PERIODS * sample_rate_hz / excitation_hz)
    if n > MAX_SAMPLES:
        raise ValueError(
            f"{n} samples is more than the {MAX_SAMPLES} one run may take; sample slower or excite faster."
        )
    chain = p.chain()
    phi1, phi2 = forced(chain, excitation_hz, (1.0, 0.0))
    w = 2 * math.pi * excitation_hz
    mw_hat = complex(p.shaft_stiffness, w * p.shaft_damping) * (phi1 - phi2)
    mt_hat = complex(p.bar_stiffness, w * p.bar_damping) * phi2
    h = 1 / sample_rate_hz
    rng = random.Random(seed)
    ts = [k * h for k in range(n + 1)]
    angle = [(phi2 * cmath.exp(1j * w * t)).real + rng.gauss(0.0, noise_rad) for t in ts]
    # The second central difference, then the chosen cleaning.
    acc = [0.0] * len(angle)
    for k in range(1, len(angle) - 1):
        acc[k] = (angle[k + 1] - 2 * angle[k] + angle[k - 1]) / (h * h)
    acc[0], acc[-1] = acc[1], acc[-2]
    if differentiator is Differentiator.lowpass:
        acc = _lowpass(acc, h, corner_hz)
    elif differentiator is Differentiator.zero_phase:
        acc = _lowpass(_lowpass(acc, h, corner_hz)[::-1], h, corner_hz)[::-1]
    shaft = [(mw_hat * cmath.exp(1j * w * t)).real for t in ts]
    bar = [(mt_hat * cmath.exp(1j * w * t)).real for t in ts]
    comp = [m - p.adapter_inertia * a for m, a in zip(shaft, acc, strict=True)]
    # Three periods from the middle, clear of the filters' run-in at both ends.
    per = round(sample_rate_hz / excitation_hz)
    lo, hi = 2 * per, 5 * per + 1
    window = range(lo, hi)

    def rms(xs: list[float]) -> float:
        return math.sqrt(sum(x * x for x in xs) / len(xs))

    return Compensation(
        frequency_hz=excitation_hz,
        sample_rate_hz=sample_rate_hz,
        time_s=tuple(ts[i] - ts[lo] for i in window),
        bar_torque=tuple(bar[i] for i in window),
        shaft_torque=tuple(shaft[i] for i in window),
        compensated=tuple(comp[i] for i in window),
        uncompensated_error=rms([shaft[i] - bar[i] for i in window]),
        compensated_error=rms([comp[i] - bar[i] for i in window]),
        # The standard deviation white angle noise reaches the torque with:
        # √6·σ/h² for the three-point second difference, times J₂.
        noise_torque=p.adapter_inertia * math.sqrt(6) * noise_rad / (h * h),
    )
