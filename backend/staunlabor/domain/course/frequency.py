"""Lesson 4: Laplace as a tool, Bode as a sum, and the hysteresis a filter
invents.

Three widgets. The PT1's step response solved the Laplace way, with every line's
numbers — transform, solve for ``Y(s)``, split into partial fractions, transform
back — so the reader watches ``1/s`` and ``1/(s + 1/τ)`` turn into a constant
and an exponential. A chain of up to four blocks (gain, integrator, PT1, PT2,
dead time) whose Bode plot is the *sum* of the blocks' plots, drawn as such. And
a test object without any hysteresis, measured through a low-pass on one channel
only, which draws a loop that is entirely the filter's.

The chain's step response is stepped exactly (``e^{Ah}`` of the cascade, via
:func:`~.linalg.expm`), so a 1 ms PT1 behind a 10 s one costs the same as two
alike — a fixed-step integrator would need ten thousand steps for the fast one
or diverge.

What it does not do: zeros (no block here has one), closed loops (no lesson
here closes one), or a dead time in the poles — ``e^{−sT}`` has none, and the
page says so rather than drawing a Padé approximation's.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from enum import StrEnum

from staunlabor.domain.course.linalg import expm
from staunlabor.domain.course.lti import Tf, linspace, logspace, response, roots, series, static_gain

CURVE_POINTS = 401
BODE_POINTS = 400
#: The most blocks a chain may hold — the spec's four, which is as many as a
#: reader can still add up by eye.
MAX_BLOCKS = 4


@dataclass(frozen=True)
class LaplaceSteps:
    """``τ·ẏ + y = K·u`` with ``y(0) = y₀`` and a step ``u = u₀`` at ``t = 0``.

    Transformed: ``τ(sY − y₀) + Y = K·u₀/s``. Solved:
    ``Y(s) = τy₀/(τs + 1) + K·u₀/(s(τs + 1))``. Split:
    ``Y(s) = A/s + B/(s + 1/τ)`` with ``A = K·u₀`` (the residue at ``s = 0``) and
    ``B = y₀ − K·u₀``. Back: ``y(t) = A + B·e^{−t/τ}``.
    """

    time_constant_s: float
    gain: float
    step: float
    start: float
    pole: float
    residue_zero: float
    residue_pole: float
    final_value: float
    time_s: tuple[float, ...]
    value: tuple[float, ...]


def laplace_steps(time_constant_s: float, gain: float, step: float, start: float = 0.0) -> LaplaceSteps:
    if time_constant_s <= 0:
        raise ValueError("A time constant must be positive.")
    a = gain * step
    b = start - a
    ts = linspace(0.0, 6 * time_constant_s, CURVE_POINTS)
    return LaplaceSteps(
        time_constant_s=time_constant_s,
        gain=gain,
        step=step,
        start=start,
        pole=-1 / time_constant_s,
        residue_zero=a,
        residue_pole=b,
        final_value=a,
        time_s=tuple(ts),
        value=tuple(a + b * math.exp(-t / time_constant_s) for t in ts),
    )


class BlockKind(StrEnum):
    proportional = "proportional"
    integrator = "integrator"
    first_order = "first_order"
    second_order = "second_order"
    dead_time = "dead_time"


@dataclass(frozen=True)
class Block:
    """One block of a chain. Which fields a kind reads:

    ``proportional`` ``K``; ``integrator`` ``K/s`` (``gain`` in 1/s);
    ``first_order`` ``K/(τs + 1)``; ``second_order``
    ``K·ω₀²/(s² + 2Dω₀s + ω₀²)``; ``dead_time`` ``e^{−sT}``.
    """

    kind: BlockKind
    gain: float = 1.0
    time_constant_s: float = 1.0
    f0_hz: float = 1.0
    damping: float = 0.5
    dead_time_s: float = 0.0


def _tf(block: Block) -> Tf | None:
    k = block.gain
    if block.kind is BlockKind.proportional:
        return Tf((k,), (1.0,))
    if block.kind is BlockKind.integrator:
        return Tf((k,), (1.0, 0.0))
    if block.kind is BlockKind.first_order:
        if block.time_constant_s <= 0:
            raise ValueError("A first-order block needs a positive time constant.")
        return Tf((k,), (block.time_constant_s, 1.0))
    if block.kind is BlockKind.second_order:
        if block.f0_hz <= 0 or block.damping < 0:
            raise ValueError("A second-order block needs a positive natural frequency and a damping of at least zero.")
        w0 = 2 * math.pi * block.f0_hz
        return Tf((k * w0 * w0,), (1.0, 2 * block.damping * w0, w0 * w0))
    if block.dead_time_s < 0:
        raise ValueError("A dead time cannot be negative.")
    return None


@dataclass(frozen=True)
class BlockCurve:
    """One block's own Bode curves, so the page can show the sum being a sum."""

    magnitude_db: tuple[float, ...]
    phase_deg: tuple[float, ...]


