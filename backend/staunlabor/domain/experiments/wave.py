"""The pendulum wave: a row of pendulums that drift apart and find each other again.

The exhibit is a row of pendulums of slightly different lengths, the longest at
one end, the shortest at the other, let go together. They swing as one, then
draw waves, snakes, apparent chaos, groups of two, three and four — and after a
minute all of them swing together again.

**The model.** No pendulum knows of the others: each is a plane pendulum
(:mod:`pendulum`), and the pattern is in the lengths alone. They are chosen so
that in the cycle ``Γ`` the longest swings ``N`` whole times, the next ``N + 1``,
the ``n``-th ``N + n``: its period is ``Tₙ = Γ/(N + n)``. After ``Γ`` every
pendulum has swung a whole number of times and all are back where they began.
At ``Γ/2`` the odd ones have swung a half more than the even ones: two groups,
opposite each other. At ``Γ/3`` three groups, at ``Γ/4`` four — the snakes in
between are the same thing seen at times that divide ``Γ`` less neatly.

**What the textbook leaves out.** ``Tₙ`` is the period of *that swing*, and a
pendulum's period grows with its swing (``T₀·(1 + θ₀²/16 + …)``). So the row is
tuned for one amplitude, ``tuned_deg``: its lengths are the exact ones for that
swing (:func:`~pendulum.length_for`). Let go wider *or narrower* than that, and
every pendulum's period is off by nearly the same share — which is ``N + n``
times as many degrees after ``Γ`` for the ``n``-th, so the row comes back
skewed, worse for the short ones. :class:`WaveFigures`' ``spread_deg`` is that
skew: zero at the tuned swing and growing either side, the page's chart.

**What it leaves out.** Air and the friction at the pivots, which in a real row
damp the swing over minutes, and so slowly change its period too; the bobs'
size; a string that stretches. Each pendulum is the ideal one, swung exactly.
"""

from __future__ import annotations

from dataclasses import dataclass

from staunlabor.domain.experiments.pendulum import length_for, period_s, small_period_s

#: A row is at least this many pendulums (fewer show no wave) and at most this
#: many (more no phone can draw apart).
MIN_COUNT = 3
MAX_COUNT = 30

#: The lengths a request may ask for: between a toy's and a stairwell's.
MIN_LENGTH_M = 0.02
MAX_LENGTH_M = 10.0

#: The release amplitudes the spread curve is drawn over.
CURVE_STEP_DEG = 2
CURVE_TOP_DEG = 40


@dataclass(frozen=True)
class PendulumWave:
    count: int = 15
    #: Γ: the time after which all swing together again.
    cycle_s: float = 60.0
    #: N: the swings the longest makes in Γ; the n-th makes N + n.
    longest_swings: int = 51
    #: The swing the lengths are tuned for, each side of the bottom.
    tuned_deg: float = 15.0
    #: The swing they are let go at.
    amplitude_deg: float = 15.0
    #: How far apart they hang along the row, for the drawing.
    spacing_m: float = 0.05

    def __post_init__(self) -> None:
        if not MIN_COUNT <= self.count <= MAX_COUNT:
            raise ValueError(f"a row has between {MIN_COUNT} and {MAX_COUNT} pendulums")
        if not self.cycle_s > 0:
            raise ValueError("the cycle has to last some time")
        if self.longest_swings < 1:
            raise ValueError("the longest pendulum swings at least once in a cycle")
        if not 0 <= self.tuned_deg < 90 or not 0 <= self.amplitude_deg < 90:
            raise ValueError("the swings lie between 0° and 90°")
        if not self.spacing_m > 0:
            raise ValueError("the pendulums hang some distance apart")
        lengths = lengths_m(self)
        if lengths[0] > MAX_LENGTH_M or lengths[-1] < MIN_LENGTH_M:
            raise ValueError(
                f"the lengths this asks for run from {lengths[-1]:.3g} m to {lengths[0]:.3g} m, "
                f"outside {MIN_LENGTH_M:g} to {MAX_LENGTH_M:g} m"
            )


def swings(wave: PendulumWave) -> tuple[int, ...]:
    """``N + n``: the swings each pendulum makes in a cycle, longest first."""
    return tuple(wave.longest_swings + n for n in range(wave.count))


