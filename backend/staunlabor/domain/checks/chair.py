"""The chair, checked: the three figures against central projection, the skew
against the straightness projective maps keep, and the eye's freedom against
motion parallax and binocular disparity.
"""

from __future__ import annotations

import math

from staunlabor.domain.checks import Case, Source
from staunlabor.domain.experiments import perspective as engine

_PROJECTION = Source(
    cite="R. Hartley, A. Zisserman, Multiple View Geometry in Computer Vision, Ch. 1, §1.2 (free sample chapter)",
    url="https://www.robots.ox.ac.uk/~vgg/hzbook/hzbook2/HZintroduction.pdf",
    quote="all points in a ray passing through the centre of projection projecting to the same point in an image",
)
_AMES = Source(
    cite="W. H. Ittelson, The Ames Demonstrations in Perception (Princeton UP, 1952), Ch. 8 “The Chair Demonstration”",
    url="https://archive.org/details/amesdemonstratio00itte",
    quote="three groups of strings in different arrangements and at different distances … they all produce the same image on the retina when viewed from the peepholes",
)
_STRAIGHT = Source(
    cite="R. Hartley, A. Zisserman, Multiple View Geometry in Computer Vision, Ch. 1, §1.1",
    url="https://www.robots.ox.ac.uk/~vgg/hzbook/hzbook2/HZintroduction.pdf",
    quote="we may define a projective transformation of a plane as any mapping of the points on the plane that preserves straight lines",
)
_PARALLAX = Source(
    cite="J. J. Koenderink, “Optic flow”, Vision Research 26 (1986) 161, p. 164",
    url="https://doi.org/10.1016/0042-6989(86)90078-7",
    quote="introduce the distance to the patch (d) and define … the ‘specific transverse velocity’ A_t = V_t/d",
)
_ACUITY = Source(
    cite="M. Kalloniatis, C. Luu, Webvision, “Visual Acuity”, §2, Fig. 5",
    url="https://www.webvision.pitt.edu/book/part-viii-psychophysics-of-vision/visual-acuity/",
    quote="the minimum angle of resolution (MAR) is one minute of arc and the logMAR is 0",
)
_DISPARITY = Source(
    cite="K. Stroyan, “Motion parallax is asymptotic to binocular disparity”, arXiv:1010.0575, Eq. (17), after Cormack & Fox (1985)",
    url="https://arxiv.org/abs/1010.0575",
    quote="B.D. ~ i d/(f(f+d))",
)
_IPD = Source(
    cite="N. A. Dodgson, “Variation and extrema of human interpupillary distance”, Proc. SPIE 5291 (2004) 36, abstract",
    url="https://doi.org/10.1117/12.529999",
    quote="mean adult IPD is around 63 mm, the vast majority of adults have IPDs in the range 50-75 mm",
)

Vec = tuple[float, float, float]


def _sub(p: Vec, q: Vec) -> Vec:
    return (p[0] - q[0], p[1] - q[1], p[2] - q[2])


def _cross(p: Vec, q: Vec) -> Vec:
    return (p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0])


def _norm(p: Vec) -> float:
    return math.sqrt(p[0] ** 2 + p[1] ** 2 + p[2] ** 2)


def _pinhole(eye: Vec, p: Vec) -> tuple[float, float]:
    """(f·X/Z, f·Y/Z) on a screen a metre away, worked out here."""
    d = _sub(p, eye)
    return d[0] / d[2], d[1] / d[2]


def _image_mismatch() -> float:
    """The largest distance, on that screen, between a corner of the chair and
    the same corner of the skewed chair or the scattered rods."""
    eye = engine.EYE
    real, skewed, scattered = engine.exhibit(eye)
    worst = 0.0
    for figure in (skewed, scattered):
        for s0, s1 in zip(real.segments, figure.segments, strict=True):
            for p, q in ((s0.a, s1.a), (s0.b, s1.b)):
                a, b = _pinhole(eye, p), _pinhole(eye, q)
                worst = max(worst, math.hypot(a[0] - b[0], a[1] - b[1]))
    return worst


