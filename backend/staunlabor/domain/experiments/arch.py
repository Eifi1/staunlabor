"""The chain and the arch: a hanging chain shows a stone arch its shape.

The exhibit is an arch of loose stones, no mortar, that stands — if its shape
is right; beside it a hanging chain, which, turned upside down, is that shape.

**The chain.** A chain hung from two points takes the catenary
``y = a·cosh(x/a)``; turned upside down through the springings and the arch's
crown it is ``y = h − a·(cosh(x/a) − 1)``, ``a`` from ``a·(cosh(c/a) − 1) = h``.
Under its own weight alone, evenly spread along it, a chain is pulled only
along itself; upside down, an arch of that shape is pressed only along itself.

**The arch** (Heyman's way). Stones stand as long as each joint is pressed and
the line of the pressing — the thrust line — crosses every joint inside the
stone: masonry takes no tension, and friction is taken to hold. The arch's
centre line is cut into equal blocks by joints across it; each block's weight
acts at its centroid (a block is the four-cornered piece between two joints).
A load may stand on the extrados. Left of joint ``j`` the support's reaction
``(H, V)`` with its moment ``M`` about the first joint, and the weights, give
the force across the joint and where it crosses it,
``e_j = −M̄_j / N_j``: everything linear in ``(H, V, M)``. The arch stands if
some ``(H, V, M)`` keeps ``|e_j| ≤ t/2`` at every joint; the smallest
``λ`` for which some keeps ``|e_j| ≤ λ·t/2`` says how near it is (``1/λ``:
Heyman's geometric factor of safety). Found exactly: for a fixed ``V`` the
feasible ``(H, M)`` is a polygon cut from a box by the joints' half-planes,
``λ`` is bisected on it, and ``V`` is searched by the golden section (or is
half the load, when the load is symmetric).

**What it leaves out.** Sliding (friction is taken to hold), the stones'
crushing (they are taken to be strong), the abutments' give, and anything
after the first hinges form: the page shows where an arch breaks open, not how
it falls.
"""

from __future__ import annotations

import itertools
import math
from dataclasses import dataclass
from typing import Literal

from staunlabor.domain.experiments.constants import G

Shape = Literal["semicircle", "pointed", "catenary"]

#: How many bisections pin λ, and golden-section steps pin V.
BISECTIONS = 40
GOLDEN_STEPS = 40

Point = tuple[float, float]


# ── the chain ────────────────────────────────────────────────────────────────


def catenary_a_for_rise(half_span_m: float, rise_m: float) -> float:
    """``a`` of the catenary that rises ``rise_m`` over ``half_span_m``:
    ``a·(cosh(c/a) − 1) = h``, by bisection."""
    lo, hi = half_span_m / 50, half_span_m * 1e4
    for _ in range(200):
        mid = math.sqrt(lo * hi)
        if mid * (math.cosh(half_span_m / mid) - 1) > rise_m:
            lo = mid
        else:
            hi = mid
    return math.sqrt(lo * hi)


# ── the arch ─────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class Arch:
    shape: Shape = "semicircle"
    #: Between the springings, along the centre line's ends.
    span_m: float = 2.0
    #: Across the arch: from intrados to extrados.
    thickness_m: float = 0.25
    #: How many stones; even, so a pointed arch has a joint at its point.
    blocks: int = 16
    density_kg_m3: float = 2400.0
    #: Into the page.
    depth_m: float = 0.3

    def __post_init__(self) -> None:
        if self.shape not in ("semicircle", "pointed", "catenary"):
            raise ValueError("an arch is a semicircle, pointed or a catenary")
        if not 0.5 <= self.span_m <= 50:
            raise ValueError("the span lies between 50 cm and 50 m")
        if not 0 < self.thickness_m <= self.span_m / 2:
            raise ValueError("an arch is thicker than nothing and at most half its span")
        if not (4 <= self.blocks <= 200 and self.blocks % 2 == 0):
            raise ValueError("an arch has an even number of stones, between 4 and 200")


@dataclass(frozen=True)
class Load:
    #: Where it stands, as a share of the half span from the middle: −1 left, 1 right.
    at: float = 0.5
    weight_n: float = 0.0

    def __post_init__(self) -> None:
        if not -1 <= self.at <= 1:
            raise ValueError("a load stands on the arch, between its ends")
        if self.weight_n < 0:
            raise ValueError("a load presses down")


def rise_m(arch: Arch) -> float:
    c = arch.span_m / 2
    return arch.span_m * math.sqrt(3) / 2 if arch.shape == "pointed" else c


