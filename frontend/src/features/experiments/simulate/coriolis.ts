/**
 * The Coriolis carousel, in the browser: a line-for-line port of
 * `backend/staunlabor/domain/experiments/coriolis.py` — a puck straight and a
 * rolled ball on a circle seen from outside, both turned back for the riders —
 * held to it by `simulate.test.ts`.
 *
 * Closed forms, so the page draws a throw's whole path the moment the aim
 * changes and finds the lead by scanning and bisecting the aim: no route. A
 * change to the physics is made in Python first.
 */

import { roundHalfEven } from "./sphere";

/** I/(m·a²) for a solid ball. */
export const SOLID_BALL = 2 / 5;
/** Samples a path returns per second. */
export const SAMPLES_PER_S = 100;
/** The longest a throw is followed. */
export const LONGEST_S = 20.0;

export type Body = "puck" | "ball";

export interface Carousel {
  radius_m: number;
  rpm: number;
}

export interface Throw {
  speed_m_s: number;
  aim_deg: number;
  body: Body;
}

const TO_RAD = Math.PI / 180.0;
const TO_DEG = 180.0 / Math.PI;

export const rateOf = (c: Carousel) => (c.rpm * 2 * Math.PI) / 60;

function turn(x: number, y: number, angle: number): [number, number] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [x * c - y * s, x * s + y * c];
}

export function start(c: Carousel, t: Throw): [[number, number], [number, number]] {
  const [ux, uy] = turn(-t.speed_m_s, 0.0, t.aim_deg * TO_RAD);
  return [
    [c.radius_m, 0.0],
    [ux, uy + rateOf(c) * c.radius_m],
  ];
}

export function outside(c: Carousel, th: Throw, t: number): [number, number] {
  const [[x0, y0], [vx, vy]] = start(c, th);
  if (th.body === "puck") return [x0 + vx * t, y0 + vy * t];
  const w = (SOLID_BALL / (1 + SOLID_BALL)) * rateOf(c);
  if (Math.abs(w * t) < 1e-12) return [x0 + vx * t, y0 + vy * t];
  const s = Math.sin(w * t);
  const k = Math.cos(w * t);
  return [x0 + (vx * s - vy * (1 - k)) / w, y0 + (vy * s + vx * (1 - k)) / w];
}

export function turning(c: Carousel, th: Throw, t: number): [number, number] {
  const [x, y] = outside(c, th, t);
  return turn(x, y, -rateOf(c) * t);
}

export function leavesS(c: Carousel, th: Throw): number {
  const out = (t: number) => {
    const [x, y] = outside(c, th, t);
    return x * x + y * y > c.radius_m ** 2;
  };
  const step = 0.01;
  let t = step;
  while (t < LONGEST_S && !out(t)) t += step;
  if (t >= LONGEST_S) return LONGEST_S;
  let lo = t - step;
  let hi = t;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (out(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

/** Python's `%` for floats: the remainder with the sign of the divisor. */
const pyMod = (a: number, b: number) => ((a % b) + b) % b;

export function missDeg(c: Carousel, th: Throw): number {
  const [x, y] = turning(c, th, leavesS(c, th));
  return pyMod(Math.atan2(y, x) * TO_DEG, 360) - 180;
}

export function leadDeg(c: Carousel, speedMS: number, body: Body): number | null {
  const aims: number[] = [];
  for (let a = -85; a <= 85; a++) aims.push(a);
  const misses = aims.map((a) => missDeg(c, { speed_m_s: speedMS, aim_deg: a, body }));
  const brackets: Array<[number, number, number]> = [];
  for (let i = 0; i < aims.length - 1; i++) {
    if (misses[i] > 0 !== misses[i + 1] > 0 && Math.abs(misses[i] - misses[i + 1]) < 180)
      brackets.push([aims[i], aims[i + 1], misses[i + 1]]);
  }
  if (brackets.length === 0) return null;
  let best = brackets[0];
  for (const b of brackets) if (Math.abs(b[0] + b[1]) < Math.abs(best[0] + best[1])) best = b;
  let [lo, hi] = best;
  const mHi = best[2];
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (missDeg(c, { speed_m_s: speedMS, aim_deg: mid, body }) > 0 === mHi > 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

/** The engine's `ThrowPath`. */
export interface ThrowPath {
  t: number[];
  outside_x: number[];
  outside_y: number[];
  turning_x: number[];
  turning_y: number[];
  leaves_s: number;
  miss_deg: number;
}

export function path(c: Carousel, th: Throw): ThrowPath {
  const end = leavesS(c, th);
  const n = Math.max(1, roundHalfEven(end * SAMPLES_PER_S));
  const out: ThrowPath = {
    t: [],
    outside_x: [],
    outside_y: [],
    turning_x: [],
    turning_y: [],
    leaves_s: end,
    miss_deg: missDeg(c, th),
  };
  for (let i = 0; i <= n; i++) {
    const t = (end * i) / n;
    const [ox, oy] = outside(c, th, t);
    const [tx, ty] = turning(c, th, t);
    out.t.push(t);
    out.outside_x.push(ox);
    out.outside_y.push(oy);
    out.turning_x.push(tx);
    out.turning_y.push(ty);
  }
  return out;
}
