"""The floating top, checked: the ring's field built here loop by loop, and
from it the lift the page draws, the window Berry and Geim's conditions give,
and how the exhibit's top bobs and drifts where it floats.

The ring is magnetised along its axis, so its magnetisation is a sheet of
current round its outer face and the opposite one round its hole; each sheet
is a stack of loops, summed here by Simpson's rule over the ring's height. The
engine instead writes the same ring as two solenoids in closed form.
"""

from __future__ import annotations

import math
from collections.abc import Callable

from staunlabor.domain.checks import Case, Source
from staunlabor.domain.checks._hand import G, bisect
from staunlabor.domain.experiments import levitation as engine

#: The magnetic constant to the classical definition: μ₀ = 4π·10⁻⁷ H/m.
MU0 = 4e-7 * math.pi

_LOOP = Source(
    cite="OpenStax, University Physics Volume 2, §12.4 Magnetic Field of a Current Loop, Eq. 12.15",
    url="https://openstax.org/books/university-physics-volume-2/pages/12-4-magnetic-field-of-a-current-loop",
    quote="B = μ₀IR² / [2(y² + R²)^(3/2)]",
)
_BOUND = Source(
    cite="Wikipedia, “Magnetization”, §Magnetization current",
    url="https://en.wikipedia.org/wiki/Magnetization",
    quote="The magnetization M makes a contribution to the current density J, known as the magnetization current. "
    "… J_m = ∇ × M and for the bound surface current: K_m = M × n̂",
)
_ENERGY = Source(
    cite="M. V. Berry, A. K. Geim, “Of flying frogs and levitrons”, Eur. J. Phys. 18 (1997) 307, §2, Eq. (5)",
    url="https://obelix.physik.uni-bielefeld.de/~schnack/Herbstakademie/CD-2008/frog-ejp.pdf",
    quote="For the Levitron™, m is approximately antiparallel to B(r), so this angle is close to 180°, and the energy "
    "is E(r) = mgz − m · B(r) ≈ mgz + |m|B(r).",
)
_ZONE = Source(
    cite="M. V. Berry, A. K. Geim, “Of flying frogs and levitrons”, Eur. J. Phys. 18 (1997) 307, §3 Eq. (16) and §4",
    url="https://obelix.physik.uni-bielefeld.de/~schnack/Herbstakademie/CD-2008/frog-ejp.pdf",
    quote="D2(z) ≡ B′(z)² − 2B(z)B″(z) > 0 (horizontal stability). For the Levitron™, where the magnetic energy (5) "
    "depends on B(r) rather than B²(r), a similar analysis leads to the same horizontal stability condition, and the "
    "simpler vertical stability condition B″(r) > 0. … there is an inflection point at some height zi, that is "
    "B″(zi) = 0. … In the Levitron™, the stable zone is zi < z < z2",
)
_OFF_AXIS = Source(
    cite="M. V. Berry, A. K. Geim, “Of flying frogs and levitrons”, Eur. J. Phys. 18 (1997) 307, §3, Eq. (12) and (15)",
    url="https://obelix.physik.uni-bielefeld.de/~schnack/Herbstakademie/CD-2008/frog-ejp.pdf",
    quote="φn(z) ≡ ∂zⁿΦ(0, 0, z). … From (11), the field strength can now be written "
    "B²(r) = φ1²(z) + ¼(x² + y²)(φ2²(z) − 2φ1(z)φ3(z)) + …",
)
_SPRING = Source(
    cite="OpenStax, University Physics Volume 1, §15.1 Simple Harmonic Motion, Eq. 15.9",
    url="https://openstax.org/books/university-physics-volume-1/pages/15-1-simple-harmonic-motion",
    quote="ω = √(k/m). The angular frequency depends only on the force constant and the mass, and not the amplitude.",
)

_BASE = engine.Base()
_TOP = engine.Top()


def _loop(y: float, radius: float) -> tuple[float, float, float]:
    """One loop's field on its axis per ampere, μ₀R²/(2(y² + R²)^{3/2}), and its
    first two derivatives in y, worked out here."""
    s = y * y + radius * radius
    c = MU0 * radius * radius / 2
    return c / s**1.5, -3 * c * y / s**2.5, 3 * c * (4 * y * y - radius * radius) / s**3.5


