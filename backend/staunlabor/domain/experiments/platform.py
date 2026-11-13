"""The spinning platform: lean out and spin slower, stand up and spin faster — and pay for it.

The exhibit is a platform a visitor stands on, both hands on a handlebar at the
axis and the feet where they are. Leaning back with the
whole body, arms straight, they turn slowly; standing upright, fast. The
buzzword is conservation of angular momentum, and it is the first half of the
story.

**The model.** Nothing outside the visitor turns them but the bearing, whose
friction takes angular momentum away slowly and steadily (``dL/dt = −τ_f``).
So between pushes ``L = I·ω`` changes only by that, and the rate is ``ω = L/I``:
the whole exhibit is the moment of inertia ``I``, and how far the body leans
out changes it. ``I`` is summed from parts, each by the formula its shape has
(``tests/unit/test_experiments.py`` integrates them independently):

* the platform, a disc: ``½·M·R²``;
* the legs at the axis, about their own vertical axis, with a radius of
  gyration (a lumped body's honest summary) — the feet do not move;
* the trunk with the head, about its own axis and shifted out by the lean
  ``d`` (the parallel-axis rule: ``+ m·d²``);
* each arm a rod from the hand on the bar, ``s`` to the side of the axis, to
  its shoulder, out by ``d``: ``m·(s² + d²/3)``.

**The second half: the spin up is paid for.** The kinetic energy is
``E = L²/(2I)``, so standing up at the same ``L`` *raises* it — by exactly the
work the arms do pulling the body in against what holds it out, ``m·ω²·r`` per
mass. The test integrates that pull along the way in and finds the energy's
change. A visitor feels it as the bar pulling at the hands, harder the faster
they spin.

What it leaves out: the body as anything but these lumps (no breathing, no
twisting), the lean's own tilt of the trunk (the trunk moves out as a whole),
a slow lean (so ``I`` follows the posture), air, and the wobble of a centre of
mass off the axis. The masses, sizes and the bearing's friction are a guess at
a table-top-sized platform, offered as sliders.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

#: How often a run is sampled.
SAMPLES_PER_S = 50
MAX_DURATION_S = 120.0

#: The farthest a visitor leans out, holding the bar with straight arms.
MAX_LEAN_M = 0.4


@dataclass(frozen=True)
class Body:
    """A visitor as lumps: two arms, the trunk with the head, the legs. The
    shares are round numbers of the usual segment tables (an arm about 5 % of
    the body, the trunk and head about 55 %, the legs the rest)."""

    mass_kg: float = 70.0
    arm_share: float = 0.05
    trunk_share: float = 0.55
    trunk_gyration_m: float = 0.12
    legs_gyration_m: float = 0.08
    #: From the axis to each hand on the bar, and to each shoulder sideways.
    shoulder_m: float = 0.20

    def __post_init__(self) -> None:
        if self.mass_kg <= 0 or self.shoulder_m < 0:
            raise ValueError("a body needs a mass")
        if not 0 <= 2 * self.arm_share + self.trunk_share < 1:
            raise ValueError("the arms and the trunk cannot weigh more than the body")
        if self.trunk_gyration_m < 0 or self.legs_gyration_m < 0:
            raise ValueError("radii cannot be negative")

    @property
    def arm_kg(self) -> float:
        return self.mass_kg * self.arm_share

    @property
    def trunk_kg(self) -> float:
        return self.mass_kg * self.trunk_share

    @property
    def legs_kg(self) -> float:
        return self.mass_kg * (1 - 2 * self.arm_share - self.trunk_share)


@dataclass(frozen=True)
class Platform:
    mass_kg: float = 15.0
    radius_m: float = 0.30
    #: The bearing's friction, a steady torque against the turn.
    friction_n_m: float = 0.2

    def __post_init__(self) -> None:
        if self.mass_kg < 0 or self.radius_m <= 0 or self.friction_n_m < 0:
            raise ValueError("a platform needs a size, and no negative mass or friction")


@dataclass(frozen=True)
class Posture:
    #: How far the trunk leans out from the axis, the hands on the bar.
    lean_m: float = 0.0

    def __post_init__(self) -> None:
        if not 0 <= self.lean_m <= MAX_LEAN_M:
            raise ValueError(f"a lean lies between 0 and {MAX_LEAN_M:g} m")


@dataclass(frozen=True)
class Inertia:
    """``I`` about the platform's axis, by part, in kg·m²."""

    platform: float
    legs: float
    trunk: float
    arms: float
    total: float


def inertia(body: Body, platform: Platform, posture: Posture) -> Inertia:
    d = posture.lean_m
    s = body.shoulder_m
    plat = 0.5 * platform.mass_kg * platform.radius_m**2
    legs = body.legs_kg * body.legs_gyration_m**2
    trunk = body.trunk_kg * (body.trunk_gyration_m**2 + d * d)
    arms = 2 * body.arm_kg * (s * s + d * d / 3)
    return Inertia(plat, legs, trunk, arms, plat + legs + trunk + arms)


def pull_n(body: Body, posture: Posture, omega_rad_s: float) -> float:
    """What the hands hold on the bar at ``ω``: the trunk and the arms, out by
    the lean, kept on their circle — ``ω²·d·(m_trunk + m_arms)``, the trunk's
    centre ``d`` out, each arm's ``d/2``. Upright, nothing."""
    d = posture.lean_m
    return omega_rad_s**2 * d * (body.trunk_kg + body.arm_kg)


@dataclass(frozen=True)
class Spin:
    """One posture at one angular momentum: how fast, what energy, what pull."""

    lean_m: float
    inertia_kg_m2: float
    rev_per_s: float
    energy_j: float
    pull_n: float


