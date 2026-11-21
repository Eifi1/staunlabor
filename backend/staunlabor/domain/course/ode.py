"""The integrators the numerics lesson compares.

Explicit Euler, Heun, classical Runge–Kutta (and one RK4 step laid open, so the
numerics lesson can print ``k₁…k₄`` as a table), implicit Euler for a linear
system, and the semi-implicit ("symplectic") Euler for a mechanical one. Each
takes a right-hand side ``f(t, y) → ẏ`` over plain lists of floats and returns a
:class:`Trace`.

**Why the course's own integrators rather than the textbook's results.** The
numerics lesson exists to show what a method *does* to an equation — Euler
pumping energy into a lightly damped shaft, RK4 losing nothing visible at the
same step, a stiff pair forcing an explicit method into ten thousand steps —
and a closed form of what each method would do is a second statement of the
same thing that can drift from the first. Here the plotted points are the
method's own, and ``tests/unit/test_course.py`` holds them to the textbook:
global order one, two and four, the stability bound ``h < 2τ``, the
amplification ``|1 + hλ|``.

What this is not: a general-purpose solver library. No adaptive step (the
Dormand–Prince pair Kurvenschmiede's vacuum lesson runs on stayed there with
that lesson), no dense output, no Jacobians for nonlinear implicit methods — a
lesson about step size cannot have the step size chosen for it.
"""

from __future__ import annotations

import math
from collections.abc import Callable, Sequence
from dataclasses import dataclass

from staunlabor.domain.course.linalg import solve

#: ``f(t, y) → ẏ``, both lists of the state's length.
Rhs = Callable[[float, Sequence[float]], Sequence[float]]

#: The most steps a fixed-step run may take. A slider can ask for a step of a
#: tenth of a millisecond over thirty seconds; three hundred thousand Python RK4
#: steps is seconds of one request thread, so the caller is told instead.
MAX_STEPS = 200_000


@dataclass(frozen=True)
class Trace:
    """A solution: the times, and one list of values per state component.

    ``states[i][k]`` is component ``i`` at ``t[k]``. Column-major because what a
    chart wants is one series per component, and that is what this already is.
    """

    t: tuple[float, ...]
    states: tuple[tuple[float, ...], ...]


@dataclass(frozen=True)
class Rk4Stage:
    """One of the four slopes of a classical Runge–Kutta step: where it was
    evaluated, the state it was evaluated at, and the slope found there."""

    t: float
    y: tuple[float, ...]
    slope: tuple[float, ...]


@dataclass(frozen=True)
class Rk4Step:
    """One RK4 step laid open: the four stages and the weighted mean that moves
    the state, ``y₊ = y + h/6·(k₁ + 2k₂ + 2k₃ + k₄)``."""

    t: float
    h: float
    y: tuple[float, ...]
    stages: tuple[Rk4Stage, Rk4Stage, Rk4Stage, Rk4Stage]
    y_next: tuple[float, ...]


def _steps(h: float, t_end: float, t0: float) -> int:
    if not h > 0:
        raise ValueError("The step size must be positive.")
    if not t_end > t0:
        raise ValueError("The end time must lie after the start.")
    n = math.ceil((t_end - t0) / h - 1e-9)
    if n > MAX_STEPS:
        raise ValueError(f"{n} steps is more than the {MAX_STEPS} one run may take; choose a larger step.")
    return n


def _trace(ts: list[float], ys: list[list[float]]) -> Trace:
    return Trace(tuple(ts), tuple(tuple(col) for col in zip(*ys, strict=True)))


def _fixed(
    advance: Callable[[float, list[float], float], list[float]],
    y0: Sequence[float],
    h: float,
    t_end: float,
    t0: float,
    sample_every: int,
) -> Trace:
    n = _steps(h, t_end, t0)
    y = [float(v) for v in y0]
    ts, ys = [t0], [y]
    t = t0
    for k in range(1, n + 1):
        # The last step lands on t_end exactly rather than one rounding past it,
        # so a lesson's "after two steps" is the value at two steps.
        step = min(h, t_end - t) if k == n else h
        y = advance(t, y, step)
        t = t0 + k * h if k < n else t_end
        if k % sample_every == 0 or k == n:
            ts.append(t)
            ys.append(y)
    return _trace(ts, ys)


def euler(f: Rhs, y0: Sequence[float], h: float, t_end: float, t0: float = 0.0, sample_every: int = 1) -> Trace:
    """Explicit Euler: ``y₊ = y + h·f(t, y)``. First order, and on ``ẏ = λy``
    stable only while ``|1 + hλ| ≤ 1``."""

    def advance(t: float, y: list[float], step: float) -> list[float]:
        return [a + step * b for a, b in zip(y, f(t, y), strict=True)]

    return _fixed(advance, y0, h, t_end, t0, sample_every)


