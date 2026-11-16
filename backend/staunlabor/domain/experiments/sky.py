"""Why the sky is blue: white light through a cloudy tube is blue from the side and orange at the end.

The exhibit is a long tube of water made faintly cloudy with particles far
smaller than the wavelength of light, and a white lamp shining in at one end.
From the side the tube glows blue near the lamp and turns white, yellow and
orange further along; looking in at the far end, the lamp is orange. The sky
is blue and the setting sun red for the same reason.

**Why.** Particles much smaller than the wavelength scatter light the more
strongly the shorter its wavelength, as ``1/λ⁴`` (Rayleigh): blue light
(450 nm) 4.4 times as strongly as red (650 nm). So the light scattered out to
the side is bluer than the lamp's, and the light that goes on is robbed of its
blue first: further along, what is left to scatter is yellower, and what
reaches the end, orange.

**The model.** The scattering coefficient ``β(λ) = β₅₅₀·(550 nm/λ)⁴``, the
tube's cloudiness given as ``β₅₅₀``, per metre. The lamp's light at ``x`` along
the tube is ``S(λ)·e^{−β(λ)·x}`` (Beer–Lambert). Seen from the side at ``x``:
what is scattered there, ``β(λ)·S(λ)·e^{−β(λ)·x}``, less what it loses
crossing the tube's radius to its wall, ``e^{−β(λ)·a}``; the angle it is
scattered at, the same for every wavelength, does not change its colour.
Seen at the end: ``S(λ)·e^{−β(λ)·L}``. The colours by ``colour``, relative to
the lamp's white.

**The sky** (the trick). The air is such a medium, its molecules far smaller
than the wavelength: straight up it lets through ``e^{−τ}`` with ``τ`` 0.097
at 550 nm, scaled as ``1/λ⁴``. The sun at height ``h`` shines through ``m``
times as much air (Kasten and Young's air mass, 38 at the horizon), so its
light is ``S·e^{−m·τ}``. The sky straight overhead is sunlight scattered once
at every height on its way down: in an air whose density falls the same way
for all wavelengths, ``S·(e^{−τ} − e^{−m·τ})/(m − 1)``, ``S·τ·e^{−τ}`` with the
sun overhead.

**Ozone.** The ozone layer, some 22 km up, takes light too, not by scattering
but by absorbing it, and most in the orange (its Chappuis band, at 600 nm):
``τ₃(λ) = σ(λ)·N``, ``σ`` its cross-section per molecule and ``N`` the
molecules over each square centimetre, 300 Dobson units of them. Straight up
that is 0.041 at 600 nm, little beside the air's; but the sun's light crosses
the layer as a thin shell, ``m₃ = 1/√(1 − (R/(R + H))²·cos² h)`` times
(``R`` the earth's radius, ``H`` the layer's height: 12 at the horizon, where
it takes 39 % of the orange). The layer lies above nearly all the air, so the
sun's light and the sky's, which is that light scattered further down, both
carry ``e^{−m₃·τ₃}``. With the sun low the air has scattered the blue out of
the sunlight on its long way, and what the sky overhead scatters down would be
nearly white; ozone takes its orange, and the sky stays blue. ``σ`` is the
measured one at 223 K, the layer's cold (Serdyuchenko, Gorshelev and others,
Atmos. Meas. Tech. 7, 2014, through the MPI-Mainz UV/VIS Spectral Atlas),
averaged over each 5 nm.

**What it leaves out.** Light scattered more than once (in a cloudier tube,
and near the horizon, it whitens the side light); the particles' own size
past the Rayleigh limit (milk's fat drops scatter nearly white); the angle of
scattering (only the brightness depends on it); the lamp's light spreading in
the tube; for the sky, dust and haze (which redden the sunset further), the
earth's curvature beyond the two air masses, the sun below the horizon (when
the sky overhead is lit only high up, through ever more ozone), and how much
ozone there is, which changes with the season and the place.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from staunlabor.domain.experiments.colour import WAVELENGTHS_NM, lamp, on_screen, seen, tristimulus

#: The wavelength the cloudiness is given at, nm.
REFERENCE_NM = 550.0
#: The colours the figures follow: blue and red.
BLUE_NM = 450.0
RED_NM = 650.0
#: The lamp at the tube: a bulb's glow. The sun: its surface's.
LAMP_K = 3000.0
SUN_K = 5778.0
#: The air's optical depth straight up at 550 nm (Rayleigh, sea level).
AIR_DEPTH = 0.097
#: Ozone's absorption cross-section at each of ``WAVELENGTHS_NM``, in units of
#: 10⁻²¹ cm² per molecule: Serdyuchenko et al. (2014) at 223 K, the mean over
#: each 5 nm around the wavelength (MPI-Mainz UV/VIS Spectral Atlas,
#: ``O3_Serdyuchenko(2014)_223K_213-1100nm(2013 version).txt``).
OZONE_CROSS_SECTION_E21_CM2 = (
    0.001542,
    0.002044,
    0.003397,
    0.006255,
    0.008918,
    0.01279,
    0.02263,
    0.02564,
    0.03458,
    0.06127,
    0.06242,
    0.08056,
    0.1303,
    0.1565,
    0.1737,
    0.2017,
    0.3467,
    0.3379,
    0.3785,
    0.4444,
    0.7188,
    0.7662,
    0.7692,
    0.8598,
    1.163,
    1.545,
    1.505,
    1.592,
    1.768,
    2.121,
    2.583,
    2.772,
    2.851,
    3.111,
    3.281,
    3.478,
    3.87,
    4.295,
    4.591,
    4.731,
    4.56,
    4.385,
    4.395,
    4.704,
    5.089,
    5.083,
    4.714,
    4.303,
    3.992,
    3.754,
    3.499,
    3.228,
    2.927,
    2.661,
    2.441,
    2.24,
    2.044,
    1.856,
    1.651,
    1.468,
    1.318,
    1.213,
    1.077,
    0.9374,
    0.8182,
    0.7395,
    0.6882,
    0.6624,
    0.5902,
    0.5066,
    0.4433,
    0.4101,
    0.4037,
    0.4268,
    0.4096,
    0.3145,
    0.2623,
    0.2408,
    0.2391,
    0.2787,
    0.3108,
)
#: Molecules over a square centimetre in one Dobson unit (0.01 mm of pure ozone
#: at 0 °C and one atmosphere).
DOBSON_PER_CM2 = 2.6867e16
#: A middling column of ozone, in Dobson units.
OZONE_COLUMN_DU = 300.0
#: The ozone layer's height, and the earth's radius, km.
OZONE_HEIGHT_KM = 22.0
EARTH_RADIUS_KM = 6371.0


@dataclass(frozen=True)
class Tube:
    length_m: float = 1.0
    #: Half its width: the side light crosses it to the wall.
    radius_m: float = 0.03
    #: ``β₅₅₀``, how much of the light at 550 nm is scattered out per metre.
    cloudiness_per_m: float = 1.5

    def __post_init__(self) -> None:
        if not 0.1 <= self.length_m <= 5:
            raise ValueError("a tube is 10 cm to 5 m long")
        if not 0.005 <= self.radius_m <= 0.2:
            raise ValueError("a tube is 1 to 40 cm wide")
        if not 0 < self.cloudiness_per_m <= 10:
            raise ValueError("a tube's cloudiness is more than nothing and at most 10 per metre")


def scattering(cloudiness: float, nm: float) -> float:
    """``β(λ) = β₅₅₀·(550/λ)⁴``, per metre (or, for the air, its optical depth)."""
    return cloudiness * (REFERENCE_NM / nm) ** 4


def side_at(tube: Tube, x_m: float, nm: float) -> float:
    """What the side of the tube sends at ``x_m`` along it at ``nm``, as a
    share of the lamp's light there times ``β₅₅₀``: ``(550/λ)⁴·e^{−β(λ)·(x + a)}``."""
    if not 0 <= x_m <= tube.length_m:
        raise ValueError("a place along the tube is between its ends")
    return scattering(1.0, nm) * math.exp(-scattering(tube.cloudiness_per_m, nm) * (x_m + tube.radius_m))


