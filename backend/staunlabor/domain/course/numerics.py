"""Lesson 5: what an integrator does to an equation it is solving.

Four experiments, each run with the methods in :mod:`.ode` rather than with a
formula for what those methods would do — with one exception, said where it
is made: the stiff pair's RK4 is stepped through its stability function, which
on a linear decoupled system *is* the method, multiplication for multiplication:

* the sensor of lesson 1 stepped by Euler, Heun and RK4 against the exact curve,
  with every RK4 step's four slopes laid open;
* the same sensor stepped by Euler past ``h = 2τ``, where each step overshoots
  the final value by more than it started from;
* the measuring shaft of lesson 2 let go from 1° and integrated for a second by
  Euler, semi-implicit Euler and RK4, read for the damping each method *reports*;
* a stiff pair — 1 ms and 10 s — where explicit RK4 needs ten thousand steps to
  stay stable and implicit Euler needs as many as the slow part asks for.

**The shaft's numbers correct the specification this lesson was written from.**
It said Euler at ``h = 1 ms`` ends the second at 0.98°; it ends at 1.00°, and
not by accident. Euler multiplies each eigencomponent by ``1 + hλ`` per step,
and ``|1 + hλ|² = 1 − 2hDω₀ + (hω₀)²``, which is exactly one when
``hω₀ = 2D`` — here ``0.1 = 2·0.05``. At that step Euler's numerical
anti-damping cancels the physical damping to the last digit, and the shaft rings
for ever. RK4 at the same step reproduces the exact ``0.0067°``, not ``0.0066°``.
``tests/unit/test_course.py`` holds both.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from enum import StrEnum

from staunlabor.domain.course.lti import free_decay, linspace, step_pt1
from staunlabor.domain.course.ode import (
    Rk4Step,
    Trace,
    euler,
    heun,
    implicit_euler_linear,
    rk4,
    rk4_step,
    symplectic_euler,
)

CURVE_POINTS = 241
#: How many RK4 steps are laid open as a table — more is a wall of numbers.
OPEN_STEPS = 8
#: The most steps the sensor experiment takes. A slider can ask for 0.1 s over
#: eighty seconds; the chart cannot show eight hundred polygon corners usefully.
MAX_SENSOR_STEPS = 200
#: The most points a long series is sent with.
MAX_POINTS = 2000


class EulerRegime(StrEnum):
    """What Euler does to ``τẏ + y = K·u`` at a step ``h``: creeps up
    (``h < τ``), lands on the final value in one step (``h = τ``), overshoots
    and alternates while shrinking (``τ < h < 2τ``), alternates for ever
    (``h = 2τ``) or alternates and grows (``h > 2τ``). The factor per step is
    ``1 − h/τ``."""

    monotone = "monotone"
    one_step = "one_step"
    alternating = "alternating"
    neutral = "neutral"
    diverging = "diverging"


def euler_regime(h: float, tau: float) -> EulerRegime:
    r = h / tau
    if math.isclose(r, 1.0, rel_tol=1e-9):
        return EulerRegime.one_step
    if math.isclose(r, 2.0, rel_tol=1e-9):
        return EulerRegime.neutral
    if r < 1:
        return EulerRegime.monotone
    return EulerRegime.alternating if r < 2 else EulerRegime.diverging


@dataclass(frozen=True)
class ErrorRow:
    """One step of the sensor experiment: the exact value and each method's."""

    time_s: float
    exact: float
    euler: float
    heun: float
    rk4: float


@dataclass(frozen=True)
class SensorMethods:
    """The sensor stepped three ways, the exact curve beside them.

    ``euler_factor`` is ``1 − h/τ``, what Euler multiplies the remaining
    distance by each step; ``rk4_factor`` the same for RK4, ``1 + z + z²/2 +
    z³/6 + z⁴/24`` at ``z = −h/τ`` — the Taylor series of ``e^{z}`` cut after
    four terms, which is the whole reason RK4 is fourth order.
    """

    time_constant_s: float
    step_s: float
    exact_time_s: tuple[float, ...]
    exact: tuple[float, ...]
    rows: tuple[ErrorRow, ...]
    rk4_steps: tuple[Rk4Step, ...]
    euler_factor: float
    rk4_factor: float
    regime: EulerRegime


