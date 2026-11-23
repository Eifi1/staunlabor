/**
 * Kapitza's pendulum, in the browser: a line-for-line port of
 * `backend/staunlabor/domain/experiments/kapitza.py` — the rod in its shaken
 * pivot's frame, its step, the monodromy matrix over one period of the drive
 * and the Floquet multipliers read from it, the least drive that holds the
 * top, the band that swings the hanging rod up, and Kapitza's averaged
 * potential and rates — held to it by `simulate.test.ts`.
 *
 * The page shakes the rod frame by frame, a hand nudging it or holding it
 * out, and asks the multipliers for every build it is given, so there is no
 * route. A change to the physics is made in Python first.
 */

import { G } from "./constants";
import { type Rhs, rk4, STEP_S } from "./numerics";
import { TO_RAD } from "./python";

/** The engine's `KapitzaPendulum`. */
export interface KapitzaPendulum {
  length_m: number;
  amplitude_m: number;
  frequency_hz: number;
  damping_per_s: number;
}

/** The engine's `MAX_SHARE`: the most the pivot may shake, as a share of the length. */
export const MAX_SHARE = 0.3;
/** The engine's `STEPS_PER_PERIOD`. */
const STEPS_PER_PERIOD = 100;
/** The engine's `FLOQUET_STEPS`. */
const FLOQUET_STEPS = 1000;
/** The engine's `HALVINGS`. */
const HALVINGS = 40;

/** What the engine's `__post_init__` refuses, in its words; `null` for a build it takes. */
export function refusal(k: KapitzaPendulum): string | null {
  if (!(k.length_m >= 0.05 && k.length_m <= 2)) return "the rod is between 5 cm and 2 m long";
  if (!(k.amplitude_m >= 0 && k.amplitude_m <= MAX_SHARE * k.length_m))
    return `the pivot shakes by at most ${MAX_SHARE} of the rod's length`;
  if (!(k.frequency_hz >= 0 && k.frequency_hz <= 200)) return "the motor runs at 0 to 200 Hz";
  if (!(k.damping_per_s >= 0 && k.damping_per_s <= 5)) return "the damping lies between 0 and 5 per second";
  return null;
}

/** The drive's angular frequency `ω`, rad/s. */
export function rate(k: KapitzaPendulum): number {
  return 2 * Math.PI * k.frequency_hz;
}

/** The pivot below its middle at `t`, m: `a·cos ωt`. */
export function pivotM(k: KapitzaPendulum, t: number): number {
  return k.amplitude_m * Math.cos(rate(k) * t);
}

/** `(θ, θ')'`: the pendulum in its shaken pivot's frame. */
export function rhs(k: KapitzaPendulum): Rhs {
  const [length, a, w, c] = [k.length_m, k.amplitude_m, rate(k), k.damping_per_s];
  return (t, y) => {
    const [theta, omega] = y;
    return [omega, (-(G + a * w * w * Math.cos(w * t)) / length) * Math.sin(theta) - c * omega];
  };
}

/** The engine's `step_for`: the period in `STEPS_PER_PERIOD` equal parts or
 *  more, no step longer than 1 ms; 1 ms with the motor off. */
export function stepFor(k: KapitzaPendulum): number {
  if (k.frequency_hz === 0) return STEP_S;
  const period = 1 / k.frequency_hz;
  return period / Math.max(STEPS_PER_PERIOD, Math.ceil(period / STEP_S));
}

export function startState(startDeg: number): number[] {
  if (!(startDeg >= -180 && startDeg <= 180)) throw new RangeError("the rod starts between −180° and 180°");
  return [startDeg * TO_RAD, 0.0];
}

type At = "top" | "bottom";
type Matrix = [[number, number], [number, number]];

function linear(lengthM: number, amplitudeM: number, frequencyHz: number, dampingPerS: number, at: At): Rhs {
  const sign = at === "top" ? 1.0 : -1.0;
  const [a, w, c] = [amplitudeM, 2 * Math.PI * frequencyHz, dampingPerS];
  return (t, y) => {
    const s = (sign * (G + a * w * w * Math.cos(w * t))) / lengthM;
    return [y[1], s * y[0] - c * y[1], y[3], s * y[2] - c * y[3]];
  };
}

function monodromyOf(lengthM: number, amplitudeM: number, frequencyHz: number, dampingPerS: number, at: At): Matrix {
  if (!(frequencyHz > 0)) throw new RangeError("without the motor there is no period");
  const f = linear(lengthM, amplitudeM, frequencyHz, dampingPerS, at);
  const h = 1 / frequencyHz / FLOQUET_STEPS;
  let y = [1.0, 0.0, 0.0, 1.0];
  for (let i = 0; i < FLOQUET_STEPS; i++) y = rk4(f, i * h, y, h);
  return [
    [y[0], y[2]],
    [y[1], y[3]],
  ];
}

