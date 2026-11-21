/** The course's shapes (lessons 0–6 and the cheat sheet): what each widget
 *  sends and what the engine answers.
 *
 *  Mirrors the wire models of `backend/staunlabor/api/course_router.py`, which
 *  answer as Kurvenschmiede's `/dynamics` routes did: these are the part of its
 *  `shared/types/dynamics.ts` that moved, so a lesson moved unchanged.
 *  A complex number travels as its two parts (`Complex`), because JSON has none. */

export interface Complex {
  re: number;
  im: number;
}

// ── vocabularies ─────────────────────────────────────────────────────────────

/** The lessons here. Kurvenschmiede's 7–10 (the reduction, the worm rig, the
 *  vacuum, the valve) stayed there, and an exercise of theirs is never served. */
export type Lesson =
  "recipe" | "first_order" | "second_order" | "eigenvalues" | "laplace" | "numerics" | "two_mass" | "cheat_sheet";
export type AnalogyKind = "thermal" | "electrical" | "mechanical" | "vacuum";
export type Regime = "underdamped" | "critical" | "overdamped";
export type PortraitKind =
  "saddle" | "stable_node" | "unstable_node" | "stable_focus" | "unstable_focus" | "centre" | "degenerate";
export type BlockKind = "proportional" | "integrator" | "first_order" | "second_order" | "dead_time";
export type FilterMode = "torque_only" | "both" | "zero_phase";
export type EulerRegime = "monotone" | "one_step" | "alternating" | "neutral" | "diverging";
export type OscillatorMethod = "exact" | "euler" | "symplectic" | "rk4";
export type Differentiator = "none" | "lowpass" | "zero_phase";

// ── lessons 0 and 1 ──────────────────────────────────────────────────────────

export interface TankRequest {
  inflow_lps: number;
  area_m2: number;
  outflow_lps_per_m: number;
  level0_m?: number;
}

export interface TankRun {
  time_s: number[];
  level_m: number[];
  outflow_lps: number[];
  inflow_lps: number;
  time_constant_s: number;
  level_final_m: number;
}

export interface FirstOrderRequest {
  time_constant_s: number;
  start: number;
  final: number;
  at_s: number;
}

export interface TauMark {
  multiple: number;
  time_s: number;
  value: number;
  fraction: number;
}

export interface FirstOrderStep {
  time_s: number[];
  value: number[];
  remaining: number[];
  marks: TauMark[];
  tangent_end_s: number;
  at_s: number;
  at_value: number;
  at_fraction: number;
}

export interface Analogy {
  kind: AnalogyKind;
  storage: number;
  resistance: number;
  time_constant_s: number;
}

export interface FirstOrderLesson {
  step: FirstOrderStep;
  analogies: Analogy[];
}

export interface SeedRequest {
  seed: number;
}

export interface Measurement {
  seed: number;
  time_s: number[];
  value: number[];
  start: number;
  final: number;
  level_63: number;
  time_constant_s: number;
  noise: number;
}

// ── lesson 2 ─────────────────────────────────────────────────────────────────

/** The shaft by its parts or by its two numbers — one of the two. */
export interface SecondOrderRequest {
  inertia: number;
  stiffness?: number | null;
  damping_coefficient?: number | null;
  f0_hz?: number | null;
  damping_ratio?: number | null;
  torque?: number;
  excitation_hz?: number;
}

export interface Oscillator {
  inertia: number;
  stiffness: number;
  damping_coefficient: number;
  f0_hz: number;
  damping_ratio: number;
}

export interface SecondOrderFigures {
  w0: number;
  f0_hz: number;
  damping: number;
  regime: Regime;
  damped_w: number | null;
  overshoot: number | null;
  peak_time_s: number | null;
  settling_time_s: number | null;
  poles: Complex[];
}

export interface SecondOrderStep {
  system: Oscillator;
  figures: SecondOrderFigures;
  time_s: number[];
  value: number[];
  envelope_upper: number[];
  envelope_lower: number[];
  final_value: number;
  peak_value: number | null;
}

export interface MagnificationCurve {
  damping: number;
  value: number[];
}