@dataclass(frozen=True)
class Cursor:
    """The chain at one frequency: gain, phase, and the phase as a delay,
    ``Δt = −φ/360°·T`` — the lag a sine at that frequency arrives with."""

    frequency_hz: float
    magnitude: float
    magnitude_db: float
    phase_deg: float
    delay_s: float


@dataclass(frozen=True)
class ChainResponse:
    frequency_hz: tuple[float, ...]
    magnitude_db: tuple[float, ...]
    phase_deg: tuple[float, ...]
    blocks: tuple[BlockCurve, ...]
    poles: tuple[complex, ...]
    static_gain: float | None
    dead_time_s: float
    cursor: Cursor
    time_s: tuple[float, ...]
    step: tuple[float, ...]


def _block_phase(block: Block, w: float) -> float:
    """A block's phase in degrees on its own continuous branch — summing these
    needs no unwrapping, which a chain of four would otherwise need."""
    if block.kind is BlockKind.proportional:
        return 0.0 if block.gain >= 0 else -180.0
    if block.kind is BlockKind.integrator:
        return -90.0 + (0.0 if block.gain >= 0 else -180.0)
    if block.kind is BlockKind.dead_time:
        return -math.degrees(w * block.dead_time_s)
    sign = 0.0 if block.gain >= 0 else -180.0
    if block.kind is BlockKind.first_order:
        return sign - math.degrees(math.atan(w * block.time_constant_s))
    w0 = 2 * math.pi * block.f0_hz
    return sign - math.degrees(math.atan2(2 * block.damping * w0 * w, w0 * w0 - w * w))


def _block_magnitude_db(block: Block, w: float) -> float:
    tf = _tf(block)
    if tf is None:
        return 0.0
    v = abs(response(tf, w))
    return 20 * math.log10(v) if v > 0 else -400.0


def _state_space(blocks: list[Block]) -> tuple[list[list[float]], list[float], list[float], float]:
    """The cascade as ``ẋ = Ax + Bu``, ``y = Cx + Du``: each dynamic block's
    states in order, each fed by the output of everything before it."""
    a: list[list[float]] = []
    b: list[float] = []
    # The running output is a linear function of the states and the input:
    # y = c·x + d·u, with c over the states built so far.
    c: list[float] = []
    d = 1.0
    for block in blocks:
        n = len(c)
        if block.kind is BlockKind.proportional:
            c = [block.gain * v for v in c]
            d *= block.gain
            continue
        if block.kind is BlockKind.dead_time:
            continue
        if block.kind in (BlockKind.integrator, BlockKind.first_order):
            # ż = −z/τ + K/τ·y_in   (integrator: ż = K·y_in)
            if block.kind is BlockKind.integrator:
                rate, k = 0.0, block.gain
            else:
                rate, k = -1 / block.time_constant_s, block.gain / block.time_constant_s
            for row in a:
                row.append(0.0)
            a.append([k * v for v in c] + [rate])
            b.append(k * d)
            c = [0.0] * n + [1.0]
            d = 0.0
            continue
        w0 = 2 * math.pi * block.f0_hz
        # z̈ = −w0²z − 2Dw0ż + K·w0²·y_in, states (z, ż)
        for row in a:
            row.extend((0.0, 0.0))
        a.append([0.0] * n + [0.0, 1.0])
        k = block.gain * w0 * w0
        a.append([k * v for v in c] + [-w0 * w0, -2 * block.damping * w0])
        b.extend((0.0, k * d))
        c = [0.0] * n + [1.0, 0.0]
        d = 0.0
    return a, b, c, d


def _time_scale(blocks: list[Block]) -> float:
    scales = []
    for block in blocks:
        if block.kind is BlockKind.first_order:
            scales.append(block.time_constant_s)
        elif block.kind is BlockKind.second_order:
            w0 = 2 * math.pi * block.f0_hz
            if block.damping > 0:
                if block.damping < 1:
                    scales.append(1 / (block.damping * w0))
                else:
                    scales.append(1 / (w0 * (block.damping - math.sqrt(block.damping**2 - 1))))
            else:
                scales.append(4 * 2 * math.pi / w0)
    return max(scales, default=0.2)