def lengths_m(wave: PendulumWave) -> tuple[float, ...]:
    """Each pendulum's length, tuned so its swing of ``tuned_deg`` takes
    ``Γ/(N + n)``."""
    return tuple(length_for(wave.cycle_s / s, wave.tuned_deg) for s in swings(wave))


def lag_deg(wave: PendulumWave, amplitude_deg: float | None = None) -> tuple[float, ...]:
    """How far each pendulum is behind its start after one cycle, in degrees of
    its own swing: ``360·(N + n − Γ/T)``, ``T`` the exact period at the release
    swing. Zero for every one when the release is the tuned swing; negative is
    ahead (a narrower swing is quicker)."""
    amplitude = wave.amplitude_deg if amplitude_deg is None else amplitude_deg
    return tuple(
        360 * (s - wave.cycle_s / period_s(length, amplitude))
        for s, length in zip(swings(wave), lengths_m(wave), strict=True)
    )


def spread_deg(wave: PendulumWave, amplitude_deg: float | None = None) -> float:
    """How far apart the row comes back after one cycle: the largest lag less the
    smallest, in degrees of swing. 0° is all together; 180° is two of them
    opposite each other."""
    lags = lag_deg(wave, amplitude_deg)
    return max(lags) - min(lags)


@dataclass(frozen=True)
class WavePendulum:
    swings: int
    length_m: float
    small_period_s: float
    #: At the release swing.
    period_s: float
    lag_deg: float


@dataclass(frozen=True)
class SpreadPoint:
    amplitude_deg: float
    spread_deg: float


@dataclass(frozen=True)
class GroupPoint:
    """At ``Γ/fraction`` the row stands in ``groups`` groups."""

    fraction: int
    time_s: float
    groups: int


#: The moments the page offers to stop at: Γ/2 to Γ/5.
GROUP_FRACTIONS = (2, 3, 4, 5)


@dataclass(frozen=True)
class WaveFigures:
    pendulums: tuple[WavePendulum, ...]
    #: The longest and the shortest, for the sentence that names them.
    longest_m: float
    shortest_m: float
    #: How far apart they come back after Γ at the release swing.
    spread_deg: float
    #: The same for every release swing up to 40°: zero at the tuned one.
    spread_curve: tuple[SpreadPoint, ...]
    #: What tuning by the small swing's formula, as the textbook does, would
    #: give at the release swing.
    textbook_spread_deg: float
    groups: tuple[GroupPoint, ...]


def figures(wave: PendulumWave) -> WaveFigures:
    lengths = lengths_m(wave)
    lags = lag_deg(wave)
    textbook = PendulumWave(
        count=wave.count,
        cycle_s=wave.cycle_s,
        longest_swings=wave.longest_swings,
        tuned_deg=0.0,
        amplitude_deg=wave.amplitude_deg,
        spacing_m=wave.spacing_m,
    )
    return WaveFigures(
        pendulums=tuple(
            WavePendulum(
                swings=s,
                length_m=length,
                small_period_s=small_period_s(length),
                period_s=period_s(length, wave.amplitude_deg),
                lag_deg=lag,
            )
            for s, length, lag in zip(swings(wave), lengths, lags, strict=True)
        ),
        longest_m=lengths[0],
        shortest_m=lengths[-1],
        spread_deg=max(lags) - min(lags),
        spread_curve=tuple(
            SpreadPoint(float(a), spread_deg(wave, float(a))) for a in range(0, CURVE_TOP_DEG + 1, CURVE_STEP_DEG)
        ),
        textbook_spread_deg=spread_deg(textbook),
        groups=tuple(GroupPoint(f, wave.cycle_s / f, groups_at(wave, f)) for f in GROUP_FRACTIONS),
    )


def groups_at(wave: PendulumWave, fraction: int) -> int:
    """How many groups the row stands in at ``Γ/fraction`` for a release at the
    tuned swing: the distinct phases ``(N + n)/fraction`` takes modulo one."""
    if fraction < 1:
        raise ValueError("a fraction of the cycle is one over a whole number")
    return len({s % fraction for s in swings(wave)})
