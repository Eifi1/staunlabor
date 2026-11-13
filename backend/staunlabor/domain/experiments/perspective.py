"""The chair that is three things: one picture, and the depth a single eye cannot see.

The exhibit is three boxes on a table, each with its own peephole. Behind the
first stands a small chair; behind the second, a skewed one — legs of different
lengths, a seat that is no square; behind the third, rods that touch nowhere.
Through each hole it is the same chair. The magic comes after, seeing the boxes
from outside: how far apart in space the rods really are. Plato's cave in a
box — the hole shows the shadow, the side view the thing — and the page has
both views: the picture through the hole, and the box turned round with the
lines of sight drawn in (:func:`sight_lines`), the one thing the three objects
share.

**Why.** A hole fixes where the eye is, and an eye sees directions, not
distances. Every point ``P`` can slide along its line of sight,
``P' = E + λ·(P − E)`` with ``λ > 0``, and the eye at ``E`` sees no change.

* **The skewed chair** slides every point by a ``λ`` that varies smoothly:
  ``P' − E = (P − E)/(1 + w·(P − E))`` — a projective map that keeps every line
  through the eye, so straight rods stay straight and joints stay joined
  (:func:`skew`). It is a chair, only not the one you think.
* **The scattered rods** slide each rod by its own ``λ`` (:func:`scatter`):
  each rod stays a rod in the same direction, but two rods that met at a joint
  now meet only on the eye's line of sight, at two different depths.

**How exact the hole has to be.** Move the eye sideways by δ and two points
that lined up at distances ``d₁`` and ``d₂`` come apart by about
``δ·|1/d₁ − 1/d₂|`` radians (:func:`joint_gap` computes it exactly). The eye
resolves about one minute of arc; for the default box a joint opens to that
after a fraction of a millimetre (:func:`tolerance`) — smaller than the hole
and the pupil. That the illusion still holds says the rest is the brain's:
a blurred gap at the wrong depth is read as a chair, because chairs are what
there are. A second eye, 65 mm away, sees the gaps several degrees wide
(:func:`binocular_gap`), which is why there is one hole per object.

What it leaves out: the lens. The eye is a pinhole here; a real pupil of a few
millimetres sees each point as a small blur, which is the depth-of-field part
of the story the page tells in words, not numbers.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from enum import StrEnum

Vec = tuple[float, float, float]

#: One minute of arc: what an eye with normal acuity tells apart.
ACUITY_RAD = math.radians(1 / 60)
#: The distance between a typical adult's pupils.
EYE_BASELINE_M = 0.065


class FigureKind(StrEnum):
    CHAIR = "chair"
    SKEWED = "skewed"
    SCATTERED = "scattered"


@dataclass(frozen=True)
class Segment:
    a: Vec
    b: Vec


@dataclass(frozen=True)
class Figure:
    kind: FigureKind
    segments: tuple[Segment, ...]


def _sub(p: Vec, q: Vec) -> Vec:
    return (p[0] - q[0], p[1] - q[1], p[2] - q[2])


def _add(p: Vec, q: Vec) -> Vec:
    return (p[0] + q[0], p[1] + q[1], p[2] + q[2])


def _scale(p: Vec, s: float) -> Vec:
    return (p[0] * s, p[1] * s, p[2] * s)


def _dot(p: Vec, q: Vec) -> float:
    return p[0] * q[0] + p[1] * q[1] + p[2] * q[2]


def _cross(p: Vec, q: Vec) -> Vec:
    return (p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0])


def _norm(p: Vec) -> float:
    return math.sqrt(_dot(p, p))


#: The eye at the hole, looking along +z; x to the right, y up.
EYE: Vec = (0.0, 0.0, 0.0)


def chair(depth_m: float = 0.40, floor_m: float = -0.16, size_m: float = 0.08, turn_deg: float = 30.0) -> Figure:
    """A small chair on the box's floor, ``depth_m`` in front of the eye and
    turned ``turn_deg`` about its own vertical axis: four legs, a seat, two back
    posts and two rails — twelve rods. The floor is low enough that the eye
    looks down onto the seat and the back's top is at eye level, and the turn
    shows a side as well as the front: seen square-on and edge-on, a chair is a
    few rectangles, and the illusion needs the picture to read as a chair."""
    s = size_m
    x0, x1 = -s / 2, s / 2
    z0, z1 = -s / 2, s / 2  # front, back, about the chair's own centre
    seat = floor_m + s
    top = seat + s
    rail = seat + s / 2
    turn = math.radians(turn_deg)
    c, n = math.cos(turn), math.sin(turn)

    def placed(x: float, y: float, z: float) -> Vec:
        return (x * c + z * n, y, depth_m - x * n + z * c)

    def rod(a: tuple[float, float, float], b: tuple[float, float, float]) -> Segment:
        return Segment(placed(*a), placed(*b))

    legs = [rod((x, floor_m, z), (x, seat, z)) for x in (x0, x1) for z in (z0, z1)]
    seat_edges = [
        rod((x0, seat, z0), (x1, seat, z0)),
        rod((x1, seat, z0), (x1, seat, z1)),
        rod((x1, seat, z1), (x0, seat, z1)),
        rod((x0, seat, z1), (x0, seat, z0)),
    ]
    back = [
        rod((x0, seat, z1), (x0, top, z1)),
        rod((x1, seat, z1), (x1, top, z1)),
        rod((x0, top, z1), (x1, top, z1)),
        rod((x0, rail, z1), (x1, rail, z1)),
    ]
    return Figure(FigureKind.CHAIR, tuple(legs + seat_edges + back))


def slide(eye: Vec, point: Vec, factor: float) -> Vec:
    """``E + λ·(P − E)``: the point moved along its line of sight."""
    if factor <= 0:
        raise ValueError("a point can only slide along its line of sight, away from or towards the eye")
    return _add(eye, _scale(_sub(point, eye), factor))


#: The default skew, per metre: it pulls the right and the top nearer and
#: pushes the back away, every point by a factor between 1.1 and 1.7, so the
#: skewed chair stays inside a box less than 0.8 m deep.
SKEW: Vec = (1.2, 0.6, -0.5)


def skew_point(eye: Vec, point: Vec, w: Vec = SKEW) -> Vec:
    d = _sub(point, eye)
    denominator = 1 + _dot(w, d)
    if denominator <= 0:
        raise ValueError("the skew would send a point through or behind the eye")
    return _add(eye, _scale(d, 1 / denominator))


def skew(figure: Figure, eye: Vec = EYE, w: Vec = SKEW) -> Figure:
    """The skewed chair: one projective map that keeps every line through the eye."""
    return Figure(
        FigureKind.SKEWED,
        tuple(Segment(skew_point(eye, s.a, w), skew_point(eye, s.b, w)) for s in figure.segments),
    )


#: One factor per rod, fixed so the exhibit is the same every time; between
#: 0.7 and 1.6, so no rod comes nearer than the hole or leaves the box.
SCATTER = (1.00, 1.42, 0.78, 1.25, 0.86, 1.55, 0.72, 1.18, 1.36, 0.92, 1.60, 0.81)


def scatter(figure: Figure, eye: Vec = EYE, factors: tuple[float, ...] = SCATTER) -> Figure:
    """Each rod slid along the lines of sight by its own factor."""
    if len(factors) < len(figure.segments):
        raise ValueError("every rod needs a factor")
    return Figure(
        FigureKind.SCATTERED,
        tuple(Segment(slide(eye, s.a, f), slide(eye, s.b, f)) for s, f in zip(figure.segments, factors, strict=False)),
    )


def exhibit(eye: Vec = EYE) -> tuple[Figure, Figure, Figure]:
    """The three boxes: the chair, the skewed chair, the scattered rods."""
    base = chair()
    return base, skew(base, eye), scatter(base, eye)


def image(eye: Vec, point: Vec) -> tuple[float, float]:
    """Where ``point`` lands on a screen one metre in front of the eye: the
    pinhole's ``(x/z, y/z)``, the eye looking along +z."""
    d = _sub(point, eye)
    if d[2] <= 0:
        raise ValueError("the point is not in front of the eye")
    return d[0] / d[2], d[1] / d[2]


