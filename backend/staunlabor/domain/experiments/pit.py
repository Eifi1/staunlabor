"""The pit the race's balls jump into, and where they come to lie.

Past the finish the balls go on by physics alone, into a pit where all of
them end up together, as they would in a real one. So at the finish each
track ends, and its ball flies on with the velocity it left with, under ``g``
alone, into a padded pit — a funnel, its sides sloping at 30° down to a rounded
bottom, a wall rising from each rim; there it bounces, rolls and knocks into
the others until all of them lie still together at the bottom. (Before, the page ran the balls onto a flat with a brake it had made
up, and then into a sand pit that stopped each where it fell; the first made
the winner brake the softest, the second left balls hiding behind each other.)

**The model.** The balls are discs in the race's plane — the pit is a trough
one ball wide that every lane runs into, so the balls meet — of one radius and
mass, each with its spin. Above the rim they are still in their own lanes,
side by side — every one leaves the same finish, a ball arriving close behind
another would otherwise start inside it — and only once a ball has dropped
below the rim, into the trough, can it touch the others. Where two touch, or a ball the lining, a stiff
spring pushes them apart along the line between their centres, with a damper
that keeps a share ``e`` of the speed of approach (the restitution: a padded
lining keeps less than a ball meeting a ball). Along the contact, friction up
to ``μ`` times the push slows the slide and turns the ball (a viscous law near
no slip, so that a rolling ball is not shaken by a Coulomb switch every step).
A rolling ball is slowed by a rolling resistance, a share of the push, as a
padded lining does — without it a ball in a bowl rolls to and fro for ever.
Semi-implicit Euler every 0.1 ms: about twenty steps to the shortest contact,
and the spring stiff enough that a ball at full speed sinks a few millimetres
into what it hits. Balls knocking into balls is chaotic — a difference in the
last bit grows until two runs part — so the loop uses only what rounds the same
in Python and in a browser (``+ − × ÷``, ``sqrt``; no ``hypot``, whose last bit
differs between them), and the port follows it bit for bit.

**How it is used.** The page runs it, ported line for line
(``features/experiments/simulate/pit.ts``), once per build, since it is a time
loop and the API's budget is not; the engine is its reference — the browser is
held to it through ``engine-cases.json`` — and its tests: energy only ever
leaves, nothing sinks through the lining or into another ball, and all of them
come to rest in the bowl.

What it deliberately leaves out: spin about any axis but the one square to the
plane, air, and a third dimension — the balls cannot pass one another. The
walls stand at every height in the model (the page draws them as high as any
ball rises), so no ball knocked upwards can leave the pit.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

#: Standard gravity, as the race uses.
G = 9.80665

#: The balls' radius as a share of the race's size, the larger of its run and
#: drop: the size the page has always drawn them at. The race itself treats a
#: ball as a point on its track; in the pit its size is what makes balls meet.
BALL_SHARE = 0.022

#: The pit's sides slope at 30°: steeper than friction can hold even a block
#: that slides (tan 30° = 0.58 > μ = 0.4) or rolling resistance a ball, so
#: every ball ends at the bottom — a bowl shallow enough to catch a long throw
#: left balls lying wherever they had slowed down, apart.
SIDE_SLOPE_RAD = math.radians(30)
#: Its bottom is rounded, a circle of this many ball radii.
BOTTOM_BALLS = 6.0

#: The contacts. The spring per unit mass (``ω₀ = 1000/s``: a contact lasts
#: about 3 ms, a ball arriving at 3 m/s sinks 3 mm into the lining).
STIFFNESS = 1.0e6
#: How much of the speed of approach a contact gives back: a padded lining
#: little, a ball against a ball more.
LINING_RESTITUTION = 0.3
BALL_RESTITUTION = 0.6
#: Friction along a contact, and the viscous law it follows near no slip (per
#: unit mass, per m/s of slip: fast enough to make a ball roll within a
#: millisecond, slow enough for the step).
FRICTION = 0.4
SLIP_DAMPING = 1000.0
#: Rolling resistance on the lining, as a share of the push.
ROLLING = 0.08

#: The step, and every how many steps a sample is kept for the page (5 ms).
DT = 1e-4
EVERY = 50
#: Still means every ball slower than this, its rim too, for this long.
STILL_M_S = 3e-3
STILL_FOR_S = 0.3
#: And the run ends this long after the last ball arrives in any case.
LONGEST_AFTER_S = 6.0


@dataclass(frozen=True)
class Basin:
    """The pit: two sides sloping from the rims down to a rounded bottom, a
    wall up from each rim."""

    left_x_m: float
    right_x_m: float
    rim_y_m: float
    #: How high the page draws the walls, above every throw: the model's stand
    #: at every height.
    top_y_m: float
    #: The rounded bottom's centre and radius.
    bottom_x_m: float
    bottom_y_m: float
    bottom_radius_m: float
    slope_rad: float


def basin(finish_x: float, finish_y: float, drop: float, ball: float, exits: list[tuple[float, float]]) -> Basin:
    """The pit for a race whose balls leave the finish with `exits`: its rim a
    little below the finish, its left wall just clear of it, and wide enough
    that the farthest throw lands inside it with room."""
    gap = max(0.15 * drop, 3 * ball)
    rim_y = finish_y - gap
    reach = max(vx * (vy + math.sqrt(vy * vy + 2 * G * gap)) / G for vx, vy in exits)
    rise = max(max(vy, 0.0) ** 2 / (2 * G) for _vx, vy in exits)
    left_x = finish_x - 2 * ball
    right_x = finish_x + 1.25 * reach + 3 * ball
    half = (right_x - left_x) / 2
    bottom = BOTTOM_BALLS * ball
    # Where the two sides would meet, and the circle that touches both above it.
    apex_y = rim_y - half * math.tan(SIDE_SLOPE_RAD)
    return Basin(
        left_x_m=left_x,
        right_x_m=right_x,
        rim_y_m=rim_y,
        top_y_m=finish_y + 1.5 * rise + 4 * ball,
        bottom_x_m=left_x + half,
        bottom_y_m=apex_y + bottom / math.cos(SIDE_SLOPE_RAD),
        bottom_radius_m=bottom,
        slope_rad=SIDE_SLOPE_RAD,
    )


def _side(
    ax: float, ay: float, bx: float, by: float, radius: float, x: float, y: float
) -> tuple[float, float, float] | None:
    """How deep a ball at `(x, y)` presses into the side from `a` to `b`, and
    the side's push, where it is over the side (not past either end)."""
    dx, dy = bx - ax, by - ay
    length = math.sqrt(dx * dx + dy * dy)
    along = ((x - ax) * dx + (y - ay) * dy) / length
    if along < 0 or along >= length:
        return None
    qx, qy = ax + along * dx / length, ay + along * dy / length
    d = math.sqrt((x - qx) * (x - qx) + (y - qy) * (y - qy))
    if d >= radius:
        return None
    return radius - d, (x - qx) / d, (y - qy) / d


