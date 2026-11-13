"""The ball cannon: balls stacked and dropped, and the small one on top flying off.

The exhibit: three elastomer balls of about 10, 7 and 5 cm, threaded on a
steel wire that keeps them in a line,
dropped stacked from a height. The bottom ball meets the floor and squashes,
the one above it squashes into it while still coming down, and so on up the
stack; the small ball on top leaves far faster than the stack arrived and
climbs far higher than it fell. The textbook calls it the "Galilean cannon":
the small ball is shot straight up, as if out of a barrel. The page lets the
reader stack one, two or three balls, change their sizes, the height, the gaps,
how springy they are and how stiff.

**The model is one line of balls** (the wire's job, so the wire itself is left
out), each a solid elastomer sphere of the stated diameter
and a density of 1100 kg/m³, numbered from the bottom. Every ball moves by
Newton's second law, all of them at once — one system of ordinary differential
equations:

    m_i·ÿ_i = −m_i·g − ½·ρ·C_d·A_i·ẏ_i·|ẏ_i| + F_i − F_{i+1}

with ``F_i`` the force in the contact under ball ``i`` (the floor's for the
bottom one) and ``F_{i+1}`` the one above it, which pushes it down.

**A contact is Hertz's** (two elastic spheres, or a sphere on a flat rigid
floor): pressed into each other by an overlap ``δ``, they push apart with
``K·δ^{3/2}``, ``K = (4/3)·E*·√R*`` from the elastomer's Young's modulus and
Poisson's ratio (0.5, rubber's) and the radii. It is damped as Flores et al.
(2011) give it, ``F = K·δ^{3/2}·(1 + 8(1 − e)/(5e)·δ̇/δ̇₀)``, ``δ̇₀`` the speed
the contact closed at, so that a contact gives back the share ``e`` of its
closing speed that the slider sets — 0.85 for elastomer, a guess. A contact
lasts a few milliseconds, and in a stack they overlap: the middle ball is
already pressing into the bottom one while that one is still squashing into
the floor. That is what the instantaneous hits of the textbook leave out, and
what makes the real cannon weaker than its formula.

**Stepped with RK4**: 0.5 ms while every ball flies free, 10 µs while a contact
is closed or about to close — fifty small steps for one large one, so the time
grid stays the same. A large step that would close a contact it did not see
coming is taken again in small ones.

**What it shows besides the climb:** each contact's force over time, its peak,
how far the balls squash and the impulse it passes on.

**What the textbook says**, for comparison: with each ball much lighter than
the one below and no losses, the bottom ball comes back up at the speed ``v`` it
arrived with, the second leaves at ``3v``, the third at ``7v`` — ``(2ⁿ − 1)·v`` —
and a ball leaving at ``7v`` climbs 49 times the height it fell.

What it leaves out: the wire's friction, the balls' spin, and an elastomer's
real, speed-dependent damping.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

G = 9.80665
RHO = 1.2
#: A sphere's drag coefficient, in the range of speeds the balls fly at.
CD = 0.47
#: Rubber's Poisson's ratio: nearly incompressible.
POISSON = 0.5
#: The step while every ball flies free, and while a contact is closed.
STEP_S = 5e-4
SUBSTEPS = 50
CONTACT_STEP_S = STEP_S / SUBSTEPS
SAMPLES_PER_S = 100
MAX_S = 12.0
#: A contact closing slower than this damps as if it closed at this speed.
MIN_CLOSING_M_S = 0.01
#: The forces over the stack's impact: every this many small steps, for this long after it begins.
IMPACT_EVERY = 10
IMPACT_WINDOW_S = 0.03
#: How long the stack's impact may last before the top ball's launch is read anyway.
LAUNCH_WINDOW_S = 0.5


@dataclass(frozen=True)
class Ball:
    diameter_m: float
    #: A solid elastomer ball's; a hollow one is lighter for its size.
    density_kg_m3: float = 1100.0

    def __post_init__(self) -> None:
        if not 0.01 <= self.diameter_m <= 0.40:
            raise ValueError("a ball is between 1 and 40 cm across")
        if not 50.0 <= self.density_kg_m3 <= 20000.0:
            raise ValueError("a ball's density is between 50 and 20 000 kg/m³")

    @property
    def mass_kg(self) -> float:
        return self.density_kg_m3 * math.pi / 6 * self.diameter_m**3

    @property
    def drag_per_m(self) -> float:
        """``k`` in the drag's deceleration ``k·v·|v|``: ``ρ·C_d·A / (2m)``."""
        return RHO * CD * math.pi * self.diameter_m**2 / 4 / (2 * self.mass_kg)


