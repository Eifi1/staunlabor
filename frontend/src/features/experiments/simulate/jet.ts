/**
 * The light in the water jet, in the browser: a line-for-line port of
 * `backend/staunlabor/domain/experiments/jet.py` — the jet's parabola, the
 * rays traced through it by Snell's law and Fresnel's formulas, where their
 * light leaves and how much reaches the basin — held to it by
 * `simulate.test.ts`.
 *
 * Why here: the reader tilts the laser and lowers the level, and the beam is
 * traced again with every step of the slider (nine rays, some thousand steps
 * each). There is no route; a change to the optics is made in Python first.
 */

import { G } from "./constants";
import { degrees, radians } from "./python";

export const RAYS = 9;
const LEAST_STEP = 1 / 16;
const HALVINGS = 48;
const FALSI = 40;
const EDGE_TOLERANCE = 1e-12;
const NEWTON = 50;
export const MAX_HITS = 4000;
const FADED = 1e-6;
export const BINS = 40;
const NOTICED = 1e-3;
export const MAX_TILT_DEG = 60.0;

/** The engine's `Jet`. */
export interface Jet {
  level_m: number;
  hole_m: number;
  drop_m: number;
  index: number;
}

export const speedMS = (jet: Jet) => Math.sqrt(2 * G * jet.level_m);

function kOf(jet: Jet): number {
  const v = speedMS(jet);
  return G / (2 * v * v);
}

export function bendRadiusM(jet: Jet): number {
  const v = speedMS(jet);
  return (v * v) / G;
}

export const landingM = (jet: Jet) => speedMS(jet) * Math.sqrt((2 * jet.drop_m) / G);

export const axisY = (jet: Jet, x: number) => -kOf(jet) * x * x;

export function axisNormal(jet: Jet, x: number): [number, number] {
  const k = kOf(jet);
  const norm = Math.sqrt(1 + 4 * k * k * x * x);
  return [(2 * k * x) / norm, 1 / norm];
}

export const criticalAngle = (n: number) => Math.asin(1 / n);

export function reflectance(n: number, cosI: number): number {
  const sin2 = 1 - cosI * cosI;
  const inside = 1 - n * n * sin2;
  if (inside <= 0) return 1.0;
  const cosT = Math.sqrt(inside);
  const rs = (n * cosI - cosT) / (n * cosI + cosT);
  const rp = (n * cosT - cosI) / (n * cosT + cosI);
  return 0.5 * (rs * rs + rp * rp);
}

function foot(k: number, qx: number, qy: number, u: number): number {
  for (let i = 0; i < NEWTON; i++) {
    const slope = 2 * k * k * u * u * u + (1 + 2 * k * qy) * u - qx;
    const bend = 6 * k * k * u * u + 1 + 2 * k * qy;
    const step = slope / bend;
    u -= step;
    if (Math.abs(step) <= 1e-15 * (1 + Math.abs(u))) break;
  }
  return u;
}

function off(k: number, qx: number, qy: number, u: number): [number, number, number] {
  const norm = Math.sqrt(1 + 4 * k * k * u * u);
  const nx = (2 * k * u) / norm;
  const ny = 1 / norm;
  return [(qx - u) * nx + (qy + k * u * u) * ny, nx, ny];
}

/** The engine's `Escape`. */
export interface Escape {
  x: number;
  y: number;
  out: [number, number];
  normal: [number, number];
  share: number;
  light: number;
}

export type RayEnd = "basin" | "faded" | "tank" | "trapped";

/** The engine's `Ray`. */
export interface Ray {
  start: number;
  tilt_rad: number;
  xs: number[];
  ys: number[];
  hits_cos: number[];
  escapes: Escape[];
  arrives: number;
  end: RayEnd;
}

function toEdge(
  k: number,
  a: number,
  px: number,
  py: number,
  dx: number,
  dy: number,
  t0: number,
  u0: number,
  s0: number,
  t1: number,
  u1: number,
  s1: number,
): [number, number, number, number, number] {
  let f0 = Math.abs(s0) - a;
  let f1 = Math.abs(s1) - a;
  let last = 0;
  for (let i = 0; i < FALSI; i++) {
    const tm = t1 - (f1 * (t1 - t0)) / (f1 - f0);
    const um = foot(k, px + tm * dx, py + tm * dy, u0);
    const sm = off(k, px + tm * dx, py + tm * dy, um)[0];
    const fm = Math.abs(sm) - a;
    if (fm >= 0) {
      [t1, u1, s1, f1] = [tm, um, sm, fm];
      if (last === 1) f0 *= 0.5;
      last = 1;
    } else {
      [t0, u0, f0] = [tm, um, fm];
      if (last === -1) f1 *= 0.5;
      last = -1;
    }
    if (t1 - t0 <= EDGE_TOLERANCE * a) break;
  }
  return [t0, u0, t1, u1, s1];
}

/** The engine's `_march`: the ray to its next event, inside just before it
 *  (`t0` and its foot) and the foot and distance from the axis just past it. */
