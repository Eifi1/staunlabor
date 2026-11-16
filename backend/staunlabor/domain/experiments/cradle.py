"""Newton's cradle: one in, one out — nearly.

The exhibit is a row of steel balls, each hanging on its strings so that they
just touch. Lift one and let it fall against the others: one flies off at the
far end. Two in, two out. Why not two at half the speed?

**The model.** Each ball is a pendulum on strings of length ``L``, its place
along its arc ``x = L·θ``; neighbours push each other only where they overlap,
by Hertz's law ``F = K·δ^{3/2}``, ``K = (4/3)·E*·√R*`` (two steel balls:
``E* = E/(2(1 − ν²))``, ``R* = r/2``), damped in the material, Hunt and
Crossley's way: ``F = K·δ^{3/2}·(1 + α·δ')``, ``α = 8(1 − e)/(5e)`` per metre a
second, so a lone pair meeting at 1 m/s parts with ``e`` of that speed (Flores
et al.'s factor). Not the ball cannon's per-contact damping, which divides by
the speed a contact closed at: the cradle's balls touch at rest, their contacts
close at next to nothing, and that damping glued the row together. Stepped by
Runge–Kutta: a millisecond while every ball swings free, a microsecond while
any two touch or are about to — a steel contact lasts some hundred
microseconds.

**Why one out.** For balls far apart that meet one pair at a time, momentum
and energy kept leave only one answer for equal balls: they trade speeds. The
cradle's balls touch, though, and the impact runs through the row as a wave; a
Hertz contact is a stiffening spring, which keeps that wave short, so nearly
all of it comes out in the last ball — but not all: the others keep a little,
and over many swings that little grows until the whole row swings together. A
hair's gap between the balls makes the meetings one at a time again and the
answer clean.

**What it leaves out.** The strings' stretch and the frame's give, rolling and
twisting of the balls, air.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from staunlabor.domain.experiments.pendulum import G

#: Steel's Poisson's ratio.
POISSON = 0.29

#: The step while every ball swings free, and while any two touch.
STEP_S = 1e-3
CONTACT_STEP_S = 1e-6
SUBSTEPS = round(STEP_S / CONTACT_STEP_S)

#: Samples a run returns per second.
SAMPLES_PER_S = 100

#: The longest run.
MAX_S = 60.0

#: The speed ``e`` is given at.
REFERENCE_M_S = 1.0


@dataclass(frozen=True)
class Cradle:
    count: int = 5
    diameter_m: float = 0.025
    #: L: from the strings' top to the middle of a ball.
    string_m: float = 0.15
    #: The space between neighbours at rest.
    gap_m: float = 0.0
    #: e: the share of its closing speed a contact gives back.
    restitution: float = 0.95
    youngs_gpa: float = 200.0
    density_kg_m3: float = 7850.0

    def __post_init__(self) -> None:
        if not 2 <= self.count <= 9:
            raise ValueError("a cradle has between 2 and 9 balls")
        if not 0.005 <= self.diameter_m <= 0.1:
            raise ValueError("a ball is between 5 mm and 10 cm across")
        if not 0.05 <= self.string_m <= 1.0:
            raise ValueError("the strings are between 5 cm and 1 m long")
        if not 0 <= self.gap_m <= 0.005:
            raise ValueError("the balls hang at most 5 mm apart")
        if not 0.5 <= self.restitution <= 1:
            raise ValueError("a contact gives back between half and all of its speed")
        if not 1 <= self.youngs_gpa <= 500:
            raise ValueError("Young's modulus lies between 1 and 500 GPa")

    @property
    def mass_kg(self) -> float:
        return self.density_kg_m3 * math.pi / 6 * self.diameter_m**3

    @property
    def stiffness(self) -> float:
        """Hertz's ``K`` between two balls."""
        e_star = self.youngs_gpa * 1e9 / (2 * (1 - POISSON**2))
        return 4 / 3 * e_star * math.sqrt(self.diameter_m / 4)


@dataclass(frozen=True)
class Pull:
    #: How many balls are lifted together at the left end.
    balls: int = 1
    angle_deg: float = 30.0

    def __post_init__(self) -> None:
        if self.balls < 1:
            raise ValueError("at least one ball is lifted")
        if not 0 < self.angle_deg <= 60:
            raise ValueError("the balls are lifted by more than nothing and at most 60°")


def start(cr: Cradle, pull: Pull) -> tuple[list[float], list[float]]:
    """The angles and rates: the first ``pull.balls`` lifted to the left, the
    rest hanging."""
    if pull.balls >= cr.count:
        raise ValueError("at least one ball is left hanging")
    a = -math.radians(pull.angle_deg)
    return [a if i < pull.balls else 0.0 for i in range(cr.count)], [0.0] * cr.count


def _forces(cr: Cradle, x: list[float], v: list[float]) -> list[float]:
    out = []
    k = cr.stiffness
    alpha = 8 * (1 - cr.restitution) / (5 * cr.restitution) / REFERENCE_M_S
    for c in range(cr.count - 1):
        overlap = x[c] - x[c + 1] - cr.gap_m
        if overlap <= 0:
            out.append(0.0)
            continue
        rate = v[c] - v[c + 1]
        out.append(max(k * overlap**1.5 * (1 + alpha * rate), 0.0))
    return out


