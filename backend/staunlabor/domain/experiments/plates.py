"""The falling plates: metal plates that fall slowly between magnets, though none of them is magnetic.

The exhibit is a tall column of magnets in two rows, north and south taking
turns along it, with a narrow gap between the rows. Plates of copper, of
aluminium and of aluminium cut by slots into teeth are dropped into the gap at
the top. The whole plates sink through it slowly, as if through honey; the
slotted one falls much faster; and none of them is pulled towards the magnets
or pushed away — they are not magnetic at all.

**Why they are slow.** As a plate falls, the field in every part of it changes:
north passes, then south. A changing field drives currents round in the metal
(eddy currents), and the magnets push on those currents against the motion:
the faster the plate, the stronger the currents and the harder the push. It
falls until the push carries its weight, at a steady speed, and the energy it
loses on the way warms it. Slots cut the paths the currents need to turn
round, so most of the brake is gone.

**The model.** The plate is thin and slow: its currents flow in its plane and
their own field is small beside the magnets' (the plate's speed against
``w = 2/(μ₀·σ·d)``). The magnets' field across the gap is ``B₀·cos(k·z)``
along the fall, ``k = 2π/λ``, and the same across the plate's width. In a
piece of metal ``W`` wide and ``h`` high, the currents are then exact:
``J = σ·(−∇φ + v×B)``, the charge ``φ`` it gathers solves Laplace's equation,
and no current leaves the piece by its edges; with the field written as a
cosine series over the piece, ``B = b₀ + Σ b_m·cos(m·π·y/h)``, the uniform
part ``b₀`` drives nothing (a rod in a steady field only charges its ends)
and each other term drives a loop whose strength is known in closed form. The
brake is the heat the currents make, over the speed: ``c = σ·d·(h/2)·Σ b_m²·
(W − (2/q_m)·tanh(q_m·W/2))``, ``q_m = m·π/h``. A whole plate is one piece; a
slotted one is its teeth, each a piece of its own. As the plate passes the
poles the brake ripples a little (five in a hundred for the exhibit's whole
plates, nothing for its slotted one, whose teeth sit a quarter of a period
apart); the fall uses its mean, and then ``m·dv/dt = m·g − c̄·v`` has the exact
solution ``v = v_E·(1 − e^{−t/τ})``, ``τ = m/c̄``, ``v_E = m·g/c̄``.

**What follows.** The plate's weight and its brake both grow with its
thickness, so the thickness does not matter: a plate twice as thick falls
just as fast, ``v_E = ρ·g/(σ·⟨B²⟩·η)``, with ``η`` the share of an endless
sheet's brake the edges and slots leave (85 in a hundred for the exhibit's
whole plates). Its size matters only through ``η``: a wider plate loses less
to its edges and falls a little slower. Copper conducts 1.6 times as well as
aluminium but is 3.3 times as heavy: the aluminium plate falls at half the
copper's speed.

**What it leaves out.** The field's true form: a cosine along the fall,
uniform across the plate, its strength an assumption (0.15 T at the
exhibit's, as for ferrite blocks across a gap of a centimetre or so); the
fringe at the column's ends; the eddy currents' own field (under four
hundredths of the magnets' for the exhibit's plates); the spine that holds a slotted
plate's teeth together, which is counted as cut too; air, so the plastic
plate falls freely; the guides' friction. The plates are 10 cm wide, 12 cm
high and 3 mm thick, of the pure metals.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Literal

G = 9.80665
#: The magnetic constant, in V·s/(A·m).
MU0 = 4e-7 * math.pi

Material = Literal["copper", "aluminium", "brass", "plastic"]

#: Conductivity (S/m) and density (kg/m³) at room temperature: the pure
#: metals', brass's and an acrylic sheet's, which conducts nothing.
MATERIALS: dict[str, tuple[float, float]] = {
    "copper": (5.96e7, 8960.0),
    "aluminium": (3.77e7, 2700.0),
    "brass": (1.5e7, 8500.0),
    "plastic": (0.0, 1180.0),
}

#: Terms of the edges' sum past the ones that matter (``_edge_terms``): they
#: fall as the fifth power of their number, so the ones left out change the
#: brake by less than 1e-8 of itself anywhere in the bounds.
EDGE_TERMS = 400

#: Phases a period is sampled at for the brake's ripple.
RIPPLE_SAMPLES = 64

#: A tooth count is a floor of a quotient that is a whole number when the
#: slots fit the plate exactly: this keeps 11.999… from losing a tooth.
_FIT = 1e-9


@dataclass(frozen=True)
class MagnetColumn:
    #: The field's amplitude in the gap, in T.
    field_t: float = 0.15
    #: One north and one south magnet: the field's period along the fall, in m.
    pitch_m: float = 0.04
    #: How far a plate's top edge falls between the magnets, in m.
    drop_m: float = 0.9

    def __post_init__(self) -> None:
        if not 0 < self.field_t <= 1.5:
            raise ValueError("a gap's field lies above nothing and at most 1.5 T")
        if not 0.005 <= self.pitch_m <= 0.5:
            raise ValueError("a pair of magnets is 5 mm to 50 cm tall")
        if not 0.05 <= self.drop_m <= 5:
            raise ValueError("a column is 5 cm to 5 m tall")


@dataclass(frozen=True)
class Plate:
    material: Material = "aluminium"
    thickness_m: float = 0.003
    #: 0 for a whole plate; else the height of each tooth the slots leave.
    tooth_m: float = 0.0
    width_m: float = 0.10
    height_m: float = 0.12
    #: The slots' own width.
    slot_m: float = 0.002

    def __post_init__(self) -> None:
        if self.material not in MATERIALS:
            raise ValueError(f"a plate is of {', '.join(MATERIALS)}")
        if not 0 < self.thickness_m <= 0.05:
            raise ValueError("a plate is more than nothing and at most 5 cm thick")
        if not 0.005 <= self.width_m <= 0.5 or not 0.005 <= self.height_m <= 0.5:
            raise ValueError("a plate is 5 mm to 50 cm wide and high")
        if not 0 < self.slot_m <= 0.02:
            raise ValueError("a slot is more than nothing and at most 2 cm wide")
        if self.tooth_m != 0 and not 0.001 <= self.tooth_m <= self.height_m:
            raise ValueError("a tooth is at least 1 mm high and no higher than the plate")


#: The exhibit's four: copper, aluminium, aluminium cut into teeth 8 mm high,
#: and plastic.
EXHIBIT_PLATES = (
    Plate("copper"),
    Plate("aluminium"),
    Plate("aluminium", tooth_m=0.008),
    Plate("plastic"),
)


def teeth(plate: Plate) -> tuple[int, float]:
    """``(n, h)``: the pieces the current flows in. A whole plate is one, its
    height ``h``; slots leave ``n`` teeth, each ``h`` the tooth's height."""
    if plate.tooth_m == 0:
        return 1, plate.height_m
    count = math.floor((plate.height_m + plate.slot_m) / (plate.tooth_m + plate.slot_m) + _FIT)
    return count, plate.tooth_m


