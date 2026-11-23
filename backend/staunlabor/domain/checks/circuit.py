"""The slow LC circuit, checked: the needle's period against the damped
circuit's frequency, the energy one swing keeps, the energy account with the
wire's heat, and the circuit at the edge where it stops swinging.

The engine answers in closed form, so what the page calls is the charge and
current at any instant (``state``) and the energies made of them; the checks
read those as the page reads them, over time.
"""

from __future__ import annotations

import math

from staunlabor.domain.checks import Case, Source
from staunlabor.domain.checks._hand import bisect
from staunlabor.domain.experiments import circuit as engine

_RLC = Source(
    cite="OpenStax, University Physics Volume 2, §14.6 RLC Series Circuits, Eqs. 14.45 and 14.46",
    url="https://openstax.org/books/university-physics-volume-2/pages/14-6-rlc-series-circuits",
    quote="q(t) = q₀e^(−Rt/2L) cos(ω′t + ϕ) (14.45) where the angular frequency of the oscillations is given by "
    "ω′ = √(1/LC − (R/2L)²) (14.46)",
)
_LOSS = Source(
    cite="OpenStax, University Physics Volume 2, §14.6 RLC Series Circuits, Eq. 14.43",
    url="https://openstax.org/books/university-physics-volume-2/pages/14-6-rlc-series-circuits",
    quote="When the switch is closed in the RLC circuit of Figure 14.17 (a), the capacitor begins to discharge and "
    "electromagnetic energy is dissipated by the resistor at a rate i²R. With U given by Equation 14.37, we have "
    "dU/dt = (q/C)(dq/dt) + Li(di/dt) = −i²R (14.43)",
)
_FIELDS = Source(
    cite="OpenStax, University Physics Volume 2, §14.5 Oscillations in an LC Circuit, before Eq. 14.36",
    url="https://openstax.org/books/university-physics-volume-2/pages/14-5-oscillations-in-an-lc-circuit",
    quote="At an arbitrary time when the capacitor charge is q(t) and the current is i(t), the total energy U in the "
    "circuit is given by q²(t)/2C + Li²(t)/2.",
)
_EDGE = Source(
    cite="OpenStax, University Physics Volume 2, §14.6 RLC Series Circuits, after Eq. 14.44",
    url="https://openstax.org/books/university-physics-volume-2/pages/14-6-rlc-series-circuits",
    quote="the result can be underdamped (√(k/m) > b/2m), critically damped (√(k/m) = b/2m), or overdamped "
    "(√(k/m) < b/2m). By analogy, the solution q(t) to the RLC differential equation has the same feature. … By "
    "replacing m by L, b by R, k by 1/C, and x by q in Equation 14.44",
)
_ROOTS = Source(
    cite="Wikipedia, “Damping”, §Damping ratio",
    url="https://en.wikipedia.org/wiki/Damping",
    quote="It can be solved with the approach x(t) = Ce^(st), where C and s are both complex constants, with s "
    "satisfying s = −ω_n(ζ ± i√(1 − ζ²)). … The case where ζ = 1 is the border between the overdamped and "
    "underdamped cases, and is referred to as critically damped.",
)

#: The page's build: 200 H, 125 µF, 90 Ω, 10 V.
_CLASSROOM = engine.Circuit()


def _omega_prime(circuit: engine.Circuit) -> float:
    """ω′ = √(1/LC − (R/2L)²), worked out here."""
    lc = circuit.inductance_h * circuit.capacitance_f
    return math.sqrt(1 / lc - (circuit.resistance_ohm / (2 * circuit.inductance_h)) ** 2)


def _period_hand_s(circuit: engine.Circuit) -> float:
    return 2 * math.pi / _omega_prime(circuit)


def _current(circuit: engine.Circuit, t_s: float) -> float:
    return engine.state(circuit, t_s)[1]


def _zero_s(circuit: engine.Circuit, lo: float, hi: float) -> float:
    """Where the needle passes zero between ``lo`` and ``hi``, by bisection."""
    above = _current(circuit, lo) > 0
    return bisect(lambda t: (_current(circuit, t) > 0) == above, lo, hi, 100)


def _period_run_s(circuit: engine.Circuit) -> float:
    """From the needle's first to its third pass through zero: there and back."""
    guess = _period_hand_s(circuit)
    return _zero_s(circuit, 1.3 * guess, 1.7 * guess) - _zero_s(circuit, 0.3 * guess, 0.7 * guess)


def _stored_j(circuit: engine.Circuit, t_s: float) -> float:
    """The capacitor's energy and the coil's, as the page's bar has them."""
    in_capacitor, in_coil = engine.energies(circuit, t_s)
    return in_capacitor + in_coil


