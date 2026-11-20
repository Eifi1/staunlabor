"""Newton's cradle, checked: its first impact, as the page computes it, against
the pendulum's fall, the exchange of equal balls, momentum, Hertz's contact
and its duration; and its time loop, at the page's step, against the energy a
row without losses keeps.

The exhibit as it hangs (25 mm steel balls on 15 cm strings, one lifted by
30°), with a hair's gap or e = 1 where a case needs it: both are on the page.
"""

from __future__ import annotations

import math

from staunlabor.domain.checks import Case, Source
from staunlabor.domain.experiments import cradle as engine

ENGINE = ("cradle",)

#: Standard gravity, as the engine takes it.
G = 9.80665
#: Steel's Poisson's ratio, as the engine takes it.
NU = 0.29
#: The page's "0.1 mm of air".
GAP_M = 1e-4

_PENDULUM = Source(
    cite="javalab.org, “Force to move the pendulum”, “Total tension applied to the string”",
    url="https://javalab.org/en/pendulum_en",
    quote="The increased kinetic energy is equal to the reduced potential energy by the law of conservation of energy. "
    "½mv² = mgl(cos θ – cos θ_m) ∴ v² = 2gl(cos θ – cos θ_m)",
)
_EQUAL = Source(
    cite="Wikipedia, “Elastic collision”, §One-dimensional Newtonian (citing Serway & Jewett, 2014, p. 258)",
    url="https://en.wikipedia.org/wiki/Elastic_collision",
    quote="If both masses are the same, we have a trivial solution: v_A2 = v_B1, v_B2 = v_A1. "
    "This simply corresponds to the bodies exchanging their initial velocities with each other.",
)
_MOMENTUM = Source(
    cite="OpenStax, University Physics Volume 1, §9.3 Conservation of Linear Momentum, “Law of Conservation of Momentum”",
    url="https://openstax.org/books/university-physics-volume-1/pages/9-3-conservation-of-linear-momentum",
    quote="The total momentum of a closed system is conserved: ∑ p⃗_j = constant. … "
    "In a closed system, the total momentum never changes.",
)
_HERTZ = Source(
    cite="Wikipedia, “Contact mechanics”, §Contact between a sphere and a half-space and §Contact between two spheres "
    "(citing Hertz, 1882)",
    url="https://en.wikipedia.org/wiki/Contact_mechanics",
    quote="The applied force F is related to the displacement d by F = 4/3 E* R^½ d^{3/2} where "
    "1/E* = (1 − ν₁²)/E₁ + (1 − ν₂²)/E₂ … The equations are the same as for a sphere in contact with a half plane "
    "except that the effective radius R is defined as 1/R = 1/R₁ + 1/R₂",
)
_ELASTIC = Source(
    cite="P. Patrício, “The Hertz contact in chain elastic collisions”, arXiv:physics/0402036 (doi:10.1119/1.1778394), "
    "§I and §III.A, Eq. (5)",
    url="https://arxiv.org/abs/physics/0402036",
    quote="even in those cases where the interactions are elastic, i.e., with no loss of energy. … "
    "the elastic potential energy Ep depends on the combined deformation h as: Ep = 2/5 e r^½ h^{5/2}",
)
_DEEPEST = Source(
    cite="P. Patrício, “The Hertz contact in chain elastic collisions”, arXiv:physics/0402036, §III.A, Eq. (6) and (8)",
    url="https://arxiv.org/abs/physics/0402036",
    quote="Suppose ν is the relative velocity of the spheres before the collision, and µ = m1 m2 /(m1 + m2) their "
    "reduced mass. … The maximum height of deformation occurs when the relative velocity is zero and can be written: "
    "hM = (5µ/(4er^½))^{2/5} ν^{4/5}",
)
_CONTACT_TIME = Source(
    cite="P. Patrício, “The Hertz contact in chain elastic collisions”, arXiv:physics/0402036, §III.A, Eq. (9)",
    url="https://arxiv.org/abs/physics/0402036",
    quote="The collision time corresponds to the time in which the deformation goes from 0 to hM and back to 0 again. "
    "It is given by: τ = 2 (25µ²/(16e²rν))^{1/5} ∫₀¹ dx/√(1 − x^{5/2}) ≈ 3.21 (µ²/(e²rν))^{1/5}",
)

#: The exhibit as it hangs: touching, e = 0.95.
_EXHIBIT = engine.Cradle()
#: Touching, and every contact giving back all it takes.
_TOUCHING = engine.Cradle(restitution=1.0)
#: A hair apart, every contact giving back all it takes.
_APART = engine.Cradle(gap_m=GAP_M, restitution=1.0)
_PULL = engine.Pull()


def _fall_speed(cr: engine.Cradle, pull: engine.Pull = _PULL) -> float:
    """The lifted ball at the bottom: v² = 2gL(1 − cos θ₀), worked out here."""
    return math.sqrt(2 * G * cr.string_m * (1 - math.cos(math.radians(pull.angle_deg))))


