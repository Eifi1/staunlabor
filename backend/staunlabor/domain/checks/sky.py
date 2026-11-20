"""Why the sky is blue, checked: the tube against Rayleigh's fourth power and
Beer and Lambert's account of the light, and the sky against the flat air's
secant, the light scattered once straight down, and the ozone shell's slant
path at the horizon.

The functions the page calls through its port (``simulate/sky.ts``): the
tube's figures and side and end light, the air mass, the sky overhead, the
ozone's air mass.
"""

from __future__ import annotations

import math

from staunlabor.domain.checks import Case, Source
from staunlabor.domain.experiments import sky as engine
from staunlabor.domain.experiments.colour import WAVELENGTHS_NM

ENGINE = ("sky",)

#: The air's optical depth straight up at 550 nm, as the engine takes it.
AIR_DEPTH = 0.097
#: The earth's radius and the ozone layer's height, km, as the engine takes them.
EARTH_KM = 6371.0
OZONE_KM = 22.0

_RAYLEIGH = Source(
    cite="Wikipedia, “Rayleigh scattering”, introduction",
    url="https://en.wikipedia.org/wiki/Rayleigh_scattering",
    quote="the amount of scattering is inversely proportional to the fourth power of the wavelength (e.g., a blue "
    "color is scattered much more than a red color as light propagates through air)",
)
_BEER = Source(
    cite="Wikipedia, “Beer–Lambert law”, §Derivation and §History",
    url="https://en.wikipedia.org/wiki/Beer%E2%80%93Lambert_law",
    quote="The radiant flux of the light that emerges from a slice is reduced, compared to that of the light that "
    "entered, by dΦe(z) = −μ(z)Φe(z) dz, where μ is the (Napierian) attenuation coefficient … As long as μ is "
    "constant along a distance d, the exponential attenuation law, I = I0 e^{−μd} follows from integration.",
)
_PLANE = Source(
    cite="Wikipedia, “Air mass (astronomy)”, §Plane-parallel atmosphere",
    url="https://en.wikipedia.org/wiki/Air_mass_(astronomy)",
    quote="When the zenith angle is small to moderate, a good approximation is given by assuming a homogeneous "
    "plane-parallel atmosphere (i.e., one in which density is constant and Earth's curvature is ignored). The air "
    "mass X then is simply the secant of the zenith angle z: X = sec z.",
)
_ONCE = Source(
    cite="C. Mobley, Ocean Optics Web Book, “The Single-Scattering Approximation”, Eq. (14) and (16)",
    url="https://www.oceanopticsbook.info/view/radiative-transfer-theory/level-2/the-single-scattering-approximation",
    quote="L_d^(SSA)(ζ, μ, ϕ) = ω_o E_d(0) β̃(μ_sw, ϕ_sw → μ, ϕ) · 1/(μ_sw − μ) · (e^{−ζ/μ_sw} − e^{−ζ/μ}) (14) "
    "if μ > 0 and μ ≠ μ_sw … It is easy to show that lim_{μ→μ_sw} 1/(μ_sw − μ) (e^{−ζ/μ_sw} − e^{−ζ/μ}) = "
    "ζ/μ_sw² e^{−ζ/μ_sw}",
)
_SHELL = Source(
    cite="Wikipedia, “Air mass (astronomy)”, §Variable-density atmosphere",
    url="https://en.wikipedia.org/wiki/Air_mass_(astronomy)",
    quote="The absolute air mass for the geometrical light path discussed above, becomes, for a sea-level observer, "
    "σ = ∫₀^{y_atm} ρ (R_E + y) dy / √(R_E² cos² z + 2 R_E y + y²)",
)

_TUBE = engine.Tube()
_BLUE = 450.0


def _blue_over_red() -> float:
    """Rayleigh's 1/λ⁴, blue at 450 nm against red at 650 nm, worked out here."""
    return (650.0 / 450.0) ** 4