@dataclass(frozen=True)
class BallStack:
    #: Bottom first.
    balls: tuple[Ball, ...] = (Ball(0.10), Ball(0.07), Ball(0.05))
    #: How high the bottom ball's underside is when the stack is let go.
    drop_m: float = 1.0
    #: The gap between two neighbours when the stack is let go.
    gap_m: float = 0.0
    floor_restitution: float = 0.85
    ball_restitution: float = 0.85
    #: The elastomer's Young's modulus: a guess, soft rubber being 1 to 10 MPa.
    youngs_mpa: float = 3.0

    def __post_init__(self) -> None:
        if not 1 <= len(self.balls) <= 3:
            raise ValueError("a stack is one, two or three balls")
        if not 0.05 <= self.drop_m <= 3.0:
            raise ValueError("the stack is dropped from between 5 cm and 3 m")
        if not 0.0 <= self.gap_m <= 0.10:
            raise ValueError("the gap between two balls is between 0 and 10 cm")
        for e in (self.floor_restitution, self.ball_restitution):
            if not 0.3 <= e <= 1.0:
                raise ValueError("a coefficient of restitution is between 0.3 and 1 here")
        if not 0.5 <= self.youngs_mpa <= 200.0:
            raise ValueError("the elastomer's Young's modulus is between 0.5 and 200 MPa")


# ── the contacts ─────────────────────────────────────────────────────────────


def stiffness(stack: BallStack, c: int) -> float:
    """Hertz's ``K`` of contact ``c`` (0 the floor under the bottom ball, ``c`` the
    balls ``c−1`` and ``c``): ``(4/3)·E*·√R*``. The floor is rigid, so ``E*`` is
    the ball's ``E/(1 − ν²)``; two balls of one elastomer halve it."""
    e_ball = stack.youngs_mpa * 1e6 / (1 - POISSON**2)
    if c == 0:
        return 4 / 3 * e_ball * math.sqrt(stack.balls[0].diameter_m / 2)
    ra, rb = stack.balls[c - 1].diameter_m / 2, stack.balls[c].diameter_m / 2
    return 4 / 3 * (e_ball / 2) * math.sqrt(ra * rb / (ra + rb))


def _gap(balls: tuple[Ball, ...], y: list[float], c: int) -> float:
    if c == 0:
        return y[0]
    return y[c] - (y[c - 1] + balls[c - 1].diameter_m)


def _closing(v: list[float], c: int) -> float:
    """How fast contact ``c`` closes: the overlap's rate. Positive when it does."""
    if c == 0:
        return -v[0]
    return v[c - 1] - v[c]


def _forces(stack: BallStack, ks: list[float], y: list[float], v: list[float], closed: list[float]) -> list[float]:
    """The force in every contact: Hertz's, damped as Flores gives it, never
    pulling. ``closed[c]`` is the speed contact ``c`` closed at, 0 while it is open."""
    out = []
    for c, k in enumerate(ks):
        overlap = -_gap(stack.balls, y, c)
        if overlap <= 0:
            out.append(0.0)
            continue
        rate = _closing(v, c)
        e = stack.floor_restitution if c == 0 else stack.ball_restitution
        at = closed[c] if closed[c] > 0 else max(rate, MIN_CLOSING_M_S)
        force = k * overlap**1.5 * (1 + 8 * (1 - e) / (5 * e) * rate / at)
        out.append(max(force, 0.0))
    return out


def _accelerations(
    stack: BallStack, ks: list[float], y: list[float], v: list[float], closed: list[float]
) -> list[float]:
    forces = _forces(stack, ks, y, v, closed)
    n = len(stack.balls)
    out = []
    for i, ball in enumerate(stack.balls):
        above = forces[i + 1] if i + 1 < n else 0.0
        out.append(-G - ball.drag_per_m * v[i] * abs(v[i]) + (forces[i] - above) / ball.mass_kg)
    return out


def _rk4(
    stack: BallStack, ks: list[float], y: list[float], v: list[float], closed: list[float], h: float
) -> tuple[list[float], list[float]]:
    """All the balls ``h`` on together: the system of equations, one RK4 step."""
    n = len(y)
    a1 = _accelerations(stack, ks, y, v, closed)
    y2 = [y[i] + h / 2 * v[i] for i in range(n)]
    v2 = [v[i] + h / 2 * a1[i] for i in range(n)]
    a2 = _accelerations(stack, ks, y2, v2, closed)
    y3 = [y[i] + h / 2 * v2[i] for i in range(n)]
    v3 = [v[i] + h / 2 * a2[i] for i in range(n)]
    a3 = _accelerations(stack, ks, y3, v3, closed)
    y4 = [y[i] + h * v3[i] for i in range(n)]
    v4 = [v[i] + h * a3[i] for i in range(n)]
    a4 = _accelerations(stack, ks, y4, v4, closed)
    ny = [y[i] + h / 6 * (v[i] + 2 * v2[i] + 2 * v3[i] + v4[i]) for i in range(n)]
    nv = [v[i] + h / 6 * (a1[i] + 2 * a2[i] + 2 * a3[i] + a4[i]) for i in range(n)]
    return ny, nv


