"""Chains of inertias on springs and dampers: their matrices, their modes, and
how they answer a sinusoidal drive.

A chain is what the two-mass lesson draws: a motor, a measuring shaft, a
column, a torsion bar — inertias in a row, each joined to the next by a spring
and a damper in parallel, either end optionally tied to ground. All of it is in
one coordinate already (reducing an inertia through a gear onto another is
Kurvenschmiede's lesson 7, which stays there), so a chain is plain
``M·φ̈ + C·φ̇ + K·φ = F``.

**Mode frequencies and damping come from the state matrix, the shapes from the
quadratic problem.** ``D = −Re(λ)/|λ|`` for each eigenvalue ``λ`` of
``A = [[0, I], [−M⁻¹K, −M⁻¹C]]`` is the definition the lessons use, and it needs
no assumption about how the damping is distributed — a measuring shaft with a
fifth of the column's damping is not proportionally damped, and a modal damping
read off ``ΦᵀCΦ`` would be an approximation of what the eigenvalue already says
exactly. The shape of a mode is the null vector of ``λ²M + λC + K`` at that
eigenvalue; it is complex when the damping is not proportional, and what a
lesson draws is its real part normalised to the first inertia, with the largest
phase spread reported beside it so nobody mistakes a complex mode for a real one.

What it does not model: branches (a chain is a row), gear backlash, or
anything nonlinear.
"""

from __future__ import annotations

import cmath
import math
from collections.abc import Sequence
from dataclasses import dataclass

from staunlabor.domain.course.linalg import eigenvalues, null_vector, solve

#: An eigenvalue with an imaginary part below this fraction of its modulus is a
#: real one — an overdamped "mode" that does not oscillate, or a rigid-body one.
_REAL = 1e-9


@dataclass(frozen=True)
class Ground:
    """A spring (and damper) from an end inertia to the ground."""

    stiffness: float
    damping: float = 0.0


@dataclass(frozen=True)
class Chain:
    """Inertias in a row; ``stiffness[i]`` and ``damping[i]`` join inertia ``i``
    to ``i + 1``."""

    inertia: tuple[float, ...]
    stiffness: tuple[float, ...]
    damping: tuple[float, ...] = ()
    ground_left: Ground | None = None
    ground_right: Ground | None = None

    def __post_init__(self) -> None:
        n = len(self.inertia)
        if n == 0:
            raise ValueError("A chain needs at least one inertia.")
        if len(self.stiffness) != n - 1:
            raise ValueError("A chain needs one spring fewer than it has inertias.")
        if self.damping and len(self.damping) != n - 1:
            raise ValueError("A chain needs a damper for every spring, or none.")
        if any(j <= 0 for j in self.inertia):
            raise ValueError("Every inertia must be positive.")
        if any(c < 0 for c in self.stiffness) or any(d < 0 for d in self.damping):
            raise ValueError("A spring or a damper cannot be negative.")


@dataclass(frozen=True)
class Matrices:
    mass: tuple[tuple[float, ...], ...]
    stiffness: tuple[tuple[float, ...], ...]
    damping: tuple[tuple[float, ...], ...]


def matrices(chain: Chain) -> Matrices:
    """``M``, ``K`` and ``C``: the diagonal is the sum of every spring touching an
    inertia, the off-diagonal minus the spring between the two."""
    n = len(chain.inertia)
    k = [[0.0] * n for _ in range(n)]
    c = [[0.0] * n for _ in range(n)]
    dampers = chain.damping or (0.0,) * (n - 1)
    for i, (ci, di) in enumerate(zip(chain.stiffness, dampers, strict=True)):
        for mat, v in ((k, ci), (c, di)):
            mat[i][i] += v
            mat[i + 1][i + 1] += v
            mat[i][i + 1] -= v
            mat[i + 1][i] -= v
    if chain.ground_left:
        k[0][0] += chain.ground_left.stiffness
        c[0][0] += chain.ground_left.damping
    if chain.ground_right:
        k[-1][-1] += chain.ground_right.stiffness
        c[-1][-1] += chain.ground_right.damping
    m = [[chain.inertia[i] if i == j else 0.0 for j in range(n)] for i in range(n)]
    return Matrices(tuple(map(tuple, m)), tuple(map(tuple, k)), tuple(map(tuple, c)))


