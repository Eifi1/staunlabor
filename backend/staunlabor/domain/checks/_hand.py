"""The checks' own hand formulas, shared: standard gravity, the elliptic
integrals by a plain midpoint sum, and halving a bracket.

Deliberately independent of the engine: nothing here imports
``domain/experiments``. A check is worth something only if its expected value
does not come from the engine's own code, so the integrals are summed here
rather than taken from the engine's arithmetic-geometric mean, and gravity is
written out again rather than imported from ``experiments/constants.py``.

A change to this module unchecks every exhibit whose checks import it: the
fingerprint follows a check module's imports (``checks/__init__.py``). Keep it
small and keep it still; a helper one check alone uses stays in that check.
"""

from __future__ import annotations

import math
from collections.abc import Callable

#: Standard gravity, m/s², as the engine takes it (CGPM 1901, exact by definition).
G = 9.80665

#: Steps of the midpoint sums: far more than the integrands, smooth and gently
#: curved, need for the last digits.
SUM_STEPS = 20000


def elliptic_f_by_sum(phi: float, modulus: float, n: int = SUM_STEPS) -> float:
    """F(φ, k) = ∫₀^φ dθ/√(1 − k² sin²θ) by the midpoint rule: a reader's own
    integral, not the engine's arithmetic-geometric mean."""
    h = phi / n
    return h * sum(1 / math.sqrt(1 - (modulus * math.sin((j + 0.5) * h)) ** 2) for j in range(n))


def elliptic_k_by_sum(modulus: float, n: int = SUM_STEPS) -> float:
    """K(k) = F(π/2, k) = ∫₀^{π/2} dφ/√(1 − k² sin²φ) by the midpoint rule."""
    return elliptic_f_by_sum(math.pi / 2, modulus, n)


def bisect(below: Callable[[float], bool], lo: float, hi: float, iterations: int) -> float:
    """Where ``below`` stops holding between ``lo`` (where it holds) and ``hi``
    (where it does not): the bracket halved ``iterations`` times, its
    midpoint. The count is each check's own, chosen for its bracket and what
    each evaluation costs."""
    for _ in range(iterations):
        mid = (lo + hi) / 2
        if below(mid):
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2