function traceDet([[m11, m12], [m21, m22]]: Matrix): [number, number] {
  return [m11 + m22, m11 * m22 - m12 * m21];
}

/** `M`: what one period of the drive does to a small deviation from the top or the bottom. */
export function monodromy(k: KapitzaPendulum, at: At = "top"): Matrix {
  return monodromyOf(k.length_m, k.amplitude_m, k.frequency_hz, k.damping_per_s, at);
}

/** The sizes of the two Floquet multipliers, larger first. */
export function multipliers(k: KapitzaPendulum, at: At = "top"): [number, number] {
  const [tr, det] = traceDet(monodromy(k, at));
  const disc = tr * tr - 4 * det;
  if (disc < 0) {
    const size = Math.sqrt(det);
    return [size, size];
  }
  const root = Math.sqrt(disc);
  const [big, small] = [Math.abs((tr + root) / 2), Math.abs((tr - root) / 2)];
  return [Math.max(big, small), Math.min(big, small)];
}

const holds = (tr: number, det: number) => Math.abs(tr) < 1 + det;

/** Whether a small deviation from the top (or the bottom) stays small. */
export function stable(k: KapitzaPendulum, at: At = "top"): boolean {
  if (k.frequency_hz === 0 || k.amplitude_m === 0) return at === "bottom";
  return holds(...traceDet(monodromy(k, at)));
}

/** Kapitza's least frequency for the top, `a·ω = √(2gl)`, Hz; `null` without shaking. */
export function kapitzaFrequencyHz(k: KapitzaPendulum): number | null {
  if (k.amplitude_m === 0) return null;
  return Math.sqrt(2 * G * k.length_m) / k.amplitude_m / (2 * Math.PI);
}

/** The engine's `least_frequency_hz`: the lowest drive at which the top holds, by the multipliers. */
export function leastFrequencyHz(k: KapitzaPendulum): number | null {
  const kapitza = kapitzaFrequencyHz(k);
  if (kapitza === null) return null;
  const at = (fHz: number) => holds(...traceDet(monodromyOf(k.length_m, k.amplitude_m, fHz, k.damping_per_s, "top")));
  let [lo, hi] = [0.5 * kapitza, 2.0 * kapitza];
  if (at(lo) || !at(hi)) throw new RangeError("the boundary lies outside half to twice Kapitza's frequency");
  for (let i = 0; i < HALVINGS; i++) {
    const mid = (lo + hi) / 2;
    if (at(mid)) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

/** The pendulum's own small swing with the motor off, Hz. */
export function ownFrequencyHz(k: KapitzaPendulum): number {
  return Math.sqrt(G / k.length_m) / (2 * Math.PI);
}

/** The engine's `swing_up_band_hz`: the drives at which the hanging rod swings itself up. */
export function swingUpBandHz(k: KapitzaPendulum): [number, number] | null {
  if (k.amplitude_m === 0) return null;
  const twice = 2 * ownFrequencyHz(k);
  const at = (fHz: number) =>
    holds(...traceDet(monodromyOf(k.length_m, k.amplitude_m, fHz, k.damping_per_s, "bottom")));
  if (at(twice)) return null;
  const edges: number[] = [];
  for (let [lo, hi] of [
    [0.6 * twice, twice],
    [2 * twice, twice],
  ]) {
    if (!at(lo)) throw new RangeError("the band reaches beyond its bracket");
    for (let i = 0; i < HALVINGS; i++) {
      const mid = (lo + hi) / 2;
      if (at(mid)) lo = mid;
      else hi = mid;
    }
    edges.push((lo + hi) / 2);
  }
  return [edges[0], edges[1]];
}

/** Kapitza's rate of the slow wobble about the top, rad/s; `null` where the top does not hold. */
export function slowRateTop(k: KapitzaPendulum): number | null {
  const square = (k.amplitude_m * rate(k)) ** 2 / (2 * k.length_m ** 2) - G / k.length_m;
  return square > 0 ? Math.sqrt(square) : null;
}

/** Kapitza's potential per unit mass of the slow motion, J/kg. */
export function effectivePotential(k: KapitzaPendulum, thetaRad: number): number {
  return -G * k.length_m * Math.cos(thetaRad) + (k.amplitude_m * rate(k) * Math.sin(thetaRad)) ** 2 / 4;
}

/**
 * The rod `steps` steps on from state `y` at step `from` of its drive's clock:
 * the engine's `run` loop, step for step (`t = i·h`, the drive's phase on the
 * same steps every period). The page's frame loop is this function, and
 * `simulate.test.ts` builds the engine's `run` from it, sample for sample.
 */
export function advance(
  k: KapitzaPendulum,
  y: readonly number[],
  from: number,
  steps: number,
  h = stepFor(k),
): number[] {
  const f = rhs(k);
  let out = [...y];
  for (let i = from; i < from + steps; i++) out = rk4(f, i * h, out, h);
  return out;
}