def chain_response(
    blocks: list[Block],
    cursor_hz: float,
    f_min_hz: float = 0.01,
    f_max_hz: float = 1000.0,
    t_end_s: float | None = None,
) -> ChainResponse:
    if not blocks:
        raise ValueError("A chain needs at least one block.")
    if len(blocks) > MAX_BLOCKS:
        raise ValueError(f"A chain holds at most {MAX_BLOCKS} blocks.")
    if cursor_hz <= 0:
        raise ValueError("The cursor frequency must be positive.")
    tfs = [tf for tf in (_tf(b) for b in blocks) if tf is not None]
    total = series(*tfs) if tfs else Tf((1.0,), (1.0,))
    # The chain's poles are its blocks' poles together — the product's
    # denominator has no other roots — and they are found block by block. The
    # product's companion matrix is defective when two blocks are alike, where
    # the QR iteration converges only linearly: two equal PT2s (the page's chain
    # with its second block switched to second order) used up its sweeps and
    # answered a 400. A block's own denominator is of degree two at most, which
    # the iteration solves without iterating.
    poles = sorted((p for tf in tfs for p in roots(tf.den)), key=lambda z: (z.real, z.imag))
    dead = sum(b.dead_time_s for b in blocks if b.kind is BlockKind.dead_time)
    freqs = logspace(f_min_hz, f_max_hz, BODE_POINTS)
    block_curves = []
    for block in blocks:
        mags = [_block_magnitude_db(block, 2 * math.pi * f) for f in freqs]
        phases = [_block_phase(block, 2 * math.pi * f) for f in freqs]
        block_curves.append(BlockCurve(tuple(mags), tuple(phases)))
    mag = [sum(curve.magnitude_db[i] for curve in block_curves) for i in range(len(freqs))]
    phase = [sum(curve.phase_deg[i] for curve in block_curves) for i in range(len(freqs))]
    wc = 2 * math.pi * cursor_hz
    g = abs(response(total, wc))
    ph = sum(_block_phase(b, wc) for b in blocks)
    gain0 = static_gain(total)

    a, b, c, d = _state_space(blocks)
    horizon = t_end_s if t_end_s is not None else min(1000.0, max(1e-3, 6 * _time_scale(blocks))) + dead
    ts = linspace(0.0, horizon, CURVE_POINTS)
    h = ts[1] - ts[0]
    n = len(a)
    if n:
        # Exact step of the cascade under a held unit input: the augmented
        # exponential [[A, B], [0, 0]]·h gives Φ and Γ at once.
        aug = [[*row, b[i]] for i, row in enumerate(a)] + [[0.0] * (n + 1)]
        e = expm([[v * h for v in row] for row in aug])
        phi = [row[:n] for row in e[:n]]
        gamma = [row[n] for row in e[:n]]
    y_free: list[float] = []
    x = [0.0] * n
    for _ in ts:
        y_free.append(sum(ci * xi for ci, xi in zip(c, x, strict=True)) + d)
        if n:
            x = [sum(phi[i][j] * x[j] for j in range(n)) + gamma[i] for i in range(n)]
    # The dead time shifts the whole response; before it, nothing has arrived.
    step = [0.0 if t < dead else _shifted(y_free, ts, t - dead) for t in ts]
    return ChainResponse(
        frequency_hz=tuple(freqs),
        magnitude_db=tuple(mag),
        phase_deg=tuple(phase),
        blocks=tuple(block_curves),
        poles=tuple(poles),
        static_gain=gain0 if math.isfinite(gain0) else None,
        dead_time_s=dead,
        cursor=Cursor(
            frequency_hz=cursor_hz,
            magnitude=g,
            magnitude_db=20 * math.log10(g) if g > 0 else -400.0,
            phase_deg=ph,
            delay_s=-ph / 360 / cursor_hz,
        ),
        time_s=tuple(ts),
        step=tuple(step),
    )


def _shifted(values: list[float], ts: list[float], t: float) -> float:
    """Linear interpolation of a uniformly sampled series at ``t``."""
    h = ts[1] - ts[0]
    k = t / h
    i = min(int(k), len(values) - 2)
    frac = k - i
    return values[i] + frac * (values[i + 1] - values[i])


class FilterMode(StrEnum):
    """Which channels a hysteresis measurement's low-pass is applied to."""

    torque_only = "torque_only"
    both = "both"
    zero_phase = "zero_phase"


@dataclass(frozen=True)
class FilterLoop:
    """Torque over angle for one period of a sinusoidal sweep, as measured and
    as it is.

    ``apparent_hysteresis`` is the width of the measured loop at zero angle (the
    torque difference between the two branches) and ``true_hysteresis`` the
    same of the unfiltered signals — zero for a test object that has none, which
    is the case the lesson starts from.
    """

    frequency_hz: float
    corner_hz: float
    mode: FilterMode
    angle_deg: tuple[float, ...]
    torque: tuple[float, ...]
    measured_angle_deg: tuple[float, ...]
    measured_torque: tuple[float, ...]
    apparent_hysteresis: float
    true_hysteresis: float
    phase_lag_deg: float
    delay_s: float


