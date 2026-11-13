"""Hands-on experiments, computed: the engine behind every exhibit's page.

Exhibits a visitor plays with — inspired by exhibits at the Swiss Science
Center Technorama in Winterthur — each modelled so that a page can let the
reader play the visitor and then show the computation behind what they felt.
Pure functions over floats and frozen dataclasses, the standard library only;
every number a page states is asserted in
``tests/unit/test_experiments.py``, and each model was checked independently
with SciPy before it was written (``docs/experiments.md``).

* :mod:`sphere` — a ball in a hanging sphere, pumped round the equator: a
  spherical pendulum under 5/7 of gravity, and a resonance that moves as the
  ball climbs.
* :mod:`coil` — a magnet car through a coil between two ramps: one curve,
  ``dΨ/dx``, is both the voltage it induces and the force it feels.
* :mod:`perspective` — a chair, a skewed chair and scattered rods that are one
  picture through a peephole: lines of sight, and the depth one eye cannot see.
* :mod:`platform` — a spinning platform a visitor stands on: ``L = I·ω`` kept,
  so pulling in spins faster — and the arms pay for the energy that gains.
* :mod:`race` — balls let go together on six tracks: the cycloid is the
  fastest (the brachistochrone) and, as a valley, the tautochrone.
* :mod:`pit` — the bowl the race's balls fly into past the finish, where they
  bounce, roll and knock into each other until all of them lie still.
* :mod:`elephant` — a light ball floating on a jet of air: held up where the
  widening jet's push equals its weight, and held in by the faster air on the
  side nearer the axis (Bernoulli), up to a tilt it can no longer hold.
* :mod:`smoke` — a press on a drum's skin and the ring of smoke it makes:
  the slug model's circulation, and a window between too turbulent and too
  slow for the room.
* :mod:`cannon` — balls stacked and dropped: Hertz contacts hand momentum up
  the stack in a few milliseconds, and the small ball on top leaves several
  times as fast as the stack arrived.

What it is not: a physics engine for games. Each model is the exhibit's, with
the assumptions its module states.
"""

from staunlabor.domain.experiments.cannon import (
    Ball,
    BallStack,
    CannonFigures,
    Contact,
    Drop,
    Impact,
    Launch,
)
from staunlabor.domain.experiments.cannon import drop as cannon_drop
from staunlabor.domain.experiments.cannon import figures as cannon_figures
from staunlabor.domain.experiments.cannon import launch as cannon_launch
from staunlabor.domain.experiments.coil import (
    METER_RANGE_A,
    Coil,
    CoilAnalysis,
    CoilCurve,
    CoilExhibit,
    CoilFigures,
    CoilRun,
    EnergyAccount,
    Idle,
    Magnet,
    Press,
    PressRule,
    Scripted,
    TimingPoint,
    Track,
    coupling,
    figures,
    flux_linkage,
    peak_coupling,
    timing_curve,
)
from staunlabor.domain.experiments.coil import analysis as coil_analysis
from staunlabor.domain.experiments.coil import run as run_coil
from staunlabor.domain.experiments.elephant import (
    Elephant,
    ElephantFigures,
    ElephantRun,
    FloatingBall,
    Jet,
    LiftPoint,
    SidePoint,
    TiltPoint,
)
from staunlabor.domain.experiments.elephant import Move as ElephantMove
from staunlabor.domain.experiments.elephant import figures as elephant_figures
from staunlabor.domain.experiments.elephant import run as run_elephant
from staunlabor.domain.experiments.perspective import (
    ACUITY_RAD,
    EYE,
    EYE_BASELINE_M,
    Box,
    ChairAnalysis,
    Figure,
    FigureKind,
    Joint,
    Peephole,
    Segment,
    binocular_gap,
    chair,
    exhibit,
    image,
    joint_gap,
    joints,
    scatter,
    sight_lines,
    skew,
    slide,
    tolerance,
    widest_gap,
)
from staunlabor.domain.experiments.perspective import analysis as chair_analysis
from staunlabor.domain.experiments.pit import Basin, Entry, PitBall, PitRun
from staunlabor.domain.experiments.pit import run as run_pit
from staunlabor.domain.experiments.platform import (
    Body,
    CurvePoint,
    Inertia,
    Move,
    Platform,
    PlatformFigures,
    PlatformRun,
    Posture,
    Spin,
    inertia,
    pull_n,
    spin,
)
from staunlabor.domain.experiments.platform import figures as platform_figures
from staunlabor.domain.experiments.platform import run as run_platform
from staunlabor.domain.experiments.race import (
    CurveKind,
    Path,
    Race,
    RaceBall,
    RaceRun,
    TrackMotion,
    Valley,
    ValleyStart,
    cycloid_through,
)
from staunlabor.domain.experiments.race import Track as RaceTrack
from staunlabor.domain.experiments.race import entries as race_entries
from staunlabor.domain.experiments.race import race as run_race
from staunlabor.domain.experiments.race import settle as settle_race
from staunlabor.domain.experiments.race import valley as race_valley
from staunlabor.domain.experiments.smoke import (
    Drum,
    Flight,
    PressPoint,
    Push,
    Ring,
    Room,
    SmokeExhibit,
    SmokeFigures,
    Verdict,
    ring_from_push,
)
from staunlabor.domain.experiments.smoke import figures as smoke_figures
from staunlabor.domain.experiments.smoke import flight as smoke_flight
from staunlabor.domain.experiments.sphere import (
    BallKind,
    Drive,
    DrivePath,
    Orbit,
    Sphere,
    SphereFigures,
    SphereRun,
    SwingPoint,
    backbone,
    lowest_orbit_hz,
    orbit,
    orbit_at,
    swing_hz,
)
from staunlabor.domain.experiments.sphere import figures as sphere_figures
from staunlabor.domain.experiments.sphere import run as run_sphere

