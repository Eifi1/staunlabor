"""The light in the water jet, checked: the angle beyond which the page keeps
the light inside against the critical angle, the light it lets out against
Snell's law and Fresnel's formulas, and where its jet meets the basin against
Torricelli's speed and a stone's fall.

What is measured is what the page draws: the engine's ``reflectance``, which
decides at every hit whether light gets out, and the first ray of a steeply
tilted laser as ``trace`` follows it. The jet's axis and its normal at the hit
are found here by hand, by halving, not by the engine's Newton steps.
"""

from __future__ import annotations

import math

from staunlabor.domain.checks import Case, Source
from staunlabor.domain.checks._hand import G, bisect
from staunlabor.domain.experiments import jet as engine

_CRITICAL = Source(
    cite="Wikipedia, “Total internal reflection”, §“Critical angle”",
    url="https://en.wikipedia.org/wiki/Total_internal_reflection",
    quote="For light waves incident from an “internal” medium with a single refractive index n1, to an “external” "
    "medium with a single refractive index n2, the critical angle is given by θc=arcsin(n2/n1) and is defined if "
    "n2 ≤ n1. … According to Eq. (4), for incidence from water (n1 ≈ 1.333) to air (n2 ≈ 1), we have θc ≈ 48.6°",
)
_SNELL = Source(
    cite="Wikipedia, “Snell's law”",
    url="https://en.wikipedia.org/wiki/Snell%27s_law",
    quote="The law states that, for a given pair of media, the ratio of the sines of angle of incidence (θ1) and "
    "angle of refraction (θ2) is equal to the refractive index of the second medium with regard to the first "
    "(n2,1) which is equal to the ratio of the refractive indices (n2/n1) of the two media",
)
_FRESNEL = Source(
    cite="Wikipedia, “Fresnel equations”, §“Power (intensity) reflection and transmission coefficients”",
    url="https://en.wikipedia.org/wiki/Fresnel_equations",
    quote="Making this substitution, we obtain equations using the refractive indices: R_s = |(n₁ cos θ_i − n₂ cos "
    "θ_t)/(n₁ cos θ_i + n₂ cos θ_t)|² … R_p = |(n₁ cos θ_t − n₂ cos θ_i)/(n₁ cos θ_t + n₂ cos θ_i)|² … As a "
    "consequence of conservation of energy, one can find the transmitted power (or more correctly, irradiance: "
    "power per unit area) simply as the portion of the incident power that isn't reflected … That means that "
    "there is an equal amount of power in the s and p polarizations, so that the effective reflectivity of the "
    "material is just the average of the two reflectivities",
)
_TORRICELLI = Source(
    cite="Wikipedia, “Torricelli's law”",
    url="https://en.wikipedia.org/wiki/Torricelli%27s_law",
    quote="The law states that the speed v of efflux of a fluid through a sharp-edged hole in the wall of the tank "
    "filled to a height h above the hole is the same as the speed that a body would acquire in falling freely "
    "from a height h, v = √(2gh)",
)
_FALL = Source(
    cite="Wikipedia, “Projectile motion”, §“Time of flight or total time of the whole journey”",
    url="https://en.wikipedia.org/wiki/Projectile_motion",
    quote="If vy0=0 e. g. for an object dropped from (vertical) rest at a height y0 and free-falling under gravity, "
    "the time of flight becomes, t = √(2y0/g). This result is independent of any initial horizontal velocity",
)

_JET = engine.Jet()
#: The laser tilted past the straight jet's limit (90° − 48.6°): the first hit
#: lets light out.
_TILT_DEG = 45.0


def _switch_deg(n: float) -> float:
    """The smallest angle from the normal at which the page reflects all the
    light, found by halving between 30° and 70°."""

    def lets_out(deg: float) -> bool:
        return engine.reflectance(n, math.cos(math.radians(deg))) < 1

    return bisect(lets_out, 30.0, 70.0, 80)


def _normal_by_hand(x: float, y: float) -> tuple[float, float]:
    """The axis ``y = −x²·g/(2v²)``, ``v = √(2gh)``: its point nearest
    ``(x, y)``, where the distance's slope ``(u − x) + (y + c·u²)·2c·u``
    changes sign (halved from the hole to the hit), and its normal there, up."""
    v2 = 2 * G * _JET.level_m
    c = G / (2 * v2)

    def falling(u: float) -> bool:
        return (u - x) + (y + c * u * u) * 2 * c * u < 0

    u = bisect(falling, 0.0, x + 1.0, 200)
    norm = math.hypot(2 * c * u, 1.0)
    return 2 * c * u / norm, 1 / norm


