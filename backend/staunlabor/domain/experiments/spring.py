"""The Wilberforce spring: a weight that bobs, then only twists, then bobs again.

The exhibit is a weight on a long coil spring. Pulled down and let go, it bobs
up and down; the bobbing slowly dies away while the weight starts to twist,
until it only twists, and then the bobbing comes back, over and over. Four
nuts on arms at the weight's sides set how easily it turns: in the right place
the exchange is complete, elsewhere only partial.

**The model** (R. E. Berg, T. S. Marshall, *Am. J. Phys.* 59 (1991) 32, §II).
A massless spring of stiffness ``k`` against stretch and ``δ`` against twist;
the weight of mass ``m`` and moment of inertia ``I`` about its axis; a coil
spring twists a little as it stretches, which Berg and Marshall take as the
linear coupling ``ε·z·θ/2`` in the energy:

    m·z'' = −k·z − ε·θ/2 − c·m·z'
    I·θ'' = −δ·θ − ε·z/2 − c·I·θ'

``z`` the weight's displacement down from where it hangs at rest (gravity only
sets that place), ``θ`` its twist; ``c`` one damping for both, the paper's
equations at ``c = 0``. Stepped by the block's Runge–Kutta.

**The modes.** Two motions keep one rate: the roots of the 2 × 2 system,
``ω² = ½{ω_θ² + ω_z² ± [(ω_θ² − ω_z²)² + ε²/(m·I)]^½}`` with ``ω_z² = k/m``
and ``ω_θ² = δ/I`` (their Eq. 7). Started in either, the weight bobs and twists
together and nothing is exchanged (their Eqs. 28–29 give the start). Any other
start is a sum of the two, and the energy goes from bobbing to twisting and
back once in the beat ``2π/(ω₁ − ω₂)``.

**Tuned** when ``ω_z = ω_θ``, ``I = δ·m/k``: then a weight only pulled down
ends up only twisting. Detuned, the share that reaches the twist is
``4c²/((ω_z² − ω_θ²)² + 4c²)`` with ``c = ε/(2√(m·I))`` (Rabi's formula, for
these two oscillators): the nuts move ``I`` and with it the share.

**The page's spring** is Berg and Marshall's Leybold pendulum, their measured
values corrected for the spring's own mass (§III): ``m = 0.5164 kg``,
``k = 2.80 N/m``, ``δ = 7.86·10⁻⁴ N·m``, ``ε = 9.27·10⁻³ N``,
``I = 1.45·10⁻⁴ kg·m²``. That inertia is the page's with the nuts 20 mm out;
the nuts' 10 g each and the body's share of ``I`` are the page's own choice.

**What it leaves out.** The spring's mass beyond the third added to the
weight's, the pendulum swing a long spring can also take (Berg and Marshall's
§I), and every nonlinearity of a real coil; air, beyond the one linear damping.
"""

from __future__ import annotations

import enum
import math
from dataclasses import dataclass

from staunlabor.domain.experiments.numerics import STEP_S, check_run, rk4, sample_every

#: The nuts on the weight's arms, one an arm.
NUTS = 4

#: How far the weight may be pulled or pushed, and twisted, by a hand: the
#: linear coupling is a small motion's, and a spring pulled further would
#: close its coils or lift the weight off its rest.
MAX_PULL_M = 0.06
MAX_TWIST_RAD = math.pi


class Start(enum.StrEnum):
    #: Pulled down, not twisted: the exhibit's own start.
    DOWN = "down"
    #: Twisted, not pulled.
    TWISTED = "twisted"
    #: The faster mode alone (Berg and Marshall's mode 1).
    FAST = "fast"
    #: The slower mode alone (their mode 2).
    SLOW = "slow"


#: How far the buttons pull (2 cm) and twist (1 rad ≈ 57°).
START_PULL_M = 0.02
START_TWIST_RAD = 1.0