__all__ = [
    "ACUITY_RAD",
    "EYE",
    "EYE_BASELINE_M",
    "METER_RANGE_A",
    "Ball",
    "BallKind",
    "BallStack",
    "Basin",
    "Body",
    "Box",
    "CannonFigures",
    "ChairAnalysis",
    "Coil",
    "CoilAnalysis",
    "CoilCurve",
    "CoilExhibit",
    "CoilFigures",
    "CoilRun",
    "Contact",
    "CurveKind",
    "CurvePoint",
    "Drive",
    "DrivePath",
    "Drop",
    "Drum",
    "Elephant",
    "ElephantFigures",
    "ElephantMove",
    "ElephantRun",
    "EnergyAccount",
    "Entry",
    "Figure",
    "FigureKind",
    "Flight",
    "FloatingBall",
    "Idle",
    "Impact",
    "Inertia",
    "Jet",
    "Joint",
    "Launch",
    "LiftPoint",
    "Magnet",
    "Move",
    "Orbit",
    "Path",
    "Peephole",
    "PitBall",
    "PitRun",
    "Platform",
    "PlatformFigures",
    "PlatformRun",
    "Posture",
    "Press",
    "PressPoint",
    "PressRule",
    "Push",
    "Race",
    "RaceBall",
    "RaceRun",
    "RaceTrack",
    "Ring",
    "Room",
    "Scripted",
    "Segment",
    "SidePoint",
    "SmokeExhibit",
    "SmokeFigures",
    "Sphere",
    "SphereFigures",
    "SphereRun",
    "Spin",
    "SwingPoint",
    "TiltPoint",
    "TimingPoint",
    "Track",
    "TrackMotion",
    "Valley",
    "ValleyStart",
    "Verdict",
    "backbone",
    "binocular_gap",
    "cannon_drop",
    "cannon_figures",
    "cannon_launch",
    "chair",
    "chair_analysis",
    "coil_analysis",
    "coupling",
    "cycloid_through",
    "elephant_figures",
    "exhibit",
    "figures",
    "flux_linkage",
    "image",
    "inertia",
    "joint_gap",
    "joints",
    "lowest_orbit_hz",
    "orbit",
    "orbit_at",
    "peak_coupling",
    "platform_figures",
    "pull_n",
    "race_entries",
    "race_valley",
    "ring_from_push",
    "run_coil",
    "run_elephant",
    "run_pit",
    "run_platform",
    "run_race",
    "run_sphere",
    "scatter",
    "settle_race",
    "sight_lines",
    "skew",
    "slide",
    "smoke_figures",
    "smoke_flight",
    "sphere_figures",
    "spin",
    "swing_hz",
    "timing_curve",
    "tolerance",
    "widest_gap",
]
