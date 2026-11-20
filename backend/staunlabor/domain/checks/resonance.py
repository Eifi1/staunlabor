"""The resonant rods, checked: a rod's own tone against the clamped beam and
Greenhill's column, the rod too long for its weight, and the table's time loop,
at the page's step, against the driven oscillator: in step, a neighbour off
step, and the swing growing from rest.
"""

from __future__ import annotations

import math
from functools import lru_cache

from staunlabor.domain.checks import Case, Source
from staunlabor.domain.experiments import resonance as engine

ENGINE = ("resonance",)

G = 9.80665
#: The clamped-free beam's first root, as the source prints it: β₁L = 0.596864π.
BETA1_L = 0.596864 * math.pi
#: The first zero of the Bessel function J₋₁/₃, as the source prints it.
BESSEL_B = 1.86635086
#: Greenhill's column: buckling where ρ·A·g·L³/(E·I) reaches 9B²/4.
GREENHILL = 9 * BESSEL_B**2 / 4

_ROOTS = Source(
    cite="Wikipedia, “Euler–Bernoulli beam theory”, §Dynamic beam equation, Free vibration, "
    "“Example: Cantilevered beam”",
    url="https://en.wikipedia.org/wiki/Euler%E2%80%93Bernoulli_beam_theory",
    quote="cosh(β_n L) cos(β_n L) + 1 = 0. … The first four roots are β₁L = 0.596864π, … ω₁ = β₁²√(EI/μ) = "
    "(3.5160/L²)√(EI/μ)",
)
_SHAPE = Source(
    cite="Wikipedia, “Euler–Bernoulli beam theory”, §Dynamic beam equation, Free vibration, "
    "“Example: Cantilevered beam”",
    url="https://en.wikipedia.org/wiki/Euler%E2%80%93Bernoulli_beam_theory",
    quote="ŵ_n = A₁[(cosh β_n x − cos β_n x) + (cos β_n L + cosh β_n L)/(sin β_n L + sinh β_n L)"
    "(sin β_n x − sinh β_n x)]",
)
_COLUMN = Source(
    cite="Wikipedia, “Buckling”, §Self-buckling (citing Kato 1915, Ratzersdorfer 1936, Cox & McCarthy 1998)",
    url="https://en.wikipedia.org/wiki/Buckling",
    quote="A free-standing, vertical column, with density ρ, Young's modulus E, and cross-sectional area A, will "
    "buckle under its own weight if its height exceeds a certain critical value: h_crit = (9B²/4 · EI/(ρgA))^(1/3) "
    "… B is the first zero of the Bessel function of the first kind of order −1/3, which is equal to 1.86635086...",
)
_PARTICIPATION = Source(
    cite="T. Irvine, “Effective Modal Mass & Modal Participation Factors”, Rev. I (Vibrationdata, 2015), "
    "App. C, Eq. (C-1), p. 18, and Table D-2, p. 20",
    url="https://www.vibrationdata.com/tutorials2/ModalMass.pdf",
    quote="The participation factor is Γ_n = ∫₀ᴸ m(x) Y_n(x) dx (C-1) … Table D-2. Bending Vibration, Fixed-Free "
    "Beam … 1 … [1.87510/L]² √(EI/ρ) … 0.7830 √(ρL) … 0.6131 ρL",
)
_DRIVEN = Source(
    cite="Wikipedia, “Harmonic oscillator”, §Sinusoidal driving force",
    url="https://en.wikipedia.org/wiki/Harmonic_oscillator",
    quote="d²x/dt² + 2ζω₀ dx/dt + ω₀²x = (1/m)F₀ sin(ωt) … The steady-state solution is proportional to the driving "
    "force with an induced phase change φ: x(t) = F₀/(m Z_m ω) sin(ωt + φ), where "
    "Z_m = √((2ω₀ζ)² + (1/ω²)(ω₀² − ω²)²)",
)
_TRANSIENT = Source(
    cite="Wikipedia, “Harmonic oscillator”, §Damped harmonic oscillator and §Sinusoidal driving force",
    url="https://en.wikipedia.org/wiki/Harmonic_oscillator",
    quote="The angular frequency of the underdamped harmonic oscillator is given by ω₁ = ω₀√(1 − ζ²), the "
    "exponential decay of the underdamped harmonic oscillator is given by λ = ω₀ζ. … The general solution is a sum "
    "of a transient solution that depends on initial conditions, and a steady state … The transient solutions are "
    "the same as the unforced (F₀ = 0) damped harmonic oscillator",
)

