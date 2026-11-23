"""The Wilberforce spring, checked: the page's spring, Berg and Marshall's own
Leybold pendulum with the nuts 20 mm out, stepped at the page's step, against
their two normal modes, the beat between them, the beat they measured, and the
energy their Lagrangian keeps.

Every formula here is written out from the paper (R. E. Berg, T. S. Marshall,
*Am. J. Phys.* 59 (1991) 32), not taken from the engine's closed forms: the
modes from their Eq. (7) with ``ε²/mI`` inside the root as they print it, the
start of a mode from their Eqs. (28)–(29).
"""

from __future__ import annotations

import math

from staunlabor.domain.checks import Case, Source
from staunlabor.domain.experiments import numerics
from staunlabor.domain.experiments import spring as engine

_CITE = "R. E. Berg, T. S. Marshall, “Wilberforce pendulum oscillations and normal modes”, Am. J. Phys. 59 (1991) 32"
_URL = "https://doi.org/10.1119/1.16702"

_LAGRANGIAN = Source(
    cite=f"{_CITE}, §II.A, Eqs. (1)–(3)",
    url=_URL,
    quote="Assuming a linear coupling of the form εzθ/2, … L = ½mż² + ½Iθ̇² − ½kz² − ½δθ² − ½εzθ, (1) … "
    "mz̈ + kz + ½εθ = 0 (2) and Iθ̈ + δθ + ½εz = 0, (3)",
)
_MODES = Source(
    cite=f"{_CITE}, §II.A, Eq. (7)",
    url=_URL,
    quote="using the values for the frequencies ω_z² = k/m and ω_θ² = δ/I, … which can be solved to determine the "
    "frequencies of the normal modes, ω² = ½{ω_θ² + ω_z² ± [(ω_θ² − ω_z²)² + ε²/mI]^{1/2}}. (7)",
)
_COORDINATES = Source(
    cite=f"{_CITE}, §II.B, Eqs. (28)–(29)",
    url=_URL,
    quote="z₀ = (2I/ε)(ω₁² − ω_θ²)θ₀ … (mode 1) … z₀ = (2I/ε)(ω₂² − ω_θ²)θ₀ … (mode 2)",
)
_BEAT = Source(
    cite=f"{_CITE}, §II.A, after Eq. (12)",
    url=_URL,
    quote="Here, ω_B = ω₁ − ω₂, the beat frequency between the two normal modes ω₁ and ω₂.",
)
_MEASURED = Source(
    cite=f"{_CITE}, §III, p. 35",
    url=_URL,
    quote="m_corr = 0.5164 ± 0.0004 kg, I_corr = 1.45 ± 0.02 × 10⁻⁴ kg m². … The measured frequencies in the "
    "energy-transfer mode are ω = ω_θ = ω_z = 2.31 ± 0.02 rad/s and ω_B = 0.232 ± 0.002 rad/s. … "
    "k = 2.80 ± 0.05 N/m and δ = 7.86 ± 0.16 × 10⁻⁴ N m",
)
_COUPLING = Source(
    cite=f"{_CITE}, §V, p. 36",
    url=_URL,
    quote="From Eq. (30), using our measured ω, ω_B, m, and I, ε = 2ωω_B√mI = 9.27 ± 0.30 × 10⁻³ N.",
)

#: The page's spring: the paper's pendulum, the nuts 20 mm out.
_SPRING = engine.WilberforceSpring()
#: How far a mode's start twists the weight, as the page's buttons do.
_TWIST_RAD = 1.0
#: How far the page's "Pull down" pulls it.
_PULL_M = 0.02


def _inertia() -> float:
    """The paper's I for the page's weight: the body and four nuts, each a
    point at its radius."""
    return _SPRING.body_inertia_kg_m2 + 4 * _SPRING.nut_kg * _SPRING.nut_radius_m**2


def _modes_hand() -> tuple[float, float]:
    """Eq. (7), as printed: ω² = ½{ω_θ² + ω_z² ± [(ω_θ² − ω_z²)² + ε²/mI]^½}."""
    m, inertia, eps = _SPRING.mass_kg, _inertia(), _SPRING.coupling_n
    wz2, wt2 = _SPRING.stiffness_n_m / m, _SPRING.torsion_n_m / inertia
    root = math.sqrt((wt2 - wz2) ** 2 + eps**2 / (m * inertia))
    return math.sqrt((wt2 + wz2 + root) / 2), math.sqrt((wt2 + wz2 - root) / 2)


