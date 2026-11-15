"""Chladni figures: sand gathers where a ringing plate stands still.

The exhibit is a square metal plate held at its middle on a shaker, sand
strewn on it. As the tone rises, the plate rings now and then, and at each
ringing the sand runs into lines — a different pattern each time — and lies
still there.

**The model.** Kirchhoff's thin plate, its edges free:
``D·∇⁴w = ρh·ω²·w``, ``D = E·h³/(12(1 − ν²))``. Its modes are found by
Ritz's method: the deflection as a sum of products of Legendre polynomials,
``w = Σ c_mn·p_m(ξ)·p_n(η)`` on the plate's square ``[−1, 1]²``, the bending
energy and the motion's energy as matrices, their eigenvalues by Jacobi's
rotations. A free edge needs nothing of the sum (its conditions are the
energy's own), so polynomials serve. The square's symmetry splits the modes
four ways — even or odd across each middle line — and the doubly even ones
again by whether they keep or change sign when x and y swap.

**What the page shows.** Shaken at its middle, a plate rings in the modes that
move there: the doubly even ones that keep their sign under the swap. Every
other mode has a still middle and is not driven. Shaken at ``Ω``, the plate
answers with ``w = Σ φ_k·φ_k(0)/(ω_k² − Ω² + 2iζω_kΩ)``; the sand is drawn
where that is small (a drawing rule, not a sand model).

**What it leaves out.** The shaker's hold at the middle (its mass and its
stiffness shift the tones a little), the plate's thickness beside its side
(Kirchhoff's assumption), and sand that jumps rather than drifts.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from functools import lru_cache

#: Poisson's ratio of the plate: steel's, and Leissa's tables'.
NU = 0.3

#: The highest polynomial degree in each direction: the ten driven modes agree
#: with degree 24's to 0.1 in λ.
DEGREE = 20

#: Jacobi's rotations stop when no off-diagonal entry is larger than this,
#: relative to the diagonal's largest.
JACOBI_TOL = 1e-14
JACOBI_SWEEPS = 60


def _gauss(n: int) -> list[tuple[float, float]]:
    """Gauss–Legendre nodes and weights on [−1, 1], by Newton's method."""
    out = []
    for i in range(1, n + 1):
        x = math.cos(math.pi * (i - 0.25) / (n + 0.5))
        for _ in range(100):
            p0, p1 = 1.0, x
            for k in range(2, n + 1):
                p0, p1 = p1, ((2 * k - 1) * x * p1 - (k - 1) * p0) / k
            dp = n * (x * p1 - p0) / (x * x - 1)
            dx = p1 / dp
            x -= dx
            if abs(dx) < 1e-16:
                break
        p0, p1 = 1.0, x
        for k in range(2, n + 1):
            p0, p1 = p1, ((2 * k - 1) * x * p1 - (k - 1) * p0) / k
        dp = n * (x * p1 - p0) / (x * x - 1)
        out.append((x, 2 / ((1 - x * x) * dp * dp)))
    return out


def legendre(degree: int, x: float) -> tuple[list[float], list[float], list[float]]:
    """The normalised Legendre polynomials ``p_n = √((2n+1)/2)·P_n`` up to
    ``degree`` at ``x``, with their first and second derivatives."""
    p = [1.0, x]
    d1 = [0.0, 1.0]
    d2 = [0.0, 0.0]
    for k in range(2, degree + 1):
        p.append(((2 * k - 1) * x * p[k - 1] - (k - 1) * p[k - 2]) / k)
        # P'_k = P'_{k−2} + (2k − 1)·P_{k−1}, and so on for P''.
        d1.append(d1[k - 2] + (2 * k - 1) * p[k - 1])
        d2.append(d2[k - 2] + (2 * k - 1) * d1[k - 1])
    scale = [math.sqrt((2 * k + 1) / 2) for k in range(degree + 1)]
    return (
        [a * s for a, s in zip(p[: degree + 1], scale, strict=True)],
        [a * s for a, s in zip(d1[: degree + 1], scale, strict=True)],
        [a * s for a, s in zip(d2[: degree + 1], scale, strict=True)],
    )