def angle_between(eye: Vec, p: Vec, q: Vec) -> float:
    """The angle at the eye between two points, in radians — by ``atan2`` of
    the cross and dot products, which stays exact for the tiny angles here."""
    a, b = _sub(p, eye), _sub(q, eye)
    return math.atan2(_norm(_cross(a, b)), _dot(a, b))


@dataclass(frozen=True)
class Joint:
    """Two rod ends that meet in the chair: (rod, end) and (rod, end), end 0 or 1."""

    first: tuple[int, int]
    second: tuple[int, int]


def _end(segment: Segment, end: int) -> Vec:
    return segment.a if end == 0 else segment.b


def joints(figure: Figure, tolerance_m: float = 1e-9) -> tuple[Joint, ...]:
    """Every pair of rod ends that coincide in ``figure`` (the real chair)."""
    found = []
    ends = [(i, e) for i in range(len(figure.segments)) for e in (0, 1)]
    for n, (i, e) in enumerate(ends):
        for j, f in ends[n + 1 :]:
            if i != j and _norm(_sub(_end(figure.segments[i], e), _end(figure.segments[j], f))) < tolerance_m:
                found.append(Joint((i, e), (j, f)))
    return tuple(found)


def joint_gap(figure: Figure, joint: Joint, eye: Vec) -> float:
    """How far apart, in radians, a joint's two ends look from ``eye``."""
    return angle_between(
        eye,
        _end(figure.segments[joint.first[0]], joint.first[1]),
        _end(figure.segments[joint.second[0]], joint.second[1]),
    )


