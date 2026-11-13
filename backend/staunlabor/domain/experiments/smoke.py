"""The smoke ring: a press on a drum's skin, and a ring of smoke that flies — or does not.

The exhibit is a wide, flat drum filled with smoke, about 1.9 m across and
30 cm deep, its top a stretched skin with a 30 cm hole in the middle, rimmed by
a rigid ring the visitor presses down, at most 8 cm. The
air squeezed out of the drum leaves through the hole and rolls up into a ring
of smoke. Any ring is a success; but a press that is too fast gives none you
can see — too turbulent, the smoke mixes with the air and is gone — and so
does one that is too slow, while about half a second is best. Air comes back
in only when the skin is let go, and the smoke flows in slowly all the while.

**The press.** The ring pushes the skin down, the skin between it and the rim
taking the shape a stretched membrane has (``w ∝ ln(R/r)``), so the drum loses
the volume of an effective area ``A_eff`` times the press — about 0.8 m² for the
exhibit, eleven times the hole. The air leaves the hole at that ratio times the
speed of the hand (relative to the hole, which moves with the ring).

**The ring** is the slug model's (Didden 1979; Gharib, Rambod & Shariff 1998):
the air pushed out rolls up into a ring whose circulation is
``Γ = ½·∫u²·dt``, until the slug is four hole diameters long — the formation
number; what comes after is a trailing jet the ring does not take up. Its
radius is 0.6 hole diameters and its core a third of that, as measured rings
have them, and its speed is Saffman's for a ring of that core,
``U = Γ/(4πR)·(ln(8R/a) − ¼)``. Its Reynolds number ``Γ/ν`` says how turbulent
it is.

**Too fast, too slow.** Both the circulation and the speed grow in proportion
to how fast the hand presses, so the two failures sit at the two ends of one
scale:

* a ring whose Reynolds number is past :attr:`Room.turbulent_reynolds` is
  turbulent: it sheds its smoke into its wake and smears;
* a ring slower than :attr:`Room.draught_m_s`, the room's own air, is carried
  off before it has formed: the smoke drifts out as a puff.

Neither threshold is a textbook number for a ring this size in a museum hall:
both are set so that the window lies at about 0.2 to 1.2 seconds for a full
press, best at about half a second, as it is at the exhibit, and the page offers
them as sliders and says so.

**The hand** feels the skin's spring, ``2π·T/ln(R/a)`` for a tension ``T``
(assumed) times the press, and the air's back pressure ``½·ρ·u²`` over
``A_eff``, which grows with the square of the speed.

**The flight** (a time loop, RK4 at 10 ms): a laminar ring keeps its
circulation and slows only as viscosity thickens its core (``a² = a₀² + 4νt``);
a turbulent one widens as it goes, its impulse ``ρ·π·R²·Γ`` kept, so it slows
with the cube of its size. The room's air carries both sideways at the draught.

What it leaves out: the skin's own mass and ringing (at the exhibit no air is
seen coming back while pressing), the suction on release, the smoke's buoyancy, and the
detail of a turbulent ring's wake — the page draws the smoke spreading rather
than computing it.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from enum import StrEnum

RHO = 1.2
NU = 1.5e-5
#: A slug longer than this many hole diameters leaves the rest behind as a trailing jet.
FORMATION = 4.0
#: The ring's radius as a share of the hole's diameter, and its core's as a share of its radius.
RING_SHARE = 0.6
CORE_SHARE = 0.35
#: How fast a turbulent ring widens, metres of radius per metre flown.
TURBULENT_GROWTH = 0.01
#: The press is sampled at this step; the flight is stepped at its own.
STEP_S = 1e-3
FLIGHT_STEP_S = 0.01
SAMPLES_PER_S = 50
MAX_FLIGHT_S = 20.0
#: How far above the drum the hall goes.
CEILING_M = 3.0


@dataclass(frozen=True)
class Drum:
    diameter_m: float = 1.9
    depth_m: float = 0.30
    hole_m: float = 0.30
    #: The rigid ring round the hole that the visitor presses, its outer diameter.
    ring_m: float = 0.40
    #: The farthest the ring goes down.
    stroke_m: float = 0.08
    #: The skin's tension, N per metre of its edge: assumed.
    tension_n_m: float = 150.0

    def __post_init__(self) -> None:
        if not 0 < self.hole_m < self.ring_m < self.diameter_m:
            raise ValueError("the hole lies inside the ring, and the ring inside the drum")
        if not 0 < self.stroke_m < self.depth_m:
            raise ValueError("the skin goes down less than the drum is deep")
        if self.tension_n_m < 0:
            raise ValueError("a skin cannot be stretched by less than nothing")


@dataclass(frozen=True)
class Room:
    #: The room's own air: a ring slower than this is carried off before it forms.
    draught_m_s: float = 0.5
    #: Past this Reynolds number a ring is turbulent and smears its smoke.
    turbulent_reynolds: float = 1.6e5

    def __post_init__(self) -> None:
        if self.draught_m_s < 0 or self.turbulent_reynolds <= 0:
            raise ValueError("a draught and a threshold cannot be negative")


@dataclass(frozen=True)
class SmokeExhibit:
    drum: Drum = Drum()
    room: Room = Room()


@dataclass(frozen=True)
class Push:
    """A smooth press: down by ``depth_m`` over ``duration_s``, starting and
    ending at rest (half a cosine)."""

    depth_m: float = 0.08
    duration_s: float = 0.5


# ── the drum ─────────────────────────────────────────────────────────────────


def hole_area(drum: Drum) -> float:
    return math.pi * drum.hole_m**2 / 4


def effective_area(drum: Drum) -> float:
    """The volume the drum loses per metre of press: the ring's annulus, and
    the skin between the ring and the rim in a membrane's shape,
    ``w(r) = x·ln(R/r)/ln(R/a)``."""
    big = drum.diameter_m / 2
    a = drum.ring_m / 2
    h = drum.hole_m / 2
    skin = 2 * math.pi * ((big * big - a * a) / (4 * math.log(big / a)) - a * a / 2)
    return skin + math.pi * (a * a - h * h)


def stiffness_n_m(drum: Drum) -> float:
    """What the skin pushes back with per metre of press: ``2π·T/ln(R/a)``."""
    return 2 * math.pi * drum.tension_n_m / math.log(drum.diameter_m / drum.ring_m)


def push_samples(push: Push) -> tuple[tuple[float, ...], tuple[float, ...]]:
    """The press at :data:`STEP_S`: the times and how far down."""
    if push.duration_s <= 0 or push.depth_m <= 0:
        raise ValueError("a press takes some time and goes some way")
    n = max(1, round(push.duration_s / STEP_S))
    times = tuple(push.duration_s * k / n for k in range(n + 1))
    depths = tuple(push.depth_m / 2 * (1 - math.cos(math.pi * t / push.duration_s)) for t in times)
    return times, depths


# ── the ring ─────────────────────────────────────────────────────────────────


class Verdict(StrEnum):
    RING = "ring"
    TOO_FAST = "too_fast"
    TOO_SLOW = "too_slow"
    NONE = "none"


@dataclass(frozen=True)
class Ring:
    duration_s: float
    #: How long the slug pushed out is, and in hole diameters.
    stroke_m: float
    stroke_ratio: float
    #: Whether the slug was longer than the formation number allows a ring.
    trailing: bool
    circulation_m2_s: float
    reynolds: float
    radius_m: float
    speed_m_s: float
    peak_jet_m_s: float
    peak_force_n: float
    verdict: Verdict


def ring_of(exhibit: SmokeExhibit, times: tuple[float, ...], depths: tuple[float, ...]) -> Ring:
    """The ring a press makes, from the press as sampled — the page's own hand
    or :func:`push_samples`. Only air going out counts: a hand coming back up
    draws air in, which makes no ring."""
    if len(times) != len(depths) or len(times) < 2:
        raise ValueError("a press is at least two samples, a time for each")
    drum, room = exhibit.drum, exhibit.room
    if any(d < 0 or d > drum.stroke_m + 1e-9 for d in depths):
        raise ValueError(f"the ring goes down between 0 and {drum.stroke_m:g} m")
    ratio = effective_area(drum) / hole_area(drum)
    a_eff = effective_area(drum)
    spring = stiffness_n_m(drum)
    limit = FORMATION * drum.hole_m
    stroke = 0.0
    circulation = 0.0
    peak_jet = 0.0
    peak_force = spring * max(depths)
    for k in range(len(times) - 1):
        dt = times[k + 1] - times[k]
        if dt <= 0:
            raise ValueError("a press's times go forward")
        u = ratio * (depths[k + 1] - depths[k]) / dt
        if u <= 0:
            continue
        peak_jet = max(peak_jet, u)
        mid = (depths[k] + depths[k + 1]) / 2
        peak_force = max(peak_force, spring * mid + 0.5 * RHO * u * u * a_eff)
        if stroke < limit:
            share = min(1.0, (limit - stroke) / (u * dt))
            circulation += 0.5 * u * u * dt * share
        stroke += u * dt
    radius = RING_SHARE * drum.hole_m
    speed = ring_speed(circulation, radius, CORE_SHARE * radius)
    reynolds = circulation / NU
    if circulation <= 0:
        verdict = Verdict.NONE
    elif speed < room.draught_m_s:
        verdict = Verdict.TOO_SLOW
    elif reynolds > room.turbulent_reynolds:
        verdict = Verdict.TOO_FAST
    else:
        verdict = Verdict.RING
    return Ring(
        duration_s=times[-1] - times[0],
        stroke_m=stroke,
        stroke_ratio=stroke / drum.hole_m,
        trailing=stroke > limit,
        circulation_m2_s=circulation,
        reynolds=reynolds,
        radius_m=radius,
        speed_m_s=speed,
        peak_jet_m_s=peak_jet,
        peak_force_n=peak_force,
        verdict=verdict,
    )


def ring_speed(circulation: float, radius: float, core: float) -> float:
    """Saffman's speed for a ring of this core: ``Γ/(4πR)·(ln(8R/a) − ¼)``."""
    return circulation / (4 * math.pi * radius) * (math.log(8 * radius / core) - 0.25)


