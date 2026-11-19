/**
 * The chaotic pendulum, in the browser: a line-for-line port of
 * `backend/staunlabor/domain/experiments/chaos.py` — Lagrange's equations of a
 * double pendulum, its energy, the gap between two of them, the two modes and
 * the Lyapunov exponent measured Benettin's way — held to it by
 * `simulate.test.ts`.
 *
 * The page swings the pendulum and its nudged twin frame by frame and measures
 * the exponent for the start on screen, so there is no route. A change to the
 * physics is made in Python first.
 */

import { MAX_DURATION_S, STEP_S, G, rk4, sampleEvery, type Rhs } from "./pendulum";
import { roundHalfEven } from "./sphere";

export interface DoublePendulum {
  length1_m: number;
  length2_m: number;
  mass1_kg: number;
  mass2_kg: number;
  damping_per_s: number;
}

const TO_RAD = Math.PI / 180.0;
const TO_DEG = 180.0 / Math.PI;

export function rhs(dp: DoublePendulum): Rhs {
  const { length1_m: l1, length2_m: l2, mass1_kg: m1, mass2_kg: m2, damping_per_s: c } = dp;
  return (_t, y) => {
    const [t1, t2, w1, w2] = y;
    const d = t1 - t2;
    const den = 2 * m1 + m2 - m2 * Math.cos(2 * d);
    const a1 =
      (-G * (2 * m1 + m2) * Math.sin(t1) -
        m2 * G * Math.sin(t1 - 2 * t2) -
        2 * Math.sin(d) * m2 * (w2 * w2 * l2 + w1 * w1 * l1 * Math.cos(d))) /
      (l1 * den);
    const a2 =
      (2 * Math.sin(d) * (w1 * w1 * l1 * (m1 + m2) + G * (m1 + m2) * Math.cos(t1) + w2 * w2 * l2 * m2 * Math.cos(d))) /
      (l2 * den);
    return [w1, w2, a1 - c * w1, a2 - c * w2];
  };
}

export function energy(dp: DoublePendulum, y: readonly number[]): number {
  const { length1_m: l1, length2_m: l2, mass1_kg: m1, mass2_kg: m2 } = dp;
  const [t1, t2, w1, w2] = y;
  const kinetic =
    0.5 * (m1 + m2) * (l1 * w1) ** 2 + 0.5 * m2 * (l2 * w2) ** 2 + m2 * l1 * l2 * w1 * w2 * Math.cos(t1 - t2);
  const potential = -(m1 + m2) * G * l1 * Math.cos(t1) - m2 * G * l2 * Math.cos(t2);
  return kinetic + potential;
}

