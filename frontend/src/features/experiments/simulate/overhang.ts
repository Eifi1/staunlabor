/**
 * The overhang, in the browser: a line-for-line port of
 * `backend/staunlabor/domain/experiments/overhang.py` — each layer's footing
 * and centre, whether the stack holds, how far it reaches, the furthest and
 * the even stacks — held to it by `simulate.test.ts`.
 *
 * Why here: the reader drags blocks, and the stack must say at once whether it
 * holds. There is no route; a change to the physics is made in Python first.
 */

/** The most the page stacks. */
export const MOST_BLOCKS = 20;

/** The engine's `StackLayer`. */
export interface StackLayer {
  left: number;
  right: number;
  centre: number;
  margin: number;
}

/** Each layer's footing, bottom first: block `i` spans `[lefts[i], lefts[i] + 1]`. */
export function layers(lefts: readonly number[]): StackLayer[] {
  const n = lefts.length;
  return lefts.map((x, i) => {
    const [belowLeft, belowRight] = i === 0 ? [-Infinity, 0.0] : [lefts[i - 1], lefts[i - 1] + 1];
    const left = Math.max(x, belowLeft);
    const right = Math.min(x + 1, belowRight);
    let sum = 0;
    for (let j = i; j < n; j++) sum += lefts[j];
    const centre = sum / (n - i) + 0.5;
    const margin = right > left ? Math.min(centre - left, right - centre) : -1.0;
    return { left, right, centre, margin };
  });
}

export function holds(lefts: readonly number[]): boolean {
  return layers(lefts).every((layer) => layer.margin >= -1e-12);
}

export function overhang(lefts: readonly number[]): number {
  return Math.max(...lefts) + 1;
}

/** The furthest stack of `n`, bottom first. */
export function harmonic(n: number): number[] {
  const rights: number[] = [];
  let reach = 0.0;
  for (let k = n; k >= 1; k--) {
    reach += 1 / (2 * k);
    rights.push(reach);
  }
  return rights.map((r) => r - 1);
}

/** The furthest stack of `n` in even steps, bottom first. */
export function even(n: number): number[] {
  const step = 1 / (n + 1);
  return Array.from({ length: n }, (_, i) => (i + 1) * step - 1);
}

/** The fewest blocks whose furthest stack reaches `reach` lengths out. */
export function blocksFor(reach: number): number {
  let total = 0.0;
  let n = 0;
  while (total / 2 < reach) {
    n += 1;
    total += 1 / n;
  }
  return n;
}
