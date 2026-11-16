"""Light as the eye sees it: a spectrum made into a colour on the screen, for the exhibits about light.

The light exhibits compute how much of each wavelength reaches the eye — a
rainbow's ring, the light along a cloudy tube, a pattern of fringes — and the
page must show it as a colour. This module is that one step, shared by them:
from the power at each wavelength to the red, green and blue a screen lights.

**The eye's three numbers.** What the eye makes of a spectrum is three numbers,
the tristimulus values ``X, Y, Z``: the spectrum weighted by the three colour-
matching functions of the CIE's standard observer (1931, 2°) and summed. ``Y``
is the brightness. The functions are not tabulated here but taken as the fit of
Wyman, Sloan and Shirley (2013), a sum of a few lopsided Gaussian bells each;
it follows the table to a few per cent of the peak, and the white points it
gives lie within 0.002 of the standard's (tests).

**The screen.** ``X, Y, Z`` become the light of the screen's red, green and
blue by the sRGB matrix (linear light), and that by the sRGB curve into the
numbers a page writes. Before that the colour is taken relative to the light's
own white: the eye adapts to the lamp, so the lamp's own light is shown white
and only what the exhibit does to it shows as colour (each channel divided by
the lamp's, a crude white balance, good enough between whites this close).

**What a screen cannot show.** A spectral colour — the red at a rainbow's edge
— is more saturated than any mixture of a screen's three lights, and comes out
with a channel below zero. That channel is shown as zero: the colour keeps
roughly its hue and loses some saturation, and comes out a little brighter
than it is. (Mixing it with grey of its own brightness instead keeps the
brightness exactly, but turns a spectral red into a dull crimson, further from
what one sees.) A colour brighter than the screen's white is dimmed as a
whole, its hue kept. Neither is what the eye sees at the exhibit; the pages
say the colours are close, not exact.

**What it leaves out.** Brightness adaptation (each page sets its own
exposure), the eye's response to very dim light, and every screen's own
deviation from sRGB.
"""

from __future__ import annotations

import math
from collections.abc import Sequence

#: The wavelengths a spectrum is given at, nm: 380 to 780 in steps of 5 —
#: the visible range, finely enough that a colour moves less than the eye sees
#: between two steps.
WAVELENGTHS_NM: tuple[int, ...] = tuple(range(380, 781, 5))
STEP_NM = 5.0

#: The fit's bells, ``(weight, centre nm, width below, width above)``, for
#: x̄, ȳ and z̄ (Wyman, Sloan and Shirley 2013, the multi-lobe fit).
_LOBES: tuple[tuple[tuple[float, float, float, float], ...], ...] = (
    ((1.056, 599.8, 37.9, 31.0), (0.362, 442.0, 16.0, 26.7), (-0.065, 501.1, 20.4, 26.2)),
    ((0.821, 568.8, 46.9, 40.5), (0.286, 530.9, 16.3, 31.1)),
    ((1.217, 437.0, 11.8, 36.0), (0.681, 459.0, 26.0, 13.8)),
)

#: From ``X, Y, Z`` to the screen's linear red, green and blue (sRGB, D65).
_TO_RGB: tuple[tuple[float, float, float], ...] = (
    (3.2406, -1.5372, -0.4986),
    (-0.9689, 1.8758, 0.0415),
    (0.0557, -0.2040, 1.0570),
)

#: Planck's second radiation constant ``h·c/k``, m·K.
_C2 = 1.438776877e-2
#: The wavelength a lamp's spectrum is taken as 1 at, nm.
_PLANCK_REFERENCE_NM = 560.0


def _bell(nm: float, centre: float, below: float, above: float) -> float:
    width = below if nm < centre else above
    return math.exp(-0.5 * ((nm - centre) / width) ** 2)


def matching(nm: float) -> tuple[float, float, float]:
    """The standard observer's ``x̄, ȳ, z̄`` at ``nm``, by the fit."""
    x, y, z = (sum(w * _bell(nm, c, lo, hi) for w, c, lo, hi in lobes) for lobes in _LOBES)
    return x, y, z


def planck(nm: float, kelvin: float) -> float:
    """A glowing body's light at ``nm`` (Planck), as a share of its light at
    560 nm: the spectrum of a lamp, or of the sun, by its temperature."""
    if not 1000 <= kelvin <= 20000:
        raise ValueError("a lamp glows at 1000 K to 20 000 K")
    lam, ref = nm * 1e-9, _PLANCK_REFERENCE_NM * 1e-9
    return (ref / lam) ** 5 * math.expm1(_C2 / (ref * kelvin)) / math.expm1(_C2 / (lam * kelvin))


def lamp(kelvin: float) -> list[float]:
    """A glowing body's spectrum at ``WAVELENGTHS_NM``."""
    return [planck(nm, kelvin) for nm in WAVELENGTHS_NM]


def tristimulus(power: Sequence[float]) -> tuple[float, float, float]:
    """``X, Y, Z`` of a spectrum given at ``WAVELENGTHS_NM``: the sum of the
    power times the observer's functions, times the step."""
    if len(power) != len(WAVELENGTHS_NM):
        raise ValueError("a spectrum gives one power per wavelength in WAVELENGTHS_NM")
    x = y = z = 0.0
    for nm, p in zip(WAVELENGTHS_NM, power, strict=True):
        mx, my, mz = matching(nm)
        x += p * mx
        y += p * my
        z += p * mz
    return x * STEP_NM, y * STEP_NM, z * STEP_NM


def linear_rgb(xyz: Sequence[float]) -> tuple[float, float, float]:
    """The screen's red, green and blue light (linear, sRGB) for ``X, Y, Z``."""
    r, g, b = (row[0] * xyz[0] + row[1] * xyz[1] + row[2] * xyz[2] for row in _TO_RGB)
    return r, g, b


def seen(source: Sequence[float], factors: Sequence[float]) -> tuple[float, float, float]:
    """The light ``source`` (a spectrum) after the exhibit multiplied each
    wavelength by ``factors``, as linear red, green and blue relative to the
    source's own white: factors all 1 give ``(1, 1, 1)``."""
    if len(factors) != len(source):
        raise ValueError("one factor per wavelength of the source")
    white = linear_rgb(tristimulus(source))
    light = linear_rgb(tristimulus([s * f for s, f in zip(source, factors, strict=True)]))
    r, g, b = (c / w for c, w in zip(light, white, strict=True))
    return r, g, b


def _encode(c: float) -> float:
    """sRGB's curve: from linear light to the number a page writes."""
    return 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055


def on_screen(rgb: Sequence[float]) -> tuple[float, float, float]:
    """A linear colour as the screen shows it, each channel 0 to 1 and
    encoded: a channel below zero as zero; brighter than white, dimmed as a
    whole."""
    clipped = [max(0.0, c) for c in rgb]
    top = max(clipped)
    if top > 1:
        clipped = [c / top for c in clipped]
    r, g, b = (_encode(c) for c in clipped)
    return r, g, b
