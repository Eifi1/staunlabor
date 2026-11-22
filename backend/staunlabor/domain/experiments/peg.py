"""Galileo's interrupted pendulum: the path changes, the height does not.

The exhibit is a pendulum whose string, as it swings through the bottom, is
caught by a peg below the pivot. The bob goes on round a smaller circle about
the peg — and still rises to the height it was let go from. With the peg low
enough it cannot: the string goes slack and the bob falls inward, or it swings
right over the peg.

**The model.** A bob on a light string of length ``L`` from the pivot; a peg a
depth ``d`` below it, so the string round the peg is ``r = L − d`` long. Three
ways to move, one at a time:

* **round the pivot** (``big``): the plane pendulum, ``θ'' = −(g/L)·sin θ``;
* **round the peg** (``small``): ``φ'' = −(g/r)·sin φ``, from the moment the
  string, swinging through the vertical, meets the peg — the bob's speed kept,
  so ``r·φ' = L·θ'``; back round the pivot when it swings back through the
  vertical, unless it has gone over the top, when the string is wound round
  the peg for good;
* **free** (``free``): when the string would have to push — ``r·φ'² + g·cos φ``,
  its pull per kilogram, falls to zero — the bob flies as a stone thrown, until
  the string round the peg is straight again. Then it jerks taut, and the bob
  loses the speed it had along the string: the one place energy is lost. In
  flight the string follows the bob round the peg: should the bob fly over the
  peg to the other side, the string is wound round it, and stays so; should it
  fly under the peg, the string comes off it and the bob hangs from the pivot
  again, the string taut at ``L``. (The first version took every taut string
  as round the peg and unwound: a bob let go from the horizontal over a peg at
  0.55 m flew over the peg and was then swung as a 1 m pendulum again; found
  in the mathematics check, 2026-11-17.)

Each switch is found within its step and the step split there (bisection on the
stepped state), so an event lands where it belongs, not up to a step late.

**What it shows.** Round the peg the bob rises exactly to the height it fell
from: energy, not the path, decides the height. It goes over the top when that
height, from the bottom, is at least ``2.5·r`` (at the top it still needs
``√(g·r)``); below that but above the peg, the string goes slack at the height
``(r + 2h)/3``.

**What it leaves out.** The peg's thickness, a string that stretches, air.
"""

from __future__ import annotations

import enum
import math
from collections.abc import Callable
from dataclasses import dataclass, replace

from staunlabor.domain.experiments.constants import G
from staunlabor.domain.experiments.numerics import STEP_S, check_run, rk4, sample_every

#: Halvings that find an event within its step: 2⁻⁴⁰ of a millisecond.
BISECTIONS = 40


class Mode(enum.StrEnum):
    BIG = "big"
    SMALL = "small"
    FREE = "free"


class Event(enum.StrEnum):
    CAUGHT = "caught"
    RELEASED = "released"
    SLACK = "slack"
    TAUT = "taut"
    OVER_THE_TOP = "over_the_top"
    #: In flight, over the peg to the other side: the string wound round it.
    WOUND = "wound"


@dataclass(frozen=True)
class PegPendulum:
    length_m: float = 1.0
    #: d: how far below the pivot the peg is.
    peg_depth_m: float = 0.5
    #: How far the bob is let go, from the vertical.
    start_deg: float = 30.0

    def __post_init__(self) -> None:
        if not 0.1 <= self.length_m <= 10.0:
            raise ValueError("the string is between 10 cm and 10 m long")
        if not 0 < self.peg_depth_m < self.length_m:
            raise ValueError("the peg sits below the pivot and above the bob")
        if not 0 < self.start_deg <= 90:
            raise ValueError("the bob is let go from more than nothing and at most 90°")

    @property
    def small_radius_m(self) -> float:
        return self.length_m - self.peg_depth_m


@dataclass(frozen=True)
class PegState:
    mode: Mode
    #: round the pivot: (θ, θ'); round the peg: (φ, φ'); free: (x, y, vx, vy).
    y: tuple[float, ...]
    #: Gone over the top: the string is wound round the peg for good.
    wound: bool = False
    #: Free with the string still bent at the peg: the bob's angle round it,
    #: unwrapped from where the string went slack; ``None`` once it has come
    #: off the peg, and in the other modes.
    around: float | None = None


def start(p: PegPendulum) -> PegState:
    return PegState(Mode.BIG, (math.radians(p.start_deg), 0.0))


def position(p: PegPendulum, s: PegState) -> tuple[float, float]:
    """The bob, the pivot at the origin, y up."""
    if s.mode is Mode.BIG:
        return p.length_m * math.sin(s.y[0]), -p.length_m * math.cos(s.y[0])
    if s.mode is Mode.SMALL:
        r = p.small_radius_m
        return r * math.sin(s.y[0]), -p.peg_depth_m - r * math.cos(s.y[0])
    return s.y[0], s.y[1]


