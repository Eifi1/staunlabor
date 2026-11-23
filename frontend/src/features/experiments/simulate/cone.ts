/**
 * The double cone on its rails, in the browser: a line-for-line port of
 * `backend/staunlabor/domain/experiments/cone.py`, held to it by
 * `simulate.test.ts`.
 *
 * The page rolls the cone as the reader watches and redraws its heights with
 * every slider, so there is no route: the geometry (where the rails just graze
 * the cone, how its axis runs) and the roll (Lagrange's equation, stepped by the
 * pendulum block's Runge–Kutta) are asked of this port. A change to the physics
 * is made in Python first.
 */

import { G } from "./constants";
import { MAX_DURATION_S, rk4, sampleEvery, STEP_S } from "./numerics";
import { roundHalfEven, TO_DEG, TO_RAD } from "./python";

/** I/(M·R²) of a double cone about its axis. */
const SPIN_SHARE = 3 / 10;
/** The rails end at most this share of the cone's half-length from its middle. */
const TIP_MARGIN = 0.9;

export interface DoubleCone {
  radius_m: number;
  cone_deg: number;
}

export interface Rails {
  spread_deg: number;
  slope_deg: number;
  start_half_gap_m: number;
  length_m: number;
}

export interface ConeExhibit {
  cone: DoubleCone;
  rails: Rails;
}

const tanDeg = (deg: number) => Math.tan(deg * TO_RAD);

export function halfLengthM(cone: DoubleCone): number {
  return cone.radius_m / tanDeg(cone.cone_deg);
}

/** Each rail's distance from the centre line at `x`. */
export function halfGapM(ex: ConeExhibit, x: number): number {
  return ex.rails.start_half_gap_m + x * tanDeg(ex.rails.spread_deg);
}

/** Why the engine would refuse the build, or `null`: the rails ending too near
 *  the tips, or starting wider apart than the cone is long. */
export function refusal(ex: ConeExhibit): "fall_through" | "too_wide" | null {
  const half = halfLengthM(ex.cone);
  if (halfGapM(ex, ex.rails.length_m) >= TIP_MARGIN * half) return "fall_through";
  if (ex.rails.start_half_gap_m >= half) return "too_wide";
  return null;
}

/** `k = tan α·tan β`. */
function steepness(ex: ConeExhibit): number {
  return tanDeg(ex.cone.cone_deg) * tanDeg(ex.rails.spread_deg);
}

function contact(k: number, slopeDeg: number): number {
  const tg = tanDeg(slopeDeg);
  const sec2 = 1 + tg * tg;
  return (Math.sqrt(sec2 - k * k) - k * tg) / (1 - k * k);
}

export function contactFactor(ex: ConeExhibit): number {
  return contact(steepness(ex), ex.rails.slope_deg);
}

/** `m`: the axis's rise per metre along the rails; negative rolls up them. */
export function axisSlope(ex: ConeExhibit): number {
  return tanDeg(ex.rails.slope_deg) - contactFactor(ex) * steepness(ex);
}

export function radiusUnderM(ex: ConeExhibit, x: number): number {
  return ex.cone.radius_m - halfGapM(ex, x) * tanDeg(ex.cone.cone_deg);
}

export function axisHeightM(ex: ConeExhibit, x: number): number {
  return x * tanDeg(ex.rails.slope_deg) + contactFactor(ex) * radiusUnderM(ex, x);
}

export function railHeightM(ex: ConeExhibit, x: number): number {
  return x * tanDeg(ex.rails.slope_deg);
}

/** `[s*, ρ/r₀]`: the contact's offset along the rails and its distance from the
 *  axis, each per metre of `r₀`. */
export function offsets(ex: ConeExhibit): [number, number] {
  const k = steepness(ex);
  const tg = tanDeg(ex.rails.slope_deg);
  const c = contactFactor(ex);
  const along = (c * tg - k) / (1 + tg * tg - k * k);
  return [along, 1 - along * k];
}

export function contactRadiusM(ex: ConeExhibit, x: number): number {
  return offsets(ex)[1] * radiusUnderM(ex, x);
}

/** `γ*`: the slope at which the axis runs level, the textbook's exactly. */
export function thresholdDeg(ex: ConeExhibit): number {
  return Math.atan(steepness(ex)) * TO_DEG;
}

