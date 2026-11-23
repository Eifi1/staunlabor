/**
 * The Wilberforce spring, in the browser: a line-for-line port of
 * `backend/staunlabor/domain/experiments/spring.py`, held to it by
 * `simulate.test.ts`.
 *
 * A hand pulls and twists the weight and lets it go, and the energies are
 * drawn as they move between bobbing and twisting, so the four equations are
 * stepped here, a few dozen Runge–Kutta steps a frame; the modes, the beat, the
 * share handed over and where the nuts tune it are asked of this port too: no
 * route. A change to the physics is made in Python first.
 */

import { checkRun, rk4, sampleEvery, STEP_S } from "./numerics";
import { roundHalfEven } from "./python";

export const NUTS = 4;
export const MAX_PULL_M = 0.06;
export const MAX_TWIST_RAD = Math.PI;
export const START_PULL_M = 0.02;
export const START_TWIST_RAD = 1.0;

export type Start = "down" | "twisted" | "fast" | "slow";

/** The engine's `WilberforceSpring`. */
export interface WilberforceSpring {
  mass_kg: number;
  stiffness_n_m: number;
  torsion_n_m: number;
  coupling_n: number;
  body_inertia_kg_m2: number;
  nut_kg: number;
  nut_radius_m: number;
  damping_per_s: number;
}

export function inertiaKgM2(s: WilberforceSpring): number {
  return s.body_inertia_kg_m2 + NUTS * s.nut_kg * s.nut_radius_m ** 2;
}

export function aloneRates(s: WilberforceSpring): [number, number] {
  return [Math.sqrt(s.stiffness_n_m / s.mass_kg), Math.sqrt(s.torsion_n_m / inertiaKgM2(s))];
}

/** The faster first, Berg and Marshall's ω₁ and ω₂. */
export function modeRates(s: WilberforceSpring): [number, number] {
  const [wz, wt] = aloneRates(s);
  const mean = (wz * wz + wt * wt) / 2;
  const split = Math.sqrt(((wt * wt - wz * wz) / 2) ** 2 + s.coupling_n ** 2 / (4 * s.mass_kg * inertiaKgM2(s)));
  return [Math.sqrt(mean + split), Math.sqrt(mean - split)];
}

export function beatS(s: WilberforceSpring): number | null {
  if (s.coupling_n === 0) return null;
  const [w1, w2] = modeRates(s);
  return (2 * Math.PI) / (w1 - w2);
}

export function exchangeShare(s: WilberforceSpring): number {
  const [wz, wt] = aloneRates(s);
  const c2 = s.coupling_n ** 2 / (4 * s.mass_kg * inertiaKgM2(s));
  const both = 4 * c2;
  return both > 0 ? both / ((wz * wz - wt * wt) ** 2 + both) : 0.0;
}

export function tunedRadiusM(s: WilberforceSpring): number | null {
  const wanted = (s.torsion_n_m * s.mass_kg) / s.stiffness_n_m;
  const room = wanted - s.body_inertia_kg_m2;
  if (room < 0 || s.nut_kg === 0) return null;
  return Math.sqrt(room / (NUTS * s.nut_kg));
}

export function rhs(s: WilberforceSpring) {
  const m = s.mass_kg;
  const inertia = inertiaKgM2(s);
  const k = s.stiffness_n_m;
  const delta = s.torsion_n_m;
  const half = s.coupling_n / 2;
  const c = s.damping_per_s;
  return (_t: number, y: readonly number[]): number[] => [
    y[2],
    y[3],
    -(k * y[0] + half * y[1]) / m - c * y[2],
    -(delta * y[1] + half * y[0]) / inertia - c * y[3],
  ];
}

export function checkHold(pullM: number, twistRad: number): void {
  if (!(Math.abs(pullM) <= MAX_PULL_M)) throw new RangeError("the weight is pulled or pushed at most 6 cm");
  if (!(Math.abs(twistRad) <= MAX_TWIST_RAD))
    throw new RangeError("the weight is twisted at most half a turn either way");
}

export function startState(s: WilberforceSpring, start: Start): number[] {
  if (start === "down") return [START_PULL_M, 0.0, 0.0, 0.0];
  if (start === "twisted") return [0.0, START_TWIST_RAD, 0.0, 0.0];
  const [w1, w2] = modeRates(s);
  const w = start === "fast" ? w1 : w2;
  const [, wt] = aloneRates(s);
  if (s.coupling_n === 0) return [0.0, START_TWIST_RAD, 0.0, 0.0];
  const pull = ((2 * inertiaKgM2(s)) / s.coupling_n) * (w * w - wt * wt) * START_TWIST_RAD;
  const scale = pull ? Math.min(1.0, MAX_PULL_M / Math.abs(pull)) : 1.0;
  return [pull * scale, START_TWIST_RAD * scale, 0.0, 0.0];
}

export function energies(s: WilberforceSpring, y: readonly number[]): [number, number, number] {
  const bob = 0.5 * s.mass_kg * y[2] * y[2] + 0.5 * s.stiffness_n_m * y[0] * y[0];
  const twist = 0.5 * inertiaKgM2(s) * y[3] * y[3] + 0.5 * s.torsion_n_m * y[1] * y[1];
  return [bob, twist, 0.5 * s.coupling_n * y[0] * y[1]];
}

/** The engine's `SpringRun`. */
export interface SpringRun {
  t: number[];
  z_m: number[];
  theta_rad: number[];
  bob_j: number[];
  twist_j: number[];
  coupling_j: number[];
}

export function run(
  s: WilberforceSpring,
  pullM: number,
  twistRad: number,
  durationS: number,
  stepS = STEP_S,
): SpringRun {
  checkRun(durationS, stepS);
  checkHold(pullM, twistRad);
  const f = rhs(s);
  let y: number[] = [pullM, twistRad, 0.0, 0.0];
  const steps = roundHalfEven(durationS / stepS);
  const every = sampleEvery(stepS);
  const out: SpringRun = { t: [], z_m: [], theta_rad: [], bob_j: [], twist_j: [], coupling_j: [] };
  for (let i = 0; i <= steps; i++) {
    const t = i * stepS;
    if (i % every === 0) {
      const [bob, twist, coupling] = energies(s, y);
      out.t.push(t);
      out.z_m.push(y[0]);
      out.theta_rad.push(y[1]);
      out.bob_j.push(bob);
      out.twist_j.push(twist);
      out.coupling_j.push(coupling);
    }
    if (i < steps) y = rk4(f, t, y, stepS);
  }
  return out;
}