def _rhs(p: PegPendulum, mode: Mode) -> Callable[[float, tuple[float, ...]], tuple[float, ...]]:
    if mode is Mode.FREE:
        return lambda _t, y: (y[2], y[3], 0.0, -G)
    w2 = G / (p.length_m if mode is Mode.BIG else p.small_radius_m)
    return lambda _t, y: (y[1], -w2 * math.sin(y[0]))


def _locate(f, t: float, y0: tuple[float, ...], h: float, event: Callable[[tuple[float, ...]], float]) -> float:
    """The share of the step at which ``event`` changes sign, by bisection on
    the stepped state."""
    lo, hi = 0.0, h
    e0 = event(y0)
    for _ in range(BISECTIONS):
        mid = (lo + hi) / 2
        if (event(rk4(f, t, y0, mid)) > 0) == (e0 > 0):
            lo = mid
        else:
            hi = mid
    return hi


def _turn(p: PegPendulum, a: tuple[float, ...], b: tuple[float, ...]) -> float:
    """How far the bob turned round the peg from ``a`` to ``b`` (free states),
    the shorter way: a step is far too short to turn half round."""
    d = p.peg_depth_m
    turn = math.atan2(b[0], -(b[1] + d)) - math.atan2(a[0], -(a[1] + d))
    return turn - 2 * math.pi * math.floor((turn + math.pi) / (2 * math.pi))


def _taut(p: PegPendulum, free: PegState, y: tuple[float, ...]) -> tuple[PegState, tuple[Event, ...]]:
    """The string jerks taut on the bob at ``y``, flying from ``free``: only
    the speed across the string is kept. Off the peg it hangs from the pivot;
    on it, its angle round the peg is the one the flight turned to, and past
    half a turn the string is wound."""
    x, z, vx, vy = y
    if free.around is None:
        theta = math.atan2(x, -z)
        rate = (vx * math.cos(theta) + vy * math.sin(theta)) / p.length_m
        return PegState(Mode.BIG, (theta, rate)), (Event.TAUT,)
    raw = math.atan2(x, -(z + p.peg_depth_m))
    around = free.around + _turn(p, free.y, y)
    phi = raw + 2 * math.pi * round((around - raw) / (2 * math.pi))
    rate = (vx * math.cos(phi) + vy * math.sin(phi)) / p.small_radius_m
    wound = free.wound or abs(phi) > math.pi
    kinds = (Event.TAUT, Event.WOUND) if wound and not free.wound else (Event.TAUT,)
    return PegState(Mode.SMALL, (phi, rate), wound), kinds


def _stretch(p: PegPendulum, free: PegState) -> Callable[[tuple[float, ...]], float]:
    """How far the bob is past the string's reach, flying from ``free``: round
    the peg while the string is bent at it, from the pivot once it is off."""
    if free.around is None:
        return lambda y: y[0] ** 2 + y[1] ** 2 - p.length_m**2
    r = p.small_radius_m
    return lambda y: y[0] ** 2 + (y[1] + p.peg_depth_m) ** 2 - r * r


def _comes_off(p: PegPendulum, free: PegState, y1: tuple[float, ...]) -> bool:
    """Whether the bob, flying from ``free`` to ``y1``, passes under the peg
    to the other side, where the string comes off it: its angle round the peg
    through zero. A wound string stays."""
    return free.around is not None and not free.wound and free.around * (free.around + _turn(p, free.y, y1)) < 0


def _flown(p: PegPendulum, free: PegState, y1: tuple[float, ...]) -> PegState:
    """``free`` flown on to ``y1``, its angle round the peg kept up."""
    around = None if free.around is None else free.around + _turn(p, free.y, y1)
    return replace(free, y=y1, around=around)


def _crossed(a: float, b: float) -> bool:
    return (a > 0 and b < 0) or (a < 0 and b > 0)


Happening = tuple[float, Event, float, float]


