"""The floating top: a spinning magnet hovers over a ring magnet, in a window a few millimetres high.

The exhibit is a ring magnet in a base and a top with a magnet in it. Spun on a
plate over the ring and lifted gently, the top leaves the plate and hovers,
turning, for minutes. It only works for a top of the right weight: the toy
comes with washers to tune it, and a warm room can undo the tuning.

**Why a magnet cannot hover, and the spinning top can** (Earnshaw; Berry 1996;
Simon, Heflinger and Ridgway 1997). Held still, a magnet over another either
flips over or slides away: no arrangement of fixed magnets holds one in a
stable place. A spinning top cannot flip: its spin keeps its magnet pointing
against the field it sits in, turning slowly to follow the field's direction
(the adiabatic approximation). Its energy is then ``U = m·g·z + μ·|B|``: it is
pushed towards a weaker field, and a minimum of ``|B|`` is what free space
allows (a maximum it does not).

**The ring's field on its axis.** A ring magnetised evenly along its axis
(inner radius ``r₁``, outer ``r₂``, height ``t``, magnetisation ``M``, its top
face at ``z = 0``) is the outer solenoid minus the inner one:
``B(z) = μ₀·M/2 · [f₂(z + t) − f₂(z) − f₁(z + t) + f₁(z)]``,
``f_a(u) = u / √(u² + a²)``, and its slope and curvature exactly so. Off the
axis, Laplace's equation gives the field to second order in the distance ``r``
from the axis: ``B_z = B − r²·B″/4``, ``B_r = −r·B′/2``, so
``|B| = B + r²·(B′²/B − 2·B″)/8``.

**The window.** The top floats where its weight meets the lift, ``m·g = −μ·B′``,
and stays where both bends hold it: upwards and downwards ``B″ > 0``, sideways
``B′² > 2·B·B″``. The heights where both hold are the window. Its foot is where
``B″`` turns positive, which is where the lift peaks: the heaviest top that
floats at all floats there, and a heavier one lands on the plate. Its head is
where ``B′² = 2·B·B″``: a lighter top than floats there finds its balance
higher up, where the field holds it upright but lets it slide off sideways.
Inside, it bobs at ``√(μ·B″/m)/2π`` and drifts round at
``√(μ·(B′²/(4B) − B″/2)/m)/2π``.

**Warmth.** Ferrite loses about 0.2 % of its magnetisation a kelvin, the base's
and the top's alike, so the lift scales by ``(1 − 0.002·ΔT)²``. The window's
heights stay (each condition holds whatever the field's scale); its masses move.

**What it leaves out.** The spin itself: it is taken fast enough for the magnet
to follow the field and slow enough not to hold it stiff (that window is the
paper's, not computed here), the air that slows it, the top's wobble, and the
toy's measured magnets. The sizes are an illustrative ferrite: a ring 10 cm
across with a 3 cm hole, 1.5 cm high, and a top magnet of 2 cm³ of the same.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Literal

from staunlabor.domain.experiments.constants import G

MU0 = 4e-7 * math.pi

#: Ferrite's magnetisation per kelvin of warming (about −0.2 %/K).
FERRITE_PER_K = -0.002

#: The window is found on a grid of a millimetre up to 30 cm, then each edge by
#: bisection.
SCAN_STEP_M = 1e-3
SCAN_TO_M = 0.3
BISECTIONS = 60

State = Literal["hovers", "lands", "slides"]


@dataclass(frozen=True)
class Base:
    """The ring magnet in the base, its top face at ``z = 0``."""

    inner_radius_m: float = 0.015
    outer_radius_m: float = 0.05
    height_m: float = 0.015
    #: Ferrite's: a remanence of about 0.4 T.
    magnetisation_a_m: float = 3.2e5

    def __post_init__(self) -> None:
        if not 0 <= self.inner_radius_m < self.outer_radius_m <= 0.5:
            raise ValueError("a ring's hole is smaller than the ring, which is at most a metre across")
        if not 0 < self.height_m <= 0.2:
            raise ValueError("a ring is higher than nothing and at most 20 cm")
        if not 0 < self.magnetisation_a_m <= 2e6:
            raise ValueError("a magnetisation lies between nothing and neodymium's")


@dataclass(frozen=True)
class Top:
    #: The top's magnet: 2 cm³ of the base's ferrite.
    moment_a_m2: float = 0.64
    #: Tuned into the window's middle.
    mass_kg: float = 0.0235

    def __post_init__(self) -> None:
        if not 0 < self.moment_a_m2 <= 50:
            raise ValueError("a top's magnet is stronger than nothing and at most 50 A·m²")
        if not 0 < self.mass_kg <= 1:
            raise ValueError("a top weighs more than nothing and at most a kilogram")


def _solenoid(u: float, a: float) -> tuple[float, float, float]:
    """``f_a(u) = u/√(u² + a²)`` and its first two derivatives."""
    s = u * u + a * a
    return u / math.sqrt(s), a * a / s**1.5, -3 * a * a * u / s**2.5


def axis_field(base: Base, z_m: float) -> tuple[float, float, float]:
    """The field on the ring's axis at height ``z_m`` over its top face, its slope
    and its curvature: ``(B, B′, B″)`` in T, T/m, T/m²."""
    out = [0.0, 0.0, 0.0]
    for radius, sign in ((base.outer_radius_m, 1.0), (base.inner_radius_m, -1.0)):
        if radius == 0:
            continue
        lower = _solenoid(z_m + base.height_m, radius)
        upper = _solenoid(z_m, radius)
        for k in range(3):
            out[k] += sign * MU0 * base.magnetisation_a_m / 2 * (lower[k] - upper[k])
    return out[0], out[1], out[2]


def holds(base: Base, z_m: float) -> bool:
    """Would a top whose balance is at ``z_m`` stay there: a field that weakens
    upwards, held up and down (``B″ > 0``) and sideways (``B′² > 2·B·B″``)."""
    b, b1, b2 = axis_field(base, z_m)
    return b > 0 and b1 < 0 and b2 > 0 and b1 * b1 > 2 * b * b2


def _edge(base: Base, outside: float, inside: float) -> float:
    """Where :func:`holds` turns, between a height where it does not and one where it does."""
    for _ in range(BISECTIONS):
        mid = (outside + inside) / 2
        if holds(base, mid):
            inside = mid
        else:
            outside = mid
    return (outside + inside) / 2


def window(base: Base) -> tuple[float, float]:
    """The heights over the ring's face where a top can hover: ``(foot, head)``.
    Raises ``ValueError`` for a ring with none within the 30 cm searched."""
    steps = round(SCAN_TO_M / SCAN_STEP_M)
    foot: float | None = None
    for i in range(1, steps + 1):
        z = i * SCAN_STEP_M
        inside = holds(base, z)
        if foot is None and inside:
            foot = _edge(base, z - SCAN_STEP_M, z)
        elif foot is not None and not inside:
            return foot, _edge(base, z, z - SCAN_STEP_M)
    raise ValueError("this ring holds no top within 30 cm over it")


def scale(warming_k: float) -> float:
    """What the lift is multiplied by after warming both ferrites by ``warming_k``."""
    return (1 + FERRITE_PER_K * warming_k) ** 2


def lift_kg(base: Base, top: Top, z_m: float, warming_k: float = 0.0) -> float:
    """The lift on the top at ``z_m``, as the mass it carries: ``−μ·B′/g``."""
    return -top.moment_a_m2 * scale(warming_k) * axis_field(base, z_m)[1] / G


@dataclass(frozen=True)
class Hover:
    state: State
    #: Where its weight meets the lift above the window's foot; ``None`` when it lands.
    height_m: float | None
    #: The window's foot and head.
    foot_m: float
    head_m: float
    #: The lightest and the heaviest top that hover, this warm.
    lightest_kg: float
    heaviest_kg: float
    #: Up and down, and round the axis; ``None`` unless it hovers.
    bob_hz: float | None
    drift_hz: float | None


def hover(base: Base, top: Top, warming_k: float = 0.0) -> Hover:
    """Where ``top`` floats over ``base`` after warming both by ``warming_k``, if it
    does, and how it moves there."""
    if not -40 <= warming_k <= 40:
        raise ValueError("a warming lies between −40 and 40 K")
    foot, head = window(base)
    heaviest = lift_kg(base, top, foot, warming_k)
    lightest = lift_kg(base, top, head, warming_k)
    if top.mass_kg > heaviest:
        return Hover("lands", None, foot, head, lightest, heaviest, None, None)
    # Above the foot the lift only falls (B″ > 0): bisect for the balance.
    lo, hi = foot, SCAN_TO_M
    for _ in range(BISECTIONS):
        mid = (lo + hi) / 2
        if lift_kg(base, top, mid, warming_k) > top.mass_kg:
            lo = mid
        else:
            hi = mid
    z = (lo + hi) / 2
    if z > head:
        return Hover("slides", z, foot, head, lightest, heaviest, None, None)
    b, b1, b2 = axis_field(base, z)
    mu = top.moment_a_m2 * scale(warming_k)
    bob = math.sqrt(mu * b2 / top.mass_kg) / (2 * math.pi)
    drift = math.sqrt(mu * (b1 * b1 / (4 * b) - b2 / 2) / top.mass_kg) / (2 * math.pi)
    return Hover("hovers", z, foot, head, lightest, heaviest, bob, drift)