export function separation(dp: DoublePendulum, a: readonly number[], b: readonly number[]): number {
  const scale = Math.sqrt(G / dp.length1_m);
  return Math.sqrt(
    (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + ((a[2] - b[2]) / scale) ** 2 + ((a[3] - b[3]) / scale) ** 2,
  );
}

export function modeRates(dp: DoublePendulum): [number, number] {
  const { length1_m: l1, length2_m: l2, mass1_kg: m1, mass2_kg: m2 } = dp;
  const a = m1 * l1 * l2;
  const b = -(m1 + m2) * G * (l1 + l2);
  const c = (m1 + m2) * G * G;
  const root = Math.sqrt(b * b - 4 * a * c);
  return [Math.sqrt((-b - root) / (2 * a)), Math.sqrt((-b + root) / (2 * a))];
}

export function startState(start1Deg: number, start2Deg: number): number[] {
  if (!(start1Deg >= -180 && start1Deg <= 180 && start2Deg >= -180 && start2Deg <= 180))
    throw new RangeError("the arms start between −180° and 180°");
  return [start1Deg * TO_RAD, start2Deg * TO_RAD, 0.0, 0.0];
}

/** The engine's `TURN_PER_STEP`: the most an arm may turn in one step, radians. */
const TURN_PER_STEP = 0.035;

/** The engine's `fastest_rate`: a bound on how fast either arm can turn from this start, rad/s. */
export function fastestRate(dp: DoublePendulum, start1Deg: number, start2Deg: number): number {
  const [m1, m2, l1, l2] = [dp.mass1_kg, dp.mass2_kg, dp.length1_m, dp.length2_m];
  const lowest = -(m1 + m2) * G * l1 - m2 * G * l2;
  const moving = energy(dp, startState(start1Deg, start2Deg)) - lowest;
  const [a, d, b] = [(m1 + m2) * l1 * l1, m2 * l2 * l2, m2 * l1 * l2];
  const least = (a + d) / 2 - Math.sqrt(((a - d) / 2) ** 2 + b * b);
  return Math.sqrt((2 * moving) / least);
}

/** The engine's `step_for`: 1 ms, in as many equal parts as keep each arm's turn in a step within `TURN_PER_STEP`. */
export function stepFor(dp: DoublePendulum, start1Deg: number, start2Deg: number): number {
  const parts = Math.max(1, Math.ceil((fastestRate(dp, start1Deg, start2Deg) * STEP_S) / TURN_PER_STEP));
  return STEP_S / parts;
}

/** The twin of a start: its upper arm nudged. */
export function twinOf(start: readonly number[], nudgeDeg: number): number[] {
  return [start[0] + nudgeDeg * TO_RAD, start[1], 0.0, 0.0];
}

export function lyapunov(
  dp: DoublePendulum,
  start1Deg: number,
  start2Deg: number,
  durationS = 60.0,
  gap = 1e-8,
  everyS = 0.1,
  step?: number,
): number {
  if (!(durationS > 0 && durationS <= MAX_DURATION_S))
    throw new RangeError(`a measurement lasts more than nothing and at most ${MAX_DURATION_S} s`);
  const stepS = step ?? stepFor(dp, start1Deg, start2Deg);
  const f = rhs(dp);
  let a = startState(start1Deg, start2Deg);
  let b = [a[0] + gap, a[1], a[2], a[3]];
  const per = Math.max(1, roundHalfEven(everyS / stepS));
  let total = 0.0;
  const steps = roundHalfEven(durationS / stepS);
  for (let i = 0; i < steps; i++) {
    const t = i * stepS;
    a = rk4(f, t, a, stepS);
    b = rk4(f, t, b, stepS);
    if ((i + 1) % per === 0) {
      const d = separation(dp, a, b);
      total += Math.log(d / gap);
      const from = a;
      b = b.map((v, k) => from[k] + ((v - from[k]) * gap) / d);
    }
  }
  return total / (steps * stepS);
}

/** The engine's `ChaosRun`. */
export interface ChaosRun {
  t: number[];
  theta1_deg: number[];
  theta2_deg: number[];
  twin1_deg: number[];
  twin2_deg: number[];
  separation: number[];
  energy_drift: number;
}

export function run(
  dp: DoublePendulum,
  start1Deg: number,
  start2Deg: number,
  durationS: number,
  nudgeDeg = 0.001,
  step?: number,
): ChaosRun {
  const stepS = step ?? stepFor(dp, start1Deg, start2Deg);
  if (!(stepS > 0 && stepS <= 0.01)) throw new RangeError("the step lies between 0 and 10 ms");
  if (!(durationS > 0 && durationS <= MAX_DURATION_S))
    throw new RangeError(`a run lasts more than nothing and at most ${MAX_DURATION_S} s`);
  if (!(Math.abs(nudgeDeg) > 0 && Math.abs(nudgeDeg) <= 10))
    throw new RangeError("the nudge is more than nothing and at most 10°");
  const f = rhs(dp);
  let a = startState(start1Deg, start2Deg);
  let b = twinOf(a, nudgeDeg);
  const e0 = energy(dp, a);
  const scale = Math.max(Math.abs(e0), (dp.mass1_kg + dp.mass2_kg) * G * (dp.length1_m + dp.length2_m));
  let drift = 0.0;
  const steps = roundHalfEven(durationS / stepS);
  const every = sampleEvery(stepS);
  const out: ChaosRun = {
    t: [],
    theta1_deg: [],
    theta2_deg: [],
    twin1_deg: [],
    twin2_deg: [],
    separation: [],
    energy_drift: 0,
  };
  for (let i = 0; i <= steps; i++) {
    const t = i * stepS;
    if (i % every === 0) {
      out.t.push(t);
      out.theta1_deg.push(a[0] * TO_DEG);
      out.theta2_deg.push(a[1] * TO_DEG);
      out.twin1_deg.push(b[0] * TO_DEG);
      out.twin2_deg.push(b[1] * TO_DEG);
      out.separation.push(separation(dp, a, b));
      drift = Math.max(drift, Math.abs(energy(dp, a) - e0) / scale);
    }
    if (i < steps) {
      a = rk4(f, t, a, stepS);
      b = rk4(f, t, b, stepS);
    }
  }
  out.energy_drift = drift;
  return out;
}
