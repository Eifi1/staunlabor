"""Maxwell's wheel: a heavy wheel that rolls down its strings and climbs them again.

The exhibit is a heavy wheel on a thin axle hanging from two strings wound round
the axle. Let go, it unwinds, slowly; at the bottom it turns round and winds
itself back up, nearly to where it started — a large yo-yo.

**Rolling.** The strings come off the axle (radius ``r``) without slipping, so
the wheel turns at ``ω = v/r`` while its centre moves at ``v``. With
``k = I/(M·r²)`` — ``I = ½·M·R²`` for a solid disc, ``M·R²`` for a ring — the
fall is uniformly accelerated at ``a = g/(1 + k)`` and the strings pull
``M·(g − a)``, nearly the whole weight: almost all of the energy goes into the
spin, ``k/(1 + k)`` of it, which is why the wheel falls so slowly.

**Losses while rolling.** The strings bend round the axle and rub; the model
lets that cost a torque of ``c·T·r``, a share ``c`` of the strings' own. It
opposes the spin both ways, so the wheel falls at ``a↓ = g/(1 + k/(1 − c))`` and
is slowed on the way up at ``a↑ = g/(1 + k/(1 + c))``: each climb reaches
``a↓/a↑`` of the height before, about ``(1 − c)/(1 + c)``.

**The turn-round.** When the strings run out, the wheel is still falling at
``v`` and spinning at ``v/r``. The strings stop the fall by stretching, a spring
of stiffness ``s`` (both together), and throw the wheel back up at ``v``; the
spin goes on through the jerk, and the strings wind on from the other side.
They run out already stretched by the rolling pull ``M·(g − a↓)``, so only
``a↓`` is left for the jerk to catch: ``z'' = −a↓ − w²·z``. It lasts
``(2π − 2·atan(v·w/a↓))/w``, ``w = √(s/M)``, nearly half a swing, and the
strings pull up to ``M·g + s·A``, ``A = √((a↓/w²)² + (v/w)²)`` — several times
the weight. The first version let them run out slack, and their pull fell to
nothing at the jerk's start and end (the mathematics check, 2026-11-17).
That peak is the stiffness's: a stiffer string, a shorter jerk and a higher
peak. The jerk itself loses nothing in the model; the wheel's spin, not its
fall, carries it round.

**What it leaves out.** The axle's own spin, a wobble of the wheel, the strings'
mass, air; the strings winding on during the jerk itself.
"""

from __future__ import annotations

import enum
import math
from dataclasses import dataclass

from staunlabor.domain.experiments.constants import G
from staunlabor.domain.experiments.numerics import MAX_DURATION_S, SAMPLES_PER_S


class Shape(enum.StrEnum):
    DISC = "disc"
    RING = "ring"


#: I/(M·R²) for the two wheels the page offers.
SPIN_SHARE = {Shape.DISC: 0.5, Shape.RING: 1.0}


class Phase(enum.StrEnum):
    DOWN = "down"
    JERK = "jerk"
    UP = "up"


@dataclass(frozen=True)
class MaxwellWheel:
    mass_kg: float = 0.5
    wheel_radius_m: float = 0.065
    axle_radius_m: float = 0.005
    shape: Shape = Shape.DISC
    #: How far the wheel falls before the strings run out.
    drop_m: float = 0.6
    #: c: the strings' rubbing round the axle, as a share of their pull.
    loss: float = 0.03
    #: s: both strings' stiffness, newtons per metre of stretch.
    stiffness_n_m: float = 10000.0

    def __post_init__(self) -> None:
        if not 0.01 <= self.mass_kg <= 50:
            raise ValueError("the wheel weighs between 10 g and 50 kg")
        if not 0 < self.axle_radius_m < self.wheel_radius_m <= 1.0:
            raise ValueError("the axle is thinner than the wheel, whose radius is at most a metre")
        if not 0.05 <= self.drop_m <= 5.0:
            raise ValueError("the strings are between 5 cm and 5 m long")
        if not 0 <= self.loss < 0.5:
            raise ValueError("the rubbing costs between nothing and half of the strings' pull")
        if not 10 <= self.stiffness_n_m <= 1e7:
            raise ValueError("the strings' stiffness lies between 10 N/m and 10 MN/m")


def inertia_ratio(w: MaxwellWheel) -> float:
    """``k = I/(M·r²) = (I/(M·R²))·(R/r)²``."""
    return SPIN_SHARE[w.shape] * (w.wheel_radius_m / w.axle_radius_m) ** 2


def fall_acceleration(w: MaxwellWheel) -> float:
    return G / (1 + inertia_ratio(w) / (1 - w.loss))


def climb_deceleration(w: MaxwellWheel) -> float:
    return G / (1 + inertia_ratio(w) / (1 + w.loss))


def roll_tension_n(w: MaxwellWheel, phase: Phase = Phase.DOWN) -> float:
    """Both strings together while rolling: ``M·(g − a↓)`` down, ``M·(g − a↑)`` up."""
    a = fall_acceleration(w) if phase is Phase.DOWN else climb_deceleration(w)
    return w.mass_kg * (G - a)


def rotation_share(w: MaxwellWheel) -> float:
    """The share of the moving wheel's energy that is in its spin."""
    k = inertia_ratio(w)
    return k / (1 + k)


