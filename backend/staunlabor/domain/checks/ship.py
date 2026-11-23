"""The ship that rights itself, checked: the box's metacentric height against
``GM = KB + BM − KG`` with ``BM = I/V``, the righting arm at 15° against the
wall-sided (Scribanti) formula, the hull lying on its side against where its
centre of buoyancy must be, and the small roll's period against the roll
period's formula, read off the time loop at the page's step.
"""

from __future__ import annotations

import itertools
import math

from staunlabor.domain.checks import Case, Source
from staunlabor.domain.checks._hand import G
from staunlabor.domain.experiments import ship as engine

#: Fresh water at 20 °C, as the engine takes it.
RHO = 998.0

_TECHET = Source(
    cite="A. H. Techet, 13.012 Hydrodynamics for Ocean Engineers, Reading #3, “Archimedes’s Principle and Static "
    "Stability” (MIT, 2003), p. 7",
    url="https://web.mit.edu/13.012/www/handouts/2003/Reading3.pdf",
    quote="2) Find BM , the metacentric radius, using the transverse moment of inertia of the ships water plane "
    "about its own centerline and the vessel’s displaced volume: BM = I / Volume … 4) Calculate GM : KM = KB + BM "
    "GM = KM − KG",
)
_DELFT = Source(
    cite="P. de Jong, Offshore Hydromechanics, Module 1, “2. Hydrostatics and Stability part 2” (TU Delft "
    "OpenCourseWare), slides 6, 11 and 15",
    url="https://ocw.tudelft.nl/wp-content/uploads/2.OffshoreHydromech1_FloatingStability.pdf",
    quote="For small heeling angles (<5 to 10 degrees): Initial stability GM = KB + BM − KG = KB + It/∇ − KG … "
    "It = LB³/12",
)
_SCRIBANTI = Source(
    cite="P. de Jong, Offshore Hydromechanics, Module 1, “2. Hydrostatics and Stability part 2” (TU Delft "
    "OpenCourseWare), slides 6 and 11",
    url="https://ocw.tudelft.nl/wp-content/uploads/2.OffshoreHydromech1_FloatingStability.pdf",
    quote="GZφ = GNφ sinφ … For slightly larger heeling angles (5 to 15 degrees): Scribanti GM = KB + BNφ − KG = "
    "KB + It/∇ (1 + ½ tan² φ) − KG",
)
_BUOYANCY = Source(
    cite="A. H. Techet, 13.012 Hydrodynamics for Ocean Engineers, Reading #3, “Archimedes’s Principle and Static "
    "Stability” (MIT, 2003), p. 3",
    url="https://web.mit.edu/13.012/www/handouts/2003/Reading3.pdf",
    quote="Center of buoyancy is the point at which the buoyancy force acts on the body and is equivalently the "
    "geometric center of the submerged portion of the hull.",
)
_ARM = Source(
    cite="Wikipedia, “Metacentric height”, Righting arm",
    url="https://en.wikipedia.org/wiki/Metacentric_height",
    quote="The righting arm (known also as GZ — see diagram): the horizontal distance between the lines of buoyancy "
    "and gravity (Z = intersection point: the shortest distance to the centre of gravity G).",
)
_PERIOD = Source(
    cite="Wikipedia, “Metacentric height”, GM and rolling period",
    url="https://en.wikipedia.org/wiki/Metacentric_height",
    quote="The period of roll can be estimated from the following equation: T = 2π √((a44² + k²)/(g GM)) where g is "
    "the gravitational acceleration, a44 is the added radius of gyration and k is the radius of gyration about the "
    "longitudinal axis through the centre of gravity and GM is the stability index.",
)

#: The page's hull: a box 20 cm wide, 12 cm deep, 50 cm long, 2 kg, its own
#: centre 5 cm up, its radius of gyration 7 cm; the 1 kg weight on the deck.
_HULL = engine.Hull()
_DECK = engine.Weight()
#: The weight at the foot of the keel, 15 cm under the hull.
_KEEL = engine.Weight(height_m=-0.15)


def _draft_m(hull: engine.Hull, weight: engine.Weight) -> float:
    """Archimedes for a box: ρ·L·b·d = m."""
    return (hull.mass_kg + weight.mass_kg) / (RHO * hull.length_m * hull.beam_m)


def _kg_m(hull: engine.Hull, weight: engine.Weight) -> float:
    """The centre of gravity of hull and weight, above the bottom."""
    return (hull.mass_kg * hull.centre_m + weight.mass_kg * weight.height_m) / (hull.mass_kg + weight.mass_kg)


def _gm_hand_m(hull: engine.Hull, weight: engine.Weight) -> float:
    """KB = d/2 (the rectangle under water), BM = I_t/∇ = (L·b³/12)/(L·b·d)."""
    d = _draft_m(hull, weight)
    i_t = hull.length_m * hull.beam_m**3 / 12
    volume = hull.length_m * hull.beam_m * d
    return d / 2 + i_t / volume - _kg_m(hull, weight)