def _mode_start(mode: int) -> tuple[float, float, float, float]:
    """Eqs. (28)–(29): twisted θ₀ and pulled z₀ = (2I/ε)(ωᵢ² − ω_θ²)θ₀, at rest."""
    w = _modes_hand()[mode - 1]
    wt2 = _SPRING.torsion_n_m / _inertia()
    z0 = 2 * _inertia() / _SPRING.coupling_n * (w * w - wt2) * _TWIST_RAD
    return (z0, _TWIST_RAD, 0.0, 0.0)


def _period_run(mode: int, seconds: float = 30.0) -> float:
    """The twist's period in the page's loop, started in a mode: Runge–Kutta
    at its step, upward crossings of no twist, interpolated within the step."""
    f = engine.rhs(_SPRING)
    y = _mode_start(mode)
    h, t, ups = numerics.STEP_S, 0.0, []
    for _ in range(round(seconds / h)):
        nxt = numerics.rk4(f, t, y, h)
        t += h
        if y[1] < 0 <= nxt[1]:
            ups.append(t - h * nxt[1] / (nxt[1] - y[1]))
        y = nxt
    return (ups[-1] - ups[0]) / (len(ups) - 1)


def _energy(y: tuple[float, ...]) -> float:
    """T + V of Eq. (1): ½mż² + ½Iθ̇² + ½kz² + ½δθ² + ½εzθ, J."""
    s = _SPRING
    kinetic = 0.5 * s.mass_kg * y[2] ** 2 + 0.5 * _inertia() * y[3] ** 2
    return (
        kinetic + 0.5 * s.stiffness_n_m * y[0] ** 2 + 0.5 * s.torsion_n_m * y[1] ** 2 + 0.5 * s.coupling_n * y[0] * y[1]
    )


def _energy_run(seconds: float = 60.0) -> float:
    f = engine.rhs(_SPRING)
    y: tuple[float, ...] = (_PULL_M, 0.0, 0.0, 0.0)
    h = numerics.STEP_S
    for i in range(round(seconds / h)):
        y = numerics.rk4(f, i * h, y, h)
    return _energy(y)


def _setting(start: engine.Start) -> dict[str, float | str]:
    """What the page's "Set it up" sets: the nuts, the damping, the start."""
    return {
        "nut_radius_m": _SPRING.nut_radius_m,
        "damping_per_s": _SPRING.damping_per_s,
        "start": start.value,
    }


CASES: tuple[Case, ...] = (
    Case(
        key="fast_mode",
        unit="s",
        expected=lambda: 2 * math.pi / _modes_hand()[0],
        measured=lambda: _period_run(1),
        # Runge–Kutta at 1 ms on a linear system and the crossings
        # interpolated within a step: 5 · 10⁻¹² here.
        tolerance=1e-9,
        sources=(_LAGRANGIAN, _MODES, _COORDINATES),
        derived=True,
        setting=_setting(engine.Start.FAST),
    ),
    Case(
        key="slow_mode",
        unit="s",
        expected=lambda: 2 * math.pi / _modes_hand()[1],
        measured=lambda: _period_run(2),
        # The same, at the slower mode.
        tolerance=1e-9,
        sources=(_LAGRANGIAN, _MODES, _COORDINATES),
        derived=True,
        setting=_setting(engine.Start.SLOW),
    ),
    Case(
        key="beat",
        unit="s",
        expected=lambda: 2 * math.pi / (_modes_hand()[0] - _modes_hand()[1]),
        measured=lambda: engine.beat_s(_SPRING),
        # Both closed forms: rounding only.
        tolerance=1e-12,
        sources=(_MODES, _BEAT),
        derived=True,
        setting=_setting(engine.Start.DOWN),
    ),
    Case(
        key="measured",
        unit="s",
        expected=lambda: 2 * math.pi / 0.232,
        measured=lambda: engine.beat_s(_SPRING),
        # The paper's ω_B is known to ±0.9 %, and its ε was worked out from
        # ω = 2.31 rad/s where k/m gives 2.33: 0.7 % here.
        tolerance=0.02,
        sources=(_MEASURED, _COUPLING, _BEAT),
        setting=_setting(engine.Start.DOWN),
    ),
    Case(
        key="energy",
        unit="mJ",
        expected=lambda: 0.5 * _SPRING.stiffness_n_m * _PULL_M**2 * 1000,
        measured=lambda: _energy_run() * 1000,
        # Sixty thousand Runge–Kutta steps: 10⁻¹³ here.
        tolerance=1e-10,
        sources=(_LAGRANGIAN,),
        derived=True,
        setting=_setting(engine.Start.DOWN),
    ),
)
