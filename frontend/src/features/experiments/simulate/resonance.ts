/**
 * Resonance, in the browser: a line-for-line port of
 * `backend/staunlabor/domain/experiments/resonance.py` — each rod's first
 * cantilever mode driven by the trembling table — held to it by
 * `simulate.test.ts`.
 *
 * The page shakes the rods as the reader turns the beat, so there is no route.
 * The engine's `run` is not ported: the page steps the rack itself, and the
 * test samples it the engine's way. A change to the physics is made in Python
 * first.
 */

import { G } from "./constants";

/** β₁: the first root of cosh β·cos β + 1, by bisection. */
function firstRoot(): number {
  let lo = 1.5;
  let hi = 2.2;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if ((Math.cosh(lo) * Math.cos(lo) + 1) * (Math.cosh(mid) * Math.cos(mid) + 1) <= 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

export const BETA1 = firstRoot();
const SIGMA = (Math.cosh(BETA1) + Math.cos(BETA1)) / (Math.sinh(BETA1) + Math.sin(BETA1));

function rawShape(xi: number): number {
  const b = BETA1 * xi;
  return Math.cosh(b) - Math.cos(b) - SIGMA * (Math.sinh(b) - Math.sin(b));
}

const TIP = rawShape(1.0);

/** The first mode's deflection at `xi = x/L` from the clamp, 1 at the tip. */
export const shape = (xi: number) => rawShape(xi) / TIP;

/** Γ = ∫φ / ∫φ², by Simpson's rule over 400 strips. */
function participation(): number {
  const n = 400;
  let over = 0.0;
  let squared = 0.0;
  for (let i = 0; i <= n; i++) {
    const w = i === 0 || i === n ? 1 : i % 2 ? 4 : 2;
    const p = shape(i / n);
    over += w * p;
    squared += w * p * p;
  }
  return over / squared;
}

export const GAMMA = participation();

/** dφ/dξ: the first mode's slope. */
function slope(xi: number): number {
  const b = BETA1 * xi;
  return (BETA1 * (Math.sinh(b) + Math.sin(b) - SIGMA * (Math.cosh(b) - Math.cos(b)))) / TIP;
}

/** Λ = ∫(1 − ξ)·φ'² / ∫φ², by Simpson's rule over 400 strips: what the rod's own weight takes from ω², in g/L. */
function softening(): number {
  const n = 400;
  let over = 0.0;
  let squared = 0.0;
  for (let i = 0; i <= n; i++) {
    const w = i === 0 || i === n ? 1 : i % 2 ? 4 : 2;
    const xi = i / n;
    over += w * (1 - xi) * slope(xi) ** 2;
    squared += w * shape(xi) ** 2;
  }
  return over / squared;
}

export const LAMBDA = softening();
export const STEP_S = 1e-3;

/** The engine's `Rack`. */
export interface Rack {
  lengths_m: number[];
  diameter_m: number;
  youngs_gpa: number;
  density_kg_m3: number;
  damping_ratio: number;
  table_m: number;
}

/** f₁ of a round rod standing upright: the bending's ω², E·I/(ρ·A) = E·d²/(16·ρ), less its own weight's Λ·g/L. */
export function naturalHz(rack: Rack, lengthM: number): number {
  const wave = (Math.sqrt((rack.youngs_gpa * 1e9) / rack.density_kg_m3) * rack.diameter_m) / 4;
  const squared = ((BETA1 ** 2 / lengthM ** 2) * wave) ** 2 - (LAMBDA * G) / lengthM;
  return Math.sqrt(squared) / (2 * Math.PI);
}

/** The tip's steady swing against the table, each way. */
export function steadyM(rack: Rack, lengthM: number, driveHz: number): number {
  const r = driveHz / naturalHz(rack, lengthM);
  return (GAMMA * r * r * rack.table_m) / Math.sqrt((1 - r * r) ** 2 + (2 * rack.damping_ratio * r) ** 2);
}

/** The engine's `Shaking`. */
export interface Shaking {
  t: number;
  theta: number;
  q: number[];
  v: number[];
}

export function start(rack: Rack): Shaking {
  const n = rack.lengths_m.length;
  return { t: 0.0, theta: 0.0, q: new Array(n).fill(0.0), v: new Array(n).fill(0.0) };
}

function rates(
  rack: Rack,
  omegas: number[],
  drive: number,
  theta: number,
  q: number[],
  v: number[],
): [number, number[], number[]] {
  const push = GAMMA * drive * drive * rack.table_m * Math.sin(theta);
  const z = rack.damping_ratio;
  const acc = omegas.map((w, i) => push - 2 * z * w * v[i] - w * w * q[i]);
  return [drive, v, acc];
}

/** One millisecond, the drive held at `driveHz`. */
export function step(rack: Rack, s: Shaking, driveHz: number): Shaking {
  const omegas = rack.lengths_m.map((length) => 2 * Math.PI * naturalHz(rack, length));
  const drive = 2 * Math.PI * driveHz;
  const h = STEP_S;
  const q0 = s.q;
  const v0 = s.v;
  const [d1, q1, a1] = rates(rack, omegas, drive, s.theta, q0, v0);
  const [d2, q2, a2] = rates(
    rack,
    omegas,
    drive,
    s.theta + (h / 2) * d1,
    q0.map((q, i) => q + (h / 2) * q1[i]),
    v0.map((v, i) => v + (h / 2) * a1[i]),
  );
  const [d3, q3, a3] = rates(
    rack,
    omegas,
    drive,
    s.theta + (h / 2) * d2,
    q0.map((q, i) => q + (h / 2) * q2[i]),
    v0.map((v, i) => v + (h / 2) * a2[i]),
  );
  const [d4, q4, a4] = rates(
    rack,
    omegas,
    drive,
    s.theta + h * d3,
    q0.map((q, i) => q + h * q3[i]),
    v0.map((v, i) => v + h * a3[i]),
  );
  return {
    t: s.t + h,
    theta: s.theta + (h / 6) * (d1 + 2 * d2 + 2 * d3 + d4),
    q: q0.map((q, i) => q + (h / 6) * (q1[i] + 2 * q2[i] + 2 * q3[i] + q4[i])),
    v: v0.map((v, i) => v + (h / 6) * (a1[i] + 2 * a2[i] + 2 * a3[i] + a4[i])),
  };
}

/** The width of a rod's swing now: its tip's place and speed taken together at
 *  the drive's frequency, which a steady swing keeps exactly. */
export function swingM(s: Shaking, rod: number, driveHz: number): number {
  return Math.hypot(s.q[rod], s.v[rod] / (2 * Math.PI * driveHz));
}
