"""The harmonograph: two pendulums draw a picture as they die away.

The exhibit has a pen on one pendulum and a drawing board on another. The pen's
pendulum swings one way, the board's the other, and the pen draws on the board
what the two swings make together: as both die away, a spiral of fine lines — a
rosette, a loop or a star, depending on how their beats stand to each other.

**The model.** Two plane pendulums (:mod:`pendulum`), each with its own length,
swing, start in its cycle and damping, stepped by Runge–Kutta, because the
damping and the full ``sin θ`` leave no closed form. The pen moves across with
the first, ``x = L₁·sin θ₁``; the board moves along with the second, and what
the pen draws is the board's motion turned round, ``y = −L₂·sin θ₂`` — the sign
does not change the picture, so it is left out. A pendulum is started part way
through its swing by its phase ``φ``: where the exact pendulum let go at ``θ₀``
is a share ``φ/360°`` of its period later (:func:`~pendulum.angle_deg`), and
moving at the rate its energy leaves it, ``θ'² = 2·ω₀²·(cos θ − cos θ₀)`` — so
it swings exactly as wide as ``θ₀`` whatever its phase. (The small swing's
``θ' = −ω₀·θ₀·sin φ`` would let it go a little wider, and slower.)

**Why the pictures turn.** A small swing's rate is ``ω = √(g/L)``, so the two
lengths set the ratio of the two beats. At a simple ratio, 1:1, 1:2, 2:3, the
figure closes on itself and only shrinks; a little off it, by a part in a
hundred, the figure keeps its shape and slowly turns, once every
``1/|q·f₁ − p·f₂|`` for the ratio ``p:q`` it is near (:attr:`HarmonographFigures.turn_s`).
And it can turn even at an exact ratio: a wider swing is a slower one (the
pendulum's ``1 + θ₀²/16``), so two pendulums let go at different widths drift
apart. The beats are therefore taken at the swings they are let go at; as
both die away the turn slows towards the small swings' (a pen at 30° over a
board at 5°: 26 s at first, the small swings' 90).

**What it leaves out.** The board's own swing in the second direction (a real
board hangs on a gimbal and swings both ways), the pen's friction on the paper,
and damping that grows with speed: here it is linear, ``c·θ'``, one number per
pendulum.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from staunlabor.domain.experiments.numerics import MAX_DURATION_S, STEP_S, rk4, sample_every
from staunlabor.domain.experiments.pendulum import angle_deg, natural_rate, period_s, swing_rhs

#: The ratios a picture is said to be near: p:q with both at most this.
MAX_RATIO_TERM = 6

#: A swing has died away once it is down to this share of its start.
FADED = 0.1


@dataclass(frozen=True)
class HarmonographPendulum:
    length_m: float = 0.8
    #: How far it is let go, each side of the bottom.
    amplitude_deg: float = 12.0
    #: Where in its swing it starts: 0° at its widest, 90° through the bottom,
    #: 180° at its widest on the other side.
    phase_deg: float = 0.0
    #: c in θ'' = −(g/L)·sin θ − c·θ': the swing dies away as e^(−c·t/2).
    damping_per_s: float = 0.02

    def __post_init__(self) -> None:
        if not 0.05 <= self.length_m <= 5.0:
            raise ValueError("a harmonograph's pendulum is between 5 cm and 5 m long")
        if not 0 <= self.amplitude_deg <= 45:
            raise ValueError("a harmonograph's pendulum swings at most 45°")
        if not 0 <= self.damping_per_s <= 1:
            raise ValueError("the damping lies between 0 and 1 per second")


@dataclass(frozen=True)
class Harmonograph:
    #: Moves the pen across.
    pen: HarmonographPendulum = HarmonographPendulum()
    #: Moves the board along: two thirds of the pen's period, near 2:3.
    board: HarmonographPendulum = HarmonographPendulum(length_m=0.8 * (2 / 3.02) ** 2, phase_deg=90.0)


def start(p: HarmonographPendulum) -> tuple[float, float]:
    """The pendulum's angle and rate at ``t = 0``: the exact pendulum let go at
    its swing, a share ``φ/360°`` of its period on."""
    later = p.phase_deg / 360 * period_s(p.length_m, p.amplitude_deg)
    theta = math.radians(angle_deg(p.length_m, p.amplitude_deg, later))
    # Moving away from where it was let go for the first half of the period.
    falling = -1.0 if math.sin(math.radians(p.phase_deg)) > 0 else 1.0
    energy = max(0.0, math.cos(theta) - math.cos(math.radians(p.amplitude_deg)))
    return theta, falling * natural_rate(p.length_m) * math.sqrt(2 * energy)


@dataclass(frozen=True)
class HarmonographRun:
    """The pen's path on the board, sampled."""

    t: tuple[float, ...]
    x_m: tuple[float, ...]
    y_m: tuple[float, ...]


