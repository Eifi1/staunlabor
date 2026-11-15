/**
 * The chain and the arch, in the browser: a line-for-line port of
 * `backend/staunlabor/domain/experiments/arch.py` — the arch cut into stones,
 * the thrust line that stays nearest the centre line found by cutting a polygon
 * with each joint's half-planes — held to it by `simulate.test.ts`.
 *
 * The page finds the line as the reader moves a load, so there is no route. A
 * change to the statics is made in Python first.
 */

import { G } from "./pendulum";

export type Shape = "semicircle" | "pointed" | "catenary";
export type Point = [number, number];

const BISECTIONS = 40;
const GOLDEN_STEPS = 40;

/** The engine's `Arch`. */
export interface Arch {
  shape: Shape;
  span_m: number;
  thickness_m: number;
  blocks: number;
  density_kg_m3: number;
  depth_m: number;
}

/** The engine's `Load`: where it stands as a share of the half span from the middle. */
export interface Load {
  at: number;
  weight_n: number;
}

/** a of the catenary that rises `riseM` over `halfSpanM`, by bisection. */
export function catenaryAForRise(halfSpanM: number, riseM: number): number {
  let lo = halfSpanM / 50;
  let hi = halfSpanM * 1e4;
  for (let i = 0; i < 200; i++) {
    const mid = Math.sqrt(lo * hi);
    if (mid * (Math.cosh(halfSpanM / mid) - 1) > riseM) lo = mid;
    else hi = mid;
  }
  return Math.sqrt(lo * hi);
}

export const riseM = (arch: Arch) => (arch.shape === "pointed" ? (arch.span_m * Math.sqrt(3)) / 2 : arch.span_m / 2);

function centre(arch: Arch, s: number, a: number): [Point, Point] {
  const c = arch.span_m / 2;
  if (arch.shape === "semicircle") {
    const phi = Math.PI * (1 - s);
    return [
      [c * Math.cos(phi), c * Math.sin(phi)],
      [Math.sin(phi), -Math.cos(phi)],
    ];
  }
  if (arch.shape === "pointed") {
    const r = arch.span_m;
    if (s <= 0.5) {
      const phi = (Math.PI / 3) * (s / 0.5);
      return [
        [c - r * Math.cos(phi), r * Math.sin(phi)],
        [Math.sin(phi), Math.cos(phi)],
      ];
    }
    const phi = (Math.PI / 3) * ((1 - s) / 0.5);
    return [
      [-c + r * Math.cos(phi), r * Math.sin(phi)],
      [Math.sin(phi), -Math.cos(phi)],
    ];
  }
  const total = 2 * a * Math.sinh(c / a);
  const x = a * Math.asinh(((s - 0.5) * total) / a);
  const slope = -Math.sinh(x / a);
  const norm = Math.hypot(1, slope);
  return [
    [x, c - a * (Math.cosh(x / a) - 1)],
    [1 / norm, slope / norm],
  ];
}

/** The engine's `Joint`. */
export interface Joint {
  centre: Point;
  normal: Point;
  tangent: Point;
}

export function joints(arch: Arch): Joint[] {
  const a = arch.shape === "catenary" ? catenaryAForRise(arch.span_m / 2, riseM(arch)) : 0.0;
  const out: Joint[] = [];
  for (let j = 0; j <= arch.blocks; j++) {
    const [p, along] = centre(arch, j / arch.blocks, a);
    // At the point the two arcs meet at an angle: the joint is upright.
    const t: Point = arch.shape === "pointed" && j === arch.blocks / 2 ? [1.0, 0.0] : along;
    out.push({ centre: p, normal: [-t[1], t[0]], tangent: t });
  }
  return out;
}

export const edge = (joint: Joint, offset: number): Point => [
  joint.centre[0] + offset * joint.normal[0],
  joint.centre[1] + offset * joint.normal[1],
];