def mass_kg(plate: Plate) -> float:
    """The metal's: the teeth's, the slots being cut out."""
    n, h = teeth(plate)
    return MATERIALS[plate.material][1] * plate.thickness_m * plate.width_m * n * h


def _sinc(u: float) -> float:
    return 1.0 if u == 0 else math.sin(u) / u


def _versinc(u: float) -> float:
    """``(1 − cos u)/u``, written so as not to cancel near zero."""
    return 0.0 if u == 0 else 2 * math.sin(u / 2) ** 2 / u


def _overlap(k: float, q: float, h: float) -> tuple[float, float]:
    """``(∫₀ʰ cos(k·y)·cos(q·y) dy, ∫₀ʰ sin(k·y)·cos(q·y) dy)``, also where
    ``q`` meets ``k``."""
    a, b = (k + q) * h, (k - q) * h
    return h / 2 * (_sinc(a) + _sinc(b)), h / 2 * (_versinc(a) + _versinc(b))


def _edge_mode(k: float, h: float, width: float, m: int) -> tuple[float, float, float]:
    """``(C_m, S_m, tanh(q·W/2)/q)`` for the piece's ``m``-th cosine."""
    q = m * math.pi / h
    c, s = _overlap(k, q, h)
    return c, s, math.tanh(q * width / 2) / q


def _edge_terms(column: MagnetColumn, h: float, width: float) -> int:
    """How many cosines over a piece ``h`` high and ``width`` wide: forty times
    as many as reach the field's own (``q = k``, the ``2h/λ``-th) and the
    width's (``q·W ≈ 1``, a narrow piece's, whose brake its edges nearly
    cancel), and ``EDGE_TERMS`` more."""
    return EDGE_TERMS + 40 * (math.ceil(2 * h / column.pitch_m) + math.ceil(h / width))


