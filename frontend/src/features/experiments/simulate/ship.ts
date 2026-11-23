/**
 * The ship that rights itself, in the browser: a line-for-line port of
 * `backend/staunlabor/domain/experiments/ship.py` — the section, the exact
 * waterline, the centre of buoyancy, the righting arm, the roll's step and the
 * figures — held to it by `simulate.test.ts`.
 *
 * Why here: the reader's hand tilts the hull and moves the weight, and the
 * hull must answer every frame. There is no route; a change to the physics is
 * made in Python first.
 */

import { G } from "./constants";
import { rk4 } from "./numerics";
import { radians } from "./python";

const WATER_DENSITY = 998.0;
/** The step the roll is integrated with, s. */
export const STEP_S = 0.002;
/** How far the weight goes: down the keel and up the mast, m. */
export const KEEL_M = -0.15;
export const MAST_M = 0.4;
const CURVE_SAMPLES = 360;
const HALVINGS = 50;

/** The engine's `Hull`. */
export interface Hull {
  beam_m: number;
  depth_m: number;
  length_m: number;
  mass_kg: number;
  centre_m: number;
  gyration_m: number;
}

/** The engine's `Weight`. */
export interface Weight {
  mass_kg: number;
  height_m: number;
}

export type Point = [number, number];

/** The hull's cross-section `(y, z)`, counter-clockwise, `K` at the origin. */
export function section(hull: Hull): Point[] {
  const half = hull.beam_m / 2;
  return [
    [-half, 0.0],
    [half, 0.0],
    [half, hull.depth_m],
    [-half, hull.depth_m],
  ];
}

export const massKg = (hull: Hull, weight: Weight) => hull.mass_kg + weight.mass_kg;

export const displacedM2 = (hull: Hull, weight: Weight) => massKg(hull, weight) / (WATER_DENSITY * hull.length_m);

/** `KG`, above the bottom. */
export const gravityM = (hull: Hull, weight: Weight) =>
  (hull.mass_kg * hull.centre_m + weight.mass_kg * weight.height_m) / massKg(hull, weight);

export function inertiaKgM2(hull: Hull, weight: Weight): number {
  const kg = gravityM(hull, weight);
  return (
    hull.mass_kg * hull.gyration_m ** 2 +
    hull.mass_kg * (hull.centre_m - kg) ** 2 +
    weight.mass_kg * (weight.height_m - kg) ** 2
  );
}

function area(polygon: readonly Point[]): number {
  const n = polygon.length;
  let twice = 0.0;
  for (let i = 0; i < n; i++) {
    twice += polygon[i][0] * polygon[(i + 1) % n][1] - polygon[(i + 1) % n][0] * polygon[i][1];
  }
  return twice / 2;
}

/** Whether the hull floats: its displacement fits in it. */
export const floats = (hull: Hull, weight: Weight) => displacedM2(hull, weight) < area(section(hull));

function centroid(polygon: readonly Point[]): Point {
  const n = polygon.length;
  let a = 0.0;
  let cy = 0.0;
  let cz = 0.0;
  for (let i = 0; i < n; i++) {
    const [y0, z0] = polygon[i];
    const [y1, z1] = polygon[(i + 1) % n];
    const cross = y0 * z1 - y1 * z0;
    a += cross;
    cy += (y0 + y1) * cross;
    cz += (z0 + z1) * cross;
  }
  return [cy / (3 * a), cz / (3 * a)];
}

const level = (p: Point, sinPhi: number, cosPhi: number) => -p[0] * sinPhi + p[1] * cosPhi;

function chord(polygon: readonly Point[], height: number, sinPhi: number, cosPhi: number): number {
  const ends: Point[] = [];
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const p = polygon[i];
    const q = polygon[(i + 1) % n];
    const hp = level(p, sinPhi, cosPhi);
    const hq = level(q, sinPhi, cosPhi);
    if ((hp - height) * (hq - height) < 0) {
      const s = (height - hp) / (hq - hp);
      ends.push([p[0] + s * (q[0] - p[0]), p[1] + s * (q[1] - p[1])]);
    }
  }
  const dy = ends[1][0] - ends[0][0];
  const dz = ends[1][1] - ends[0][1];
  return Math.sqrt(dy * dy + dz * dz);
}

function cornerHeights(polygon: readonly Point[], sinPhi: number, cosPhi: number): number[] {
  const raw = polygon.map((p) => level(p, sinPhi, cosPhi)).sort((a, b) => a - b);
  const apart = 1e-12 * (raw[raw.length - 1] - raw[0]);
  const heights = [raw[0]];
  for (const h of raw.slice(1)) if (h - heights[heights.length - 1] > apart) heights.push(h);
  heights[heights.length - 1] = raw[raw.length - 1];
  return heights;
}

/** The level of the waterline that leaves `areaM2` of the heeled section under water. */
export function waterline(polygon: readonly Point[], areaM2: number, phi: number): number {
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const heights = cornerHeights(polygon, sinPhi, cosPhi);
  let below = 0.0;
  for (let k = 0; k + 1 < heights.length; k++) {
    const lo = heights[k];
    const span = heights[k + 1] - lo;
    const w1 = chord(polygon, lo + span / 4, sinPhi, cosPhi);
    const w3 = chord(polygon, lo + (3 * span) / 4, sinPhi, cosPhi);
    const slope = (w3 - w1) / (span / 2);
    const wLo = w1 - (slope * span) / 4;
    const piece = ((w1 + w3) / 2) * span;
    if (below + piece >= areaM2) {
      const need = areaM2 - below;
      return lo + (2 * need) / (wLo + Math.sqrt(Math.max(0.0, wLo * wLo + 2 * slope * need)));
    }
    below += piece;
  }
  return heights[heights.length - 1];
}