def sensor_methods(time_constant_s: float, start: float, final: float, step_s: float, steps: int) -> SensorMethods:
    if time_constant_s <= 0 or step_s <= 0:
        raise ValueError("The time constant and the step must be positive.")
    if not 1 <= steps <= MAX_SENSOR_STEPS:
        raise ValueError(f"Take between 1 and {MAX_SENSOR_STEPS} steps.")
    tau = time_constant_s

    def f(_t: float, y: list[float]) -> tuple[float]:
        return ((final - y[0]) / tau,)

    t_end = step_s * steps
    eu = euler(f, (start,), step_s, t_end)
    he = heun(f, (start,), step_s, t_end)
    rk = rk4(f, (start,), step_s, t_end)

    def exact(t: float) -> float:
        return step_pt1(t, tau, start, final)

    rows = tuple(
        ErrorRow(t, exact(t), e, h_, r)
        for t, e, h_, r in zip(eu.t, eu.states[0], he.states[0], rk.states[0], strict=True)
    )
    opened = []
    y = (start,)
    for k in range(min(steps, OPEN_STEPS)):
        st = rk4_step(f, k * step_s, y, step_s)
        opened.append(st)
        y = st.y_next
    z = -step_s / tau
    fine = linspace(0.0, max(t_end, 6 * tau), CURVE_POINTS)
    return SensorMethods(
        time_constant_s=tau,
        step_s=step_s,
        exact_time_s=tuple(fine),
        exact=tuple(exact(t) for t in fine),
        rows=rows,
        rk4_steps=tuple(opened),
        euler_factor=1 + z,
        rk4_factor=1 + z + z * z / 2 + z**3 / 6 + z**4 / 24,
        regime=euler_regime(step_s, tau),
    )


class OscillatorMethod(StrEnum):
    exact = "exact"
    euler = "euler"
    symplectic = "symplectic"
    rk4 = "rk4"


@dataclass(frozen=True)
class MethodRun:
    """One method's second of ringing: the angle, its amplitude envelope, and
    the damping ratio the amplitude's decay says, ``D = −ln(A(T)/A(0))/(ω₀T)``
    — negative where the method made the shaft ring up."""

    method: OscillatorMethod
    time_s: tuple[float, ...]
    angle_deg: tuple[float, ...]
    amplitude_deg: tuple[float, ...]
    final_amplitude_deg: float
    damping: float | None


@dataclass(frozen=True)
class OscillatorMethods:
    """The shaft of lesson 2 let go from ``start_deg`` and integrated for
    ``duration_s``. ``euler_gain`` is ``|1 + hλ|``, Euler's growth per step;
    ``step_ratio`` is ``hω₀``, and ``euler_neutral_step_s`` the step ``2D/ω₀``
    at which Euler exactly cancels the damping."""

    step_s: float
    f0_hz: float
    damping: float
    step_ratio: float
    euler_gain: float
    euler_neutral_step_s: float
    runs: tuple[MethodRun, ...]


def _thin(n: int) -> int:
    return max(1, math.ceil(n / MAX_POINTS))


def oscillator_methods(
    step_s: float,
    inertia: float = 0.05,
    stiffness: float = 500.0,
    damping: float = 0.05,
    start_deg: float = 1.0,
    duration_s: float = 1.0,
) -> OscillatorMethods:
    if step_s <= 0 or inertia <= 0 or stiffness <= 0 or not 0 <= damping < 1:
        raise ValueError("The step, inertia and stiffness must be positive and the damping between 0 and 1.")
    w0 = math.sqrt(stiffness / inertia)
    d_coef = 2 * damping * math.sqrt(stiffness * inertia)
    sigma = damping * w0
    wd = w0 * math.sqrt(1 - damping * damping)

    def accel(_t: float, x: float, v: float) -> float:
        return (-stiffness * x - d_coef * v) / inertia

    def f(_t: float, y: list[float]) -> tuple[float, float]:
        return (y[1], accel(0.0, y[0], y[1]))

    def amplitude(x: float, v: float) -> float:
        # The envelope of the exact solution through (x, v): the amplitude of
        # the damped oscillation that state lies on.
        return math.hypot(x, (v + sigma * x) / wd)

    n = math.ceil(duration_s / step_s - 1e-9)
    every = _thin(n)
    traces: dict[OscillatorMethod, Trace] = {
        OscillatorMethod.euler: euler(f, (start_deg, 0.0), step_s, duration_s, sample_every=every),
        OscillatorMethod.symplectic: symplectic_euler(accel, start_deg, 0.0, step_s, duration_s, sample_every=every),
        OscillatorMethod.rk4: rk4(f, (start_deg, 0.0), step_s, duration_s, sample_every=every),
    }
    ts = linspace(0.0, duration_s, min(MAX_POINTS, 4 * n + 1))
    xs = [free_decay(t, start_deg, sigma, wd) for t in ts]
    vs = [-start_deg * w0 * w0 / wd * math.exp(-sigma * t) * math.sin(wd * t) for t in ts]
    traces = {OscillatorMethod.exact: Trace(tuple(ts), (tuple(xs), tuple(vs))), **traces}
    runs = []
    a0 = amplitude(start_deg, 0.0)
    for method, tr in traces.items():
        amps = tuple(amplitude(x, v) for x, v in zip(tr.states[0], tr.states[1], strict=True))
        final = amps[-1]
        d_seen = -math.log(final / a0) / (w0 * tr.t[-1]) if 0 < final < math.inf else None
        runs.append(MethodRun(method, tr.t, tr.states[0], amps, final, d_seen))
    lam = complex(-sigma, wd)
    return OscillatorMethods(
        step_s=step_s,
        f0_hz=w0 / (2 * math.pi),
        damping=damping,
        step_ratio=step_s * w0,
        euler_gain=abs(1 + step_s * lam),
        euler_neutral_step_s=2 * damping / w0,
        runs=tuple(runs),
    )


