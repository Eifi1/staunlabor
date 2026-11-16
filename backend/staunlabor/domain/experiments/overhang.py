"""The overhang: identical blocks stacked over a table's edge, each a little further out, reach further than a block's length.

The exhibit hands the visitor nine identical wooden blocks and an edge: no
glue, no nails; how far out can the top block reach? Most stop at about one
block's length, with the stack leaning out in even steps. Shifted right, four
blocks already reach more than a whole length beyond the edge, and nine a
length and two fifths.

**Why it holds.** A block rests on the one below as long as the centre of
mass of it and everything on it lies over the block below; at the edge it
tips. Stacked in even steps, the whole stack's centre reaches the edge first,
and ``n`` blocks reach ``n/(n + 1)`` of a length out: never a whole one. Built
from the top down, each block pushed as far out as the ones above
allow, the top one sticks out half a length over the second, the top two
together a quarter over the third, the top three a sixth over the fourth: the
steps are ``1/(2k)``, and the overhang of ``n`` blocks is half the harmonic
number, ``H_n/2 = (1 + 1/2 + … + 1/n)/2``.

**What follows.** The harmonic series has no end: with enough blocks the stack
reaches as far out as one likes. But slowly, as a logarithm: one length takes
4 blocks, two lengths 31, three 227, four 1674.

**The model.** Rigid blocks of one length, one to a layer, each resting on the
one below over the stretch where they overlap (the table's top for the
lowest, its edge at zero, the table to the left). A layer holds as long as the
centre of mass of it and all above lies over that stretch; the stack holds if
every layer does. Lengths are in blocks.

**What it leaves out.** Stacks with more than one block to a layer, which
reach further by using some blocks as counterweights (Paterson and Zwick);
friction (the blocks never slide; they only tip); the blocks' giving way; a
hand's shake, which makes a stack built to the very edge fall: a real one is
built a little short of the limit.
"""

from __future__ import annotations

from dataclasses import dataclass

#: The exhibit's blocks, and their size: wooden ones, 20 cm long, 4 cm high
#: (the stack's figures are in lengths; the size only draws and measures it).
EXHIBIT_BLOCKS = 9
BLOCK_LENGTH_M = 0.20
BLOCK_HEIGHT_M = 0.04
#: The most the page stacks.
MOST_BLOCKS = 20


@dataclass(frozen=True)
class StackLayer:
    #: The stretch it rests on: from ``left`` to ``right``, in blocks.
    left: float
    right: float
    #: The centre of mass of it and every block above it.
    centre: float
    #: How far inside the stretch the centre lies, to the nearer end; below
    #: zero, the layer tips.
    margin: float


def _checked(lefts: tuple[float, ...]) -> None:
    if not 1 <= len(lefts) <= MOST_BLOCKS:
        raise ValueError(f"a stack is 1 to {MOST_BLOCKS} blocks")
    if not all(-2 <= x <= 2 for x in lefts):
        raise ValueError("a block lies within two lengths of the edge")


def layers(lefts: tuple[float, ...]) -> list[StackLayer]:
    """Each layer's footing, bottom first: block ``i`` spans
    ``[lefts[i], lefts[i] + 1]``; the lowest rests on the table, ``x ≤ 0``."""
    _checked(lefts)
    out = []
    n = len(lefts)
    for i, x in enumerate(lefts):
        below_left, below_right = (float("-inf"), 0.0) if i == 0 else (lefts[i - 1], lefts[i - 1] + 1)
        left, right = max(x, below_left), min(x + 1, below_right)
        centre = sum(lefts[i:]) / (n - i) + 0.5
        margin = min(centre - left, right - centre) if right > left else -1.0
        out.append(StackLayer(left, right, centre, margin))
    return out


def holds(lefts: tuple[float, ...]) -> bool:
    """Whether every layer's centre lies over its footing, its ends included."""
    return all(layer.margin >= -1e-12 for layer in layers(lefts))


def overhang(lefts: tuple[float, ...]) -> float:
    """How far the furthest block reaches beyond the edge, in blocks."""
    _checked(lefts)
    return max(lefts) + 1


def harmonic(n: int) -> tuple[float, ...]:
    """The furthest stack of ``n``, bottom first: the ``k``-th block from the
    top juts ``1/(2k)`` over the one below it, the lowest ``1/(2n)`` over the edge."""
    if not 1 <= n <= MOST_BLOCKS:
        raise ValueError(f"a stack is 1 to {MOST_BLOCKS} blocks")
    rights = []
    reach = 0.0
    for k in range(n, 0, -1):
        reach += 1 / (2 * k)
        rights.append(reach)
    return tuple(r - 1 for r in rights)


def even(n: int) -> tuple[float, ...]:
    """The furthest stack of ``n`` in even steps, bottom first: each block
    ``1/(n + 1)`` further out than the one below, the lowest that far over the
    edge — the whole stack's centre then sits on the edge, and it reaches
    ``n/(n + 1)``, never a whole length."""
    if not 1 <= n <= MOST_BLOCKS:
        raise ValueError(f"a stack is 1 to {MOST_BLOCKS} blocks")
    step = 1 / (n + 1)
    return tuple((i + 1) * step - 1 for i in range(n))


def blocks_for(reach: float) -> int:
    """The fewest blocks whose furthest stack reaches ``reach`` lengths out:
    the first ``n`` with ``H_n/2 ≥ reach``."""
    if not 0 < reach <= 5:
        raise ValueError("a reach lies above nothing and at most five lengths")
    total, n = 0.0, 0
    while total / 2 < reach:
        n += 1
        total += 1 / n
    return n