def _bend() -> float:
    """How far a point a quarter, a half and three quarters along a rod of the
    chair lands, skewed, off the straight line between its skewed ends."""
    eye = engine.EYE
    real, skewed, _ = engine.exhibit(eye)
    worst = 0.0
    for s0, s1 in zip(real.segments, skewed.segments, strict=True):
        line = _sub(s1.b, s1.a)
        for f in (0.25, 0.5, 0.75):
            point = engine.skew_point(eye, tuple(a + f * (b - a) for a, b in zip(s0.a, s0.b, strict=True)))
            worst = max(worst, _norm(_cross(_sub(point, s1.a), line)) / _norm(line))
    return worst


def _joint_rates(sideways: Vec) -> list[float]:
    """For every joint of the scattered rods, how fast its two ends part as the
    eye moves along ``sideways``: sin φ·|1/d₁ − 1/d₂| radians per metre."""
    eye = engine.EYE
    real, _, scattered = engine.exhibit(eye)
    rates = []
    for joint in engine.joints(real):
        a = scattered.segments[joint.first[0]]
        b = scattered.segments[joint.second[0]]
        p = a.a if joint.first[1] == 0 else a.b
        q = b.a if joint.second[1] == 0 else b.b
        d1, d2 = _norm(_sub(p, eye)), _norm(_sub(q, eye))
        sight = tuple(x / d1 for x in _sub(p, eye))
        rates.append(_norm(_cross(sideways, sight)) * abs(1 / d1 - 1 / d2))
    return rates


def _freedom_mm() -> float:
    """How far the eye may move, sideways or up, before the fastest-parting
    joint opens to one minute of arc, by the small-angle parallax."""
    acuity = math.radians(1 / 60)
    fastest = max(max(_joint_rates((1.0, 0.0, 0.0))), max(_joint_rates((0.0, 1.0, 0.0))))
    return acuity / fastest * 1000


def _engine_freedom_mm() -> float:
    real, _, scattered = engine.exhibit(engine.EYE)
    return engine.tolerance(scattered, engine.joints(real)) * 1000


def _second_eye_deg() -> float:
    return math.degrees(0.065 * max(_joint_rates((1.0, 0.0, 0.0))))


def _engine_second_eye_deg() -> float:
    real, _, scattered = engine.exhibit(engine.EYE)
    return math.degrees(engine.binocular_gap(scattered, engine.joints(real)))


CASES: tuple[Case, ...] = (
    Case(
        key="one_picture",
        unit="",
        expected=lambda: 0.0,
        measured=_image_mismatch,
        tolerance=1e-12,
        sources=(_PROJECTION, _AMES),
        setting={"yaw_deg": 0.0, "pitch_deg": 0.0, "eye_mm": 0.0},
    ),
    Case(
        key="straight_rods",
        unit="m",
        expected=lambda: 0.0,
        measured=_bend,
        tolerance=1e-12,
        sources=(_STRAIGHT,),
        setting={"yaw_deg": 60.0, "pitch_deg": 20.0, "eye_mm": 0.0},
    ),
    Case(
        key="parallax",
        unit="mm",
        expected=_freedom_mm,
        measured=_engine_freedom_mm,
        # The bisection is exact; the hand's small-angle rule is not, by a
        # part in ten thousand over 0.16 mm.
        tolerance=1e-3,
        sources=(_PARALLAX, _ACUITY),
        derived=True,
        setting={"yaw_deg": 0.0, "pitch_deg": 0.0, "eye_mm": 0.16},
    ),
    Case(
        key="second_eye",
        unit="°",
        expected=_second_eye_deg,
        measured=_engine_second_eye_deg,
        # 65 mm is no small step for rods half a metre away: the small-angle
        # rule overshoots the exact angle by 1.7 %.
        tolerance=2e-2,
        sources=(_DISPARITY, _IPD),
        derived=True,
        setting={"yaw_deg": 0.0, "pitch_deg": 0.0, "eye_mm": 65.0},
    ),
)
