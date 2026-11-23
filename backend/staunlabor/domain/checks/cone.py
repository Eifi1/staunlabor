"""The double cone, checked: its exact contact against Gandhi and Efthimiou's
analysis of the ascending double cone, which finds the contact from the cone's
surface normal, a way the engine does not take: the axis's straight path, the
boundary between rolling up and down, and the speed of the roll from their
energy.

Their angles are measured in the rails' own plane, the engine's from above;
the step from one to the other is in each case's words. Their printed
intercept of the path, b = L·tan ψ·(cos α − tan α·sin α), is not used: their
own Eqs. (7) and (8) with Z = a·cos α give L·tan ψ/cos α, which the engine
and a scan of the rail agree with.
"""

from __future__ import annotations

import math

from staunlabor.domain.checks import Case, Source
from staunlabor.domain.checks._hand import G, bisect
from staunlabor.domain.experiments import cone as engine

_SITS = Source(
    cite="S. C. Gandhi, C. J. Efthimiou, “The ascending double cone: a closer look at a familiar demonstration”, "
    "Eur. J. Phys. 26 (2005) 681, arXiv:physics/0501135, §2, Eq. (4)",
    url="https://arxiv.org/abs/physics/0501135",
    quote="sin α = tan φ tan ψ",
)
_PATH = Source(
    cite="S. C. Gandhi, C. J. Efthimiou, arXiv:physics/0501135, §4, Eq. (9) and after",
    url="https://arxiv.org/abs/physics/0501135",
    quote="Equation (9) implies that the CM is constrained to move along a line on the zy-plane with slope λ and "
    "intercept b. … the CM’s path is a line declined (inclined if α < θ) below the horizontal by an angle α − θ",
)
_UP = Source(
    cite="S. C. Gandhi, C. J. Efthimiou, arXiv:physics/0501135, §5, before Eq. (11)",
    url="https://arxiv.org/abs/physics/0501135",
    quote="For the cone to roll up the ramp, the potential must be a decreasing function of q, that is sin(α − θ) > 0.",
)
_ENERGY = Source(
    cite="S. C. Gandhi, C. J. Efthimiou, arXiv:physics/0501135, §4, Eqs. (7) and (8), and §5, Eq. (12)",
    url="https://arxiv.org/abs/physics/0501135",
    quote="Z_CM = a cos α. … a = L tan ψ − Y_P sin α. … Y_P = (Y_CM − L tan ψ sin α)/cos² α. … "
    "E = T + U = ½[m + I/(L tan ψ − q tan α)²] q̇² − mgq sin(α − θ).",
)
_CONE = Source(
    cite="Wikipedia, “List of moments of inertia”, right circular cone (citing Beer, Johnston, Vector Mechanics for "
    "Engineers, 4th ed., p. 911)",
    url="https://en.wikipedia.org/wiki/List_of_moments_of_inertia",
    quote="I_z = 3/10 mr²",
)

#: The page's build: R 6 cm, α 20°, rails at β 20°, rising at γ 4°, 30 cm
#: long from 6 cm apart.
_DEFAULT = engine.ConeExhibit()


def _angles(ex: engine.ConeExhibit) -> tuple[float, float]:
    """The paper's angles from the engine's: its ψ is the cone's α; its ramp's
    θ is the rails' rise γ, both rails rising alike; and a rail that spreads by
    tan β per metre seen from above spreads by tan β·cos γ per metre along the
    ramp, so tan φ = tan β·cos γ. Returns θ and the paper's α, the tilt of the
    line from the axis to the contact: sin α = tan φ·tan ψ."""
    theta = math.radians(ex.rails.slope_deg)
    tan_psi = math.tan(math.radians(ex.cone.cone_deg))
    tan_phi = math.tan(math.radians(ex.rails.spread_deg)) * math.cos(theta)
    return theta, math.asin(tan_phi * tan_psi)


def _fall_hand_cm(ex: engine.ConeExhibit) -> float:
    """The axis's path is declined by α − θ: over the rails' length seen from
    above it falls length·tan(α − θ)."""
    theta, alpha = _angles(ex)
    return ex.rails.length_m * math.tan(alpha - theta) * 100


def _fall_engine_cm(ex: engine.ConeExhibit) -> float:
    """What the page's trick says: the axis at the low end less the axis at the
    high end."""
    return (engine.axis_height_m(ex, 0.0) - engine.axis_height_m(ex, ex.rails.length_m)) * 100