def _field(z: float, base: engine.Base = _BASE, n: int = 400) -> tuple[float, float, float]:
    """B, B′, B″ on the axis at ``z`` over the ring's top face: the outer sheet
    (M per metre of height) less the inner, loop by loop over the ring's
    height by Simpson's rule."""
    h = base.height_m / n
    out = [0.0, 0.0, 0.0]
    for j in range(n + 1):
        weight = (1 if j in (0, n) else 4 if j % 2 else 2) * h / 3 * base.magnetisation_a_m
        y = z + j * h
        outer, inner = _loop(y, base.outer_radius_m), _loop(y, base.inner_radius_m)
        for k in range(3):
            out[k] += weight * (outer[k] - inner[k])
    return out[0], out[1], out[2]


def _root(f: Callable[[float], float], low: float, high: float) -> float:
    """Where ``f`` changes sign between ``low`` and ``high``, by bisection."""
    above = f(low) > 0
    return bisect(lambda z: (f(z) > 0) == above, low, high, 100)


def _foot() -> float:
    return _root(lambda z: _field(z)[2], 0.03, 0.05)


def _head() -> float:
    def d2(z: float) -> float:
        b, b1, b2 = _field(z)
        return b1 * b1 - 2 * b * b2

    return _root(d2, _foot(), 0.07)


def _balance() -> float:
    """Above the foot, where the lift μ·(−B′) meets the weight."""
    return _root(lambda z: -_TOP.moment_a_m2 * _field(z)[1] - _TOP.mass_kg * G, _foot(), _head())


def _bob_hz() -> float:
    _, _, b2 = _field(_balance())
    return math.sqrt(_TOP.moment_a_m2 * b2 / _TOP.mass_kg) / (2 * math.pi)


def _drift_hz() -> float:
    b, b1, b2 = _field(_balance())
    return math.sqrt(_TOP.moment_a_m2 * (b1 * b1 - 2 * b * b2) / (4 * b) / _TOP.mass_kg) / (2 * math.pi)


#: The height the lift is read at: where the exhibit's top floats, rounded.
_AT_M = 0.046

_SETTING = {"mass_kg": _TOP.mass_kg, "warming_k": 0.0}


CASES: tuple[Case, ...] = (
    Case(
        key="lift",
        unit="g",
        expected=lambda: -_TOP.moment_a_m2 * _field(_AT_M)[1] / G * 1000,
        measured=lambda: engine.lift_kg(_BASE, _TOP, _AT_M) * 1000,
        # Simpson's rule over 400 slices of a smooth integrand: about 10⁻¹².
        tolerance=1e-10,
        sources=(_LOOP, _BOUND, _ENERGY),
        derived=True,
        setting=_SETTING,
    ),
    Case(
        key="window_foot",
        unit="cm",
        expected=lambda: _foot() * 100,
        measured=lambda: engine.window(_BASE)[0] * 100,
        # The hand field's Simpson error moves the root by about 10⁻¹²; both bisections end far below.
        tolerance=1e-10,
        sources=(_ZONE, _LOOP, _BOUND),
        derived=True,
        setting=_SETTING,
    ),
    Case(
        key="window_head",
        unit="cm",
        expected=lambda: _head() * 100,
        measured=lambda: engine.window(_BASE)[1] * 100,
        tolerance=1e-10,
        sources=(_ZONE, _LOOP, _BOUND),
        derived=True,
        setting=_SETTING,
    ),
    Case(
        key="bob",
        unit="Hz",
        expected=_bob_hz,
        measured=lambda: engine.hover(_BASE, _TOP).bob_hz,
        # Read at a height found from the hand field: 10⁻¹¹.
        tolerance=1e-9,
        sources=(_ENERGY, _SPRING),
        derived=True,
        setting=_SETTING,
    ),
    Case(
        key="drift",
        unit="Hz",
        expected=_drift_hz,
        measured=lambda: engine.hover(_BASE, _TOP).drift_hz,
        tolerance=1e-9,
        sources=(_OFF_AXIS, _ENERGY, _SPRING),
        derived=True,
        setting=_SETTING,
    ),
)
