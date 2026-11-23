/**
 * The floating top, in the browser: a line-for-line port of
 * `backend/staunlabor/domain/experiments/levitation.py` — the ring's field on its
 * axis, the window where a spinning top hovers, its balance and how it moves
 * there — held to it by `simulate.test.ts`.
 *
 * The page finds the balance as the reader tunes the top's weight and the
 * room's warmth, so there is no route. A change to the physics is made in
 * Python first.
 */

import { G } from "./constants";

const MU0 = 4e-7 * Math.PI;
const FERRITE_PER_K = -0.002;
const SCAN_STEP_M = 1e-3;
const SCAN_TO_M = 0.3;
const BISECTIONS = 60;

export type State = "hovers" | "lands" | "slides";

/** The engine's `Base`: the ring magnet, its top face at `z = 0`. */
export interface Base {
  inner_radius_m: number;
  outer_radius_m: number;
  height_m: number;
  magnetisation_a_m: number;
}

/** The engine's `Top`. */
export interface Top {
  moment_a_m2: number;
  mass_kg: number;
}

function solenoid(u: number, a: number): [number, number, number] {
  const s = u * u + a * a;
  return [u / Math.sqrt(s), (a * a) / s ** 1.5, (-3 * a * a * u) / s ** 2.5];
}

/** `(B, B′, B″)` on the ring's axis at `zM` over its top face. */
export function axisField(base: Base, zM: number): [number, number, number] {
  const out: [number, number, number] = [0.0, 0.0, 0.0];
  for (const [radius, sign] of [
    [base.outer_radius_m, 1.0],
    [base.inner_radius_m, -1.0],
  ] as const) {
    if (radius === 0) continue;
    const lower = solenoid(zM + base.height_m, radius);
    const upper = solenoid(zM, radius);
    for (let k = 0; k < 3; k++) out[k] += ((sign * MU0 * base.magnetisation_a_m) / 2) * (lower[k] - upper[k]);
  }
  return out;
}

/** Would a top whose balance is at `zM` stay there. */
export function holds(base: Base, zM: number): boolean {
  const [b, b1, b2] = axisField(base, zM);
  return b > 0 && b1 < 0 && b2 > 0 && b1 * b1 > 2 * b * b2;
}

function edge(base: Base, outside: number, inside: number): number {
  for (let i = 0; i < BISECTIONS; i++) {
    const mid = (outside + inside) / 2;
    if (holds(base, mid)) inside = mid;
    else outside = mid;
  }
  return (outside + inside) / 2;
}

/** The window's foot and head over the ring's face. */
export function window(base: Base): [number, number] {
  const steps = Math.round(SCAN_TO_M / SCAN_STEP_M);
  let foot: number | null = null;
  for (let i = 1; i <= steps; i++) {
    const z = i * SCAN_STEP_M;
    const inside = holds(base, z);
    if (foot === null && inside) foot = edge(base, z - SCAN_STEP_M, z);
    else if (foot !== null && !inside) return [foot, edge(base, z, z - SCAN_STEP_M)];
  }
  throw new RangeError("this ring holds no top within 30 cm over it");
}

const scale = (warmingK: number) => (1 + FERRITE_PER_K * warmingK) ** 2;

/** The lift at `zM`, as the mass it carries. */
export function liftKg(base: Base, top: Top, zM: number, warmingK = 0.0): number {
  return (-top.moment_a_m2 * scale(warmingK) * axisField(base, zM)[1]) / G;
}

/** The engine's `Hover`. */
export interface Hover {
  state: State;
  height_m: number | null;
  foot_m: number;
  head_m: number;
  lightest_kg: number;
  heaviest_kg: number;
  bob_hz: number | null;
  drift_hz: number | null;
}

/** Where `top` floats over `base` after warming both by `warmingK`. */
export function hover(base: Base, top: Top, warmingK = 0.0): Hover {
  const [foot, head] = window(base);
  const heaviest = liftKg(base, top, foot, warmingK);
  const lightest = liftKg(base, top, head, warmingK);
  const at = { foot_m: foot, head_m: head, lightest_kg: lightest, heaviest_kg: heaviest };
  if (top.mass_kg > heaviest) return { state: "lands", height_m: null, ...at, bob_hz: null, drift_hz: null };
  let lo = foot;
  let hi = SCAN_TO_M;
  for (let i = 0; i < BISECTIONS; i++) {
    const mid = (lo + hi) / 2;
    if (liftKg(base, top, mid, warmingK) > top.mass_kg) lo = mid;
    else hi = mid;
  }
  const z = (lo + hi) / 2;
  if (z > head) return { state: "slides", height_m: z, ...at, bob_hz: null, drift_hz: null };
  const [b, b1, b2] = axisField(base, z);
  const mu = top.moment_a_m2 * scale(warmingK);
  const bob = Math.sqrt((mu * b2) / top.mass_kg) / (2 * Math.PI);
  const drift = Math.sqrt((mu * ((b1 * b1) / (4 * b) - b2 / 2)) / top.mass_kg) / (2 * Math.PI);
  return { state: "hovers", height_m: z, ...at, bob_hz: bob, drift_hz: drift };
}