# ── the drop ─────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class Contact:
    """One contact, from the moment it closes until it opens again."""

    #: 0 the floor under the bottom ball, ``c`` the balls ``c−1`` and ``c``.
    contact: int
    start_s: float
    #: None while it is still closed at the end.
    end_s: float | None
    closing_m_s: float
    #: How fast it opened; 0 while still closed.
    parting_m_s: float
    peak_force_n: float
    peak_overlap_m: float
    #: ``∫F·dt``: the momentum it passed on.
    impulse_n_s: float


@dataclass(frozen=True)
class Impact:
    """The forces as the stack meets the floor: from the moment it does, every
    :data:`IMPACT_EVERY` small steps, for :data:`IMPACT_WINDOW_S`."""

    t_ms: tuple[float, ...]
    #: Per contact, floor first.
    force_n: tuple[tuple[float, ...], ...]
    overlap_mm: tuple[tuple[float, ...], ...]
    #: Each ball's underside, bottom first: the page draws the squash from it.
    y_m: tuple[tuple[float, ...], ...]


@dataclass(frozen=True)
class Drop:
    t: tuple[float, ...]
    #: Each ball's underside above the floor, and its speed (up positive), bottom ball first.
    y_m: tuple[tuple[float, ...], ...]
    v_m_s: tuple[tuple[float, ...], ...]
    contacts: tuple[Contact, ...]
    impact: Impact


def start(stack: BallStack) -> list[float]:
    """Where each ball's underside is when the stack is let go."""
    y, at = [], stack.drop_m
    for ball in stack.balls:
        y.append(at)
        at += ball.diameter_m + stack.gap_m
    return y


class _Run:
    """The state of a drop and the bookkeeping of its contacts."""

    def __init__(self, stack: BallStack) -> None:
        n = len(stack.balls)
        self.stack = stack
        self.ks = [stiffness(stack, c) for c in range(n)]
        self.y = start(stack)
        self.v = [0.0] * n
        self.t = 0.0
        self.closed = [0.0] * n
        self.open_since: list[dict[str, float] | None] = [None] * n
        self.contacts: list[Contact] = []
        self.first: float | None = None
        self.impact_t: list[float] = []
        self.impact_f: list[list[float]] = [[] for _ in range(n)]
        self.impact_d: list[list[float]] = [[] for _ in range(n)]
        self.impact_y: list[list[float]] = [[] for _ in range(n)]
        self.small = 0

    def _imminent(self) -> bool:
        """A contact closed, or closing so that a large step would close it."""
        balls = self.stack.balls
        for c in range(len(balls)):
            gap, rate = _gap(balls, self.y, c), _closing(self.v, c)
            if gap <= 0 or (rate > 0 and gap < 2 * rate * STEP_S + 1e-6):
                return True
        return False

    def _book(self, h: float) -> None:
        """After a small step: contacts that closed, that opened, and their peaks."""
        balls = self.stack.balls
        forces = _forces(self.stack, self.ks, self.y, self.v, self.closed)
        for c in range(len(balls)):
            overlap = -_gap(balls, self.y, c)
            episode = self.open_since[c]
            if overlap > 0 and episode is None:
                rate = max(_closing(self.v, c), MIN_CLOSING_M_S)
                self.closed[c] = rate
                episode = {"start": self.t, "closing": rate, "peak": 0.0, "deep": 0.0, "impulse": 0.0}
                self.open_since[c] = episode
                if c == 0 and self.first is None:
                    self.first = self.t
            if episode is None:
                continue
            if overlap > 0:
                episode["peak"] = max(episode["peak"], forces[c])
                episode["deep"] = max(episode["deep"], overlap)
                episode["impulse"] += forces[c] * h
            else:
                self.contacts.append(
                    Contact(
                        contact=c,
                        start_s=episode["start"],
                        end_s=self.t,
                        closing_m_s=episode["closing"],
                        parting_m_s=-_closing(self.v, c),
                        peak_force_n=episode["peak"],
                        peak_overlap_m=episode["deep"],
                        impulse_n_s=episode["impulse"],
                    )
                )
                self.open_since[c] = None
                self.closed[c] = 0.0
        if self.first is not None and self.t - self.first <= IMPACT_WINDOW_S + 1e-12:
            if self.small % IMPACT_EVERY == 0:
                self.impact_t.append((self.t - self.first) * 1000)
                for c in range(len(balls)):
                    self.impact_f[c].append(forces[c])
                    self.impact_d[c].append(max(-_gap(balls, self.y, c), 0.0) * 1000)
                    self.impact_y[c].append(self.y[c])
            self.small += 1

    def step(self) -> None:
        """One step of :data:`STEP_S`: whole, or in small ones where a contact is."""
        recording = self.first is not None and self.t - self.first <= IMPACT_WINDOW_S
        if not recording and not self._imminent():
            ny, nv = _rk4(self.stack, self.ks, self.y, self.v, self.closed, STEP_S)
            if all(_gap(self.stack.balls, ny, c) > 0 for c in range(len(ny))):
                self.y, self.v = ny, nv
                self.t += STEP_S
                return
        start_t = self.t
        for k in range(1, SUBSTEPS + 1):
            self.y, self.v = _rk4(self.stack, self.ks, self.y, self.v, self.closed, CONTACT_STEP_S)
            self.t = start_t + k * CONTACT_STEP_S
            self._book(CONTACT_STEP_S)

    def still_open(self) -> list[Contact]:
        return [
            Contact(c, e["start"], None, e["closing"], 0.0, e["peak"], e["deep"], e["impulse"])
            for c, e in enumerate(self.open_since)
            if e is not None
        ]

    def impact(self) -> Impact:
        return Impact(
            t_ms=tuple(self.impact_t),
            force_n=tuple(tuple(f) for f in self.impact_f),
            overlap_mm=tuple(tuple(d) for d in self.impact_d),
            y_m=tuple(tuple(y) for y in self.impact_y),
        )


