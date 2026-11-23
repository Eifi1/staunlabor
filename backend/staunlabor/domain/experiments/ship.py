"""The ship that rights itself: a hull in a basin comes back upright with its weight low, and capsizes with it high.

The exhibit is a model hull floating in a basin, a weight that slides up a
mast or down into a keel. With the weight low, the hull tilted by hand rocks
back upright; with it high, a small push turns it over.

**Why it comes back.** Tilted, the hull pushes its low side deeper into the
water and lifts its high side out: the water it displaces, and with it the
centre of buoyancy ``B``, moves to the low side. Buoyancy pushes up through
``B``, weight pulls down through the centre of gravity ``G``; the horizontal
distance between the two lines is the righting arm ``GZ``. While ``B`` lies
further to the low side than ``G``, the pair turns the hull back. For small
angles the line up through ``B`` crosses the hull's middle line at a fixed
point, the metacentre ``M``, and ``GZ ≈ GM·sin φ``: the hull rights itself
when ``M`` lies above ``G``. ``GM = KB + BM − KG``, heights above the keel's
bottom ``K``, with ``BM = I/V`` (the waterline's second moment of area over the
displaced volume): for a box of beam ``b`` floating at draft ``d``, ``KB = d/2``
and ``BM = b²/(12·d)``.

**Why the weight decides.** Raising the weight raises ``G`` and nothing else:
the hull floats at the same draft, so ``B`` and ``M`` stay where they are.
Above a certain height ``G`` passes ``M``, ``GM`` turns negative, and the
upright hull is a balance on a knife's edge: it falls to one side, to a
lolling angle where ``GZ`` is zero again, or all the way over.

**The model.** The hull's cross-section, a closed box (no water comes over the
deck), prismatic over its length, in still water of 998 kg/m³. For a heel
``φ`` the waterline is the level line that cuts off the displaced area, found
exactly (the area under a level line grows piecewise quadratically between
the corners' heights); the part below it, clipped from the section, gives
``B`` as its centroid, and ``GZ`` is the horizontal distance from ``G`` to
``B``. Pure geometry, to any angle: the deck's edge going under, the bilge
coming out, the hull lying on its side or keel up. The roll is
``I·φ'' = −m·g·GZ(φ) − 2β·I·φ'``, the hull turning about ``G`` with its
moment of inertia there (the hull's own and the weight's, by Steiner), the
water's braking a linear damping ``β``; stepped by classical Runge–Kutta at
2 ms (``numerics.rk4``).

**What it leaves out.** The water the rolling hull moves along with it (the
added inertia ``a₄₄`` of the roll period's formula), the hull rising and
sinking (it floats at its displacement at every angle, at once), sideways
drift, waves the roll makes, the keel's and the mast's own volume and weight,
and water coming in. The values are an assumed model: a box 20 cm wide,
12 cm deep and 50 cm long, 2 kg with its own centre of gravity 5 cm up; a
1 kg weight from 15 cm under the keel to 40 cm up the mast.
"""

from __future__ import annotations

import itertools
import math
from dataclasses import dataclass

from staunlabor.domain.experiments.constants import G
from staunlabor.domain.experiments.numerics import rk4

#: Fresh water at 20 °C, kg/m³.
WATER_DENSITY = 998.0
#: The step the roll is integrated with.
STEP_S = 0.002
#: How far the weight goes: down the keel (below the hull's bottom) and up the mast, m.
KEEL_M = -0.15
MAST_M = 0.40
#: The water's braking of the roll, 1/s: the page's default.
DAMPING_PER_S = 0.5
#: The stability curve's search: samples from 0° to 180° and halvings of a bracket.
CURVE_SAMPLES = 360
HALVINGS = 50


@dataclass(frozen=True)
class Hull:
    beam_m: float = 0.20
    #: From the bottom of the hull to its deck.
    depth_m: float = 0.12
    length_m: float = 0.50
    mass_kg: float = 2.0
    #: The empty hull's own centre of gravity, above its bottom, and its
    #: radius of gyration about it.
    centre_m: float = 0.05
    gyration_m: float = 0.07

    def __post_init__(self) -> None:
        if not 0.05 <= self.beam_m <= 1 or not 0.02 <= self.depth_m <= 1:
            raise ValueError("a hull is 5 cm to 1 m wide and 2 cm to 1 m deep")
        if not 0.1 <= self.length_m <= 5:
            raise ValueError("a hull is 10 cm to 5 m long")
        if not 0 < self.mass_kg <= 100:
            raise ValueError("a hull weighs more than nothing and at most 100 kg")
        if not 0 <= self.centre_m <= self.depth_m:
            raise ValueError("the hull's own centre of gravity lies within it")
        if not 0 < self.gyration_m <= 1:
            raise ValueError("a hull's radius of gyration is more than nothing and at most 1 m")


