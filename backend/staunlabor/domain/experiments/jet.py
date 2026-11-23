"""The light in the water jet: a laser shone into a jet of water follows it round its bend into the basin.

The exhibit is a tank of water with a hole low in its front wall and a laser
behind it, shining through the water into the hole. The water leaves as a
smooth jet and arcs down into a basin — and the laser's light does not go on
straight: it stays inside the jet, follows its bend, and comes out where the
jet ends, lighting the basin's water. Tilt the laser too far, or let the jet
bend too sharply, and the light leaks out along the way.

**Why the light stays in.** Inside the water a ray meets the jet's surface at
a grazing angle, far from the surface's normal. Light going from water into
air is bent away from the normal (Snell's law, ``n·sin φ = sin φ_t``); beyond
the critical angle ``φ_c = arcsin(1/n)``, 48.6° for water, there is no angle
left to bend it to and all of it is reflected: total internal reflection.
Reflected, the ray crosses the jet to its other side and meets that at a
grazing angle again, and so on, to the end. Below the critical angle some of
it gets out at every hit (Fresnel's formulas say how much), the rest goes on.

**The model.** The jet leaves the hole level at Torricelli's speed
``v = √(2g·h)``, ``h`` the water above the hole, and falls as a thrown stone
does: its axis is the parabola ``y = −k·x²`` with ``k = g/(2v²)``, which bends
most sharply at the hole, with a radius of ``v²/g = 2h``, and meets the basin
``H`` below at ``x = v·√(2H/g) = 2√(h·H)``. The jet is a band as wide as the
hole round that axis, the section through it in the plane it falls in. A ray
starts across the hole at the laser's tilt in the water and goes straight
until it meets the band's edge: the edge is where its distance from the axis
is the hole's radius, the nearest point of the axis found by Newton's method
(the cubic ``2k²u³ + (1 + 2k·y)·u − x = 0``) and the meeting point by halving.
Every step is as long as the ray's distance from the nearer edge (it cannot
reach the edge sooner), but at least a sixteenth of the radius. At the edge
the ray is reflected; below the critical angle the share ``1 − R`` leaves,
``R`` the reflectance of the unpolarised light, the mean of Fresnel's ``R_s``
and ``R_p``, refracted out by Snell's law. Nine rays across the hole make the
beam; where their light leaves the jet, and how much reaches the basin, is
what the page shows.

**What it leaves out.** The jet's other dimension: it is round, and rays that
do not lie in the plane it falls in (skew rays) meet its surface more
grazingly still; the jet's narrowing as it speeds up; its breaking into drops
towards its end (the light comes out where it does, as at the basin); the
laser's own polarisation and the beam's spread; the wobble of the surface; the
light the window of the tank and the water itself take.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from staunlabor.domain.experiments.constants import G

#: Rays across the hole: the beam.
RAYS = 9
#: The shortest step a ray takes, in the jet's radius: a grazing hit on the
#: jet's inner edge (which bulges into the jet) shorter than this may be missed,
#: and turns the ray by less than a degree.
LEAST_STEP = 1 / 16
#: Halvings of a step to find where it meets the jet's end: from a radius to
#: below 10⁻¹⁷ m.
HALVINGS = 48
#: Where a ray meets the edge, the Illinois method's steps at most, and the
#: width, in the radius, its bracket ends within.
FALSI = 40
EDGE_TOLERANCE = 1e-12
#: Newton's steps for the nearest point of the axis, at most.
NEWTON = 50
#: Hits on the edge a ray may make before it is given up as trapped: far more
#: than the jet's length allows inside the bounds.
MAX_HITS = 4000
#: A ray whose light is below this share is followed no further: the rest of
#: it leaves where its last light did.
FADED = 1e-6
#: The jet's way to the basin in bins, for where its light leaves.
BINS = 40
#: "The first light out": the first place a thousandth of the beam leaves.
NOTICED = 1e-3


@dataclass(frozen=True)
class Jet:
    #: The water in the tank above the hole, ``h``.
    level_m: float = 0.15
    #: The hole's diameter, the jet's.
    hole_m: float = 0.006
    #: From the hole down to the basin's water, ``H``.
    drop_m: float = 0.4
    #: The liquid's refractive index: water's for visible light.
    index: float = 1.333

    def __post_init__(self) -> None:
        # At least 5 mm: the axis bends at the hole with a radius of 2h, so even
        # the widest hole's jet bends no tighter than twice its own radius (a
        # jet bent tighter than its radius would fold over itself).
        if not 0.005 <= self.level_m <= 0.5:
            raise ValueError("the water stands 5 mm to 50 cm above the hole")
        if not 0.002 <= self.hole_m <= 0.01:
            raise ValueError("the hole is 2 to 10 mm wide")
        if not 0.1 <= self.drop_m <= 1.0:
            raise ValueError("the basin is 10 cm to 1 m below the hole")
        if not 1.2 <= self.index <= 1.6:
            raise ValueError("a liquid's index is 1.2 to 1.6")


#: The laser's tilt in the water, from the jet's axis, at most either way.
MAX_TILT_DEG = 60.0


def speed_m_s(jet: Jet) -> float:
    """Torricelli: ``v = √(2g·h)``."""
    return math.sqrt(2 * G * jet.level_m)


def _k(jet: Jet) -> float:
    """``k`` of the axis ``y = −k·x²``: ``g/(2v²)``."""
    v = speed_m_s(jet)
    return G / (2 * v * v)


def bend_radius_m(jet: Jet) -> float:
    """The axis's radius of curvature at the hole, where it is smallest: ``v²/g``."""
    v = speed_m_s(jet)
    return v * v / G


