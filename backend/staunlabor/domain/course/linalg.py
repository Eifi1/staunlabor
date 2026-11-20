"""The dense linear algebra the course's engine needs, and no more.

Three things: solving a small complex system (a forced response is
``(K − ω²M + jωC)·φ̂ = F̂``), the eigenvalues of a small real matrix that is not
symmetric (a state matrix ``[[0, I], [−M⁻¹K, −M⁻¹C]]``, whose eigenvalues *are*
the poles a lesson reads damping and frequency off), and an eigenvector for an
eigenvalue already known.

**Why not numpy.** The engine is the standard library only (``CLAUDE.md``), and
the matrices here are at most nine rows: a Laplace chain of four second-order
blocks is eight states, one more for the held input :func:`expm` steps it with.
At that size a QR iteration in pure Python is a fraction of a millisecond, and
the dependency would cost more than it saves.

**Why the full QR algorithm rather than the roots of the characteristic
polynomial.** The polynomial is what a textbook writes and what a 2×2 lesson
shows, and it is the wrong way to compute: a chain in which a 10⁻⁴ kg·m² worm
meets a cardan shaft of 800,000 Nm/rad has a state matrix with entries from
10⁻² to 10¹⁰ (``tests/unit/test_course.py`` holds that chain), and the
coefficients of its characteristic polynomial span more orders of magnitude than
a double holds. The roots of that polynomial move by
percent when its coefficients move by the last bit. Balancing (scale rows and
columns by powers of two until their norms agree), a reduction to Hessenberg form
and Francis' double-shift QR is the method every numerical library uses for
this, and it is what is here — transcribed from the EISPACK lineage
(``balanc``/``elmhes``/``hqr``), one-indexed internally so the transcription can
be checked line by line against the published algorithm.

What it does not do: large or sparse matrices, generalised eigenproblems, or
eigenvectors of a whole matrix at once. A chain's mode shape is one inverse
iteration on the n×n quadratic problem (:func:`null_vector`), which is cheaper
and better conditioned than an eigenvector of the 2n×2n state matrix.
"""

from __future__ import annotations

import math

#: The radix balancing scales by, so the scaling itself is exact.
_RADIX = 2.0
#: How many double-shift sweeps one eigenvalue may take before the iteration is
#: declared stuck. EISPACK's thirty, with the exceptional shifts at ten and twenty.
_MAX_SWEEPS = 30


def solve(a: list[list[complex]], b: list[complex]) -> list[complex]:
    """``x`` with ``a·x = b``, by Gaussian elimination with partial pivoting.

    Works on copies, real or complex alike. Raises ``ValueError`` on a singular
    matrix — a chain driven exactly at an undamped resonance is one, and the
    caller says so in its own words.
    """
    n = len(a)
    if any(len(row) != n for row in a) or len(b) != n:
        raise ValueError("The system must be square and the right-hand side as long as it.")
    m = [[*row, b[i]] for i, row in enumerate(a)]
    scale = max((abs(v) for row in a for v in row), default=0.0)
    if scale == 0:
        raise ValueError("The matrix is zero.")
    for col in range(n):
        pivot = max(range(col, n), key=lambda r: abs(m[r][col]))
        if abs(m[pivot][col]) <= 1e-14 * scale:
            raise ValueError("The matrix is singular.")
        m[col], m[pivot] = m[pivot], m[col]
        p = m[col][col]
        for r in range(col + 1, n):
            f = m[r][col] / p
            if f:
                row, top = m[r], m[col]
                for k in range(col, n + 1):
                    row[k] -= f * top[k]
    x: list[complex] = [0j] * n
    for r in range(n - 1, -1, -1):
        s = m[r][n]
        for k in range(r + 1, n):
            s -= m[r][k] * x[k]
        x[r] = s / m[r][r]
    return x


def eigenvalues(matrix: list[list[float]]) -> list[complex]:
    """Every eigenvalue of a real square matrix, complex pairs included.

    Sorted by real part, then imaginary part, so a caller comparing two runs
    compares like with like. Raises ``ValueError`` if the QR iteration does not
    converge, which for a balanced matrix of this size means a NaN came in.
    """
    n = len(matrix)
    if n == 0:
        return []
    if any(len(row) != n for row in matrix):
        raise ValueError("An eigenvalue needs a square matrix.")
    if any(not math.isfinite(v) for row in matrix for v in row):
        raise ValueError("The matrix holds a value that is not a number.")
    # One-indexed copy: a[1..n][1..n], row and column 0 unused.
    a = [[0.0] * (n + 1)] + [[0.0, *map(float, row)] for row in matrix]
    _balance(a, n)
    _hessenberg(a, n)
    for i in range(1, n + 1):
        for j in range(1, i - 1):
            a[i][j] = 0.0
    wr, wi = _hqr(a, n)
    return sorted((complex(r, i) for r, i in zip(wr[1:], wi[1:], strict=True)), key=lambda z: (z.real, z.imag))