function clipped(polygon: readonly Point[], at: number, sinPhi: number, cosPhi: number): Point[] {
  const out: Point[] = [];
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const p = polygon[i];
    const q = polygon[(i + 1) % n];
    const dp = level(p, sinPhi, cosPhi) - at;
    const dq = level(q, sinPhi, cosPhi) - at;
    if (dp <= 0) out.push(p);
    if (dp * dq < 0) {
      const s = dp / (dp - dq);
      out.push([p[0] + s * (q[0] - p[0]), p[1] + s * (q[1] - p[1])]);
    }
  }
  return out;
}

/** The part of the heeled section under water, in the hull's own `(y, z)`: the page draws it. */
export function underWater(hull: Hull, weight: Weight, phi: number): Point[] {
  const polygon = section(hull);
  const at = waterline(polygon, displacedM2(hull, weight), phi);
  return clipped(polygon, at, Math.sin(phi), Math.cos(phi));
}

/** `B` in the hull's own `(y, z)`, heeled by `phi` radians. */
export function buoyancyCentre(hull: Hull, weight: Weight, phi: number): Point {
  const polygon = section(hull);
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const at = waterline(polygon, displacedM2(hull, weight), phi);
  return centroid(clipped(polygon, at, sinPhi, cosPhi));
}

/** `GZ(φ)`, m: above zero the pair turns the hull back. */
export function rightingArmM(hull: Hull, weight: Weight, phi: number): number {
  const [yB, zB] = buoyancyCentre(hull, weight, phi);
  return yB * Math.cos(phi) + (zB - gravityM(hull, weight)) * Math.sin(phi);
}

/** One Runge–Kutta step of `STEP_S`: `[heel, rate]`, radians. */
export function step(hull: Hull, weight: Weight, dampingPerS: number, phi: number, rate: number): [number, number] {
  const pull = (massKg(hull, weight) * G) / inertiaKgM2(hull, weight);
  const f = (_t: number, y: readonly number[]) => [
    y[1],
    -pull * rightingArmM(hull, weight, y[0]) - 2 * dampingPerS * y[1],
  ];
  const [p, r] = rk4(f, 0.0, [phi, rate], STEP_S);
  return [p, r];
}

/** The stability curve: `GZ` at each heel, in degrees. */
export const curveM = (hull: Hull, weight: Weight, anglesDeg: readonly number[]) =>
  anglesDeg.map((a) => rightingArmM(hull, weight, radians(a)));

function crossingDeg(hull: Hull, weight: Weight, lo: number, hi: number): number {
  const positive = rightingArmM(hull, weight, radians(lo)) > 0;
  for (let i = 0; i < HALVINGS; i++) {
    const mid = (lo + hi) / 2;
    if (rightingArmM(hull, weight, radians(mid)) > 0 === positive) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** The engine's `ShipFigures`. */
export interface ShipFigures {
  draft_m: number;
  kb_m: number;
  bm_m: number;
  km_m: number;
  kg_m: number;
  gm_m: number;
  period_s: number | null;
  weight_limit_m: number | null;
  max_arm_m: number;
  max_arm_deg: number;
  vanishing_deg: number | null;
  loll_deg: number | null;
  keel_up: boolean;
}

export function figures(hull: Hull, weight: Weight): ShipFigures {
  const polygon = section(hull);
  const displaced = displacedM2(hull, weight);
  const at = waterline(polygon, displaced, 0.0);
  const kb = centroid(clipped(polygon, at, 0.0, 1.0))[1];
  const width = chord(polygon, at, 0.0, 1.0);
  const bm = width ** 3 / 12 / displaced;
  const kg = gravityM(hull, weight);
  const gm = kb + bm - kg;
  const m = massKg(hull, weight);
  const period = gm > 0 ? 2 * Math.PI * Math.sqrt(inertiaKgM2(hull, weight) / (m * G * gm)) : null;
  const limit = weight.mass_kg > 0 ? (m * (kb + bm) - hull.mass_kg * hull.centre_m) / weight.mass_kg : null;
  const angles = Array.from({ length: CURVE_SAMPLES + 1 }, (_, k) => (180 * k) / CURVE_SAMPLES);
  const arms = curveM(hull, weight, angles);
  let best = 1;
  for (let k = 2; k < CURVE_SAMPLES; k++) if (arms[k] > arms[best]) best = k;
  let vanishing: number | null = null;
  let loll: number | null = null;
  for (let k = 1; k < CURVE_SAMPLES - 1; k++) {
    const a = arms[k];
    const b = arms[k + 1];
    if (a > 0 && 0 >= b && vanishing === null) vanishing = crossingDeg(hull, weight, angles[k], angles[k + 1]);
    if (a <= 0 && 0 < b && loll === null && gm <= 0) loll = crossingDeg(hull, weight, angles[k], angles[k + 1]);
  }
  if (gm <= 0 && loll === null) vanishing = 0.0;
  return {
    draft_m: at,
    kb_m: kb,
    bm_m: bm,
    km_m: kb + bm,
    kg_m: kg,
    gm_m: gm,
    period_s: period,
    weight_limit_m: limit,
    max_arm_m: arms[best],
    max_arm_deg: angles[best],
    vanishing_deg: vanishing,
    loll_deg: loll,
    keel_up: arms[CURVE_SAMPLES - 1] < 0,
  };
}
