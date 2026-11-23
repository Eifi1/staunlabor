"""The draining vessel: a tall tube of water with holes in its side, the jets
ever shorter and the level falling ever more slowly.

The exhibit is a classroom classic, built tall: a clear tube a metre high on a
stand over a long basin, filled with water, three holes in its side one above
the other, each closed with a plug. A plug pulled, a jet shoots out and lands
far off in the basin; then it lands ever nearer, and the level in the tube
falls ever more slowly. The last few centimetres take longest. With all three
open, the middle jet reaches farthest, and the top and the bottom one land in
the same spot.

**Why it slows.** The water leaves a hole at the speed a stone would reach
falling from the surface to the hole, ``√(2g·h)`` (Torricelli's law), ``h``
the water's depth above the hole. As the level falls the jet slows, so the
level falls more slowly still: the outflow is proportional to ``√h``, and the
tube never empties at a steady pace.

**The model.** The tube's cross-section ``A`` loses what the open holes below
the level let out, each its area ``a`` narrowed by the jet's contraction just
outside it (the vena contracta, the discharge coefficient ``μ``):
``A·dh/dt = −μ·a·Σ √(2g·(h − y_k))``, a first-order equation in the level
``h`` above the tube's bottom, ``y_k`` the open holes' heights. A hand opens
and closes the holes at any moment, so it is stepped (classical Runge–Kutta,
:data:`STEP_S`, written out for one number). With one hole open it has the
exact solution ``√(h − y) = √(h₀ − y) − (μa/A)·√(g/2)·t``, which empties it
in ``T = (A/μa)·√(2(h₀ − y)/g)`` (:func:`level_exact`, :func:`drain_time_s`):
half the depth is gone after ``(1 − 1/√2)·T``, 29 % of the time, the last
tenth takes ``√(1/10)·T``, 32 % of it. The jet leaves the wall level, so it
lands ``2·√((h − y)·(s + y))`` from it, ``s`` the stand under the tube; it
shrinks in step with ``√(h − y)``, at a steady pace while one hole drains it.

**What it leaves out.** The water's speed down the tube itself
(``(μa/A)²``, under a ten-thousandth here, which a hole at most a quarter of
the tube's width keeps under half a percent); the jet's own slowing by
viscosity and the air (a velocity coefficient of one, as measured for jets
from sharp-edged holes); the water column's inertia as the flow changes; the
surface tension that holds the last drops and breaks the thin jet into drops
at the end; the plug's own width.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from staunlabor.domain.experiments.constants import G

#: The step: 5 ms. The level changes by under a millimetre a step even from
#: the widest hole of the shortest tube, and the page answers a hand at once.
STEP_S = 0.005

#: Samples a run returns per second.
SAMPLES_PER_S = 10

#: The longest run the engine takes.
MAX_DURATION_S = 1200.0

#: Holes in the tube, at most.
MAX_HOLES = 6

#: The widest hole, as a share of the tube's diameter: Torricelli's speed
#: assumes the water in the tube stands nearly still, so ``(μa/A)²`` must stay
#: small (under 0.4 % at this width).
WIDEST_HOLE = 0.25

#: The share of the emptying time in which half the depth over a single hole
#: has run out: ``h = h₀·(1 − t/T)²`` is ``h₀/2`` at ``t = (1 − 1/√2)·T``.
HALF_SHARE = 1 - 1 / math.sqrt(2)


@dataclass(frozen=True)
class DrainingVessel:
    #: The tube's inner diameter.
    diameter_m: float = 0.08
    #: The tube's height: the water stands at most this high.
    height_m: float = 1.0
    #: The level the tube is filled to, above its bottom.
    fill_m: float = 0.9
    #: The holes' heights above the tube's bottom, lowest first.
    holes_m: tuple[float, ...] = (0.05, 0.35, 0.65)
    #: Every hole's diameter.
    hole_diameter_m: float = 0.008
    #: The discharge coefficient ``μ``: the jet's narrowest cross-section over
    #: the hole's, about 0.61 for a round sharp-edged hole.
    discharge: float = 0.61
    #: How high the tube's bottom stands above the basin's floor.
    stand_m: float = 0.2

    def __post_init__(self) -> None:
        if not 0.01 <= self.diameter_m <= 1:
            raise ValueError("a tube's inner diameter lies between 1 cm and 1 m")
        if not 0.1 <= self.height_m <= 5:
            raise ValueError("a tube stands between 10 cm and 5 m high")
        if not 0 < self.fill_m <= self.height_m:
            raise ValueError("the water stands above the bottom and at most at the tube's top")
        if not 0 < self.hole_diameter_m <= WIDEST_HOLE * self.diameter_m:
            raise ValueError("a hole is at most a quarter of the tube's diameter")
        if not 1 <= len(self.holes_m) <= MAX_HOLES:
            raise ValueError(f"a tube has one to {MAX_HOLES} holes")
        if any(not 0 <= y < self.height_m for y in self.holes_m):
            raise ValueError("every hole lies in the tube's wall, from its bottom up to below its top")
        if any(b <= a for a, b in zip(self.holes_m, self.holes_m[1:], strict=False)):
            raise ValueError("the holes are listed lowest first, each above the one before")
        if not 0 < self.discharge <= 1:
            raise ValueError("a discharge coefficient lies above nothing and at most 1")
        if not 0 <= self.stand_m <= 5:
            raise ValueError("the stand is between nothing and 5 m high")


def rate_constant(vessel: DrainingVessel) -> float:
    """``μ·a/A``: the share of the tube's cross-section the jet's narrowest
    cross-section is."""
    return vessel.discharge * (vessel.hole_diameter_m / vessel.diameter_m) ** 2


def jet_speed_m_s(level_m: float, hole_m: float) -> float:
    """Torricelli's ``√(2g·(h − y))``: the jet's speed out of a hole at ``hole_m``
    under a level at ``level_m``; none from a hole above the level."""
    return math.sqrt(2 * G * max(0.0, level_m - hole_m))


def jet_range_m(vessel: DrainingVessel, level_m: float, hole_m: float) -> float:
    """``2·√((h − y)·(s + y))``: how far from the wall the jet from a hole at
    ``hole_m`` lands on the basin's floor, leaving level at Torricelli's speed
    and falling the hole's height over the floor."""
    return 2 * math.sqrt(max(0.0, level_m - hole_m) * (vessel.stand_m + hole_m))