def _jerk(w: MaxwellWheel, v: float) -> tuple[float, float, float]:
    """The jerk's rate ``w``, its duration, and the strings' peak pull: on
    strings already stretched by the rolling pull, only ``a↓`` to catch."""
    rate = math.sqrt(w.stiffness_n_m / w.mass_kg)
    down = fall_acceleration(w)
    duration = (2 * math.pi - 2 * math.atan(v * rate / down)) / rate
    amplitude = math.hypot(down / rate**2, v / rate)
    return rate, duration, w.mass_kg * G + w.stiffness_n_m * amplitude


@dataclass(frozen=True)
class Bounce:
    """One fall from rest, the jerk at the bottom, and the climb back to rest."""

    from_m: float
    fall_s: float
    bottom_speed_m_s: float
    #: Revolutions a second at the bottom.
    bottom_spin_hz: float
    jerk_s: float
    peak_tension_n: float
    #: How far the strings stretch at the peak.
    stretch_m: float
    climb_s: float
    to_m: float


def bounce(w: MaxwellWheel, height_m: float) -> Bounce:
    down, up = fall_acceleration(w), climb_deceleration(w)
    fall = math.sqrt(2 * height_m / down)
    v = down * fall
    _, jerk, peak = _jerk(w, v)
    return Bounce(
        from_m=height_m,
        fall_s=fall,
        bottom_speed_m_s=v,
        bottom_spin_hz=v / (2 * math.pi * w.axle_radius_m),
        jerk_s=jerk,
        peak_tension_n=peak,
        stretch_m=peak / w.stiffness_n_m,
        climb_s=v / up,
        to_m=v * v / (2 * up),
    )


def bounces(w: MaxwellWheel, count: int = 8) -> tuple[Bounce, ...]:
    out: list[Bounce] = []
    height = w.drop_m
    for _ in range(count):
        b = bounce(w, height)
        out.append(b)
        height = b.to_m
    return tuple(out)


@dataclass(frozen=True)
class WheelState:
    #: The centre's height above where it is when the strings run out; below it
    #: while they stretch.
    height_m: float
    #: Up positive.
    velocity_m_s: float
    tension_n: float
    #: How far the wheel has turned since it was let go, in turns, one way and
    #: then the other.
    turns: float
    phase: Phase
    bounce: int


def state_at(w: MaxwellWheel, t: float) -> WheelState:
    """Where the wheel is ``t`` seconds after it was let go from rest at the top."""
    if t < 0:
        raise ValueError("the wheel is let go at t = 0")
    down, up = fall_acceleration(w), climb_deceleration(w)
    r = w.axle_radius_m
    circumference = 2 * math.pi * r
    height = w.drop_m
    clock = 0.0
    n = 0
    while height > 1e-9:
        b = bounce(w, height)
        sense = 1 if n % 2 == 0 else -1
        if t < clock + b.fall_s:
            s = t - clock
            fallen = 0.5 * down * s * s
            return WheelState(
                height - fallen, -down * s, roll_tension_n(w, Phase.DOWN), sense * fallen / circumference, Phase.DOWN, n
            )
        clock += b.fall_s
        v = b.bottom_speed_m_s
        if t < clock + b.jerk_s:
            rate, _, _ = _jerk(w, v)
            x = rate * (t - clock)
            z = -(down / rate**2) * (1 - math.cos(x)) - (v / rate) * math.sin(x)
            # The spin goes on through the jerk at the bottom's rate.
            turned = height + v * (t - clock)
            return WheelState(
                z,
                -(down / rate) * math.sin(x) - v * math.cos(x),
                roll_tension_n(w, Phase.DOWN) - w.stiffness_n_m * z,
                sense * turned / circumference,
                Phase.JERK,
                n,
            )
        clock += b.jerk_s
        turned = height + v * b.jerk_s
        if t < clock + b.climb_s:
            s = t - clock
            climbed = v * s - 0.5 * up * s * s
            return WheelState(
                climbed,
                v - up * s,
                roll_tension_n(w, Phase.UP),
                sense * (turned + climbed) / circumference,
                Phase.UP,
                n,
            )
        clock += b.climb_s
        height = b.to_m
        n += 1
    return WheelState(0.0, 0.0, w.mass_kg * G, 0.0, Phase.DOWN, n)


@dataclass(frozen=True)
class WheelRun:
    t: tuple[float, ...]
    height_m: tuple[float, ...]
    velocity_m_s: tuple[float, ...]
    tension_n: tuple[float, ...]


def run(w: MaxwellWheel, duration_s: float, samples_per_s: int = SAMPLES_PER_S) -> WheelRun:
    """The wheel sampled ``samples_per_s`` times a second: a closed form,
    nothing stepped."""
    if not 0 < duration_s <= MAX_DURATION_S:
        raise ValueError(f"a run lasts more than nothing and at most {MAX_DURATION_S:g} s")
    if not 1 <= samples_per_s <= 10000:
        raise ValueError("between one and ten thousand samples a second")
    n = round(duration_s * samples_per_s)
    states = [state_at(w, i / samples_per_s) for i in range(n + 1)]
    return WheelRun(
        t=tuple(i / samples_per_s for i in range(n + 1)),
        height_m=tuple(s.height_m for s in states),
        velocity_m_s=tuple(s.velocity_m_s for s in states),
        tension_n=tuple(s.tension_n for s in states),
    )
