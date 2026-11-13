"""The wire shape of the experiments: what each page sends and what the engine answers.

Mirrors the dataclasses in ``domain/experiments/`` field for field, by name —
the router hands each model to its dataclass as ``**model_dump()``, so a name
that differs fails the API tests at once. Every input carries bounds
well outside the page's sliders, so a value past them is a typo or a script and
is refused here with the field's name. What the bounds cannot catch alone (a
ball as big as its sphere, a coil longer than the flat) the engine refuses with
a ``ValueError``, which ``main.py`` answers as a 400.

There is no route for the time simulations: the pages run them in the
browser, held to the engine by ``engine-cases.json`` (``docs/experiments.md``).
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from staunlabor.domain.experiments import BallKind, CurveKind, FigureKind, Idle, RaceBall, Verdict


class _Out(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class _In(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)


# ── the ball in the sphere ───────────────────────────────────────────────────


class SphereIn(_In):
    shell_radius_m: float = Field(ge=0.05, le=1.0, default=0.20)
    ball_radius_m: float = Field(ge=0.002, le=0.2, default=0.02)
    ball: BallKind = BallKind.SOLID
    rolling_resistance: float = Field(ge=0, le=0.1, default=0.005)


class OrbitOut(_Out):
    rate_hz: float
    angle_deg: float
    depth_below_equator_m: float
    height_above_bottom_m: float
    speed_m_s: float
    wobble_hz: float
    normal_per_weight: float
    friction_needed: float
    energy_j_per_kg: float
    drive_radius_needed_m: float


class SwingPointOut(_Out):
    amplitude_deg: float
    rate_hz: float


class SphereFiguresOut(_Out):
    path_radius_m: float
    gravity_share: float
    lowest_orbit_hz: float
    backbone: list[OrbitOut]
    swing: list[SwingPointOut]


# ── the magnet car and the coil ──────────────────────────────────────────────


class MagnetIn(_In):
    remanence_t: float = Field(ge=0.05, le=1.5, default=1.3)
    diameter_m: float = Field(ge=0.002, le=0.1, default=0.020)
    length_m: float = Field(ge=0.001, le=0.1, default=0.010)


class CoilIn(_In):
    turns: int = Field(ge=1, le=20_000, default=1600)
    mean_diameter_m: float = Field(ge=0.005, le=0.3, default=0.060)
    length_m: float = Field(ge=0.005, le=0.3, default=0.050)
    resistance_ohm: float = Field(ge=0.1, le=10_000, default=94.0)


class TrackIn(_In):
    car_mass_kg: float = Field(ge=0.01, le=5, default=0.15)
    flat_length_m: float = Field(ge=0.05, le=2, default=0.20)
    ramp_length_m: float = Field(ge=0.05, le=2, default=0.30)
    ramp_radius_m: float = Field(ge=0.1, le=10, default=0.90)
    rolling_resistance: float = Field(ge=0, le=0.1, default=0.005)


class CoilExhibitIn(_In):
    magnet: MagnetIn = MagnetIn()
    coil: CoilIn = CoilIn()
    track: TrackIn = TrackIn()
    supply_v: float = Field(ge=0.5, le=48, default=9.0)
    idle: Idle = Idle.CLOSED


class CoilFiguresOut(_Out):
    moment_a_m2: float
    inductance_h: float
    time_constant_s: float
    full_current_a: float
    peak_flux_wb: float
    peak_coupling_v_s_per_m: float
    peak_coupling_at_m: float
    top_speed_m_s: float
    ideal_gain_per_pass_j: float
    top_height_m: float
    speed_for_top_m_s: float
    coasting_current_a: float
    between_peaks_s: float


class CoilCurveOut(_Out):
    x_m: list[float]
    flux_wb: list[float]
    coupling_v_s_per_m: list[float]


class CoilAnalysisOut(_Out):
    figures: CoilFiguresOut
    curve: CoilCurveOut


# ── the chair ────────────────────────────────────────────────────────────────


class SegmentOut(_Out):
    #: Metres from the hole: x to the right, y up, z into the box.
    a: list[float]
    b: list[float]


class FigureOut(_Out):
    kind: FigureKind
    segments: list[SegmentOut]


class BoxOut(_Out):
    left_m: float
    right_m: float
    floor_m: float
    ceiling_m: float
    depth_m: float


class PeepholeOut(_Out):
    figure: FigureOut
    box: BoxOut
    sight_lines: list[SegmentOut]


class ChairAnalysisOut(_Out):
    boxes: list[PeepholeOut]
    joint_count: int
    tolerance_m: float
    binocular_gap_rad: float
    acuity_rad: float
    eye_baseline_m: float


# ── the spinning platform ────────────────────────────────────────────────────


class BodyIn(_In):
    mass_kg: float = Field(ge=20, le=150, default=70.0)
    arm_share: float = Field(ge=0.01, le=0.1, default=0.05)
    trunk_share: float = Field(ge=0.3, le=0.7, default=0.55)
    trunk_gyration_m: float = Field(ge=0, le=0.3, default=0.12)
    legs_gyration_m: float = Field(ge=0, le=0.3, default=0.08)
    shoulder_m: float = Field(ge=0.05, le=0.4, default=0.20)


class PlatformIn(_In):
    mass_kg: float = Field(ge=0, le=200, default=15.0)
    radius_m: float = Field(ge=0.1, le=1.5, default=0.30)
    friction_n_m: float = Field(ge=0, le=5, default=0.2)


class PlatformExhibitIn(_In):
    """The visitor and the platform: the engine takes them as two arguments."""

    body: BodyIn = BodyIn()
    platform: PlatformIn = PlatformIn()


class SpinOut(_Out):
    lean_m: float
    inertia_kg_m2: float
    rev_per_s: float
    energy_j: float
    pull_n: float


class CurvePointOut(_Out):
    lean_m: float
    inertia_kg_m2: float
    rev_per_s: float


class PlatformFiguresOut(_Out):
    momentum_kg_m2_s: float
    leaning: SpinOut
    upright: SpinOut
    speed_ratio: float
    work_to_stand_up_j: float
    lean_curve: list[CurvePointOut]
    stops_after_s: float | None


# ── the race ─────────────────────────────────────────────────────────────────


class RaceIn(_In):
    drop_m: float = Field(ge=0.1, le=2, default=0.5)
    run_m: float = Field(ge=0.1, le=5, default=1.2)
    ball: RaceBall = RaceBall.SOLID


class PathOut(_Out):
    x_m: list[float]
    y_m: list[float]
    t_s: list[float]


class TrackMotionOut(_Out):
    vx_m_s: list[float]
    vy_m_s: list[float]
    ax_m_s2: list[float]
    ay_m_s2: list[float]


class BasinOut(_Out):
    left_x_m: float
    right_x_m: float
    rim_y_m: float
    top_y_m: float
    bottom_x_m: float
    bottom_y_m: float
    bottom_radius_m: float
    slope_rad: float


class RaceTrackOut(_Out):
    kind: CurveKind
    path: PathOut
    time_s: float
    length_m: float
    lowest_m: float
    top_speed_m_s: float
    motion: TrackMotionOut


class RaceRunOut(_Out):
    tracks: list[RaceTrackOut]
    gravity_share: float
    rolling_factor: float
    cycloid_dips: bool
    cycloid_lowest_m: float
    finish_speed_m_s: float
    basin: BasinOut
    ball_radius_m: float
    inertia: float


class ValleyStartOut(_Out):
    height_m: float
    cycloid: PathOut
    circle: PathOut
    cycloid_time_s: float
    circle_time_s: float


class ValleyOut(_Out):
    radius_m: float
    bowl_radius_m: float
    tautochrone_s: float
    starts: list[ValleyStartOut]


class RaceAnalysisOut(_Out):
    """The race and the valley, for the ball the race asks for: the router puts
    the engine's two answers side by side."""

    race: RaceRunOut
    valley: ValleyOut


