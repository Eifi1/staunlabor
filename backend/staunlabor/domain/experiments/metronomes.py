"""The metronomes that agree: five metronomes on a board on two cans tick in
step within a minute; on a table that holds the board still, never.

The exhibit is a light board resting on two empty cans, so it rolls sideways
at the slightest push, and a few metronomes on it, set to one tempo and
started at random. Each swing pushes the board a little; the board's motion
pushes every pendulum back, and before long they all swing together.

**The model** is J. Pantaleone's (*Am. J. Phys.* 70, 992, 2002), his Eq. (6)
for ``N`` metronomes. Time is counted in the swing's own radians,
``τ = ω·t``, and each pendulum ``i`` obeys

    θᵢ'' + (1 + Δᵢ)·sin θᵢ + μ·((θᵢ/θ₀)² − 1)·θᵢ' − β·cos θᵢ·(Σⱼ sin θⱼ)'' = 0

The second term is the pendulum's weight, ``Δᵢ`` how much faster or slower it
is set than the tempo; the third the escapement, crudely, as a van der Pol
term: it drives the swing while it is small and brakes it while it is large,
so a lone metronome settles at a swing of about ``2·θ₀`` whatever it started
with. The last is the board: with nothing outside pushing it, the centre of
mass of board and metronomes stays put, so the board moves by
``x = −x₀·Σⱼ sin θⱼ``, ``x₀ = m·r/M`` (his Eq. (5)), and every metronome on it
feels the inertial force of that motion. ``β = x₀·ω²/g`` (his Eqs. (11)–(12),
``M`` all the moving mass, board and metronomes, ``m·r`` a pendulum's mass
times the distance of its centre of mass from the pivot) is how strongly. A
board held still is ``β = 0``: each metronome keeps its own time.

Because the board's motion depends on every pendulum's acceleration, the
equations are implicit; solved for the accelerations (one sum, since all of
them share the board), each step is explicit and stepped by the engine's
classical Runge–Kutta.

**The numbers** are Pantaleone's: Wittner's smallest metronome, 94 g, at its
fastest setting, 208 ticks a minute (two ticks a swing: 104 swings, so
``ω = 10.9 1/s``); ``θ₀ = 0.39 rad`` (a swing of 45° either way), ``μ = 0.010``
(fitted to his measurements), a board of 58 g, and the scale of the board's
motion ``x₀ = 0.088 cm`` with two metronomes on it, which gives a pendulum's
``m·r``. For two, ``β = 0.011``, as he states.

**How in step they are** is Kuramoto's order parameter (his Eq. (38)), the
mean of the phases' unit pointers, ``R·e^{iψ} = (1/N)·Σⱼ e^{iφⱼ}``: 1 when
all swing as one, near 0 when they are scattered. A metronome's phase is read
off its angle and swing speed, ``φ = atan2(−θ', θ)``, the angle of its point
in the plane of the two.

**A held metronome** has not been started yet: it stands at zero, it is part
of the board's mass, and it neither pushes the board nor feels it. (The van
der Pol term would set a resting pendulum swinging by itself; a real
escapement needs the swing to be large enough to catch.)

**What it leaves out**, as he does: the cans' mass and the board's own
friction (with the board damped, the metronomes can settle half a swing
apart, as he found on a wet table and Huygens's clocks did); the escapement's
ticks as kicks; the spring running down.
"""

from __future__ import annotations

import enum
import math
from dataclasses import dataclass

from staunlabor.domain.experiments.constants import G
from staunlabor.domain.experiments.numerics import check_run, rk4, sample_every

# ── Pantaleone's metronomes, his Sec. II B ────────────────────────────────────

#: One metronome, pendulum included (Wittner's Super-Mini-Taktell).
METRONOME_KG = 0.094
#: His board: light, and long enough for several.
BOARD_KG = 0.058
#: x₀ = m·r/(M + 2m) for two metronomes on his board, his Eq. (14).
TWO_ON_BOARD_X0_M = 0.00088
#: A pendulum's mass times the distance of its centre of mass from the pivot,
#: kg·m: x₀ times all the moving mass of his two-metronome build, 21.6 g·cm.
PENDULUM_MOMENT_KG_M = TWO_ON_BOARD_X0_M * (BOARD_KG + 2 * METRONOME_KG)
#: 208 ticks a minute, two ticks a swing.
TICKS_PER_MIN = 208.0
#: ω, 1/s: the swing's rate, which sets the time scale τ = ω·t.
RATE_PER_S = 2 * math.pi * TICKS_PER_MIN / 2 / 60
#: θ₀, rad: half the swing a lone metronome settles at.
THETA0_RAD = 0.39
#: μ: the escapement's van der Pol strength, fitted by him to his runs.
MU = 0.010

