"""The Cartesian diver, checked: its spare buoyancy against Archimedes, the
squeezes that sink it from the top and lift it from the bottom against Boyle
and the water's weight, read off the time loop at the page's step, and how
fast it leaves the depth where it would hover.
"""

from __future__ import annotations

import math
from collections.abc import Callable

from staunlabor.domain.checks import Case, Source
from staunlabor.domain.experiments import diver as engine

ENGINE = ("diver",)

G = 9.80665
#: Water at 20 °C and the air's pressure at the surface, as the engine takes them.
RHO = 998.0
P0 = 101325.0

_ARCHIMEDES = Source(
    cite="OpenStax, University Physics Volume 1, §14.4 Archimedes’ Principle and Buoyancy",
    url="https://openstax.org/books/university-physics-volume-1/pages/14-4-archimedes-principle-and-buoyancy",
    quote="Archimedes’ Principle The buoyant force on an object equals the weight of the fluid it displaces. In "
    "equation form, Archimedes’ principle is F_B = w_fl",
)
_BOYLE = Source(
    cite="OpenStax, Chemistry 2e, §9.2 Relating Pressure, Volume, Amount, and Temperature: The Ideal Gas Law",
    url="https://openstax.org/books/chemistry-2e/pages/"
    "9-2-relating-pressure-volume-amount-and-temperature-the-ideal-gas-law",
    quote="Boyle’s law: The volume of a given amount of gas held at constant temperature is inversely proportional "
    "to the pressure under which it is measured.",
)
_DEPTH = Source(
    cite="OpenStax, University Physics Volume 1, §14.1, “Pressure in a fluid with a constant density”, Eq. 14.9",
    url="https://openstax.org/books/university-physics-volume-1/pages/14-1-fluids-density-and-pressure",
    quote="p = p₀ + ρgh. … Hence, pressure at a depth of fluid on the surface of Earth is equal to the atmospheric "
    "pressure plus ρgh if the density of the fluid is constant over the height",
)
_ADDED = Source(
    cite="Wikipedia, “Added mass”",
    url="https://en.wikipedia.org/wiki/Added_mass",
    quote="One can show that the added mass for a sphere (of radius r) is ⅔πr³ρ_fluid, which is half the volume of "
    "the sphere times the density of the fluid.",
)

#: The page's diver and bottle: 3 g of glass, 1.2 cm³, 2 cm³ of air, 12 mm across, in 30 cm of water.
_DIVER = engine.Diver()
_BOTTLE = engine.Bottle()


def _needed_m3(diver: engine.Diver) -> float:
    """The bubble with which buoyancy carries the glass exactly: ρ(V_g + V) = m."""
    return diver.glass_kg / RHO - diver.glass_m3


def _reserve_hand_g(diver: engine.Diver) -> float:
    """At the surface, unsqueezed: the water displaced less the glass, in grams."""
    return (RHO * (diver.glass_m3 + diver.air_m3) - diver.glass_kg) * 1000


def _sinking_hand_kpa(diver: engine.Diver, depth_m: float) -> float:
    """The squeeze that shrinks the bubble at ``depth_m`` to the one it hovers
    with: p₀V₀ = (p₀ + Δp + ρgh)·V*, so Δp = p₀V₀/V* − p₀ − ρgh."""
    return (P0 * diver.air_m3 / _needed_m3(diver) - P0 - RHO * G * depth_m) / 1000


def _threshold_kpa(moves: Callable[[float], bool]) -> float:
    """The squeeze, by bisection between 0 and 25 kPa, where one step of the
    page's time loop changes its answer to ``moves``."""
    lo, hi = 0.0, 25_000.0
    above = moves(hi)
    for _ in range(60):
        mid = (lo + hi) / 2
        if moves(mid) == above:
            hi = mid
        else:
            lo = mid
    return (lo + hi) / 2 / 1000


def _sinking_run_kpa() -> float:
    """At rest at the surface: from which squeeze does a step take it down?"""
    return _threshold_kpa(lambda pa: engine.step(_DIVER, _BOTTLE, 0.0, 0.0, pa)[0] > 0)


def _bottom_run_kpa() -> float:
    """At rest on the bottom: from which squeeze does a step leave it lying there?"""
    depth = _BOTTLE.depth_m
    return _threshold_kpa(lambda pa: engine.step(_DIVER, _BOTTLE, depth, 0.0, pa)[0] >= depth)