def _light_accounted() -> float:
    """At 450 nm: what the side scatters along the whole tube, by Simpson's
    rule over 2000 slices, and what comes out at the end, as shares of the
    lamp's light. The page's side light is the light scattered at x, β·e^{−β·x}
    over β₅₅₀, less the crossing to the wall, e^{−β·a}: both are put back."""
    tube = _TUBE
    beta = tube.cloudiness_per_m * (550.0 / _BLUE) ** 4
    wall = math.exp(-beta * tube.radius_m)

    def scattered(x: float) -> float:
        return tube.cloudiness_per_m * engine.side_at(tube, x, _BLUE) / wall

    n = 2000
    h = tube.length_m / n
    side = sum((1 if j in (0, n) else 4 if j % 2 else 2) * scattered(j * h) for j in range(n + 1)) * h / 3
    return side + engine.end_light(tube)[WAVELENGTHS_NM.index(_BLUE)]


def _sky_noon_hand() -> float:
    """Mobley's limit for the sun straight overhead (μ_sw = 1), seen straight
    up at the bottom of the air (ζ = τ): τ·e^{−τ}, at 550 nm."""
    return AIR_DEPTH * math.exp(-AIR_DEPTH)


def _shell_hand(height_deg: float) -> float:
    """The variable-density air mass with all the ozone in a thin shell at
    y = H: the integrand at H, over its value straight up (z = 0)."""
    z = math.radians(90.0 - height_deg)
    r, y = EARTH_KM, OZONE_KM

    def path(zenith: float) -> float:
        return (r + y) / math.sqrt(r * r * math.cos(zenith) ** 2 + 2 * r * y + y * y)

    return path(z) / path(0.0)


CASES: tuple[Case, ...] = (
    Case(
        key="rayleigh",
        unit="",
        expected=_blue_over_red,
        measured=lambda: engine.figures(_TUBE).blue_over_red,
        tolerance=1e-12,
        sources=(_RAYLEIGH,),
        setting={"cloudiness_per_m": _TUBE.cloudiness_per_m, "length_m": _TUBE.length_m},
    ),
    Case(
        key="light_kept",
        unit="",
        expected=lambda: 1.0,
        measured=_light_accounted,
        # Simpson's rule over 2000 slices of a decay e^{−3.3·x}: under 10⁻¹³.
        tolerance=1e-11,
        sources=(_BEER,),
        derived=True,
        setting={"cloudiness_per_m": _TUBE.cloudiness_per_m, "length_m": _TUBE.length_m},
    ),
    Case(
        key="high_sun",
        unit="",
        expected=lambda: 1 / math.cos(math.radians(90.0 - 60.0)),
        measured=lambda: engine.air_mass(60.0),
        # Kasten and Young's fit, which the page uses, holds the earth's curve
        # and the bending of the light: at 60° it lies 6 · 10⁻⁴ under the flat
        # air's secant (straight up, 3 · 10⁻⁴: their fit gives 0.99971, not 1).
        tolerance=1e-3,
        sources=(_PLANE,),
        setting={"height_deg": 60.0},
    ),
    Case(
        key="sky_noon",
        unit="",
        expected=_sky_noon_hand,
        measured=lambda: engine.sky_light(90.0, ozone=False)[WAVELENGTHS_NM.index(550.0)],
        # Kasten and Young's air mass straight up is 0.99971, not 1: the page's
        # (e^{−τ} − e^{−m·τ})/(m − 1) lies (1 − m)·τ/2 = 1.4 · 10⁻⁵ above the limit.
        tolerance=3e-5,
        sources=(_ONCE,),
        derived=True,
        setting={"height_deg": 90.0, "ozone": "off"},
    ),
    Case(
        key="ozone_horizon",
        unit="",
        expected=lambda: _shell_hand(0.0),
        measured=lambda: engine.ozone_air_mass(0.0),
        tolerance=1e-12,
        sources=(_SHELL,),
        derived=True,
        setting={"height_deg": 0.0, "ozone": "on"},
    ),
)