def landing_m(jet: Jet) -> float:
    """How far from the hole the jet meets the basin: ``v·√(2H/g)``."""
    return speed_m_s(jet) * math.sqrt(2 * jet.drop_m / G)


def axis_y(jet: Jet, x: float) -> float:
    """The jet's axis ``x`` from the hole: ``−k·x²``."""
    return -_k(jet) * x * x


def axis_normal(jet: Jet, x: float) -> tuple[float, float]:
    """The axis's unit normal at ``x``, towards the outside of its bend (up)."""
    k = _k(jet)
    norm = math.sqrt(1 + 4 * k * k * x * x)
    return 2 * k * x / norm, 1 / norm


def critical_angle(n: float) -> float:
    """``φ_c = arcsin(1/n)``, rad: from water to air."""
    return math.asin(1 / n)


def reflectance(n: float, cos_i: float) -> float:
    """The share of unpolarised light reflected where a ray inside the liquid
    meets its surface ``cos_i`` off the normal: 1 at the critical angle and
    beyond, else the mean of Fresnel's ``R_s`` and ``R_p``."""
    sin2 = 1 - cos_i * cos_i
    inside = 1 - n * n * sin2
    if inside <= 0:
        return 1.0
    cos_t = math.sqrt(inside)
    rs = (n * cos_i - cos_t) / (n * cos_i + cos_t)
    rp = (n * cos_t - cos_i) / (n * cos_t + cos_i)
    return 0.5 * (rs * rs + rp * rp)


def _foot(k: float, qx: float, qy: float, u: float) -> float:
    """The axis's point nearest ``(qx, qy)``, by Newton from ``u``: where the
    squared distance's slope ``2k²u³ + (1 + 2k·qy)·u − qx`` is zero."""
    for _ in range(NEWTON):
        slope = 2 * k * k * u * u * u + (1 + 2 * k * qy) * u - qx
        bend = 6 * k * k * u * u + 1 + 2 * k * qy
        step = slope / bend
        u -= step
        if abs(step) <= 1e-15 * (1 + abs(u)):
            break
    return u


def _off(k: float, qx: float, qy: float, u: float) -> tuple[float, float, float]:
    """How far ``(qx, qy)`` lies from the axis at its foot ``u``, up the
    normal positive, and the normal."""
    norm = math.sqrt(1 + 4 * k * k * u * u)
    nx, ny = 2 * k * u / norm, 1 / norm
    return (qx - u) * nx + (qy + k * u * u) * ny, nx, ny


@dataclass(frozen=True)
class Escape:
    """Light leaving the jet at a hit on its edge."""

    x: float
    y: float
    #: The way it leaves, a unit vector.
    out: tuple[float, float]
    #: The edge's unit normal there, outwards.
    normal: tuple[float, float]
    #: The share of the ray's light at the hit that leaves: ``1 − R``.
    share: float
    #: The light that leaves, as a share of the ray's at the hole (the faded
    #: rest included at its last hit).
    light: float