# ── the Bernoulli elephant ───────────────────────────────────────────────────


class JetIn(_In):
    opening_m: float = Field(ge=0.02, le=0.3, default=0.10)
    #: At least a breath: a still jet has no lift-off speed to state.
    speed_m_s: float = Field(ge=1, le=60, default=14.5)


class FloatingBallIn(_In):
    diameter_m: float = Field(ge=0.03, le=0.5, default=0.15)
    mass_kg: float = Field(ge=0.001, le=0.5, default=0.030)


class ElephantIn(_In):
    jet: JetIn = JetIn()
    ball: FloatingBallIn = FloatingBallIn()
    coanda: float = Field(ge=0, le=3, default=1.0)


class LiftPointOut(_Out):
    height_m: float
    lift_n: float


class SidePointOut(_Out):
    offset_m: float
    side_n: float
    lift_n: float


class TiltPointOut(_Out):
    tilt_deg: float
    height_m: float
    offset_m: float


class ElephantFiguresOut(_Out):
    weight_n: float
    buoyancy_n: float
    rest_height_m: float
    rest_lift_n: float
    lift_off_m_s: float
    jet_thrust_n: float
    flow_m3_s: float
    float_height_m: float | None
    air_m_s: float | None
    centre_m_s: float | None
    reynolds: float | None
    bob_hz: float | None
    sway_hz: float | None
    tilt_limit_deg: float | None
    lift_curve: list[LiftPointOut]
    side_curve: list[SidePointOut]
    tilt_curve: list[TiltPointOut]


