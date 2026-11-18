/**
 * The chaotic waterwheel, in the browser: a line-for-line port of
 * `backend/staunlabor/domain/experiments/waterwheel.py` — Lorenz's equations
 * with b = 1, which are Malkus's wheel — held to it by `simulate.test.ts`.
 *
 * The page turns the tap as the reader watches and the wheel answers frame by
 * frame, so there is no route. A change to the physics is made in Python first.
 */

import { MAX_DURATION_S, rk4, type Rhs } from "./pendulum";
import { roundHalfEven } from "./sphere";

/** The wheel's b: one, for Malkus's wheel. */
export const B = 1.0;
/** The step, in τ. */
export const STEP_TAU = 0.01;
/** Samples a run returns per unit of τ. */
export const SAMPLES_PER_TAU = 20;
/** The nudge the wheel starts with. */
export const NUDGE = 1e-3;

export interface WaterWheel {
  sigma: number;
  rho: number;
  leak_per_s: number;
}

export function rhs(w: WaterWheel): Rhs {
  const s = w.sigma;
  const r = w.rho;
  return (_t, y) => [s * (y[1] - y[0]), y[0] * (r - y[2]) - y[1], y[0] * y[1] - B * y[2]];
}

export function hopfRho(w: WaterWheel): number {
  return (w.sigma * (w.sigma + B + 3)) / (w.sigma - B - 1);
}

export function steadyX(w: WaterWheel): number | null {
  return w.rho > 1 ? Math.sqrt(B * (w.rho - 1)) : null;
}

export function regime(w: WaterWheel): "still" | "steady" | "chaotic" {
  if (w.rho <= 1) return "still";
  return w.rho < hopfRho(w) ? "steady" : "chaotic";
}

export function cupLevel(w: WaterWheel, y: number, z: number, theta: number): number {
  const scale = Math.max(w.rho, 1.0);
  const level = 0.5 + (0.45 * (y * Math.sin(theta) + (w.rho - z) * Math.cos(theta))) / scale;
  return Math.min(1.0, Math.max(0.0, level));
}

/** Where the wheel's run stands, for a page stepping it frame by frame. */
export interface WheelState {
  i: number;
  y: number[];
  angle: number;
}

export function startWheel(): WheelState {
  return { i: 0, y: [NUDGE, 0.0, 0.0], angle: 0.0 };
}

/** One step of `stepTau`, in place: the state and the angle by the trapezoid rule. */
export function stepWheel(w: WaterWheel, state: WheelState, stepTau = STEP_TAU): void {
  const next = rk4(rhs(w), state.i * stepTau, state.y, stepTau);
  state.angle += 0.5 * (state.y[0] + next[0]) * stepTau;
  state.y = next;
  state.i += 1;
}

/** The engine's `WheelTurns`. */
export interface WheelTurns {
  t: number[];
  x: number[];
  y: number[];
  z: number[];
  rate_rad_s: number[];
  turns: number[];
  reversals_s: number[];
}

export function run(w: WaterWheel, durationS: number, stepTau = STEP_TAU): WheelTurns {
  if (!(stepTau > 0 && stepTau <= 0.05)) throw new RangeError("the step lies between 0 and 0.05 τ");
  if (!(durationS > 0 && durationS <= MAX_DURATION_S))
    throw new RangeError(`a run lasts more than nothing and at most ${MAX_DURATION_S} s`);
  const k = w.leak_per_s;
  const f = rhs(w);
  let y = [NUDGE, 0.0, 0.0];
  const steps = roundHalfEven((durationS * k) / stepTau);
  const every = Math.max(1, roundHalfEven(1 / (SAMPLES_PER_TAU * stepTau)));
  let angle = 0.0;
  const out: WheelTurns = { t: [], x: [], y: [], z: [], rate_rad_s: [], turns: [], reversals_s: [] };
  for (let i = 0; i <= steps; i++) {
    const tau = i * stepTau;
    if (i % every === 0) {
      out.t.push(tau / k);
      out.x.push(y[0]);
      out.y.push(y[1]);
      out.z.push(y[2]);
      out.rate_rad_s.push(k * y[0]);
      out.turns.push(angle / (2 * Math.PI));
    }
    if (i < steps) {
      const next = rk4(f, tau, y, stepTau);
      angle += 0.5 * (y[0] + next[0]) * stepTau;
      if ((y[0] > 0 && 0 > next[0]) || (y[0] < 0 && 0 < next[0]))
        out.reversals_s.push((tau + (stepTau * y[0]) / (y[0] - next[0])) / k);
      y = next;
    }
  }
  return out;
}

/** The share of a run, at its end, that `behaviour` reads. */
const LATE_SHARE = 1 / 3;
/** Gaps between reversals that agree to this share of a gap repeat. */
const REPEAT_TOL = 0.02;
/** The longest repeating pattern looked for, in gaps between reversals. */
const LONGEST_PATTERN = 4;

export type Behaviour = "still" | "steady" | "pattern" | "chaotic" | "starting";

/** The engine's `behaviour`: what the wheel does in a run from rest, read
 *  from its last third. */
export function behaviour(w: WaterWheel, turns: WheelTurns): Behaviour {
  if (regime(w) === "still") return "still";
  const end = turns.t[turns.t.length - 1];
  const late = turns.reversals_s.filter((r) => r > end * (1 - LATE_SHARE));
  if (late.length === 0) {
    const steady = steadyX(w) ?? 0.0;
    return Math.abs(Math.abs(turns.x[turns.x.length - 1]) - steady) <= 0.1 * steady ? "steady" : "starting";
  }
  if (late.length < 4) return "starting";
  const gaps = late.slice(1).map((r, i) => r - late[i]);
  for (let p = 1; p <= LONGEST_PATTERN; p++) {
    if (gaps.length < 2 * p + 1) continue;
    let repeats = true;
    for (let i = 0; i + p < gaps.length; i++) {
      if (Math.abs(gaps[i] - gaps[i + p]) > REPEAT_TOL * gaps[i]) {
        repeats = false;
        break;
      }
    }
    if (repeats) return "pattern";
  }
  return "chaotic";
}