def step(p: PegPendulum, s: PegState, t: float, h: float) -> tuple[PegState, list[Happening]]:
    """One step of ``h`` from ``s`` at ``t``, split at whatever happens in it;
    what happened, with when and where the bob was."""
    events: list[Happening] = []
    left = h
    r = p.small_radius_m

    def pull(y: tuple[float, ...]) -> float:
        return r * y[1] ** 2 + G * math.cos(y[0])

    for _ in range(4):  # at most a few switches in one step
        f = _rhs(p, s.mode)
        y1 = rk4(f, t, s.y, left)
        if s.mode is Mode.BIG:
            if _crossed(s.y[0], y1[0]):
                tau = _locate(f, t, s.y, left, lambda y: y[0])
                y = rk4(f, t, s.y, tau)
                s = PegState(Mode.SMALL, (0.0, y[1] * p.length_m / r), s.wound)
                t, left = t + tau, left - tau
                events.append((t, Event.CAUGHT, *position(p, s)))
                continue
            return replace(s, y=y1), events
        if s.mode is Mode.SMALL:
            if pull(s.y) > 0 and pull(y1) < 0:
                tau = _locate(f, t, s.y, left, pull)
                phi, rate = rk4(f, t, s.y, tau)
                x, z = r * math.sin(phi), -p.peg_depth_m - r * math.cos(phi)
                s = PegState(Mode.FREE, (x, z, r * rate * math.cos(phi), r * rate * math.sin(phi)), s.wound, phi)
                t, left = t + tau, left - tau
                events.append((t, Event.SLACK, *position(p, s)))
                continue
            if not s.wound and abs(y1[0]) > math.pi >= abs(s.y[0]):
                wound = PegState(Mode.SMALL, y1, wound=True)
                events.append((t + left, Event.OVER_THE_TOP, *position(p, wound)))
                return wound, events
            if not s.wound and _crossed(s.y[0], y1[0]):
                tau = _locate(f, t, s.y, left, lambda y: y[0])
                y = rk4(f, t, s.y, tau)
                s = PegState(Mode.BIG, (0.0, y[1] * r / p.length_m))
                t, left = t + tau, left - tau
                events.append((t, Event.RELEASED, *position(p, s)))
                continue
            return replace(s, y=y1), events

        # Free, the string still bent at the peg: under the peg to the other
        # side (its angle round the peg through zero), it comes off.
        if _comes_off(p, s, y1):
            tau = _locate(f, t, s.y, left, lambda y: y[0])
            s = PegState(Mode.FREE, rk4(f, t, s.y, tau))
            t, left = t + tau, left - tau
            events.append((t, Event.RELEASED, *position(p, s)))
            continue
        # Until the string is straight again: round the peg, or from the pivot.
        tight = _stretch(p, s)
        if tight(s.y) < 0 and tight(y1) >= 0:
            tau = _locate(f, t, s.y, left, tight)
            s, kinds = _taut(p, s, rk4(f, t, s.y, tau))
            t, left = t + tau, left - tau
            events.extend((t, kind, *position(p, s)) for kind in kinds)
            continue
        return _flown(p, s, y1), events
    return s, events


@dataclass(frozen=True)
class PegRun:
    t: tuple[float, ...]
    x_m: tuple[float, ...]
    y_m: tuple[float, ...]
    #: 0 round the pivot, 1 round the peg, 2 free.
    mode: tuple[int, ...]
    #: What happened: when, what, and where the bob was (x, y).
    events: tuple[tuple[float, str, float, float], ...]
    #: The highest the bob rose while round the peg or free, from the bottom.
    peg_side_top_m: float | None
    over_the_top: bool
    went_slack: bool


_MODE_CODE = {Mode.BIG: 0, Mode.SMALL: 1, Mode.FREE: 2}


def run(p: PegPendulum, duration_s: float, step_s: float = STEP_S) -> PegRun:
    check_run(duration_s, step_s)
    s = start(p)
    steps = round(duration_s / step_s)
    every = sample_every(step_s)
    ts: list[float] = []
    xs: list[float] = []
    ys: list[float] = []
    modes: list[int] = []
    events: list[tuple[float, str, float, float]] = []
    top: float | None = None
    for i in range(steps + 1):
        t = i * step_s
        x, y = position(p, s)
        if s.mode is not Mode.BIG:
            top = y + p.length_m if top is None else max(top, y + p.length_m)
        if i % every == 0:
            ts.append(t)
            xs.append(x)
            ys.append(y)
            modes.append(_MODE_CODE[s.mode])
        if i < steps:
            s, happened = step(p, s, t, step_s)
            events.extend((at, str(kind), x_at, y_at) for at, kind, x_at, y_at in happened)
    return PegRun(
        t=tuple(ts),
        x_m=tuple(xs),
        y_m=tuple(ys),
        mode=tuple(modes),
        events=tuple(events),
        peg_side_top_m=top,
        over_the_top=any(e[1] == Event.OVER_THE_TOP for e in events),
        went_slack=any(e[1] == Event.SLACK for e in events),
    )


def start_height_m(p: PegPendulum) -> float:
    """``h = L·(1 − cos θ₀)``: how high above the bottom the bob is let go."""
    return p.length_m * (1 - math.cos(math.radians(p.start_deg)))


def outcome(p: PegPendulum) -> str:
    """What the energy allows round the peg: ``"same_height"`` while ``h ≤ r``,
    ``"over_the_top"`` from ``h ≥ 2.5·r``, ``"slack"`` between."""
    h, r = start_height_m(p), p.small_radius_m
    if h <= r:
        return "same_height"
    return "over_the_top" if h >= 2.5 * r else "slack"


def slack_height_m(p: PegPendulum) -> float | None:
    """Where the string goes slack, from the bottom: ``(r + 2h)/3``; ``None``
    where it does not."""
    return (p.small_radius_m + 2 * start_height_m(p)) / 3 if outcome(p) == "slack" else None
