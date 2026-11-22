/**
 * The falling plates, in the browser: a line-for-line port of
 * `backend/staunlabor/domain/experiments/plates.py` — the eddy currents' brake
 * on a plate between magnets, its exact fall, its figures and the currents'
 * stream function the page draws — held to it by `simulate.test.ts`.
 *
 * Why here: the plates fall and their currents are drawn every frame, and a
 * slider that changes the field must change the fall at once. There is no
 * route; a change to the physics is made in Python first.
 */

import { G } from "./constants";

/** The magnetic constant, in V·s/(A·m). */
const MU0 = 4e-7 * Math.PI;

export type Material = "copper" | "aluminium" | "brass" | "plastic";

/** Conductivity (S/m) and density (kg/m³), as the engine's `MATERIALS`. */
const MATERIALS: Record<Material, [number, number]> = {
  copper: [5.96e7, 8960.0],
  aluminium: [3.77e7, 2700.0],
  brass: [1.5e7, 8500.0],
  plastic: [0.0, 1180.0],
};

const EDGE_TERMS = 400;
const RIPPLE_SAMPLES = 64;
const FIT = 1e-9;

/** The engine's `MagnetColumn`. */
export interface MagnetColumn {
  field_t: number;
  pitch_m: number;
  drop_m: number;
}

/** The engine's `Plate`. */
export interface Plate {
  material: Material;
  thickness_m: number;
  tooth_m: number;
  width_m: number;
  height_m: number;
  slot_m: number;
}

/** `[n, h]`: the pieces the current flows in, and each one's height. */
export function teeth(plate: Plate): [number, number] {
  if (plate.tooth_m === 0) return [1, plate.height_m];
  return [Math.floor((plate.height_m + plate.slot_m) / (plate.tooth_m + plate.slot_m) + FIT), plate.tooth_m];
}

export function massKg(plate: Plate): number {
  const [n, h] = teeth(plate);
  return MATERIALS[plate.material][1] * plate.thickness_m * plate.width_m * n * h;
}

const sinc = (u: number) => (u === 0 ? 1 : Math.sin(u) / u);
const versinc = (u: number) => (u === 0 ? 0 : (2 * Math.sin(u / 2) ** 2) / u);

function overlap(k: number, q: number, h: number): [number, number] {
  const a = (k + q) * h;
  const b = (k - q) * h;
  return [(h / 2) * (sinc(a) + sinc(b)), (h / 2) * (versinc(a) + versinc(b))];
}

function edgeMode(k: number, h: number, width: number, m: number): [number, number, number] {
  const q = (m * Math.PI) / h;
  const [c, s] = overlap(k, q, h);
  return [c, s, Math.tanh((q * width) / 2) / q];
}

function edgeTerms(column: MagnetColumn, h: number, width: number): number {
  return EDGE_TERMS + 40 * (Math.ceil((2 * h) / column.pitch_m) + Math.ceil(h / width));
}

function pieceBrake(column: MagnetColumn, sigmaD: number, width: number, h: number, phase: number): number {
  const k = (2 * Math.PI) / column.pitch_m;
  const b0 = column.field_t;
  const cosP = Math.cos(phase);
  const sinP = Math.sin(phase);
  const squared = b0 * b0 * (h / 2 + (Math.sin(2 * k * h + 2 * phase) - Math.sin(2 * phase)) / (4 * k));
  const [c0, s0] = overlap(k, 0.0, h);
  const mean = (b0 / h) * (cosP * c0 - sinP * s0);
  let edges = 0.0;
  const terms = edgeTerms(column, h, width);
  for (let m = 1; m <= terms; m++) {
    const [c, s, reach] = edgeMode(k, h, width, m);
    const bm = ((2 * b0) / h) * (cosP * c - sinP * s);
    edges += h * bm * bm * reach;
  }
  return sigmaD * (width * (squared - h * mean * mean) - edges);
}

function pieceMeanBrake(column: MagnetColumn, sigmaD: number, width: number, h: number): number {
  const k = (2 * Math.PI) / column.pitch_m;
  const b0 = column.field_t;
  const [c0, s0] = overlap(k, 0.0, h);
  const sheet = (b0 * b0 * h) / 2 - (b0 * b0 * (c0 * c0 + s0 * s0)) / (2 * h);
  let edges = 0.0;
  const terms = edgeTerms(column, h, width);
  for (let m = 1; m <= terms; m++) {
    const [c, s, reach] = edgeMode(k, h, width, m);
    edges += ((h * ((2 * b0) / h) ** 2 * (c * c + s * s)) / 2) * reach;
  }
  return sigmaD * (width * sheet - edges);
}

function phases(column: MagnetColumn, plate: Plate, fallenM: number): number[] {
  const k = (2 * Math.PI) / column.pitch_m;
  const [n, h] = teeth(plate);
  return Array.from({ length: n }, (_, i) => k * (i * (h + plate.slot_m) - fallenM - plate.height_m));
}

/** The brake (N·s/m) with the plate's top edge `fallenM` below the column's top. */
export function brakeAt(column: MagnetColumn, plate: Plate, fallenM: number): number {
  const sigma = MATERIALS[plate.material][0];
  const [, h] = teeth(plate);
  let total = 0;
  for (const p of phases(column, plate, fallenM))
    total += pieceBrake(column, sigma * plate.thickness_m, plate.width_m, h, p);
  return total;
}