def _centre(arch: Arch, s: float, a: float) -> tuple[Point, Point]:
    """The centre line's point and unit tangent (left to right) at ``s`` ∈ [0, 1]
    of its length."""
    c = arch.span_m / 2
    if arch.shape == "semicircle":
        phi = math.pi * (1 - s)
        return (c * math.cos(phi), c * math.sin(phi)), (math.sin(phi), -math.cos(phi))
    if arch.shape == "pointed":
        # Two arcs of radius the span, each centred at the other springing,
        # meeting at the point; each a sixth of a circle.
        r = arch.span_m
        if s <= 0.5:
            phi = math.pi / 3 * (s / 0.5)
            return (c - r * math.cos(phi), r * math.sin(phi)), (math.sin(phi), math.cos(phi))
        phi = math.pi / 3 * ((1 - s) / 0.5)
        return (-c + r * math.cos(phi), r * math.sin(phi)), (math.sin(phi), -math.cos(phi))
    # Catenary: y = h − a·(cosh(x/a) − 1), through the springings at y = 0.
    total = 2 * a * math.sinh(c / a)
    x = a * math.asinh((s - 0.5) * total / a)
    slope = -math.sinh(x / a)
    norm = math.hypot(1, slope)
    return (x, c - a * (math.cosh(x / a) - 1)), (1 / norm, slope / norm)


@dataclass(frozen=True)
class Joint:
    centre: Point
    #: Across the joint, from intrados to extrados.
    normal: Point
    tangent: Point


def joints(arch: Arch) -> list[Joint]:
    a = catenary_a_for_rise(arch.span_m / 2, rise_m(arch)) if arch.shape == "catenary" else 0.0
    out = []
    for j in range(arch.blocks + 1):
        p, t = _centre(arch, j / arch.blocks, a)
        if arch.shape == "pointed" and j == arch.blocks // 2:
            # At the point the two arcs meet at an angle: the joint is upright.
            t = (1.0, 0.0)
        out.append(Joint(centre=p, normal=(-t[1], t[0]), tangent=t))
    return out


def _edge(joint: Joint, offset: float) -> Point:
    return joint.centre[0] + offset * joint.normal[0], joint.centre[1] + offset * joint.normal[1]


@dataclass(frozen=True)
class Block:
    #: Intrados left, intrados right, extrados right, extrados left.
    corners: tuple[Point, Point, Point, Point]
    weight_n: float
    centroid: Point


def blocks(arch: Arch) -> list[Block]:
    js = joints(arch)
    half = arch.thickness_m / 2
    out = []
    for left, right in itertools.pairwise(js):
        corners = (_edge(left, -half), _edge(right, -half), _edge(right, half), _edge(left, half))
        area = cx = cy = 0.0
        for (x0, y0), (x1, y1) in zip(corners, corners[1:] + corners[:1], strict=True):
            cross = x0 * y1 - x1 * y0
            area += cross
            cx += (x0 + x1) * cross
            cy += (y0 + y1) * cross
        area /= 2
        out.append(
            Block(
                corners=corners,
                weight_n=abs(area) * arch.depth_m * arch.density_kg_m3 * G,
                centroid=(cx / (6 * area), cy / (6 * area)),
            )
        )
    return out


def load_point(arch: Arch, load: Load) -> tuple[int, Point]:
    """The block the load stands on and the point on its extrados below it."""
    x = load.at * arch.span_m / 2
    bs = blocks(arch)
    # The block whose extrados is nearest above x: the extrados runs left to
    # right, so the first whose right end reaches x.
    best = len(bs) - 1
    for i, b in enumerate(bs):
        if b.corners[2][0] >= x:
            best = i
            break
    b = bs[best]
    (x0, y0), (x1, y1) = b.corners[3], b.corners[2]
    share = 0.5 if x1 == x0 else min(1.0, max(0.0, (x - x0) / (x1 - x0)))
    return best, (x0 + share * (x1 - x0), y0 + share * (y1 - y0))


@dataclass(frozen=True)
class _Rows:
    """Per joint: Mbar = M − dy·H + dx·V + s and N = τx·H + τy·(V − w) + 0."""

    dx: list[float]
    dy: list[float]
    s: list[float]
    tx: list[float]
    ty: list[float]
    w: list[float]


def _rows(arch: Arch, load: Load) -> tuple[_Rows, float]:
    js = joints(arch)
    bs = blocks(arch)
    forces: list[tuple[int, Point, float]] = [(i, b.centroid, b.weight_n) for i, b in enumerate(bs)]
    if load.weight_n > 0:
        at, point = load_point(arch, load)
        forces.append((at, point, load.weight_n))
    p0 = js[0].centre
    rows = _Rows(dx=[], dy=[], s=[], tx=[], ty=[], w=[])
    for j, joint in enumerate(js):
        pj = joint.centre
        left = [(point, w) for i, point, w in forces if i < j]
        # The weights' moment about the joint: (C − P_j) × (0, −w) = −(Cx − Px)·w.
        rows.s.append(sum(-(point[0] - pj[0]) * w for point, w in left))
        rows.w.append(sum(w for _, w in left))
        rows.dx.append(p0[0] - pj[0])
        rows.dy.append(p0[1] - pj[1])
        rows.tx.append(joint.tangent[0])
        rows.ty.append(joint.tangent[1])
    return rows, sum(w for _, _, w in forces)


Polygon = list[Point]


