"""The glass-bead rainbow, checked: the ring's radius against Descartes' ray,
its colours against Cauchy's index, the drawn ray against Snell's law, and the
light a bead sends back against Fresnel's formulas.

Geometry and the light of one reflection only: the colours on the screen
(``colour``) are not checked here.
"""

from __future__ import annotations

import math

from staunlabor.domain.checks import Case, Source
from staunlabor.domain.experiments import rainbow as engine

_DESCARTES = Source(
    cite="Wikipedia, “Rainbow”, §3.1 “Mathematical derivation”",
    url="https://en.wikipedia.org/wiki/Rainbow",
    quote="Given a spherical raindrop, and defining the perceived angle of the rainbow as 2φ, and the angle of the internal reflection as 2β, the angle of incidence of the Sun's rays with respect to the drop's surface normal is 2β − φ. Since the angle of refraction is β, Snell's law gives sin(2β − φ) = n sin β, where n = 1.333 is the refractive index of water (for green light). Solving for φ yields φ = 2β − arcsin(n sin β). … Solving for β yields β_max = arccos(2√(−1 + n²)/(√3 n)) ≈ 40.2°. Substituting back into the earlier equation for φ yields 2φ_max ≈ 42° as the radius angle of the rainbow.",
)
_ORDER = Source(
    cite="Wikipedia, “Rainbow”, §3 “Explanation”",
    url="https://en.wikipedia.org/wiki/Rainbow",
    quote="Due to this angle, blue is seen on the inside of the arc of the primary rainbow, and red on the outside.",
)
_CAUCHY = Source(
    cite="Wikipedia, “Cauchy’s equation”, §“Formulation”",
    url="https://en.wikipedia.org/wiki/Cauchy%27s_equation",
    quote="Usually, it is sufficient to use a two-term form of the equation: n(λ) = A + B/λ², where the coefficients A and B are determined specifically for this form of the equation.",
)
_FRESNEL = Source(
    cite="Wikipedia, “Fresnel equations”, §3 “Power (intensity) reflection and transmission coefficients”",
    url="https://en.wikipedia.org/wiki/Fresnel_equations",
    quote="Making this substitution, we obtain equations using the refractive indices: R_s = |(n₁ cos θ_i − n₂ cos θ_t)/(n₁ cos θ_i + n₂ cos θ_t)|² … R_p = |(n₁ cos θ_t − n₂ cos θ_i)/(n₁ cos θ_t + n₂ cos θ_i)|² … That means that there is an equal amount of power in the s and p polarizations, so that the effective reflectivity of the material is just the average of the two reflectivities",
)

#: The sodium line, where a bead's index is stated, and the ring's edges, nm.
SODIUM_NM = 589.3
RED_NM = 700.0
VIOLET_NM = 400.0

_GLASS = engine.Bead(index=1.52, dispersion_nm2=4200.0)
_WATER = engine.Bead(index=1.333, dispersion_nm2=3140.0)
#: Where the page's ray meets the bead when it opens: half its radius out.
_IMPACT = 0.5


def _bow_deg(n: float) -> float:
    """2φ_max by the source's route: β_max first, then φ = 2β − arcsin(n·sin β)."""
    beta = math.acos(2 * math.sqrt(n * n - 1) / (math.sqrt(3) * n))
    return math.degrees(2 * (2 * beta - math.asin(n * math.sin(beta))))


def _cauchy(bead: engine.Bead, nm: float) -> float:
    """n(λ) = A + B/λ², A such that n(589.3 nm) is the bead's n_D."""
    a = bead.index - bead.dispersion_nm2 / SODIUM_NM**2
    return a + bead.dispersion_nm2 / nm**2


def _width_hand() -> float:
    return _bow_deg(_cauchy(_GLASS, RED_NM)) - _bow_deg(_cauchy(_GLASS, VIOLET_NM))


def _ray_hand() -> float:
    """2φ = 2(2β − i) for the ray ``_IMPACT`` of the radius off centre:
    sin i = b, sin β = b/n."""
    n = _GLASS.index
    return math.degrees(2 * (2 * math.asin(_IMPACT / n) - math.asin(_IMPACT)))


def _ray_drawn() -> float:
    """The angle between the drawn ray as it leaves and the straight way back
    to the lamp (``-x``), counted as the page's θ."""
    out = engine.trace(_GLASS.index, _IMPACT).out
    return math.degrees(math.atan2(-out[1], -out[0]))


def _share(n: float, i: float) -> float:
    """One ray's light after in, one reflection and out: (1 − R)²·R for each
    polarisation, the two averaged; inside the same R, as the formulas are the
    same with the two media swapped."""
    t = math.asin(math.sin(i) / n)
    ci, ct = math.cos(i), math.cos(t)
    rs = ((ci - n * ct) / (ci + n * ct)) ** 2
    rp = ((ct - n * ci) / (ct + n * ci)) ** 2
    return 0.5 * ((1 - rs) ** 2 * rs + (1 - rp) ** 2 * rp)


def _reflected_hand(steps: int = 2000) -> float:
    """The share over the bead's face, by area: ∫ share · 2b db, with b = sin i
    so the grazing rays' √(1 − b²) does not spoil the sum; Simpson's rule."""
    n = _GLASS.index
    h = math.pi / 2 / steps

    def f(i: float) -> float:
        return _share(n, i) * 2 * math.sin(i) * math.cos(i)

    total = f(0.0) + f(math.pi / 2)
    total += sum((4 if k % 2 else 2) * f(k * h) for k in range(1, steps))
    return total * h / 3


def _setting(bead: engine.Bead, impact: float | None = None) -> dict[str, float | str]:
    """What the page's "Set it up" sets: the bead, and where the ray meets it."""
    out: dict[str, float | str] = {"index": bead.index, "dispersion_nm2": bead.dispersion_nm2}
    if impact is not None:
        out["impact"] = impact
    return out


CASES: tuple[Case, ...] = (
    Case(
        key="water",
        unit="°",
        expected=lambda: _bow_deg(_WATER.index),
        measured=lambda: engine.figures(_WATER).angle_deg,
        # The page takes i from cos²i = (n² − 1)/3, the source β; the same
        # point, so only rounding is left.
        tolerance=1e-12,
        sources=(_DESCARTES,),
        setting=_setting(_WATER),
    ),
    Case(
        key="colours",
        unit="°",
        expected=_width_hand,
        measured=lambda: engine.figures(_GLASS).width_deg,
        # A difference of two angles some 20° large: rounding, a little
        # enlarged.
        tolerance=1e-11,
        sources=(_DESCARTES, _ORDER, _CAUCHY),
        derived=True,
        setting=_setting(_GLASS),
    ),
    Case(
        key="drawn_ray",
        unit="°",
        expected=_ray_hand,
        measured=_ray_drawn,
        # The drawing traces the ray with vectors, the hand with angles.
        tolerance=1e-12,
        sources=(_DESCARTES,),
        setting=_setting(_GLASS, _IMPACT),
    ),
    Case(
        key="reflected",
        unit="",
        expected=_reflected_hand,
        measured=lambda: engine.figures(_GLASS).reflected,
        # The page sums 2000 rings of equal area at their middles; next to the
        # rim, where the grazing rays' light changes as √(1 − b²), that is
        # 6·10⁻⁶ high (20 000 rings: 7·10⁻⁸). Simpson in i is good to 10⁻¹¹.
        tolerance=2e-5,
        sources=(_FRESNEL,),
        derived=True,
        setting=_setting(_GLASS),
    ),
)
