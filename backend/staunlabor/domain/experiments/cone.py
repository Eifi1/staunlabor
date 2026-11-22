"""The double cone that rolls uphill: rails rise, its centre falls.

The exhibit is two straight rails that spread apart in a V and rise as they
do, and a double cone — two cones base to base — laid across them at the
narrow, low end. Let go, it rolls by itself up to the wide, high end.

**The geometry.** The cone's radius shrinks from ``R`` at its middle by
``tan α`` for every metre along its axis (``α`` the angle between its surface
and its axis). Each rail rises by ``tan γ`` and spreads outward by ``tan β`` for
every metre along the centre line. Where the rails are wider apart, they hold
the cone further out, where it is thinner, so it sits lower between them. Lying
across the rails at ``x``, its axis is at

    z(x) = x·tan γ + c·r₀(x),   r₀(x) = R − (d₀ + x·tan β)·tan α

with ``d₀`` the rails' half-gap at the low end and ``c`` the exact contact's
factor (below). Both terms are straight lines in ``x``: the axis moves on a
straight line of slope ``m = tan γ − c·tan α·tan β``. It falls as the rails
rise — and the cone rolls "uphill" — exactly when ``m < 0``, which is the
textbook's ``tan γ < tan α·tan β``: at the boundary ``c`` is exactly 1.

**The exact contact.** A rail is a line that slopes and runs skew to the cone,
so it touches the cone a little off the point straight under the axis. Asking
where the line just grazes the solid cone gives a quadratic, and the axis
stands ``c·r₀`` above the rail, ``c = (√(sec²γ − k²) − k·tan γ)/(1 − k²)``,
``k = tan α·tan β`` (``sec γ`` for a cylinder on a sloping rail; 1.002 for the
default build, and exactly 1 where the axis runs level, the contact then
straight under it). The contact lies exactly square to the axis's path, so the
cone can roll on it without slipping: its spin is the axis's speed over the
distance ``ρ`` from the axis to the contact, which shrinks as the rails spread.

**The motion.** Rolling without slipping on a straight path, losing nothing:
``½·(1 + m²)·(M + I/ρ²)·ẋ² + M·g·m·x`` is constant, ``I = (3/10)·M·R²`` for two
solid cones. As ``ρ`` shrinks, more of the energy goes into spin, so the cone
rolls up quickly and slows near the top though it is still falling. Stepped by
the block's Runge–Kutta; the ends of the rails are stops that hold it.

**What it leaves out.** Rolling resistance and the rails' own thickness; the
small wobble a real cone makes if laid on askew.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from staunlabor.domain.experiments.constants import G
from staunlabor.domain.experiments.numerics import MAX_DURATION_S, STEP_S, rk4, sample_every

#: I/(M·R²) of a double cone, two solid cones base to base, about its axis.
SPIN_SHARE = 3 / 10

#: The rails must end this share of the cone's half-length short of its tips, or
#: it would be held by its points.
TIP_MARGIN = 0.9


@dataclass(frozen=True)
class DoubleCone:
    #: R: the radius at the middle, where the two cones meet.
    radius_m: float = 0.06
    #: α: the angle between the surface and the axis; tan α = R / half-length.
    cone_deg: float = 20.0

    def __post_init__(self) -> None:
        if not 0.01 <= self.radius_m <= 0.3:
            raise ValueError("the cone's radius lies between 1 and 30 cm")
        if not 5 <= self.cone_deg <= 45:
            raise ValueError("the cone's angle lies between 5° and 45°")

    @property
    def half_length_m(self) -> float:
        return self.radius_m / math.tan(math.radians(self.cone_deg))


@dataclass(frozen=True)
class Rails:
    #: β: each rail's angle to the centre line, seen from above.
    spread_deg: float = 20.0
    #: γ: how steeply they rise.
    slope_deg: float = 4.0
    #: d₀: each rail's distance from the centre line at the low end.
    start_half_gap_m: float = 0.03
    #: How far they run along the centre line, seen from above.
    length_m: float = 0.30

    def __post_init__(self) -> None:
        if not 2 <= self.spread_deg <= 45:
            raise ValueError("the rails spread at between 2° and 45°")
        if not 0 <= self.slope_deg <= 20:
            raise ValueError("the rails rise at between 0° and 20°")
        if self.start_half_gap_m < 0 or not self.length_m > 0:
            raise ValueError("the rails start some distance apart and run some way")


@dataclass(frozen=True)
class ConeExhibit:
    cone: DoubleCone = DoubleCone()
    rails: Rails = Rails()

    def __post_init__(self) -> None:
        widest = half_gap_m(self, self.rails.length_m)
        if widest >= TIP_MARGIN * self.cone.half_length_m:
            raise ValueError(
                f"the rails end {widest * 100:.1f} cm from the middle, too near the cone's tips at "
                f"{self.cone.half_length_m * 100:.1f} cm: it would fall through"
            )
        if self.rails.start_half_gap_m >= self.cone.half_length_m:
            raise ValueError("the rails start wider apart than the cone is long")


def half_gap_m(ex: ConeExhibit, x: float) -> float:
    """Each rail's distance from the centre line at ``x``."""
    return ex.rails.start_half_gap_m + x * math.tan(math.radians(ex.rails.spread_deg))