/** The engine's `Block`: intrados left, intrados right, extrados right, extrados left. */
export interface Block {
  corners: [Point, Point, Point, Point];
  weight_n: number;
  centroid: Point;
}

export function blocks(arch: Arch): Block[] {
  const js = joints(arch);
  const half = arch.thickness_m / 2;
  const out: Block[] = [];
  for (let k = 0; k + 1 < js.length; k++) {
    const left = js[k];
    const right = js[k + 1];
    const corners: [Point, Point, Point, Point] = [
      edge(left, -half),
      edge(right, -half),
      edge(right, half),
      edge(left, half),
    ];
    let area = 0.0;
    let cx = 0.0;
    let cy = 0.0;
    for (let i = 0; i < 4; i++) {
      const [x0, y0] = corners[i];
      const [x1, y1] = corners[(i + 1) % 4];
      const cross = x0 * y1 - x1 * y0;
      area += cross;
      cx += (x0 + x1) * cross;
      cy += (y0 + y1) * cross;
    }
    area /= 2;
    out.push({
      corners,
      weight_n: Math.abs(area) * arch.depth_m * arch.density_kg_m3 * G,
      centroid: [cx / (6 * area), cy / (6 * area)],
    });
  }
  return out;
}

/** The block the load stands on and the point on its extrados below it. */
export function loadPoint(arch: Arch, load: Load): [number, Point] {
  const x = (load.at * arch.span_m) / 2;
  const bs = blocks(arch);
  let best = bs.length - 1;
  for (let i = 0; i < bs.length; i++) {
    if (bs[i].corners[2][0] >= x) {
      best = i;
      break;
    }
  }
  const b = bs[best];
  const [x0, y0] = b.corners[3];
  const [x1, y1] = b.corners[2];
  const share = x1 === x0 ? 0.5 : Math.min(1.0, Math.max(0.0, (x - x0) / (x1 - x0)));
  return [best, [x0 + share * (x1 - x0), y0 + share * (y1 - y0)]];
}

interface Rows {
  dx: number[];
  dy: number[];
  s: number[];
  tx: number[];
  ty: number[];
  w: number[];
}

function rowsOf(arch: Arch, load: Load): [Rows, number] {
  const js = joints(arch);
  const bs = blocks(arch);
  const forces: Array<[number, Point, number]> = bs.map((b, i) => [i, b.centroid, b.weight_n]);
  if (load.weight_n > 0) {
    const [at, point] = loadPoint(arch, load);
    forces.push([at, point, load.weight_n]);
  }
  const p0 = js[0].centre;
  const rows: Rows = { dx: [], dy: [], s: [], tx: [], ty: [], w: [] };
  js.forEach((joint, j) => {
    const pj = joint.centre;
    const left = forces.filter(([i]) => i < j);
    rows.s.push(left.reduce((sum, [, point, w]) => sum + -(point[0] - pj[0]) * w, 0));
    rows.w.push(left.reduce((sum, [, , w]) => sum + w, 0));
    rows.dx.push(p0[0] - pj[0]);
    rows.dy.push(p0[1] - pj[1]);
    rows.tx.push(joint.tangent[0]);
    rows.ty.push(joint.tangent[1]);
  });
  return [rows, forces.reduce((sum, [, , w]) => sum + w, 0)];
}

type Polygon = Point[];

function clip(poly: Polygon, a: number, b: number, c: number): Polygon {
  const out: Polygon = [];
  const n = poly.length;
  for (let k = 0; k < n; k++) {
    const p = poly[k];
    const q = poly[(k + 1) % n];
    const fp = a * p[0] + b * p[1] + c;
    const fq = a * q[0] + b * q[1] + c;
    if (fp <= 0) out.push(p);
    if ((fp < 0 && 0 < fq) || (fq < 0 && 0 < fp)) {
      const share = fp / (fp - fq);
      out.push([p[0] + share * (q[0] - p[0]), p[1] + share * (q[1] - p[1])]);
    }
  }
  return out;
}