def _first_escape() -> tuple[float, float, engine.Escape]:
    """The middle ray's first hit, as drawn: its incidence by hand (the drawn
    way in against the normal found by hand, outwards) and what the page lets out
    there."""
    ray = engine.trace(_JET, 0.0, math.radians(_TILT_DEG))
    x, y = ray.xs[1], ray.ys[1]
    dx, dy = x - ray.xs[0], y - ray.ys[0]
    length = math.hypot(dx, dy)
    dx, dy = dx / length, dy / length
    nx, ny = _normal_by_hand(x, y)
    if dx * nx + dy * ny < 0:
        nx, ny = -nx, -ny
    escape = ray.escapes[0]
    return nx, ny, escape


def _incidence() -> float:
    nx, ny, _ = _first_escape()
    ray = engine.trace(_JET, 0.0, math.radians(_TILT_DEG))
    dx, dy = ray.xs[1] - ray.xs[0], ray.ys[1] - ray.ys[0]
    return math.acos((dx * nx + dy * ny) / math.hypot(dx, dy))


def _refracted_by_hand() -> float:
    """Snell: sin θ₂ = (n₁/n₂)·sin θ₁, from water (n₁) into air (n₂ = 1)."""
    return math.degrees(math.asin(_JET.index * math.sin(_incidence())))


def _refracted_drawn() -> float:
    """The angle between the drawn escaping ray and the edge's normal."""
    nx, ny, escape = _first_escape()
    ox, oy = escape.out
    return math.degrees(math.atan2(abs(ox * ny - oy * nx), ox * nx + oy * ny))


def _let_out_by_hand() -> float:
    """1 − (R_s + R_p)/2 with n₁ the liquid's index, n₂ = 1."""
    n1, n2 = _JET.index, 1.0
    ti = _incidence()
    tt = math.asin(n1 * math.sin(ti) / n2)
    ci, ct = math.cos(ti), math.cos(tt)
    rs = ((n1 * ci - n2 * ct) / (n1 * ci + n2 * ct)) ** 2
    rp = ((n1 * ct - n2 * ci) / (n1 * ct + n2 * ci)) ** 2
    return 1 - (rs + rp) / 2


def _landing_by_hand() -> float:
    """v = √(2gh) level out of the hole, t = √(2H/g) to fall H, x = v·t."""
    return math.sqrt(2 * G * _JET.level_m) * math.sqrt(2 * _JET.drop_m / G)


def _setting(tilt_deg: float) -> dict[str, float | str]:
    """What the page's "Set it up" sets: the exhibit's jet and the laser's tilt."""
    return {
        "level_m": _JET.level_m,
        "hole_m": _JET.hole_m,
        "drop_m": _JET.drop_m,
        "index": _JET.index,
        "tilt_deg": tilt_deg,
    }


CASES: tuple[Case, ...] = (
    Case(
        key="critical",
        unit="°",
        expected=lambda: math.degrees(math.asin(1 / _JET.index)),
        measured=lambda: _switch_deg(_JET.index),
        # Halved 80 times between 30° and 70°: to the last bits of a cosine.
        tolerance=1e-12,
        sources=(_CRITICAL,),
        setting=_setting(0.0),
    ),
    Case(
        key="snell",
        unit="°",
        expected=_refracted_by_hand,
        measured=_refracted_drawn,
        # The page finds the axis's nearest point by Newton's method, the hand
        # by halving: the same point to rounding, which Snell's law enlarges
        # some 2.5 times this near the critical angle.
        tolerance=1e-12,
        sources=(_SNELL,),
        setting=_setting(_TILT_DEG),
    ),
    Case(
        key="fresnel",
        unit="",
        expected=_let_out_by_hand,
        measured=lambda: _first_escape()[2].share,
        # As above: the hit's angle, by hand and by the page, to rounding.
        tolerance=1e-12,
        sources=(_FRESNEL,),
        derived=True,
        setting=_setting(_TILT_DEG),
    ),
    Case(
        key="landing",
        unit="m",
        expected=_landing_by_hand,
        measured=lambda: engine.landing_m(_JET),
        # Two square roots taken in another order: rounding.
        tolerance=1e-14,
        sources=(_TORRICELLI, _FALL),
        derived=True,
        setting=_setting(0.0),
    ),
)
