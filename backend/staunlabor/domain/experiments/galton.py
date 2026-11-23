"""The Galton board: balls fall through rows of pins, each turned left or right at every pin, and pile up into a bell.

The exhibit pours balls from a funnel into a triangle of pins. At each pin a
ball goes left or right, one as likely as the other on a level board; after
the last row it drops into one of the bins below. No two runs fill the bins
alike, yet every run piles up the same heap: high in the middle, low at the
edges, a bell.

**Why the bell.** A ball that went right ``k`` times in ``n`` rows lands in
bin ``k``, whatever the order of its turns. Every one of the ``2ⁿ`` orders is
as likely as any other on a level board, and ``C(n, k)`` of them lead to bin
``k``: one to each edge, ``n`` to the bins beside them, 924 of the 4096 of
twelve rows to the middle. The share of a bin is that count of paths times
the chance of one: ``P(k) = C(n, k)·pᵏ·(1 − p)ⁿ⁻ᵏ``, the binomial
distribution, with ``p`` the chance of going right. Its middle lies at
``n·p``, its spread is ``√(n·p·(1 − p))`` bins, and for many rows it
approaches the normal curve of the same middle and spread (de Moivre and
Laplace).

**How it is computed.** The shares row by row, as the balls fall: what reaches
a pin of one row goes on, ``p`` of it to the right and ``1 − p`` to the left,
so each bin of the next row gets ``p`` of the bin up-left and ``1 − p`` of the
one up-right (Pascal's rule, with weights). The paths are the same rule with
both weights one. The balls themselves are drawn from a generator of this
module's own, Mulberry32, a 32-bit generator a browser computes with the same
integer operations, so a seed gives the same balls on the server, in the tests
and on the page: ball ``i`` uses draws ``i·n`` to ``i·n + n − 1``, one per row,
and goes right where its draw is below ``p``.

**What it leaves out.** How a tilt or the pins' shape sets ``p``: the page
takes ``p`` as given, the same at every pin. A ball that bounces over two pins
or kicks its neighbour, which on a real board widens the heap; the bins
filling up; the balls' flight, which the page draws but does not compute.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

#: The exhibit's board: twelve rows of pins, thirteen bins, level.
EXHIBIT_ROWS = 12
LEVEL = 0.5
#: The balls of one run, and the run's seed, the page's first.
EXHIBIT_BALLS = 500
EXHIBIT_SEED = 1874
#: The most rows and balls the page builds.
MOST_ROWS = 24
MOST_BALLS = 5000

_MASK = 0xFFFFFFFF
#: Mulberry32's step, added to the state for every draw.
_STEP = 0x6D2B79F5


@dataclass(frozen=True)
class Drop:
    """One run of the board: where each ball landed, and the heap."""

    #: Each ball's bin, in the order they fell: the number of times it went right.
    bins: tuple[int, ...]
    #: The balls in each bin, ``0`` to ``n``.
    counts: tuple[int, ...]
    #: The run's mean bin and its variance (over the balls, not over N − 1).
    mean: float
    variance: float


@dataclass(frozen=True)
class Figures:
    """What the board does on average: the binomial distribution's own."""

    #: ``n·p``, ``n·p·(1 − p)`` and its root, in bins.
    mean: float
    variance: float
    spread: float
    #: The likeliest bin (the left one of two equally likely) and its share.
    peak_bin: int
    peak_share: float
    #: All the paths through ``n`` rows, ``2ⁿ``.
    paths: int


def _rows(rows: int) -> None:
    if not 1 <= rows <= MOST_ROWS:
        raise ValueError(f"a board has 1 to {MOST_ROWS} rows")


def _share(p: float) -> None:
    if not 0 <= p <= 1:
        raise ValueError("the share to the right lies between 0 and 1")


def shares(rows: int, p: float) -> tuple[float, ...]:
    """Each bin's share of the balls, ``0`` to ``rows``: the binomial
    distribution, built row by row as the balls fall."""
    _rows(rows)
    _share(p)
    q = 1 - p
    row = [1.0]
    for _ in range(rows):
        row = [(row[k - 1] * p if k > 0 else 0.0) + (row[k] * q if k < len(row) else 0.0) for k in range(len(row) + 1)]
    return tuple(row)


def paths(rows: int) -> tuple[int, ...]:
    """The paths to each bin: Pascal's triangle's row ``rows``, by additions."""
    _rows(rows)
    row = [1]
    for _ in range(rows):
        row = [(row[k - 1] if k > 0 else 0) + (row[k] if k < len(row) else 0) for k in range(len(row) + 1)]
    return tuple(row)


def normal(rows: int, p: float, k: float) -> float:
    """The normal curve of the board's middle and spread at bin ``k``: de
    Moivre and Laplace's approximation of the share there."""
    _rows(rows)
    if not 0 < p < 1:
        raise ValueError("a normal curve needs a share strictly between 0 and 1")
    mean, variance = rows * p, rows * p * (1 - p)
    return math.exp(-((k - mean) ** 2) / (2 * variance)) / math.sqrt(2 * math.pi * variance)


def figures(rows: int, p: float) -> Figures:
    s = shares(rows, p)
    peak = max(range(len(s)), key=lambda k: (s[k], -k))
    variance = rows * p * (1 - p)
    return Figures(
        mean=rows * p,
        variance=variance,
        spread=math.sqrt(variance),
        peak_bin=peak,
        peak_share=s[peak],
        paths=2**rows,
    )


def _seeded(seed: int) -> None:
    if not 0 <= seed <= _MASK:
        raise ValueError("a seed is a whole number from 0 to 2³² − 1")


def uniforms(seed: int, count: int) -> tuple[float, ...]:
    """``count`` draws in ``[0, 1)`` from Mulberry32 started at ``seed``: 32-bit
    integer steps, so a browser's ``Math.imul`` and ``>>>`` give the same
    numbers bit for bit."""
    _seeded(seed)
    if not 0 <= count <= MOST_ROWS * MOST_BALLS:
        raise ValueError("too many draws for one run")
    state = seed
    out = []
    for _ in range(count):
        state = (state + _STEP) & _MASK
        t = ((state ^ (state >> 15)) * (state | 1)) & _MASK
        t = ((t + (((t ^ (t >> 7)) * (t | 61)) & _MASK)) & _MASK) ^ t
        out.append(((t ^ (t >> 14)) & _MASK) / 4294967296)
    return tuple(out)


def turns(rows: int, p: float, balls: int, seed: int) -> tuple[tuple[bool, ...], ...]:
    """Each ball's turns, row by row: ``True`` where it went right."""
    _rows(rows)
    _share(p)
    if not 1 <= balls <= MOST_BALLS:
        raise ValueError(f"a run is 1 to {MOST_BALLS} balls")
    u = uniforms(seed, rows * balls)
    return tuple(tuple(u[i * rows + j] < p for j in range(rows)) for i in range(balls))


def drop(rows: int, p: float, balls: int, seed: int) -> Drop:
    """A run of ``balls`` balls from ``seed``: the same run every time."""
    bins = tuple(sum(path) for path in turns(rows, p, balls, seed))
    counts = [0] * (rows + 1)
    for k in bins:
        counts[k] += 1
    mean = sum(bins) / balls
    variance = sum((k - mean) ** 2 for k in bins) / balls
    return Drop(bins=bins, counts=tuple(counts), mean=mean, variance=variance)
