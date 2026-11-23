"""The draining vessel, checked: the outflow against Torricelli's law with the
jet's contraction, the time to empty and the time to half the depth against
the closed form for a cylinder, and the farthest jet against the range a hole
throws to.

What is measured is what the page runs: the engine's outflow at the start, its
Runge–Kutta step at the page's 5 ms until the level reaches the hole (or half
the depth), and its jet's range scanned over the hole's height.
"""

from __future__ import annotations

import math

from staunlabor.domain.checks import Case, Source
from staunlabor.domain.checks._hand import G, bisect
from staunlabor.domain.experiments import vessel as engine

_TORRICELLI = Source(
    cite="Wikipedia, “Torricelli's law”, introduction",
    url="https://en.wikipedia.org/wiki/Torricelli%27s_law",
    quote="The law states that the speed v of efflux of a fluid through a sharp-edged hole in the wall of the tank "
    "filled to a height h above the hole is the same as the speed that a body would acquire in falling freely from "
    "a height h, v = √(2gh)",
)
_DISCHARGE = Source(
    cite="Wikipedia, “Torricelli's law”, §Discharge experiment, coefficient of discharge",
    url="https://en.wikipedia.org/wiki/Torricelli%27s_law#Discharge_experiment,_coefficient_of_discharge",
    quote="The problem remains how to determine the cross-section of the vena contracta. This is normally done by "
    "introducing a discharge coefficient which relates the discharge to the orifice's cross-section and "
    "Torricelli's law: V̇_real = μ A_A v_A with μ = A_C/A_A",
)
_CONTRACTION = Source(
    cite="Wikipedia, “Vena contracta”, §Coefficient of contraction",
    url="https://en.wikipedia.org/wiki/Vena_contracta#Coefficient_of_contraction",
    quote="The coefficient of contraction is defined as the ratio between the area of the jet at the vena contracta "
    "and the area of the orifice. … The typical value may be taken as 0.611 for a sharp orifice (concentric with "
    "the flow channel).",
)
_EMPTY = Source(
    cite="Wikipedia, “Torricelli's law”, §Discharge and time to empty a cylindrical vessel",
    url="https://en.wikipedia.org/wiki/Torricelli%27s_law#Discharge_and_time_to_empty_a_cylindrical_vessel",
    quote="The total time T taken to drain all the water and hence empty the vessel is found by setting h(T)=0 and "
    "re-arranging: T = (A/A_A) √(2H/g).",
)
_CURVE = Source(
    cite="Wikipedia, “Torricelli's law”, §Discharge and time to empty a cylindrical vessel",
    url="https://en.wikipedia.org/wiki/Torricelli%27s_law#Discharge_and_time_to_empty_a_cylindrical_vessel",
    quote="Lastly, we can rewrite the function h(t) as h(t) = H (1 − t/T)², where H is the height of the container "
    "while T is the discharge time as given above.",
)
_RANGE = Source(
    cite="Wikipedia, “Torricelli's law”, §Horizontal distance covered by the jet of liquid",
    url="https://en.wikipedia.org/wiki/Torricelli%27s_law#Horizontal_distance_covered_by_the_jet_of_liquid",
    quote="If h is height of the orifice above the ground and H is height of the liquid column from the ground "
    "(height of liquid's surface) … D = 2√(h(H − h)). … we obtain h* = H/2, and the maximum range D_max = H.",
)

#: The page's tube: 8 cm wide, filled to 90 cm, holes of 8 mm at 5, 35 and 65 cm,
#: μ = 0.61, on a stand of 20 cm.
_TUBE = engine.DrainingVessel()

#: Only the lowest hole open, as the page opens it for these cases.
_LOWEST = tuple(i == 0 for i in range(len(_TUBE.holes_m)))


def _area_m2(diameter_m: float) -> float:
    return math.pi * diameter_m * diameter_m / 4


def _head_m(vessel: engine.DrainingVessel) -> float:
    """The water's depth over the lowest hole when it is opened: the source's H."""
    return vessel.fill_m - vessel.holes_m[0]


def _flow_hand_l_min(vessel: engine.DrainingVessel) -> float:
    """V̇ = μ·A_A·√(2gH), in litres a minute."""
    return vessel.discharge * _area_m2(vessel.hole_diameter_m) * math.sqrt(2 * G * _head_m(vessel)) * 60000


def _flow_run_l_min(vessel: engine.DrainingVessel) -> float:
    return engine.outflow_l_min(vessel, vessel.fill_m, _LOWEST)


