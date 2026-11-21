"""The water parabola, checked: the surface against the paraboloid that keeps
the water's volume, wet and dry, the mirror against the focus of a turning
liquid, and the spin-up, at the page's step, against Greenspan and Howard.
"""

from __future__ import annotations

import math

from staunlabor.domain.checks import Case, Source
from staunlabor.domain.experiments import parabola as engine

ENGINE = ("parabola",)

#: Standard gravity, as the engine takes it.
G = 9.80665
#: Turns a minute ↔ radians a second, as the page's slider counts.
RPM = 2 * math.pi / 60

_SURFACE = Source(
    cite="P. Menker, A. Herczyński, “Form of spinning liquids in diverse geometries”, Am. J. Phys. 88 (2020) 475, §II, Eq. (1) and (2)",
    url="https://arxiv.org/abs/2208.05059",
    quote="the surface will take the shape of the paraboloid of revolution given in cylindrical coordinates by z(r) = αr² + d, (1) where the rotation parameter α (steepness of the paraboloid) is defined as α = ω²/2g. (2)",
)
_CYLINDER = Source(
    cite="P. Menker, A. Herczyński, “Form of spinning liquids in diverse geometries”, Am. J. Phys. 88 (2020) 475, §III.A, Eq. (3)",
    url="https://arxiv.org/abs/2208.05059",
    quote="Equating these two expressions and writing out the rotational parameter α explicitly yield d = h − ω²R²/4g. (3)",
)
_CRITICAL = Source(
    cite="P. Menker, A. Herczyński, “Form of spinning liquids in diverse geometries”, Am. J. Phys. 88 (2020) 475, §III.A, Eq. (6)",
    url="https://arxiv.org/abs/2208.05059",
    quote="Now setting either d = 0 in Eq. (3), or δ = 0 in Eqs. (4) or (5), gives the critical angular speed as ω₁ = (2/R)√(hg). (6)",
)
_DRY = Source(
    cite="P. Menker, A. Herczyński, “Form of spinning liquids in diverse geometries”, Am. J. Phys. 88 (2020) 475, §III.A, Eq. (5)",
    url="https://arxiv.org/abs/2208.05059",
    quote="For the supercritical case, with a dry patch of radius δ at the bottom, d = −αδ² and the free surface is given by z = α(r² − δ²). … whose physically meaningful solution (positive and smaller than R) is δ = R√(1 − 2√(hg)/(Rω)). (5)",
)
_MIRROR = Source(
    cite="Wikipedia, “Liquid-mirror telescope”, §1.1 “Rotation speed and focal length”",
    url="https://en.wikipedia.org/wiki/Liquid-mirror_telescope",
    quote="Dividing this equation by the last one above it eliminates h and r and leads to 2fω² = g, which relates the angular velocity of the rotation of the liquid to the focal length of the paraboloid that is produced by the rotation.",
)
_DISH = Source(
    cite="Wikipedia, “Paraboloid”, §“Dimensions of a paraboloidal dish”",
    url="https://en.wikipedia.org/wiki/Paraboloid",
    quote="The dimensions of a symmetrical paraboloidal dish are related by the equation 4FD = R², where F is the focal length, D is the depth of the dish (measured along the axis of symmetry from the vertex to the plane of the rim), and R is the radius of the rim.",
)
_SPIN_UP = Source(
    cite="H. P. Greenspan, L. N. Howard, “On a time-dependent motion of a rotating fluid”, J. Fluid Mech. 17 (1963) 385, §3, p. 391–392, Eq. (3.21)",
    url="https://empslocal.ex.ac.uk/people/staff/gv219/classics.d/Greenspan_Howard63.pdf",
    quote="For large time, it follows from (3.18) and (3.19) that V_I ~ 1 − e^(−tR^(−½)) + O(t^(−½) e^(2it)) … the ‘spin-up time’ T (the time required for the interior flow to approach the final state of rigid rotation within e⁻¹) is R^½ in dimensionless units. Dimensionally T = (L²/νΩ)^½. (3.21)",
)

_VESSEL = engine.Vessel()


def _rate(rpm: int) -> float:
    """A rate the page's slider reaches: whole turns a minute, in rad/s."""
    return rpm * RPM


def _centre_hand(rate: float) -> float:
    """Eq. (3): the depth on the axis, d = h − ω²R²/(4g)."""
    v = _VESSEL
    return v.fill_m - rate * rate * v.radius_m**2 / (4 * G)