@dataclass(frozen=True)
class Ray:
    #: Where it starts across the hole (−1 below to 1 above, in the radius), and
    #: its tilt, rad.
    start: float
    tilt_rad: float
    #: Its way: the hole, every hit on the edge, its end; x and y apart.
    xs: tuple[float, ...]
    ys: tuple[float, ...]
    #: ``cos φ`` at each hit, ``φ`` the angle from the edge's normal.
    hits_cos: tuple[float, ...]
    escapes: tuple[Escape, ...]
    #: Its light that reaches the basin.
    arrives: float
    #: "basin", "faded" (all its light out on the way), "tank" (back through
    #: the hole) or "trapped" (more than ``MAX_HITS`` hits).
    end: str


def _to_edge(
    k: float,
    a: float,
    px: float,
    py: float,
    dx: float,
    dy: float,
    t0: float,
    u0: float,
    s0: float,
    t1: float,
    u1: float,
    s1: float,
) -> tuple[float, float, float, float, float]:
    """Where the ray from ``(px, py)`` along ``(dx, dy)`` meets the jet's edge
    between ``t0`` (inside) and ``t1`` (past it): the distance from the axis
    less the radius is zero there, found by the Illinois method (false
    position that halves a stuck end's value), some six steps where halving
    took 48 — most of the time a grazing ray's hundreds of hits took."""
    f0, f1 = abs(s0) - a, abs(s1) - a
    last = 0
    for _ in range(FALSI):
        tm = t1 - f1 * (t1 - t0) / (f1 - f0)
        um = _foot(k, px + tm * dx, py + tm * dy, u0)
        sm = _off(k, px + tm * dx, py + tm * dy, um)[0]
        fm = abs(sm) - a
        if fm >= 0:
            t1, u1, s1, f1 = tm, um, sm, fm
            if last == 1:
                f0 *= 0.5
            last = 1
        else:
            t0, u0, f0 = tm, um, fm
            if last == -1:
                f1 *= 0.5
            last = -1
        if t1 - t0 <= EDGE_TOLERANCE * a:
            break
    return t0, u0, t1, u1, s1


def _march(
    k: float, a: float, end_x: float, px: float, py: float, dx: float, dy: float, u: float
) -> tuple[float, float, float, float]:
    """The ray from ``(px, py)`` along ``(dx, dy)``, ``u`` its foot on the
    axis, to its next event: ``t0`` and its foot just inside the jet, and the
    foot and the distance from the axis just past it — past the edge, the
    jet's end, or (behind the hole) its start."""
    t0, u0 = 0.0, u
    s0 = _off(k, px, py, u0)[0]
    while True:
        t1 = t0 + max(a - abs(s0), LEAST_STEP * a)
        u1 = _foot(k, px + t1 * dx, py + t1 * dy, u0)
        s1 = _off(k, px + t1 * dx, py + t1 * dy, u1)[0]
        if abs(s1) >= a or u1 >= end_x or u1 < 0:
            break
        t0, u0, s0 = t1, u1, s1
    if not (u1 >= end_x or u1 < 0):
        t0, u0, _, u1, s1 = _to_edge(k, a, px, py, dx, dy, t0, u0, s0, t1, u1, s1)
        return t0, u0, u1, s1
    # The jet's end (or the hole, behind): halve the step, t0 inside the
    # jet, t1 past it.
    for _ in range(HALVINGS):
        tm = 0.5 * (t0 + t1)
        um = _foot(k, px + tm * dx, py + tm * dy, u0)
        sm = _off(k, px + tm * dx, py + tm * dy, um)[0]
        if abs(sm) >= a or um >= end_x or um < 0:
            t1, u1, s1 = tm, um, sm
        else:
            t0, u0 = tm, um
    return t0, u0, u1, s1