def jet_path(vessel: DrainingVessel, level_m: float, hole_m: float, x_m: float) -> float:
    """The jet's height over the basin's floor at ``x_m`` from the wall: the
    parabola of a throw at Torricelli's speed, ``s + y − g·x²/(2v²)``, never
    below the floor; the hole's own height where no water leaves it."""
    start = vessel.stand_m + hole_m
    v = jet_speed_m_s(level_m, hole_m)
    if v == 0:
        return start
    return max(0.0, start - G * x_m * x_m / (2 * v * v))


def fall_rate_m_s(vessel: DrainingVessel, level_m: float, opened: tuple[bool, ...]) -> float:
    """``dh/dt = −(μa/A)·Σ √(2g·(h − y_k))`` over the open holes below the level,
    in m/s (negative, or nothing when no open hole lies below it)."""
    k = rate_constant(vessel)
    total = 0.0
    for y, open_ in zip(vessel.holes_m, opened, strict=True):
        if open_ and level_m > y:
            total += math.sqrt(2 * G * (level_m - y))
    return -k * total


def outflow_l_min(vessel: DrainingVessel, level_m: float, opened: tuple[bool, ...]) -> float:
    """The water leaving all open holes together, in litres a minute."""
    area = math.pi * vessel.diameter_m**2 / 4
    return -area * fall_rate_m_s(vessel, level_m, opened) * 60000


def _floor_m(vessel: DrainingVessel, level_m: float, opened: tuple[bool, ...]) -> float | None:
    """The lowest open hole below the level: the level falls to it and stops
    there; ``None`` where no open hole lies below the level."""
    below = [y for y, open_ in zip(vessel.holes_m, opened, strict=True) if open_ and y < level_m]
    return min(below) if below else None


def step(vessel: DrainingVessel, level_m: float, opened: tuple[bool, ...], dt_s: float) -> float:
    """The level ``dt_s`` later: one classical Runge–Kutta step of
    :func:`fall_rate_m_s`, held at the lowest open hole below the level,
    through which the water would otherwise be drawn on below it (a stage
    past the hole sees no outflow, the step's sum can still overshoot)."""
    floor = _floor_m(vessel, level_m, opened)
    if floor is None:
        return level_m
    k1 = fall_rate_m_s(vessel, level_m, opened)
    k2 = fall_rate_m_s(vessel, level_m + dt_s / 2 * k1, opened)
    k3 = fall_rate_m_s(vessel, level_m + dt_s / 2 * k2, opened)
    k4 = fall_rate_m_s(vessel, level_m + dt_s * k3, opened)
    return max(floor, level_m + dt_s / 6 * (k1 + 2 * k2 + 2 * k3 + k4))


def level_exact(vessel: DrainingVessel, hole_m: float, t_s: float) -> float:
    """The level ``t_s`` after the hole at ``hole_m`` alone is opened under a full
    tube: ``y + (√(h₀ − y) − (μa/A)·√(g/2)·t)²`` until it reaches the hole, the
    hole's height after; the fill where the hole stands above it."""
    if t_s < 0:
        raise ValueError("the level is asked about from the moment the hole is opened")
    head = vessel.fill_m - hole_m
    if head <= 0:
        return vessel.fill_m
    root = max(0.0, math.sqrt(head) - rate_constant(vessel) * math.sqrt(G / 2) * t_s)
    return hole_m + root * root


def drain_time_s(vessel: DrainingVessel, hole_m: float) -> float:
    """``T = (A/μa)·√(2·(h₀ − y)/g)``: how long the hole at ``hole_m`` alone takes
    to let the water above it out; nothing where it stands above the fill."""
    head = max(0.0, vessel.fill_m - hole_m)
    return math.sqrt(2 * head / G) / rate_constant(vessel)