def state_matrix(chain: Chain) -> list[list[float]]:
    mats = matrices(chain)
    n = len(chain.inertia)
    a = [[0.0] * (2 * n) for _ in range(2 * n)]
    for i in range(n):
        a[i][n + i] = 1.0
        for j in range(n):
            a[n + i][j] = -mats.stiffness[i][j] / chain.inertia[i]
            a[n + i][n + j] = -mats.damping[i][j] / chain.inertia[i]
    return a


@dataclass(frozen=True)
class Mode:
    """One oscillating mode.

    ``frequency_hz`` is ``|λ|/2π`` — the undamped natural frequency the mode
    belongs to, which is what a hand estimate is compared with — and
    ``damped_frequency_hz`` the ``Im(λ)/2π`` it actually rings at. ``shape`` is
    the real part of the mode shape divided by the first inertia's entry (by the
    largest entry where the first barely moves, ``reference`` says which);
    ``phase_spread_deg`` is how far the complex shape is from a real one.
    """

    eigenvalue: complex
    frequency_hz: float
    damped_frequency_hz: float
    damping: float
    shape: tuple[float, ...]
    reference: int
    phase_spread_deg: float


def modes(chain: Chain) -> list[Mode]:
    """The oscillating modes, slowest first. Rigid-body and overdamped
    eigenvalues are real and are not modes a chain rings in; they are left out."""
    lams = [lam for lam in eigenvalues(state_matrix(chain)) if lam.imag > _REAL * max(1.0, abs(lam))]
    mats = matrices(chain)
    n = len(chain.inertia)
    out: list[Mode] = []
    for lam in sorted(lams, key=abs):
        q = [
            [lam * lam * mats.mass[i][j] + lam * mats.damping[i][j] + mats.stiffness[i][j] for j in range(n)]
            for i in range(n)
        ]
        vec = null_vector(q) if n > 1 else [1 + 0j]
        biggest = max(abs(v) for v in vec)
        ref = 0 if abs(vec[0]) > 1e-6 * biggest else max(range(n), key=lambda i: abs(vec[i]))
        normed = [v / vec[ref] for v in vec]
        # How far each entry's phase is from 0° or 180°, the worst of them.
        phases = [abs(math.degrees(cmath.phase(v))) for v in normed if abs(v) > 1e-9 * biggest / abs(vec[ref])]
        spread = max(min(p, 180 - p) for p in phases)
        out.append(
            Mode(
                eigenvalue=lam,
                frequency_hz=abs(lam) / (2 * math.pi),
                damped_frequency_hz=lam.imag / (2 * math.pi),
                damping=-lam.real / abs(lam),
                shape=tuple(v.real for v in normed),
                reference=ref,
                phase_spread_deg=spread,
            )
        )
    return out


def forced(chain: Chain, frequency_hz: float, force: Sequence[complex]) -> list[complex]:
    """The complex amplitudes ``φ̂`` under ``F̂·e^{jωt}``:
    ``(K − ω²M + jωC)·φ̂ = F̂``. ``ValueError`` at an undamped resonance, where
    there is no steady state to report."""
    if len(force) != len(chain.inertia):
        raise ValueError("The drive must name one amplitude per inertia.")
    w = 2 * math.pi * frequency_hz
    mats = matrices(chain)
    n = len(chain.inertia)
    z = [
        [complex(mats.stiffness[i][j] - w * w * mats.mass[i][j], w * mats.damping[i][j]) for j in range(n)]
        for i in range(n)
    ]
    return solve(z, [complex(f) for f in force])


def series_stiffness(*springs: float) -> float:
    """Springs one behind the other: the reciprocals add."""
    if any(c <= 0 for c in springs):
        raise ValueError("Every spring in a series must be positive.")
    return 1 / sum(1 / c for c in springs)