def _gm_curve_m() -> float:
    """The stability curve the time loop steps on, at a hundredth of a degree,
    over the sine: ``GZ/sin φ``."""
    phi = math.radians(0.01)
    return engine.righting_arm_m(_HULL, _DECK, phi) / math.sin(phi)


#: The heel of the wall-sided case, below where the bilge comes out (16.7°).
_WALL_DEG = 15.0


def _wall_hand_m(hull: engine.Hull, weight: engine.Weight, phi_deg: float) -> float:
    """GZ = GN_φ·sin φ with GN_φ = KB + (I_t/∇)(1 + ½tan²φ) − KG."""
    d = _draft_m(hull, weight)
    bm = (hull.length_m * hull.beam_m**3 / 12) / (hull.length_m * hull.beam_m * d)
    phi = math.radians(phi_deg)
    return math.sin(phi) * (d / 2 + bm * (1 + math.tan(phi) ** 2 / 2) - _kg_m(hull, weight))


def _side_hand_m(hull: engine.Hull, weight: engine.Weight) -> float:
    """Lying on its side the box's part under water is a rectangle along the
    whole of its depth, so B lies half way up the hull, H/2 above K, and the
    arm, horizontal now, runs along the hull: H/2 − KG."""
    return hull.depth_m / 2 - _kg_m(hull, weight)


def _period_hand_s(hull: engine.Hull, weight: engine.Weight) -> float:
    """T = 2π·√(k²/(g·GM)) with a₄₄ = 0, k² = I/m, I about G by Steiner: the
    hull's own m_h·k_h² moved from its centre, and the weight as a point."""
    m = hull.mass_kg + weight.mass_kg
    kg = _kg_m(hull, weight)
    inertia = (
        hull.mass_kg * hull.gyration_m**2
        + hull.mass_kg * (hull.centre_m - kg) ** 2
        + weight.mass_kg * (weight.height_m - kg) ** 2
    )
    return 2 * math.pi * math.sqrt(inertia / m / (G * _gm_hand_m(hull, weight)))


#: The roll case: let go at rest half a degree over, undamped, three swings.
_ROLL_DEG = 0.5
_ROLL_STEPS = 900


def _period_run_s() -> float:
    """The time loop's mean period between its first and last downward
    crossings of upright, each placed within its step by a straight line."""
    states = engine.run(_HULL, _DECK, 0.0, _ROLL_DEG, _ROLL_STEPS)
    crossings = [
        (i + a / (a - b)) * engine.STEP_S for i, ((a, _), (b, _)) in enumerate(itertools.pairwise(states)) if a > 0 >= b
    ]
    return (crossings[-1] - crossings[0]) / (len(crossings) - 1)


def _setting(weight: engine.Weight, heel_deg: float, damping: float = engine.DAMPING_PER_S) -> dict[str, float]:
    """What the page's "Set it up" sets: the page's hull and weight, the
    weight's height, the water's damping, and the heel the hand lets go at."""
    return {
        "beam_m": _HULL.beam_m,
        "weight_kg": weight.mass_kg,
        "weight_m": weight.height_m,
        "damping_per_s": damping,
        "heel_deg": heel_deg,
    }


CASES: tuple[Case, ...] = (
    Case(
        key="metacentric_height",
        unit="m",
        expected=lambda: _gm_hand_m(_HULL, _DECK),
        measured=_gm_curve_m,
        # GZ/sin φ = GM + ½·BM·tan²φ for the box: at 0.01°, 3·10⁻⁸ over GM.
        tolerance=1e-7,
        sources=(_TECHET, _DELFT),
        derived=True,
        setting=_setting(_DECK, 2.0),
    ),
    Case(
        key="wall_sided",
        unit="m",
        expected=lambda: _wall_hand_m(_HULL, _DECK, _WALL_DEG),
        measured=lambda: engine.righting_arm_m(_HULL, _DECK, math.radians(_WALL_DEG)),
        # Exact for a box while its sides stand in the water: the rounding only.
        tolerance=1e-12,
        sources=(_SCRIBANTI,),
        derived=True,
        setting=_setting(_DECK, _WALL_DEG),
    ),
    Case(
        key="on_its_side",
        unit="m",
        expected=lambda: _side_hand_m(_HULL, _KEEL),
        measured=lambda: engine.righting_arm_m(_HULL, _KEEL, math.pi / 2),
        # cos(π/2) is 6·10⁻¹⁷ in floating point, not zero: the rounding only.
        tolerance=1e-12,
        sources=(_BUOYANCY, _ARM),
        derived=True,
        setting=_setting(_KEEL, 90.0),
    ),
    Case(
        key="roll_period",
        unit="s",
        expected=lambda: _period_hand_s(_HULL, _DECK),
        measured=_period_run_s,
        # Half a degree over, the curve's ½·BM·tan²φ shortens the period by
        # 2.5·10⁻⁵; the crossings' straight lines and RK4 at 2 ms add less.
        tolerance=1e-4,
        sources=(_PERIOD,),
        derived=True,
        setting=_setting(_DECK, _ROLL_DEG, 0.0),
    ),
)