def _piece_brake(column: MagnetColumn, sigma_d: float, width: float, h: float, phase: float) -> float:
    """One piece's brake (N·s/m) with the field ``B₀·cos(k·y + phase)`` over
    it, ``y`` from its lower edge: ``σ·d·[W·(∫B² − h·b₀²) − Σ h·b_m²·tanh(q_m·W/2)/q_m]``."""
    k = 2 * math.pi / column.pitch_m
    b0 = column.field_t
    cos_p, sin_p = math.cos(phase), math.sin(phase)
    squared = b0 * b0 * (h / 2 + (math.sin(2 * k * h + 2 * phase) - math.sin(2 * phase)) / (4 * k))
    c0, s0 = _overlap(k, 0.0, h)
    mean = b0 / h * (cos_p * c0 - sin_p * s0)
    edges = 0.0
    for m in range(1, _edge_terms(column, h, width) + 1):
        c, s, reach = _edge_mode(k, h, width, m)
        bm = 2 * b0 / h * (cos_p * c - sin_p * s)
        edges += h * bm * bm * reach
    return sigma_d * (width * (squared - h * mean * mean) - edges)


def _piece_mean_brake(column: MagnetColumn, sigma_d: float, width: float, h: float) -> float:
    """The same, over all phases: ``⟨∫B²⟩ = B₀²·h/2``, ``⟨b_m²⟩ = (2B₀/h)²·(C_m² + S_m²)/2``."""
    k = 2 * math.pi / column.pitch_m
    b0 = column.field_t
    c0, s0 = _overlap(k, 0.0, h)
    sheet = b0 * b0 * h / 2 - b0 * b0 * (c0 * c0 + s0 * s0) / (2 * h)
    edges = 0.0
    for m in range(1, _edge_terms(column, h, width) + 1):
        c, s, reach = _edge_mode(k, h, width, m)
        edges += h * (2 * b0 / h) ** 2 * (c * c + s * s) / 2 * reach
    return sigma_d * (width * sheet - edges)


def _phases(column: MagnetColumn, plate: Plate, fallen_m: float) -> list[float]:
    """Each tooth's phase, lowest first, its top edge ``fallen_m`` below the
    column's top: the field there is ``B₀·cos(k·z)``, ``z`` the depth."""
    k = 2 * math.pi / column.pitch_m
    n, h = teeth(plate)
    return [k * (i * (h + plate.slot_m) - fallen_m - plate.height_m) for i in range(n)]


def brake_at(column: MagnetColumn, plate: Plate, fallen_m: float) -> float:
    """The brake ``c`` (N·s/m, the push over the speed) with the plate's top
    edge ``fallen_m`` below the column's top."""
    sigma = MATERIALS[plate.material][0]
    _, h = teeth(plate)
    return sum(
        _piece_brake(column, sigma * plate.thickness_m, plate.width_m, h, p) for p in _phases(column, plate, fallen_m)
    )


def brake(column: MagnetColumn, plate: Plate) -> float:
    """The brake's mean as the plate passes the poles, ``c̄``, in N·s/m."""
    sigma = MATERIALS[plate.material][0]
    n, h = teeth(plate)
    return n * _piece_mean_brake(column, sigma * plate.thickness_m, plate.width_m, h)


def motion(column: MagnetColumn, plate: Plate, t_s: float) -> tuple[float, float]:
    """``(s, v)``: how far the plate has fallen (m) and how fast (m/s), ``t_s``
    after it is let go at rest. From the mean brake; with none, it falls freely."""
    if t_s < 0:
        raise ValueError("the plate is asked about from the moment it is let go")
    c = brake(column, plate)
    if c == 0:
        return G * t_s * t_s / 2, G * t_s
    tau = mass_kg(plate) / c
    terminal = G * tau
    gained = -math.expm1(-t_s / tau)
    return terminal * (t_s - tau * gained), terminal * gained