def _clip(poly: Polygon, a: float, b: float, c: float) -> Polygon:
    """Keep the part of a convex polygon where ``a·H + b·M + c ≤ 0``."""
    out: Polygon = []
    n = len(poly)
    for k in range(n):
        p, q = poly[k], poly[(k + 1) % n]
        fp = a * p[0] + b * p[1] + c
        fq = a * q[0] + b * q[1] + c
        if fp <= 0:
            out.append(p)
        if (fp < 0 < fq) or (fq < 0 < fp):
            share = fp / (fp - fq)
            out.append((p[0] + share * (q[0] - p[0]), p[1] + share * (q[1] - p[1])))
    return out


def _feasible(rows: _Rows, v: float, reach: float, bound: float) -> Polygon:
    """The (H, M) that keep every joint's ``|e| ≤ reach`` with ``V = v``."""
    poly: Polygon = [(0.0, -bound), (bound, -bound), (bound, bound), (0.0, bound)]
    for j in range(len(rows.s)):
        # Mbar = M − dy·H + (dx·V + s);  N = tx·H + ty·(V − w).
        m_h, m_c = -rows.dy[j], rows.dx[j] * v + rows.s[j]
        n_h, n_c = rows.tx[j], rows.ty[j] * (v - rows.w[j])
        # Mbar − reach·N ≤ 0 and −Mbar − reach·N ≤ 0.
        poly = _clip(poly, m_h - reach * n_h, 1.0, m_c - reach * n_c)
        if not poly:
            return poly
        poly = _clip(poly, -m_h - reach * n_h, -1.0, -m_c - reach * n_c)
        if not poly:
            return poly
    return poly


def _least_reach(rows: _Rows, v: float, bound: float, high: float) -> tuple[float, Polygon]:
    """The smallest reach with some (H, M) at this V, by bisection up to ``high``."""
    if not _feasible(rows, v, high, bound):
        return math.inf, []
    lo, hi = 0.0, high
    best = _feasible(rows, v, hi, bound)
    for _ in range(BISECTIONS):
        mid = (lo + hi) / 2
        poly = _feasible(rows, v, mid, bound)
        if poly:
            hi, best = mid, poly
        else:
            lo = mid
    return hi, best


@dataclass(frozen=True)
class Thrust:
    #: λ: the thrust line's widest reach from the centre line, as a share of
    #: half the thickness. At most 1: the arch stands.
    reach: float
    stands: bool
    #: The support's push: across, up, and its moment about the first joint.
    h_n: float
    v_n: float
    m_n_m: float
    #: Where the line crosses each joint, from the centre line towards the
    #: extrados, m, and the crossing points.
    offsets_m: tuple[float, ...]
    points: tuple[Point, ...]
    #: The arch's own weight and the load's, N.
    weight_n: float


def thrust(arch: Arch, load: Load | None = None) -> Thrust:
    """The thrust line that stays nearest the centre line, and how near."""
    load = load or Load()
    rows, total = _rows(arch, load)
    bound = 1e3 * total * arch.span_m + 1.0
    # Far beyond the stone: an arch whose best line reaches further is
    # hopeless, and the page says only that it falls.
    high = 1e3 * arch.thickness_m / 2
    symmetric = load.weight_n == 0 or load.at == 0
    if symmetric:
        v = total / 2
        reach, poly = _least_reach(rows, v, bound, high)
    else:
        lo, hi = 0.0, total
        golden = (math.sqrt(5) - 1) / 2
        a, b = hi - golden * (hi - lo), lo + golden * (hi - lo)
        fa, fb = _least_reach(rows, a, bound, high)[0], _least_reach(rows, b, bound, high)[0]
        for _ in range(GOLDEN_STEPS):
            if fa <= fb:
                hi, b, fb = b, a, fa
                a = hi - golden * (hi - lo)
                fa = _least_reach(rows, a, bound, high)[0]
            else:
                lo, a, fa = a, b, fb
                b = lo + golden * (hi - lo)
                fb = _least_reach(rows, b, bound, high)[0]
        v = (lo + hi) / 2
        reach, poly = _least_reach(rows, v, bound, high)
    if not poly:
        raise ValueError("no thrust line keeps every joint pressed")
    h = sum(p[0] for p in poly) / len(poly)
    m = sum(p[1] for p in poly) / len(poly)
    js = joints(arch)
    offsets = []
    points = []
    for j, joint in enumerate(js):
        mbar = m - rows.dy[j] * h + rows.dx[j] * v + rows.s[j]
        n = rows.tx[j] * h + rows.ty[j] * (v - rows.w[j])
        e = -mbar / n
        offsets.append(e)
        points.append(_edge(joint, e))
    lam = reach / (arch.thickness_m / 2)
    return Thrust(
        reach=lam,
        stands=lam <= 1,
        h_n=h,
        v_n=v,
        m_n_m=m,
        offsets_m=tuple(offsets),
        points=tuple(points),
        weight_n=total,
    )