@dataclass(frozen=True)
class Entry:
    """A ball arriving: when it leaves its track, where, and how fast."""

    time_s: float
    x_m: float
    y_m: float
    vx_m_s: float
    vy_m_s: float


@dataclass(frozen=True)
class PitBall:
    """One ball in the pit, sampled every :data:`EVERY` steps from the first
    sample after it arrived; the acceleration is the mean over the interval
    that ends at each sample (a contact lasts less than one)."""

    start_s: float
    x_m: tuple[float, ...]
    y_m: tuple[float, ...]
    vx_m_s: tuple[float, ...]
    vy_m_s: tuple[float, ...]
    ax_m_s2: tuple[float, ...]
    ay_m_s2: tuple[float, ...]


@dataclass(frozen=True)
class PitRun:
    sample_s: float
    balls: tuple[PitBall, ...]
    #: When the last ball came to rest (or the run ran out of time).
    settled_s: float
    #: Whether they did come to rest.
    still: bool


def _damping(restitution: float, mass: float) -> float:
    """The damper that keeps `restitution` of the speed of approach, for a
    contact whose two sides move as one `mass` (per unit mass of a ball)."""
    log = math.log(restitution)
    zeta = -log / math.sqrt(math.pi * math.pi + log * log)
    return 2 * zeta * math.sqrt(STIFFNESS * mass)