#: The squeeze the case hovers the diver with, and how far off and how long.
_HOVER_PA = 10_000.0
_OFF_M = 1e-6
_FOR_S = 5.0


def _hover_hand_m(diver: engine.Diver, squeeze_pa: float) -> float:
    """Where the bubble is the one it hovers with: p₀V₀ = (p₀ + Δp + ρgz*)·V*."""
    return (P0 * diver.air_m3 / _needed_m3(diver) - P0 - squeeze_pa) / (RHO * G)


def _leaving_hand_per_s(diver: engine.Diver, squeeze_pa: float) -> float:
    """√k: a step δz below the hover depth shrinks the bubble by V*·ρgδz/p*
    (Boyle with p = p₀ + Δp + ρgz), the lost buoyancy ρ²g²V*/p*·δz pulls the
    glass and the water it drags along, m + ½ρV: δz″ = k·δz."""
    v_star = _needed_m3(diver)
    p_star = P0 + squeeze_pa + RHO * G * _hover_hand_m(diver, squeeze_pa)
    inertia = diver.glass_kg + 0.5 * RHO * (diver.glass_m3 + v_star)
    return math.sqrt(RHO * RHO * G * G * v_star / (p_star * inertia))


def _leaving_run_per_s() -> float:
    """Let go at rest a micrometre below the hover depth, stepped as the page
    steps it for five seconds: δz = δz₀·cosh(√k·t) read back as √k."""
    start = engine.hover_depth_m(_DIVER, _HOVER_PA) + _OFF_M
    z, v = start, 0.0
    for _ in range(round(_FOR_S / engine.STEP_S)):
        z, v = engine.step(_DIVER, _BOTTLE, z, v, _HOVER_PA)
    return math.acosh((z - start + _OFF_M) / _OFF_M) / _FOR_S


def _setting(squeeze_kpa: float, start: str = "surface") -> dict[str, float | str]:
    """What the page's "Set it up" sets: the build as it opens, the hand's
    squeeze and where the diver starts at rest: at the surface, on the bottom,
    or ("hover") the case's micrometre below the hover depth, which no hand on
    the slider could find."""
    return {"air_m3": _DIVER.air_m3, "depth_m": _BOTTLE.depth_m, "squeeze_kpa": squeeze_kpa, "start": start}


CASES: tuple[Case, ...] = (
    Case(
        key="reserve",
        unit="g",
        expected=lambda: _reserve_hand_g(_DIVER),
        measured=lambda: engine.figures(_DIVER, _BOTTLE).reserve_kg * 1000,
        tolerance=1e-12,
        sources=(_ARCHIMEDES,),
        setting=_setting(0.0),
    ),
    Case(
        key="sinks_from_top",
        unit="kPa",
        expected=lambda: _sinking_hand_kpa(_DIVER, 0.0),
        measured=_sinking_run_kpa,
        # Bisection to 25 kPa/2⁶⁰: the threshold is exact.
        tolerance=1e-12,
        sources=(_BOYLE, _ARCHIMEDES),
        derived=True,
        setting=_setting(10.9),
    ),
    Case(
        key="rises_from_bottom",
        unit="kPa",
        expected=lambda: _sinking_hand_kpa(_DIVER, _BOTTLE.depth_m),
        measured=_bottom_run_kpa,
        # Lying on the bottom, a step moves the diver by some h²·a, which the
        # rounding of 30 cm hides below 10⁻¹⁷ m: the threshold blurs by 10⁻⁶ Pa.
        tolerance=1e-9,
        sources=(_BOYLE, _ARCHIMEDES, _DEPTH),
        derived=True,
        setting=_setting(7.9, "bottom"),
    ),
    Case(
        key="leaves_hover",
        unit="1/s",
        expected=lambda: _leaving_hand_per_s(_DIVER, _HOVER_PA),
        measured=_leaving_run_per_s,
        # The drag, ½ρc_dAv², and Boyle's curve both grow with the distance
        # off: 1.1·10⁻⁵ at a micrometre, ten times that at ten.
        tolerance=5e-5,
        sources=(_BOYLE, _DEPTH, _ADDED),
        derived=True,
        setting=_setting(_HOVER_PA / 1000, "hover"),
    ),
)