#: The step, in seconds: 4 ms, 144 steps a swing. Halving it moves the two
#: metronomes' locked lag by 3 · 10⁻⁶ of itself.
STEP_S = 4e-3

#: The most metronomes the board takes: Pantaleone put seven on his.
MAX_COUNT = 7

#: The exhibit's scattered start, degrees of phase: the first five's pointers
#: nearly cancel (R = 0.015).
SCATTERED_DEG = (0.0, 150.0, 290.0, 70.0, 215.0, 330.0, 105.0)

#: How far the "small" start pulls each pendulum aside, degrees.
SMALL_DEG = 10.0

#: How far apart the "opposite" start sets neighbours, degrees: nearly half a
#: swing, as Pantaleone started his two (his Fig. 2); exactly half a swing
#: would keep the board still for ever.
OPPOSITE_DEG = 170.0


class Start(enum.StrEnum):
    #: Each at its full swing, at the exhibit's scattered phases.
    SCATTERED = "scattered"
    #: Each at its full swing, neighbours nearly half a swing apart.
    OPPOSITE = "opposite"
    #: All let go together from their full swing.
    TOGETHER = "together"
    #: All let go together from a small swing, for the escapement to build up.
    SMALL = "small"


@dataclass(frozen=True)
class Metronomes:
    #: How many stand on the board.
    count: int = 5
    #: The board's own mass, without the metronomes.
    board_kg: float = BOARD_KG
    #: Δ: the fastest set this much above the tempo and the slowest this much
    #: below (in ω², Pantaleone's 1 ± Δ), the others evenly between.
    spread: float = 0.004
    #: The board free on its cans, or held still by the table.
    free: bool = True

    def __post_init__(self) -> None:
        if not 1 <= self.count <= MAX_COUNT:
            raise ValueError(f"between one and {MAX_COUNT} metronomes stand on the board")
        if not 0 <= self.board_kg <= 10:
            raise ValueError("the board weighs between nothing and 10 kg")
        if not 0 <= self.spread <= 0.1:
            raise ValueError("the metronomes are set at most 10 % apart")


def detunings(mt: Metronomes) -> tuple[float, ...]:
    """Each metronome's ``Δᵢ``, the slowest first: from ``−spread`` to
    ``+spread`` in even steps (none for one alone)."""
    if mt.count == 1:
        return (0.0,)
    return tuple(mt.spread * (2 * i / (mt.count - 1) - 1) for i in range(mt.count))


def moving_kg(mt: Metronomes) -> float:
    """``M``: everything the cans carry, board and metronomes."""
    return mt.board_kg + mt.count * METRONOME_KG


def board_scale_m(mt: Metronomes) -> float:
    """``x₀ = m·r/M``: how far the board moves per unit of ``Σ sin θⱼ``;
    nothing when it is held."""
    return PENDULUM_MOMENT_KG_M / moving_kg(mt) if mt.free else 0.0


def coupling(mt: Metronomes) -> float:
    """``β = x₀·ω²/g`` (Pantaleone's Eq. (12)): 0.011 for his two."""
    return board_scale_m(mt) * RATE_PER_S**2 / G


def rhs(mt: Metronomes, running: tuple[bool, ...]):
    """The ``2N`` first-order equations over ``(θ₁ … θ_N, θ₁' … θ_N')``, in
    the swing's time ``τ``. A metronome not ``running`` is held at rest.

    Each acceleration is ``θᵢ'' = Fᵢ + β·cos θᵢ·S`` with ``Fᵢ`` the pendulum's
    own (weight and escapement) and ``S = (Σⱼ sin θⱼ)''``; summing ``cos θᵢ``
    times that over the running ones gives ``S`` itself:
    ``S = (Σ cos θⱼ·Fⱼ − Σ sin θⱼ·θⱼ'²)/(1 − β·Σ cos² θⱼ)``."""
    n = mt.count
    if len(running) != n:
        raise ValueError("say for every metronome whether it runs")
    beta = coupling(mt)
    tune = tuple(1 + d for d in detunings(mt))
    on = tuple(i for i in range(n) if running[i])

    def f(_tau: float, y: tuple[float, ...]) -> tuple[float, ...]:
        own = [0.0] * n
        cos = [0.0] * n
        top = 0.0
        bottom = 1.0
        for i in on:
            theta, rate = y[i], y[n + i]
            c, s = math.cos(theta), math.sin(theta)
            u = theta / THETA0_RAD
            own[i] = -tune[i] * s - MU * (u * u - 1) * rate
            cos[i] = c
            top += c * own[i] - s * rate * rate
            bottom -= beta * c * c
        board = top / bottom
        acc = [0.0] * n
        for i in on:
            acc[i] = own[i] + beta * cos[i] * board
        return (*(y[n + i] if running[i] else 0.0 for i in range(n)), *acc)

    return f