class _Balls:
    """The balls' state as the loop steps it: lists, for speed."""

    def __init__(self, n: int) -> None:
        self.x = [0.0] * n
        self.y = [0.0] * n
        self.vx = [0.0] * n
        self.vy = [0.0] * n
        self.w = [0.0] * n
        self.active = [False] * n
        #: Down in the trough, where it can meet the others.
        self.met = [False] * n


def _arrive(balls: _Balls, entries: tuple[Entry, ...], t: float, radius: float, turns: bool) -> list[int]:
    """Let in every ball that has left its track by `t`; the ones let in now."""
    arrived = []
    for i, e in enumerate(entries):
        if balls.active[i] or t < e.time_s:
            continue
        # It left its track between two steps: carried on to this one.
        late = t - e.time_s
        balls.x[i], balls.y[i] = e.x_m + e.vx_m_s * late, e.y_m + e.vy_m_s * late
        balls.vx[i], balls.vy[i] = e.vx_m_s, e.vy_m_s
        # Rolling on its track, with the track below it.
        balls.w[i] = -math.sqrt(e.vx_m_s * e.vx_m_s + e.vy_m_s * e.vy_m_s) / radius if turns else 0.0
        balls.active[i] = True
        arrived.append(i)
    return arrived


def _touching(bowl: Basin, radius: float, x: float, y: float) -> list[tuple[float, float, float]]:
    """Where a ball at `(x, y)` presses into the lining: how deep, and the
    direction the lining pushes it."""
    contacts = []
    s, c = math.sin(bowl.slope_rad), math.cos(bowl.slope_rad)
    r = bowl.bottom_radius_m
    # Where each side meets the bottom: a radius in from its inward normal.
    left_x, right_x = bowl.bottom_x_m - r * s, bowl.bottom_x_m + r * s
    meet_y = bowl.bottom_y_m - r * c
    for side in (
        _side(bowl.left_x_m, bowl.rim_y_m, left_x, meet_y, radius, x, y),
        _side(right_x, meet_y, bowl.right_x_m, bowl.rim_y_m, radius, x, y),
    ):
        if side is not None:
            contacts.append(side)
    dx, dy = x - bowl.bottom_x_m, y - bowl.bottom_y_m
    if dy < 0 and abs(dx) * c <= -dy * s:
        d = math.sqrt(dx * dx + dy * dy)
        sink = d + radius - r
        if sink > 0:
            contacts.append((sink, -dx / d, -dy / d))
    if y > bowl.rim_y_m:
        if x - bowl.left_x_m < radius:
            contacts.append((radius - (x - bowl.left_x_m), 1.0, 0.0))
        if bowl.right_x_m - x < radius:
            contacts.append((radius - (bowl.right_x_m - x), -1.0, 0.0))
    return contacts


class _Pushes:
    """What the contacts do to each ball this step, per unit mass: its
    acceleration, the friction's turn and the rolling resistance's brake."""

    def __init__(self, n: int) -> None:
        self.ax = [0.0] * n
        self.ay = [-G] * n
        self.spin = [0.0] * n
        self.roll = [0.0] * n


def _lining(balls: _Balls, bowl: Basin, radius: float, inertia: float, damping: float, out: _Pushes) -> None:
    for i in range(len(balls.x)):
        if not balls.active[i]:
            continue
        for sink, nx, ny in _touching(bowl, radius, balls.x[i], balls.y[i]):
            push = STIFFNESS * sink - damping * (balls.vx[i] * nx + balls.vy[i] * ny)
            if push <= 0:
                continue
            tx, ty = -ny, nx
            slip = balls.vx[i] * tx + balls.vy[i] * ty - radius * balls.w[i]
            f = max(-FRICTION * push, min(FRICTION * push, SLIP_DAMPING * slip))
            out.ax[i] += push * nx - f * tx
            out.ay[i] += push * ny - f * ty
            if inertia > 0:
                out.spin[i] += f / (inertia * radius)
                out.roll[i] += ROLLING * push / (inertia * radius)