def trace(jet: Jet, start: float, tilt_rad: float) -> Ray:
    """A ray from ``start`` across the hole at ``tilt_rad`` (up positive),
    followed to the basin."""
    if not -1 < start < 1:
        raise ValueError("a ray starts inside the hole")
    if not abs(tilt_rad) <= math.radians(MAX_TILT_DEG) + 1e-12:
        raise ValueError("the laser is tilted at most 60° either way")
    a = jet.hole_m / 2
    n = jet.index
    k = _k(jet)
    end_x = landing_m(jet)
    px, py = 0.0, start * a
    dx, dy = math.cos(tilt_rad), math.sin(tilt_rad)
    u = 0.0
    light = 1.0
    xs, ys = [px], [py]
    hits: list[float] = []
    escapes: list[Escape] = []
    end = "trapped"
    while len(hits) < MAX_HITS:
        t0, u0, u1, s1 = _march(k, a, end_x, px, py, dx, dy, u)
        px, py, u = px + t0 * dx, py + t0 * dy, u0
        xs.append(px)
        ys.append(py)
        if u1 >= end_x:
            end = "basin"
            break
        if u1 < 0:
            end = "tank"
            break
        _, nx, ny = _off(k, px, py, u1)
        side = 1.0 if s1 > 0 else -1.0
        nx, ny = side * nx, side * ny
        cos_i = dx * nx + dy * ny
        hits.append(cos_i)
        r = reflectance(n, cos_i)
        if r < 1:
            cos_t = math.sqrt(1 - n * n * (1 - cos_i * cos_i))
            along = n * cos_i - cos_t
            out = (n * dx - along * nx, n * dy - along * ny)
            leaving = light * (1 - r)
            light *= r
            faded = light < FADED
            if faded:
                leaving, light = leaving + light, 0.0
            escapes.append(Escape(x=px, y=py, out=out, normal=(nx, ny), share=1 - r, light=leaving))
            if faded:
                end = "faded"
                break
        dx, dy = dx - 2 * cos_i * nx, dy - 2 * cos_i * ny
    return Ray(
        start=start,
        tilt_rad=tilt_rad,
        xs=tuple(xs),
        ys=tuple(ys),
        hits_cos=tuple(hits),
        escapes=tuple(escapes),
        arrives=light if end == "basin" else 0.0,
        end=end,
    )


def starts() -> list[float]:
    """Where the beam's rays start across the hole: evenly, each in the
    middle of its share."""
    return [2 * (j + 0.5) / RAYS - 1 for j in range(RAYS)]


@dataclass(frozen=True)
class Beam:
    rays: tuple[Ray, ...]
    #: The share of the beam's light that reaches the basin.
    arrives: float
    #: The share that leaves the jet on its way, per bin of its way across to
    #: the basin (``BINS`` bins from the hole to ``landing_m``).
    left: tuple[float, ...]
    #: The share lost back into the tank or trapped (none inside the bounds).
    lost: float


def beam(jet: Jet, tilt_deg: float) -> Beam:
    """The laser's beam, ``RAYS`` rays across the hole at ``tilt_deg``."""
    rays = tuple(trace(jet, s, math.radians(tilt_deg)) for s in starts())
    end_x = landing_m(jet)
    left = [0.0] * BINS
    for ray in rays:
        for e in ray.escapes:
            j = min(BINS - 1, max(0, int(e.x / end_x * BINS)))
            left[j] += e.light / RAYS
    # Added up one by one, as the port does: Python's ``sum`` compensates its
    # rounding (3.12 on), a reduce in the browser does not, and the beam's
    # last bits differed.
    arrived = 0.0
    for r in rays:
        arrived += r.arrives
    out = 0.0
    for share in left:
        out += share
    arrives = arrived / RAYS
    return Beam(rays=rays, arrives=arrives, left=tuple(left), lost=max(0.0, 1 - arrives - out))


@dataclass(frozen=True)
class JetFigures:
    speed_m_s: float
    #: The axis's radius of curvature at the hole: ``2h``.
    bend_radius_m: float
    critical_deg: float
    landing_m: float
    #: The share of the light that reaches the basin.
    arrives: float
    #: The smallest angle from the normal any ray meets the edge at, degrees;
    #: None if no ray meets it.
    steepest_deg: float | None
    #: Where along the way (from the hole, across) a thousandth of the beam
    #: first leaves; None if it never does.
    first_out_m: float | None
    #: The hits on the edge of the middle ray.
    middle_hits: int


def figures(jet: Jet, tilt_deg: float) -> JetFigures:
    return figures_of(jet, beam(jet, tilt_deg))


def figures_of(jet: Jet, b: Beam) -> JetFigures:
    """The figures of a beam already traced: the page's, which draws it too."""
    cosines = [c for r in b.rays for c in r.hits_cos]
    out = [e.x for r in b.rays for e in r.escapes if e.light / RAYS >= NOTICED]
    return JetFigures(
        speed_m_s=speed_m_s(jet),
        bend_radius_m=bend_radius_m(jet),
        critical_deg=math.degrees(critical_angle(jet.index)),
        landing_m=landing_m(jet),
        arrives=b.arrives,
        steepest_deg=math.degrees(math.acos(min(1.0, max(cosines)))) if cosines else None,
        first_out_m=min(out) if out else None,
        middle_hits=len(b.rays[RAYS // 2].hits_cos),
    )
