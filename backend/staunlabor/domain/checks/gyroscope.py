"""The gyroscope wheel, checked: its time loop, at the page's step, against the
steady turn of a level axle, the dip and the nod of a wheel let go from rest
(Lagrange's top, as Tatum works it out), and the suitcase's torque against
τ = Ω × L.

The wheel is the page's: a hoop of 2 kg and 30 cm on an axle of 15 cm. Its
moments of inertia are worked out here, from the hoop's and the parallel
axes, not taken from the engine.
"""

from __future__ import annotations

import math

from staunlabor.domain.checks import Case, Source
from staunlabor.domain.experiments import gyroscope as engine

ENGINE = ("gyroscope",)

#: Standard gravity, as the engine takes it.
G = 9.80665

_PRECESSION = Source(
    cite="OpenStax, University Physics Volume 1, §11.4 Precession of a Gyroscope, Eq. 11.12",
    url="https://openstax.org/books/university-physics-volume-1/pages/11-4-precession-of-a-gyroscope",
    quote="The precession angular velocity is ω_P = dϕ/dt and from this equation we see that ω_P = rMg/L … or, since L = Iω, ω_P = rMg/(Iω). (11.12) In this derivation, we assumed that ω_P ≪ ω",
)
_TORQUE = Source(
    cite="J. Tatum, LibreTexts, Classical Mechanics, §4.10 The Top, Eq. 4.10.29 and 4.10.30",
    url="https://phys.libretexts.org/Bookshelves/Classical_Mechanics/Classical_Mechanics_(Tatum)/04%3A_Rigid_Body_Rotation/4.10%3A_The_Top",
    quote="Therefore, in vector notation, τ = Ω × L (4.10.29) Note that the magnitude of τ is Mgl sinθ and the magnitude of Ω × L is ΩL sinθ, so that the rate of precession is Ω = Mgl/L (4.10.30) and is independent of θ.",
)
_DIP = Source(
    cite="J. Tatum, LibreTexts, Classical Mechanics, §4.10 The Top, Eq. 4.10.25",
    url="https://phys.libretexts.org/Bookshelves/Classical_Mechanics/Classical_Mechanics_(Tatum)/04%3A_Rigid_Body_Rotation/4.10%3A_The_Top",
    quote="It corresponds to just letting the top drop when you let it go, without giving it either a forward or a backward push. … cos α − cos β = (2MglI₁/L₃²) sin²β, (4.10.25) from which we see that the greater L₃, the smaller the difference between α and β - i.e. the smaller the amplitute of the nutation.",
)
_NOD = Source(
    cite="J. Tatum, LibreTexts, Classical Mechanics, §4.10 The Top, Eq. 4.10.15 and 4.10.22",
    url="https://phys.libretexts.org/Bookshelves/Classical_Mechanics/Classical_Mechanics_(Tatum)/04%3A_Rigid_Body_Rotation/4.10%3A_The_Top",
    quote="B = 2Mgl/I₁ (4.10.15) … In the case Equation 4.10.13 becomes θ̇² = B(cos α − cos θ) − [L₃(cos α − cos θ)/(I₁ sin θ)]² (4.10.22)",
)
_HOOP = Source(
    cite="Wikipedia, “List of moments of inertia”, thin circular loop",
    url="https://en.wikipedia.org/wiki/List_of_moments_of_inertia",
    quote="Thin circular loop of radius r and mass m. I_z = m r² I_x = I_y = ½ m r²",
)
_PARALLEL = Source(
    cite="OpenStax, University Physics Volume 1, §10.5 Calculating Moments of Inertia, Eq. 10.20",
    url="https://openstax.org/books/university-physics-volume-1/pages/10-5-calculating-moments-of-inertia",
    quote="Let m be the mass of an object and let d be the distance from an axis through the object’s center of mass to a new axis. Then we have I_parallel-axis = I_center of mass + md². (10.20)",
)

#: The page's wheel: a hoop, its mass, radius and the axle to its middle.
MASS_KG, RADIUS_M, AXLE_M = 2.0, 0.3, 0.15
#: The suitcase is turned a quarter turn a second, as the page has it.
SUITCASE_DEG_S = 90.0


def _l3(rpm: float) -> float:
    """L₃ = I₃·ω₃, I₃ = m·r² of a hoop about its axle."""
    return MASS_KG * RADIUS_M**2 * rpm * 2 * math.pi / 60


def _i1() -> float:
    """About a diameter, ½·m·r², moved d along the axle to the pivot."""
    return MASS_KG * RADIUS_M**2 / 2 + MASS_KG * AXLE_M**2


