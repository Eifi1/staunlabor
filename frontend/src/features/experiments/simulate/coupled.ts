/**
 * The coupled pendulums, in the browser: a line-for-line port of
 * `backend/staunlabor/domain/experiments/coupled.py`, held to it by
 * `simulate.test.ts`.
 *
 * The pair swings as the reader watches and the energies are drawn as they
 * wander, so the four equations are stepped here, a few dozen Runge–Kutta
 * steps a frame, and the modes, the beat and the share handed over are asked
 * of this port too: no route. A change to the physics is made in Python first.
 */

import { G } from "./constants";
import { checkRun, rk4, sampleEvery, STEP_S } from "./numerics";
import { roundHalfEven, TO_DEG, TO_RAD } from "./python";

export type Start = "one" | "together" | "against";

export interface Bob {
  length_m: number;
  mass_kg: number;
}

export interface CoupledPendulums {
  left: Bob;
  right: Bob;
  spring_n_m: number;
  spring_at_m: number;
  damping_per_s: number;
}

function couplings(cp: CoupledPendulums): [number, number] {
  const ka2 = cp.spring_n_m * cp.spring_at_m ** 2;
  return [ka2 / (cp.left.mass_kg * cp.left.length_m ** 2), ka2 / (cp.right.mass_kg * cp.right.length_m ** 2)];
}

function diagonal(cp: CoupledPendulums): [number, number] {
  const [k1, k2] = couplings(cp);
  return [G / cp.left.length_m + k1, G / cp.right.length_m + k2];
}

export function modeRates(cp: CoupledPendulums): [number, number] {
  const [a1, a2] = diagonal(cp);
  const [k1, k2] = couplings(cp);
  const mean = (a1 + a2) / 2;
  const split = Math.sqrt(((a1 - a2) / 2) ** 2 + k1 * k2);
  return [Math.sqrt(mean - split), Math.sqrt(mean + split)];
}

export function beatS(cp: CoupledPendulums): number | null {
  const [w1, w2] = modeRates(cp);
  return w2 > w1 ? (2 * Math.PI) / (w2 - w1) : null;
}

export function exchangeShare(cp: CoupledPendulums): number {
  const [a1, a2] = diagonal(cp);
  const [k1, k2] = couplings(cp);
  const both = 4 * k1 * k2;
  return both > 0 ? both / ((a1 - a2) ** 2 + both) : 0.0;
}

export function rhs(cp: CoupledPendulums) {
  const g1 = G / cp.left.length_m;
  const g2 = G / cp.right.length_m;
  const [k1, k2] = couplings(cp);
  const c = cp.damping_per_s;
  return (_t: number, y: readonly number[]): number[] => {
    const s1 = Math.sin(y[0]);
    const s2 = Math.sin(y[1]);
    const stretch = s2 - s1;
    return [
      y[2],
      y[3],
      -g1 * s1 + k1 * stretch * Math.cos(y[0]) - c * y[2],
      -g2 * s2 - k2 * stretch * Math.cos(y[1]) - c * y[3],
    ];
  };
}

export function startState(start: Start, amplitudeDeg: number): number[] {
  if (!(amplitudeDeg > 0 && amplitudeDeg <= 60))
    throw new RangeError("the pendulums are pulled aside by more than nothing and at most 60°");
  const a = amplitudeDeg * TO_RAD;
  if (start === "one") return [a, 0.0, 0.0, 0.0];
  if (start === "together") return [a, a, 0.0, 0.0];
  return [a, -a, 0.0, 0.0];
}

export function energies(cp: CoupledPendulums, y: readonly number[]): [number, number, number] {
  const { left, right } = cp;
  const e1 = 0.5 * left.mass_kg * (left.length_m * y[2]) ** 2 + left.mass_kg * G * left.length_m * (1 - Math.cos(y[0]));
  const e2 =
    0.5 * right.mass_kg * (right.length_m * y[3]) ** 2 + right.mass_kg * G * right.length_m * (1 - Math.cos(y[1]));
  const stretch = cp.spring_at_m * (Math.sin(y[1]) - Math.sin(y[0]));
  return [e1, e2, 0.5 * cp.spring_n_m * stretch * stretch];
}

/** The engine's `CoupledRun`. */
export interface CoupledRun {
  t: number[];
  left_deg: number[];
  right_deg: number[];
  left_j: number[];
  right_j: number[];
  spring_j: number[];
}

export function swing(
  cp: CoupledPendulums,
  start: Start,
  amplitudeDeg: number,
  durationS: number,
  stepS = STEP_S,
): CoupledRun {
  checkRun(durationS, stepS);
  const f = rhs(cp);
  let y = startState(start, amplitudeDeg);
  const steps = roundHalfEven(durationS / stepS);
  const every = sampleEvery(stepS);
  const run: CoupledRun = { t: [], left_deg: [], right_deg: [], left_j: [], right_j: [], spring_j: [] };
  for (let i = 0; i <= steps; i++) {
    const t = i * stepS;
    if (i % every === 0) {
      const [e1, e2, es] = energies(cp, y);
      run.t.push(t);
      run.left_deg.push(y[0] * TO_DEG);
      run.right_deg.push(y[1] * TO_DEG);
      run.left_j.push(e1);
      run.right_j.push(e2);
      run.spring_j.push(es);
    }
    if (i < steps) y = rk4(f, t, y, stepS);
  }
  return run;
}