def side_light(tube: Tube, x_m: float) -> list[float]:
    """``side_at`` at every wavelength."""
    return [side_at(tube, x_m, nm) for nm in WAVELENGTHS_NM]


def end_light(tube: Tube) -> list[float]:
    """What comes out at the far end, per wavelength, as a share of the lamp's."""
    return [math.exp(-scattering(tube.cloudiness_per_m, nm) * tube.length_m) for nm in WAVELENGTHS_NM]


def air_mass(height_deg: float) -> float:
    """How many times the air straight up the sun's light crosses at
    ``height_deg`` above the horizon (Kasten and Young 1989)."""
    if not 0 <= height_deg <= 90:
        raise ValueError("the sun stands 0° to 90° above the horizon")
    return 1 / (math.sin(math.radians(height_deg)) + 0.50572 * (height_deg + 6.07995) ** -1.6364)


def ozone_air_mass(height_deg: float) -> float:
    """How many times the ozone straight up the sun's light crosses at
    ``height_deg``: a thin shell at ``OZONE_HEIGHT_KM``,
    ``1/√(1 − (R/(R + H))²·cos² h)``."""
    if not 0 <= height_deg <= 90:
        raise ValueError("the sun stands 0° to 90° above the horizon")
    ratio = EARTH_RADIUS_KM / (EARTH_RADIUS_KM + OZONE_HEIGHT_KM)
    return 1 / math.sqrt(1 - (ratio * math.cos(math.radians(height_deg))) ** 2)


