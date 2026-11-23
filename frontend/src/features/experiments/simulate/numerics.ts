/**
 * The engine's stepping, as `numerics.py` holds it: the classical Runge–Kutta
 * step every shared time loop takes, the sampling of a run and the bounds
 * every stepped run keeps. These lived in `pendulum.ts`, as in the engine, and
 * moved with it.
 *
 * `rk4` takes any system `y' = f(t, y)` over a flat array; `rk4SecondOrder` is
 * the same step for `x'' = a(x, x')` kept as positions and speeds, which the
 * contact models (the ball cannon, Newton's cradle) step at a microsecond.
 * Both are the textbook's step to the bit, each sum taken left to right, as
 * the engine's are.
 *
 * Not every step in the ports: the funnel, the gyroscope, the elephant's
 * ball, the diver, the cannon's free flight and the resonance rack keep
 * theirs written out, as the engine does, because over a state of two to four
 * numbers with a cheap right-hand side the generic step costs 20 % to twice
 * the time of the whole step.
 */

import { roundHalfEven } from "./python";

/** The default step of the stepped pendulums: 1 ms. */
export const STEP_S = 1e-3;
/** Samples a run returns per second, whatever its step. */
export const SAMPLES_PER_S = 50;
/** The longest run the engine takes, so a request cannot ask for an hour. */
export const MAX_DURATION_S = 300.0;

/** A system of first-order equations, `y' = f(t, y)`. */
export type Rhs = (t: number, y: readonly number[]) => number[];

/** One classical Runge–Kutta step of `y' = f(t, y)`. */
export function rk4(f: Rhs, t: number, y: readonly number[], h: number): number[] {
  const n = y.length;
  const k1 = f(t, y);
  const k2 = f(
    t + h / 2,
    y.map((v, i) => v + (h / 2) * k1[i]),
  );
  const k3 = f(
    t + h / 2,
    y.map((v, i) => v + (h / 2) * k2[i]),
  );
  const k4 = f(
    t + h,
    y.map((v, i) => v + h * k3[i]),
  );
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) out[i] = y[i] + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
  return out;
}

/** One classical Runge–Kutta step of `x'' = a(x, x')`, positions and speeds
 *  apart: `rk4` over `(x, v)` to the bit, the speeds of each stage being the
 *  positions' rates. */
export function rk4SecondOrder(
  accelerations: (x: readonly number[], v: readonly number[]) => number[],
  x: readonly number[],
  v: readonly number[],
  h: number,
): [number[], number[]] {
  const n = x.length;
  const a1 = accelerations(x, v);
  const x2 = x.map((p, i) => p + (h / 2) * v[i]);
  const v2 = v.map((s, i) => s + (h / 2) * a1[i]);
  const a2 = accelerations(x2, v2);
  const x3 = x.map((p, i) => p + (h / 2) * v2[i]);
  const v3 = v.map((s, i) => s + (h / 2) * a2[i]);
  const a3 = accelerations(x3, v3);
  const x4 = x.map((p, i) => p + h * v3[i]);
  const v4 = v.map((s, i) => s + h * a3[i]);
  const a4 = accelerations(x4, v4);
  const nx = new Array<number>(n);
  const nv = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    nx[i] = x[i] + (h / 6) * (v[i] + 2 * v2[i] + 2 * v3[i] + v4[i]);
    nv[i] = v[i] + (h / 6) * (a1[i] + 2 * a2[i] + 2 * a3[i] + a4[i]);
  }
  return [nx, nv];
}

/** Steps between two samples: `SAMPLES_PER_S` a second. */
export function sampleEvery(stepS: number): number {
  return Math.max(1, roundHalfEven(1 / (SAMPLES_PER_S * stepS)));
}

/** The bounds of a stepped run: a step up to 10 ms, a run up to
 *  `MAX_DURATION_S`, in the engine's words. */
export function checkRun(durationS: number, stepS: number): void {
  if (!(stepS > 0 && stepS <= 0.01)) throw new RangeError("the step lies between 0 and 10 ms");
  if (!(durationS > 0 && durationS <= MAX_DURATION_S))
    throw new RangeError(`a run lasts more than nothing and at most ${MAX_DURATION_S} s`);
}