def _wheel(rpm: float) -> engine.Wheel:
    return engine.Wheel(mass_kg=MASS_KG, radius_m=RADIUS_M, axle_m=AXLE_M, rpm=rpm)


def _tilts(rpm: float, steady: bool, seconds: float) -> tuple[list[float], float]:
    """The page's loop: let go level, stepped a millisecond at a time;
    ``(θ at every step, φ at the end)``, radians."""
    w = _wheel(rpm)
    y, m = engine.start(w, engine.Release(tilt_deg=90.0, steady=steady))
    tilts = [y[0]]
    for _ in range(round(seconds / engine.STEP_S)):
        y = engine.step(w, m, y)
        tilts.append(y[0])
    return tilts, y[2]


def _round_hand() -> float:
    """2π/Ω, Ω = m·g·d/L₃."""
    return 2 * math.pi * _l3(200) / (MASS_KG * G * AXLE_M)


def _round_page(seconds: float = 8.0) -> float:
    """Let go already circling, level: the time for a round from the turn
    the loop has made after ``seconds``."""
    _, turned = _tilts(200, True, seconds)
    return 2 * math.pi * seconds / turned


def _dip_hand() -> float:
    """Eq. 4.10.25 with α = 90°: −u = k·(1 − u²), k = 2mgdI₁/L₃², u = cos β;
    the root below the level, in degrees below it."""
    k = 2 * MASS_KG * G * AXLE_M * _i1() / _l3(200) ** 2
    u = (1 - math.sqrt(1 + 4 * k * k)) / (2 * k)
    return math.degrees(math.acos(u)) - 90


def _dip_page(seconds: float = 3.0) -> float:
    """The page's tile: the deepest the loop's axle has been below the level."""
    tilts, _ = _tilts(200, False, seconds)
    return math.degrees(max(tilts)) - 90


def _nods_hand() -> float:
    """Small dips: θ̇² = B·x − (L₃/I₁)²·x², harmonic at L₃/I₁; per second."""
    return _l3(600) / _i1() / (2 * math.pi)


def _nods_page(seconds: float = 3.0) -> float:
    """The loop's nods a second: its deepest points, each placed between its
    steps by a parabola, counted over ``seconds``."""
    tilts, _ = _tilts(600, False, seconds)
    h = engine.STEP_S
    deepest = []
    for j in range(1, len(tilts) - 1):
        a, b, c = tilts[j - 1], tilts[j], tilts[j + 1]
        if a < b >= c:
            deepest.append((j + 0.5 * (a - c) / (a - 2 * b + c)) * h)
    return (len(deepest) - 1) / (deepest[-1] - deepest[0])


def _setting(rpm: float, start: str | None = None) -> dict[str, float | str]:
    """What the page's "Set it up" sets: the spin, and how the wheel is let go."""
    out: dict[str, float | str] = {"rpm": rpm}
    if start is not None:
        out.update({"tilt_deg": 90.0, "start": start})
    return out


CASES: tuple[Case, ...] = (
    Case(
        key="steady_turn",
        unit="s",
        expected=_round_hand,
        measured=_round_page,
        # Level, the source's approximation is exact: the steady turn's other
        # term goes with cos θ. What is left is 8000 steps' rounding.
        tolerance=1e-11,
        sources=(_PRECESSION, _TORQUE, _HOOP),
        derived=True,
        setting=_setting(200.0, "steady"),
    ),
    Case(
        key="dip",
        unit="°",
        expected=_dip_hand,
        measured=_dip_page,
        # The loop sees the deepest point only at its steps: θ̈·(h/2)²/2 below
        # it at worst, 1.6·10⁻⁴° of 3.19°.
        tolerance=1e-4,
        sources=(_DIP, _HOOP, _PARALLEL),
        derived=True,
        setting=_setting(200.0, "rest"),
    ),
    Case(
        key="nods",
        unit="1/s",
        expected=_nods_hand,
        measured=_nods_page,
        # The formula is for the smallest dips; a dip of 0.36° (6·10⁻³ rad)
        # quickens the nod by about its square, 3·10⁻⁵.
        tolerance=1e-4,
        sources=(_NOD, _HOOP, _PARALLEL),
        derived=True,
        setting=_setting(600.0, "rest"),
    ),
    Case(
        key="suitcase",
        unit="N·m",
        expected=lambda: _l3(200) * math.radians(SUITCASE_DEG_S),
        measured=lambda: engine.suitcase_torque_n_m(_wheel(200), SUITCASE_DEG_S),
        tolerance=1e-12,
        sources=(_TORQUE, _HOOP),
        derived=True,
        setting=_setting(200.0),
    ),
)
