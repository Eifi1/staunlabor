"""The overhang, checked: the furthest stack of the exhibit's nine blocks
against half the harmonic number, every one of its layers balanced on its
edge, the even steps against the whole stack's centre on the table's edge, and
the blocks four lengths take.

Exact fractions here, the engine's floats there: the page's own functions.
"""

from __future__ import annotations

from fractions import Fraction

from staunlabor.domain.checks import Case, Source
from staunlabor.domain.experiments import overhang as engine

ENGINE = ("overhang",)

_SUM = Source(
    cite="Wikipedia, “Block-stacking problem”, §Variants, Single-wide",
    url="https://en.wikipedia.org/wiki/Block-stacking_problem",
    quote="the solution to the single-wide problem is that the maximum overhang is given by ∑_{i=1}^{N} 1/(2i) "
    "times the width of a block. This sum is one half of the corresponding partial sum of the harmonic series.",
)
_CLASSICAL = Source(
    cite="M. Paterson, U. Zwick, “Overhang”, arXiv:0710.2357, abstract (Amer. Math. Monthly)",
    url="https://arxiv.org/abs/0710.2357",
    quote="How far off the edge of the table can we reach by stacking n identical, homogeneous, frictionless blocks "
    "of length 1? A classical solution achieves an overhang of 1/2 H_n, where H_n ~ ln n is the nth harmonic number.",
)
_BALANCE = Source(
    cite="Wikipedia, “Block-stacking problem”, §Proof of solution of single-wide variant",
    url="https://en.wikipedia.org/wiki/Block-stacking_problem",
    quote="For k blocks, the center of mass of the k-block system must lie above the table's edge, and the center "
    "of mass of the k−1 top blocks must lie above the edge of the first for static equilibrium.",
)
_COUNT = Source(
    cite="Wikipedia, “Block-stacking problem”, §Variants, Single-wide (citing OEIS A014537)",
    url="https://en.wikipedia.org/wiki/Block-stacking_problem",
    quote="The number of blocks required to reach at least N block-lengths past the edge of the table is 4, 31, 227, "
    "1674, 12367, 91380, ...",
)

#: The exhibit's nine blocks, 20 cm long.
_NINE = engine.EXHIBIT_BLOCKS
_LENGTH_CM = engine.BLOCK_LENGTH_M * 100


def _half_harmonic(n: int) -> Fraction:
    """∑ 1/(2i) for i = 1 … n, exactly."""
    return sum((Fraction(1, 2 * i) for i in range(1, n + 1)), Fraction(0))


def _standing_reach_cm(lefts: tuple[float, ...]) -> float:
    """How far the engine's stack reaches, on the page's 20 cm blocks — and
    nothing at all if the engine says it would tip."""
    return engine.overhang(lefts) * _LENGTH_CM if engine.holds(lefts) else 0.0


def _off_balance() -> float:
    """The largest distance, in lengths, between a layer's centre of mass (of
    it and all above) and the nearer end of its footing, over the nine layers
    of the furthest stack: zero where every layer stands on its very edge."""
    return max(abs(layer.margin) for layer in engine.layers(engine.harmonic(_NINE)))


def _even_hand_cm(n: int) -> float:
    """Even steps s, the lowest block s over the edge: the blocks' middles at
    i·s − ½ for i = 1 … n average (n + 1)·s/2 − ½, which the whole stack's
    centre must not pass, the table's edge: s = 1/(n + 1), and the top block
    reaches n·s."""
    return float(Fraction(n, n + 1)) * _LENGTH_CM


def _blocks_hand(lengths: int) -> int:
    """The first n whose ∑ 1/(2i) reaches ``lengths``, summed exactly."""
    total, n = Fraction(0), 0
    while total < lengths:
        n += 1
        total += Fraction(1, 2 * n)
    return n


def _setting(count: int, stack: str) -> dict[str, float | str]:
    """What the page's "Set it up" sets: the number of blocks and which of its
    stacks it builds. Only "even": the furthest stack is the page's held
    answer, shown once the reader has tipped a stack, so its two cases have
    no setting and no button (Marcel, 2026-11-21)."""
    return {"blocks": count, "stack": stack}


CASES: tuple[Case, ...] = (
    Case(
        key="nine",
        unit="cm",
        expected=lambda: float(_half_harmonic(_NINE)) * _LENGTH_CM,
        measured=lambda: _standing_reach_cm(engine.harmonic(_NINE)),
        # The engine adds nine floats: rounding only.
        tolerance=1e-12,
        sources=(_SUM, _CLASSICAL),
        setting={},
    ),
    Case(
        key="knife_edge",
        unit="",
        expected=lambda: 0.0,
        measured=_off_balance,
        # The engine's floats: 10⁻¹⁶ here.
        tolerance=1e-12,
        sources=(_BALANCE,),
        setting={},
    ),
    Case(
        key="even",
        unit="cm",
        expected=lambda: _even_hand_cm(_NINE),
        measured=lambda: _standing_reach_cm(engine.even(_NINE)),
        # Rounding only.
        tolerance=1e-12,
        sources=(_BALANCE,),
        derived=True,
        setting=_setting(_NINE, "even"),
    ),
    Case(
        key="four_lengths",
        unit="",
        expected=lambda: float(_blocks_hand(4)),
        measured=lambda: float(engine.blocks_for(4.0)),
        # A count: exact. The engine's float sum is safe here, half the
        # harmonic number passes 4 by 2.4 · 10⁻⁴ at 1674 and misses it by
        # 5.6 · 10⁻⁵ at 1673.
        tolerance=0.0,
        sources=(_COUNT, _SUM),
        setting={},
    ),
)
