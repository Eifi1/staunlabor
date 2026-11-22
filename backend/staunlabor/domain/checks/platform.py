"""The spinning platform, checked: the moment of inertia of the leaning
visitor summed from textbook shapes, the spin when they stand up against the
conservation of angular momentum, the pull on the bar against the centripetal
force, and the bearing's stop against its torque.
"""

from __future__ import annotations

import math

from staunlabor.domain.checks import Case, Source
from staunlabor.domain.experiments import platform as engine

_PARALLEL = Source(
    cite="OpenStax, University Physics Volume 1, §10.5 Calculating Moments of Inertia, Eq. 10.20",
    url="https://openstax.org/books/university-physics-volume-1/pages/10-5-calculating-moments-of-inertia",
    quote="Let m be the mass of an object and let d be the distance from an axis through the object’s center of mass "
    "to a new axis. Then we have I_parallel-axis = I_center of mass + md². … I_end = I_center of mass + md² = "
    "(1/12)mL² + m(L/2)² = (1/12 + 1/4)mL² = (1/3)mL².",
)
_DISK = Source(
    cite="OpenStax, University Physics Volume 1, §10.5, “A uniform thin disk about an axis through the center”, "
    "and Eq. 10.21",
    url="https://openstax.org/books/university-physics-volume-1/pages/10-5-calculating-moments-of-inertia",
    quote="I = ∫₀ᴿ r²σ(2πr)dr = … = (1/2)mR². … a compound object’s moment of inertia can be found from the sum of "
    "each part of the object: I_total = Σᵢ Iᵢ.",
)
_CONSERVED = Source(
    cite="OpenStax, University Physics Volume 1, §11.3 Conservation of Angular Momentum, Eqs. 11.10–11.11 and "
    "Example 11.8",
    url="https://openstax.org/books/university-physics-volume-1/pages/11-3-conservation-of-angular-momentum",
    quote="The angular momentum of a system of particles around a point in a fixed inertial reference frame is "
    "conserved if there is no net external torque around that point … Conservation of angular momentum: "
    "I_f ω_f = I₀ω₀",
)
_TORQUE = Source(
    cite="OpenStax, University Physics Volume 1, §11.2 Angular Momentum, Eq. 11.8",
    url="https://openstax.org/books/university-physics-volume-1/pages/11-2-angular-momentum",
    quote="dL/dt = Στ. (11.8) Equation 11.8 states that the rate of change of the total angular momentum of a system "
    "is equal to the net external torque",
)
_CENTRIPETAL = Source(
    cite="OpenStax, University Physics Volume 1, §6.3 Centripetal Force, Eq. 6.3",
    url="https://openstax.org/books/university-physics-volume-1/pages/6-3-centripetal-force",
    quote="we get two expressions for the centripetal force F_c in terms of mass, velocity, angular velocity, and "
    "radius of curvature: F_c = mv²/r; F_c = mrω².",
)

#: The page's visitor and platform: 70 kg, 15 kg, 60 cm across, 0.2 N·m of friction.
_BODY = engine.Body()
_PLATFORM = engine.Platform()
_FREE = engine.Platform(friction_n_m=0.0)
#: Leaning out with straight arms, and upright, as the page's ends.
_LEAN_M = 0.30
#: The page's push: the angular momentum one shove gives (``PUSH`` on the page).
_PUSH = 17.0


def _inertia_hand(body: engine.Body, platform: engine.Platform, lean_m: float) -> float:
    """Summed part by part, each by its textbook shape: the platform a disc,
    ½MR²; the legs on the axis, m·k²; the trunk with the head out by the lean,
    m·k² + m·d² (parallel axes); each arm a rod of length d from the hand, s to
    the side, to the shoulder: m·d²/12 about its middle, shifted to the axis by
    the middle's distance √(s² + (d/2)²)."""
    d, s = lean_m, body.shoulder_m
    arm = body.mass_kg * body.arm_share
    trunk = body.mass_kg * body.trunk_share
    legs = body.mass_kg - 2 * arm - trunk
    disc = 0.5 * platform.mass_kg * platform.radius_m**2
    rod = arm * d * d / 12 + arm * (s * s + (d / 2) ** 2)
    return disc + legs * body.legs_gyration_m**2 + trunk * (body.trunk_gyration_m**2 + d * d) + 2 * rod


