/**
 * The third polarising filter, in the browser: a line-for-line port of
 * `backend/staunlabor/domain/experiments/polarizer.py` — the light after each
 * filter of a stack, ideal or real sheets — held to it by `simulate.test.ts`.
 *
 * Why here: the reader turns a filter with a finger, and the light after it,
 * the beams' arrows and the window are redrawn with every degree. There is no
 * route; a change to the optics is made in Python first.
 */

export const IDEAL_TRANSMISSION = 1.0;
export const POLAROID_TRANSMISSION = 0.76;
export const POLAROID_EXTINCTION = 1 / 500;
export const MOST_BETWEEN = 60;

/** The engine's `Sheet`: the share along a filter's axis it lets through (k₁),
 *  and the extinction ratio, the share across against along (k₂/k₁). */
export interface Sheet {
  transmission: number;
  extinction: number;
}

export const IDEAL: Sheet = { transmission: IDEAL_TRANSMISSION, extinction: 0.0 };
export const POLAROID: Sheet = { transmission: POLAROID_TRANSMISSION, extinction: POLAROID_EXTINCTION };

type Matrix = [[number, number], [number, number]];

/** Python's `math.radians`: one product by π/180. */
const radians = (deg: number) => deg * (Math.PI / 180);

function jones(angleDeg: number, sheet: Sheet): Matrix {
  const c = Math.cos(radians(angleDeg));
  const s = Math.sin(radians(angleDeg));
  const a = Math.sqrt(sheet.transmission);
  const b = Math.sqrt(sheet.transmission * sheet.extinction);
  return [
    [a * c * c + b * s * s, (a - b) * c * s],
    [(a - b) * c * s, a * s * s + b * c * c],
  ];
}

function times(m: Matrix, n: Matrix): Matrix {
  return [
    [m[0][0] * n[0][0] + m[0][1] * n[1][0], m[0][0] * n[0][1] + m[0][1] * n[1][1]],
    [m[1][0] * n[0][0] + m[1][1] * n[1][0], m[1][0] * n[0][1] + m[1][1] * n[1][1]],
  ];
}

/** The light after each filter in turn, a share of the lamp's unpolarised light. */
export function through(anglesDeg: readonly number[], sheet: Sheet = IDEAL): number[] {
  let stack: Matrix = [
    [1.0, 0.0],
    [0.0, 1.0],
  ];
  return anglesDeg.map((angle) => {
    stack = times(jones(angle, sheet), stack);
    // Python's `sum` from 0, in the same order.
    let squares = 0;
    for (const row of stack) for (const x of row) squares += x * x;
    return 0.5 * squares;
  });
}

/** Through a filter at 0°, one at `middleDeg` and one at `lastDeg`. */
export function three(middleDeg: number, sheet: Sheet = IDEAL, lastDeg = 90.0): number {
  return through([0.0, middleDeg, lastDeg], sheet)[2];
}

/** A crossed pair's axes with `between` filters turned evenly in it. */
export function evenly(between: number): number[] {
  const steps = between + 1;
  return Array.from({ length: steps + 1 }, (_, k) => (90.0 * k) / steps);
}

export function stacked(between: number, sheet: Sheet = IDEAL): number {
  const light = through(evenly(between), sheet);
  return light[light.length - 1];
}

/** The engine's `PolarizerFigures`. */
export interface PolarizerFigures {
  one: number;
  parallel: number;
  crossed: number;
  third: number;
  third_of_first: number;
  best_between: number;
  best: number;
}

export function figures(sheet: Sheet = IDEAL): PolarizerFigures {
  const one = through([0.0], sheet)[0];
  const third = three(45.0, sheet);
  const lights = Array.from({ length: MOST_BETWEEN + 1 }, (_, n) => stacked(n, sheet));
  // Python's `max` keeps the first of equals.
  let best = 0;
  lights.forEach((light, n) => {
    if (light > lights[best]) best = n;
  });
  return {
    one,
    parallel: through([0.0, 0.0], sheet)[1],
    crossed: through([0.0, 90.0], sheet)[1],
    third,
    third_of_first: third / one,
    best_between: best,
    best: lights[best],
  };
}