/** The brake's mean as the plate passes the poles, in N·s/m. */
export function brake(column: MagnetColumn, plate: Plate): number {
  const sigma = MATERIALS[plate.material][0];
  const [n, h] = teeth(plate);
  return n * pieceMeanBrake(column, sigma * plate.thickness_m, plate.width_m, h);
}

/** `[s, v]` at `tS` after the plate is let go. Before it (a negative time, the
 *  page's plate held at the top) it waits at rest, where the engine refuses
 *  to be asked. */
export function motion(column: MagnetColumn, plate: Plate, tS: number): [number, number] {
  const t = Math.max(0, tS);
  const c = brake(column, plate);
  if (c === 0) return [(G * t * t) / 2, G * t];
  const tau = massKg(plate) / c;
  const terminal = G * tau;
  const gained = -Math.expm1(-t / tau);
  return [terminal * (t - tau * gained), terminal * gained];
}

export function fallTimeS(column: MagnetColumn, plate: Plate): number {
  const c = brake(column, plate);
  if (c === 0) return Math.sqrt((2 * column.drop_m) / G);
  const tau = massKg(plate) / c;
  const terminal = G * tau;
  let t = column.drop_m / terminal + tau;
  for (let i = 0; i < 100; i++) {
    const gained = -Math.expm1(-t / tau);
    const step = (terminal * (t - tau * gained) - column.drop_m) / (terminal * gained);
    t -= step;
    if (Math.abs(step) <= 1e-14 * t) break;
  }
  return t;
}

/** The engine's `PlateFigures`. */
export interface PlateFigures {
  teeth: number;
  mass_kg: number;
  brake_n_s_per_m: number;
  fall_time_s: number;
  share: number | null;
  terminal_m_s: number | null;
  time_constant_s: number | null;
  heat_w: number | null;
  ripple: number | null;
  reaction: number | null;
}

function ripple(samples: number[], mean: number): number {
  const spread = Math.max(...samples) - Math.min(...samples);
  return spread > 1e-12 * mean ? spread / mean : 0.0;
}

export function figures(column: MagnetColumn, plate: Plate): PlateFigures {
  const sigma = MATERIALS[plate.material][0];
  const [n, h] = teeth(plate);
  const m = massKg(plate);
  const c = brake(column, plate);
  const fall = fallTimeS(column, plate);
  if (c === 0)
    return {
      teeth: n,
      mass_kg: m,
      brake_n_s_per_m: 0.0,
      fall_time_s: fall,
      share: null,
      terminal_m_s: null,
      time_constant_s: null,
      heat_w: null,
      ripple: null,
      reaction: null,
    };
  const sheet = (sigma * plate.thickness_m * plate.width_m * n * h * column.field_t ** 2) / 2;
  const terminal = (m * G) / c;
  const samples = Array.from({ length: RIPPLE_SAMPLES }, (_, j) =>
    brakeAt(column, plate, (column.pitch_m * j) / RIPPLE_SAMPLES),
  );
  return {
    teeth: n,
    mass_kg: m,
    brake_n_s_per_m: c,
    fall_time_s: fall,
    share: c / sheet,
    terminal_m_s: terminal,
    time_constant_s: m / c,
    heat_w: m * G * terminal,
    ripple: ripple(samples, c),
    reaction: (terminal * MU0 * sigma * plate.thickness_m) / 2,
  };
}

/** The eddy currents' stream function `ψ` (A/m) at `(xM, yM)` on the plate,
 *  `xM` from its middle, `yM` up from its lower edge, from the first `terms`
 *  loops: the currents run along its lines, anticlockwise round a high one. */
export function stream(
  column: MagnetColumn,
  plate: Plate,
  fallenM: number,
  speedMS: number,
  xM: number,
  yM: number,
  terms: number,
): number {
  const sigma = MATERIALS[plate.material][0];
  const [n, h] = teeth(plate);
  const half = plate.width_m / 2;
  const pitch = h + plate.slot_m;
  const tooth = Math.min(n - 1, Math.max(0, Math.floor(yM / pitch)));
  const local = yM - tooth * pitch;
  if (!(local >= 0 && local <= h && Math.abs(xM) <= half) || sigma === 0) return 0.0;
  const k = (2 * Math.PI) / column.pitch_m;
  const phase = phases(column, plate, fallenM)[tooth];
  const cosP = Math.cos(phase);
  const sinP = Math.sin(phase);
  let total = 0.0;
  for (let m = 1; m <= terms; m++) {
    const q = (m * Math.PI) / h;
    const [c, s] = overlap(k, q, h);
    const bm = ((2 * column.field_t) / h) * (cosP * c - sinP * s);
    const edge =
      (Math.exp(q * (Math.abs(xM) - half)) * (1 + Math.exp(-2 * q * Math.abs(xM)))) / (1 + Math.exp(-2 * q * half));
    total -= ((sigma * speedMS * bm * Math.sin(q * local)) / q) * (1 - edge);
  }
  return total;
}