def draw(h: Harmonograph, duration_s: float, step_s: float = STEP_S) -> HarmonographRun:
    """Both pendulums stepped together for ``duration_s``; the pen's place on the
    board at every sample."""
    if not 0 < step_s <= 0.01:
        raise ValueError("the step lies between 0 and 10 ms")
    if not 0 < duration_s <= MAX_DURATION_S:
        raise ValueError(f"a drawing lasts more than nothing and at most {MAX_DURATION_S:g} s")
    pen = swing_rhs(h.pen.length_m, h.pen.damping_per_s)
    board = swing_rhs(h.board.length_m, h.board.damping_per_s)
    a: tuple[float, ...] = start(h.pen)
    b: tuple[float, ...] = start(h.board)
    steps = round(duration_s / step_s)
    every = sample_every(step_s)
    ts: list[float] = []
    xs: list[float] = []
    ys: list[float] = []
    for i in range(steps + 1):
        t = i * step_s
        if i % every == 0:
            ts.append(t)
            xs.append(h.pen.length_m * math.sin(a[0]))
            ys.append(h.board.length_m * math.sin(b[0]))
        if i < steps:
            a = rk4(pen, t, a, step_s)
            b = rk4(board, t, b, step_s)
    return HarmonographRun(t=tuple(ts), x_m=tuple(xs), y_m=tuple(ys))


def frequency_hz(p: HarmonographPendulum) -> float:
    """Beats per second at the swing it is let go at, ``1/T(L, θ₀)``: a wider
    swing is slower (``1 + θ₀²/16 + …``). By the small swing's ``√(g/L)/2π``
    the figure of a pen at 30° over a board at 5° turned once in 90 s, where it
    turns in 26 (the mathematics check, 2026-11-17)."""
    return 1 / period_s(p.length_m, p.amplitude_deg)


def nearest_ratio(pen_hz: float, board_hz: float) -> tuple[int, int]:
    """The simple ratio ``p:q`` (both at most :data:`MAX_RATIO_TERM`, in lowest
    terms) nearest to ``pen_hz : board_hz``, by the relative error of
    ``q/p`` against ``board_hz/pen_hz``; the smaller terms win a tie."""
    target = board_hz / pen_hz
    best = (1, 1)
    best_error = math.inf
    for p in range(1, MAX_RATIO_TERM + 1):
        for q in range(1, MAX_RATIO_TERM + 1):
            if math.gcd(p, q) != 1:
                continue
            error = abs(q / p - target) / target
            if error < best_error - 1e-12:
                best, best_error = (p, q), error
    return best


@dataclass(frozen=True)
class HarmonographFigures:
    pen_hz: float
    board_hz: float
    #: The simple ratio the beats are near, pen : board.
    ratio: tuple[int, int]
    #: How far off it, as a share: (board/pen) / (q/p) − 1.
    detune: float
    #: How long the figure takes to turn once, ``1/|q·f₁ − p·f₂|``; ``None`` at
    #: the exact ratio, where it only shrinks.
    turn_s: float | None
    #: How long until each swing is down to a tenth: ``2·ln 10 / c``; ``None``
    #: undamped.
    pen_fades_s: float | None
    board_fades_s: float | None


def _fades(p: HarmonographPendulum) -> float | None:
    return 2 * math.log(1 / FADED) / p.damping_per_s if p.damping_per_s > 0 else None


def figures(h: Harmonograph) -> HarmonographFigures:
    f1, f2 = frequency_hz(h.pen), frequency_hz(h.board)
    p, q = nearest_ratio(f1, f2)
    beat = abs(q * f1 - p * f2)
    return HarmonographFigures(
        pen_hz=f1,
        board_hz=f2,
        ratio=(p, q),
        detune=(f2 / f1) / (q / p) - 1,
        turn_s=1 / beat if beat > 1e-12 else None,
        pen_fades_s=_fades(h.pen),
        board_fades_s=_fades(h.board),
    )