def ring_from_push(exhibit: SmokeExhibit, push: Push) -> Ring:
    if push.depth_m > exhibit.drum.stroke_m + 1e-12:
        raise ValueError(f"the ring goes down at most {exhibit.drum.stroke_m:g} m")
    return ring_of(exhibit, *push_samples(push))


# ── the flight ───────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class Flight:
    t: tuple[float, ...]
    #: Sideways with the room's draught, and up from the hole.
    x_m: tuple[float, ...]
    z_m: tuple[float, ...]
    radius_m: tuple[float, ...]
    speed_m_s: tuple[float, ...]


def flight(exhibit: SmokeExhibit, ring: Ring, duration_s: float) -> Flight:
    """The ring rising from the hole: a laminar one slowing as its core
    thickens, a turbulent one widening and slowing with the cube of its size,
    both carried sideways by the room's air; until the ceiling."""
    if not 0 < duration_s <= MAX_FLIGHT_S:
        raise ValueError(f"a flight lasts between 0 and {MAX_FLIGHT_S:g} s")
    turbulent = ring.verdict is Verdict.TOO_FAST
    g0, r0 = ring.circulation_m2_s, ring.radius_m
    a0 = CORE_SHARE * r0
    draught = exhibit.room.draught_m_s

    def speed(t: float, r: float) -> float:
        if turbulent:
            return ring_speed(g0 * (r0 / r) ** 2, r, CORE_SHARE * r)
        return ring_speed(g0, r0, math.sqrt(a0 * a0 + 4 * NU * t))

    def f(t: float, r: float) -> tuple[float, float]:
        u = speed(t, r)
        return u, TURBULENT_GROWTH * u if turbulent else 0.0

    steps = round(duration_s / FLIGHT_STEP_S)
    every = round(1 / (SAMPLES_PER_S * FLIGHT_STEP_S))
    h = FLIGHT_STEP_S
    z, r = 0.0, r0
    out: dict[str, list[float]] = {k: [] for k in ("t", "x", "z", "r", "u")}
    for n in range(steps + 1):
        t = n * h
        last = z >= CEILING_M or n == steps
        if n % every == 0 or last:
            out["t"].append(t)
            out["x"].append(draught * t)
            out["z"].append(z)
            out["r"].append(r)
            out["u"].append(speed(t, r))
        if last:
            break
        k1 = f(t, r)
        k2 = f(t + h / 2, r + h / 2 * k1[1])
        k3 = f(t + h / 2, r + h / 2 * k2[1])
        k4 = f(t + h, r + h * k3[1])
        z += h / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0])
        r += h / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1])
    return Flight(
        t=tuple(out["t"]),
        x_m=tuple(out["x"]),
        z_m=tuple(out["z"]),
        radius_m=tuple(out["r"]),
        speed_m_s=tuple(out["u"]),
    )


