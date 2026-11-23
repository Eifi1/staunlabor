"""Lessons 0 and 1: a balance becomes a first-order lag, and a lag is read for
its time constant.

The tank is the recipe's first example because nothing about it needs a
formula to believe: water comes in at a rate somebody sets, leaves faster the
higher it stands, and so settles where the two are equal. Writing that balance
down — ``A·ḣ = q_in − k·h`` — *is* ``τ·ẏ + y = K·u`` with ``τ = A/k``, and every
later system with one store and one resistance (a thermometer, an RC network, a
spring with a damper and no mass, an evacuated chamber) is the same equation in
other units, which :func:`analogies` puts side by side with numbers.

What it deliberately leaves out: a nonlinear outflow (a real orifice drains
with ``√h``, which is why a tank's level does not quite follow an exponential
near empty), and the dynamics of the measurement itself — the lesson's sensor
is the system, not something reading it.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass
from enum import StrEnum

from staunlabor.domain.course.lti import linspace, step_pt1

#: How many points a smooth curve is drawn with. A chart five hundred pixels
#: wide cannot show more, and the response is JSON.
CURVE_POINTS = 241
#: The multiples of τ a step response is marked at, with what each one means:
#: 63 %, 86 %, 95 % and 99.3 % of the way.
TAU_MARKS = (1, 2, 3, 5)


@dataclass(frozen=True)
class TankRun:
    """The tank filled from ``level0`` by a constant inflow.

    Levels in metres, flows in litres per second. ``time_constant_s`` is
    ``1000·A/k`` (the 1000 turns the area's cubic metres into litres) and
    ``level_final_m`` is where inflow and outflow balance, ``q/k``.
    """

    time_s: tuple[float, ...]
    level_m: tuple[float, ...]
    outflow_lps: tuple[float, ...]
    inflow_lps: float
    time_constant_s: float
    level_final_m: float


def tank(inflow_lps: float, area_m2: float, outflow_lps_per_m: float, level0_m: float = 0.0) -> TankRun:
    if area_m2 <= 0 or outflow_lps_per_m <= 0:
        raise ValueError("The tank needs a positive area and a positive outflow coefficient.")
    if inflow_lps < 0 or level0_m < 0:
        raise ValueError("An inflow or a level cannot be negative.")
    tau = 1000 * area_m2 / outflow_lps_per_m
    final = inflow_lps / outflow_lps_per_m
    ts = linspace(0.0, 5 * tau, CURVE_POINTS)
    levels = [step_pt1(t, tau, level0_m, final) for t in ts]
    return TankRun(
        time_s=tuple(ts),
        level_m=tuple(levels),
        outflow_lps=tuple(outflow_lps_per_m * h for h in levels),
        inflow_lps=inflow_lps,
        time_constant_s=tau,
        level_final_m=final,
    )


@dataclass(frozen=True)
class TauMark:
    """The response at ``multiple``·τ: its time, its value, and the fraction of
    the way from start to final value it has covered."""

    multiple: int
    time_s: float
    value: float
    fraction: float


@dataclass(frozen=True)
class FirstOrderStep:
    """``y(t) = y∞ + (y₀ − y∞)·e^{−t/τ}`` over five and a bit time constants.

    ``remaining`` is ``|y − y∞|``, the series that is a straight line on a
    logarithmic axis — the lesson's third claim, drawn rather than asserted.
    ``tangent_end_s`` is where the starting tangent reaches the final value,
    which is ``τ`` exactly: the other way to read τ off a plot.
    """

    time_s: tuple[float, ...]
    value: tuple[float, ...]
    remaining: tuple[float, ...]
    marks: tuple[TauMark, ...]
    tangent_end_s: float
    at_s: float
    at_value: float
    at_fraction: float


def first_order_step(time_constant_s: float, start: float, final: float, at_s: float) -> FirstOrderStep:
    if time_constant_s <= 0:
        raise ValueError("A time constant must be positive.")
    if at_s < 0:
        raise ValueError("A time on the curve cannot be negative.")
    tau = time_constant_s

    def y(t: float) -> float:
        return step_pt1(t, tau, start, final)

    def fraction(t: float) -> float:
        return 1 - math.exp(-t / tau)

    ts = linspace(0.0, 6 * tau, CURVE_POINTS)
    return FirstOrderStep(
        time_s=tuple(ts),
        value=tuple(y(t) for t in ts),
        remaining=tuple(abs(y(t) - final) for t in ts),
        marks=tuple(TauMark(m, m * tau, y(m * tau), fraction(m * tau)) for m in TAU_MARKS),
        tangent_end_s=tau,
        at_s=at_s,
        at_value=y(at_s),
        at_fraction=fraction(at_s),
    )


class AnalogyKind(StrEnum):
    """Four systems that are all ``τ·ẏ + y = K·u``."""

    thermal = "thermal"
    electrical = "electrical"
    mechanical = "mechanical"
    vacuum = "vacuum"


@dataclass(frozen=True)
class Analogy:
    """The two quantities whose ratio or product is τ in one domain, with a
    value for each that gives the τ asked for.

    ``thermal``: heat capacity in J/K over conductance in W/K. ``electrical``:
    resistance in Ω times capacitance in F. ``mechanical``: damping in N·s/m
    over stiffness in N/m. ``vacuum``: volume in L over pumping speed in L/s.
    The second quantity is fixed at a round, plausible value and the first is
    solved for, so the reader sees a τ of four seconds made out of numbers a
    real part could have.
    """

    kind: AnalogyKind
    storage: float
    resistance: float
    time_constant_s: float


#: The fixed half of each pair: 10 W/K, 10 kΩ, 1000 N/m, 10 L/s.
_ANALOGY_FIXED = {
    AnalogyKind.thermal: 10.0,
    AnalogyKind.electrical: 10_000.0,
    AnalogyKind.mechanical: 1000.0,
    AnalogyKind.vacuum: 10.0,
}


def analogies(time_constant_s: float) -> tuple[Analogy, ...]:
    if time_constant_s <= 0:
        raise ValueError("A time constant must be positive.")
    out = []
    for kind, fixed in _ANALOGY_FIXED.items():
        if kind is AnalogyKind.electrical:
            # τ = R·C: the resistance is the fixed one, the capacitance solved.
            out.append(
                Analogy(kind, storage=time_constant_s / fixed, resistance=fixed, time_constant_s=time_constant_s)
            )
        else:
            # τ = storage/conductance (C/k, d/c, V/S): the conductance is fixed.
            out.append(
                Analogy(kind, storage=time_constant_s * fixed, resistance=fixed, time_constant_s=time_constant_s)
            )
    return tuple(out)


@dataclass(frozen=True)
class Measurement:
    """A noisy first-order step with a time constant the reader has to find.

    ``level_63`` is the value 63.2 % of the way from ``start`` to ``final`` —
    the line the reader drags a marker to — and ``time_constant_s`` the answer,
    sent with the samples because the page compares the reader's reading with it
    in front of them; nothing is hidden from somebody who opens the network tab,
    and nothing needs to be.
    """

    seed: int
    time_s: tuple[float, ...]
    value: tuple[float, ...]
    start: float
    final: float
    level_63: float
    time_constant_s: float
    noise: float


#: A measurement's window is fixed rather than scaled to its τ, or the window
#: would give the answer away.
MEASUREMENT_WINDOW_S = 40.0
MEASUREMENT_SAMPLES = 401


def first_order_measurement(seed: int) -> Measurement:
    """A sensor dipped from one temperature into another, sampled at 10 Hz with
    noise of one percent of the step — the same ``seed`` always draws the same
    curve, so a page reload is the same exercise."""
    rng = random.Random(seed)
    tau = round(rng.uniform(1.5, 8.0), 2)
    start = round(rng.uniform(15.0, 30.0), 1)
    final = round(start + rng.choice((-1, 1)) * rng.uniform(30.0, 60.0), 1)
    noise = 0.01 * abs(final - start)
    ts = linspace(0.0, MEASUREMENT_WINDOW_S, MEASUREMENT_SAMPLES)
    values = [step_pt1(t, tau, start, final) + rng.gauss(0.0, noise) for t in ts]
    return Measurement(
        seed=seed,
        time_s=tuple(ts),
        value=tuple(values),
        start=start,
        final=final,
        level_63=start + (1 - math.exp(-1)) * (final - start),
        time_constant_s=tau,
        noise=noise,
    )