@dataclass(frozen=True)
class Weight:
    mass_kg: float = 1.0
    #: Above the hull's bottom; below zero it is down in the keel.
    height_m: float = 0.12

    def __post_init__(self) -> None:
        if not 0 <= self.mass_kg <= 100:
            raise ValueError("a weight is nothing to 100 kg")
        if not KEEL_M <= self.height_m <= MAST_M:
            raise ValueError(f"the weight goes from {KEEL_M * 100:g} cm in the keel to {MAST_M * 100:g} cm up the mast")


Point = tuple[float, float]


def section(hull: Hull) -> list[Point]:
    """The hull's cross-section ``(y, z)``, counter-clockwise: ``y`` across,
    to starboard, from the middle line; ``z`` up from the bottom, ``K``."""
    half = hull.beam_m / 2
    return [(-half, 0.0), (half, 0.0), (half, hull.depth_m), (-half, hull.depth_m)]


def check(hull: Hull, weight: Weight) -> None:
    """The hull must float: its displacement fits in it."""
    if displaced_m2(hull, weight) >= _area(section(hull)):
        raise ValueError("the hull and its weight are too heavy for it: it sinks")


def mass_kg(hull: Hull, weight: Weight) -> float:
    return hull.mass_kg + weight.mass_kg


def displaced_m2(hull: Hull, weight: Weight) -> float:
    """The section's area under water: the displacement over the water's
    density and the hull's length."""
    return mass_kg(hull, weight) / (WATER_DENSITY * hull.length_m)


def gravity_m(hull: Hull, weight: Weight) -> float:
    """``KG``: the centre of gravity of hull and weight, above the bottom."""
    return (hull.mass_kg * hull.centre_m + weight.mass_kg * weight.height_m) / mass_kg(hull, weight)


def inertia_kg_m2(hull: Hull, weight: Weight) -> float:
    """The moment of inertia about the long axis through ``G``: the hull's own
    about its centre, moved to ``G`` (Steiner), and the weight as a point."""
    kg = gravity_m(hull, weight)
    return (
        hull.mass_kg * hull.gyration_m**2
        + hull.mass_kg * (hull.centre_m - kg) ** 2
        + weight.mass_kg * (weight.height_m - kg) ** 2
    )


def _area(polygon: list[Point]) -> float:
    # A loop, not ``sum``: Python's ``sum`` of floats compensates its rounding
    # (3.12 on), the browser's port cannot, and the two must agree to the bit.
    n = len(polygon)
    twice = 0.0
    for i in range(n):
        twice += polygon[i][0] * polygon[(i + 1) % n][1] - polygon[(i + 1) % n][0] * polygon[i][1]
    return twice / 2


def _centroid(polygon: list[Point]) -> Point:
    n = len(polygon)
    a = cy = cz = 0.0
    for i in range(n):
        y0, z0 = polygon[i]
        y1, z1 = polygon[(i + 1) % n]
        cross = y0 * z1 - y1 * z0
        a += cross
        cy += (y0 + y1) * cross
        cz += (z0 + z1) * cross
    return cy / (3 * a), cz / (3 * a)


def _level(p: Point, sin_phi: float, cos_phi: float) -> float:
    """A point's height in the basin, the hull heeled by ``φ`` (starboard
    down) about ``K``."""
    return -p[0] * sin_phi + p[1] * cos_phi


def _chord(polygon: list[Point], height: float, sin_phi: float, cos_phi: float) -> float:
    """The width of the convex section along the level line at ``height``,
    strictly between two corners' heights."""
    ends = []
    n = len(polygon)
    for i in range(n):
        p, q = polygon[i], polygon[(i + 1) % n]
        hp, hq = _level(p, sin_phi, cos_phi), _level(q, sin_phi, cos_phi)
        if (hp - height) * (hq - height) < 0:
            s = (height - hp) / (hq - hp)
            ends.append((p[0] + s * (q[0] - p[0]), p[1] + s * (q[1] - p[1])))
    dy, dz = ends[1][0] - ends[0][0], ends[1][1] - ends[0][1]
    return math.sqrt(dy * dy + dz * dz)


