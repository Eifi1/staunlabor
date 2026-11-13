/** The experiments' shapes: what each exhibit's page sends and what the engine
 *  answers.
 *
 *  Mirrors `backend/staunlabor/domain/schemas/experiments.py`. The time
 *  simulations have no wire shape: the pages run them in the browser
 *  (`features/experiments/simulate/`). */

// ── vocabularies ─────────────────────────────────────────────────────────────

export type BallKind = "solid" | "hollow";
export type Idle = "closed" | "open";
export type FigureKind = "chair" | "skewed" | "scattered";
export type CurveKind = "line" | "cycloid" | "circle" | "parabola" | "hyperbola" | "hump";
export type RaceBall = "solid" | "hollow" | "sliding";

// ── the ball in the sphere ───────────────────────────────────────────────────

export interface SphereRequest {
  shell_radius_m: number;
  ball_radius_m: number;
  ball: BallKind;
  rolling_resistance: number;
}

export interface Orbit {
  rate_hz: number;
  angle_deg: number;
  depth_below_equator_m: number;
  height_above_bottom_m: number;
  speed_m_s: number;
  wobble_hz: number;
  normal_per_weight: number;
  friction_needed: number;
  energy_j_per_kg: number;
  drive_radius_needed_m: number;
}

export interface SwingPoint {
  amplitude_deg: number;
  rate_hz: number;
}

export interface SphereFigures {
  path_radius_m: number;
  gravity_share: number;
  lowest_orbit_hz: number;
  backbone: Orbit[];
  swing: SwingPoint[];
}

// ── the magnet car and the coil ──────────────────────────────────────────────

export interface MagnetRequest {
  remanence_t: number;
  diameter_m: number;
  length_m: number;
}

export interface CoilRequest {
  turns: number;
  mean_diameter_m: number;
  length_m: number;
  resistance_ohm: number;
}

export interface TrackRequest {
  car_mass_kg: number;
  flat_length_m: number;
  ramp_length_m: number;
  ramp_radius_m: number;
  rolling_resistance: number;
}

export interface CoilExhibitRequest {
  magnet: MagnetRequest;
  coil: CoilRequest;
  track: TrackRequest;
  supply_v: number;
  idle: Idle;
}

export interface CoilFigures {
  moment_a_m2: number;
  inductance_h: number;
  time_constant_s: number;
  full_current_a: number;
  peak_flux_wb: number;
  peak_coupling_v_s_per_m: number;
  peak_coupling_at_m: number;
  top_speed_m_s: number;
  ideal_gain_per_pass_j: number;
  top_height_m: number;
  speed_for_top_m_s: number;
  coasting_current_a: number;
  between_peaks_s: number;
}

export interface CoilCurve {
  x_m: number[];
  flux_wb: number[];
  coupling_v_s_per_m: number[];
}

export interface CoilAnalysis {
  figures: CoilFigures;
  curve: CoilCurve;
}

// ── the chair ────────────────────────────────────────────────────────────────

/** Metres from the hole: x to the right, y up, z into the box. */
export type Point3D = [number, number, number];

export interface Segment3D {
  a: Point3D;
  b: Point3D;
}

export interface ChairFigure {
  kind: FigureKind;
  segments: Segment3D[];
}

export interface Box3D {
  left_m: number;
  right_m: number;
  floor_m: number;
  ceiling_m: number;
  depth_m: number;
}

export interface Peephole {
  figure: ChairFigure;
  box: Box3D;
  sight_lines: Segment3D[];
}

export interface ChairAnalysis {
  boxes: Peephole[];
  joint_count: number;
  tolerance_m: number;
  binocular_gap_rad: number;
  acuity_rad: number;
  eye_baseline_m: number;
}

// ── the spinning platform ────────────────────────────────────────────────────

export interface BodyRequest {
  mass_kg: number;
  arm_share: number;
  trunk_share: number;
  trunk_gyration_m: number;
  legs_gyration_m: number;
  shoulder_m: number;
}