def drop(stack: BallStack, duration_s: float = 3.0) -> Drop:
    """The stack let go at rest, for ``duration_s``."""
    if not 0 < duration_s <= MAX_S:
        raise ValueError(f"a drop lasts between 0 and {MAX_S:g} s")
    run = _Run(stack)
    n = len(stack.balls)
    steps = round(duration_s / STEP_S)
    every = round(1 / (SAMPLES_PER_S * STEP_S))
    out_t: list[float] = []
    out_y: list[list[float]] = [[] for _ in range(n)]
    out_v: list[list[float]] = [[] for _ in range(n)]
    for k in range(steps + 1):
        if k % every == 0 or k == steps:
            out_t.append(k * STEP_S)
            for i in range(n):
                out_y[i].append(run.y[i])
                out_v[i].append(run.v[i])
        if k == steps:
            break
        run.step()
        run.t = (k + 1) * STEP_S
    return Drop(
        t=tuple(out_t),
        y_m=tuple(tuple(column) for column in out_y),
        v_m_s=tuple(tuple(column) for column in out_v),
        contacts=tuple(run.contacts) + tuple(run.still_open()),
        impact=run.impact(),
    )


# ── the launch and the figures ───────────────────────────────────────────────


def textbook_factor(balls: int) -> int:
    """How much faster the top ball leaves than the stack arrived, with no
    losses and each ball far lighter than the one below: ``2ⁿ − 1``."""
    return 2**balls - 1


def sequential_launch(stack: BallStack, impact_m_s: float, lossless: bool = False) -> float:
    """The top ball's speed leaving if each hit were instantaneous and over
    before the next (the textbook's model): the bottom ball comes back at ``e``
    times the impact speed, and each ball meets the next still coming down at
    it, keeping their momentum and turning their closing speed round times ``e``."""
    e_floor = 1.0 if lossless else stack.floor_restitution
    e = 1.0 if lossless else stack.ball_restitution
    up = e_floor * impact_m_s
    for lower, upper in zip(stack.balls, stack.balls[1:], strict=False):
        ml, mu = lower.mass_kg, upper.mass_kg
        up = (ml * up - mu * impact_m_s + ml * e * (up + impact_m_s)) / (ml + mu)
    return up


def _free(ball: Ball, y: float, v: float, h: float) -> tuple[float, float]:
    """One ball alone, in free flight, ``h`` on: gravity and drag, RK4."""

    def a(u: float) -> float:
        return -G - ball.drag_per_m * u * abs(u)

    a1 = a(v)
    v2 = v + h / 2 * a1
    a2 = a(v2)
    v3 = v + h / 2 * a2
    a3 = a(v3)
    v4 = v + h * a3
    a4 = a(v4)
    return y + h / 6 * (v + 2 * v2 + 2 * v3 + v4), v + h / 6 * (a1 + 2 * a2 + 2 * a3 + a4)