#: The page's rack: six 2 mm steel rods, 1.0 to 0.5 m, ζ 0.01, the table 1 mm each way.
_RACK = engine.Rack()
#: The 80 cm rod, the one the overview's preview is in step with, and its neighbour.
_IN_STEP, _NEIGHBOUR = 2, 1
#: The page's run: long enough, at ζ = 0.01, for the 80 cm rod's start to die
#: to e^(−16) and its neighbour's to e^(−12).
_SETTLE_S = 120.0


def _stiffness_per_mass(rack: engine.Rack) -> float:
    """EI/μ of a round rod: E·(πd⁴/64)/(ρ·πd²/4) = E·d²/(16ρ)."""
    return rack.youngs_gpa * 1e9 * rack.diameter_m**2 / (16 * rack.density_kg_m3)


def _greenhill_q(rack: engine.Rack, length_m: float) -> float:
    """The rod's weight against its stiffness, ρ·A·g·L³/(E·I)."""
    return G * length_m**3 / _stiffness_per_mass(rack)


def _tone_hand_hz(rack: engine.Rack, length_m: float) -> float:
    """ω₀ = (β₁L)²/L²·√(EI/μ), its square lowered along the straight line from
    no weight to Greenhill's buckling: ω² = ω₀²·(1 − q/q_c)."""
    w0 = BETA1_L**2 / length_m**2 * math.sqrt(_stiffness_per_mass(rack))
    return w0 * math.sqrt(1 - _greenhill_q(rack, length_m) / GREENHILL) / (2 * math.pi)


def _greenhill_m(rack: engine.Rack) -> float:
    return (GREENHILL * _stiffness_per_mass(rack) / G) ** (1 / 3)


def _longest_m(rack: engine.Rack) -> float:
    """The longest rod of the rack's steel the engine takes before it refuses
    one that buckles under its own weight: bisection on its refusal."""
    lo, hi = 1.0, 2.0
    for _ in range(60):
        mid = (lo + hi) / 2
        try:
            engine.Rack(lengths_m=(mid,), diameter_m=rack.diameter_m)
        except ValueError:
            hi = mid
        else:
            lo = mid
    return (lo + hi) / 2


def _mode(xi: float) -> float:
    """The source's first mode, A₁ = 1, at ξ = x/L."""
    b, bl = BETA1_L * xi, BETA1_L
    sigma = (math.cos(bl) + math.cosh(bl)) / (math.sin(bl) + math.sinh(bl))
    return math.cosh(b) - math.cos(b) + sigma * (math.sin(b) - math.sinh(b))


def _participation() -> float:
    """Γ = ∫φ/∫φ² for the mode scaled to 1 at the tip, by Simpson's rule over
    2000 strips."""
    n, tip = 2000, _mode(1.0)
    over = squared = 0.0
    for i in range(n + 1):
        w = 1 if i in (0, n) else 4 if i % 2 else 2
        p = _mode(i / n) / tip
        over += w * p
        squared += w * p * p
    return over / squared


def _steady_hand_mm(rack: engine.Rack, rod: int, drive_hz: float) -> float:
    """The source's steady swing with F₀/m = Γ·Ω²·Y, the table's push on the
    mode: Γ·Ω²·Y/√((ω² − Ω²)² + (2ζωΩ)²). The rod's ω is the page's tone."""
    w = 2 * math.pi * engine.natural_hz(rack, rack.lengths_m[rod])
    big = 2 * math.pi * drive_hz
    push = _participation() * big * big * rack.table_m
    return push / math.sqrt((w * w - big * big) ** 2 + (2 * rack.damping_ratio * w * big) ** 2) * 1000


#: The swing that counts as grown: 1 − 1/e of the steady one.
_GROWN = 1 - 1 / math.e


def _growth_hand_cycles(zeta: float) -> float:
    """From rest, driven at its own ω: the steady swing −X·cos ωt plus the
    source's transient e^(−ζωt)·(A cos ω₁t + B sin ω₁t), A = X and B = ζωX/ω₁
    so that place and speed start at zero; its width √(q² + (q̇/ω)²) first
    reaching 1 − 1/e of X, in cycles of the drive, by bisection. ω = 1, X = 1."""
    w1 = math.sqrt(1 - zeta * zeta)
    b = zeta / w1

    def width(t: float) -> float:
        decay = math.exp(-zeta * t)
        q = -math.cos(t) + decay * (math.cos(w1 * t) + b * math.sin(w1 * t))
        v = math.sin(t) + decay * (
            -zeta * (math.cos(w1 * t) + b * math.sin(w1 * t)) + w1 * (-math.sin(w1 * t) + b * math.cos(w1 * t))
        )
        return math.hypot(q, v)

    # The width rises past 1 − 1/e once, near t = 1/ζ; search a cycle each side.
    lo, hi = 1 / zeta - 2 * math.pi, 1 / zeta + 2 * math.pi
    for _ in range(80):
        mid = (lo + hi) / 2
        if width(mid) < _GROWN:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2 / (2 * math.pi)


