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
* :mod:`pendulum` — the block the swinging exhibits stand on: a plane
  pendulum exactly (Jacobi's elliptic functions) and stepped (Runge–Kutta),
  each the other's check.
* :mod:`coriolis` — the Coriolis carousel: a thrown puck goes straight and a
  rolled ball in a circle, seen from outside; both curve away for the riders.
* :mod:`foucault` — Foucault's pendulum in Winterthur: its plane turns 11.1°
  an hour against the floor, the Earth's turn about the local vertical.
* :mod:`harmonograph` — a pen on one pendulum and a board on another: the
  picture two damped swings draw, closed at a simple ratio, turning near one.
* :mod:`cone` — a double cone on rails that spread and rise: it rolls up them
  because its centre falls, and the exact contact says by how much.
* :mod:`parabola` — water in a spinning vessel: a paraboloid whose middle
  sinks as far as its rim rises, dry in the middle past a rate, a mirror whose
  focus the rate sets, and water that follows the vessel over Ekman's time.
* :mod:`coupled` — two pendulums and a spring: two modes, and a swing that
  wanders from one to the other at their beat, all of it only when they match.
* :mod:`peg` — Galileo's pendulum caught by a peg: the bob rises to the height
  it fell from, or swings over the peg, or its string goes slack.
* :mod:`maxwell` — Maxwell's wheel: a slow fall because nearly all its energy
  goes into its spin, a jerk at the bottom the strings' stretch sets, a climb
  nearly back.
* :mod:`chaos` — the double pendulum: two that start a thousandth of a degree
  apart part company, and the Lyapunov exponent measured Benettin's way.
* :mod:`waterwheel` — Malkus's leaking waterwheel, which is Lorenz's equations:
  still, steady, or turning back and forth without ever repeating.
* :mod:`wave` — a row of pendulums tuned to swing ``N``, ``N + 1``, … times a
  cycle: waves, groups, and all together again — at the swing it was tuned for.

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
from staunlabor.domain.experiments.chaos import ChaosRun, DoublePendulum, lyapunov, separation
from staunlabor.domain.experiments.chaos import energy as double_energy
from staunlabor.domain.experiments.chaos import mode_rates as double_mode_rates
from staunlabor.domain.experiments.chaos import run as run_chaos
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
from staunlabor.domain.experiments.cone import (
    ConeExhibit,
    ConeRun,
    DoubleCone,
    Rails,
    axis_height_m,
    axis_slope,
    contact_factor,
    contact_radius_m,
    rail_height_m,
    roll,
    start_for,
    threshold_deg,
)
from staunlabor.domain.experiments.coriolis import Body as ThrownBody
from staunlabor.domain.experiments.coriolis import (
    Carousel,
    Throw,
    ThrowPath,
    lead_deg,
    leaves_s,
    miss_deg,
    outside,
    turning,
)
from staunlabor.domain.experiments.coriolis import path as throw_path
from staunlabor.domain.experiments.coupled import (
    Bob,
    CoupledPendulums,
    CoupledRun,
    Start,
    beat_s,
    couplings,
    energies,
    exchange_share,
    mode_rates,
)
from staunlabor.domain.experiments.coupled import swing as coupled_swing
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
from staunlabor.domain.experiments.foucault import (
    FoucaultPendulum,
    LatitudePoint,
    degrees_per_hour,
    full_turn_h,
    latitude_curve,
    plane_deg,
    vertical_rate,
)
from staunlabor.domain.experiments.foucault import period_s as foucault_period_s
from staunlabor.domain.experiments.foucault import position as foucault_position
from staunlabor.domain.experiments.harmonograph import (
    Harmonograph,
    HarmonographFigures,
    HarmonographPendulum,
    HarmonographRun,
    nearest_ratio,
)
from staunlabor.domain.experiments.harmonograph import draw as harmonograph_draw
from staunlabor.domain.experiments.harmonograph import figures as harmonograph_figures
from staunlabor.domain.experiments.maxwell import (
    Bounce,
    MaxwellWheel,
    Shape,
    WheelRun,
    WheelState,
    bounces,
    climb_deceleration,
    fall_acceleration,
    inertia_ratio,
    rotation_share,
    state_at,
)
from staunlabor.domain.experiments.maxwell import bounce as wheel_bounce
from staunlabor.domain.experiments.maxwell import run as run_wheel
from staunlabor.domain.experiments.parabola import (
    SpinRun,
    Surface,
    Vessel,
    dry_rate,
    height_at,
    spill_rate,
    spin_up_time_s,
    surface,
)
from staunlabor.domain.experiments.parabola import profile as water_profile
from staunlabor.domain.experiments.parabola import spin as water_spin
from staunlabor.domain.experiments.peg import (
    Event,
    Mode,
    PegPendulum,
    PegRun,
    PegState,
    outcome,
    position,
    slack_height_m,
    start_height_m,
)
from staunlabor.domain.experiments.peg import run as run_peg
from staunlabor.domain.experiments.peg import step as peg_step
from staunlabor.domain.experiments.pendulum import (
    SwingRun,
    angle_deg,
    ellipk,
    jacobi,
    length_for,
    period_factor,
    period_s,
    small_period_s,
    swing,
)
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
from staunlabor.domain.experiments.waterwheel import WaterWheel, WheelTurns, cup_level, hopf_rho, regime, steady_x
from staunlabor.domain.experiments.waterwheel import run as run_waterwheel
from staunlabor.domain.experiments.wave import (
    GroupPoint,
    PendulumWave,
    SpreadPoint,
    WaveFigures,
    WavePendulum,
    groups_at,
    lag_deg,
    lengths_m,
    spread_deg,
)
from staunlabor.domain.experiments.wave import figures as wave_figures

__all__ = [
    "ACUITY_RAD",
    "EYE",
    "EYE_BASELINE_M",
    "METER_RANGE_A",
    "Ball",
    "BallKind",
    "BallStack",
    "Basin",
    "Bob",
    "Body",
    "Bounce",
    "Box",
    "CannonFigures",
    "Carousel",
    "ChairAnalysis",
    "ChaosRun",
    "Coil",
    "CoilAnalysis",
    "CoilCurve",
    "CoilExhibit",
    "CoilFigures",
    "CoilRun",
    "ConeExhibit",
    "ConeRun",
    "Contact",
    "CoupledPendulums",
    "CoupledRun",
    "CurveKind",
    "CurvePoint",
    "DoubleCone",
    "DoublePendulum",
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
    "Event",
    "Figure",
    "FigureKind",
    "Flight",
    "FloatingBall",
    "FoucaultPendulum",
    "GroupPoint",
    "Harmonograph",
    "HarmonographFigures",
    "HarmonographPendulum",
    "HarmonographRun",
    "Idle",
    "Impact",
    "Inertia",
    "Jet",
    "Joint",
    "LatitudePoint",
    "Launch",
    "LiftPoint",
    "Magnet",
    "MaxwellWheel",
    "Mode",
    "Move",
    "Orbit",
    "Path",
    "Peephole",
    "PegPendulum",
    "PegRun",
    "PegState",
    "PendulumWave",
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
    "Rails",
    "Ring",
    "Room",
    "Scripted",
    "Segment",
    "Shape",
    "SidePoint",
    "SmokeExhibit",
    "SmokeFigures",
    "Sphere",
    "SphereFigures",
    "SphereRun",
    "Spin",
    "SpinRun",
    "SpreadPoint",
    "Start",
    "Surface",
    "SwingPoint",
    "SwingRun",
    "Throw",
    "ThrowPath",
    "ThrownBody",
    "TiltPoint",
    "TimingPoint",
    "Track",
    "TrackMotion",
    "Valley",
    "ValleyStart",
    "Verdict",
    "Vessel",
    "WaterWheel",
    "WaveFigures",
    "WavePendulum",
    "WheelRun",
    "WheelState",
    "WheelTurns",
    "angle_deg",
    "axis_height_m",
    "axis_slope",
    "backbone",
    "beat_s",
    "binocular_gap",
    "bounces",
    "cannon_drop",
    "cannon_figures",
    "cannon_launch",
    "chair",
    "chair_analysis",
    "climb_deceleration",
    "coil_analysis",
    "contact_factor",
    "contact_radius_m",
    "coupled_swing",
    "coupling",
    "couplings",
    "cup_level",
    "cycloid_through",
    "degrees_per_hour",
    "double_energy",
    "double_mode_rates",
    "dry_rate",
    "elephant_figures",
    "ellipk",
    "energies",
    "exchange_share",
    "exhibit",
    "fall_acceleration",
    "figures",
    "flux_linkage",
    "foucault_period_s",
    "foucault_position",
    "full_turn_h",
    "groups_at",
    "harmonograph_draw",
    "harmonograph_figures",
    "height_at",
    "hopf_rho",
    "image",
    "inertia",
    "inertia_ratio",
    "jacobi",
    "joint_gap",
    "joints",
    "lag_deg",
    "latitude_curve",
    "lead_deg",
    "leaves_s",
    "length_for",
    "lengths_m",
    "lowest_orbit_hz",
    "lyapunov",
    "miss_deg",
    "mode_rates",
    "nearest_ratio",
    "orbit",
    "orbit_at",
    "outcome",
    "outside",
    "peak_coupling",
    "peg_step",
    "period_factor",
    "period_s",
    "plane_deg",
    "platform_figures",
    "position",
    "pull_n",
    "race_entries",
    "race_valley",
    "rail_height_m",
    "regime",
    "ring_from_push",
    "roll",
    "rotation_share",
    "run_chaos",
    "run_coil",
    "run_elephant",
    "run_peg",
    "run_pit",
    "run_platform",
    "run_race",
    "run_sphere",
    "run_waterwheel",
    "run_wheel",
    "scatter",
    "separation",
    "settle_race",
    "sight_lines",
    "skew",
    "slack_height_m",
    "slide",
    "small_period_s",
    "smoke_figures",
    "smoke_flight",
    "sphere_figures",
    "spill_rate",
    "spin",
    "spin_up_time_s",
    "spread_deg",
    "start_for",
    "start_height_m",
    "state_at",
    "steady_x",
    "surface",
    "swing",
    "swing_hz",
    "threshold_deg",
    "throw_path",
    "timing_curve",
    "tolerance",
    "turning",
    "vertical_rate",
    "water_profile",
    "water_spin",
    "wave_figures",
    "wheel_bounce",
    "widest_gap",
]
