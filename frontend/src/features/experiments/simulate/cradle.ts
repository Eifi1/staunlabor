/**
 * Newton's cradle, in the browser: a line-for-line port of
 * `backend/staunlabor/domain/experiments/cradle.py` — pendulums meeting by
 * Hertz's law, damped in the material, stepped a millisecond at a time and a
 * microsecond while any two press on each other — held to it by
 * `simulate.test.ts`.
 *
 * The page swings the row as the reader watches, so there is no route. The
 * engine's `run` is not ported: the page steps the row itself, and the test
 * samples it the engine's way. A change to the physics is made in Python first.
 */

import { G } from "./constants";
import { roundHalfEven, TO_RAD } from "./python";
import { rk4SecondOrder } from "./numerics";

/** Steel's Poisson's ratio. */
const POISSON = 0.29;
export const STEP_S = 1e-3;
const CONTACT_STEP_S = 1e-6;
const SUBSTEPS = roundHalfEven(STEP_S / CONTACT_STEP_S);
/** The speed `e` is given at. */
const REFERENCE_M_S = 1.0;

export interface Cradle {
  count: number;
  diameter_m: number;
  string_m: number;
  gap_m: number;
  restitution: number;
  youngs_gpa: number;
  density_kg_m3: number;
}

export interface Pull {
  balls: number;
  angle_deg: number;
}

const massKg = (cr: Cradle) => ((cr.density_kg_m3 * Math.PI) / 6) * cr.diameter_m ** 3;

function stiffness(cr: Cradle): number {
  const eStar = (cr.youngs_gpa * 1e9) / (2 * (1 - POISSON ** 2));
  return (4 / 3) * eStar * Math.sqrt(cr.diameter_m / 4);
}

export function start(cr: Cradle, pull: Pull): [number[], number[]] {
  if (pull.balls >= cr.count) throw new RangeError("at least one ball is left hanging");
  const a = -(pull.angle_deg * TO_RAD);
  return [Array.from({ length: cr.count }, (_, i) => (i < pull.balls ? a : 0.0)), new Array(cr.count).fill(0.0)];
}

function forces(cr: Cradle, x: number[], v: number[]): number[] {
  const out: number[] = [];
  const k = stiffness(cr);
  const alpha = (8 * (1 - cr.restitution)) / (5 * cr.restitution) / REFERENCE_M_S;
  for (let c = 0; c < cr.count - 1; c++) {
    const overlap = x[c] - x[c + 1] - cr.gap_m;
    if (overlap <= 0) {
      out.push(0.0);
      continue;
    }
    const rate = v[c] - v[c + 1];
    out.push(Math.max(k * overlap ** 1.5 * (1 + alpha * rate), 0.0));
  }
  return out;
}

function rates(cr: Cradle, th: readonly number[], w: readonly number[]): number[] {
  const length = cr.string_m;
  const f = forces(
    cr,
    th.map((a) => length * a),
    w.map((r) => length * r),
  );
  const m = massKg(cr);
  const out: number[] = [];
  for (let i = 0; i < cr.count; i++) {
    const left = i > 0 ? f[i - 1] : 0.0;
    const right = i < cr.count - 1 ? f[i] : 0.0;
    out.push((-G * Math.sin(th[i]) + (left - right) / m) / length);
  }
  return out;
}

/** One step of the swings, as the engine takes it (`rk4_second_order`). */
function rk4(cr: Cradle, th: number[], w: number[], h: number): [number[], number[]] {
  return rk4SecondOrder((x, v) => rates(cr, x, v), th, w, h);
}

function near(cr: Cradle, th: number[], w: number[]): boolean {
  const length = cr.string_m;
  for (let c = 0; c < cr.count - 1; c++) {
    const gap = length * (th[c + 1] - th[c]) + cr.gap_m;
    const closing = length * (w[c] - w[c + 1]);
    if (gap < 0 || (closing > 0 && gap <= closing * STEP_S * 2 + 1e-9)) return true;
  }
  return false;
}

/** One millisecond: a microsecond at a time while any two balls are near, the rest of it in one go once none are. */
export function step(cr: Cradle, th: number[], w: number[]): [number[], number[]] {
  let done = 0;
  while (done < SUBSTEPS && near(cr, th, w)) {
    [th, w] = rk4(cr, th, w, CONTACT_STEP_S);
    done += 1;
  }
  if (done === SUBSTEPS) return [th, w];
  return rk4(cr, th, w, STEP_S - done * CONTACT_STEP_S);
}

/** The engine's `Impact`. */
export interface Impact {
  before_m_s: number[];
  after_m_s: number[];
  duration_s: number;
  peak_n: number;
  far_share: number;
}

export function impact(cr: Cradle, pull: Pull): Impact {
  let [th, w] = start(cr, pull);
  const length = cr.string_m;
  for (let i = 0; i < roundHalfEven(2.0 / STEP_S); i++) {
    if (near(cr, th, w)) break;
    [th, w] = rk4(cr, th, w, STEP_S);
  }
  const before = w.map((r) => length * r);
  let peak = 0.0;
  let touching = 0.0;
  let openedFor = 0;
  while (openedFor < 200) {
    const f = forces(
      cr,
      th.map((a) => length * a),
      w.map((r) => length * r),
    );
    peak = Math.max(peak, ...f);
    const pressing = f.some((x) => x > 0);
    if (pressing) openedFor = 0;
    else if (touching > 0) openedFor += 1;
    if (pressing || touching > 0) touching += CONTACT_STEP_S;
    [th, w] = rk4(cr, th, w, CONTACT_STEP_S);
    if (touching > 0.05) break;
  }
  const after = w.map((r) => length * r);
  const energyOut = after.reduce((s, v) => s + v * v, 0);
  const far = after.slice(cr.count - pull.balls).reduce((s, v) => s + v * v, 0);
  return {
    before_m_s: before,
    after_m_s: after,
    duration_s: touching - 200 * CONTACT_STEP_S,
    peak_n: peak,
    far_share: energyOut > 0 ? far / energyOut : 0.0,
  };
}