@dataclass(frozen=True)
class Plug:
    """A hand at the tube: at ``at_s`` it pulls the plug of hole ``hole`` (lowest
    first, from 0) or puts it back."""

    at_s: float
    hole: int
    opened: bool


@dataclass(frozen=True)
class DrainRun:
    t_s: tuple[float, ...]
    level_m: tuple[float, ...]
    #: The water leaving, in litres a minute.
    outflow_l_min: tuple[float, ...]
    #: Each hole's jet's range over the run, lowest hole first (0 where it is
    #: closed or above the level).
    ranges_m: tuple[tuple[float, ...], ...]


def run(vessel: DrainingVessel, plugs: tuple[Plug, ...], duration_s: float, step_s: float = STEP_S) -> DrainRun:
    """The tube filled to :attr:`DrainingVessel.fill_m`, every hole plugged,
    and the hand's ``plugs`` acting at the first step that starts at or after
    their moment, stepped for ``duration_s``; a sample each
    ``1/SAMPLES_PER_S``. Step ``n`` starts at ``n·step_s``, counted, never
    summed, so a long run does not drift off the hand's moments."""
    if not 0 < duration_s <= MAX_DURATION_S:
        raise ValueError(f"a run lasts more than nothing and at most {MAX_DURATION_S:g} s")
    if not 0 < step_s <= 0.05:
        raise ValueError("the step lies between 0 and 50 ms")
    if any(not 0 <= p.hole < len(vessel.holes_m) for p in plugs):
        raise ValueError("a plug belongs to one of the tube's holes")
    if any(p.at_s < 0 for p in plugs):
        raise ValueError("the hand acts from the start on")
    pending = sorted(plugs, key=lambda p: p.at_s)
    opened = [False] * len(vessel.holes_m)
    level = vessel.fill_m
    steps = math.ceil(duration_s / step_s - 1e-9)
    every = max(1, round(1 / (SAMPLES_PER_S * step_s)))
    times: list[float] = []
    levels: list[float] = []
    flows: list[float] = []
    ranges: list[list[float]] = [[] for _ in vessel.holes_m]
    for n in range(steps + 1):
        t = n * step_s
        while pending and pending[0].at_s <= t:
            plug = pending.pop(0)
            opened[plug.hole] = plug.opened
        now = tuple(opened)
        if n % every == 0 or n == steps:
            times.append(t)
            levels.append(level)
            flows.append(outflow_l_min(vessel, level, now))
            for i, y in enumerate(vessel.holes_m):
                ranges[i].append(jet_range_m(vessel, level, y) if now[i] else 0.0)
        if n < steps:
            level = step(vessel, level, now, step_s)
    return DrainRun(
        t_s=tuple(times),
        level_m=tuple(levels),
        outflow_l_min=tuple(flows),
        ranges_m=tuple(tuple(r) for r in ranges),
    )


@dataclass(frozen=True)
class VesselFigures:
    #: ``μa/A``.
    rate_constant: float
    #: The lowest hole alone: how long until the water above it is out.
    drain_s: float
    #: …and until half the depth above it is: ``(1 − 1/√2)·T``.
    half_s: float
    #: The lowest hole's first jet: its speed and the water it lets out.
    speed_m_s: float
    outflow_l_min: float
    #: Each hole's first jet's range, under the full tube, lowest first.
    ranges_m: tuple[float, ...]
    #: Where a hole would throw farthest, ``(h₀ − s)/2`` above the tube's
    #: bottom (``None`` where that is below it), and how far: ``h₀ + s``.
    farthest_hole_m: float | None
    farthest_m: float
    #: The water above the lowest hole, in litres.
    volume_l: float
    #: ``(μa/A)²``: the share of Torricelli's speed squared the water's own
    #: speed down the tube would take, which the model leaves out.
    approach: float


def figures(vessel: DrainingVessel) -> VesselFigures:
    lowest = vessel.holes_m[0]
    alone = tuple(i == 0 for i in range(len(vessel.holes_m)))
    drain = drain_time_s(vessel, lowest)
    best = (vessel.fill_m - vessel.stand_m) / 2
    k = rate_constant(vessel)
    return VesselFigures(
        rate_constant=k,
        drain_s=drain,
        half_s=HALF_SHARE * drain,
        speed_m_s=jet_speed_m_s(vessel.fill_m, lowest),
        outflow_l_min=outflow_l_min(vessel, vessel.fill_m, alone),
        ranges_m=tuple(jet_range_m(vessel, vessel.fill_m, y) for y in vessel.holes_m),
        farthest_hole_m=best if best >= 0 else None,
        farthest_m=vessel.fill_m + vessel.stand_m if best >= 0 else jet_range_m(vessel, vessel.fill_m, 0.0),
        volume_l=math.pi * vessel.diameter_m**2 / 4 * max(0.0, vessel.fill_m - lowest) * 1000,
        approach=k * k,
    )
