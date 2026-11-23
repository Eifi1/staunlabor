"""The chain and the arch, checked: the thinnest semicircle that stands against
Milankovitch's, the upside-down chain's push at the foot against the catenary's
tension, and the stones' weight against their geometry.

The page draws the browser port (``simulate/arch.ts``), held to this engine by
``engine-cases.json``, the bisection and the golden section included. What is
measured here is the engine the port copies: :func:`thrust`, which the page
calls for its line, "stands" and its figures, and :func:`blocks`, whose weights
the page adds up.
"""

from __future__ import annotations

import math

from staunlabor.domain.checks import Case, Source
from staunlabor.domain.checks._hand import G, bisect
from staunlabor.domain.experiments import arch as engine

_MILANKOVITCH = Source(
    cite="G. Kampas, N. Kalapodis, T. McLean, C. Málaga-Chuquitaype, “Limit-state analysis of parabolic arches subjected to inertial loading in different gravitational fields using a variational formulation”, Engineering Structures, corrected proof, 111501, doi:10.1016/j.engstruct.2020.111501, §2, p. 2 (open-access copy, University of Greenwich)",
    url="https://gala.gre.ac.uk/id/eprint/30314/3/30314%20KAMPAS_Limit-state_Analysis_of_Parabolic_Arches_%28OA%29_2020.pdf",
    quote="Makris and Alexakis [27] confirmed Milankowitch’s [30] results about the dimensionless minimum thickness of semicircular arches which is t/R = 0.1075 (t: thickness, R: radius) using radial ruptures",
)
_HOOKE = Source(
    cite="Wikipedia, “Catenary”, §“History” (Hooke’s anagram, published 1705)",
    url="https://en.wikipedia.org/wiki/Catenary",
    quote="ut pendet continuum flexile, sic stabit contiguum rigidum inversum, meaning “As hangs a flexible cable so, inverted, stand the touching pieces of an arch.”",
)
_TENSION = Source(
    cite="Wikipedia, “Catenary”, §“Analysis”: “Model of chains and arches” and “Derivation of equations for the curve”",
    url="https://en.wikipedia.org/wiki/Catenary",
    quote="It is convenient to write a = T₀/w which is the length of chain whose weight is equal in magnitude to the tension at c. … The horizontal component of the tension, T cos φ = T₀ is constant and the vertical component of the tension, T sin φ = ws is proportional to the length of chain between r and the vertex. … y = a sec φ = a cosh(x/a), and s = a tan φ = a sinh(x/a).",
)
_TRIANGLE = Source(
    cite="OpenStax, Algebra and Trigonometry 2e, §10.1 Non-right Triangles: Law of Sines, “Area of an Oblique Triangle”",
    url="https://openstax.org/books/algebra-and-trigonometry-2e/pages/10-1-non-right-triangles-law-of-sines",
    quote="The formula for the area of an oblique triangle is given by Area = ½bc sin α = ½ac sin β = ½ab sin γ This is equivalent to one-half of the product of two sides and the sine of their included angle.",
)

#: The most stones the page's slider offers: nearest to joints everywhere.
_FINE = 40
#: The catenary arch as thin and as finely cut as the page's sliders go.
_THIN_CHAIN = engine.Arch(shape="catenary", thickness_m=0.02, blocks=_FINE)
#: The page's own semicircle: 2 m span, 25 cm thick, 16 stones.
_SEMICIRCLE = engine.Arch()


def _least_thickness_ratio() -> float:
    """t/R of the thinnest semicircle of 40 stones whose best thrust line still
    keeps inside every stone (λ ≤ 1 in :func:`thrust`), by bisection on the
    thickness."""
    radius = _SEMICIRCLE.span_m / 2
    lo, hi = 0.05 * radius, 0.2 * radius
    for _ in range(40):
        mid = (lo + hi) / 2
        try:
            stands = engine.thrust(engine.Arch(thickness_m=mid, blocks=_FINE)).stands
        except ValueError:
            # No line keeps every joint pressed: far from standing.
            stands = False
        if stands:
            hi = mid
        else:
            lo = mid
    return hi / radius


def _chain_parameter(half_span: float, rise: float) -> float:
    """a of the chain through the springings that rises ``rise`` at the crown:
    a·(cosh(c/a) − 1) = h, the left side falling in a, halved until it holds."""
    return bisect(lambda a: a * (math.cosh(half_span / a) - 1) > rise, 0.01 * half_span, 100 * half_span, 200)


def _chain_push_share() -> float:
    """The chain upside down: its horizontal tension T₀ = w·a becomes the
    arch's push at the foot, and each foot carries the weight of half the
    chain, w·a·sinh(c/a). As a share of the whole weight: 1/(2·sinh(c/a))."""
    c = _THIN_CHAIN.span_m / 2
    a = _chain_parameter(c, c)
    return 1 / (2 * math.sinh(c / a))


def _arch_push_share() -> float:
    """The page's figure "push at the foot": H over the arch's weight."""
    line = engine.thrust(_THIN_CHAIN)
    return line.h_n / line.weight_n


def _weight_hand_kg() -> float:
    """Each stone of a semicircle is cut along two radii π/N apart: the
    triangle to its extrados less the one to its intrados, ½(R₊² − R₋²)·sin(π/N)
    = R·t·sin(π/N) per metre of depth."""
    arch = _SEMICIRCLE
    r, t, n = arch.span_m / 2, arch.thickness_m, arch.blocks
    outer, inner = r + t / 2, r - t / 2
    area = n * 0.5 * (outer**2 - inner**2) * math.sin(math.pi / n)
    return area * arch.depth_m * arch.density_kg_m3


def _weight_page_kg() -> float:
    """The page's figure "weight": its stones' weights added up, over g."""
    return sum(b.weight_n for b in engine.blocks(_SEMICIRCLE)) / G


def _setting(arch: engine.Arch, chain: bool = False) -> dict[str, float | str]:
    """What the page's "Set it up" sets: the shape, the thickness and the
    stones, no load, and the chain shown or not."""
    return {
        "shape": arch.shape,
        "thickness_m": arch.thickness_m,
        "blocks": float(arch.blocks),
        "share": 0.0,
        "chain": "on" if chain else "off",
    }


CASES: tuple[Case, ...] = (
    Case(
        key="milankovitch",
        unit="",
        expected=lambda: 0.1075,
        measured=_least_thickness_ratio,
        # Milankovitch's 0.1075 is rounded to four places (5 · 10⁻⁴) and is
        # for joints everywhere; 40 stones stand a little thinner, 6 · 10⁻⁴.
        tolerance=1e-3,
        sources=(_MILANKOVITCH,),
        setting=_setting(engine.Arch(thickness_m=0.1075, blocks=_FINE)),
    ),
    Case(
        key="chain_push",
        unit="",
        expected=_chain_push_share,
        measured=_arch_push_share,
        # Forty straight stones 2 cm thick are no chain: the line through
        # their centroids is a polygon about the catenary, 1.3 · 10⁻⁴ off.
        tolerance=3e-4,
        sources=(_HOOKE, _TENSION),
        derived=True,
        setting=_setting(_THIN_CHAIN, chain=True),
    ),
    Case(
        key="weight",
        unit="kg",
        expected=_weight_hand_kg,
        measured=_weight_page_kg,
        tolerance=1e-12,
        sources=(_TRIANGLE,),
        derived=True,
        setting=_setting(_SEMICIRCLE),
    ),
)