def _hertz(cr: engine.Cradle) -> tuple[float, float]:
    """Hertz's K = (4/3)·E*·√R for two equal balls, and the pair's reduced
    mass µ, from the build's material and size."""
    m = cr.density_kg_m3 * math.pi * cr.diameter_m**3 / 6
    young = cr.youngs_gpa * 1e9
    e_star = 1 / ((1 - NU**2) / young + (1 - NU**2) / young)
    radius = cr.diameter_m / 2
    r = 1 / (1 / radius + 1 / radius)
    return 4 / 3 * e_star * math.sqrt(r), m * m / (m + m)


def _deepest_m(cr: engine.Cradle) -> float:
    """Patrício's h_M at the speed the ball comes in with."""
    k, mu = _hertz(cr)
    return (5 * mu / (4 * k)) ** 0.4 * _fall_speed(cr) ** 0.8


def _peak_hand_n() -> float:
    k, _ = _hertz(_APART)
    return k * _deepest_m(_APART) ** 1.5


def _contact_s(cr: engine.Cradle) -> float:
    """Patrício's collision time; ∫₀¹ dx/√(1 − x^{5/2}) by the midpoint rule
    after x = 1 − s², which takes the root's end off the integrand: a reader's
    own sum."""
    k, mu = _hertz(cr)
    n = 20000
    integral = sum(2 * s / math.sqrt(1 - (1 - s * s) ** 2.5) for s in ((j + 0.5) / n for j in range(n))) / n
    return 2 * (25 * mu * mu / (16 * k * k * _fall_speed(cr))) ** 0.2 * integral


def _duration_hand_us() -> float:
    """Four contacts one after the other: from one touch to the next τ/2 + s/v,
    three times, and then the last contact."""
    tau, v = _contact_s(_APART), _fall_speed(_APART)
    return (3 * (tau / 2 + GAP_M / v) + tau) * 1e6


def _energy_per_kg(cr: engine.Cradle, th: list[float], w: list[float]) -> float:
    """Every ball's ½v² + gL(1 − cos θ), per kilogram of a ball, summed."""
    length = cr.string_m
    return sum(0.5 * (length * r) ** 2 + G * length * (1 - math.cos(a)) for a, r in zip(th, w, strict=True))


def _energy_after(seconds: float = 2.0) -> float:
    """The page's loop, a millisecond a step, for ``seconds``, then the energy;
    at that moment no two balls press, so none is held in a dent."""
    cr = _TOUCHING
    th, w = engine.start(cr, _PULL)
    for _ in range(round(seconds / engine.STEP_S)):
        th, w = engine.step(cr, th, w)
    length = cr.string_m
    assert all(length * (th[c] - th[c + 1]) - cr.gap_m <= 0 for c in range(cr.count - 1))
    return _energy_per_kg(cr, th, w)


_SET = {"balls": 1, "angle_deg": 30.0}


CASES: tuple[Case, ...] = (
    Case(
        key="one_out",
        unit="m/s",
        expected=lambda: _fall_speed(_APART),
        measured=lambda: engine.impact(_APART, _PULL).after_m_s[-1],
        # Gravity still pulls on the balls moving off the bottom during the
        # 0.9 ms until the speeds are read: 3 · 10⁻⁶.
        tolerance=1e-5,
        sources=(_PENDULUM, _EQUAL),
        derived=True,
        setting={**_SET, "gap_m": GAP_M, "restitution": 1.0},
    ),
    Case(
        key="momentum",
        unit="m/s",
        expected=lambda: _fall_speed(_EXHIBIT),
        measured=lambda: sum(engine.impact(_EXHIBIT, _PULL).after_m_s),
        # The row is closed only nearly: strings and weight cancel just at the
        # bottom, and in the 0.4 ms of the impact the balls move a fraction of a
        # millimetre off it: 6 · 10⁻⁶.
        tolerance=1e-5,
        sources=(_MOMENTUM, _PENDULUM),
        derived=True,
        setting={**_SET, "gap_m": 0.0, "restitution": 0.95},
    ),
    Case(
        key="energy",
        unit="J/kg",
        expected=lambda: G * _TOUCHING.string_m * (1 - math.cos(math.radians(_PULL.angle_deg))),
        measured=_energy_after,
        # Five impacts in 2 s. The microsecond steps through each miss up to
        # 7 · 10⁻⁶ of the energy where a contact closes (Hertz's force has no
        # second derivative there); half the step takes it under 10⁻⁶.
        tolerance=4e-5,
        sources=(_PENDULUM, _ELASTIC),
        derived=True,
        setting={**_SET, "gap_m": 0.0, "restitution": 1.0},
    ),
    Case(
        key="peak",
        unit="N",
        expected=_peak_hand_n,
        measured=lambda: engine.impact(_APART, _PULL).peak_n,
        # The page reads the force every microsecond, not at its top: within
        # half a microsecond of it, a contact of 84 µs is up to 3 · 10⁻⁴ lower.
        tolerance=3e-4,
        sources=(_HERTZ, _DEEPEST),
        derived=True,
        setting={**_SET, "gap_m": GAP_M, "restitution": 1.0},
    ),
    Case(
        key="duration",
        unit="µs",
        expected=_duration_hand_us,
        measured=lambda: engine.impact(_APART, _PULL).duration_s * 1e6,
        # The page counts the impact in whole microseconds: one in 689.
        tolerance=2e-3,
        sources=(_CONTACT_TIME, _EQUAL),
        derived=True,
        setting={**_SET, "gap_m": GAP_M, "restitution": 1.0},
    ),
)
