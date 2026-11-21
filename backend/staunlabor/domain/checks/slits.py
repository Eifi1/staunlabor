"""The double slit, checked: the pattern on the wall, as the page draws it,
against Young's stripes, the single slit's dark, the amplitudes that add, the
diffraction that dims the stripes, and the stripe it leaves out.

The exhibit's own build and red laser. The places on the wall are found on the
page's ``intensity`` by golden-section search, not by the engine's
``dark_m``/``bright_m``/``figures``.
"""

from __future__ import annotations

import math
from collections.abc import Callable

from staunlabor.domain.checks import Case, Source
from staunlabor.domain.experiments import slits as engine

ENGINE = ("slits",)

_YOUNG = Source(
    cite="OpenStax, University Physics Volume 3, §3.2 Mathematics of Interference, Eq. 3.5 and 3.6",
    url="https://openstax.org/books/university-physics-volume-3/pages/3-2-mathematics-of-interference",
    quote="to obtain destructive interference for a double slit, the path length difference must be a half-integral "
    "multiple of the wavelength, or d sin θ = (m + ½)λ, for m = 0, ±1, ±2, ±3,… (destructive interference) … "
    "Equation 3.4 may then be written as d y_m/D = mλ or y_m = mλD/d.",
)
_BRIGHT = Source(
    cite="OpenStax, University Physics Volume 3, §3.2 Mathematics of Interference, Eq. 3.4",
    url="https://openstax.org/books/university-physics-volume-3/pages/3-2-mathematics-of-interference",
    quote="we obtain constructive interference for a double slit when the path length difference is an integral "
    "multiple of the wavelength, or d sin θ = mλ, for m = 0, ±1, ±2, ±3,… (constructive interference)",
)
_SINGLE = Source(
    cite="OpenStax, University Physics Volume 3, §4.1 Single-Slit Diffraction, Eq. 4.1",
    url="https://openstax.org/books/university-physics-volume-3/pages/4-1-single-slit-diffraction",
    quote="Thus, to obtain destructive interference for a single slit, a sin θ = mλ, for m = ±1, ±2, ±3, ... "
    "(destructive)",
)
_ADD = Source(
    cite="OpenStax, University Physics Volume 3, §3.1 Young's Double-Slit Interference, Figure 3.4",
    url="https://openstax.org/books/university-physics-volume-3/pages/3-1-youngs-double-slit-interference",
    quote="The amplitudes of waves add. (a) Pure constructive interference is obtained when identical waves are in "
    "phase.",
)
_SQUARE = Source(
    cite="OpenStax, University Physics Volume 3, §4.2 Intensity in Single-Slit Diffraction, Eq. 4.4",
    url="https://openstax.org/books/university-physics-volume-3/pages/4-2-intensity-in-single-slit-diffraction",
    quote="The intensity is proportional to the square of the amplitude, so I = I0 (sin β/β)²",
)
_DIMMED = Source(
    cite="OpenStax, University Physics Volume 3, §4.3 Double-Slit Diffraction, Example 4.3",
    url="https://openstax.org/books/university-physics-volume-3/pages/4-3-double-slit-diffraction",
    quote="the bright interference fringes occur at d sin θ = mλ, or sin θ = mλ/d. From Equation 4.4, "
    "I = I0 (sin β/β)², where β = ϕ/2 = πa sin θ/λ. Substituting from above, β = πa sin θ/λ = πa/λ · mλ/d = mπa/d.",
)
_MISSING = Source(
    cite="OpenStax, University Physics Volume 3, §4.3 Double-Slit Diffraction",
    url="https://openstax.org/books/university-physics-volume-3/pages/4-3-double-slit-diffraction",
    quote="some of the maxima of interference from the two slits are missing if the maximum of the interference is "
    "in the same direction as the minimum of the diffraction. We refer to such a missing peak as a missing order.",
)

_SLITS = engine.Slits()
_NM = 650.0