#: RK4's stability boundary on the negative real axis: ``|R(z)| ≤ 1`` for
#: ``−2.785… ≤ z ≤ 0``, the real root of ``|1 + z + z²/2 + z³/6 + z⁴/24| = 1``.
RK4_REAL_LIMIT = 2.785293563405282


@dataclass(frozen=True)
class StiffRun:
    """One method on the stiff pair: both components, whether it stayed bounded,
    and how much work it was (right-hand-side evaluations for RK4, linear solves
    for implicit Euler)."""

    time_s: tuple[float, ...]
    fast: tuple[float, ...]
    slow: tuple[float, ...]
    stable: bool
    steps: int
    work: int


@dataclass(frozen=True)
class StiffPair:
    """Two decoupled lags, ``τ_fast`` and ``τ_slow``, from 1 each, for
    ``duration_s``. ``rk4_max_step_s`` is ``2.785·τ_fast``, the largest step at
    which RK4 stays bounded, and ``rk4_min_steps`` what that costs over the
    duration — set by the part that died out in the first five milliseconds."""

    step_s: float
    fast_time_constant_s: float
    slow_time_constant_s: float
    rk4_max_step_s: float
    rk4_min_steps: int
    exact_time_s: tuple[float, ...]
    exact_slow: tuple[float, ...]
    rk4: StiffRun
    implicit: StiffRun


#: A component this large has left any reading of the problem behind; RK4 is
#: stopped there rather than run to an overflow.
_BLOWN = 1e12


def stiff_pair(step_s: float, fast_s: float = 1e-3, slow_s: float = 10.0, duration_s: float = 30.0) -> StiffPair:
    if not 0 < fast_s < slow_s:
        raise ValueError("The fast time constant must be positive and smaller than the slow one.")
    if step_s <= 0 or duration_s <= 0:
        raise ValueError("The step and the duration must be positive.")
    n = math.ceil(duration_s / step_s - 1e-9)
    every = _thin(n)

    # RK4 on a linear decoupled pair is, step for step, a multiplication of
    # each component by the method's stability function R(−h/τ) — the
    # identity, not an approximation (``tests/unit/test_course.py`` holds it
    # to :func:`.ode.rk4` step by step). Stepped that way, thirty thousand
    # steps are a loop of multiplications rather than of right-hand sides, and
    # a diverging run is stopped where it leaves any sensible range.
    def stability(z: float) -> float:
        return 1 + z + z * z / 2 + z**3 / 6 + z**4 / 24

    rf, rs = stability(-step_s / fast_s), stability(-step_s / slow_s)
    ts: list[float] = [0.0]
    fa: list[float] = [1.0]
    sl: list[float] = [1.0]
    yf = ys = 1.0
    stable = True
    done = 0
    for k in range(1, n + 1):
        last = k == n
        if last and n * step_s > duration_s:
            # The last step is shortened to land on the end, as the integrators do.
            short = duration_s - (n - 1) * step_s
            yf *= stability(-short / fast_s)
            ys *= stability(-short / slow_s)
        else:
            yf *= rf
            ys *= rs
        done = k
        if k % every == 0 or last:
            ts.append(duration_s if last else k * step_s)
            fa.append(yf)
            sl.append(ys)
        if abs(yf) > _BLOWN:
            stable = False
            if k % every != 0:
                ts.append(k * step_s)
                fa.append(yf)
                sl.append(ys)
            break
    rk4_run = StiffRun(tuple(ts), tuple(fa), tuple(sl), stable, done, 4 * done)
    imp = implicit_euler_linear(
        ((-1 / fast_s, 0.0), (0.0, -1 / slow_s)),
        lambda _t: (0.0, 0.0),
        (1.0, 1.0),
        step_s,
        duration_s,
        sample_every=every,
    )
    imp_run = StiffRun(imp.t, imp.states[0], imp.states[1], True, n, n)
    fine = linspace(0.0, duration_s, CURVE_POINTS)
    limit = RK4_REAL_LIMIT * fast_s
    return StiffPair(
        step_s=step_s,
        fast_time_constant_s=fast_s,
        slow_time_constant_s=slow_s,
        rk4_max_step_s=limit,
        rk4_min_steps=math.ceil(duration_s / limit),
        exact_time_s=tuple(fine),
        exact_slow=tuple(math.exp(-t / slow_s) for t in fine),
        rk4=rk4_run,
        implicit=imp_run,
    )
