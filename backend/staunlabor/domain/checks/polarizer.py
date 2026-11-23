"""The third polarising filter, checked: the chain of filters, as the page
computes it, against Malus's law, the half that unpolarised light loses in the
first filter, the crossed pair's dark, the eighth a third filter at 45° brings
back, and a Polaroid-like sheet's 38 % and extinction ratio.

The function the page calls through its port (``simulate/polarizer.ts``):
``through``, the light after each filter. The expected values are Malus's law
applied by hand, filter by filter, never the engine's own sums.
"""

from __future__ import annotations

import math

from staunlabor.domain.checks import Case, Source
from staunlabor.domain.experiments import polarizer as engine

_MALUS = Source(
    cite="OpenStax, University Physics Volume 3, §1.7 Polarization, Eq. 1.6",
    url="https://openstax.org/books/university-physics-volume-3/pages/1-7-polarization",
    quote="Since the intensity of a wave is proportional to its amplitude squared, the intensity I of the "
    "transmitted wave is related to the incident wave by I = I0 cos²θ (1.6) where I0 is the intensity of the "
    "polarized wave before passing through the filter. This equation is known as Malus’s law.",
)
_HALF = Source(
    cite="Wikipedia, “Polarizer”, §Malus's law and other properties",
    url="https://en.wikipedia.org/wiki/Polarizer",
    quote="A beam of unpolarized light can be thought of as containing a uniform mixture of linear polarizations "
    "at all possible angles. Since the average value of cos²θ is 1/2, the transmission coefficient becomes "
    "I/I0 = 1/2.",
)
_FACTOR_TWO = Source(
    cite="OpenStax, University Physics Volume 3, §1.7 Polarization, Figure 1.36",
    url="https://openstax.org/books/university-physics-volume-3/pages/1-7-polarization",
    quote="The first filter polarizes the light along its axis, decreasing its intensity by a factor of 2.",
)
_CROSSED = Source(
    cite="OpenStax, University Physics Volume 3, §1.7 Polarization, Figure 1.36",
    url="https://openstax.org/books/university-physics-volume-3/pages/1-7-polarization",
    quote="When the axes are perpendicular, no light is passed by the second filter.",
)
_EIGHTH = Source(
    cite="UCSB Physics Lecture Demonstrations, “Crossed polarizers with third polarizer”",
    url="https://web.physics.ucsb.edu/~lecturedemonstrations/New%20demos/Crossed%20polarizers%20with%20third%20polarizer.htm",
    quote="With all three polarizers in place as described and shown here, at each polarizer half the incident "
    "light is transmitted, so one-eighth of the light from the projector reaches the screen.",
)
_TWICE = Source(
    cite="R. Nave, HyperPhysics, “Crossed Polarizers”, Polarizer Puzzle",
    url="https://hyperphysics.gsu.edu/hbase/phyopt/polcross.html",
    quote="In the situation shown, the transmitted intensity can be calculated by applying the Law of Malus twice. "
    "If the center polarizer is placed at 45° between crossed polarizers, 25% of the light will be transmitted.",
)
_POLAROID = Source(
    cite="Wikipedia, “Polarizer”, §Malus's law and other properties",
    url="https://en.wikipedia.org/wiki/Polarizer",
    quote="In practice, some light is lost in the polarizer and the actual transmission will be somewhat lower than "
    "this, around 38% for Polaroid-type polarizers but considerably higher (>49.9%) for some birefringent prism "
    "types.",
)
_EXTINCTION = Source(
    cite="Wikipedia, “Polarizer”, §Malus's law and other properties",
    url="https://en.wikipedia.org/wiki/Polarizer",
    quote="Real polarizers are also not perfect blockers of the polarization orthogonal to their polarization axis; "
    "the ratio of the transmission of the unwanted component to the wanted component is called the extinction "
    "ratio, and varies from around 1:500 for Polaroid to about 1:10⁶ for Glan–Taylor prism polarizers.",
)