def _pairs(balls: _Balls, radius: float, inertia: float, damping: float, out: _Pushes) -> None:
    n = len(balls.x)
    reach2 = (2 * radius) * (2 * radius)
    for i in range(n):
        for j in range(i + 1, n):
            if not (balls.met[i] and balls.met[j]):
                continue
            dx, dy = balls.x[i] - balls.x[j], balls.y[i] - balls.y[j]
            d2 = dx * dx + dy * dy
            if d2 >= reach2:
                continue
            d = math.sqrt(d2)
            nx, ny = dx / d, dy / d
            rvx, rvy = balls.vx[i] - balls.vx[j], balls.vy[i] - balls.vy[j]
            push = STIFFNESS * (2 * radius - d) - damping * (rvx * nx + rvy * ny)
            if push <= 0:
                continue
            tx, ty = -ny, nx
            slip = rvx * tx + rvy * ty - radius * (balls.w[i] + balls.w[j])
            f = max(-FRICTION * push, min(FRICTION * push, SLIP_DAMPING * slip))
            fx, fy = push * nx - f * tx, push * ny - f * ty
            out.ax[i] += fx
            out.ay[i] += fy
            out.ax[j] -= fx
            out.ay[j] -= fy
            if inertia > 0:
                out.spin[i] += f / (inertia * radius)
                out.spin[j] += f / (inertia * radius)


def _advance(balls: _Balls, out: _Pushes, bowl: Basin, radius: float, inertia: float) -> bool:
    """One step, semi-implicit; whether anything still moves (or is still to
    come)."""
    moving = False
    for i in range(len(balls.x)):
        if not balls.active[i]:
            moving = True
            continue
        balls.vx[i] += out.ax[i] * DT
        balls.vy[i] += out.ay[i] * DT
        balls.x[i] += balls.vx[i] * DT
        balls.y[i] += balls.vy[i] * DT
        balls.met[i] = balls.met[i] or balls.y[i] < bowl.rim_y_m
        if inertia > 0:
            spun = balls.w[i] + out.spin[i] * DT
            slowed = out.roll[i] * DT
            balls.w[i] = 0.0 if abs(spun) <= slowed else spun - math.copysign(slowed, spun)
        if (
            math.sqrt(balls.vx[i] * balls.vx[i] + balls.vy[i] * balls.vy[i]) > STILL_M_S
            or abs(balls.w[i]) * radius > STILL_M_S
        ):
            moving = True
    return moving


def run(bowl: Basin, radius: float, inertia: float, entries: tuple[Entry, ...]) -> PitRun:
    """The balls from their arrivals until they lie still. `inertia` is
    ``I/(m·r²)``: 2/5 a solid ball, 2/3 a hollow one, 0 a block that slides
    (and then does not turn)."""
    n = len(entries)
    lining = _damping(LINING_RESTITUTION, 1.0)
    pair = _damping(BALL_RESTITUTION, 0.5)
    balls = _Balls(n)
    rows: list[list[list[float]]] = [[[], [], [], [], [], []] for _ in range(n)]
    starts = [-1.0] * n
    before = [(0.0, 0.0)] * n
    start = min(e.time_s for e in entries)
    limit = round((max(e.time_s for e in entries) - start + LONGEST_AFTER_S) / DT)
    still_steps = 0
    step = 0
    still = False
    while step <= limit:
        t = start + step * DT
        for i in _arrive(balls, entries, t, radius, inertia > 0):
            before[i] = (balls.vx[i], balls.vy[i])
        if step % EVERY == 0:
            for i in (i for i in range(n) if balls.active[i]):
                first = starts[i] < 0
                if first:
                    starts[i] = t
                ax = 0.0 if first else (balls.vx[i] - before[i][0]) / (EVERY * DT)
                ay = -G if first else (balls.vy[i] - before[i][1]) / (EVERY * DT)
                values = (balls.x[i], balls.y[i], balls.vx[i], balls.vy[i], ax, ay)
                for row, value in zip(rows[i], values, strict=True):
                    row.append(value)
                before[i] = (balls.vx[i], balls.vy[i])
        out = _Pushes(n)
        _lining(balls, bowl, radius, inertia, lining, out)
        _pairs(balls, radius, inertia, pair, out)
        still_steps = still_steps + 1 if not _advance(balls, out, bowl, radius, inertia) else 0
        if still_steps * DT >= STILL_FOR_S and step % EVERY == 0:
            still = True
            break
        step += 1
    balls_out = tuple(PitBall(starts[i], *(tuple(row) for row in rows[i])) for i in range(n))
    return PitRun(sample_s=EVERY * DT, balls=balls_out, settled_s=start + step * DT, still=still)