def _dry_rate_hand() -> float:
    """Eq. (6): ω₁ = (2/R)·√(h·g)."""
    v = _VESSEL
    return 2 / v.radius_m * math.sqrt(v.fill_m * G)


def _dry_rim_hand(rate: float) -> float:
    """The surface z = α(r² − δ²) at the wall, with δ from Eq. (5)."""
    v = _VESSEL
    alpha = rate * rate / (2 * G)
    delta = v.radius_m * math.sqrt(1 - 2 * math.sqrt(v.fill_m * G) / (v.radius_m * rate))
    return alpha * (v.radius_m**2 - delta**2)


def _focus_hand(rate: float) -> float:
    """2fω² = g."""
    return G / (2 * rate * rate)


def _spin_up(rate: float) -> tuple[float, float]:
    """The water switched on from rest to ``rate``, run at the page's step for
    about one spin-up time: ``(t, the water's rate over the vessel's)`` at the
    run's last sample, an even number of steps so the run samples it."""
    v = _VESSEL
    tau = v.fill_m / math.sqrt(engine.NU * rate)
    pair = 2 * engine.SPIN_STEP_S
    run = engine.spin(v, rate, round(tau / pair) * pair, 0.0, engine.SPIN_STEP_S)
    return run.t[-1], run.water_rate[-1] / rate


def _spin_up_hand(rate: float) -> float:
    """1 − e^(−t/τ), τ = h/√(ν·Ω): Greenspan and Howard's with L = h."""
    v = _VESSEL
    t, _ = _spin_up(rate)
    tau = v.fill_m / math.sqrt(engine.NU * rate)
    return 1 - math.exp(-t / tau)


def _setting(rpm: int, water: str = "turning") -> dict[str, float | str]:
    """What the page's "Set it up" sets: the vessel, the turntable's rate, and
    the water: turning with the table as on the page, or at rest for the
    spin-up, which the page's own controls cannot give with the table running."""
    return {
        "radius_m": _VESSEL.radius_m,
        "height_m": _VESSEL.height_m,
        "fill_m": _VESSEL.fill_m,
        "rate_rad_s": _rate(rpm),
        "water": water,
    }


#: Where the page starts; well short of the dry middle.
_START = 90
#: Past the dry middle (126 a minute), short of spilling (189).
_DRY_RPM = 160
#: One turn in 8.6 s: the focus some 9 m up.
_MIRROR_RPM = 7

CASES: tuple[Case, ...] = (
    Case(
        key="centre",
        unit="cm",
        expected=lambda: _centre_hand(_rate(_START)) * 100,
        measured=lambda: engine.surface(_VESSEL, _rate(_START)).centre_m * 100,
        tolerance=1e-12,
        sources=(_SURFACE, _CYLINDER),
        setting=_setting(_START),
    ),
    Case(
        key="dry_rate",
        unit="1/s",
        expected=_dry_rate_hand,
        measured=lambda: engine.dry_rate(_VESSEL),
        tolerance=1e-12,
        sources=(_CRITICAL,),
        setting=_setting(126),
    ),
    Case(
        key="dry_rim",
        unit="cm",
        expected=lambda: _dry_rim_hand(_rate(_DRY_RPM)) * 100,
        measured=lambda: engine.surface(_VESSEL, _rate(_DRY_RPM)).rim_m * 100,
        # The engine's R·ω·√(h/g) and the source's route through δ differ in
        # rounding only.
        tolerance=1e-12,
        sources=(_DRY, _SURFACE),
        derived=True,
        setting=_setting(_DRY_RPM),
    ),
    Case(
        key="mirror",
        unit="m",
        expected=lambda: _focus_hand(_rate(_MIRROR_RPM)),
        measured=lambda: engine.surface(_VESSEL, _rate(_MIRROR_RPM)).focus_m or 0.0,
        tolerance=1e-12,
        sources=(_MIRROR, _SURFACE, _DISH),
        setting=_setting(_MIRROR_RPM),
    ),
    Case(
        key="spin_up",
        unit="",
        expected=lambda: _spin_up_hand(_rate(_START)),
        measured=lambda: _spin_up(_rate(_START))[1],
        # Runge–Kutta at 10 ms against a spin-up of 33 s: each step is off by
        # (h/τ)⁵/120, 10⁻¹⁹; what is left is rounding.
        tolerance=1e-12,
        sources=(_SPIN_UP,),
        derived=True,
        setting=_setting(_START, "rest"),
    ),
)