export interface PlatformRequest {
  mass_kg: number;
  radius_m: number;
  friction_n_m: number;
}

export interface PlatformExhibitRequest {
  body: BodyRequest;
  platform: PlatformRequest;
}

export interface Spin {
  lean_m: number;
  inertia_kg_m2: number;
  rev_per_s: number;
  energy_j: number;
  pull_n: number;
}

export interface CurvePoint {
  lean_m: number;
  inertia_kg_m2: number;
  rev_per_s: number;
}

export interface PlatformFigures {
  momentum_kg_m2_s: number;
  leaning: Spin;
  upright: Spin;
  speed_ratio: number;
  work_to_stand_up_j: number;
  lean_curve: CurvePoint[];
  /** Never, without friction. */
  stops_after_s: number | null;
}

// ── the race ─────────────────────────────────────────────────────────────────

export interface RaceRequest {
  drop_m: number;
  run_m: number;
  ball: RaceBall;
}

/** A track sampled for the animation: where the ball is at each time. */
export interface RacePath {
  x_m: number[];
  y_m: number[];
  t_s: number[];
}

export interface TrackMotion {
  vx_m_s: number[];
  vy_m_s: number[];
  ax_m_s2: number[];
  ay_m_s2: number[];
}

export interface RaceBasin {
  left_x_m: number;
  right_x_m: number;
  rim_y_m: number;
  top_y_m: number;
  bottom_x_m: number;
  bottom_y_m: number;
  bottom_radius_m: number;
  slope_rad: number;
}

export interface RaceTrack {
  kind: CurveKind;
  path: RacePath;
  time_s: number;
  length_m: number;
  lowest_m: number;
  top_speed_m_s: number;
  motion: TrackMotion;
}

export interface RaceRun {
  tracks: RaceTrack[];
  gravity_share: number;
  rolling_factor: number;
  cycloid_dips: boolean;
  cycloid_lowest_m: number;
  finish_speed_m_s: number;
  basin: RaceBasin;
  ball_radius_m: number;
  inertia: number;
}

export interface ValleyStart {
  height_m: number;
  cycloid: RacePath;
  circle: RacePath;
  cycloid_time_s: number;
  circle_time_s: number;
}

export interface Valley {
  radius_m: number;
  bowl_radius_m: number;
  tautochrone_s: number;
  starts: ValleyStart[];
}

export interface RaceAnalysis {
  race: RaceRun;
  valley: Valley;
}

// ── the Bernoulli elephant ───────────────────────────────────────────────────

export interface JetRequest {
  /** The trunk's opening, a diameter. */
  opening_m: number;
  /** The air's speed leaving it. */
  speed_m_s: number;
}

export interface FloatingBallRequest {
  diameter_m: number;
  mass_kg: number;
}

export interface ElephantRequest {
  jet: JetRequest;
  ball: FloatingBallRequest;
  /** How much of the Bernoulli suction acts sideways: the model's one fitted number. */
  coanda: number;
}

export interface LiftPoint {
  height_m: number;
  lift_n: number;
}

export interface SidePoint {
  offset_m: number;
  /** Toward the axis. */
  side_n: number;
  lift_n: number;
}

export interface TiltPoint {
  tilt_deg: number;
  height_m: number;
  offset_m: number;
}

export interface ElephantFigures {
  weight_n: number;
  buoyancy_n: number;
  rest_height_m: number;
  rest_lift_n: number;
  lift_off_m_s: number;
  jet_thrust_n: number;
  flow_m3_s: number;
  /** None while the air cannot lift the ball off the rim, and the six after it. */
  float_height_m: number | null;
  air_m_s: number | null;
  centre_m_s: number | null;
  reynolds: number | null;
  bob_hz: number | null;
  sway_hz: number | null;
  tilt_limit_deg: number | null;
  lift_curve: LiftPoint[];
  side_curve: SidePoint[];
  tilt_curve: TiltPoint[];
}

// ── the smoke ring ───────────────────────────────────────────────────────────