def start_state(start: Start, count: int) -> tuple[float, ...]:
    """``(θ₁ … θ_N, θ₁' … θ_N')`` for ``count`` metronomes let go as
    ``start`` says: at the phase ``φ`` of a full swing ``2θ₀``,
    ``θ = 2θ₀·cos φ`` and ``θ' = −2θ₀·sin φ``."""
    if not 1 <= count <= MAX_COUNT:
        raise ValueError(f"between one and {MAX_COUNT} metronomes stand on the board")
    if start is Start.SMALL:
        return (*(math.radians(SMALL_DEG),) * count, *(0.0,) * count)
    if start is Start.SCATTERED:
        phases = tuple(math.radians(d) for d in SCATTERED_DEG[:count])
    elif start is Start.OPPOSITE:
        phases = tuple(math.radians(OPPOSITE_DEG) * (i % 2) for i in range(count))
    else:
        phases = (0.0,) * count
    a = 2 * THETA0_RAD
    return (*(a * math.cos(p) for p in phases), *(-a * math.sin(p) for p in phases))


def phase(theta: float, rate: float) -> float:
    """A metronome's phase, rad: the angle of ``(θ, −θ')``."""
    return math.atan2(-rate, theta)


def order(y: tuple[float, ...], running: tuple[bool, ...]) -> tuple[float, float]:
    """Kuramoto's ``(R, ψ)`` over the running metronomes (Pantaleone's
    Eq. (38)); ``(0, 0)`` with none running."""
    n = len(running)
    re = im = 0.0
    k = 0
    for i in range(n):
        if running[i]:
            p = phase(y[i], y[n + i])
            re += math.cos(p)
            im += math.sin(p)
            k += 1
    if k == 0:
        return 0.0, 0.0
    return math.hypot(re, im) / k, math.atan2(im, re)


def board_m(mt: Metronomes, y: tuple[float, ...]) -> float:
    """Where the board is, m: ``x = −x₀·Σ sin θⱼ`` (his Eq. (5))."""
    return -board_scale_m(mt) * sum(math.sin(y[i]) for i in range(mt.count))


@dataclass(frozen=True)
class MetronomeRun:
    t: tuple[float, ...]
    #: Kuramoto's R.
    order: tuple[float, ...]
    #: The board's place, mm.
    board_mm: tuple[float, ...]
    #: Each metronome's angle, degrees: ``angles_deg[i][k]`` at ``t[k]``.
    angles_deg: tuple[tuple[float, ...], ...]


def run(mt: Metronomes, start: Start, duration_s: float, step_s: float = STEP_S) -> MetronomeRun:
    """Every metronome let go as ``start`` says, stepped for ``duration_s``
    seconds, sampled 50 times a second."""
    check_run(duration_s, step_s)
    running = (True,) * mt.count
    f = rhs(mt, running)
    y = start_state(start, mt.count)
    h = step_s * RATE_PER_S
    steps = round(duration_s / step_s)
    every = sample_every(step_s)
    t: list[float] = []
    r: list[float] = []
    x: list[float] = []
    angles: list[list[float]] = [[] for _ in range(mt.count)]
    for k in range(steps + 1):
        if k % every == 0:
            t.append(k * step_s)
            r.append(order(y, running)[0])
            x.append(board_m(mt, y) * 1000)
            for i in range(mt.count):
                angles[i].append(math.degrees(y[i]))
        if k < steps:
            y = rk4(f, k * h, y, h)
    return MetronomeRun(t=tuple(t), order=tuple(r), board_mm=tuple(x), angles_deg=tuple(tuple(a) for a in angles))


def in_step_s(r: MetronomeRun, level: float = 0.99) -> float | None:
    """The first sample from which ``R`` stays above ``level`` to the run's
    end; ``None`` if it ends below."""
    found = None
    for t, value in zip(r.t, r.order, strict=True):
        if value > level:
            if found is None:
                found = t
        else:
            found = None
    return found
