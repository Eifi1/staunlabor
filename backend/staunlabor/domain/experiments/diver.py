"""The Cartesian diver: a little glass tube with a bubble of air floats in a bottle; squeeze the bottle and it sinks.

The exhibit is a bottle full of water with a diver in it: a small glass
tube, open at the bottom, holding a bubble of air that just keeps it afloat.
Squeeze the bottle and the diver sinks; let go and it rises. In between there
is a depth where it would hover — but it never stays there.

**Why it sinks.** The hand's squeeze raises the pressure throughout the water,
and the air in the diver gives way: its bubble shrinks (Boyle, ``p·V`` the
same at the water's temperature), water runs in, the diver displaces less and
its buoyancy no longer carries its glass. Deeper, the water's own weight
presses the bubble further: the deeper the diver, the heavier it is for its
size.

**Why it never hovers.** There is one depth where buoyancy and weight are
equal, ``V(z*) = m/ρ − V_g``. A little below it the bubble is smaller, the
weight wins, and the diver sinks on, to the bottom; a little above, the
bubble is larger and it rises, to the surface. The balance is unstable; the
hand must keep chasing it.

**The model.** The diver's bubble ``V = V₀·p₀/(p₀ + Δp + ρ·g·z)``, isothermal,
``V₀`` its volume at the surface without a squeeze; the glass's volume and
mass fixed. Moving, the water it drags along (half its volume, as for a
sphere) adds to its inertia, and the water brakes it with ``½·ρ·c_d·A·v²``.
Stepped with Runge–Kutta at a fixed step; at the surface it floats, its top
at the water line, and on the bottom it lies.

**What it leaves out.** The bubble's own small ups and downs as water runs
in and out of the tube (the air is taken to follow the pressure at once); the
water's and the bottle's give; the air at the bottle's neck, whose squeeze is
the hand's ``Δp`` here directly; the diver poking out of the water at the
surface; temperature. The values are an assumed diver: 3 g of glass (1.2 cm³)
and 2 cm³ of air, in a bottle 30 cm deep.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

G = 9.80665
#: Water at 20 °C, kg/m³; the air's pressure at the surface, Pa.
WATER_DENSITY = 998.0
SURFACE_PA = 101325.0
#: A blunt tube's drag coefficient, end on.
DRAG_COEFFICIENT = 1.0
#: The step the motion is integrated with.
STEP_S = 0.002


@dataclass(frozen=True)
class Diver:
    glass_kg: float = 0.003
    glass_m3: float = 1.2e-6
    #: The bubble at the surface, without a squeeze.
    air_m3: float = 2.0e-6
    #: Across the tube, for its drag.
    diameter_m: float = 0.012

    def __post_init__(self) -> None:
        if not 0 < self.glass_kg <= 0.1:
            raise ValueError("a diver's glass weighs more than nothing and at most 100 g")
        if not 0 < self.glass_m3 <= 1e-4 or not 0 < self.air_m3 <= 1e-4:
            raise ValueError("a diver's glass and air are each more than nothing and at most 100 cm³")
        if not 0.002 <= self.diameter_m <= 0.05:
            raise ValueError("a diver is 2 mm to 5 cm across")
        if self.glass_kg / WATER_DENSITY <= self.glass_m3:
            raise ValueError("a diver's glass outweighs the water it displaces, or it never sinks")


@dataclass(frozen=True)
class Bottle:
    depth_m: float = 0.30

    def __post_init__(self) -> None:
        if not 0.05 <= self.depth_m <= 2:
            raise ValueError("a bottle holds 5 cm to 2 m of water")


def bubble_m3(diver: Diver, depth_m: float, squeeze_pa: float) -> float:
    """The bubble at ``depth_m`` with the hand's ``squeeze_pa``: Boyle's law."""
    return diver.air_m3 * SURFACE_PA / (SURFACE_PA + squeeze_pa + WATER_DENSITY * G * max(0.0, depth_m))


def lift_n(diver: Diver, depth_m: float, squeeze_pa: float) -> float:
    """Buoyancy less weight, in N, upward: the diver rises where it is above zero."""
    return WATER_DENSITY * G * (diver.glass_m3 + bubble_m3(diver, depth_m, squeeze_pa)) - diver.glass_kg * G


def _needed_m3(diver: Diver) -> float:
    """The bubble the diver hovers with: ``m/ρ − V_g``."""
    return diver.glass_kg / WATER_DENSITY - diver.glass_m3


def hover_depth_m(diver: Diver, squeeze_pa: float) -> float:
    """``z* = (p₀·V₀/(m/ρ − V_g) − p₀ − Δp)/(ρ·g)``: where it would hover —
    above the surface (below zero) it floats, past the bottom it rises from
    anywhere."""
    return (SURFACE_PA * diver.air_m3 / _needed_m3(diver) - SURFACE_PA - squeeze_pa) / (WATER_DENSITY * G)


def sinking_squeeze_pa(diver: Diver) -> float:
    """The squeeze that just sinks it from the surface: ``z* = 0``."""
    return SURFACE_PA * diver.air_m3 / _needed_m3(diver) - SURFACE_PA


def _accel(diver: Diver, depth_m: float, speed_m_s: float, squeeze_pa: float) -> float:
    """Downward acceleration: weight less buoyancy less drag, over the glass's
    mass and the water it drags along (half its volume)."""
    volume = diver.glass_m3 + bubble_m3(diver, depth_m, squeeze_pa)
    inertia = diver.glass_kg + 0.5 * WATER_DENSITY * volume
    area = math.pi * diver.diameter_m**2 / 4
    drag = 0.5 * WATER_DENSITY * DRAG_COEFFICIENT * area * speed_m_s * abs(speed_m_s)
    return (diver.glass_kg * G - WATER_DENSITY * G * volume - drag) / inertia


def step(diver: Diver, bottle: Bottle, depth_m: float, speed_m_s: float, squeeze_pa: float) -> tuple[float, float]:
    """One Runge–Kutta step of ``STEP_S``: ``(depth, downward speed)``. At the
    surface it floats and on the bottom it lies: past either, it stops there."""
    if not 0 <= squeeze_pa <= 100_000:
        raise ValueError("a hand squeezes with nothing to 100 kPa")

    def f(z: float, v: float) -> tuple[float, float]:
        return v, _accel(diver, z, v, squeeze_pa)

    h = STEP_S
    k1 = f(depth_m, speed_m_s)
    k2 = f(depth_m + h / 2 * k1[0], speed_m_s + h / 2 * k1[1])
    k3 = f(depth_m + h / 2 * k2[0], speed_m_s + h / 2 * k2[1])
    k4 = f(depth_m + h * k3[0], speed_m_s + h * k3[1])
    z = depth_m + h / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0])
    v = speed_m_s + h / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1])
    if z <= 0:
        return 0.0, 0.0
    if z >= bottle.depth_m:
        return bottle.depth_m, 0.0
    return z, v


def run(diver: Diver, bottle: Bottle, depth_m: float, squeeze_pa: float, steps: int) -> list[tuple[float, float]]:
    """The diver let go at rest at ``depth_m`` under a steady squeeze, every
    step's ``(depth, speed)``, the start first."""
    out = [(depth_m, 0.0)]
    z, v = depth_m, 0.0
    for _ in range(steps):
        z, v = step(diver, bottle, z, v, squeeze_pa)
        out.append((z, v))
    return out


@dataclass(frozen=True)
class DiverFigures:
    #: How much more than its weight it displaces at the surface, unsqueezed, in kg.
    reserve_kg: float
    #: The bubble it hovers with, in m³.
    hover_bubble_m3: float
    #: The squeeze that sinks it from the surface, and the one that sinks it
    #: from the bottom up — between them it hovers somewhere in the bottle.
    sinking_pa: float
    bottom_pa: float


def figures(diver: Diver, bottle: Bottle) -> DiverFigures:
    sinking = sinking_squeeze_pa(diver)
    return DiverFigures(
        reserve_kg=lift_n(diver, 0.0, 0.0) / G,
        hover_bubble_m3=_needed_m3(diver),
        sinking_pa=sinking,
        bottom_pa=sinking - WATER_DENSITY * G * bottle.depth_m,
    )
