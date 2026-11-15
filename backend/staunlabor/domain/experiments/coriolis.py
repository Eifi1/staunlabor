"""The Coriolis carousel: a ball that never arrives where it was aimed.

The exhibit is a turning platform with two seats at opposite edges. One rider
rolls a ball to the other — and it curves away and misses, though nobody
pushed it aside. Seen from outside, there is no curve to explain.

**Two things to throw.** A puck sliding without friction keeps the velocity it
was given — the throw plus the edge's own speed ``Ω × r``, since the thrower
turns with the platform — and goes straight, seen from outside:
``r(t) = r₀ + v₀·t``. A ball that **rolls** is stranger. The platform under it
keeps turning, and to roll without slipping the ball must keep up with the
surface under it: the friction that makes it do so turns its velocity at a
steady ``(k/(1 + k))·Ω``, ``k = I/(m·a²) = 2/5`` for a solid ball — ``2/7`` of
the platform's rate. From outside, a rolled ball runs on a circle.

**Seen turning along.** Either path, turned back by ``−Ω·t``, is what a rider
sees: for the puck it obeys ``a′ = −2Ω × v′ − Ω × (Ω × r′)`` — the Coriolis
and the centrifugal force, felt only by whoever turns — and the tests hold the
turned-back closed form to those equations, stepped.

**The lead.** To hit the other seat, a rider aims ahead of it — by how much
:func:`lead_deg` finds, by bisection on the aim.

**What it leaves out.** Rolling resistance and slipping (the rolled ball is
taken rolling from the start), the ball's size against the platform's, and
air.
"""

from __future__ import annotations

import enum
import math
from dataclasses import dataclass

#: I/(m·a²) for a solid ball.
SOLID_BALL = 2 / 5

#: Samples a path returns per second.
SAMPLES_PER_S = 100

#: The longest a throw is followed: off the platform by then at any speed the
#: page offers.
LONGEST_S = 20.0


class Body(enum.StrEnum):
    PUCK = "puck"
    BALL = "ball"


@dataclass(frozen=True)
class Carousel:
    radius_m: float = 2.0
    #: Turns a minute, anticlockwise seen from above.
    rpm: float = 6.0

    def __post_init__(self) -> None:
        if not 0.5 <= self.radius_m <= 10:
            raise ValueError("the platform's radius lies between 0.5 and 10 m")
        if not -60 <= self.rpm <= 60:
            raise ValueError("the platform turns at most 60 times a minute either way")

    @property
    def rate(self) -> float:
        """Ω, rad/s."""
        return self.rpm * 2 * math.pi / 60


@dataclass(frozen=True)
class Throw:
    #: The ball's speed against the platform as it leaves the hand.
    speed_m_s: float = 3.0
    #: How far ahead of the straight line to the other seat it is aimed,
    #: anticlockwise positive.
    aim_deg: float = 0.0
    body: Body = Body.PUCK

    def __post_init__(self) -> None:
        if not 0.1 <= self.speed_m_s <= 20:
            raise ValueError("a throw is between 0.1 and 20 m/s")
        if not -89 <= self.aim_deg <= 89:
            raise ValueError("a throw aims across the platform, within 89° of the other seat")


def _turn(x: float, y: float, angle: float) -> tuple[float, float]:
    c, s = math.cos(angle), math.sin(angle)
    return x * c - y * s, x * s + y * c


def start(c: Carousel, throw: Throw) -> tuple[tuple[float, float], tuple[float, float]]:
    """Where the ball starts — the thrower's seat at ``(R, 0)`` — and its velocity
    seen from outside: the throw toward ``(−R, 0)``, turned by the aim, plus the
    seat's own ``Ω × r``."""
    ux, uy = _turn(-throw.speed_m_s, 0.0, math.radians(throw.aim_deg))
    return (c.radius_m, 0.0), (ux, uy + c.rate * c.radius_m)


