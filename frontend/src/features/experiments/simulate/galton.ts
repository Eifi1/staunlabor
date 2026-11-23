/**
 * The Galton board, in the browser: a line-for-line port of
 * `backend/staunlabor/domain/experiments/galton.py` — the shares row by row,
 * the paths, the normal curve, the seeded generator (Mulberry32) and a run's
 * balls — held to it by `simulate.test.ts`.
 *
 * Why here: the page drops the balls one by one in its frame loop, and a new
 * seed, row count or tilt must give its run at once. The generator works on
 * 32-bit integers (`Math.imul`, `>>>`), so a seed gives the same balls here as
 * in the engine, bit for bit. There is no route; a change is made in Python
 * first.
 */

/** The most rows and balls the page builds. */
export const MOST_ROWS = 24;
export const MOST_BALLS = 5000;

/** The engine's `Drop`. */
export interface Drop {
  bins: number[];
  counts: number[];
  mean: number;
  variance: number;
}

/** The engine's `Figures`. */
export interface GaltonFigures {
  mean: number;
  variance: number;
  spread: number;
  peak_bin: number;
  peak_share: number;
  paths: number;
}

/** Each bin's share of the balls, `0` to `rows`, row by row. */
export function shares(rows: number, p: number): number[] {
  const q = 1 - p;
  let row = [1.0];
  for (let j = 0; j < rows; j++) {
    const next: number[] = [];
    for (let k = 0; k <= row.length; k++) {
      next.push((k > 0 ? row[k - 1] * p : 0.0) + (k < row.length ? row[k] * q : 0.0));
    }
    row = next;
  }
  return row;
}

/** The paths to each bin: Pascal's triangle's row `rows`, by additions. */
export function paths(rows: number): number[] {
  let row = [1];
  for (let j = 0; j < rows; j++) {
    const next: number[] = [];
    for (let k = 0; k <= row.length; k++) next.push((k > 0 ? row[k - 1] : 0) + (k < row.length ? row[k] : 0));
    row = next;
  }
  return row;
}

/** The normal curve of the board's middle and spread at bin `k`. */
export function normal(rows: number, p: number, k: number): number {
  const mean = rows * p;
  const variance = rows * p * (1 - p);
  return Math.exp(-((k - mean) ** 2) / (2 * variance)) / Math.sqrt(2 * Math.PI * variance);
}

export function figures(rows: number, p: number): GaltonFigures {
  const s = shares(rows, p);
  let peak = 0;
  for (let k = 1; k < s.length; k++) if (s[k] > s[peak]) peak = k;
  const variance = rows * p * (1 - p);
  return {
    mean: rows * p,
    variance,
    spread: Math.sqrt(variance),
    peak_bin: peak,
    peak_share: s[peak],
    paths: 2 ** rows,
  };
}

/** `count` draws in [0, 1) from Mulberry32 started at `seed`. */
export function uniforms(seed: number, count: number): number[] {
  let state = seed >>> 0;
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
    out.push(((t ^ (t >>> 14)) >>> 0) / 4294967296);
  }
  return out;
}

/** Each ball's turns, row by row: `true` where it went right. */
export function turns(rows: number, p: number, balls: number, seed: number): boolean[][] {
  const u = uniforms(seed, rows * balls);
  return Array.from({ length: balls }, (_, i) => Array.from({ length: rows }, (_, j) => u[i * rows + j] < p));
}

/** A run of `balls` balls from `seed`, and each ball's turns, which the page draws. */
export function drop(rows: number, p: number, balls: number, seed: number): Drop & { turns: boolean[][] } {
  const all = turns(rows, p, balls, seed);
  const bins = all.map((path) => path.reduce((n, right) => n + (right ? 1 : 0), 0));
  const counts = Array.from({ length: rows + 1 }, () => 0);
  for (const k of bins) counts[k] += 1;
  let sum = 0;
  for (const k of bins) sum += k;
  const mean = sum / balls;
  let squares = 0;
  for (const k of bins) squares += (k - mean) ** 2;
  return { bins, counts, mean, variance: squares / balls, turns: all };
}