def spin(body: Body, platform: Platform, posture: Posture, momentum: float) -> Spin:
    i = inertia(body, platform, posture).total
    omega = momentum / i
    return Spin(
        lean_m=posture.lean_m,
        inertia_kg_m2=i,
        rev_per_s=omega / (2 * math.pi),
        energy_j=momentum * momentum / (2 * i),
        pull_n=pull_n(body, posture, omega),
    )


#: The two ends the figures compare: leaning out, and upright.
LEANING = Posture(lean_m=0.30)
UPRIGHT = Posture(lean_m=0.0)

#: The spin the figures start from: one turn every two seconds, leaning out —
#: about what a push from a helper gives.
START_REV_PER_S = 0.5


@dataclass(frozen=True)
class CurvePoint:
    lean_m: float
    inertia_kg_m2: float
    rev_per_s: float


@dataclass(frozen=True)
class PlatformFigures:
    """The exhibit at one angular momentum — the one a spin of
    :data:`START_REV_PER_S` leaning out has — leaning out and upright, and the
    rate as the lean comes in."""

    momentum_kg_m2_s: float
    leaning: Spin
    upright: Spin
    #: How many times faster upright than leaning out.
    speed_ratio: float
    #: The work the arms do pulling the body upright: the energy's rise.
    work_to_stand_up_j: float
    lean_curve: tuple[CurvePoint, ...]
    #: How long the bearing's friction takes to stop the spin; never without it.
    stops_after_s: float | None


def figures(body: Body, platform: Platform) -> PlatformFigures:
    momentum = inertia(body, platform, LEANING).total * 2 * math.pi * START_REV_PER_S
    leaning = spin(body, platform, LEANING, momentum)
    upright = spin(body, platform, UPRIGHT, momentum)

    def point(posture: Posture) -> CurvePoint:
        s = spin(body, platform, posture, momentum)
        return CurvePoint(posture.lean_m, s.inertia_kg_m2, s.rev_per_s)

    return PlatformFigures(
        momentum_kg_m2_s=momentum,
        leaning=leaning,
        upright=upright,
        speed_ratio=upright.rev_per_s / leaning.rev_per_s,
        work_to_stand_up_j=upright.energy_j - leaning.energy_j,
        lean_curve=tuple(point(Posture(lean_m=d / 100)) for d in range(0, 41, 2)),
        stops_after_s=momentum / platform.friction_n_m if platform.friction_n_m > 0 else None,
    )


# ── a run ────────────────────────────────────────────────────────────────────


def friction_step(momentum: float, friction_n_m: float, dt: float) -> float:
    """The bearing over ``dt``: the angular momentum's size falls by
    ``τ_f·dt`` and stops at zero — friction does not turn a platform back."""
    if momentum > 0:
        return max(0.0, momentum - friction_n_m * dt)
    return min(0.0, momentum + friction_n_m * dt)


@dataclass(frozen=True)
class Move:
    """From ``at_s`` on, the lean moves linearly to ``lean_m`` over ``over_s``
    seconds; a push of ``push`` kg·m²/s at ``at_s``."""

    at_s: float
    lean_m: float
    over_s: float = 1.0
    push: float = 0.0


def posture_at(start: Posture, moves: tuple[Move, ...], t: float) -> Posture:
    """The posture at ``t``: each move blends from where the last left off."""
    lean = start.lean_m
    for move in moves:
        if t <= move.at_s:
            break
        f = 1.0 if move.over_s <= 0 else min(1.0, (t - move.at_s) / move.over_s)
        lean += (move.lean_m - lean) * f
    return Posture(lean_m=lean)


@dataclass(frozen=True)
class PlatformRun:
    t: tuple[float, ...]
    rev_per_s: tuple[float, ...]
    inertia_kg_m2: tuple[float, ...]
    momentum: tuple[float, ...]
    energy_j: tuple[float, ...]
    pull_n: tuple[float, ...]


def run(
    body: Body,
    platform: Platform,
    start: Posture,
    momentum: float,
    moves: tuple[Move, ...],
    duration_s: float,
) -> PlatformRun:
    """The spin under a sequence of moves: the momentum given at the start and
    by each push, taken by the bearing in between, and the rate ``L/I`` of the
    posture at each sample. Exact between samples — nothing here needs a step
    smaller than the sampling, since ``L`` falls linearly."""
    if not 0 < duration_s <= MAX_DURATION_S:
        raise ValueError(f"a run lasts between 0 and {MAX_DURATION_S:g} s")
    dt = 1 / SAMPLES_PER_S
    steps = round(duration_s * SAMPLES_PER_S)
    pushes = sorted((m.at_s, m.push) for m in moves if m.push)
    out: dict[str, list[float]] = {k: [] for k in ("t", "f", "i", "l", "e", "p")}
    big_l = momentum
    pushed = 0
    for n in range(steps + 1):
        t = n * dt
        while pushed < len(pushes) and pushes[pushed][0] <= t:
            big_l += pushes[pushed][1]
            pushed += 1
        posture = posture_at(start, moves, t)
        i = inertia(body, platform, posture).total
        omega = big_l / i
        out["t"].append(t)
        out["f"].append(omega / (2 * math.pi))
        out["i"].append(i)
        out["l"].append(big_l)
        out["e"].append(big_l * big_l / (2 * i))
        out["p"].append(pull_n(body, posture, omega))
        big_l = friction_step(big_l, platform.friction_n_m, dt)
    return PlatformRun(
        t=tuple(out["t"]),
        rev_per_s=tuple(out["f"]),
        inertia_kg_m2=tuple(out["i"]),
        momentum=tuple(out["l"]),
        energy_j=tuple(out["e"]),
        pull_n=tuple(out["p"]),
    )