export interface DrumRequest {
  diameter_m: number;
  depth_m: number;
  hole_m: number;
  /** The rigid ring round the hole the visitor presses, its outer diameter. */
  ring_m: number;
  stroke_m: number;
  /** The skin's tension: assumed. */
  tension_n_m: number;
}

export interface RoomRequest {
  draught_m_s: number;
  turbulent_reynolds: number;
}

export interface SmokeExhibitRequest {
  drum: DrumRequest;
  room: RoomRequest;
}

export type SmokeVerdict = "ring" | "too_fast" | "too_slow" | "none";

export interface SmokeRing {
  duration_s: number;
  stroke_m: number;
  stroke_ratio: number;
  trailing: boolean;
  circulation_m2_s: number;
  reynolds: number;
  radius_m: number;
  speed_m_s: number;
  peak_jet_m_s: number;
  peak_force_n: number;
  verdict: SmokeVerdict;
}

export interface PressPoint {
  duration_s: number;
  reynolds: number;
  speed_m_s: number;
  peak_jet_m_s: number;
  peak_force_n: number;
  verdict: SmokeVerdict;
}

export interface SmokeFigures {
  effective_area_m2: number;
  area_ratio: number;
  stroke_m: number;
  stroke_ratio: number;
  stiffness_n_m: number;
  /** The window a full press makes a ring in, and its middle; none without a window. */
  fastest_s: number | null;
  slowest_s: number | null;
  best_s: number | null;
  best: SmokeRing | null;
  presses: PressPoint[];
}

// ── the ball cannon ──────────────────────────────────────────────────────────

export interface CannonBallRequest {
  diameter_m: number;
  /** A solid elastomer ball's, 1100 kg/m³; a hollow one is lighter for its size. */
  density_kg_m3: number;
}

export interface BallStackRequest {
  /** Bottom first: one, two or three. */
  balls: CannonBallRequest[];
  /** The bottom ball's underside when the stack is let go. */
  drop_m: number;
  gap_m: number;
  floor_restitution: number;
  ball_restitution: number;
  /** The elastomer's Young's modulus: a guess, soft rubber 1 to 10 MPa. */
  youngs_mpa: number;
}

export interface CannonLaunch {
  balls: number;
  launch_m_s: number;
  launch_height_m: number;
  apex_m: number;
  /** Its climb over the height the stack fell. */
  times_drop: number;
  /** Instantaneous hits one after another, with these losses: the textbook's model. */
  sequential_launch_m_s: number;
  /** The same without losses. */
  ideal_launch_m_s: number;
  /** No losses, each ball far lighter: (2ⁿ − 1) times the impact speed. */
  textbook_launch_m_s: number;
}

/** One contact, from closing to opening: 0 the floor, `c` the balls `c−1` and `c`. */
export interface CannonContact {
  contact: number;
  start_s: number;
  /** Null while still closed at the end. */
  end_s: number | null;
  closing_m_s: number;
  parting_m_s: number;
  peak_force_n: number;
  peak_overlap_m: number;
  impulse_n_s: number;
}

/** The forces over the stack's impact, every 0.1 ms for 30 ms, per contact. */
export interface CannonImpact {
  t_ms: number[];
  force_n: number[][];
  overlap_mm: number[][];
  y_m: number[][];
}

export interface CannonFigures {
  masses_kg: number[];
  impact_m_s: number;
  /** The stack cut to its bottom one, two, three balls. */
  launches: CannonLaunch[];
  energy_share: number;
  contacts: CannonContact[];
  impact: CannonImpact;
}

// ── the pages' starting point ────────────────────────────────────────────────

export interface ExperimentsDefaults {
  sphere: SphereRequest;
  coil: CoilExhibitRequest;
  platform: PlatformExhibitRequest;
  race: RaceRequest;
  elephant: ElephantRequest;
  smoke: SmokeExhibitRequest;
  cannon: BallStackRequest;
  meter_range_a: number;
  settle_s: number;
}