def ozone_depth() -> list[float]:
    """Ozone's optical depth straight up at each wavelength, ``σ(λ)·N``."""
    column = OZONE_COLUMN_DU * DOBSON_PER_CM2
    return [sigma * 1e-21 * column for sigma in OZONE_CROSS_SECTION_E21_CM2]


def ozone_light(height_deg: float) -> list[float]:
    """What the ozone layer lets through of the sun's light at ``height_deg``, ``e^{−m₃·τ₃}``."""
    m = ozone_air_mass(height_deg)
    return [math.exp(-m * tau) for tau in ozone_depth()]


def sun_light(height_deg: float, *, ozone: bool = True) -> list[float]:
    """The sun's light at the ground, per wavelength, as a share of its light above the air."""
    m = air_mass(height_deg)
    air = [math.exp(-m * scattering(AIR_DEPTH, nm)) for nm in WAVELENGTHS_NM]
    return [a * o for a, o in zip(air, ozone_light(height_deg), strict=True)] if ozone else air


def scattered_down(tau: float, m: float) -> float:
    """``(e^{−τ} − e^{−m·τ})/(m − 1)``, written so that it holds at ``m = 1``
    too (``τ·e^{−τ}``) and loses nothing near it."""
    if m == 1:
        return tau * math.exp(-tau)
    return -math.exp(-tau) * math.expm1(-(m - 1) * tau) / (m - 1)


def sky_light(height_deg: float, *, ozone: bool = True) -> list[float]:
    """The sky straight overhead, per wavelength: sunlight scattered once on
    its way down, ``(e^{−τ} − e^{−m·τ})/(m − 1)``, the sunlight through the
    ozone above it first."""
    m = air_mass(height_deg)
    air = [scattered_down(scattering(AIR_DEPTH, nm), m) for nm in WAVELENGTHS_NM]
    return [a * o for a, o in zip(air, ozone_light(height_deg), strict=True)] if ozone else air


def hue(source: list[float], factors: list[float]) -> tuple[float, float, float]:
    """The colour of the light, as bright as the screen lets it be: seen
    relative to the source's white, scaled so its brightest channel is full."""
    rgb = seen(source, factors)
    top = max(rgb)
    if top <= 0:
        return 0.0, 0.0, 0.0
    return on_screen([c / top for c in rgb])


def brightness(source: list[float], factors: list[float]) -> float:
    """``Y`` of the light, as a share of the source's own."""
    return tristimulus([s * f for s, f in zip(source, factors, strict=True)])[1] / tristimulus(source)[1]


@dataclass(frozen=True)
class SkyFigures:
    #: How much more strongly blue light scatters than red.
    blue_over_red: float
    #: Of the lamp's light at the end: all of it (as bright), its blue, its red.
    end_brightness: float
    end_blue: float
    end_red: float
    #: How far along the tube half the blue light is gone, m.
    blue_half_m: float
    #: Past here the side light holds more red than blue, m: where its
    #: ``β·e^{−β·x}`` cross; past the tube's end if beyond its length.
    red_wins_m: float


def figures(tube: Tube) -> SkyFigures:
    blue = scattering(tube.cloudiness_per_m, BLUE_NM)
    red = scattering(tube.cloudiness_per_m, RED_NM)
    source = lamp(LAMP_K)
    return SkyFigures(
        blue_over_red=blue / red,
        end_brightness=brightness(source, end_light(tube)),
        end_blue=math.exp(-blue * tube.length_m),
        end_red=math.exp(-red * tube.length_m),
        blue_half_m=math.log(2) / blue,
        red_wins_m=math.log(blue / red) / (blue - red) - tube.radius_m,
    )
