"""Light as the eye sees it: a spectrum made into a colour on the screen, for the exhibits about light.

The light exhibits compute how much of each wavelength reaches the eye — a
rainbow's ring, the light along a cloudy tube, a pattern of fringes — and the
page must show it as a colour. This module is that one step, shared by them:
from the power at each wavelength to the red, green and blue a screen lights.

**The eye's three numbers.** What the eye makes of a spectrum is three numbers,
the tristimulus values ``X, Y, Z``: the spectrum weighted by the three colour-
matching functions of the CIE's standard observer (1931, 2°) and summed. ``Y``
is the brightness. The functions are the CIE's own table, every 5 nm from 360
to 830 nm (CIE 018:2019, the dataset ``CIE_xyz_1931_2deg``), and straight
between its steps. A fit was used first (Wyman, Sloan and Shirley 2013, a few
lopsided Gaussian bells each), and it halves ``x̄`` past 680 nm: the deep red
of a laser at 700 nm, and the red end of a rainbow, were drawn orange.

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

#: The CIE 1931 standard observer (2°), ``(x̄, ȳ, z̄)`` every 5 nm from
#: :data:`_TABLE_FROM_NM` to 830 nm, as the CIE publishes it.
_TABLE_FROM_NM = 360.0
_TABLE: tuple[tuple[float, float, float], ...] = (
    (0.0001299, 3.917e-06, 0.0006061),  # 360
    (0.0002321, 6.965e-06, 0.001086),  # 365
    (0.0004149, 1.239e-05, 0.001946),  # 370
    (0.0007416, 2.202e-05, 0.003486),  # 375
    (0.001368, 3.9e-05, 0.006450001),  # 380
    (0.002236, 6.4e-05, 0.01054999),  # 385
    (0.004243, 0.00012, 0.02005001),  # 390
    (0.00765, 0.000217, 0.03621),  # 395
    (0.01431, 0.000396, 0.06785001),  # 400
    (0.02319, 0.00064, 0.1102),  # 405
    (0.04351, 0.00121, 0.2074),  # 410
    (0.07763, 0.00218, 0.3713),  # 415
    (0.13438, 0.004, 0.6456),  # 420
    (0.21477, 0.0073, 1.0390501),  # 425
    (0.2839, 0.0116, 1.3856),  # 430
    (0.3285, 0.01684, 1.62296),  # 435
    (0.34828, 0.023, 1.74706),  # 440
    (0.34806, 0.0298, 1.7826),  # 445
    (0.3362, 0.038, 1.77211),  # 450
    (0.3187, 0.048, 1.7441),  # 455
    (0.2908, 0.06, 1.6692),  # 460
    (0.2511, 0.0739, 1.5281),  # 465
    (0.19536, 0.09098, 1.28764),  # 470
    (0.1421, 0.1126, 1.0419),  # 475
    (0.09564, 0.13902, 0.8129501),  # 480
    (0.05795001, 0.1693, 0.6162),  # 485
    (0.03201, 0.20802, 0.46518),  # 490
    (0.0147, 0.2586, 0.3533),  # 495
    (0.0049, 0.323, 0.272),  # 500
    (0.0024, 0.4073, 0.2123),  # 505
    (0.0093, 0.503, 0.1582),  # 510
    (0.0291, 0.6082, 0.1117),  # 515
    (0.06327, 0.71, 0.07824999),  # 520
    (0.1096, 0.7932, 0.05725001),  # 525
    (0.1655, 0.862, 0.04216),  # 530
    (0.2257499, 0.9148501, 0.02984),  # 535
    (0.2904, 0.954, 0.0203),  # 540
    (0.3597, 0.9803, 0.0134),  # 545
    (0.4334499, 0.9949501, 0.008749999),  # 550
    (0.5120501, 1.0, 0.005749999),  # 555
    (0.5945, 0.995, 0.0039),  # 560
    (0.6784, 0.9786, 0.002749999),  # 565
    (0.7621, 0.952, 0.0021),  # 570
    (0.8425, 0.9154, 0.0018),  # 575
    (0.9163, 0.87, 0.001650001),  # 580
    (0.9786, 0.8163, 0.0014),  # 585
    (1.0263, 0.757, 0.0011),  # 590
    (1.0567, 0.6949, 0.001),  # 595
    (1.0622, 0.631, 0.0008),  # 600
    (1.0456, 0.5668, 0.0006),  # 605
    (1.0026, 0.503, 0.00034),  # 610
    (0.9384, 0.4412, 0.00024),  # 615
    (0.8544499, 0.381, 0.00019),  # 620
    (0.7514, 0.321, 0.0001),  # 625
    (0.6424, 0.265, 4.999999e-05),  # 630
    (0.5419, 0.217, 3e-05),  # 635
    (0.4479, 0.175, 2e-05),  # 640
    (0.3608, 0.1382, 1e-05),  # 645
    (0.2835, 0.107, 0.0),  # 650
    (0.2187, 0.0816, 0.0),  # 655
    (0.1649, 0.061, 0.0),  # 660
    (0.1212, 0.04458, 0.0),  # 665
    (0.0874, 0.032, 0.0),  # 670
    (0.0636, 0.0232, 0.0),  # 675
    (0.04677, 0.017, 0.0),  # 680
    (0.0329, 0.01192, 0.0),  # 685
    (0.0227, 0.00821, 0.0),  # 690
    (0.01584, 0.005723, 0.0),  # 695
    (0.01135916, 0.004102, 0.0),  # 700
    (0.008110916, 0.002929, 0.0),  # 705
    (0.005790346, 0.002091, 0.0),  # 710
    (0.004109457, 0.001484, 0.0),  # 715
    (0.002899327, 0.001047, 0.0),  # 720
    (0.00204919, 0.00074, 0.0),  # 725
    (0.001439971, 0.00052, 0.0),  # 730
    (0.0009999493, 0.0003611, 0.0),  # 735
    (0.0006900786, 0.0002492, 0.0),  # 740
    (0.0004760213, 0.0001719, 0.0),  # 745
    (0.0003323011, 0.00012, 0.0),  # 750
    (0.0002348261, 8.48e-05, 0.0),  # 755
    (0.0001661505, 6e-05, 0.0),  # 760
    (0.000117413, 4.24e-05, 0.0),  # 765
    (8.307527e-05, 3e-05, 0.0),  # 770
    (5.870652e-05, 2.12e-05, 0.0),  # 775
    (4.150994e-05, 1.499e-05, 0.0),  # 780
    (2.935326e-05, 1.06e-05, 0.0),  # 785
    (2.067383e-05, 7.4657e-06, 0.0),  # 790
    (1.455977e-05, 5.2578e-06, 0.0),  # 795
    (1.025398e-05, 3.7029e-06, 0.0),  # 800
    (7.221456e-06, 2.6078e-06, 0.0),  # 805
    (5.085868e-06, 1.8366e-06, 0.0),  # 810
    (3.581652e-06, 1.2934e-06, 0.0),  # 815
    (2.522525e-06, 9.1093e-07, 0.0),  # 820
    (1.776509e-06, 6.4153e-07, 0.0),  # 825
    (1.251141e-06, 4.5181e-07, 0.0),  # 830
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


def matching(nm: float) -> tuple[float, float, float]:
    """The standard observer's ``x̄, ȳ, z̄`` at ``nm``: the table's, straight
    between its steps, and nothing outside 360 to 830 nm, where the eye sees
    nothing."""
    pos = (nm - _TABLE_FROM_NM) / STEP_NM
    if not 0 <= pos <= len(_TABLE) - 1:
        return 0.0, 0.0, 0.0
    k = min(int(pos), len(_TABLE) - 2)
    f = pos - k
    (xa, ya, za), (xb, yb, zb) = _TABLE[k], _TABLE[k + 1]
    return xa + f * (xb - xa), ya + f * (yb - ya), za + f * (zb - za)


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