@dataclass(frozen=True)
class WilberforceSpring:
    #: m: the weight with a third of the spring's mass.
    mass_kg: float = 0.5164
    #: k: the force per metre of stretch.
    stiffness_n_m: float = 2.80
    #: δ: the torque per radian of twist.
    torsion_n_m: float = 7.86e-4
    #: ε: the coupling, ε·z·θ/2 in the energy.
    coupling_n: float = 9.27e-3
    #: The weight's moment of inertia without its nuts.
    body_inertia_kg_m2: float = 1.29e-4
    #: Each nut's mass.
    nut_kg: float = 0.010
    #: How far out the nuts sit, from the weight's axis.
    nut_radius_m: float = 0.020
    #: c: the motion dies away as e^(−c·t/2).
    damping_per_s: float = 0.0

    def __post_init__(self) -> None:
        if not 0.05 <= self.mass_kg <= 5.0:
            raise ValueError("the weight is between 50 g and 5 kg")
        if not 0.5 <= self.stiffness_n_m <= 50.0:
            raise ValueError("the spring's stiffness lies between 0.5 and 50 N/m")
        if not 1e-5 <= self.torsion_n_m <= 1e-2:
            raise ValueError("the spring's torsion lies between 10⁻⁵ and 10⁻² N·m")
        if not 0 <= self.coupling_n <= 0.05:
            raise ValueError("the coupling lies between 0 and 0.05 N")
        if self.coupling_n**2 >= 4 * self.stiffness_n_m * self.torsion_n_m:
            raise ValueError("a coupling this strong leaves the weight no rest to swing about")
        if not 1e-6 <= self.body_inertia_kg_m2 <= 1e-2:
            raise ValueError("the weight's moment of inertia lies between 10⁻⁶ and 10⁻² kg·m²")
        if not 0 <= self.nut_kg <= 0.1:
            raise ValueError("a nut weighs at most 100 g")
        if not 0 <= self.nut_radius_m <= 0.1:
            raise ValueError("the nuts sit at most 10 cm out")
        if not 0 <= self.damping_per_s <= 1:
            raise ValueError("the damping lies between 0 and 1 per second")


def inertia_kg_m2(s: WilberforceSpring) -> float:
    """``I``: the body's and the four nuts', each a point at its radius."""
    return s.body_inertia_kg_m2 + NUTS * s.nut_kg * s.nut_radius_m**2


def alone_rates(s: WilberforceSpring) -> tuple[float, float]:
    """``ω_z = √(k/m)`` and ``ω_θ = √(δ/I)``: bobbing alone and twisting
    alone, rad/s."""
    return math.sqrt(s.stiffness_n_m / s.mass_kg), math.sqrt(s.torsion_n_m / inertia_kg_m2(s))


def mode_rates(s: WilberforceSpring) -> tuple[float, float]:
    """The two modes' rates, the faster first (Berg and Marshall's ω₁, ω₂),
    rad/s: the roots of the 2 × 2 system's characteristic polynomial."""
    wz, wt = alone_rates(s)
    mean = (wz * wz + wt * wt) / 2
    split = math.sqrt(((wt * wt - wz * wz) / 2) ** 2 + s.coupling_n**2 / (4 * s.mass_kg * inertia_kg_m2(s)))
    return math.sqrt(mean + split), math.sqrt(mean - split)


def beat_s(s: WilberforceSpring) -> float | None:
    """``2π/(ω₁ − ω₂)``: the time for the energy to go from bobbing to twisting
    and back; ``None`` with no coupling."""
    if s.coupling_n == 0:
        # Two free motions drift in and out of step, but nothing is handed over.
        return None
    w1, w2 = mode_rates(s)
    return 2 * math.pi / (w1 - w2)


def exchange_share(s: WilberforceSpring) -> float:
    """The most of a pull that ever goes into the twist, for the linear
    model: 1 when tuned, less the further the nuts are from that place."""
    wz, wt = alone_rates(s)
    c2 = s.coupling_n**2 / (4 * s.mass_kg * inertia_kg_m2(s))
    both = 4 * c2
    return both / ((wz * wz - wt * wt) ** 2 + both) if both > 0 else 0.0


def tuned_radius_m(s: WilberforceSpring) -> float | None:
    """Where the nuts make ``I = δ·m/k``, so twisting alone keeps time with
    bobbing alone; ``None`` if no place on the arms does (the body alone
    turns too slowly, or there are no nuts)."""
    wanted = s.torsion_n_m * s.mass_kg / s.stiffness_n_m
    room = wanted - s.body_inertia_kg_m2
    if room < 0 or s.nut_kg == 0:
        return None
    return math.sqrt(room / (NUTS * s.nut_kg))