def _balance(a: list[list[float]], n: int) -> None:
    sqrdx = _RADIX * _RADIX
    done = False
    while not done:
        done = True
        for i in range(1, n + 1):
            r = c = 0.0
            for j in range(1, n + 1):
                if j != i:
                    c += abs(a[j][i])
                    r += abs(a[i][j])
            if c and r:
                g = r / _RADIX
                f = 1.0
                s = c + r
                while c < g:
                    f *= _RADIX
                    c *= sqrdx
                g = r * _RADIX
                while c > g:
                    f /= _RADIX
                    c /= sqrdx
                if (c + r) / f < 0.95 * s:
                    done = False
                    g = 1.0 / f
                    for j in range(1, n + 1):
                        a[i][j] *= g
                    for j in range(1, n + 1):
                        a[j][i] *= f


def _hessenberg(a: list[list[float]], n: int) -> None:
    """Upper Hessenberg form by stabilised elementary similarity transforms."""
    for m in range(2, n):
        x = 0.0
        i = m
        for j in range(m, n + 1):
            if abs(a[j][m - 1]) > abs(x):
                x = a[j][m - 1]
                i = j
        if i != m:
            for j in range(m - 1, n + 1):
                a[i][j], a[m][j] = a[m][j], a[i][j]
            for j in range(1, n + 1):
                a[j][i], a[j][m] = a[j][m], a[j][i]
        if x:
            for i in range(m + 1, n + 1):
                y = a[i][m - 1]
                if y != 0.0:
                    y /= x
                    a[i][m - 1] = y
                    for j in range(m, n + 1):
                        a[i][j] -= y * a[m][j]
                    for j in range(1, n + 1):
                        a[j][m] += y * a[j][i]


def _hqr(a: list[list[float]], n: int) -> tuple[list[float], list[float]]:  # noqa: C901 — the published algorithm, kept in its published shape
    wr = [0.0] * (n + 1)
    wi = [0.0] * (n + 1)
    anorm = 0.0
    for i in range(1, n + 1):
        for j in range(max(i - 1, 1), n + 1):
            anorm += abs(a[i][j])
    nn = n
    t = 0.0
    p = q = r = x = y = z = w = 0.0
    while nn >= 1:
        its = 0
        while True:
            # Look for a single small subdiagonal element.
            low = nn
            while low >= 2:
                s = abs(a[low - 1][low - 1]) + abs(a[low][low])
                if s == 0.0:
                    s = anorm
                if abs(a[low][low - 1]) + s == s:
                    a[low][low - 1] = 0.0
                    break
                low -= 1
            low = max(low, 1)
            x = a[nn][nn]
            if low == nn:  # one root found
                wr[nn] = x + t
                wi[nn] = 0.0
                nn -= 1
            else:
                y = a[nn - 1][nn - 1]
                w = a[nn][nn - 1] * a[nn - 1][nn]
                if low == nn - 1:  # two roots found
                    p = 0.5 * (y - x)
                    q = p * p + w
                    z = math.sqrt(abs(q))
                    x += t
                    if q >= 0.0:
                        z = p + math.copysign(z, p)
                        wr[nn - 1] = wr[nn] = x + z
                        if z:
                            wr[nn] = x - w / z
                        wi[nn - 1] = wi[nn] = 0.0
                    else:
                        wr[nn - 1] = wr[nn] = x + p
                        wi[nn] = z
                        wi[nn - 1] = -z
                    nn -= 2
                else:
                    if its == _MAX_SWEEPS:
                        raise ValueError("The eigenvalue iteration did not converge.")
                    if its in (10, 20):  # exceptional shift
                        t += x
                        for i in range(1, nn + 1):
                            a[i][i] -= x
                        s = abs(a[nn][nn - 1]) + abs(a[nn - 1][nn - 2])
                        y = x = 0.75 * s
                        w = -0.4375 * s * s
                    its += 1
                    m = nn - 2
                    while m >= low:
                        z = a[m][m]
                        r = x - z
                        s = y - z
                        p = (r * s - w) / a[m + 1][m] + a[m][m + 1]
                        q = a[m + 1][m + 1] - z - r - s
                        r = a[m + 2][m + 1]
                        s = abs(p) + abs(q) + abs(r)
                        p /= s
                        q /= s
                        r /= s
                        if m == low:
                            break
                        u = abs(a[m][m - 1]) * (abs(q) + abs(r))
                        v = abs(p) * (abs(a[m - 1][m - 1]) + abs(z) + abs(a[m + 1][m + 1]))
                        if u + v == v:
                            break
                        m -= 1
                    for i in range(m + 2, nn + 1):
                        a[i][i - 2] = 0.0
                        if i != m + 2:
                            a[i][i - 3] = 0.0
                    for k in range(m, nn):
                        if k != m:
                            p = a[k][k - 1]
                            q = a[k + 1][k - 1]
                            r = 0.0
                            if k != nn - 1:
                                r = a[k + 2][k - 1]
                            x = abs(p) + abs(q) + abs(r)
                            if x != 0.0:
                                p /= x
                                q /= x
                                r /= x
                        s = math.copysign(math.sqrt(p * p + q * q + r * r), p)
                        if s != 0.0:
                            if k == m:
                                if low != m:
                                    a[k][k - 1] = -a[k][k - 1]
                            else:
                                a[k][k - 1] = -s * x
                            p += s
                            x = p / s
                            y = q / s
                            z = r / s
                            q /= p
                            r /= p
                            for j in range(k, nn + 1):
                                p = a[k][j] + q * a[k + 1][j]
                                if k != nn - 1:
                                    p += r * a[k + 2][j]
                                    a[k + 2][j] -= p * z
                                a[k + 1][j] -= p * y
                                a[k][j] -= p * x
                            mmin = min(nn, k + 3)
                            for i in range(low, mmin + 1):
                                p = x * a[i][k] + y * a[i][k + 1]
                                if k != nn - 1:
                                    p += z * a[i][k + 2]
                                    a[i][k + 2] -= p * r
                                a[i][k + 1] -= p * q
                                a[i][k] -= p
            if low >= nn - 1:
                break
    return wr, wi