# ── the figures ──────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class PressPoint:
    duration_s: float
    reynolds: float
    speed_m_s: float
    peak_jet_m_s: float
    peak_force_n: float
    verdict: Verdict


@dataclass(frozen=True)
class SmokeFigures:
    effective_area_m2: float
    area_ratio: float
    #: A full press's slug, and how many hole diameters long it is.
    stroke_m: float
    stroke_ratio: float
    stiffness_n_m: float
    #: The window a full press makes a ring in, and its middle; none if there is no window.
    fastest_s: float | None
    slowest_s: float | None
    best_s: float | None
    best: Ring | None
    presses: tuple[PressPoint, ...]


def _crossing(exhibit: SmokeExhibit, depth: float, above: object) -> float | None:
    """The press duration at which a full press's ring stops being ``above``
    (a test on the ring), by halving on a log scale between 10 ms and 20 s."""
    lo, hi = math.log(0.01), math.log(MAX_FLIGHT_S)

    def test(log_t: float) -> bool:
        return bool(above(ring_from_push(exhibit, Push(depth, math.exp(log_t)))))  # type: ignore[operator]

    if test(lo) == test(hi):
        return None
    first = test(lo)
    for _ in range(50):
        mid = (lo + hi) / 2
        if test(mid) == first:
            lo = mid
        else:
            hi = mid
    return math.exp((lo + hi) / 2)