#: How many periods the filter runs over before the one that is drawn, and
#: after it for the backward pass — enough that a 0.5 Hz sweep through a 1 Hz
#: filter has forgotten where it started.
_PERIODS = 9


def _pt1(values: list[float], h: float, tau: float) -> list[float]:
    """A first-order low-pass sampled exactly for a held input, starting at the
    first value so it begins settled."""
    a = math.exp(-h / tau)
    out = []
    y = values[0]
    for u in values:
        y = a * y + (1 - a) * u
        out.append(y)
    return out


def _width_at_zero(angle: list[float], torque: list[float]) -> float:
    """The torque gap between the rising and the falling branch where the angle
    crosses zero, by linear interpolation at each crossing."""
    up: list[float] = []
    down: list[float] = []
    for i in range(len(angle) - 1):
        a0, a1 = angle[i], angle[i + 1]
        if (a0 <= 0 < a1) or (a0 >= 0 > a1):
            frac = -a0 / (a1 - a0)
            m = torque[i] + frac * (torque[i + 1] - torque[i])
            (up if a1 > a0 else down).append(m)
    if not up or not down:
        return 0.0
    return abs(sum(up) / len(up) - sum(down) / len(down))


def filter_loop(
    frequency_hz: float,
    corner_hz: float,
    mode: FilterMode,
    amplitude_deg: float = 30.0,
    stiffness_nm_per_deg: float = 1.0,
    friction_nm: float = 0.0,
) -> FilterLoop:
    """A test object ``M = k·φ + M_f·sign(φ̇)`` swept sinusoidally, its torque
    (and, by ``mode``, its angle) through a PT1 at ``corner_hz``.

    ``zero_phase`` runs the filter forward and then backward over the record —
    the offline trick that cancels the phase and squares the magnitude, so both
    channels arrive at the same time and the loop is the object's own.
    """
    if frequency_hz <= 0 or corner_hz <= 0:
        raise ValueError("The sweep and the corner frequency must be positive.")
    if amplitude_deg <= 0 or stiffness_nm_per_deg < 0 or friction_nm < 0:
        raise ValueError("The amplitude must be positive and the stiffness and friction not negative.")
    per_period = 400
    rate = per_period * frequency_hz
    h = 1 / rate
    n = _PERIODS * per_period
    w = 2 * math.pi * frequency_hz
    ts = [k * h for k in range(n + 1)]
    angle = [amplitude_deg * math.sin(w * t) for t in ts]
    rate_sign = [math.copysign(1.0, math.cos(w * t)) for t in ts]
    torque = [stiffness_nm_per_deg * a + friction_nm * s for a, s in zip(angle, rate_sign, strict=True)]
    tau = 1 / (2 * math.pi * corner_hz)
    if mode is FilterMode.torque_only:
        m_angle, m_torque = angle, _pt1(torque, h, tau)
    elif mode is FilterMode.both:
        m_angle, m_torque = _pt1(angle, h, tau), _pt1(torque, h, tau)
    else:
        m_angle = _pt1(_pt1(angle, h, tau)[::-1], h, tau)[::-1]
        m_torque = _pt1(_pt1(torque, h, tau)[::-1], h, tau)[::-1]
    # The middle period: far from both ends of a record a filter ran over twice.
    lo = (_PERIODS // 2) * per_period
    hi = lo + per_period + 1
    q = per_period // 4
    lag = 0.0 if mode is FilterMode.zero_phase else -math.degrees(math.atan(w * tau))
    return FilterLoop(
        frequency_hz=frequency_hz,
        corner_hz=corner_hz,
        mode=mode,
        angle_deg=tuple(angle[lo:hi]),
        torque=tuple(torque[lo:hi]),
        measured_angle_deg=tuple(m_angle[lo:hi]),
        measured_torque=tuple(m_torque[lo:hi]),
        # Crossings are looked for a quarter period either side of the drawn
        # one: the drawn period starts on a zero crossing, and a sign decided
        # by the last bit of a sine must not hide one of the two branches.
        apparent_hysteresis=_width_at_zero(m_angle[lo - q : hi + q], m_torque[lo - q : hi + q]),
        true_hysteresis=_width_at_zero(angle[lo - q : hi + q], torque[lo - q : hi + q]),
        phase_lag_deg=lag,
        delay_s=-lag / 360 / frequency_hz,
    )