def _lowest_m(f: Callable[[float], float], left: float, right: float) -> float:
    """Where ``f`` is least on [left, right], by golden-section search."""
    ratio = (math.sqrt(5) - 1) / 2
    a, b = left, right
    c, d = b - ratio * (b - a), a + ratio * (b - a)
    for _ in range(300):
        if f(c) < f(d):
            b, d = d, c
            c = b - ratio * (b - a)
        else:
            a, c = c, d
            d = a + ratio * (b - a)
        if b - a < 1e-15:
            break
    return (a + b) / 2


def _on_wall_m(sin_theta: float, slits: engine.Slits = _SLITS) -> float:
    """Where the direction ``sin θ`` meets the wall: y = L·tan θ."""
    return slits.distance_m * math.tan(math.asin(sin_theta))


def _dark_spacing_mm() -> float:
    """From the pair's first dark stripe to its second, on the page's pattern."""
    lam, d = _NM * 1e-9, _SLITS.spacing_m

    def pair(y: float) -> float:
        return engine.intensity(_SLITS, _NM, y)

    guess = lam * _SLITS.distance_m / d
    first = _lowest_m(pair, 0.25 * guess, 0.75 * guess)
    second = _lowest_m(pair, 1.25 * guess, 1.75 * guess)
    return (second - first) * 1000


def _one_slit_dark_mm() -> float:
    """The first dark beside the middle of one slit's pattern."""
    guess = _NM * 1e-9 * _SLITS.distance_m / _SLITS.width_m
    return _lowest_m(lambda y: engine.intensity(_SLITS, _NM, y, both=False), 0.8 * guess, 1.2 * guess) * 1000


def _sinc2(beta: float) -> float:
    return (math.sin(beta) / beta) ** 2


def _setting(both: bool) -> dict[str, float | str]:
    return {
        "light": "laser",
        "nm": _NM,
        "slits": "both" if both else "one",
        "spacing_m": _SLITS.spacing_m,
        "width_m": _SLITS.width_m,
        "distance_m": _SLITS.distance_m,
    }


CASES: tuple[Case, ...] = (
    Case(
        key="spacing",
        unit="mm",
        expected=lambda: _NM * 1e-9 * _SLITS.distance_m / _SLITS.spacing_m * 1000,
        measured=_dark_spacing_mm,
        # The small angles' sin θ ≈ tan θ: the second dark lies at sin θ = 0.0039,
        # and the spacing comes out 1.1 · 10⁻⁵ wider.
        tolerance=3e-5,
        sources=(_YOUNG,),
        derived=True,
        setting=_setting(True),
    ),
    Case(
        key="one_slit_dark",
        unit="mm",
        expected=lambda: _on_wall_m(_NM * 1e-9 / _SLITS.width_m) * 1000,
        measured=_one_slit_dark_mm,
        # The search ends within a few nanometres on the wall.
        tolerance=1e-7,
        sources=(_SINGLE,),
        setting=_setting(False),
    ),
    Case(
        key="quarter",
        unit="",
        expected=lambda: 1 / 2**2,
        measured=lambda: engine.intensity(_SLITS, _NM, 0.0, both=False),
        tolerance=1e-12,
        sources=(_ADD, _SQUARE),
        derived=True,
        setting=_setting(False),
    ),
    Case(
        key="first_bright",
        unit="",
        expected=lambda: _sinc2(math.pi * _SLITS.width_m / _SLITS.spacing_m),
        measured=lambda: engine.intensity(_SLITS, _NM, _on_wall_m(_NM * 1e-9 / _SLITS.spacing_m)),
        tolerance=1e-12,
        sources=(_DIMMED,),
        setting=_setting(True),
    ),
    Case(
        key="missing",
        unit="",
        expected=lambda: 0.0,
        measured=lambda: engine.intensity(_SLITS, _NM, _on_wall_m(5 * _NM * 1e-9 / _SLITS.spacing_m)),
        tolerance=1e-12,
        sources=(_BRIGHT, _SINGLE, _MISSING),
        derived=True,
        setting=_setting(True),
    ),
)