@lru_cache(maxsize=1)
def _settled() -> tuple[engine.Shaking, float]:
    """The page's table from rest at the 80 cm rod's tone, stepped as the page
    steps it for :data:`_SETTLE_S`: the last state, and when the 80 cm rod's
    swing first reached 1 − 1/e of Γ·Y/(2ζ), interpolated between steps."""
    rack, drive = _RACK, engine.natural_hz(_RACK, _RACK.lengths_m[_IN_STEP])
    grown = _GROWN * engine.GAMMA * rack.table_m / (2 * rack.damping_ratio)
    s, prev, crossed = engine.start(rack), 0.0, None
    for _ in range(round(_SETTLE_S / engine.STEP_S)):
        s = engine.step(rack, s, drive)
        swing = engine.swing_m(s, _IN_STEP, drive)
        if crossed is None and prev < grown <= swing:
            crossed = s.t - engine.STEP_S * (swing - grown) / (swing - prev)
        prev = swing
    assert crossed is not None
    return s, crossed


def _in_step_drive() -> float:
    return engine.natural_hz(_RACK, _RACK.lengths_m[_IN_STEP])


def _setting(drive_hz: float) -> dict[str, float | str]:
    """What the page's "Set it up" sets: the beat and the damping, the rods at rest."""
    return {"drive_hz": drive_hz, "damping_ratio": _RACK.damping_ratio}


CASES: tuple[Case, ...] = (
    Case(
        key="tone",
        unit="Hz",
        expected=lambda: _tone_hand_hz(_RACK, 0.5),
        measured=lambda: engine.natural_hz(_RACK, 0.5),
        # The page lowers ω² by Rayleigh's quotient, a line 0.4 % steeper than
        # the one to Greenhill's exact buckling; the weight takes 2.5 % of the
        # 50 cm rod's ω², so the two part by 5·10⁻⁵ in the tone.
        tolerance=1e-4,
        sources=(_ROOTS, _COLUMN),
        derived=True,
        setting=_setting(engine.natural_hz(_RACK, 0.5)),
    ),
    Case(
        key="buckling",
        unit="m",
        expected=lambda: _greenhill_m(_RACK),
        measured=lambda: _longest_m(_RACK),
        # Rayleigh's quotient with the swinging shape, not the buckled one,
        # puts the buckling load 0.4 % high; the length goes as its cube root.
        tolerance=2e-3,
        sources=(_COLUMN,),
        setting={},
    ),
    Case(
        key="in_step",
        unit="mm",
        expected=lambda: _steady_hand_mm(_RACK, _IN_STEP, _in_step_drive()),
        measured=lambda: engine.swing_m(_settled()[0], _IN_STEP, _in_step_drive()) * 1000,
        # After 120 s the start has died to e^(−16); the step's error is smaller still.
        tolerance=1e-5,
        sources=(_DRIVEN, _SHAPE, _PARTICIPATION),
        derived=True,
        setting=_setting(_in_step_drive()),
    ),
    Case(
        key="neighbour",
        unit="mm",
        expected=lambda: _steady_hand_mm(_RACK, _NEIGHBOUR, _in_step_drive()),
        measured=lambda: engine.swing_m(_settled()[0], _NEIGHBOUR, _in_step_drive()) * 1000,
        # The 90 cm rod's start, ringing at its own tone, has died to e^(−12):
        # 6·10⁻⁶ of the swing is left of it.
        tolerance=5e-5,
        sources=(_DRIVEN, _SHAPE, _PARTICIPATION),
        derived=True,
        setting=_setting(_in_step_drive()),
    ),
    Case(
        key="growth",
        unit="",
        expected=lambda: _growth_hand_cycles(_RACK.damping_ratio),
        measured=lambda: _settled()[1] * _in_step_drive(),
        # Runge–Kutta at a thousand steps a second on a 2 Hz rod, and the
        # crossing interpolated between two steps: far below 10⁻⁵.
        tolerance=1e-5,
        sources=(_TRANSIENT, _DRIVEN),
        derived=True,
        setting=_setting(_in_step_drive()),
    ),
)
