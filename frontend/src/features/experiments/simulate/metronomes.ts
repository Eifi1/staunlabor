/**
 * The metronomes, in the browser: a line-for-line port of
 * `backend/staunlabor/domain/experiments/metronomes.py`, held to it by
 * `simulate.test.ts`.
 *
 * The reader starts and stops metronomes by hand and frees or holds the board
 * while they swing, so the equations are stepped here, a few Runge–Kutta steps
 * a frame, and the trick's two runs are this port's too: no route. A change to
 * the physics is made in Python first.
 */

import { G } from "./constants";
import { checkRun, rk4, sampleEvery } from "./numerics";
import { roundHalfEven, TO_DEG, TO_RAD } from "./python";

export const METRONOME_KG = 0.094;
export const BOARD_KG = 0.058;
export const TWO_ON_BOARD_X0_M = 0.00088;
export const PENDULUM_MOMENT_KG_M = TWO_ON_BOARD_X0_M * (BOARD_KG + 2 * METRONOME_KG);
export const TICKS_PER_MIN = 208.0;
export const RATE_PER_S = (2 * Math.PI * TICKS_PER_MIN) / 2 / 60;
export const THETA0_RAD = 0.39;
export const MU = 0.01;
export const STEP_S = 4e-3;
export const MAX_COUNT = 7;
export const SCATTERED_DEG = [0.0, 150.0, 290.0, 70.0, 215.0, 330.0, 105.0] as const;
export const SMALL_DEG = 10.0;
export const OPPOSITE_DEG = 170.0;

export type Start = "scattered" | "opposite" | "together" | "small";

export interface Metronomes {
  count: number;
  board_kg: number;
  spread: number;
  free: boolean;
}

export function detunings(mt: Metronomes): number[] {
  if (mt.count === 1) return [0.0];
  return Array.from({ length: mt.count }, (_, i) => mt.spread * ((2 * i) / (mt.count - 1) - 1));
}

export function movingKg(mt: Metronomes): number {
  return mt.board_kg + mt.count * METRONOME_KG;
}

export function boardScaleM(mt: Metronomes): number {
  return mt.free ? PENDULUM_MOMENT_KG_M / movingKg(mt) : 0.0;
}

export function coupling(mt: Metronomes): number {
  return (boardScaleM(mt) * RATE_PER_S ** 2) / G;
}

export function rhs(mt: Metronomes, running: readonly boolean[]) {
  const n = mt.count;
  if (running.length !== n) throw new RangeError("say for every metronome whether it runs");
  const beta = coupling(mt);
  const tune = detunings(mt).map((d) => 1 + d);
  const on = Array.from({ length: n }, (_, i) => i).filter((i) => running[i]);
  return (_tau: number, y: readonly number[]): number[] => {
    const own = new Array<number>(n).fill(0.0);
    const cos = new Array<number>(n).fill(0.0);
    let top = 0.0;
    let bottom = 1.0;
    for (const i of on) {
      const theta = y[i];
      const rate = y[n + i];
      const c = Math.cos(theta);
      const s = Math.sin(theta);
      const u = theta / THETA0_RAD;
      own[i] = -tune[i] * s - MU * (u * u - 1) * rate;
      cos[i] = c;
      top += c * own[i] - s * rate * rate;
      bottom -= beta * c * c;
    }
    const board = top / bottom;
    const out = new Array<number>(2 * n).fill(0.0);
    for (let i = 0; i < n; i++) if (running[i]) out[i] = y[n + i];
    for (const i of on) out[n + i] = own[i] + beta * cos[i] * board;
    return out;
  };
}

export function startState(start: Start, count: number): number[] {
  if (!(count >= 1 && count <= MAX_COUNT))
    throw new RangeError(`between one and ${MAX_COUNT} metronomes stand on the board`);
  if (start === "small")
    return [...new Array<number>(count).fill(SMALL_DEG * TO_RAD), ...new Array<number>(count).fill(0.0)];
  let phases: number[];
  if (start === "scattered") phases = SCATTERED_DEG.slice(0, count).map((d) => d * TO_RAD);
  else if (start === "opposite") phases = Array.from({ length: count }, (_, i) => OPPOSITE_DEG * TO_RAD * (i % 2));
  else phases = new Array<number>(count).fill(0.0);
  const a = 2 * THETA0_RAD;
  return [...phases.map((p) => a * Math.cos(p)), ...phases.map((p) => -a * Math.sin(p))];
}

export function phase(theta: number, rate: number): number {
  return Math.atan2(-rate, theta);
}

export function order(y: readonly number[], running: readonly boolean[]): [number, number] {
  const n = running.length;
  let re = 0.0;
  let im = 0.0;
  let k = 0;
  for (let i = 0; i < n; i++) {
    if (running[i]) {
      const p = phase(y[i], y[n + i]);
      re += Math.cos(p);
      im += Math.sin(p);
      k += 1;
    }
  }
  if (k === 0) return [0.0, 0.0];
  return [Math.hypot(re, im) / k, Math.atan2(im, re)];
}

export function boardM(mt: Metronomes, y: readonly number[]): number {
  let sum = 0;
  for (let i = 0; i < mt.count; i++) sum += Math.sin(y[i]);
  return -boardScaleM(mt) * sum;
}

/** The engine's `MetronomeRun`. */
export interface MetronomeRun {
  t: number[];
  order: number[];
  board_mm: number[];
  angles_deg: number[][];
}

export function run(mt: Metronomes, start: Start, durationS: number, stepS = STEP_S): MetronomeRun {
  checkRun(durationS, stepS);
  const running = new Array<boolean>(mt.count).fill(true);
  const f = rhs(mt, running);
  let y = startState(start, mt.count);
  const h = stepS * RATE_PER_S;
  const steps = roundHalfEven(durationS / stepS);
  const every = sampleEvery(stepS);
  const out: MetronomeRun = { t: [], order: [], board_mm: [], angles_deg: Array.from({ length: mt.count }, () => []) };
  for (let k = 0; k <= steps; k++) {
    if (k % every === 0) {
      out.t.push(k * stepS);
      out.order.push(order(y, running)[0]);
      out.board_mm.push(boardM(mt, y) * 1000);
      for (let i = 0; i < mt.count; i++) out.angles_deg[i].push(y[i] * TO_DEG);
    }
    if (k < steps) y = rk4(f, k * h, y, h);
  }
  return out;
}

export function inStepS(r: MetronomeRun, level = 0.99): number | null {
  let found: number | null = null;
  r.order.forEach((value, k) => {
    if (value > level) {
      if (found === null) found = r.t[k];
    } else found = null;
  });
  return found;
}

/** The hand lets metronome `i` go from its full swing, at rest: phase 0. */
export function release(y: readonly number[], i: number): number[] {
  const n = y.length / 2;
  const next = [...y];
  next[i] = 2 * THETA0_RAD;
  next[n + i] = 0.0;
  return next;
}

/** The hand stops metronome `i` and holds it upright. */
export function hold(y: readonly number[], i: number): number[] {
  const n = y.length / 2;
  const next = [...y];
  next[i] = 0.0;
  next[n + i] = 0.0;
  return next;
}
