"""The Galton board, checked: the middle bin of eight rows against the share
Wikipedia's Pascal's triangle names, the paths to the middle of twelve rows
against the factorials, a tilted board's middle and spread against the
binomial distribution's, the exhibit's seeded run against its expected middle
within three standard errors, and the middle of 24 rows against de Moivre and
Laplace's normal curve, within the first correction of the central binomial
coefficient's series.

Exact fractions and factorials here, the engine's row-by-row floats there:
the page's own functions.
"""

from __future__ import annotations

import math
from fractions import Fraction

from staunlabor.domain.checks import Case, Source
from staunlabor.domain.experiments import galton as engine

_BOARD = Source(
    cite="Wikipedia, “Galton board”, §Distribution of the beads",
    url="https://en.wikipedia.org/wiki/Galton_board",
    quote="If a bead bounces to the right k times on its way down (and to the left on the remaining pegs) it ends up "
    "in the kth bin counting from the left. Denoting the number of rows of pegs in a Galton Board by n, the number "
    "of paths to the kth bin on the bottom is given by the binomial coefficient {n\\choose k}. […] If the "
    "probability of bouncing right on a peg is p (which equals 0.5 on an unbiased level machine) the probability "
    "that the ball ends up in the kth bin equals {n\\choose k} p^k (1-p)^{n-k}. This is the probability mass "
    "function of a binomial distribution.",
)
_EIGHT = Source(
    cite="Wikipedia, “Pascal's triangle”, the figure “Binomial distribution for p = 0.5”",
    url="https://en.wikipedia.org/wiki/Pascal%27s_triangle",
    quote="The probability that a ball in a Galton box with 8 layers (n = 8) ends up in the central bin (k = 4) is "
    "70/256.",
)
_PMF = Source(
    cite="Wikipedia, “Binomial distribution”, §Definitions, Probability mass function",
    url="https://en.wikipedia.org/wiki/Binomial_distribution",
    quote="f(k;n,p) = \\Pr(X = k) = \\binom{n}{k}p^k(1-p)^{n-k} for k = 0, 1, 2, ..., n, where "
    "\\binom{n}{k} =\\frac{n!}{k!(n-k)!} is the binomial coefficient.",
)
_MOMENTS = Source(
    cite="Wikipedia, “Binomial distribution”, §Properties, Expected value and variance",
    url="https://en.wikipedia.org/wiki/Binomial_distribution",
    quote="If X ~ B(n, p), that is, X is a binomially distributed random variable, n being the total number of "
    "experiments and p the probability of each experiment yielding a successful result, then the expected value "
    "of X is: \\operatorname{E}[X] = np. […] The variance is: \\operatorname{Var}(X) = npq = np(1 - p).",
)
_STANDARD_ERROR = Source(
    cite="Wikipedia, “Standard error”, §Standard error of the sample mean, Exact value",
    url="https://en.wikipedia.org/wiki/Standard_error",
    quote="The mean value calculated from the sample, \\bar{x}, will have an associated standard error on the mean, "
    "{\\sigma}_\\bar{x}, given by: {\\sigma}_\\bar{x} = \\frac{\\sigma}{\\sqrt{n}}.",
)
_DE_MOIVRE = Source(
    cite="Wikipedia, “De Moivre–Laplace theorem”, §Theorem (citing Papoulis and Pillai 2002; Feller 1968, VII.3)",
    url="https://en.wikipedia.org/wiki/De_Moivre%E2%80%93Laplace_theorem",
    quote="As n grows large, for k in the neighborhood of np we can approximate {n \\choose k}\\, p^k q^{n-k} "
    "\\simeq \\frac{1}{\\sqrt{2 \\pi npq}}\\,e^{-\\frac{(k-np)^2}{2npq}}, \\qquad p+q=1,\\ p, q > 0 in the sense "
    "that the ratio of the left-hand side to the right-hand side converges to 1 as n → ∞.",
)
_CENTRAL = Source(
    cite="Wikipedia, “Central binomial coefficient”, §Asymptotic growth (citing Luke 1969, p. 35)",
    url="https://en.wikipedia.org/wiki/Central_binomial_coefficient",
    quote="The asymptotic behavior can be described quite accurately: {2n \\choose n} = "
    "\\frac{4^n}{\\sqrt{\\pi n}}\\left(1-\\frac{1}{8n}+\\frac{1}{128 n^2}+\\frac{5}{1024 n^3} + O(n^{-4})\\right).",
)

#: The tilted board: twelve rows, seven turns in ten to the right.
_TILT = 0.7
#: The widest board the page builds, for the normal curve.
_WIDE = engine.MOST_ROWS


