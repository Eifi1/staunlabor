"""The double slit: light through two narrow slits makes bright and dark stripes, and light plus light gives dark.

The exhibit is a laser shining on two narrow slits close together, and a wall
behind them: on the wall, a row of bright and dark stripes. Cover one slit and
the stripes go; the light spreads out evenly — and where the two slits made
it dark, one slit alone makes it bright.

**Why.** Light is a wave. From each slit a wave goes out to every point of
the wall, and where the two arrive in step they add, where they arrive half a
wavelength apart they cancel: dark, though each alone would light the spot.
The paths differ by ``d·sin θ`` (``d`` the slits' spacing, ``θ`` the angle from
straight on), so the wall is bright where that is a whole number of
wavelengths, ``sin θ = k·λ/d``, the stripes on the wall about ``λ·L/d`` apart.

**The model** (Fraunhofer, the wall far away). Each slit of width ``a`` sends
``sinc(β)`` with ``β = π·a·sin θ/λ``, the two together ``2·sinc(β)·cos(α)``
with ``α = π·d·sin θ/λ``; the intensity is the square, relative to the middle
of the two-slit pattern: ``sinc²(β)·cos²(α)``, and with one slit covered
``sinc²(β)/4`` (half the wave, a quarter of the light). A point ``y`` on the
wall at ``L`` lies at ``sin θ = y/√(y² + L²)``. The laser's colour is its
wavelength's (``colour.matching``) at full saturation the screen allows,
scaled by the intensity; white light is the lamp's spectrum with each
wavelength's own pattern, by ``colour.seen``, so the middle stripe is white.

**What it leaves out.** The wall's nearness: Fraunhofer holds to a per cent of
the middle's brightness once ``L`` is more than :data:`FAR` times ``a²/λ``, the
slit's width, not its spacing, setting it (the spacing's own term is the same
for both slits and drops out of their difference) — 13 cm here,
and :attr:`SlitsFigures.near_m` for any build. Nearer, the page says so; it
named ``d²/λ`` and said nothing at its sliders' corners (the mathematics check,
2026-11-17); the laser beam's own width
and spread, so the stripes' brightness up and down the wall; the slits' edges
and thickness; light polarisation (the same for both slits).
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import dataclass

from staunlabor.domain.experiments.colour import WAVELENGTHS_NM, lamp, linear_rgb, matching, on_screen, seen

#: A red laser pointer's wavelength, nm.
LASER_NM = 650.0
#: The white lamp's glow.
LAMP_K = 3000.0


@dataclass(frozen=True)
class Slits:
    #: From the middle of one slit to the middle of the other.
    spacing_m: float = 0.25e-3
    #: Each slit's width.
    width_m: float = 0.05e-3
    #: From the slits to the wall.
    distance_m: float = 2.0

    def __post_init__(self) -> None:
        if not 0.02e-3 <= self.width_m <= 0.5e-3:
            raise ValueError("a slit is 0.02 to 0.5 mm wide")
        if not self.width_m < self.spacing_m <= 2e-3:
            raise ValueError("the slits are further apart than one is wide, and at most 2 mm")
        if not 0.2 <= self.distance_m <= 10:
            raise ValueError("the wall is 20 cm to 10 m from the slits")


def _sinc(x: float) -> float:
    return 1.0 if x == 0 else math.sin(x) / x


def intensity(slits: Slits, nm: float, y_m: float, both: bool = True) -> float:
    """The light at ``y_m`` on the wall, as a share of the middle of the
    two-slit pattern: ``sinc²(β)·cos²(α)``, one slit ``sinc²(β)/4``."""
    if not 380 <= nm <= 780:
        raise ValueError("visible light is 380 to 780 nm")
    s = y_m / math.hypot(y_m, slits.distance_m)
    lam = nm * 1e-9
    envelope = _sinc(math.pi * slits.width_m * s / lam) ** 2
    if not both:
        return envelope / 4
    return envelope * math.cos(math.pi * slits.spacing_m * s / lam) ** 2


def bright_m(slits: Slits, nm: float, k: int) -> float:
    """Where the ``k``-th bright stripe of the two lies on the wall: ``sin θ = k·λ/d``."""
    s = k * nm * 1e-9 / slits.spacing_m
    return slits.distance_m * s / math.sqrt(1 - s * s)


def dark_m(slits: Slits, nm: float, k: int) -> float:
    """Where the ``k``-th dark stripe (from 0, the first beside the middle)
    lies: ``sin θ = (k + ½)·λ/d``."""
    s = (k + 0.5) * nm * 1e-9 / slits.spacing_m
    return slits.distance_m * s / math.sqrt(1 - s * s)


def laser_colour(nm: float) -> tuple[float, float, float]:
    """The laser's light as the screen's linear red, green and blue, its
    brightest channel full: its wavelength's colour, saturated as far as the
    screen goes."""
    rgb = linear_rgb(matching(nm))
    top = max(rgb)
    r, g, b = (c / top for c in rgb)
    return r, g, b


def laser_pattern(slits: Slits, nm: float, ys: Sequence[float], both: bool = True) -> list[tuple[float, float, float]]:
    """The wall at ``ys`` under the laser, as the screen shows it."""
    colour = laser_colour(nm)
    return [on_screen([c * intensity(slits, nm, y, both) for c in colour]) for y in ys]


def white_pattern(slits: Slits, ys: Sequence[float], both: bool = True) -> list[tuple[float, float, float]]:
    """The wall at ``ys`` under white light: every wavelength its own
    pattern, the middle the lamp's white."""
    source = lamp(LAMP_K)
    return [on_screen(seen(source, [intensity(slits, nm, y, both) for nm in WAVELENGTHS_NM])) for y in ys]


@dataclass(frozen=True)
class SlitsFigures:
    #: Between neighbouring bright stripes near the middle, m: ``λ·L/d``.
    spacing_m: float
    #: The first dark stripe beside the middle, and the edge of the middle
    #: band one slit lights (its first dark, ``sin θ = λ/a``), m.
    first_dark_m: float
    envelope_m: float
    #: Bright stripes within that middle band.
    stripes: int
    #: At the pair's first dark stripe, one slit alone gives this share of its own middle.
    one_slit_there: float
    #: From how far the formula holds to a per cent: :data:`FAR` times ``a²/λ``.
    near_m: float


#: How many times ``a²/λ`` away the wall must be for Fraunhofer to hold to a
#: per cent: a wave summed strip by strip on its own path (Fresnel's near field
#: included) is off the formula by about ``10·(a²/(λ·L))²`` of the middle.
FAR = 35.0


def figures(slits: Slits, nm: float) -> SlitsFigures:
    first_dark = dark_m(slits, nm, 0)
    s_env = nm * 1e-9 / slits.width_m
    beyond = math.ceil(slits.spacing_m / slits.width_m - 1e-9) - 1
    return SlitsFigures(
        spacing_m=nm * 1e-9 * slits.distance_m / slits.spacing_m,
        first_dark_m=first_dark,
        envelope_m=slits.distance_m * s_env / math.sqrt(1 - s_env * s_env),
        stripes=2 * beyond + 1,
        one_slit_there=4 * intensity(slits, nm, first_dark, both=False),
        near_m=FAR * slits.width_m**2 / (nm * 1e-9),
    )
