"""The engine's stepping: the classical Runge–Kutta step every time loop takes,
the sampling of a run and the bounds every stepped run keeps.

These lived in ``pendulum.py``, the first exhibit to step, and fifteen modules
imported the pendulum for them. An exhibit's check holds for the code of every
engine module it imports (``domain/checks``, the fingerprint), so a change to
the pendulum's own physics (its AGM, Jacobi's functions) unchecked all fifteen,
though only the pendulum wave and the harmonograph use that physics. Here a
change unchecks the exhibits that step, as it should, and nothing else.

:func:`rk4` takes any system of first-order equations ``y' = f(t, y)`` over a
flat tuple; :func:`rk4_second_order` is the same step for ``x'' = a(x, x')``
kept as two lists, positions and speeds, which the contact models (the ball
cannon, Newton's cradle) step at a microsecond, where packing and unpacking a
flat state each stage would cost more than the step. Both are the textbook's
step to the bit: ``y + (h/2)·k`` for the half steps, ``y + h·k`` for the last,
``y + (h/6)·(k₁ + 2k₂ + 2k₃ + k₄)`` to finish, each sum taken left to right.
``tests/unit/ode.py`` is the tests' own, independent RK4.

What it deliberately does not hold: physical constants (``constants.py``,
meant never to change), adaptive steps, or anything an exhibit tunes for
itself (most choose their own step and sampling rate). Nor every RK4 step in
the engine: the funnel, the gyroscope, the elephant's ball, the diver, the
cannon's free flight and the resonance rack keep theirs written out, because
over a state of two to four numbers with a cheap right-hand side the generic
step's tuples and calls cost 20 % to twice the time of the whole step
(measured 2026-11-22), and those loops run under a request's budget.
"""

from __future__ import annotations

from collections.abc import Callable

#: The default step of the stepped pendulums (the plane pendulum, the
#: harmonograph, the coupled pendulums, the interrupted pendulum, the double
#: pendulum, the rolling cone): 1 ms is a thousand steps a second, and the
#: shortest pendulum here swings in about half a second.
STEP_S = 1e-3

#: Samples a run returns per second, whatever its step.
SAMPLES_PER_S = 50

#: The longest run the engine takes, so a request cannot ask for an hour.
MAX_DURATION_S = 300.0

Rhs = Callable[[float, tuple[float, ...]], tuple[float, ...]]

#: ``a(x, v)``: the accelerations of a second-order system, one per position.
Accelerations = Callable[[list[float], list[float]], list[float]]


def rk4(f: Rhs, t: float, y: tuple[float, ...], h: float) -> tuple[float, ...]:
    """One classical Runge–Kutta step of ``y' = f(t, y)``."""
    n = len(y)
    k1 = f(t, y)
    k2 = f(t + h / 2, tuple(y[i] + h / 2 * k1[i] for i in range(n)))
    k3 = f(t + h / 2, tuple(y[i] + h / 2 * k2[i] for i in range(n)))
    k4 = f(t + h, tuple(y[i] + h * k3[i] for i in range(n)))
    return tuple(y[i] + h / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]) for i in range(n))


def rk4_second_order(
    accelerations: Accelerations, x: list[float], v: list[float], h: float
) -> tuple[list[float], list[float]]:
    """One classical Runge–Kutta step of ``x'' = a(x, x')``, positions and
    speeds in two lists: :func:`rk4` over ``(x, v)`` to the bit, the speeds
    of each stage being the positions' rates."""
    n = len(x)
    a1 = accelerations(x, v)
    x2 = [x[i] + h / 2 * v[i] for i in range(n)]
    v2 = [v[i] + h / 2 * a1[i] for i in range(n)]
    a2 = accelerations(x2, v2)
    x3 = [x[i] + h / 2 * v2[i] for i in range(n)]
    v3 = [v[i] + h / 2 * a2[i] for i in range(n)]
    a3 = accelerations(x3, v3)
    x4 = [x[i] + h * v3[i] for i in range(n)]
    v4 = [v[i] + h * a3[i] for i in range(n)]
    a4 = accelerations(x4, v4)
    nx = [x[i] + h / 6 * (v[i] + 2 * v2[i] + 2 * v3[i] + v4[i]) for i in range(n)]
    nv = [v[i] + h / 6 * (a1[i] + 2 * a2[i] + 2 * a3[i] + a4[i]) for i in range(n)]
    return nx, nv


def check_run(duration_s: float, step_s: float) -> None:
    """A run's bounds: a step up to 10 ms, a run up to :data:`MAX_DURATION_S`."""
    if not 0 < step_s <= 0.01:
        raise ValueError("the step lies between 0 and 10 ms")
    if not 0 < duration_s <= MAX_DURATION_S:
        raise ValueError(f"a run lasts more than nothing and at most {MAX_DURATION_S:g} s")


def sample_every(step_s: float) -> int:
    """Steps between two samples: :data:`SAMPLES_PER_S` a second."""
    return max(1, round(1 / (SAMPLES_PER_S * step_s)))
