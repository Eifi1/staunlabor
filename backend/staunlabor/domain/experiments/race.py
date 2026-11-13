"""The race: balls let go together on six tracks, from one start to one finish.

Balls on differently curved ramps, let go at the same moment, finish at
different times; and there is a curve on which a ball always needs the same
time to the bottom, no matter where on it the ball was started. That is the **tautochrone**, and Huygens found in 1659 that it is a **cycloid**,
the curve a point on a rolling wheel's rim draws. The same cycloid is the
**brachistochrone**, the fastest slide between two points, Johann Bernoulli's
challenge of 1696 — Galileo had guessed in 1638 that a circle was.

**The model.** A ball let go at rest at the start ``A`` has, a height ``h``
below it, the speed ``v = √(2·g'·h)``, whatever the track did on the way: the
track only steers, and energy is kept. So a track's time is the sum of its
length over its speed, ``T = ∫ ds / v``, and nothing needs stepping in time.
A rolling ball feels ``g' = g/(1 + k)`` of gravity along the track (``k`` =
``I/(m·r²)``: 2/5 solid, 2/3 hollow, 0 for a block that slides), the sphere's
5/7 again, so rolling stretches every time by the same ``√(1 + k)`` and changes
no ranking — the cycloid is the fastest for any ball.

The six tracks, each through ``A = (0, 0)`` and the finish ``B = (D, −H)``:

* the **line** — the shortest, ``T = √(2·(D² + H²)/(g'·H))``;
* the **cycloid** ``x = r(θ − sin θ)``, ``y = −r(1 − cos θ)``, ``r`` and the end
  angle ``θ_B`` chosen to meet ``B`` — the fastest, ``T = θ_B·√(r/g')``; when
  ``D/H > π/2`` it dips below the finish and the ball climbs the last part;
* a **circular arc** level at ``B`` — Galileo's guess, close but slower;
* a **parabola** with its vertex at ``B``;
* a **hyperbola** that drops steeply first and flattens out;
* a **hump**: the line with a rise on the way, never above the start, on which
  the ball crawls over the top with almost no height left to fall from.

The **tautochrone**, beside it: a cycloid valley of radius ``r``, balls let go
together from different heights, each reaching the bottom after exactly
``π·√(r/g')``; and, to compare, a circular bowl with the same curvature at the
bottom, on which the higher a ball starts the later it arrives — a pendulum
swings slower the wider it swings, as on the sphere's page.

**The arrows**: velocity and acceleration, drawn in a coordinate system with
their values beside. At every sample the ball's velocity
is ``v·T``, its speed along the track's tangent, and its acceleration
``g'·(−T_y)·T + v²·κ·N``: the share of gravity along the track, and the turn
the track forces on it, ``v²·κ`` toward the centre of curvature, ``κ`` from the
track's first and second derivatives (:func:`_bend`), exactly.

**How it is computed.** ``T = ∫ |dr/dp| / v dp`` along each track, with the
substitution ``p = u²`` that takes the square-root singularity at the start
(where ``v = 0``) out of the integrand, summed by the trapezoid rule over
:data:`STEPS` intervals; the same sum, kept as it goes, is each track's time
table for the page's animation. The test holds the line and the cycloid to
their closed forms and the others to independent quadrature.

What it leaves out: the ball's size (a point on the track), rolling
resistance and air. It assumes the track holds the ball everywhere, and
:data:`SHORTEST_RUN` is what makes that true rather than hoped: the test
checks that every track presses on every ball at both ends of the run the
race allows.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from enum import StrEnum

from staunlabor.domain.experiments import pit
from staunlabor.domain.experiments.pit import Basin
from staunlabor.domain.experiments.sphere import HOLLOW, SOLID

#: Standard gravity.
G = 9.80665

#: Trapezoid intervals per track: a multiple of the sample intervals. The
#: integrand, after the substitution, is smooth and bounded, and at this many
#: the sum agrees with adaptive quadrature to a part in 10⁷ (the hump, whose
#: crawl over the top is the hardest part, included) — at 23 ms for the six
#: tracks and the valley, a quarter of what 6000 cost for no visible gain.
STEPS = 1440
#: Points of each track's time table the page gets.
POINTS = 241

#: How steep the hyperbola starts: ``y = −H·(1 + a)·u/(u + a)``.
HYPERBOLA_A = 0.15
#: The hump's height, as a share of the drop, added to the line as
#: ``A·sin²(πu)``: low enough never to rise above the start.
HUMP_SHARE = 0.35

#: The tautochrone's cycloid radius, and the heights its balls start from, as
#: the cycloid's angle (``π`` is the bottom).
VALLEY_RADIUS_M = 0.3
VALLEY_STARTS = (0.3, 1.0, 2.0, 2.8)


class RaceBall(StrEnum):
    SOLID = "solid"
    HOLLOW = "hollow"
    SLIDING = "sliding"


class CurveKind(StrEnum):
    LINE = "line"
    CYCLOID = "cycloid"
    CIRCLE = "circle"
    PARABOLA = "parabola"
    HYPERBOLA = "hyperbola"
    HUMP = "hump"


INERTIA = {RaceBall.SOLID: SOLID, RaceBall.HOLLOW: HOLLOW, RaceBall.SLIDING: 0.0}


#: The shortest run the race allows, as a share of the drop. Shorter, two
#: tracks stop holding their balls (found by asking where the
#: track's push ``g·cos α + v²·κ`` turns negative; it depends on run/drop
#: alone). Below a run equal to the drop, the circular arc, level at the finish,
#: curls back over its own start and the ball falls off. Below 1.04 times the
#: drop, a sliding block comes over the hump's crest too fast for gravity to
#: bend its path that sharply, and it flies off (a solid ball below 0.77). At
#: 1.1 every track holds every ball, with some margin.
SHORTEST_RUN = 1.1
#: The longest, as a share of the drop: past it the tracks are nearly flat.
LONGEST_RUN = 6.0


@dataclass(frozen=True)
class Race:
    #: How far the finish lies below the start, and how far along.
    drop_m: float = 0.5
    run_m: float = 1.2
    ball: RaceBall = RaceBall.SOLID

    def __post_init__(self) -> None:
        if not self.drop_m > 0 or not self.run_m > 0:
            raise ValueError("the finish has to lie below and beyond the start")
        if not SHORTEST_RUN <= self.run_m / self.drop_m <= LONGEST_RUN:
            raise ValueError("the run lies between 1.1 and six times the drop")

    @property
    def gravity_share(self) -> float:
        return 1 / (1 + INERTIA[self.ball])


def cycloid_through(drop: float, run: float) -> tuple[float, float]:
    """The cycloid from the origin through ``(run, −drop)``: its radius and the
    angle it ends at. ``(θ − sin θ)/(1 − cos θ)`` rises from 0 to ∞ over
    ``(0, 2π)``, so bisection finds the one ``θ`` that gives ``run/drop``."""
    target = run / drop
    lo, hi = 1e-9, 2 * math.pi - 1e-9
    for _ in range(200):
        mid = (lo + hi) / 2
        if (mid - math.sin(mid)) / (1 - math.cos(mid)) < target:
            lo = mid
        else:
            hi = mid
    theta = (lo + hi) / 2
    return drop / (1 - math.cos(theta)), theta


Shape = tuple[float, float, float, float]  # x, y, dx/dp, dy/dp


def _shape(kind: CurveKind, drop: float, run: float):
    """The track as ``p ↦ (x, y, dx/dp, dy/dp)`` for ``p`` in [0, 1]."""
    if kind is CurveKind.LINE:
        return lambda p: (run * p, -drop * p, run, -drop)
    if kind is CurveKind.CYCLOID:
        r, end = cycloid_through(drop, run)

        def cycloid(p: float) -> Shape:
            th = end * p
            return (
                r * (th - math.sin(th)),
                -r * (1 - math.cos(th)),
                r * (1 - math.cos(th)) * end,
                -r * math.sin(th) * end,
            )

        return cycloid
    if kind is CurveKind.CIRCLE:
        big_r = (run * run + drop * drop) / (2 * drop)
        cx, cy = run, -drop + big_r
        a0, a1 = math.atan2(-cy, -cx), -math.pi / 2

        def circle(p: float) -> Shape:
            a = a0 + (a1 - a0) * p
            return (
                cx + big_r * math.cos(a),
                cy + big_r * math.sin(a),
                -big_r * math.sin(a) * (a1 - a0),
                big_r * math.cos(a) * (a1 - a0),
            )

        return circle
    if kind is CurveKind.PARABOLA:
        return lambda p: (run * p, -drop * (1 - (1 - p) ** 2), run, -drop * 2 * (1 - p))
    if kind is CurveKind.HYPERBOLA:
        a = HYPERBOLA_A
        return lambda p: (run * p, -drop * (1 + a) * p / (p + a), run, -drop * (1 + a) * a / (p + a) ** 2)
    hump = HUMP_SHARE * drop
    return lambda p: (
        run * p,
        -drop * p + hump * math.sin(math.pi * p) ** 2,
        run,
        -drop + hump * math.pi * math.sin(2 * math.pi * p),
    )


def _bend(kind: CurveKind, drop: float, run: float):
    """The track's second derivatives, ``p ↦ (d²x/dp², d²y/dp²)``: with the
    first, its curvature, and so the turn it forces on the ball."""
    if kind is CurveKind.LINE:
        return lambda p: (0.0, 0.0)
    if kind is CurveKind.CYCLOID:
        r, end = cycloid_through(drop, run)
        return lambda p: (r * math.sin(end * p) * end * end, -r * math.cos(end * p) * end * end)
    if kind is CurveKind.CIRCLE:
        big_r = (run * run + drop * drop) / (2 * drop)
        cx, cy = run, -drop + big_r
        a0, a1 = math.atan2(-cy, -cx), -math.pi / 2
        turn = (a1 - a0) ** 2
        return lambda p: (
            -big_r * math.cos(a0 + (a1 - a0) * p) * turn,
            -big_r * math.sin(a0 + (a1 - a0) * p) * turn,
        )
    if kind is CurveKind.PARABOLA:
        return lambda p: (0.0, 2 * drop)
    if kind is CurveKind.HYPERBOLA:
        a = HYPERBOLA_A
        return lambda p: (0.0, 2 * drop * (1 + a) * a / (p + a) ** 3)
    hump = HUMP_SHARE * drop
    return lambda p: (0.0, 2 * hump * math.pi**2 * math.cos(2 * math.pi * p))


@dataclass(frozen=True)
class Path:
    """A track sampled for the page: where the ball is at each time."""

    x_m: tuple[float, ...]
    y_m: tuple[float, ...]
    t_s: tuple[float, ...]


def _timed(shape, start_y: float, g: float, points: int = POINTS, steps: int = STEPS) -> tuple[Path, float]:
    """The time along a track from rest at ``p = 0``, by ``p = u²`` and the
    trapezoid rule, and the track sampled at ``points`` even steps in ``u``."""

    def integrand(u: float) -> float:
        _x, y, dx, dy = shape(u * u)
        fall = start_y - y
        if fall <= 0:
            # At the start itself the substitution's limit: |dr/dp| · 2u / √(2g·c·u²)
            # with c the start's drop per p — the next point's value is the limit's
            # neighbour, and one interval of a bounded integrand weighs nothing.
            return 0.0 if u == 0 else math.inf
        return 2 * u * math.hypot(dx, dy) / math.sqrt(2 * g * fall)

    h = 1 / steps
    values = [integrand(j * h) for j in range(steps + 1)]
    if values[0] == 0.0 and steps > 1:
        # The bounded integrand's value at u = 0 is its limit: extrapolate it.
        values[0] = 2 * values[1] - values[2]
    every = steps // (points - 1)
    xs: list[float] = []
    ys: list[float] = []
    ts: list[float] = []
    total = 0.0
    for j in range(steps + 1):
        if j > 0:
            total += h * (values[j - 1] + values[j]) / 2
        if j % every == 0:
            x, y, _, _ = shape((j * h) ** 2)
            xs.append(x)
            ys.append(y)
            ts.append(total)
    return Path(tuple(xs), tuple(ys), tuple(ts)), total


@dataclass(frozen=True)
class TrackMotion:
    """The ball's velocity and acceleration at each of its path's samples."""

    vx_m_s: tuple[float, ...]
    vy_m_s: tuple[float, ...]
    ax_m_s2: tuple[float, ...]
    ay_m_s2: tuple[float, ...]


def _motion(shape, bend, g: float, points: int = POINTS) -> TrackMotion:
    """Velocity and acceleration at the path's samples, ``p = u²`` for even
    steps in ``u``, the ones :func:`_timed` keeps."""
    vx: list[float] = []
    vy: list[float] = []
    ax: list[float] = []
    ay: list[float] = []
    for i in range(points):
        p = (i / (points - 1)) ** 2
        _x, y, dx, dy = shape(p)
        ddx, ddy = bend(p)
        v = math.sqrt(2 * g * max(0.0, -y))
        size = math.hypot(dx, dy)
        if size < 1e-12:
            # A cusp, the cycloid's start: the tangent is the second
            # derivative's direction, and with no speed there is no turn.
            size2 = math.hypot(ddx, ddy)
            tx, ty, kappa = ddx / size2, ddy / size2, 0.0
        else:
            tx, ty, kappa = dx / size, dy / size, (dx * ddy - dy * ddx) / size**3
        along = -g * ty
        turn = v * v * kappa
        # The normal (−T_y, T_x) is the tangent turned left: up, on a track
        # running right, where a positive κ has its centre of curvature.
        vx.append(v * tx)
        vy.append(v * ty)
        ax.append(along * tx - turn * ty)
        ay.append(along * ty + turn * tx)
    return TrackMotion(tuple(vx), tuple(vy), tuple(ax), tuple(ay))


@dataclass(frozen=True)
class Track:
    kind: CurveKind
    path: Path
    time_s: float
    length_m: float
    #: The track's lowest point, below the start.
    lowest_m: float
    #: How fast the ball goes there.
    top_speed_m_s: float
    #: Its velocity and acceleration at each of the path's samples.
    motion: TrackMotion


@dataclass(frozen=True)
class RaceRun:
    tracks: tuple[Track, ...]
    gravity_share: float
    #: How much slower the ball is than a block sliding without friction: √(1 + k).
    rolling_factor: float
    #: Whether the cycloid dips below the finish, and how far down it goes.
    cycloid_dips: bool
    cycloid_lowest_m: float
    #: How fast every ball crosses the finish, ``√(2·g'·H)``: the same on every
    #: track, since the speed depends only on the height fallen.
    finish_speed_m_s: float
    #: The pit past the finish, and what it needs to know of the balls: their
    #: size and how they turn (:mod:`pit`).
    basin: Basin
    ball_radius_m: float
    inertia: float


def race(spec: Race) -> RaceRun:
    g = G * spec.gravity_share
    ball = pit.BALL_SHARE * max(spec.run_m, spec.drop_m)
    tracks = []
    for kind in CurveKind:
        shape = _shape(kind, spec.drop_m, spec.run_m)
        path, total = _timed(shape, 0.0, g)
        length = sum(
            math.hypot(path.x_m[j] - path.x_m[j - 1], path.y_m[j] - path.y_m[j - 1]) for j in range(1, len(path.x_m))
        )
        lowest = -min(path.y_m)
        if kind is CurveKind.CYCLOID:
            r, end = cycloid_through(spec.drop_m, spec.run_m)
            lowest = 2 * r if end > math.pi else spec.drop_m
        motion = _motion(shape, _bend(kind, spec.drop_m, spec.run_m), g)
        tracks.append(Track(kind, path, total, length, lowest, math.sqrt(2 * g * lowest), motion))
    r, end = cycloid_through(spec.drop_m, spec.run_m)
    return RaceRun(
        tracks=tuple(tracks),
        gravity_share=spec.gravity_share,
        rolling_factor=math.sqrt(1 + INERTIA[spec.ball]),
        cycloid_dips=end > math.pi,
        cycloid_lowest_m=2 * r if end > math.pi else spec.drop_m,
        finish_speed_m_s=math.sqrt(2 * g * spec.drop_m),
        basin=pit.basin(
            spec.run_m, -spec.drop_m, spec.drop_m, ball, [(t.motion.vx_m_s[-1], t.motion.vy_m_s[-1]) for t in tracks]
        ),
        ball_radius_m=ball,
        inertia=INERTIA[spec.ball],
    )


def entries(run: RaceRun) -> tuple[pit.Entry, ...]:
    """The balls as they leave their tracks at the finish, for the pit."""
    return tuple(
        pit.Entry(t.time_s, t.path.x_m[-1], t.path.y_m[-1], t.motion.vx_m_s[-1], t.motion.vy_m_s[-1])
        for t in run.tracks
    )


def settle(run: RaceRun) -> pit.PitRun:
    """The race's balls in the pit, from their arrivals until they lie still."""
    return pit.run(run.basin, run.ball_radius_m, run.inertia, entries(run))