# ── the smoke ring ───────────────────────────────────────────────────────────


class DrumIn(_In):
    diameter_m: float = Field(ge=0.5, le=4, default=1.9)
    depth_m: float = Field(ge=0.1, le=1, default=0.30)
    hole_m: float = Field(ge=0.05, le=1, default=0.30)
    ring_m: float = Field(ge=0.06, le=1.5, default=0.40)
    stroke_m: float = Field(ge=0.01, le=0.3, default=0.08)
    tension_n_m: float = Field(ge=0, le=2000, default=150.0)


class RoomIn(_In):
    draught_m_s: float = Field(ge=0, le=3, default=0.5)
    turbulent_reynolds: float = Field(ge=1e3, le=1e7, default=1.6e5)


class SmokeExhibitIn(_In):
    drum: DrumIn = DrumIn()
    room: RoomIn = RoomIn()


class RingOut(_Out):
    duration_s: float
    stroke_m: float
    stroke_ratio: float
    trailing: bool
    circulation_m2_s: float
    reynolds: float
    radius_m: float
    speed_m_s: float
    peak_jet_m_s: float
    peak_force_n: float
    verdict: Verdict


class PressPointOut(_Out):
    duration_s: float
    reynolds: float
    speed_m_s: float
    peak_jet_m_s: float
    peak_force_n: float
    verdict: Verdict


class SmokeFiguresOut(_Out):
    effective_area_m2: float
    area_ratio: float
    stroke_m: float
    stroke_ratio: float
    stiffness_n_m: float
    fastest_s: float | None
    slowest_s: float | None
    best_s: float | None
    best: RingOut | None
    presses: list[PressPointOut]


# ── the ball cannon ──────────────────────────────────────────────────────────


class CannonBallIn(_In):
    diameter_m: float = Field(ge=0.01, le=0.40)
    density_kg_m3: float = Field(ge=50, le=20000, default=1100.0)


def _exhibit_balls() -> list[CannonBallIn]:
    return [CannonBallIn(diameter_m=d) for d in (0.10, 0.07, 0.05)]


class BallStackIn(_In):
    #: Bottom first.
    balls: list[CannonBallIn] = Field(min_length=1, max_length=3, default_factory=_exhibit_balls)
    drop_m: float = Field(ge=0.05, le=3.0, default=1.0)
    gap_m: float = Field(ge=0, le=0.10, default=0.0)
    floor_restitution: float = Field(ge=0.3, le=1, default=0.85)
    ball_restitution: float = Field(ge=0.3, le=1, default=0.85)
    youngs_mpa: float = Field(ge=0.5, le=200, default=3.0)


class LaunchOut(_Out):
    balls: int
    launch_m_s: float
    launch_height_m: float
    apex_m: float
    times_drop: float
    sequential_launch_m_s: float
    ideal_launch_m_s: float
    textbook_launch_m_s: float


class ContactOut(_Out):
    contact: int
    start_s: float
    end_s: float | None
    closing_m_s: float
    parting_m_s: float
    peak_force_n: float
    peak_overlap_m: float
    impulse_n_s: float


class ImpactOut(_Out):
    t_ms: list[float]
    force_n: list[list[float]]
    overlap_mm: list[list[float]]
    y_m: list[list[float]]


class CannonFiguresOut(_Out):
    masses_kg: list[float]
    impact_m_s: float
    launches: list[LaunchOut]
    energy_share: float
    contacts: list[ContactOut]
    impact: ImpactOut


# ── the pages' starting point ────────────────────────────────────────────────


class ExperimentsDefaultsOut(_Out):
    sphere: SphereIn
    coil: CoilExhibitIn
    platform: PlatformExhibitIn
    race: RaceIn
    elephant: ElephantIn
    smoke: SmokeExhibitIn
    cannon: BallStackIn
    #: The exhibit's meter: digital, ± this many amperes.
    meter_range_a: float
    #: How long a page waits after the last slider step before asking.
    settle_s: float