function feasible(rows: Rows, v: number, reach: number, bound: number): Polygon {
  let poly: Polygon = [
    [0.0, -bound],
    [bound, -bound],
    [bound, bound],
    [0.0, bound],
  ];
  for (let j = 0; j < rows.s.length; j++) {
    const mH = -rows.dy[j];
    const mC = rows.dx[j] * v + rows.s[j];
    const nH = rows.tx[j];
    const nC = rows.ty[j] * (v - rows.w[j]);
    poly = clip(poly, mH - reach * nH, 1.0, mC - reach * nC);
    if (!poly.length) return poly;
    poly = clip(poly, -mH - reach * nH, -1.0, -mC - reach * nC);
    if (!poly.length) return poly;
  }
  return poly;
}

function leastReach(rows: Rows, v: number, bound: number, high: number): [number, Polygon] {
  if (!feasible(rows, v, high, bound).length) return [Infinity, []];
  let lo = 0.0;
  let hi = high;
  let best = feasible(rows, v, hi, bound);
  for (let i = 0; i < BISECTIONS; i++) {
    const mid = (lo + hi) / 2;
    const poly = feasible(rows, v, mid, bound);
    if (poly.length) {
      hi = mid;
      best = poly;
    } else lo = mid;
  }
  return [hi, best];
}

/** The engine's `Thrust`. */
export interface Thrust {
  reach: number;
  stands: boolean;
  h_n: number;
  v_n: number;
  m_n_m: number;
  offsets_m: number[];
  points: Point[];
  weight_n: number;
}

/** The thrust line that stays nearest the centre line, and how near. */
export function thrust(arch: Arch, load: Load = { at: 0.5, weight_n: 0.0 }): Thrust {
  const [rows, total] = rowsOf(arch, load);
  const bound = 1e3 * total * arch.span_m + 1.0;
  const high = (1e3 * arch.thickness_m) / 2;
  const symmetric = load.weight_n === 0 || load.at === 0;
  let v: number;
  let reach: number;
  let poly: Polygon;
  if (symmetric) {
    v = total / 2;
    [reach, poly] = leastReach(rows, v, bound, high);
  } else {
    let lo = 0.0;
    let hi = total;
    const golden = (Math.sqrt(5) - 1) / 2;
    let a = hi - golden * (hi - lo);
    let b = lo + golden * (hi - lo);
    let fa = leastReach(rows, a, bound, high)[0];
    let fb = leastReach(rows, b, bound, high)[0];
    for (let i = 0; i < GOLDEN_STEPS; i++) {
      if (fa <= fb) {
        hi = b;
        b = a;
        fb = fa;
        a = hi - golden * (hi - lo);
        fa = leastReach(rows, a, bound, high)[0];
      } else {
        lo = a;
        a = b;
        fa = fb;
        b = lo + golden * (hi - lo);
        fb = leastReach(rows, b, bound, high)[0];
      }
    }
    v = (lo + hi) / 2;
    [reach, poly] = leastReach(rows, v, bound, high);
  }
  if (!poly.length) throw new RangeError("no thrust line keeps every joint pressed");
  const h = poly.reduce((sum, p) => sum + p[0], 0) / poly.length;
  const m = poly.reduce((sum, p) => sum + p[1], 0) / poly.length;
  const js = joints(arch);
  const offsets: number[] = [];
  const points: Point[] = [];
  js.forEach((joint, j) => {
    const mbar = m - rows.dy[j] * h + rows.dx[j] * v + rows.s[j];
    const n = rows.tx[j] * h + rows.ty[j] * (v - rows.w[j]);
    const e = -mbar / n;
    offsets.push(e);
    points.push(edge(joint, e));
  });
  const lam = reach / (arch.thickness_m / 2);
  return { reach: lam, stands: lam <= 1, h_n: h, v_n: v, m_n_m: m, offsets_m: offsets, points, weight_n: total };
}
