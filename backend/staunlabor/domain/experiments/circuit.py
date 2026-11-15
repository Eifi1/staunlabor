"""The slow LC circuit: a capacitor discharged through a big coil swings back and forth, like a pendulum.

The exhibit is a physics room's classic, built large: a capacitor, a coil on a
closed iron core, a battery, a switch and a meter with its zero in the middle.
Held on the battery, the switch charges the capacitor; thrown over to the coil,
it lets the capacitor discharge through it — and the needle swings to one side,
back through zero to the other, and back again, about once a second, each
swing smaller, for some ten seconds. A capacitor and a coil have no moving
part, yet the current swings like a pendulum.

**Why it swings.** The capacitor's voltage drives a current through the coil;
the coil holds the current back as it grows and keeps it flowing as it fades
(its self-induction, ``L·di/dt``): the current has inertia. When the capacitor
is empty, the current is at its strongest and goes on, charging the capacitor
the other way round, until it stops and the capacitor drives it back. The
energy goes from the capacitor's field (``q²/2C``) into the coil's
(``L·i²/2``) and back; the wire's resistance turns a little of it into heat on
every pass.

**The model.** Round the loop, the capacitor's voltage is what the coil and the
resistance take: ``L·q̈ + R·q̇ + q/C = 0``, the charge ``q`` let go from
``C·U₀`` at rest. It is the damped spring's equation, ``m·ẍ + b·ẋ + k·x = 0``,
with ``L`` the mass, ``1/C`` the spring's stiffness and ``R`` the friction —
and its exact solution: with ``ω₀ = 1/√(LC)`` and ``γ = R/2L``, the charge is
``Q₀·e^{−γt}·(cos ω_d t + γ·sin(ω_d t)/ω_d)``, ``ω_d = √(ω₀² − γ²)``, while
``γ < ω₀``; at ``R = 2·√(L/C)`` and above, ``cosh`` and ``sinh`` take the place
of ``cos`` and ``sin`` and it no longer swings: it creeps back. The current is
the one the capacitor drives, ``i = −q̇ = Q₀·ω₀²·e^{−γt}·sin(ω_d t)/ω_d``.

**What it leaves out.** The iron core's own losses (its magnetisation lags and
eddy currents stir in it) and its saturation: ``L`` is a constant, as for a
core never driven near its limit; the capacitors' leakage; the meter's own
resistance, which is counted in ``R``. The values are an illustrative build:
a coil of 200 H with 90 Ω of wire on its closed iron core, 125 µF of
capacitors (film, not electrolytic: the voltage turns round), 10 V.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Literal

#: A swing counts while its peak is at least this share of the first's.
SWING_FLOOR = 0.1

Regime = Literal["swings", "critical", "creeps"]


@dataclass(frozen=True)
class Circuit:
    #: The coil on its closed iron core.
    inductance_h: float = 200.0
    capacitance_f: float = 125e-6
    #: The whole loop's: the coil's wire, mostly.
    resistance_ohm: float = 90.0
    #: The battery the capacitor is charged from.
    voltage_v: float = 10.0

    def __post_init__(self) -> None:
        if not 0 < self.inductance_h <= 1000:
            raise ValueError("a coil has more than nothing and at most 1000 H")
        if not 0 < self.capacitance_f <= 0.1:
            raise ValueError("a capacitor holds more than nothing and at most 0.1 F")
        if not 0 < self.resistance_ohm <= 1e5:
            raise ValueError("a loop's resistance lies above nothing and at most 100 kΩ")
        if not 0 < self.voltage_v <= 1000:
            raise ValueError("the battery gives more than nothing and at most 1000 V")


def rates(circuit: Circuit) -> tuple[float, float]:
    """``(ω₀, γ)``: the undamped circuit's angular frequency, ``1/√(LC)``, and the
    damping rate, ``R/2L``, both in 1/s."""
    return 1 / math.sqrt(circuit.inductance_h * circuit.capacitance_f), circuit.resistance_ohm / (
        2 * circuit.inductance_h
    )


def regime(circuit: Circuit) -> Regime:
    """Whether it swings (``γ < ω₀``), creeps back (``γ > ω₀``) or stands exactly
    between (critical damping, ``R = 2·√(L/C)``)."""
    omega0, gamma = rates(circuit)
    if gamma < omega0:
        return "swings"
    return "critical" if gamma == omega0 else "creeps"


def _modes(circuit: Circuit, t_s: float) -> tuple[float, float]:
    """``e^{−γt}·c(t)`` and ``e^{−γt}·s(t)``: ``c = cos ω_d t`` and ``s = sin(ω_d t)/ω_d``
    while it swings, ``cosh β t`` and ``sinh(β t)/β`` (``β = √(γ² − ω₀²)``) when it
    creeps, ``1`` and ``t`` between. Creeping, the growing exponential is taken
    out first, ``e^{(β−γ)t}·(1 ± e^{−2βt})/2``: it never overflows, and ``expm1``
    keeps ``sinh(βt)/β`` exact as ``β`` shrinks towards the critical case."""
    omega0, gamma = rates(circuit)
    damp = math.exp(-gamma * t_s)
    kind = regime(circuit)
    if kind == "swings":
        omega_d = math.sqrt(omega0 * omega0 - gamma * gamma)
        return damp * math.cos(omega_d * t_s), damp * math.sin(omega_d * t_s) / omega_d
    if kind == "critical":
        return damp, damp * t_s
    beta = math.sqrt(gamma * gamma - omega0 * omega0)
    grow = math.exp((beta - gamma) * t_s)
    fade = math.exp(-2 * beta * t_s)
    return grow * (1 + fade) / 2, grow * -math.expm1(-2 * beta * t_s) / (2 * beta)


def state(circuit: Circuit, t_s: float) -> tuple[float, float]:
    """``(q, i)`` at ``t_s`` after the switch is thrown: the charge on the
    capacitor (C) and the current it drives through the coil (A), positive
    at first."""
    if t_s < 0:
        raise ValueError("the circuit is asked about from the moment the switch is thrown")
    omega0, gamma = rates(circuit)
    charge = circuit.capacitance_f * circuit.voltage_v
    c, s = _modes(circuit, t_s)
    return charge * (c + gamma * s), charge * omega0 * omega0 * s


def energies(circuit: Circuit, t_s: float) -> tuple[float, float]:
    """``(q²/2C, L·i²/2)``: the energy in the capacitor and in the coil, in J; what
    is missing from ``C·U₀²/2`` has gone into heat."""
    q, i = state(circuit, t_s)
    return q * q / (2 * circuit.capacitance_f), circuit.inductance_h * i * i / 2


def first_peak_s(circuit: Circuit) -> float:
    """When the current is strongest: ``atan2(ω_d, γ)/ω_d`` while it swings,
    ``1/γ`` at the edge, ``artanh(β/γ)/β`` when it creeps."""
    omega0, gamma = rates(circuit)
    kind = regime(circuit)
    if kind == "swings":
        omega_d = math.sqrt(omega0 * omega0 - gamma * gamma)
        return math.atan2(omega_d, gamma) / omega_d
    if kind == "critical":
        return 1 / gamma
    beta = math.sqrt(gamma * gamma - omega0 * omega0)
    return math.atanh(beta / gamma) / beta


def swings(circuit: Circuit) -> int:
    """The needle's swings, one way or the other, whose peak is at least a tenth of
    the first's. Each peak is ``e^{−γπ/ω_d}`` of the one before; a circuit that
    creeps back swings once."""
    omega0, gamma = rates(circuit)
    if regime(circuit) != "swings":
        return 1
    omega_d = math.sqrt(omega0 * omega0 - gamma * gamma)
    return math.floor(math.log(1 / SWING_FLOOR) * omega_d / (gamma * math.pi)) + 1


@dataclass(frozen=True)
class CircuitFigures:
    regime: Regime
    #: ``2π·√(LC)``: one swing there and back without the resistance.
    natural_period_s: float
    #: ``2π/ω_d``, with it; ``None`` when it creeps back.
    period_s: float | None
    #: ``2L/R``: the swings' size falls to ``1/e`` in this time.
    decay_s: float
    #: ``√(L/C)/R``: the quality, about the swings in which the size falls to ``e^{−π}``.
    quality: float
    #: ``2·√(L/C)``: from this resistance on, it no longer swings.
    critical_ohm: float
    swings: int
    #: The strongest current, and when.
    peak_current_a: float
    peak_s: float
    #: ``C·U₀²/2``.
    energy_j: float


def figures(circuit: Circuit) -> CircuitFigures:
    omega0, gamma = rates(circuit)
    kind = regime(circuit)
    peak = first_peak_s(circuit)
    return CircuitFigures(
        regime=kind,
        natural_period_s=2 * math.pi / omega0,
        period_s=2 * math.pi / math.sqrt(omega0 * omega0 - gamma * gamma) if kind == "swings" else None,
        decay_s=1 / gamma,
        quality=omega0 / (2 * gamma),
        critical_ohm=2 * math.sqrt(circuit.inductance_h / circuit.capacitance_f),
        swings=swings(circuit),
        peak_current_a=state(circuit, peak)[1],
        peak_s=peak,
        energy_j=circuit.capacitance_f * circuit.voltage_v**2 / 2,
    )