def rhs(s: WilberforceSpring):
    """The four first-order equations: ``(z, θ, z', θ')``."""
    m, inertia = s.mass_kg, inertia_kg_m2(s)
    k, delta, half = s.stiffness_n_m, s.torsion_n_m, s.coupling_n / 2
    c = s.damping_per_s

    def f(_t: float, y: tuple[float, ...]) -> tuple[float, ...]:
        return (
            y[2],
            y[3],
            -(k * y[0] + half * y[1]) / m - c * y[2],
            -(delta * y[1] + half * y[0]) / inertia - c * y[3],
        )

    return f


def check_hold(pull_m: float, twist_rad: float) -> None:
    """A hand's pull and twist: within :data:`MAX_PULL_M` and
    :data:`MAX_TWIST_RAD`."""
    if not abs(pull_m) <= MAX_PULL_M:
        raise ValueError(f"the weight is pulled or pushed at most {MAX_PULL_M * 100:g} cm")
    if not abs(twist_rad) <= MAX_TWIST_RAD:
        raise ValueError("the weight is twisted at most half a turn either way")


def start_state(s: WilberforceSpring, start: Start) -> tuple[float, float, float, float]:
    """The buttons' starts, from rest. A mode alone: twisted 1 rad and pulled
    ``z₀ = (2I/ε)·(ωᵢ² − ω_θ²)·θ₀`` (Berg and Marshall's Eqs. 28–29), the
    pull its mode wants; with no coupling, the twist alone."""
    if start is Start.DOWN:
        return (START_PULL_M, 0.0, 0.0, 0.0)
    if start is Start.TWISTED:
        return (0.0, START_TWIST_RAD, 0.0, 0.0)
    w1, w2 = mode_rates(s)
    w = w1 if start is Start.FAST else w2
    _, wt = alone_rates(s)
    if s.coupling_n == 0:
        return (0.0, START_TWIST_RAD, 0.0, 0.0)
    pull = 2 * inertia_kg_m2(s) / s.coupling_n * (w * w - wt * wt) * START_TWIST_RAD
    # Far detuned, a mode is nearly all bobbing: scaled back so the pull stays
    # a hand's, the twist with it.
    scale = min(1.0, MAX_PULL_M / abs(pull)) if pull else 1.0
    return (pull * scale, START_TWIST_RAD * scale, 0.0, 0.0)


def energies(s: WilberforceSpring, y: tuple[float, ...]) -> tuple[float, float, float]:
    """The bobbing's energy (motion and stretch), the twist's (turning and
    torsion) and the coupling's ``ε·z·θ/2``, J."""
    bob = 0.5 * s.mass_kg * y[2] * y[2] + 0.5 * s.stiffness_n_m * y[0] * y[0]
    twist = 0.5 * inertia_kg_m2(s) * y[3] * y[3] + 0.5 * s.torsion_n_m * y[1] * y[1]
    return bob, twist, 0.5 * s.coupling_n * y[0] * y[1]


@dataclass(frozen=True)
class SpringRun:
    t: tuple[float, ...]
    z_m: tuple[float, ...]
    theta_rad: tuple[float, ...]
    bob_j: tuple[float, ...]
    twist_j: tuple[float, ...]
    coupling_j: tuple[float, ...]


def run(s: WilberforceSpring, pull_m: float, twist_rad: float, duration_s: float, step_s: float = STEP_S) -> SpringRun:
    """The weight let go from rest, pulled ``pull_m`` down and twisted
    ``twist_rad``, stepped for ``duration_s``."""
    check_run(duration_s, step_s)
    check_hold(pull_m, twist_rad)
    f = rhs(s)
    y: tuple[float, ...] = (pull_m, twist_rad, 0.0, 0.0)
    steps = round(duration_s / step_s)
    every = sample_every(step_s)
    out: dict[str, list[float]] = {k: [] for k in ("t", "z", "th", "b", "w", "c")}
    for i in range(steps + 1):
        t = i * step_s
        if i % every == 0:
            bob, twist, coupling = energies(s, y)
            out["t"].append(t)
            out["z"].append(y[0])
            out["th"].append(y[1])
            out["b"].append(bob)
            out["w"].append(twist)
            out["c"].append(coupling)
        if i < steps:
            y = rk4(f, t, y, step_s)
    return SpringRun(
        t=tuple(out["t"]),
        z_m=tuple(out["z"]),
        theta_rad=tuple(out["th"]),
        bob_j=tuple(out["b"]),
        twist_j=tuple(out["w"]),
        coupling_j=tuple(out["c"]),
    )