export function acceleration(ex: ConeExhibit, x: number, v: number): number {
  const m = axisSlope(ex);
  const [, share] = offsets(ex);
  const rho = contactRadiusM(ex, x);
  const spin = SPIN_SHARE * ex.cone.radius_m ** 2;
  const a = (1 + m * m) * (1 + spin / (rho * rho));
  const da = (1 + m * m) * spin * (-2 / rho ** 3) * (-share * steepness(ex));
  return -(G * m + 0.5 * da * v * v) / a;
}

/** The engine's `ConeRun`. */
export interface ConeRun {
  t: number[];
  x_m: number[];
  axis_m: number[];
  speed_m_s: number[];
  spin_rev_s: number[];
  stopped_at_s: number | null;
  final_x_m: number;
}

/** Where a roll in progress stands. */
export interface RollState {
  i: number;
  x: number;
  v: number;
  stopped: boolean;
}

/** The engine's `on_rails_m`: from where to where the cone's contact lies on the rails. */
function onRailsM(ex: ConeExhibit): [number, number] {
  const [along, share] = offsets(ex);
  const start = radiusUnderM(ex, 0.0);
  const length = ex.rails.length_m;
  return [Math.max(0.0, (-along * start) / share), Math.min(length, (length - along * start) / share)];
}

/** One step of the roll, in place: the stops where its contact leaves the rails hold it. */
export function rollStep(ex: ConeExhibit, state: RollState, stepS = STEP_S): void {
  if (state.stopped) return;
  const f = (_t: number, y: readonly number[]) => [y[1], acceleration(ex, y[0], y[1])];
  const y = rk4(f, state.i * stepS, [state.x, state.v], stepS);
  state.i += 1;
  state.x = y[0];
  state.v = y[1];
  const [low, high] = onRailsM(ex);
  if (state.x >= high || state.x <= low) {
    state.x = Math.min(Math.max(state.x, low), high);
    state.v = 0.0;
    state.stopped = true;
  }
}

/** The axis's speed along its path and the cone's spin, for a state. */
export function motionOf(ex: ConeExhibit, x: number, v: number): { speed: number; spin: number } {
  const m = axisSlope(ex);
  const speed = Math.abs(v) * Math.sqrt(1 + m * m);
  return { speed, spin: speed / contactRadiusM(ex, x) / (2 * Math.PI) };
}

export function roll(ex: ConeExhibit, startXM: number, durationS: number, stepS = STEP_S): ConeRun {
  if (!(stepS > 0 && stepS <= 0.01)) throw new RangeError("the step lies between 0 and 10 ms");
  if (!(durationS > 0 && durationS <= MAX_DURATION_S))
    throw new RangeError(`a roll lasts more than nothing and at most ${MAX_DURATION_S} s`);
  const [low, high] = onRailsM(ex);
  if (!(startXM >= low - 1e-12 && startXM <= high + 1e-12))
    throw new RangeError("the cone is laid on the rails, where its contact lies on them");
  const state: RollState = { i: 0, x: startXM, v: 0, stopped: false };
  const steps = roundHalfEven(durationS / stepS);
  const every = sampleEvery(stepS);
  const run: ConeRun = { t: [], x_m: [], axis_m: [], speed_m_s: [], spin_rev_s: [], stopped_at_s: null, final_x_m: 0 };
  for (let i = 0; i <= steps; i++) {
    const t = i * stepS;
    if (i % every === 0 || run.stopped_at_s !== null) {
      const { speed, spin } = motionOf(ex, state.x, state.v);
      run.t.push(t);
      run.x_m.push(state.x);
      run.axis_m.push(axisHeightM(ex, state.x));
      run.speed_m_s.push(speed);
      run.spin_rev_s.push(spin);
    }
    if (run.stopped_at_s !== null || i === steps) break;
    rollStep(ex, state, stepS);
    if (state.stopped) run.stopped_at_s = t + stepS;
  }
  run.final_x_m = run.x_m[run.x_m.length - 1];
  return run;
}

/** Where the cone is laid to roll: the low end, or the high end when its axis
 *  rises along the rails. */
export function startFor(ex: ConeExhibit): number {
  const [low, high] = onRailsM(ex);
  return axisSlope(ex) > 0 ? high : low;
}