def _rates(cr: Cradle, th: list[float], w: list[float]) -> list[float]:
    """The balls' angular accelerations: the pendulum's pull back and the
    contacts' pushes along the arc."""
    length = cr.string_m
    x = [length * a for a in th]
    v = [length * r for r in w]
    f = _forces(cr, x, v)
    m = cr.mass_kg
    out = []
    for i in range(cr.count):
        left = f[i - 1] if i > 0 else 0.0
        right = f[i] if i < cr.count - 1 else 0.0
        out.append((-G * math.sin(th[i]) + (left - right) / m) / length)
    return out


def _rk4(cr: Cradle, th: list[float], w: list[float], h: float) -> tuple[list[float], list[float]]:
    n = cr.count
    a1 = _rates(cr, th, w)
    t2 = [th[i] + h / 2 * w[i] for i in range(n)]
    w2 = [w[i] + h / 2 * a1[i] for i in range(n)]
    a2 = _rates(cr, t2, w2)
    t3 = [th[i] + h / 2 * w2[i] for i in range(n)]
    w3 = [w[i] + h / 2 * a2[i] for i in range(n)]
    a3 = _rates(cr, t3, w3)
    t4 = [th[i] + h * w3[i] for i in range(n)]
    w4 = [w[i] + h * a3[i] for i in range(n)]
    a4 = _rates(cr, t4, w4)
    nt = [th[i] + h / 6 * (w[i] + 2 * w2[i] + 2 * w3[i] + w4[i]) for i in range(n)]
    nw = [w[i] + h / 6 * (a1[i] + 2 * a2[i] + 2 * a3[i] + a4[i]) for i in range(n)]
    return nt, nw


def _near(cr: Cradle, th: list[float], w: list[float]) -> bool:
    """Whether any two balls press on each other, or are closing and could touch
    within the next free step. Two that just touch at rest are not near: the
    cradle's balls hang touching, and only a closing pair needs the small step."""
    length = cr.string_m
    for c in range(cr.count - 1):
        gap = length * (th[c + 1] - th[c]) + cr.gap_m
        closing = length * (w[c] - w[c + 1])
        if gap < 0 or (closing > 0 and gap <= closing * STEP_S * 2 + 1e-9):
            return True
    return False


def step(cr: Cradle, th: list[float], w: list[float]) -> tuple[list[float], list[float]]:
    """One millisecond: a microsecond at a time while any two balls are near,
    the rest of it in one go once none are. A contact lasts a few hundred
    microseconds; stepping out the whole millisecond in microseconds made every
    frame with a meeting in it four times dearer, and the page stuttered."""
    done = 0
    while done < SUBSTEPS and _near(cr, th, w):
        th, w = _rk4(cr, th, w, CONTACT_STEP_S)
        done += 1
    if done == SUBSTEPS:
        return th, w
    return _rk4(cr, th, w, STEP_S - done * CONTACT_STEP_S)


@dataclass(frozen=True)
class CradleRun:
    t: tuple[float, ...]
    #: Each ball's angle, degrees, one tuple per ball.
    angles_deg: tuple[tuple[float, ...], ...]


def run(cr: Cradle, pull: Pull, duration_s: float) -> CradleRun:
    if not 0 < duration_s <= MAX_S:
        raise ValueError(f"a run lasts more than nothing and at most {MAX_S:g} s")
    th, w = start(cr, pull)
    steps = round(duration_s / STEP_S)
    every = max(1, round(1 / (SAMPLES_PER_S * STEP_S)))
    ts: list[float] = []
    angles: list[list[float]] = [[] for _ in range(cr.count)]
    for i in range(steps + 1):
        if i % every == 0:
            ts.append(i * STEP_S)
            for b in range(cr.count):
                angles[b].append(math.degrees(th[b]))
        if i < steps:
            th, w = step(cr, th, w)
    return CradleRun(t=tuple(ts), angles_deg=tuple(tuple(a) for a in angles))


@dataclass(frozen=True)
class Impact:
    """The first meeting of the lifted balls with the rest."""

    #: Each ball's speed along its arc just before and just after, m/s.
    before_m_s: tuple[float, ...]
    after_m_s: tuple[float, ...]
    #: How long from the first touch to the last contact opening, s.
    duration_s: float
    #: The largest force in any contact, N.
    peak_n: float
    #: The share of the energy after the impact that is in as many balls at
    #: the far end as were lifted.
    far_share: float


def impact(cr: Cradle, pull: Pull) -> Impact:
    """Swing the lifted balls down, then follow the impact a microsecond at a
    time until every contact is open and the balls part."""
    th, w = start(cr, pull)
    length = cr.string_m
    for _ in range(round(2.0 / STEP_S)):
        if _near(cr, th, w):
            break
        th, w = _rk4(cr, th, w, STEP_S)
    before = tuple(length * r for r in w)
    peak = 0.0
    touching = 0.0
    opened_for = 0
    while opened_for < 200:
        x = [length * a for a in th]
        v = [length * r for r in w]
        forces = _forces(cr, x, v)
        peak = max(peak, *forces)
        if any(f > 0 for f in forces):
            opened_for = 0
        elif touching > 0:
            opened_for += 1
        if any(f > 0 for f in forces) or touching > 0:
            touching += CONTACT_STEP_S
        th, w = _rk4(cr, th, w, CONTACT_STEP_S)
        if touching > 0.05:
            break
    after = tuple(length * r for r in w)
    energy_out = sum(v * v for v in after)
    far = sum(v * v for v in after[cr.count - pull.balls :])
    return Impact(
        before_m_s=before,
        after_m_s=after,
        duration_s=touching - 200 * CONTACT_STEP_S,
        peak_n=peak,
        far_share=far / energy_out if energy_out > 0 else 0.0,
    )