def _level_engine_deg(ex: engine.ConeExhibit) -> float:
    """The rails' rise at which the engine's axis runs level, by halving on the
    sign of its fall: between rails that keep it rolling up and rails that
    send it down."""

    def rolls_up(slope_deg: float) -> bool:
        return _fall_engine_cm(engine.ConeExhibit(cone=ex.cone, rails=_rails(ex, slope_deg=slope_deg))) > 0

    return bisect(rolls_up, 0.0, 15.0, 60)


def _rails(ex: engine.ConeExhibit, slope_deg: float) -> engine.Rails:
    r = ex.rails
    return engine.Rails(
        spread_deg=r.spread_deg, slope_deg=slope_deg, start_half_gap_m=r.start_half_gap_m, length_m=r.length_m
    )


def _level_hand_deg(ex: engine.ConeExhibit) -> float:
    """sin(α − θ) = 0: α = θ, so sin θ = tan β·cos θ·tan ψ, tan θ = tan ψ·tan β."""
    return math.degrees(
        math.atan(math.tan(math.radians(ex.cone.cone_deg)) * math.tan(math.radians(ex.rails.spread_deg)))
    )


#: The roll is read one second after it is let go, halfway up.
_AFTER_S = 1.0


def _roll(ex: engine.ConeExhibit) -> engine.ConeRun:
    return engine.roll(ex, engine.start_for(ex), _AFTER_S)


def _paper_state(ex: engine.ConeExhibit, x: float) -> tuple[float, float]:
    """At the axis's place ``x`` (from above, from the rails' low end): its
    height above the rails' low end and the radius ``a`` the cone rolls on.

    In the paper's ramp frame, Y along the ramp from the rails' vertex and Z
    across it: a = L·tan ψ − Y_P·sin α and Y_P = (Y − L·tan ψ·sin α)/cos²α give
    a = (R − Y·sin α)/cos²α, and Z = a·cos α (R = L·tan ψ). The axis's place
    from above is then x − vertex = Y·cos θ − Z·sin θ, solved for Y."""
    theta, alpha = _angles(ex)
    big_r = ex.cone.radius_m
    # The ramp's vertex, where the rails would meet, seen from above.
    vertex = -ex.rails.start_half_gap_m / math.tan(math.radians(ex.rails.spread_deg))
    y = (x - vertex + big_r * math.sin(theta) / math.cos(alpha)) / (math.cos(theta) + math.sin(theta) * math.tan(alpha))
    a = (big_r - y * math.sin(alpha)) / math.cos(alpha) ** 2
    z = a * math.cos(alpha)
    height = y * math.sin(theta) + z * math.cos(theta) + vertex * math.tan(theta)
    return height, a


def _speed_hand_cm_s(ex: engine.ConeExhibit) -> float:
    """From rest at the start to where the roll is after a second, by the
    paper's energy: ½(1 + I/(M a²))·v² = g·(fall of the axis), I/M = (3/10)R²."""
    run = _roll(ex)
    start_height, _ = _paper_state(ex, run.x_m[0])
    height, a = _paper_state(ex, run.final_x_m)
    inertia = 3 / 10 * ex.cone.radius_m**2
    return math.sqrt(2 * G * (start_height - height) / (1 + inertia / a**2)) * 100


def _setting(ex: engine.ConeExhibit) -> dict[str, float | str]:
    """What the page's "Set it up" sets: the build's six sliders."""
    return {
        "radius_m": ex.cone.radius_m,
        "cone_deg": ex.cone.cone_deg,
        "spread_deg": ex.rails.spread_deg,
        "slope_deg": ex.rails.slope_deg,
        "start_half_gap_m": ex.rails.start_half_gap_m,
        "length_m": ex.rails.length_m,
    }


CASES: tuple[Case, ...] = (
    Case(
        key="axis_path",
        unit="cm",
        expected=lambda: _fall_hand_cm(_DEFAULT),
        measured=lambda: _fall_engine_cm(_DEFAULT),
        tolerance=1e-12,
        sources=(_SITS, _PATH),
        derived=True,
        setting=_setting(_DEFAULT),
    ),
    Case(
        key="threshold",
        unit="°",
        expected=lambda: _level_hand_deg(_DEFAULT),
        measured=lambda: _level_engine_deg(_DEFAULT),
        tolerance=1e-12,
        sources=(_UP, _SITS),
        derived=True,
        setting=_setting(_DEFAULT),
    ),
    Case(
        key="speed",
        unit="cm/s",
        expected=lambda: _speed_hand_cm_s(_DEFAULT),
        measured=lambda: _roll(_DEFAULT).speed_m_s[-1] * 100,
        tolerance=1e-9,
        sources=(_ENERGY, _CONE),
        derived=True,
        setting=_setting(_DEFAULT),
    ),
)