@lru_cache(maxsize=4)
def _integrals(degree: int) -> dict[str, tuple[tuple[float, ...], ...]]:
    """``E^{rs}_{mp} = ∫ p_m^{(r)}·p_p^{(s)}`` for the derivatives the energy
    needs, exact by Gauss–Legendre."""
    nodes = _gauss(degree + 2)
    n = degree + 1
    tables = {key: [[0.0] * n for _ in range(n)] for key in ("00", "11", "22", "20")}
    for x, w in nodes:
        p, d1, d2 = legendre(degree, x)
        for m in range(n):
            for q in range(n):
                tables["00"][m][q] += w * p[m] * p[q]
                tables["11"][m][q] += w * d1[m] * d1[q]
                tables["22"][m][q] += w * d2[m] * d2[q]
                tables["20"][m][q] += w * d2[m] * p[q]
    return {key: tuple(tuple(row) for row in table) for key, table in tables.items()}


def _jacobi(a: list[list[float]]) -> tuple[list[float], list[list[float]]]:
    """Eigenvalues and eigenvectors (as columns) of a symmetric matrix, by
    cyclic Jacobi rotations."""
    n = len(a)
    a = [row[:] for row in a]
    v = [[1.0 if i == j else 0.0 for j in range(n)] for i in range(n)]
    for _ in range(JACOBI_SWEEPS):
        off = max((abs(a[i][j]) for i in range(n) for j in range(i + 1, n)), default=0.0)
        scale = max(abs(a[i][i]) for i in range(n))
        if off <= JACOBI_TOL * scale:
            break
        for p in range(n - 1):
            for q in range(p + 1, n):
                if a[p][q] == 0.0:
                    continue
                theta = (a[q][q] - a[p][p]) / (2 * a[p][q])
                t = math.copysign(1.0, theta) / (abs(theta) + math.sqrt(theta * theta + 1))
                c = 1 / math.sqrt(t * t + 1)
                s = t * c
                for k in range(n):
                    akp, akq = a[k][p], a[k][q]
                    a[k][p] = c * akp - s * akq
                    a[k][q] = s * akp + c * akq
                for k in range(n):
                    apk, aqk = a[p][k], a[q][k]
                    a[p][k] = c * apk - s * aqk
                    a[q][k] = s * apk + c * aqk
                for k in range(n):
                    vkp, vkq = v[k][p], v[k][q]
                    v[k][p] = c * vkp - s * vkq
                    v[k][q] = s * vkp + c * vkq
    return [a[i][i] for i in range(n)], v


Kind = tuple[int, int, int]
"""(x parity, y parity, swap): parities 0 even and 1 odd; swap +1 or −1 for the
doubly even and doubly odd kinds, 0 where x and y differ in parity."""


@dataclass(frozen=True)
class Mode:
    #: λ = ω·a²·√(ρh/D), a the side.
    lam: float
    #: The deflection as ``Σ c·p_m(ξ)·p_n(η)``: (m, n, c), scaled so that the
    #: largest |w| on the plate is 1.
    terms: tuple[tuple[int, int, float], ...]
    kind: Kind


def _basis(degree: int, kind: Kind) -> list[list[tuple[int, int, float]]]:
    """Each basis function as its (m, n, weight) products."""
    px, py, swap = kind
    out = []
    for m in range(px, degree + 1, 2):
        for n in range(py, degree + 1, 2):
            if swap == 0:
                out.append([(m, n, 1.0)])
            elif m < n:
                out.append([(m, n, 1 / math.sqrt(2)), (n, m, swap / math.sqrt(2))])
            elif m == n and swap == 1:
                out.append([(m, n, 1.0)])
    return out


def _value(terms: tuple[tuple[int, int, float], ...], x: float, y: float, degree: int) -> float:
    px = legendre(degree, x)[0]
    py = legendre(degree, y)[0]
    return sum(c * px[m] * py[n] for m, n, c in terms)