def _inertia_run(lean_m: float) -> float:
    """The page's tile: the engine's sum for the posture on screen."""
    return engine.inertia(_BODY, _PLATFORM, engine.Posture(lean_m=lean_m)).total


def _ratio_run() -> float:
    """Pushed once leaning out, without friction; after two seconds the visitor
    stands up over one and a half: the rate at the end over the rate at the start."""
    stand_up = (engine.Move(at_s=2.0, lean_m=0.0, over_s=1.5),)
    run = engine.run(_BODY, _FREE, engine.Posture(lean_m=_LEAN_M), _PUSH, stand_up, 6.0)
    return run.rev_per_s[-1] / run.rev_per_s[0]


def _pull_hand_n(body: engine.Body, lean_m: float, omega: float) -> float:
    """m·r·ω² for each part that leans out: the trunk's centre d out, each arm's
    centre halfway between the hand on the bar and the shoulder, d/2."""
    arm = body.mass_kg * body.arm_share
    trunk = body.mass_kg * body.trunk_share
    return (trunk * lean_m + 2 * arm * lean_m / 2) * omega * omega


#: Half a turn a second leaning out: the spin the page's figures start from.
_HALF_TURN = math.pi


def _stop_run_s() -> float:
    """Pushed once, leaning out, the bearing braking: the last sample before
    the spin stops, and the rest of its momentum at the bearing's rate."""
    run = engine.run(_BODY, _PLATFORM, engine.Posture(lean_m=_LEAN_M), _PUSH, (), 100.0)
    j = next(n for n, momentum in enumerate(run.momentum) if momentum == 0.0)
    return run.t[j - 1] + run.momentum[j - 1] / _PLATFORM.friction_n_m


def _setting(lean_m: float, friction_n_m: float) -> dict[str, float | str]:
    """What the page's "Set it up" sets: the lean, and the bearing's friction."""
    return {"lean_m": lean_m, "friction_n_m": friction_n_m}


CASES: tuple[Case, ...] = (
    Case(
        key="leaning_inertia",
        unit="kg·m²",
        expected=lambda: _inertia_hand(_BODY, _PLATFORM, _LEAN_M),
        measured=lambda: _inertia_run(_LEAN_M),
        tolerance=1e-12,
        sources=(_PARALLEL, _DISK),
        derived=True,
        setting=_setting(_LEAN_M, _PLATFORM.friction_n_m),
    ),
    Case(
        key="faster_upright",
        unit="",
        expected=lambda: _inertia_hand(_BODY, _FREE, _LEAN_M) / _inertia_hand(_BODY, _FREE, 0.0),
        measured=_ratio_run,
        tolerance=1e-12,
        sources=(_CONSERVED, _PARALLEL, _DISK),
        setting=_setting(_LEAN_M, 0.0),
    ),
    Case(
        key="pull",
        unit="N",
        expected=lambda: _pull_hand_n(_BODY, _LEAN_M, _HALF_TURN),
        measured=lambda: engine.figures(_BODY, _PLATFORM).leaning.pull_n,
        # The figures start from half a turn a second leaning out, through the
        # engine's own I; the case's ω is exactly π.
        tolerance=1e-12,
        sources=(_CENTRIPETAL,),
        derived=True,
        setting=_setting(_LEAN_M, _PLATFORM.friction_n_m),
    ),
    Case(
        key="bearing_stops",
        unit="s",
        expected=lambda: _PUSH / _PLATFORM.friction_n_m,
        measured=_stop_run_s,
        # 4250 steps of 0.004 kg·m²/s taken from 17 leave a rounding of 10⁻¹².
        tolerance=1e-12,
        sources=(_TORQUE,),
        setting=_setting(_LEAN_M, _PLATFORM.friction_n_m),
    ),
)