function march(
  k: number,
  a: number,
  endX: number,
  px: number,
  py: number,
  dx: number,
  dy: number,
  u: number,
): [number, number, number, number] {
  let t0 = 0.0;
  let u0 = u;
  let s0 = off(k, px, py, u0)[0];
  let t1: number;
  let u1: number;
  let s1: number;
  for (;;) {
    t1 = t0 + Math.max(a - Math.abs(s0), LEAST_STEP * a);
    u1 = foot(k, px + t1 * dx, py + t1 * dy, u0);
    s1 = off(k, px + t1 * dx, py + t1 * dy, u1)[0];
    if (Math.abs(s1) >= a || u1 >= endX || u1 < 0) break;
    [t0, u0, s0] = [t1, u1, s1];
  }
  if (!(u1 >= endX || u1 < 0)) {
    [t0, u0, , u1, s1] = toEdge(k, a, px, py, dx, dy, t0, u0, s0, t1, u1, s1);
    return [t0, u0, u1, s1];
  }
  for (let i = 0; i < HALVINGS; i++) {
    const tm = 0.5 * (t0 + t1);
    const um = foot(k, px + tm * dx, py + tm * dy, u0);
    const sm = off(k, px + tm * dx, py + tm * dy, um)[0];
    if (Math.abs(sm) >= a || um >= endX || um < 0) [t1, u1, s1] = [tm, um, sm];
    else [t0, u0] = [tm, um];
  }
  return [t0, u0, u1, s1];
}

export function trace(jet: Jet, start: number, tiltRad: number): Ray {
  const a = jet.hole_m / 2;
  const n = jet.index;
  const k = kOf(jet);
  const endX = landingM(jet);
  let px = 0.0;
  let py = start * a;
  let dx = Math.cos(tiltRad);
  let dy = Math.sin(tiltRad);
  let u = 0.0;
  let light = 1.0;
  const xs = [px];
  const ys = [py];
  const hits: number[] = [];
  const escapes: Escape[] = [];
  let end: RayEnd = "trapped";
  while (hits.length < MAX_HITS) {
    const [t0, u0, u1, s1] = march(k, a, endX, px, py, dx, dy, u);
    [px, py, u] = [px + t0 * dx, py + t0 * dy, u0];
    xs.push(px);
    ys.push(py);
    if (u1 >= endX) {
      end = "basin";
      break;
    }
    if (u1 < 0) {
      end = "tank";
      break;
    }
    let [, nx, ny] = off(k, px, py, u1);
    const side = s1 > 0 ? 1.0 : -1.0;
    [nx, ny] = [side * nx, side * ny];
    const cosI = dx * nx + dy * ny;
    hits.push(cosI);
    const r = reflectance(n, cosI);
    if (r < 1) {
      const cosT = Math.sqrt(1 - n * n * (1 - cosI * cosI));
      const along = n * cosI - cosT;
      const out: [number, number] = [n * dx - along * nx, n * dy - along * ny];
      let leaving = light * (1 - r);
      light *= r;
      const faded = light < FADED;
      if (faded) [leaving, light] = [leaving + light, 0.0];
      escapes.push({ x: px, y: py, out, normal: [nx, ny], share: 1 - r, light: leaving });
      if (faded) {
        end = "faded";
        break;
      }
    }
    [dx, dy] = [dx - 2 * cosI * nx, dy - 2 * cosI * ny];
  }
  return {
    start,
    tilt_rad: tiltRad,
    xs,
    ys,
    hits_cos: hits,
    escapes,
    arrives: end === "basin" ? light : 0.0,
    end,
  };
}

export const starts = () => Array.from({ length: RAYS }, (_, j) => (2 * (j + 0.5)) / RAYS - 1);

/** The engine's `Beam`. */
export interface Beam {
  rays: Ray[];
  arrives: number;
  left: number[];
  lost: number;
}

export function beam(jet: Jet, tiltDeg: number): Beam {
  const rays = starts().map((s) => trace(jet, s, radians(tiltDeg)));
  const endX = landingM(jet);
  const left = new Array<number>(BINS).fill(0);
  for (const ray of rays)
    for (const e of ray.escapes) {
      const j = Math.min(BINS - 1, Math.max(0, Math.trunc((e.x / endX) * BINS)));
      left[j] += e.light / RAYS;
    }
  // One by one, as the engine adds them (not Python's compensated `sum`).
  const arrives = rays.reduce((sum, r) => sum + r.arrives, 0) / RAYS;
  const out = left.reduce((sum, x) => sum + x, 0);
  return { rays, arrives, left, lost: Math.max(0.0, 1 - arrives - out) };
}

/** The engine's `JetFigures`. */
export interface JetFigures {
  speed_m_s: number;
  bend_radius_m: number;
  critical_deg: number;
  landing_m: number;
  arrives: number;
  steepest_deg: number | null;
  first_out_m: number | null;
  middle_hits: number;
}

/** The engine's `figures_of`: the figures of a beam already traced (the engine's
 *  `figures` traces one first; the page always has its beam). */
export function figuresOf(jet: Jet, b: Beam): JetFigures {
  const cosines = b.rays.flatMap((r) => r.hits_cos);
  const out = b.rays.flatMap((r) => r.escapes.filter((e) => e.light / RAYS >= NOTICED).map((e) => e.x));
  return {
    speed_m_s: speedMS(jet),
    bend_radius_m: bendRadiusM(jet),
    critical_deg: degrees(criticalAngle(jet.index)),
    landing_m: landingM(jet),
    arrives: b.arrives,
    steepest_deg: cosines.length ? degrees(Math.acos(Math.min(1.0, Math.max(...cosines)))) : null,
    first_out_m: out.length ? Math.min(...out) : null,
    middle_hits: b.rays[Math.floor(RAYS / 2)].hits_cos.length,
  };
}