def null_vector(matrix: list[list[complex]]) -> list[complex]:
    """A vector ``v`` with ``matrix·v ≈ 0`` for a matrix known to be singular.

    Inverse iteration: solve against the matrix nudged off its singularity, twice,
    from a vector of ones. The nudge is relative to the matrix's own scale, so it
    is the same tiny fraction of a stiff chain and of a soft one. Normalised to
    unit length; the caller picks the reference it wants.
    """
    n = len(matrix)
    scale = max((abs(v) for row in matrix for v in row), default=1.0) or 1.0
    eps = 1e-10 * scale
    nudged = [[v + (eps if i == j else 0) for j, v in enumerate(row)] for i, row in enumerate(matrix)]
    v: list[complex] = [complex(1.0 + 0.1 * k) for k in range(n)]
    for _ in range(3):
        try:
            v = solve(nudged, v)
        except ValueError:
            eps *= 10
            nudged = [[v_ + (eps if i == j else 0) for j, v_ in enumerate(row)] for i, row in enumerate(matrix)]
            continue
        norm = math.sqrt(sum(abs(c) ** 2 for c in v)) or 1.0
        v = [c / norm for c in v]
    return v


def matmul(a: list[list[float]], b: list[list[float]]) -> list[list[float]]:
    inner = len(b)
    cols = len(b[0]) if b else 0
    return [[sum(row[k] * b[k][j] for k in range(inner)) for j in range(cols)] for row in a]


def expm(matrix: list[list[float]]) -> list[list[float]]:
    """``e^{A}`` of a small real matrix: scaling and squaring over a Taylor
    series of order eighteen.

    Scaled until the norm is below one half, so the series converges to the last
    bit long before its eighteenth term, then squared back. Not Padé, because
    Padé's advantage is fewer matrix products on big matrices, and these have at
    most nine rows. What it is for: stepping a linear cascade *exactly* from one
    sample to the next, whatever the ratio of its fastest to its slowest time
    constant — a fixed-step integrator would need ten thousand steps for a 1 ms
    lag behind a 10 s one, or diverge.
    """
    n = len(matrix)
    norm = max((sum(abs(v) for v in row) for row in matrix), default=0.0)
    squarings = max(0, math.ceil(math.log2(norm / 0.5))) if norm > 0.5 else 0
    scale = 2.0**-squarings
    a = [[v * scale for v in row] for row in matrix]
    result = [[1.0 if i == j else 0.0 for j in range(n)] for i in range(n)]
    term = [row[:] for row in result]
    for k in range(1, 19):
        term = [[v / k for v in row] for row in matmul(term, a)]
        result = [[r + t for r, t in zip(rr, tt, strict=True)] for rr, tt in zip(result, term, strict=True)]
    for _ in range(squarings):
        result = matmul(result, result)
    return result