def _binomial(n: int, k: int, p: Fraction) -> Fraction:
    """C(n, k)·pᵏ·(1 − p)ⁿ⁻ᵏ, the binomial coefficient by factorials."""
    paths = math.factorial(n) // (math.factorial(k) * math.factorial(n - k))
    return paths * p**k * (1 - p) ** (n - k)


def _engine_mean(rows: int, p: float) -> float:
    """The middle of the engine's shares, Σ k·P(k)."""
    return sum(k * share for k, share in enumerate(engine.shares(rows, p)))


def _engine_variance(rows: int, p: float) -> float:
    """The spread of the engine's shares, Σ (k − μ)²·P(k), about their own middle."""
    s = engine.shares(rows, p)
    mean = sum(k * share for k, share in enumerate(s))
    return sum((k - mean) ** 2 * share for k, share in enumerate(s))


def _seeded_tolerance() -> float:
    """Three standard errors of the mean of the exhibit's run, σ/√N with
    σ = √(n·p·(1 − p)), over its expected middle n·p: a run strays further
    about three times in a thousand."""
    n, p, balls = engine.EXHIBIT_ROWS, engine.LEVEL, engine.EXHIBIT_BALLS
    return 3 * math.sqrt(n * p * (1 - p)) / math.sqrt(balls) / (n * p)


def _setting(rows: int, p: float, **more: float) -> dict[str, float | str]:
    """What the page's "Set it up" sets: the board's rows and its share to the
    right, and for a run its balls and seed."""
    return {"rows": rows, "p": p, **more}


CASES: tuple[Case, ...] = (
    Case(
        key="eight_rows",
        unit="",
        expected=lambda: float(_binomial(8, 4, Fraction(1, 2))),
        measured=lambda: engine.shares(8, 0.5)[4],
        # Halves and their sums: exact in floats, 70/256 to the last bit.
        tolerance=1e-12,
        sources=(_EIGHT, _BOARD),
        setting=_setting(8, 0.5),
    ),
    Case(
        key="paths",
        unit="",
        expected=lambda: float(math.factorial(12) // (math.factorial(6) * math.factorial(6))),
        measured=lambda: float(engine.paths(12)[6]),
        # Whole numbers: exact.
        tolerance=0.0,
        sources=(_BOARD, _PMF),
        setting=_setting(12, 0.5),
    ),
    Case(
        key="tilted_mean",
        unit="",
        expected=lambda: float(engine.EXHIBIT_ROWS * Fraction(7, 10)),
        measured=lambda: _engine_mean(engine.EXHIBIT_ROWS, _TILT),
        # Twelve rows of products of 0.7 and 0.3, then a sum of 13: rounding only.
        tolerance=1e-12,
        sources=(_MOMENTS,),
        setting=_setting(engine.EXHIBIT_ROWS, _TILT),
    ),
    Case(
        key="tilted_spread",
        unit="",
        expected=lambda: float(engine.EXHIBIT_ROWS * Fraction(7, 10) * Fraction(3, 10)),
        measured=lambda: _engine_variance(engine.EXHIBIT_ROWS, _TILT),
        # As the middle: rounding only.
        tolerance=1e-12,
        sources=(_MOMENTS,),
        setting=_setting(engine.EXHIBIT_ROWS, _TILT),
    ),
    Case(
        key="seeded_run",
        unit="",
        expected=lambda: engine.EXHIBIT_ROWS * engine.LEVEL,
        measured=lambda: engine.drop(engine.EXHIBIT_ROWS, engine.LEVEL, engine.EXHIBIT_BALLS, engine.EXHIBIT_SEED).mean,
        tolerance=_seeded_tolerance(),
        sources=(_MOMENTS, _STANDARD_ERROR),
        derived=True,
        setting=_setting(engine.EXHIBIT_ROWS, engine.LEVEL, balls=engine.EXHIBIT_BALLS, seed=engine.EXHIBIT_SEED),
    ),
    Case(
        key="de_moivre",
        unit="",
        expected=lambda: 1 / math.sqrt(2 * math.pi * _WIDE * 0.5 * 0.5),
        measured=lambda: engine.shares(_WIDE, 0.5)[_WIDE // 2],
        # The ratio of the two is the series' bracket at m = n/2 = 12, so the
        # share lies 1/(8m) − 1/(128m²) − … = 1.036 % under the curve: the
        # first correction, 1/(8m) = 1.042 %, is what is allowed.
        tolerance=1 / (8 * (_WIDE // 2)),
        sources=(_DE_MOIVRE, _CENTRAL),
        derived=True,
        setting=_setting(_WIDE, 0.5),
    ),
)