def _corner_heights(polygon: list[Point], sin_phi: float, cos_phi: float) -> list[float]:
    """The corners' heights, lowest first, those a rounding apart taken as one:
    at 90° two corners of a side lie 10⁻¹⁸ m apart, and a stretch that thin
    has no width to read."""
    raw = sorted(_level(p, sin_phi, cos_phi) for p in polygon)
    apart = 1e-12 * (raw[-1] - raw[0])
    heights = [raw[0]]
    for h in raw[1:]:
        if h - heights[-1] > apart:
            heights.append(h)
    heights[-1] = raw[-1]
    return heights


def waterline(polygon: list[Point], area_m2: float, phi: float) -> float:
    """The level, in the basin, of the waterline that leaves ``area_m2`` of the
    heeled section under water. Between two corners' heights the width along a
    level line is linear in the level, the area under it quadratic: the
    stretch is found where the area passes ``area_m2``, and the quadratic
    solved there. Exact, and the same few operations every time."""
    sin_phi, cos_phi = math.sin(phi), math.cos(phi)
    heights = _corner_heights(polygon, sin_phi, cos_phi)
    below = 0.0
    for lo, hi in itertools.pairwise(heights):
        span = hi - lo
        # The width is linear here: read at a quarter and three quarters.
        w1 = _chord(polygon, lo + span / 4, sin_phi, cos_phi)
        w3 = _chord(polygon, lo + 3 * span / 4, sin_phi, cos_phi)
        slope = (w3 - w1) / (span / 2)
        w_lo = w1 - slope * span / 4
        piece = (w1 + w3) / 2 * span
        if below + piece >= area_m2:
            need = area_m2 - below
            # w_lo·s + slope·s²/2 = need, in the form that keeps its digits.
            return lo + 2 * need / (w_lo + math.sqrt(max(0.0, w_lo * w_lo + 2 * slope * need)))
        below += piece
    return heights[-1]


def _clipped(polygon: list[Point], level: float, sin_phi: float, cos_phi: float) -> list[Point]:
    """The part of the section below the level line (Sutherland–Hodgman, one edge)."""
    out: list[Point] = []
    n = len(polygon)
    for i in range(n):
        p, q = polygon[i], polygon[(i + 1) % n]
        dp, dq = _level(p, sin_phi, cos_phi) - level, _level(q, sin_phi, cos_phi) - level
        if dp <= 0:
            out.append(p)
        if dp * dq < 0:
            s = dp / (dp - dq)
            out.append((p[0] + s * (q[0] - p[0]), p[1] + s * (q[1] - p[1])))
    return out


def buoyancy_centre(hull: Hull, weight: Weight, phi: float) -> Point:
    """``B`` in the hull's own ``(y, z)``, heeled by ``φ`` radians."""
    polygon = section(hull)
    sin_phi, cos_phi = math.sin(phi), math.cos(phi)
    level = waterline(polygon, displaced_m2(hull, weight), phi)
    return _centroid(_clipped(polygon, level, sin_phi, cos_phi))


def righting_arm_m(hull: Hull, weight: Weight, phi: float) -> float:
    """``GZ(φ)``: how far ``B`` lies horizontally to the low side of ``G``;
    above zero the pair turns the hull back."""
    y_b, z_b = buoyancy_centre(hull, weight, phi)
    return y_b * math.cos(phi) + (z_b - gravity_m(hull, weight)) * math.sin(phi)


def step(hull: Hull, weight: Weight, damping_per_s: float, phi: float, rate: float) -> tuple[float, float]:
    """One Runge–Kutta step of ``STEP_S``: the heel and its rate, radians."""
    if not 0 <= damping_per_s <= 10:
        raise ValueError("the damping is nothing to 10 per second")
    pull = mass_kg(hull, weight) * G / inertia_kg_m2(hull, weight)

    def f(_t: float, y: tuple[float, ...]) -> tuple[float, ...]:
        return y[1], -pull * righting_arm_m(hull, weight, y[0]) - 2 * damping_per_s * y[1]

    phi, rate = rk4(f, 0.0, (phi, rate), STEP_S)
    return phi, rate