def widest_gap(figure: Figure, chair_joints: tuple[Joint, ...], eye: Vec) -> float:
    return max(joint_gap(figure, j, eye) for j in chair_joints)


def tolerance(figure: Figure, chair_joints: tuple[Joint, ...], eye: Vec = EYE, acuity_rad: float = ACUITY_RAD) -> float:
    """How far the eye can move from the hole, sideways or up and down, before
    the widest joint opens to ``acuity_rad``: the smaller of the two, by
    bisection over the offset."""
    best = math.inf
    for direction in ((1.0, 0.0, 0.0), (0.0, 1.0, 0.0)):
        lo, hi = 0.0, 0.1
        if widest_gap(figure, chair_joints, _add(eye, _scale(direction, hi))) < acuity_rad:
            continue
        for _ in range(100):
            mid = (lo + hi) / 2
            if widest_gap(figure, chair_joints, _add(eye, _scale(direction, mid))) < acuity_rad:
                lo = mid
            else:
                hi = mid
        best = min(best, (lo + hi) / 2)
    return best


def binocular_gap(figure: Figure, chair_joints: tuple[Joint, ...], eye: Vec = EYE) -> float:
    """The widest joint as the other eye sees it, one baseline to the side."""
    return widest_gap(figure, chair_joints, _add(eye, (EYE_BASELINE_M, 0.0, 0.0)))


# ── the box seen from outside ────────────────────────────────────────────────


@dataclass(frozen=True)
class Box:
    """One box round one object, the hole in the middle of its front wall at
    the eye. The object stands on the floor (its lowest point is the floor);
    the walls and the lid leave a margin."""

    left_m: float
    right_m: float
    floor_m: float
    ceiling_m: float
    depth_m: float


#: The room the box leaves round its object, on every side but the floor.
BOX_MARGIN_M = 0.03


def box(figure: Figure) -> Box:
    points = [p for s in figure.segments for p in (s.a, s.b)]
    return Box(
        left_m=min(p[0] for p in points) - BOX_MARGIN_M,
        right_m=max(p[0] for p in points) + BOX_MARGIN_M,
        floor_m=min(p[1] for p in points),
        ceiling_m=max(p[1] for p in points) + BOX_MARGIN_M,
        depth_m=max(p[2] for p in points) + BOX_MARGIN_M,
    )


def sight_lines(figure: Figure, inside: Box, eye: Vec = EYE) -> tuple[Segment, ...]:
    """From the hole through each corner of ``figure`` to the box's back wall:
    the lines every object in the three boxes shares — what the side view draws
    so the reader sees that a scattered rod's end lies on the same line as the
    real chair's corner, only further along it."""
    corners: list[Vec] = []
    for s in figure.segments:
        for p in (s.a, s.b):
            if all(_norm(_sub(p, q)) > 1e-9 for q in corners):
                corners.append(p)
    lines = []
    for p in corners:
        d = _sub(p, eye)
        lines.append(Segment(eye, _add(eye, _scale(d, (inside.depth_m - eye[2]) / d[2]))))
    return tuple(lines)


@dataclass(frozen=True)
class Peephole:
    """One of the three boxes: what is in it, the box, and the lines of sight
    from its hole through the chair's corners to its back wall — the same
    directions in all three, since the three are one picture."""

    figure: Figure
    box: Box
    sight_lines: tuple[Segment, ...]


@dataclass(frozen=True)
class ChairAnalysis:
    boxes: tuple[Peephole, Peephole, Peephole]
    joint_count: int
    #: How far the eye may move before a scattered joint opens to the acuity.
    tolerance_m: float
    #: The widest scattered joint as the second eye sees it.
    binocular_gap_rad: float
    acuity_rad: float
    eye_baseline_m: float


def analysis(eye: Vec = EYE) -> ChairAnalysis:
    figures = exhibit(eye)
    real, _, scattered = figures
    chair_joints = joints(real)
    boxes = tuple(Peephole(f, box(f), sight_lines(real, box(f), eye)) for f in figures)
    return ChairAnalysis(
        boxes=(boxes[0], boxes[1], boxes[2]),
        joint_count=len(chair_joints),
        tolerance_m=tolerance(scattered, chair_joints, eye),
        binocular_gap_rad=binocular_gap(scattered, chair_joints, eye),
        acuity_rad=ACUITY_RAD,
        eye_baseline_m=EYE_BASELINE_M,
    )