#: Polaroid as Wikipedia gives it: an extinction ratio of 1 : 500, and the share
#: along the axis that, with it, lets 38 % of unpolarised light through one sheet.
_K1 = engine.POLAROID_TRANSMISSION
_K2 = engine.POLAROID_TRANSMISSION * engine.POLAROID_EXTINCTION
_MANY = 10


def _malus(angle_deg: float) -> float:
    return math.cos(math.radians(angle_deg)) ** 2


def _setting(
    middle_deg: float | None, last_deg: float, sheet: str = "ideal", **more: float | str
) -> dict[str, float | str]:
    out: dict[str, float | str] = {"sheet": sheet, "last_deg": last_deg, **more}
    if middle_deg is None:
        out["middle"] = "out"
    else:
        out["middle"] = "in"
        out["middle_deg"] = middle_deg
    return out


CASES: tuple[Case, ...] = (
    Case(
        key="half",
        unit="",
        expected=lambda: 1 / 2,
        measured=lambda: engine.through((0.0,))[0],
        tolerance=1e-12,
        sources=(_HALF, _FACTOR_TWO),
        setting=_setting(None, 0.0),
    ),
    Case(
        key="malus",
        unit="",
        expected=lambda: _malus(30.0),
        measured=lambda: (lambda light: light[1] / light[0])(engine.through((0.0, 30.0))),
        tolerance=1e-12,
        sources=(_MALUS,),
        setting=_setting(None, 30.0),
    ),
    Case(
        key="crossed",
        unit="",
        expected=lambda: 0.0,
        measured=lambda: engine.through((0.0, 90.0))[-1],
        # cos 90° in floating point is 6·10⁻¹⁷, its square's square 10⁻³³.
        tolerance=1e-30,
        sources=(_CROSSED,),
        setting=_setting(None, 90.0),
    ),
    Case(
        key="third",
        unit="",
        expected=lambda: 1 / 8,
        measured=lambda: engine.through((0.0, 45.0, 90.0))[-1],
        tolerance=1e-12,
        sources=(_EIGHTH, _TWICE),
        setting=_setting(45.0, 90.0),
    ),
    Case(
        key="slanted",
        unit="",
        expected=lambda: 0.5 * _malus(30.0) * _malus(60.0),
        measured=lambda: engine.through((0.0, 30.0, 90.0))[-1],
        tolerance=1e-12,
        sources=(_HALF, _MALUS, _TWICE),
        derived=True,
        setting=_setting(30.0, 90.0),
    ),
    Case(
        key="many",
        unit="",
        expected=lambda: 0.5 * _malus(90.0 / (_MANY + 1)) ** (_MANY + 1),
        measured=lambda: engine.through(engine.evenly(_MANY))[-1],
        # Eleven products of a cosine squared: a few last bits.
        tolerance=1e-12,
        sources=(_HALF, _MALUS),
        derived=True,
        setting={"between": float(_MANY), "sheet": "ideal"},
    ),
    Case(
        key="polaroid_one",
        unit="",
        expected=lambda: 0.38,
        measured=lambda: engine.through((0.0,), engine.POLAROID)[0],
        # "Around 38 %": the sheet's own share along its axis is set to make it,
        # and with the 1 : 500 across it lands at 38.08 %.
        tolerance=0.01,
        sources=(_POLAROID, _EXTINCTION),
        setting=_setting(None, 0.0, "polaroid"),
    ),
    Case(
        key="polaroid_crossed",
        unit="",
        expected=lambda: 0.5 * (_K1 * _K2 + _K2 * _K1),
        measured=lambda: engine.through((0.0, 90.0), engine.POLAROID)[-1],
        tolerance=1e-12,
        sources=(_HALF, _EXTINCTION),
        derived=True,
        setting=_setting(None, 90.0, "polaroid"),
    ),
)