def _kept_hand(circuit: engine.Circuit) -> float:
    """After one period the charge is q₀·e^(−RT/2L) again and the current zero:
    the energy, q²/2C, is e^(−RT/L) of the first."""
    return math.exp(-circuit.resistance_ohm * _period_hand_s(circuit) / circuit.inductance_h)


def _kept_run(circuit: engine.Circuit) -> float:
    return _stored_j(circuit, _period_hand_s(circuit)) / _stored_j(circuit, 0.0)


#: Ten seconds after the switch, when about 1 % is left.
_ACCOUNT_S = 10.0


def _account_run_mj(circuit: engine.Circuit, steps: int = 20000) -> float:
    """What is still stored after ten seconds, and the wire's heat ∫R·i² dt by
    Simpson's rule over the page's current."""
    h = _ACCOUNT_S / steps
    heat = sum((1 if k in (0, steps) else 4 if k % 2 else 2) * _current(circuit, k * h) ** 2 for k in range(steps + 1))
    heat *= h / 3 * circuit.resistance_ohm
    return (_stored_j(circuit, _ACCOUNT_S) + heat) * 1000


def _charged_mj(circuit: engine.Circuit) -> float:
    """C·U₀²/2: what the battery left in the capacitor."""
    return circuit.capacitance_f * circuit.voltage_v**2 / 2 * 1000


#: At the edge: R = 2√(L/C), where ω₀ = R/2L.
_EDGE_CIRCUIT = engine.Circuit(resistance_ohm=2 * math.sqrt(_CLASSROOM.inductance_h / _CLASSROOM.capacitance_f))


def _edge_hand_ma(circuit: engine.Circuit) -> float:
    """At the edge both roots are −ω₀: q = q₀(1 + ω₀t)e^(−ω₀t) from rest, the
    current i = −dq/dt = q₀ω₀²·t·e^(−ω₀t), strongest at t = 1/ω₀ with q₀ω₀/e."""
    omega0 = 1 / math.sqrt(circuit.inductance_h * circuit.capacitance_f)
    return circuit.capacitance_f * circuit.voltage_v * omega0 / math.e * 1000


def _edge_run_ma(circuit: engine.Circuit) -> float:
    """The page's strongest current, by a golden-section search on its current
    over the first second."""
    lo, hi = 0.0, 1.0
    g = (math.sqrt(5) - 1) / 2
    a, b = hi - g * (hi - lo), lo + g * (hi - lo)
    for _ in range(200):
        if _current(circuit, a) > _current(circuit, b):
            hi, b = b, a
            a = hi - g * (hi - lo)
        else:
            lo, a = a, b
            b = lo + g * (hi - lo)
    return _current(circuit, (lo + hi) / 2) * 1000


def _setting(circuit: engine.Circuit) -> dict[str, float | str]:
    """What the page's "Set it up" sets: the build, which recharges the capacitor."""
    return {
        "inductance_h": circuit.inductance_h,
        "capacitance_f": circuit.capacitance_f,
        "resistance_ohm": circuit.resistance_ohm,
        "voltage_v": circuit.voltage_v,
    }


CASES: tuple[Case, ...] = (
    Case(
        key="period",
        unit="s",
        expected=lambda: _period_hand_s(_CLASSROOM),
        measured=lambda: _period_run_s(_CLASSROOM),
        tolerance=1e-12,
        sources=(_RLC,),
        setting=_setting(_CLASSROOM),
    ),
    Case(
        key="energy_kept",
        unit="",
        expected=lambda: _kept_hand(_CLASSROOM),
        measured=lambda: _kept_run(_CLASSROOM),
        tolerance=1e-12,
        sources=(_RLC, _FIELDS),
        derived=True,
        setting=_setting(_CLASSROOM),
    ),
    Case(
        key="energy_account",
        unit="mJ",
        expected=lambda: _charged_mj(_CLASSROOM),
        measured=lambda: _account_run_mj(_CLASSROOM),
        # Simpson's rule over 20 000 strips of a current that swings once a second.
        tolerance=1e-9,
        sources=(_LOSS, _FIELDS),
        derived=True,
        setting=_setting(_CLASSROOM),
    ),
    Case(
        key="edge",
        unit="mA",
        expected=lambda: _edge_hand_ma(_EDGE_CIRCUIT),
        measured=lambda: _edge_run_ma(_EDGE_CIRCUIT),
        # The engine meets the edge through its creeping branch (2√(L/C) in
        # floating point lands a hair above), which expm1 keeps exact.
        tolerance=1e-12,
        sources=(_EDGE, _ROOTS),
        derived=True,
        setting=_setting(_EDGE_CIRCUIT),
    ),
)