def _until(ball: Ball, y: float, v: float, done: object) -> tuple[float, float]:
    """One ball alone, in free flight from ``(y, v)``, until ``done(y, v)``
    first holds — the moment found by halving the step it happens in."""
    while True:
        ny, nv = _free(ball, y, v, STEP_S)
        if done(ny, nv):  # type: ignore[operator]
            lo, hi = 0.0, STEP_S
            for _ in range(48):
                mid = (lo + hi) / 2
                if done(*_free(ball, y, v, mid)):  # type: ignore[operator]
                    hi = mid
                else:
                    lo = mid
            return _free(ball, y, v, hi)
        y, v = ny, nv


def impact_speed(stack: BallStack) -> float:
    """How fast the stack meets the floor: the bottom ball's fall, drag and all."""
    return -_until(stack.balls[0], stack.drop_m, 0.0, lambda y, v: y <= 0)[1]


@dataclass(frozen=True)
class Launch:
    """What the top ball does: leaves at ``launch_m_s`` from ``launch_height_m``
    when its last contact opens, and climbs to ``apex_m``."""

    balls: int
    launch_m_s: float
    launch_height_m: float
    apex_m: float
    #: Its climb over the height the stack fell.
    times_drop: float
    #: Instantaneous hits one after another, with these losses: the textbook's model.
    sequential_launch_m_s: float
    #: The same without losses.
    ideal_launch_m_s: float
    #: No losses, each ball far lighter: ``(2ⁿ − 1)`` times the impact speed.
    textbook_launch_m_s: float


def _launched(stack: BallStack) -> tuple[_Run, float, float]:
    """The drop until the top ball has left the stack for good: its contact
    open after closing, and going up faster than the ball under it. Its speed
    and height then."""
    run = _Run(stack)
    top = len(stack.balls) - 1
    while True:
        run.step()
        if run.first is None:
            continue
        left = run.open_since[top] is None and any(c.contact == top for c in run.contacts)
        faster = top == 0 or run.v[top] > run.v[top - 1]
        if (left and faster and run.v[top] > 0) or run.t - run.first > LAUNCH_WINDOW_S:
            return run, run.v[top], run.y[top]


def launch(stack: BallStack) -> Launch:
    """The top ball's flight up: the drop until it leaves, then the ball alone
    until it turns."""
    _run, speed, height = _launched(stack)
    top = stack.balls[-1]
    apex = height
    if speed > 0:
        apex = _until(top, height, speed, lambda y, v: v <= 0)[0]
    impact = impact_speed(stack)
    return Launch(
        balls=len(stack.balls),
        launch_m_s=speed,
        launch_height_m=height,
        apex_m=apex,
        times_drop=(apex - height) / stack.drop_m,
        sequential_launch_m_s=sequential_launch(stack, impact),
        ideal_launch_m_s=sequential_launch(stack, impact, lossless=True),
        textbook_launch_m_s=textbook_factor(len(stack.balls)) * impact,
    )


@dataclass(frozen=True)
class CannonFigures:
    masses_kg: tuple[float, ...]
    impact_m_s: float
    #: The stack cut to its bottom one, two, three balls: what its top ball does.
    launches: tuple[Launch, ...]
    #: The top ball's share of the energy the stack hit the floor with, as it leaves.
    energy_share: float
    #: The whole stack's impact: every contact while the top ball is launched.
    contacts: tuple[Contact, ...]
    impact: Impact


def figures(stack: BallStack) -> CannonFigures:
    impact = impact_speed(stack)
    launches = tuple(
        launch(
            BallStack(
                stack.balls[:k],
                stack.drop_m,
                stack.gap_m,
                stack.floor_restitution,
                stack.ball_restitution,
                stack.youngs_mpa,
            )
        )
        for k in range(1, len(stack.balls) + 1)
    )
    run, _speed, _height = _launched(stack)
    # The window of forces, whole: the launch is read before it ends.
    while run.first is not None and run.t - run.first <= IMPACT_WINDOW_S:
        run.step()
    total = sum(ball.mass_kg for ball in stack.balls)
    top = stack.balls[-1].mass_kg * launches[-1].launch_m_s ** 2
    return CannonFigures(
        masses_kg=tuple(ball.mass_kg for ball in stack.balls),
        impact_m_s=impact,
        launches=launches,
        energy_share=top / (total * impact**2),
        contacts=tuple(run.contacts) + tuple(run.still_open()),
        impact=run.impact(),
    )