def heun(f: Rhs, y0: Sequence[float], h: float, t_end: float, t0: float = 0.0, sample_every: int = 1) -> Trace:
    """Heun's method: an Euler predictor, then the mean of the two slopes. Second order."""

    def advance(t: float, y: list[float], step: float) -> list[float]:
        k1 = f(t, y)
        pred = [a + step * b for a, b in zip(y, k1, strict=True)]
        k2 = f(t + step, pred)
        return [a + step / 2 * (b + c) for a, b, c in zip(y, k1, k2, strict=True)]

    return _fixed(advance, y0, h, t_end, t0, sample_every)


def rk4_step(f: Rhs, t: float, y: Sequence[float], h: float) -> Rk4Step:
    """One classical Runge–Kutta step with its four stages kept."""
    y = [float(v) for v in y]
    k1 = list(f(t, y))
    y2 = [a + h / 2 * b for a, b in zip(y, k1, strict=True)]
    k2 = list(f(t + h / 2, y2))
    y3 = [a + h / 2 * b for a, b in zip(y, k2, strict=True)]
    k3 = list(f(t + h / 2, y3))
    y4 = [a + h * b for a, b in zip(y, k3, strict=True)]
    k4 = list(f(t + h, y4))
    nxt = [a + h / 6 * (b + 2 * c + 2 * d + e) for a, b, c, d, e in zip(y, k1, k2, k3, k4, strict=True)]
    return Rk4Step(
        t=t,
        h=h,
        y=tuple(y),
        stages=(
            Rk4Stage(t, tuple(y), tuple(k1)),
            Rk4Stage(t + h / 2, tuple(y2), tuple(k2)),
            Rk4Stage(t + h / 2, tuple(y3), tuple(k3)),
            Rk4Stage(t + h, tuple(y4), tuple(k4)),
        ),
        y_next=tuple(nxt),
    )


def rk4(f: Rhs, y0: Sequence[float], h: float, t_end: float, t0: float = 0.0, sample_every: int = 1) -> Trace:
    """Classical fourth-order Runge–Kutta at a fixed step."""

    def advance(t: float, y: list[float], step: float) -> list[float]:
        k1 = f(t, y)
        k2 = f(t + step / 2, [a + step / 2 * b for a, b in zip(y, k1, strict=True)])
        k3 = f(t + step / 2, [a + step / 2 * b for a, b in zip(y, k2, strict=True)])
        k4 = f(t + step, [a + step * b for a, b in zip(y, k3, strict=True)])
        return [a + step / 6 * (b + 2 * c + 2 * d + e) for a, b, c, d, e in zip(y, k1, k2, k3, k4, strict=True)]

    return _fixed(advance, y0, h, t_end, t0, sample_every)


def symplectic_euler(
    accel: Callable[[float, float, float], float],
    x0: float,
    v0: float,
    h: float,
    t_end: float,
    sample_every: int = 1,
) -> Trace:
    """Semi-implicit Euler for ``ẍ = a(t, x, v)``: the velocity first, then the
    position with the *new* velocity. Still first order, but on an undamped
    oscillator it neither gains nor loses energy over a period — the step that
    makes explicit Euler spiral outwards turns a circle into a slightly tilted
    ellipse instead. States are ``(x, v)``."""

    def advance(t: float, y: list[float], step: float) -> list[float]:
        x, v = y
        v = v + step * accel(t, x, v)
        return [x + step * v, v]

    return _fixed(advance, (x0, v0), h, t_end, 0.0, sample_every)


def implicit_euler_linear(
    a: Sequence[Sequence[float]],
    b: Callable[[float], Sequence[float]],
    y0: Sequence[float],
    h: float,
    t_end: float,
    t0: float = 0.0,
    sample_every: int = 1,
) -> Trace:
    """Implicit Euler for ``ẏ = A·y + b(t)``: ``(I − hA)·y₊ = y + h·b(t₊)``.

    Stable for every step on every stable linear system, which is the whole
    lesson about stiffness: the step is then chosen by the accuracy the slow part
    needs, not by the stability the fast part demands. ``(I − hA)`` is inverted
    once — column by column through :func:`.linalg.solve` — and every step is
    then a product, so thirty thousand steps cost what thirty thousand
    multiplications of a small matrix cost.
    """
    n = len(y0)

    def inverse(step: float) -> list[list[float]]:
        m = [[(1.0 if i == j else 0.0) - step * float(a[i][j]) for j in range(n)] for i in range(n)]
        cols = [[v.real for v in solve(m, [1.0 if i == j else 0.0 for i in range(n)])] for j in range(n)]
        return [[cols[j][i] for j in range(n)] for i in range(n)]

    full = inverse(h)

    def advance(t: float, y: list[float], step: float) -> list[float]:
        inv = full if step == h else inverse(step)
        rhs = [y[i] + step * float(bi) for i, bi in enumerate(b(t + step))]
        return [sum(inv[i][j] * rhs[j] for j in range(n)) for i in range(n)]

    return _fixed(advance, y0, h, t_end, t0, sample_every)