def fall_time_s(column: MagnetColumn, plate: Plate) -> float:
    """How long the plate takes through the column. Newton's method from
    ``drop/v_E + τ``, past the root, where the fall's convexity brings it
    down to the root without overshooting."""
    c = brake(column, plate)
    if c == 0:
        return math.sqrt(2 * column.drop_m / G)
    tau = mass_kg(plate) / c
    terminal = G * tau
    t = column.drop_m / terminal + tau
    for _ in range(100):
        gained = -math.expm1(-t / tau)
        step = (terminal * (t - tau * gained) - column.drop_m) / (terminal * gained)
        t -= step
        if abs(step) <= 1e-14 * t:
            break
    return t


@dataclass(frozen=True)
class PlateFigures:
    teeth: int
    mass_kg: float
    #: The mean brake, ``c̄``, in N·s/m.
    brake_n_s_per_m: float
    fall_time_s: float
    #: The brake over an endless sheet's of the same metal (the share the
    #: edges and the slots leave); ``None`` for a plate that conducts nothing.
    share: float | None
    terminal_m_s: float | None
    time_constant_s: float | None
    #: At the terminal speed, the power the brake turns into heat: the
    #: weight's, ``m·g·v_E``, in W.
    heat_w: float | None
    #: The brake's swing as the plate passes the poles, over its mean.
    ripple: float | None
    #: The terminal speed over ``w = 2/(μ₀·σ·d)``: the eddy currents' own
    #: field against the magnets'.
    reaction: float | None


def _ripple(samples: list[float], mean: float) -> float:
    """The brake's swing over its mean; a swing under a part in 10¹² is the
    sum's rounding, not a ripple, and is none."""
    spread = max(samples) - min(samples)
    return spread / mean if spread > 1e-12 * mean else 0.0


def figures(column: MagnetColumn, plate: Plate) -> PlateFigures:
    sigma, _ = MATERIALS[plate.material]
    n, h = teeth(plate)
    m = mass_kg(plate)
    c = brake(column, plate)
    fall = fall_time_s(column, plate)
    if c == 0:
        return PlateFigures(n, m, 0.0, fall, None, None, None, None, None, None)
    sheet = sigma * plate.thickness_m * plate.width_m * n * h * column.field_t**2 / 2
    terminal = m * G / c
    samples = [brake_at(column, plate, column.pitch_m * j / RIPPLE_SAMPLES) for j in range(RIPPLE_SAMPLES)]
    return PlateFigures(
        teeth=n,
        mass_kg=m,
        brake_n_s_per_m=c,
        fall_time_s=fall,
        share=c / sheet,
        terminal_m_s=terminal,
        time_constant_s=m / c,
        heat_w=m * G * terminal,
        ripple=_ripple(samples, c),
        reaction=terminal * MU0 * sigma * plate.thickness_m / 2,
    )


def stream(
    column: MagnetColumn, plate: Plate, fallen_m: float, speed_m_s: float, x_m: float, y_m: float, terms: int
) -> float:
    """The eddy currents' stream function ``ψ`` (A/m) at ``(x, y)`` on the
    plate, ``x`` from its middle, ``y`` up from its lower edge, its top edge
    ``fallen_m`` down and falling at ``speed_m_s``, from the first ``terms``
    loops: ``J = (∂ψ/∂y, −∂ψ/∂x)``, so the currents run along the lines of
    equal ``ψ``, anticlockwise round a high one. Zero in a slot and on every edge."""
    sigma, _ = MATERIALS[plate.material]
    n, h = teeth(plate)
    half = plate.width_m / 2
    pitch = h + plate.slot_m
    tooth = min(n - 1, max(0, math.floor(y_m / pitch)))
    local = y_m - tooth * pitch
    if not (0 <= local <= h and abs(x_m) <= half) or sigma == 0:
        return 0.0
    k = 2 * math.pi / column.pitch_m
    phase = _phases(column, plate, fallen_m)[tooth]
    cos_p, sin_p = math.cos(phase), math.sin(phase)
    total = 0.0
    for m in range(1, terms + 1):
        q = m * math.pi / h
        c, s = _overlap(k, q, h)
        bm = 2 * column.field_t / h * (cos_p * c - sin_p * s)
        # cosh(q·x)/cosh(q·W/2), written so a narrow tooth's steep loops do not overflow.
        edge = math.exp(q * (abs(x_m) - half)) * (1 + math.exp(-2 * q * abs(x_m))) / (1 + math.exp(-2 * q * half))
        total -= sigma * speed_m_s * bm * math.sin(q * local) / q * (1 - edge)
    return total