# ── the tautochrone ──────────────────────────────────────────────────────────


@dataclass(frozen=True)
class ValleyStart:
    #: How high above the bottom the ball starts.
    height_m: float
    cycloid: Path
    circle: Path
    cycloid_time_s: float
    circle_time_s: float


@dataclass(frozen=True)
class Valley:
    radius_m: float
    #: The circular bowl's radius: four times the cycloid's, the cycloid's own
    #: curvature at its bottom, so a small swing takes the same time in both.
    bowl_radius_m: float
    #: ``π·√(r/g')``: the time to the bottom from anywhere on the cycloid.
    tautochrone_s: float
    starts: tuple[ValleyStart, ...]


def valley(ball: RaceBall = RaceBall.SOLID, radius_m: float = VALLEY_RADIUS_M) -> Valley:
    """Balls let go together on a cycloid valley and on a circular bowl, from
    the same heights; each path runs from the start to the bottom, centred on
    the bottom, and the page mirrors it for the swing up the other side."""
    if radius_m <= 0:
        raise ValueError("a valley needs a radius")
    g = G / (1 + INERTIA[ball])
    r = radius_m
    bowl = 4 * r
    starts = []
    for th0 in VALLEY_STARTS:
        height = r * (1 + math.cos(th0))
        y0 = -r * (1 - math.cos(th0))

        def cycloid(p: float, th0: float = th0) -> Shape:
            th = th0 + (math.pi - th0) * p
            span = math.pi - th0
            return (
                r * (th - math.sin(th)) - r * math.pi,
                -r * (1 - math.cos(th)),
                r * (1 - math.cos(th)) * span,
                -r * math.sin(th) * span,
            )

        phi0 = math.acos(1 - height / bowl)
        c_path, c_time = _timed(cycloid, y0, g, points=121)
        b_path, b_time = _timed(_bowl(bowl, phi0, r), -2 * r + height, g, points=121)
        starts.append(ValleyStart(height, c_path, b_path, c_time, b_time))
    return Valley(r, bowl, math.pi * math.sqrt(r / g), tuple(starts))


def _bowl(bowl: float, phi0: float, r: float):
    """A circular bowl of radius ``bowl`` whose bottom is the cycloid's, from
    ``phi0`` up the left side down to the bottom."""

    def shape(p: float) -> Shape:
        phi = phi0 * (1 - p)
        return (
            -bowl * math.sin(phi),
            -2 * r + bowl * (1 - math.cos(phi)),
            bowl * math.cos(phi) * phi0,
            -bowl * math.sin(phi) * phi0,
        )

    return shape
