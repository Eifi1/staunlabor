"""The soap film between two rings: drawn apart, its waist narrows, and at one distance it snaps into two flat discs.

The exhibit is two wire rings, dipped together into soap solution and drawn
apart. A film hangs between them, narrowing to a waist. The further they go,
the thinner the waist; and at about two thirds of a ring's diameter apart the
film suddenly gives up its waist and leaves a flat disc in each ring.

**Why.** A soap film pulls itself to the least area its edges allow (its
energy is its surface tension times its area), and the air inside is open to
the room, so the film is a minimal surface. Between two coaxial rings of
radius ``R`` a distance ``h`` apart, the minimal surface of revolution is the
catenoid ``r(z) = c·cosh(z/c)``, the waist ``c`` fixed by the rings,
``R = c·cosh(h/(2c))``. With ``t = h/(2c)`` that is ``h/R = 2t/cosh t``, which
rises from nothing, peaks where ``t·tanh t = 1`` (``t ≈ 1.1997``) at
``h/R ≈ 1.3255``, and falls again: below the peak two catenoids fit the
rings, a wide one (stable, the film one sees) and a thin one (unstable), and
above it none. There the film has nothing with a waist to go to, and it
snaps into the two discs, ``2πR²`` (the Goldschmidt solution).

**Before it snaps.** The wide catenoid's area, ``π·c·(h + c·sinh(h/c))``,
passes the discs' already at ``h/R ≈ 1.0554``: from there the film is no
longer the least area, only the least nearby, and it stays, since to reach the
discs it would first have to grow. Real films stay too: Ito and Sato (2010)
filmed one hold its waist to just short of the tear.

**The model.** The catenoid's boundary problem, solved for ``t`` by halving a
bracket on each side of the peak; the peak and the equal-area distance by
halving too. The hand moves the rings; nothing here steps in time.

**What it leaves out.** Gravity, which sags a real film a little; the film's
thickness, its draining and its bursting before its time; the rings' wire,
drawn as a line; and how the waist pinches once it has nothing to go to,
which takes a few hundredths of a second.
"""

from __future__ import annotations

import math
from collections.abc import Callable
from dataclasses import dataclass

#: The exhibit's rings, 10 cm across, and how far apart the hand starts them.
EXHIBIT_RADIUS_M = 0.05
START_DISTANCE_M = 0.01

#: How often a bracket is halved: more than enough to reach a double's last
#: digit from a bracket of a few units.
BISECTIONS = 100


def _halve(rises: Callable[[float], float], lo: float, hi: float) -> float:
    """Where ``rises`` crosses zero between ``lo`` (where it is below) and
    ``hi`` (where it is not), the bracket halved ``BISECTIONS`` times."""
    for _ in range(BISECTIONS):
        mid = (lo + hi) / 2
        if rises(mid) < 0:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def span(t: float) -> float:
    """``h/R`` of the catenoid whose ends lie at ``z = ±c·t``: ``2t/cosh t``."""
    return 2 * t / math.cosh(t)


#: Where ``span`` peaks: ``d/dt (2t/cosh t) = 0``, that is ``t·tanh t = 1``.
TANGENT_T = _halve(lambda t: t * math.tanh(t) - 1, 0.5, 2.0)
#: The farthest the rings can be apart with a film between them, over ``R``.
TEAR_RATIO = span(TANGENT_T)
#: Where the wide catenoid's area equals the two discs': ``2t + sinh 2t =
#: 2·cosh² t``, that is ``2t − e^(−2t) = 1``.
EQUAL_T = _halve(lambda t: 2 * t - math.exp(-2 * t) - 1, 0.0, TANGENT_T)
#: The distance over ``R`` from which two discs would have less area.
EQUAL_RATIO = span(EQUAL_T)


@dataclass(frozen=True)
class Rings:
    """Two equal rings on one axis, their centres ``distance_m`` apart."""

    radius_m: float = EXHIBIT_RADIUS_M
    distance_m: float = START_DISTANCE_M

    def __post_init__(self) -> None:
        if not 0.001 <= self.radius_m <= 1:
            raise ValueError("a ring's radius is 1 mm to 1 m")
        # From a tenth of a millimetre: the thin catenoid's ``t`` grows as the
        # logarithm of ``R/h``, and ``cosh`` overflows past ``t ≈ 710``.
        if not 0.0001 <= self.distance_m <= 2:
            raise ValueError("the rings are 0.1 mm to 2 m apart")


@dataclass(frozen=True)
class Catenoid:
    #: The waist's radius, ``c``.
    neck_m: float
    #: The film's area (one face), ``π·c·(h + c·sinh(h/c))``.
    area_m2: float


def area_m2(neck_m: float, distance_m: float) -> float:
    """The area of the catenoid ``r = c·cosh(z/c)`` over ``|z| ≤ h/2``."""
    return math.pi * neck_m * (distance_m + neck_m * math.sinh(distance_m / neck_m))


def discs_m2(radius_m: float) -> float:
    """The two flat discs a torn film leaves, one in each ring."""
    return 2 * math.pi * radius_m**2


def catenoids(rings: Rings) -> tuple[Catenoid, Catenoid] | None:
    """The wide (stable) and the thin (unstable) catenoid between the rings,
    or none once they are further apart than ``TEAR_RATIO·R``."""
    ratio = rings.distance_m / rings.radius_m
    if ratio > TEAR_RATIO:
        return None
    # ``span`` rises up to the peak and falls after it: one root on each side.
    wide = _halve(lambda t: span(t) - ratio, 0.0, TANGENT_T)
    hi = 2 * TANGENT_T
    while span(hi) > ratio:
        hi *= 2
    thin = _halve(lambda t: ratio - span(t), TANGENT_T, hi)
    out = []
    for t in (wide, thin):
        neck = rings.distance_m / (2 * t)
        out.append(Catenoid(neck_m=neck, area_m2=area_m2(neck, rings.distance_m)))
    return out[0], out[1]


def radius_at(neck_m: float, z_m: float) -> float:
    """The film's radius at ``z`` from its waist: ``c·cosh(z/c)``."""
    return neck_m * math.cosh(z_m / neck_m)


def tears(rings: Rings) -> bool:
    """Whether a film with a waist can no longer span the rings."""
    return catenoids(rings) is None


@dataclass(frozen=True)
class FilmFigures:
    #: ``h/R``.
    ratio: float
    #: The wide catenoid, ``None`` past the tear.
    neck_m: float | None
    area_m2: float | None
    #: The thin catenoid, ``None`` past the tear.
    thin_neck_m: float | None
    thin_area_m2: float | None
    discs_m2: float
    #: Whether the film with its waist has less area than the two discs.
    least: bool
    #: The distances, for these rings, where the discs start to have less
    #: area and where the film must tear.
    equal_m: float
    tear_m: float


def figures(rings: Rings) -> FilmFigures:
    both = catenoids(rings)
    discs = discs_m2(rings.radius_m)
    return FilmFigures(
        ratio=rings.distance_m / rings.radius_m,
        neck_m=None if both is None else both[0].neck_m,
        area_m2=None if both is None else both[0].area_m2,
        thin_neck_m=None if both is None else both[1].neck_m,
        thin_area_m2=None if both is None else both[1].area_m2,
        discs_m2=discs,
        least=both is not None and both[0].area_m2 < discs,
        equal_m=EQUAL_RATIO * rings.radius_m,
        tear_m=TEAR_RATIO * rings.radius_m,
    )