def run(hull: Hull, weight: Weight, damping_per_s: float, start_deg: float, steps: int) -> list[tuple[float, float]]:
    """The hull let go at rest heeled by ``start_deg``: every step's heel and
    rate, radians, the start first."""
    check(hull, weight)
    if not -180 <= start_deg <= 180:
        raise ValueError("a heel lies between −180° and 180°")
    if not 0 <= steps <= 100_000:
        raise ValueError("a run is up to 100 000 steps")
    phi, rate = math.radians(start_deg), 0.0
    out = [(phi, rate)]
    for _ in range(steps):
        phi, rate = step(hull, weight, damping_per_s, phi, rate)
        out.append((phi, rate))
    return out


def curve_m(hull: Hull, weight: Weight, angles_deg: list[float]) -> list[float]:
    """The stability curve: ``GZ`` at each heel, in degrees."""
    check(hull, weight)
    return [righting_arm_m(hull, weight, math.radians(a)) for a in angles_deg]


def _crossing_deg(hull: Hull, weight: Weight, lo: float, hi: float) -> float:
    """Where ``GZ`` changes sign between ``lo`` and ``hi`` degrees, by halving."""
    positive = righting_arm_m(hull, weight, math.radians(lo)) > 0
    for _ in range(HALVINGS):
        mid = (lo + hi) / 2
        if (righting_arm_m(hull, weight, math.radians(mid)) > 0) == positive:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


@dataclass(frozen=True)
class ShipFigures:
    #: How deep it floats, the heights of B and M above K, B to M, and G.
    draft_m: float
    kb_m: float
    bm_m: float
    km_m: float
    kg_m: float
    #: ``GM = KM − KG``: above zero it rights itself from a small heel.
    gm_m: float
    #: ``2π·√(I/(m·g·GM))``, the small roll's period undamped; ``None`` where
    #: ``GM`` is not above zero.
    period_s: float | None
    #: The weight's height at which ``GM`` is zero, above K: higher, the
    #: upright hull falls over.
    weight_limit_m: float | None
    #: The stability curve from 0° to 180°: its greatest arm and where; where
    #: it turns negative (beyond it the hull goes over); where it lolls, if
    #: upright it cannot stand; whether it floats keel up.
    max_arm_m: float
    max_arm_deg: float
    vanishing_deg: float | None
    loll_deg: float | None
    keel_up: bool


def figures(hull: Hull, weight: Weight) -> ShipFigures:
    check(hull, weight)
    polygon = section(hull)
    area = displaced_m2(hull, weight)
    level = waterline(polygon, area, 0.0)
    upright = _clipped(polygon, level, 0.0, 1.0)
    kb = _centroid(upright)[1]
    # The upright waterline's second moment about the middle line, per length.
    width = _chord(polygon, level, 0.0, 1.0)
    bm = width**3 / 12 / area
    kg = gravity_m(hull, weight)
    gm = kb + bm - kg
    m = mass_kg(hull, weight)
    period = 2 * math.pi * math.sqrt(inertia_kg_m2(hull, weight) / (m * G * gm)) if gm > 0 else None
    limit = (m * (kb + bm) - hull.mass_kg * hull.centre_m) / weight.mass_kg if weight.mass_kg > 0 else None
    angles = [180 * k / CURVE_SAMPLES for k in range(CURVE_SAMPLES + 1)]
    arms = curve_m(hull, weight, angles)
    best = max(range(1, CURVE_SAMPLES), key=lambda k: arms[k])
    vanishing = loll = None
    for k in range(1, CURVE_SAMPLES - 1):
        a, b = arms[k], arms[k + 1]
        if a > 0 >= b and vanishing is None:
            vanishing = _crossing_deg(hull, weight, angles[k], angles[k + 1])
        if a <= 0 < b and loll is None and gm <= 0:
            loll = _crossing_deg(hull, weight, angles[k], angles[k + 1])
    if gm <= 0 and loll is None:
        vanishing = 0.0
    return ShipFigures(
        draft_m=level,
        kb_m=kb,
        bm_m=bm,
        km_m=kb + bm,
        kg_m=kg,
        gm_m=gm,
        period_s=period,
        weight_limit_m=limit,
        max_arm_m=arms[best],
        max_arm_deg=angles[best],
        vanishing_deg=vanishing,
        loll_deg=loll,
        keel_up=arms[CURVE_SAMPLES - 1] < 0,
    )