def _empty_hand_s(vessel: engine.DrainingVessel) -> float:
    """T = (A/(μ·A_A))·√(2H/g): the source's time, the hole's area narrowed to
    the jet's."""
    narrowed = vessel.discharge * _area_m2(vessel.hole_diameter_m)
    return _area_m2(vessel.diameter_m) / narrowed * math.sqrt(2 * _head_m(vessel) / G)


def _empty_run_s(vessel: engine.DrainingVessel) -> float:
    """The page's steps, counted until the level stands at the hole."""
    level, steps, floor = vessel.fill_m, 0, vessel.holes_m[0]
    while level > floor:
        level = engine.step(vessel, level, _LOWEST, engine.STEP_S)
        steps += 1
    return steps * engine.STEP_S


def _half_hand_s(vessel: engine.DrainingVessel) -> float:
    """h(t) = H·(1 − t/T)² is H/2 where 1 − t/T = 1/√2."""
    return (1 - 1 / math.sqrt(2)) * _empty_hand_s(vessel)


def _half_run_s(vessel: engine.DrainingVessel) -> float:
    """The page's steps until the depth over the hole falls past half, and the
    moment within the last step by bisecting its length."""
    floor = vessel.holes_m[0]
    half = floor + _head_m(vessel) / 2
    level, steps = vessel.fill_m, 0
    while True:
        after = engine.step(vessel, level, _LOWEST, engine.STEP_S)
        if after <= half:
            break
        level, steps = after, steps + 1
    start = level
    within = bisect(lambda dt: engine.step(vessel, start, _LOWEST, dt) > half, 0.0, engine.STEP_S, 60)
    return steps * engine.STEP_S + within


def _farthest_hand_m(vessel: engine.DrainingVessel) -> float:
    """D_max = H: the surface's height over the basin's floor."""
    return vessel.fill_m + vessel.stand_m


def _farthest_run_m(vessel: engine.DrainingVessel) -> float:
    """The page's jet from a hole at every height under the full tube: the
    farthest, by a golden-section search over the hole's height."""
    lo, hi = 0.0, vessel.fill_m
    g = (math.sqrt(5) - 1) / 2

    def reach(y: float) -> float:
        return engine.jet_range_m(vessel, vessel.fill_m, y)

    a, b = hi - g * (hi - lo), lo + g * (hi - lo)
    for _ in range(200):
        if reach(a) > reach(b):
            hi, b = b, a
            a = hi - g * (hi - lo)
        else:
            lo, a = a, b
            b = lo + g * (hi - lo)
    return reach((lo + hi) / 2)


def _setting(vessel: engine.DrainingVessel, opened: str) -> dict[str, float | str]:
    """What the page's "Set it up" sets: the build, which fills the tube, and
    which plugs it pulls (``lowest`` or ``all``)."""
    return {
        "diameter_m": vessel.diameter_m,
        "fill_m": vessel.fill_m,
        "hole_diameter_m": vessel.hole_diameter_m,
        "discharge": vessel.discharge,
        "stand_m": vessel.stand_m,
        "open": opened,
    }


CASES: tuple[Case, ...] = (
    Case(
        key="flow",
        unit="l/min",
        expected=lambda: _flow_hand_l_min(_TUBE),
        measured=lambda: _flow_run_l_min(_TUBE),
        tolerance=1e-12,
        sources=(_TORRICELLI, _DISCHARGE, _CONTRACTION),
        setting=_setting(_TUBE, "lowest"),
    ),
    Case(
        key="drain_time",
        unit="s",
        expected=lambda: _empty_hand_s(_TUBE),
        measured=lambda: _empty_run_s(_TUBE),
        # Counted in whole steps of 5 ms, in some 68 s.
        tolerance=1e-4,
        sources=(_EMPTY, _DISCHARGE),
        derived=True,
        setting=_setting(_TUBE, "lowest"),
    ),
    Case(
        key="half",
        unit="s",
        expected=lambda: _half_hand_s(_TUBE),
        measured=lambda: _half_run_s(_TUBE),
        tolerance=1e-9,
        sources=(_CURVE, _EMPTY, _DISCHARGE),
        derived=True,
        setting=_setting(_TUBE, "lowest"),
    ),
    Case(
        key="farthest",
        unit="m",
        expected=lambda: _farthest_hand_m(_TUBE),
        measured=lambda: _farthest_run_m(_TUBE),
        tolerance=1e-9,
        sources=(_RANGE, _TORRICELLI),
        setting=_setting(_TUBE, "all"),
    ),
)