export interface Magnification {
  ratio: number[];
  curves: MagnificationCurve[];
  damping: number;
  f0_hz: number;
  excitation_hz: number;
  excitation_ratio: number;
  excitation_value: number | null;
  error_pct: number | null;
  phase_deg: number;
  peak_ratio: number | null;
  peak_value: number;
}

export interface SecondOrderLesson {
  step: SecondOrderStep;
  magnification: Magnification;
}

export interface Peak {
  time_s: number;
  value: number;
}

export interface PeakPair {
  first: number;
  decrement: number;
  damping: number;
}

export interface DecayTest {
  seed: number;
  time_s: number[];
  value: number[];
  peaks: Peak[];
  pairs: PeakPair[];
  overall_damping: number | null;
  true_damping: number;
  f0_hz: number;
  noise: number;
}

// ── lesson 3 ─────────────────────────────────────────────────────────────────

export interface ScalarRequest {
  rate: number;
}

export interface ScalarGrowth {
  rate: number;
  time_s: number[];
  value: number[];
  stable: boolean;
  time_constant_s: number | null;
  doubling_time_s: number | null;
}

/** By `f0_hz` and `damping`, or by one dragged pole — one of the two. */
export interface PolesRequest {
  f0_hz?: number | null;
  damping?: number | null;
  real?: number | null;
  imag?: number | null;
}

export interface PolePair {
  f0_hz: number;
  damping: number;
  poles: Complex[];
  real_part: number;
  imag_hz: number;
  stable: boolean;
  regime: Regime;
  overshoot: number | null;
  time_s: number[];
  value: number[];
  envelope_upper: number[];
  envelope_lower: number[];
}

export interface MatrixRequest {
  a11: number;
  a12: number;
  a21: number;
  a22: number;
}

export interface Trajectory {
  x1: number[];
  x2: number[];
}

export interface Eigenvector {
  eigenvalue: number;
  x1: number;
  x2: number;
}

export interface MatrixPortrait {
  matrix: number[][];
  eigenvalues: Complex[];
  eigenvectors: Eigenvector[];
  kind: PortraitKind;
  trace: number;
  determinant: number;
  horizon_s: number;
  trajectories: Trajectory[];
}

// ── lesson 4 ─────────────────────────────────────────────────────────────────

export interface LaplaceRequest {
  time_constant_s: number;
  gain: number;
  step: number;
  start?: number;
}

export interface LaplaceSteps {
  time_constant_s: number;
  gain: number;
  step: number;
  start: number;
  pole: number;
  residue_zero: number;
  residue_pole: number;
  final_value: number;
  time_s: number[];
  value: number[];
}

export interface Block {
  kind: BlockKind;
  gain: number;
  time_constant_s: number;
  f0_hz: number;
  damping: number;
  dead_time_s: number;
}

export interface BlockChainRequest {
  blocks: Block[];
  cursor_hz: number;
  f_min_hz?: number;
  f_max_hz?: number;
  t_end_s?: number | null;
}

export interface BlockCurve {
  magnitude_db: number[];
  phase_deg: number[];
}

export interface Cursor {
  frequency_hz: number;
  magnitude: number;
  magnitude_db: number;
  phase_deg: number;
  delay_s: number;
}

export interface ChainResponse {
  frequency_hz: number[];
  magnitude_db: number[];
  phase_deg: number[];
  blocks: BlockCurve[];
  poles: Complex[];
  static_gain: number | null;
  dead_time_s: number;
  cursor: Cursor;
  time_s: number[];
  step: number[];
}

export interface FilterRequest {
  frequency_hz: number;
  corner_hz: number;
  mode: FilterMode;
  amplitude_deg?: number;
  stiffness_nm_per_deg?: number;
  friction_nm?: number;
}

export interface FilterLoop {
  frequency_hz: number;
  corner_hz: number;
  mode: FilterMode;
  angle_deg: number[];
  torque: number[];
  measured_angle_deg: number[];
  measured_torque: number[];
  apparent_hysteresis: number;
  true_hysteresis: number;
  phase_lag_deg: number;
  delay_s: number;
}

// ── lesson 5 ─────────────────────────────────────────────────────────────────