def figures(exhibit: SmokeExhibit, depth_m: float | None = None) -> SmokeFigures:
    drum, room = exhibit.drum, exhibit.room
    depth = drum.stroke_m if depth_m is None else depth_m
    fastest = _crossing(exhibit, depth, lambda ring: ring.reynolds > room.turbulent_reynolds)
    slowest = _crossing(exhibit, depth, lambda ring: ring.speed_m_s >= room.draught_m_s)
    best_s = math.sqrt(fastest * slowest) if fastest and slowest and fastest < slowest else None
    stroke = effective_area(drum) / hole_area(drum) * depth
    presses = []
    for i in range(31):
        duration = 0.05 * (60.0 ** (i / 30))
        ring = ring_from_push(exhibit, Push(depth, duration))
        presses.append(
            PressPoint(duration, ring.reynolds, ring.speed_m_s, ring.peak_jet_m_s, ring.peak_force_n, ring.verdict)
        )
    return SmokeFigures(
        effective_area_m2=effective_area(drum),
        area_ratio=effective_area(drum) / hole_area(drum),
        stroke_m=stroke,
        stroke_ratio=stroke / drum.hole_m,
        stiffness_n_m=stiffness_n_m(drum),
        fastest_s=fastest,
        slowest_s=slowest,
        best_s=best_s,
        best=ring_from_push(exhibit, Push(depth, best_s)) if best_s else None,
        presses=tuple(presses),
    )