@lru_cache(maxsize=16)
def _solved(kind: Kind, degree: int) -> tuple[tuple[float, tuple[tuple[int, int, float], ...]], ...]:
    """Every bending mode of one kind, lowest first: κ and its unscaled terms."""
    e = _integrals(degree)
    funcs = _basis(degree, kind)
    size = len(funcs)

    def stiffness(m: int, n: int, p: int, q: int) -> float:
        return (
            e["22"][m][p] * e["00"][n][q]
            + e["00"][m][p] * e["22"][n][q]
            + NU * (e["20"][m][p] * e["20"][q][n] + e["20"][p][m] * e["20"][n][q])
            + 2 * (1 - NU) * e["11"][m][p] * e["11"][n][q]
        )

    k = [
        [sum(wa * wb * stiffness(m, n, p, q) for m, n, wa in funcs[i] for p, q, wb in funcs[j]) for j in range(size)]
        for i in range(size)
    ]
    values, vectors = _jacobi(k)
    order = sorted(range(size), key=lambda i: values[i])
    # Rigid motions (a lift, two tilts) have no bending energy: they are not
    # tones. Their eigenvalue is zero up to rounding, which grows with the
    # matrix's largest entry; the lowest true tone of a free square plate has
    # κ = (13.47/4)² ≈ 11, so 1 parts the two at any degree.
    out = []
    for i in (i for i in order if values[i] > 1.0):
        merged: dict[tuple[int, int], float] = {}
        for b, func in enumerate(funcs):
            for m, n, w in func:
                merged[(m, n)] = merged.get((m, n), 0.0) + vectors[b][i] * w
        out.append((values[i], tuple((m, n, c) for (m, n), c in sorted(merged.items()))))
    return tuple(out)


@lru_cache(maxsize=4)
def _grid(degree: int) -> tuple[tuple[float, ...], ...]:
    """The polynomials on a 41-point line across the plate, for the peaks."""
    return tuple(tuple(legendre(degree, -1 + 2 * i / 40)[0]) for i in range(41))


@lru_cache(maxsize=256)
def _mode(kind: Kind, degree: int, index: int) -> Mode:
    kappa, terms = _solved(kind, degree)[index]
    rows = _grid(degree)
    peak = max(abs(sum(c * px[m] * py[n] for m, n, c in terms)) for px in rows for py in rows)
    # One sign for every mode: positive in the plate's middle, or, where the
    # middle stands still, as the solver left it.
    here = _value(terms, 0.0, 0.0, degree)
    sign = -1.0 if here < -1e-9 * peak else 1.0
    return Mode(lam=4 * math.sqrt(kappa), terms=tuple((m, n, sign * c / peak) for m, n, c in terms), kind=kind)


def modes(kind: Kind, count: int, degree: int = DEGREE) -> tuple[Mode, ...]:
    """The lowest ``count`` modes of one symmetry kind of the free square plate."""
    return tuple(_mode(kind, degree, i) for i in range(count))


def driven_modes(count: int = 10) -> tuple[Mode, ...]:
    """The modes a shaker at the middle drives: doubly even, kept under the swap."""
    return modes((0, 0, 1), count)


def value(mode: Mode, x: float, y: float) -> float:
    """The mode's deflection at (x, y) of the square [−1, 1]²."""
    return _value(mode.terms, x, y, DEGREE)


@dataclass(frozen=True)
class Plate:
    side_m: float = 0.24
    thickness_m: float = 0.001
    youngs_gpa: float = 200.0
    density_kg_m3: float = 7850.0
    #: ζ of every mode.
    damping_ratio: float = 0.002

    def __post_init__(self) -> None:
        if not 0.05 <= self.side_m <= 2:
            raise ValueError("the plate's side lies between 5 cm and 2 m")
        if not 0.0002 <= self.thickness_m <= self.side_m / 20:
            raise ValueError("the plate is at least 0.2 mm thick and thin beside its side")
        if not 0.0001 <= self.damping_ratio <= 0.1:
            raise ValueError("the damping ratio lies between 0.0001 and 0.1")


def frequency_hz(plate: Plate, lam: float) -> float:
    """``f = λ/(2π·a²)·√(D/(ρh))``."""
    d = plate.youngs_gpa * 1e9 * plate.thickness_m**3 / (12 * (1 - NU**2))
    return lam / (2 * math.pi * plate.side_m**2) * math.sqrt(d / (plate.density_kg_m3 * plate.thickness_m))


def response(plate: Plate, driven: tuple[Mode, ...], drive_hz: float, x: float, y: float) -> float:
    """How far the plate swings at (x, y), shaken at its middle at ``drive_hz``:
    ``|Σ φ_k(x, y)·φ_k(0)/(ω_k² − Ω² + 2iζω_kΩ)|``, ω in rad/s, per unit push."""
    big = 2 * math.pi * drive_hz
    re = im = 0.0
    for mode in driven:
        w = 2 * math.pi * frequency_hz(plate, mode.lam)
        weight = value(mode, x, y) * value(mode, 0.0, 0.0)
        a = w * w - big * big
        b = 2 * plate.damping_ratio * w * big
        den = a * a + b * b
        re += weight * a / den
        im -= weight * b / den
    return math.hypot(re, im)