def steepness(ex: ConeExhibit) -> float:
    """``k = tan α·tan β``: how much lower the cone sits per metre along the rails,
    from their spread alone."""
    return math.tan(math.radians(ex.cone.cone_deg)) * math.tan(math.radians(ex.rails.spread_deg))


def _contact(k: float, slope_deg: float) -> float:
    tg = math.tan(math.radians(slope_deg))
    sec2 = 1 + tg * tg
    return (math.sqrt(sec2 - k * k) - k * tg) / (1 - k * k)


def contact_factor(ex: ConeExhibit) -> float:
    """``c``: how far above the rail the axis stands, in radii under the axis."""
    return _contact(steepness(ex), ex.rails.slope_deg)


def axis_slope(ex: ConeExhibit) -> float:
    """``m``: how much the axis rises per metre along the rails; negative is the
    cone rolling up them."""
    return math.tan(math.radians(ex.rails.slope_deg)) - contact_factor(ex) * steepness(ex)


def radius_under_m(ex: ConeExhibit, x: float) -> float:
    """``r₀``: the cone's radius straight under its axis where the rails are at ``x``."""
    return ex.cone.radius_m - half_gap_m(ex, x) * math.tan(math.radians(ex.cone.cone_deg))


def axis_height_m(ex: ConeExhibit, x: float) -> float:
    """The axis's height above the rails' low end, the cone lying across them at ``x``."""
    return x * math.tan(math.radians(ex.rails.slope_deg)) + contact_factor(ex) * radius_under_m(ex, x)


def rail_height_m(ex: ConeExhibit, x: float) -> float:
    return x * math.tan(math.radians(ex.rails.slope_deg))


def _offsets(ex: ConeExhibit) -> tuple[float, float]:
    """Where the contact lies from the axis, per metre of ``r₀``: ``s*`` along the
    rails and ``ρ`` from the axis."""
    k = steepness(ex)
    tg = math.tan(math.radians(ex.rails.slope_deg))
    c = contact_factor(ex)
    along = (c * tg - k) / (1 + tg * tg - k * k)
    return along, 1 - along * k


def contact_radius_m(ex: ConeExhibit, x: float) -> float:
    """``ρ``: the distance from the axis to the contact, the radius the cone rolls on."""
    return _offsets(ex)[1] * radius_under_m(ex, x)


def on_rails_m(ex: ConeExhibit) -> tuple[float, float]:
    """From where to where along the rails the cone's contact lies on them. It
    lies ``s*·r₀`` along the rails from the axis's place, behind it where the
    cone rolls up: laid at the very end, it would touch the rails before they
    begin and rest on their ends instead, which the model does not have — 3 mm
    of the default build's 30 cm, 84 mm of a 10 cm rail at the sliders' corner
    (the mathematics check, 2026-11-17). So it is laid, and stopped, where its
    contact lies on them: ``x + s*·r₀(x)`` between 0 and the rails' length."""
    along, share = _offsets(ex)
    start = radius_under_m(ex, 0.0)
    length = ex.rails.length_m
    return max(0.0, -along * start / share), min(length, (length - along * start) / share)