export interface SensorRunRequest {
  time_constant_s?: number;
  start?: number;
  final?: number;
  step_s: number;
  steps: number;
}

export interface ErrorRow {
  time_s: number;
  exact: number;
  euler: number;
  heun: number;
  rk4: number;
}

export interface Rk4Stage {
  t: number;
  y: number[];
  slope: number[];
}

export interface Rk4Step {
  t: number;
  h: number;
  y: number[];
  stages: Rk4Stage[];
  y_next: number[];
}

export interface SensorMethods {
  time_constant_s: number;
  step_s: number;
  exact_time_s: number[];
  exact: number[];
  rows: ErrorRow[];
  rk4_steps: Rk4Step[];
  euler_factor: number;
  rk4_factor: number;
  regime: EulerRegime;
}

export interface StepRequest {
  step_s: number;
}

export interface MethodRun {
  method: OscillatorMethod;
  time_s: number[];
  angle_deg: number[];
  amplitude_deg: number[];
  final_amplitude_deg: number;
  damping: number | null;
}

export interface OscillatorMethods {
  step_s: number;
  f0_hz: number;
  damping: number;
  step_ratio: number;
  euler_gain: number;
  euler_neutral_step_s: number;
  runs: MethodRun[];
}

export interface StiffRun {
  time_s: number[];
  fast: number[];
  slow: number[];
  stable: boolean;
  steps: number;
  work: number;
}

export interface StiffPair {
  step_s: number;
  fast_time_constant_s: number;
  slow_time_constant_s: number;
  rk4_max_step_s: number;
  rk4_min_steps: number;
  exact_time_s: number[];
  exact_slow: number[];
  rk4: StiffRun;
  implicit: StiffRun;
}

// ── lesson 6 ─────────────────────────────────────────────────────────────────

export interface TwoMassParameters {
  motor_inertia: number;
  adapter_inertia: number;
  shaft_stiffness: number;
  bar_stiffness: number;
  shaft_damping: number;
  bar_damping: number;
}

export interface TwoMassRunRequest {
  parameters: TwoMassParameters;
  excitation_hz: number;
}

export interface Phasor {
  magnitude: number;
  phase_deg: number;
}

export interface Mode {
  eigenvalue: Complex;
  frequency_hz: number;
  damped_frequency_hz: number;
  damping: number;
  shape: number[];
  reference: number;
  phase_spread_deg: number;
}

export interface ForcedPoint {
  frequency_hz: number;
  motor: Phasor;
  adapter: Phasor;
  ratio: Phasor;
  in_phase: boolean;
  shaft_torque: Phasor;
  bar_torque: Phasor;
  reading_ratio: number | null;
  error_pct: number | null;
}

export interface TwoMass {
  parameters: TwoMassParameters;
  modes: Mode[];
  hand_estimate_hz: number;
  hand_deviation_pct: number | null;
  absorber_hz: number;
  motor_still_hz: number;
  frequency_hz: number[];
  shaft_magnitude: number[];
  bar_magnitude: number[];
  point: ForcedPoint;
}

export interface CompensationRunRequest {
  parameters: TwoMassParameters;
  excitation_hz: number;
  noise_rad: number;
  sample_rate_hz: number;
  differentiator: Differentiator;
  corner_hz: number;
  seed?: number;
}

export interface Compensation {
  frequency_hz: number;
  sample_rate_hz: number;
  time_s: number[];
  bar_torque: number[];
  shaft_torque: number[];
  compensated: number[];
  uncompensated_error: number;
  compensated_error: number;
  noise_torque: number;
}

// ── the exercises ────────────────────────────────────────────────────────────

export interface Answer {
  value: number;
  unit: string;
  absolute: number | null;
  relative: number | null;
}

export interface Exercise {
  key: string;
  lesson: Lesson;
  inputs: Record<string, number>;
  answers: Answer[];
  estimate_first: boolean;
}

/** What `GET /course/defaults` answers: the two-mass rig's reference, every
 *  exercise of these lessons, and how long a slider holds still before a
 *  widget asks again. */
export interface CourseDefaults {
  two_mass: TwoMassParameters;
  exercises: Exercise[];
  settle_s: number;
}