def outside(c: Carousel, throw: Throw, t: float) -> tuple[float, float]:
    """The ball's place at ``t``, seen from outside."""
    (x0, y0), (vx, vy) = start(c, throw)
    if throw.body is Body.PUCK:
        return x0 + vx * t, y0 + vy * t
    w = SOLID_BALL / (1 + SOLID_BALL) * c.rate
    if abs(w * t) < 1e-12:
        return x0 + vx * t, y0 + vy * t
    # v(t) is v₀ turned by w·t; its integral, (J·(R(wt) − 1)·v₀)/w with J a
    # quarter turn clockwise.
    s, k = math.sin(w * t), math.cos(w * t)
    return x0 + (vx * s - vy * (1 - k)) / w, y0 + (vy * s + vx * (1 - k)) / w


def turning(c: Carousel, throw: Throw, t: float) -> tuple[float, float]:
    """The ball's place at ``t`` as a rider sees it: the outside's, turned back
    by ``−Ω·t``."""
    x, y = outside(c, throw, t)
    return _turn(x, y, -c.rate * t)


def leaves_s(c: Carousel, throw: Throw) -> float:
    """When the ball crosses the platform's edge again, by bisection on the
    distance from the axis; :data:`LONGEST_S` if it never does."""

    def out(t: float) -> bool:
        x, y = outside(c, throw, t)
        return x * x + y * y > c.radius_m**2

    # Find a time beyond the edge, stepping out from just after the throw.
    step = 0.01
    t = step
    while t < LONGEST_S and not out(t):
        t += step
    if t >= LONGEST_S:
        return LONGEST_S
    lo, hi = t - step, t
    for _ in range(60):
        mid = (lo + hi) / 2
        if out(mid):
            hi = mid
        else:
            lo = mid
    return hi


def miss_deg(c: Carousel, throw: Throw) -> float:
    """Where the ball crosses the edge, seen by the riders, against the other
    seat at 180°: degrees round the rim, anticlockwise positive."""
    x, y = turning(c, throw, leaves_s(c, throw))
    angle = math.degrees(math.atan2(y, x)) % 360
    return angle - 180


def lead_deg(c: Carousel, speed_m_s: float, body: Body) -> float | None:
    """The aim that hits the other seat, ``None`` if no aim within ±85° does: the
    aims scanned a degree apart for a change of the miss's sign — not one across
    its jump from +180° to −180°, where the ball leaves past the thrower's own
    seat — the one nearest straight ahead then bisected."""
    aims = [float(a) for a in range(-85, 86)]
    misses = [miss_deg(c, Throw(speed_m_s, a, body)) for a in aims]
    brackets = [
        (aims[i], aims[i + 1], misses[i + 1])
        for i in range(len(aims) - 1)
        if (misses[i] > 0) != (misses[i + 1] > 0) and abs(misses[i] - misses[i + 1]) < 180
    ]
    if not brackets:
        return None
    lo, hi, m_hi = min(brackets, key=lambda b: abs(b[0] + b[1]))
    for _ in range(50):
        mid = (lo + hi) / 2
        if (miss_deg(c, Throw(speed_m_s, mid, body)) > 0) == (m_hi > 0):
            hi = mid
        else:
            lo = mid
    return (lo + hi) / 2


@dataclass(frozen=True)
class ThrowPath:
    t: tuple[float, ...]
    outside_x: tuple[float, ...]
    outside_y: tuple[float, ...]
    turning_x: tuple[float, ...]
    turning_y: tuple[float, ...]
    leaves_s: float
    miss_deg: float


def path(c: Carousel, throw: Throw) -> ThrowPath:
    """The throw from the hand to the edge, in both views."""
    end = leaves_s(c, throw)
    n = max(1, round(end * SAMPLES_PER_S))
    ts = [end * i / n for i in range(n + 1)]
    out = [outside(c, throw, t) for t in ts]
    turn = [turning(c, throw, t) for t in ts]
    return ThrowPath(
        t=tuple(ts),
        outside_x=tuple(p[0] for p in out),
        outside_y=tuple(p[1] for p in out),
        turning_x=tuple(p[0] for p in turn),
        turning_y=tuple(p[1] for p in turn),
        leaves_s=end,
        miss_deg=miss_deg(c, throw),
    )
