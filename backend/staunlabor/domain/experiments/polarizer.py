"""The third polarising filter: two crossed filters let no light through, and a third slanted between them brings it back.

The exhibit is a lamp behind two polarising filters. Turn one until the two
are crossed and it goes dark. Slide a third filter between them, slanted, and
it is bright again, though a filter can only take light away.

**Why.** A filter does not only block: what it lets through is polarised
along its own axis, whatever it was before. The middle filter, at 45°, takes
half of the light the first lets through and turns what is left half-way to
the last filter's axis; of that the last takes half again. Light from the
lamp is unpolarised, so the first takes half: ``½ · ½ · ½``, an eighth.

**The model.** Malus's law along a chain of linear polarisers: polarised light
of intensity ``I`` through a filter at ``θ`` to its direction leaves with
``I·cos²θ``; unpolarised light leaves the first with half. A real sheet passes
the share ``k₁`` of light polarised along its axis and ``k₂ = ε·k₁`` across
(``ε`` the extinction ratio): its Jones matrix is ``R(−θ)·diag(√k₁, √k₂)·R(θ)``
in a frame turned by its axis' angle, and unpolarised light is the even mix of
two crossed polarisations, so after a stack ``J`` its share of the lamp is
``½·(|J·x̂|² + |J·ŷ|²)``, half the sum of the squares of ``J``'s entries. With
an ideal sheet (``k₁ = 1``, ``k₂ = 0``) that is Malus's law exactly. ``n``
filters between a crossed pair, evenly turned, let through
``½·cos^{2(n+1)}(90°/(n+1))``, which tends to a half: many small turns lose
almost nothing.

**What it leaves out.** The colour: a real sheet's ``k₁`` and ``k₂`` change
with the wavelength (crossed Polaroid looks slightly blue), here one value for all
light; light reflected between the sheets; a sheet that turns the
polarisation's phase as well (a retarder), which the ideal and the dichroic
sheet of the model do not.
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import dataclass

#: An ideal filter's sheet, and a Polaroid-like one: about 38 % of unpolarised
#: light through one sheet and an extinction ratio of 1 : 500, the values
#: Wikipedia's "Polarizer" gives for Polaroid; ``k₁`` set to make the 38 %.
IDEAL_TRANSMISSION = 1.0
POLAROID_TRANSMISSION = 0.76
POLAROID_EXTINCTION = 1 / 500

#: The most filters the page lets one slide between the crossed pair.
MOST_BETWEEN = 60


@dataclass(frozen=True)
class Sheet:
    """What one filter is made of: it lets through the share ``transmission``
    (``k₁``) of light polarised along its axis, and ``extinction`` times that
    (``k₂ = ε·k₁``) of light polarised across it."""

    transmission: float = IDEAL_TRANSMISSION
    extinction: float = 0.0

    def __post_init__(self) -> None:
        if not 0.1 <= self.transmission <= 1:
            raise ValueError("a sheet passes 10 to 100 % of the light along its axis")
        if not 0 <= self.extinction <= 0.5:
            raise ValueError("a sheet passes at most half as much across its axis as along it")


IDEAL = Sheet()
POLAROID = Sheet(transmission=POLAROID_TRANSMISSION, extinction=POLAROID_EXTINCTION)

_Matrix = tuple[tuple[float, float], tuple[float, float]]


def _jones(angle_deg: float, sheet: Sheet) -> _Matrix:
    """One filter's Jones matrix, its axis at ``angle_deg`` from the first's."""
    c, s = math.cos(math.radians(angle_deg)), math.sin(math.radians(angle_deg))
    a, b = math.sqrt(sheet.transmission), math.sqrt(sheet.transmission * sheet.extinction)
    return ((a * c * c + b * s * s, (a - b) * c * s), ((a - b) * c * s, a * s * s + b * c * c))


def _times(m: _Matrix, n: _Matrix) -> _Matrix:
    return (
        (m[0][0] * n[0][0] + m[0][1] * n[1][0], m[0][0] * n[0][1] + m[0][1] * n[1][1]),
        (m[1][0] * n[0][0] + m[1][1] * n[1][0], m[1][0] * n[0][1] + m[1][1] * n[1][1]),
    )


def through(angles_deg: Sequence[float], sheet: Sheet = IDEAL) -> list[float]:
    """The light after each filter in turn, as a share of the lamp's: the
    lamp's light unpolarised, each filter's axis at its angle."""
    if not angles_deg:
        raise ValueError("a stack has at least one filter")
    if len(angles_deg) > MOST_BETWEEN + 2:
        raise ValueError(f"at most {MOST_BETWEEN + 2} filters")
    stack: _Matrix = ((1.0, 0.0), (0.0, 1.0))
    out = []
    for angle in angles_deg:
        stack = _times(_jones(angle, sheet), stack)
        out.append(0.5 * sum(x * x for row in stack for x in row))
    return out


def three(middle_deg: float, sheet: Sheet = IDEAL, last_deg: float = 90.0) -> float:
    """The light through a filter at 0°, one at ``middle_deg`` and one at
    ``last_deg`` (crossed with the first unless said), a share of the lamp's."""
    return through((0.0, middle_deg, last_deg), sheet)[-1]


def evenly(between: int) -> list[float]:
    """The axes of a crossed pair with ``between`` filters in it, turned
    evenly from 0° to 90°."""
    if not 0 <= between <= MOST_BETWEEN:
        raise ValueError(f"0 to {MOST_BETWEEN} filters between the pair")
    steps = between + 1
    return [90.0 * k / steps for k in range(steps + 1)]


def stacked(between: int, sheet: Sheet = IDEAL) -> float:
    """The light through a crossed pair with ``between`` filters evenly in it."""
    return through(evenly(between), sheet)[-1]


@dataclass(frozen=True)
class PolarizerFigures:
    #: Through one sheet, of the lamp's light.
    one: float
    #: Through two at the same angle, and crossed.
    parallel: float
    crossed: float
    #: Through the crossed pair with a third at 45° between, and that as a
    #: share of what the first lets through.
    third: float
    third_of_first: float
    #: How many filters evenly between the crossed pair let the most through
    #: (of 0 to :data:`MOST_BETWEEN`), and how much.
    best_between: int
    best: float


def figures(sheet: Sheet = IDEAL) -> PolarizerFigures:
    one = through((0.0,), sheet)[0]
    third = three(45.0, sheet)
    lights = [stacked(n, sheet) for n in range(MOST_BETWEEN + 1)]
    best = max(range(MOST_BETWEEN + 1), key=lambda n: lights[n])
    return PolarizerFigures(
        one=one,
        parallel=through((0.0, 0.0), sheet)[-1],
        crossed=through((0.0, 90.0), sheet)[-1],
        third=third,
        third_of_first=third / one,
        best_between=best,
        best=lights[best],
    )
