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

**What it leaves out.** Light scattered more than once (in a cloudier tube,
and near the horizon, it whitens the side light); the particles' own size
past the Rayleigh limit (milk's fat drops scatter nearly white); the angle of
scattering (only the brightness depends on it); the lamp's light spreading in
the tube; for the sky, ozone's absorption (which keeps the twilight sky
overhead blue), dust and haze (which redden the sunset further), and the
earth's curvature beyond the air mass.
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


def sun_light(height_deg: float) -> list[float]:
    """The sun's light at the ground, per wavelength, as a share of its light above the air."""
    m = air_mass(height_deg)
    return [math.exp(-m * scattering(AIR_DEPTH, nm)) for nm in WAVELENGTHS_NM]


def scattered_down(tau: float, m: float) -> float:
    """``(e^{−τ} − e^{−m·τ})/(m − 1)``, written so that it holds at ``m = 1``
    too (``τ·e^{−τ}``) and loses nothing near it."""
    if m == 1:
        return tau * math.exp(-tau)
    return -math.exp(-tau) * math.expm1(-(m - 1) * tau) / (m - 1)


def sky_light(height_deg: float) -> list[float]:
    """The sky straight overhead, per wavelength: sunlight scattered once on
    its way down, ``(e^{−τ} − e^{−m·τ})/(m − 1)``."""
    m = air_mass(height_deg)
    return [scattered_down(scattering(AIR_DEPTH, nm), m) for nm in WAVELENGTHS_NM]


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
