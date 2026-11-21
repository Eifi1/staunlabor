"""The smoke ring, checked: the air a press pushes out against a stretched skin's
shape and the continuity of the flow, and the ring's speed against Kelvin's.

The page's figures (the air out per hand speed, the slug in hole diameters, the
window) are the route's, from :func:`figures`; the ring a press makes is the
browser port's (``simulate/smoke.ts``, held to this engine by
``engine-cases.json``) from the press as the page samples it. What is measured
here is the engine: the effective area :func:`figures` divides by the hole, and
the ring :func:`ring_from_push` makes from a full press of half a second.
"""

from __future__ import annotations

import math

from staunlabor.domain.checks import Case, Source
from staunlabor.domain.experiments import smoke as engine

ENGINE = ("smoke",)

_MEMBRANE = Source(
    cite="Wikipedia, “Vibrations of a circular membrane”, §“The axisymmetric case”",
    url="https://en.wikipedia.org/wiki/Vibrations_of_a_circular_membrane",
    quote="Then, the function u does not depend on the angle θ, and the wave equation simplifies to ∂²u/∂t² = c²(∂²u/∂r² + (1/r) ∂u/∂r).",
)
_CONTINUITY = Source(
    cite="OpenStax, University Physics Volume 1, §14.5 Fluid Dynamics, Eq. 14.14",
    url="https://openstax.org/books/university-physics-volume-1/pages/14-5-fluid-dynamics",
    quote="Q₁ = Q₂, A₁v₁ = A₂v₂. 14.14 This is called the equation of continuity and is valid for any incompressible fluid (with constant density).",
)
_RELATIVE = Source(
    cite="OpenStax, University Physics Volume 1, §4.5 Relative Motion in One and Two Dimensions, Eq. 4.35",
    url="https://openstax.org/books/university-physics-volume-1/pages/4-5-relative-motion-in-one-and-two-dimensions",
    quote="The velocity of a particle relative to S is equal to its velocity relative to S′ plus the velocity of S′ relative to S.",
)
_KELVIN = Source(
    cite="Wikipedia, “Vortex ring”, §“Thin-core vortex rings” (Kelvin, in Tait’s translation of Helmholtz)",
    url="https://en.wikipedia.org/wiki/Vortex_ring",
    quote="which finally results in the well-known expression found by Kelvin and published in the English translation by Tait of von Helmholtz's paper: U = Γ/(4πR) (ln(8R/a) − 1/4)",
)

#: The page's drum: 1.9 m across, a 30 cm hole in a 40 cm ring, pressed 8 cm.
_EXHIBIT = engine.SmokeExhibit()
_FULL = engine.Push(depth_m=_EXHIBIT.drum.stroke_m, duration_s=0.5)


def _area_hand() -> float:
    """The volume the drum loses per metre of press. The ring's annulus goes
    down by the whole press; the skin between the ring (radius a) and the rim
    (R) lies still in the shape the source's equation allows without its time
    term, w(r) = x·ln(R/r)/ln(R/a), added up ring by ring, 2πr·w(r)·dr, by
    Simpson's rule."""
    drum = _EXHIBIT.drum
    big, a, h = drum.diameter_m / 2, drum.ring_m / 2, drum.hole_m / 2
    n = 4000
    step = (big - a) / n
    total = 0.0
    for j in range(n + 1):
        r = a + j * step
        weight = 1 if j in (0, n) else 4 if j % 2 else 2
        total += weight * 2 * math.pi * r * math.log(big / r) / math.log(big / a)
    return math.pi * (a * a - h * h) + total * step / 3


def _hole_area() -> float:
    return math.pi * (_EXHIBIT.drum.hole_m / 2) ** 2


def _ratio_measured() -> float:
    """The page's figure "air out per hand speed", as :func:`figures` has it."""
    return engine.effective_area(_EXHIBIT.drum) / engine.hole_area(_EXHIBIT.drum)


def _slug_hand() -> float:
    """Continuity: the air leaves the hole at A_eff/A_hole times the hand's
    speed in the room; the hole itself goes down at the hand's speed, so
    relative to it the air leaves at that ratio plus one. Over the whole press
    the slug is (A_eff/A_hole + 1)·d long; in hole diameters."""
    drum = _EXHIBIT.drum
    return (_area_hand() / _hole_area() + 1) * _FULL.depth_m / drum.hole_m


def _ring() -> engine.Ring:
    return engine.ring_from_push(_EXHIBIT, _FULL)


def _kelvin_speed() -> float:
    """Kelvin's speed for the ring the full press makes: its circulation, its
    radius 0.6 hole diameters and its core 0.35 of that, as the page takes
    them."""
    ring = _ring()
    radius = 0.6 * _EXHIBIT.drum.hole_m
    core = 0.35 * radius
    return ring.circulation_m2_s / (4 * math.pi * radius) * (math.log(8 * radius / core) - 0.25)


def _setting() -> dict[str, float | str]:
    """What the page's "Set it up" sets: the page's drum, and a full press of
    half a second."""
    drum = _EXHIBIT.drum
    return {
        "diameter_m": drum.diameter_m,
        "hole_m": drum.hole_m,
        "ring_m": drum.ring_m,
        "stroke_m": drum.stroke_m,
        "duration": _FULL.duration_s,
        "depth": _FULL.depth_m,
    }


CASES: tuple[Case, ...] = (
    Case(
        key="membrane_area",
        unit="",
        expected=lambda: _area_hand() / _hole_area(),
        measured=_ratio_measured,
        # Simpson's rule over 4000 rings of a smooth logarithm: exact to rounding.
        tolerance=1e-10,
        sources=(_MEMBRANE,),
        derived=True,
        setting=_setting(),
    ),
    Case(
        key="slug_length",
        unit="",
        expected=_slug_hand,
        measured=lambda: _ring().stroke_ratio,
        # As above: the press is summed sample by sample, exactly.
        tolerance=1e-10,
        sources=(_CONTINUITY, _RELATIVE, _MEMBRANE),
        derived=True,
        setting=_setting(),
    ),
    Case(
        key="ring_speed",
        unit="m/s",
        expected=_kelvin_speed,
        measured=lambda: _ring().speed_m_s,
        tolerance=1e-12,
        sources=(_KELVIN,),
        setting=_setting(),
    ),
)