def threshold_deg(ex: ConeExhibit) -> float:
    """The slope ``γ*`` at which the axis runs level: steeper rails, and the cone
    rolls down them; flatter, up them. It is the textbook's ``tan γ* = tan α·tan β``
    exactly: with the axis level the contact lies straight under it, ``c = 1``."""
    return math.degrees(math.atan(steepness(ex)))


def acceleration(ex: ConeExhibit, x: float, v: float) -> float:
    """``ẍ`` from Lagrange's equation for ``½·A(x)·ẋ² + g·m·x`` (per kilogram),
    ``A = (1 + m²)·(1 + (3/10)·R²/ρ²)``."""
    m = axis_slope(ex)
    _, share = _offsets(ex)
    rho = contact_radius_m(ex, x)
    spin = SPIN_SHARE * ex.cone.radius_m**2
    a = (1 + m * m) * (1 + spin / (rho * rho))
    # dρ/dx = −share·tan α·tan β: the contact moves to a thinner part of the cone.
    da = (1 + m * m) * spin * (-2 / rho**3) * (-share * steepness(ex))
    return -(G * m + 0.5 * da * v * v) / a


@dataclass(frozen=True)
class ConeRun:
    t: tuple[float, ...]
    x_m: tuple[float, ...]
    axis_m: tuple[float, ...]
    #: The axis's speed along its path.
    speed_m_s: tuple[float, ...]
    spin_rev_s: tuple[float, ...]
    #: When it reached an end of the rails, or ``None``.
    stopped_at_s: float | None
    final_x_m: float


def roll(ex: ConeExhibit, start_x_m: float, duration_s: float, step_s: float = STEP_S) -> ConeRun:
    """The cone let go from rest at ``start_x_m``, until it reaches an end of the
    rails, where a stop holds it, or ``duration_s`` is up."""
    if not 0 < step_s <= 0.01:
        raise ValueError("the step lies between 0 and 10 ms")
    if not 0 < duration_s <= MAX_DURATION_S:
        raise ValueError(f"a roll lasts more than nothing and at most {MAX_DURATION_S:g} s")
    low, high = on_rails_m(ex)
    if not low - 1e-12 <= start_x_m <= high + 1e-12:
        raise ValueError("the cone is laid on the rails, where its contact lies on them")
    m = axis_slope(ex)
    along = math.sqrt(1 + m * m)

    def f(_t: float, y: tuple[float, ...]) -> tuple[float, ...]:
        return (y[1], acceleration(ex, y[0], y[1]))

    y: tuple[float, ...] = (start_x_m, 0.0)
    steps = round(duration_s / step_s)
    every = sample_every(step_s)
    ts: list[float] = []
    xs: list[float] = []
    axes: list[float] = []
    speeds: list[float] = []
    spins: list[float] = []
    stopped: float | None = None
    for i in range(steps + 1):
        t = i * step_s
        if i % every == 0 or stopped is not None:
            speed = abs(y[1]) * along
            ts.append(t)
            xs.append(y[0])
            axes.append(axis_height_m(ex, y[0]))
            speeds.append(speed)
            spins.append(speed / contact_radius_m(ex, y[0]) / (2 * math.pi))
        if stopped is not None or i == steps:
            break
        y = rk4(f, t, y, step_s)
        # The stops at the ends hold it: it arrives, and stays — where its
        # contact leaves the rails.
        if y[0] >= high or y[0] <= low:
            y = (min(max(y[0], low), high), 0.0)
            stopped = t + step_s
    return ConeRun(
        t=tuple(ts),
        x_m=tuple(xs),
        axis_m=tuple(axes),
        speed_m_s=tuple(speeds),
        spin_rev_s=tuple(spins),
        stopped_at_s=stopped,
        final_x_m=xs[-1],
    )


def start_for(ex: ConeExhibit) -> float:
    """Where the cone is laid to roll: at the low end when its axis falls along
    the rails, at the high end when it rises, and at the low end when it runs
    level (where it stays) — each where its contact first lies on them."""
    low, high = on_rails_m(ex)
    return high if axis_slope(ex) > 0 else low
