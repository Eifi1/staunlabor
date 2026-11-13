"""Classical fourth-order Runge–Kutta at a fixed step, for the tests alone: the
reference a test integrates a model's full equations with, to hold the
engine's reduced ones to them. The site itself never needs a general solver."""

from __future__ import annotations

import math
from collections.abc import Callable, Sequence
from dataclasses import dataclass

Rhs = Callable[[float, list[float]], Sequence[float]]


@dataclass(frozen=True)
class Trace:
    """The times, and one tuple of values per state component."""

    t: tuple[float, ...]
    states: tuple[tuple[float, ...], ...]


def rk4(f: Rhs, y0: Sequence[float], h: float, t_end: float, t0: float = 0.0, sample_every: int = 1) -> Trace:
    n = math.ceil((t_end - t0) / h - 1e-9)
    y = [float(v) for v in y0]
    ts, ys = [t0], [y]
    t = t0
    for k in range(1, n + 1):
        step = min(h, t_end - t) if k == n else h
        k1 = f(t, y)
        k2 = f(t + step / 2, [a + step / 2 * b for a, b in zip(y, k1, strict=True)])
        k3 = f(t + step / 2, [a + step / 2 * b for a, b in zip(y, k2, strict=True)])
        k4 = f(t + step, [a + step * b for a, b in zip(y, k3, strict=True)])
        y = [a + step / 6 * (b + 2 * c + 2 * d + e) for a, b, c, d, e in zip(y, k1, k2, k3, k4, strict=True)]
        t = t0 + k * h if k < n else t_end
        if k % sample_every == 0 or k == n:
            ts.append(t)
            ys.append(y)
    return Trace(tuple(ts), tuple(zip(*ys, strict=True)))
