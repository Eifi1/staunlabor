/**
 * The water parabola, in the browser: a line-for-line port of
 * `backend/staunlabor/domain/experiments/parabola.py`, held to it by
 * `simulate.test.ts`.
 *
 * The page turns the vessel as the reader moves the slider and lets the water
 * follow over its spin-up time, frame by frame, redrawing the surface each
 * time — so there is no route; the surface, the rates and the spin-up are
 * asked of this port. A change to the physics is made in Python first.
 */

import { G } from "./constants";
import { MAX_DURATION_S, rk4, sampleEvery } from "./numerics";
import { roundHalfEven } from "./python";

/** Water's kinematic viscosity at 20 °C, m²/s. */
const NU = 1.0e-6;
/** The spin-up's step. */
export const SPIN_STEP_S = 0.01;
/** The points a profile is drawn with, rim to rim. */
const PROFILE_POINTS = 61;

export interface Vessel {
  radius_m: number;
  height_m: number;
  fill_m: number;
}

/** The engine's `Surface`. */
export interface Surface {
  rate_rad_s: number;
  centre_m: number;
  rim_m: number;
  dry_radius_m: number;
  spills: boolean;
  focus_m: number | null;
}

function check(rate: number): void {
  if (rate < 0) throw new RangeError("the rate is given as a positive number of radians a second");
}

export function dryRate(v: Vessel): number {
  return (2 * Math.sqrt(G * v.fill_m)) / v.radius_m;
}

export function surface(v: Vessel, rate: number): Surface {
  check(rate);
  const w2 = rate * rate;
  let centre: number;
  let rim: number;
  let dry: number;
  if (rate <= dryRate(v)) {
    centre = v.fill_m - (w2 * v.radius_m ** 2) / (4 * G);
    rim = v.fill_m + (w2 * v.radius_m ** 2) / (4 * G);
    dry = 0.0;
  } else {
    centre = 0.0;
    rim = v.radius_m * rate * Math.sqrt(v.fill_m / G);
    dry = Math.sqrt(v.radius_m ** 2 - (2 * v.radius_m * Math.sqrt(G * v.fill_m)) / rate);
  }
  return {
    rate_rad_s: rate,
    centre_m: centre,
    rim_m: rim,
    dry_radius_m: dry,
    spills: rim > v.height_m,
    focus_m: rate > 0 ? G / (2 * w2) : null,
  };
}

export function heightAt(s: Surface, r: number): number {
  const rise = s.rate_rad_s ** 2 / (2 * G);
  if (s.dry_radius_m > 0) return Math.max(0.0, rise * (r * r - s.dry_radius_m ** 2));
  return s.centre_m + rise * r * r;
}

export function profile(v: Vessel, rate: number): number[] {
  const s = surface(v, rate);
  const n = PROFILE_POINTS - 1;
  return Array.from({ length: n + 1 }, (_, i) => heightAt(s, Math.abs(-v.radius_m + (2 * v.radius_m * i) / n)));
}

export function spillRate(v: Vessel): number {
  const wet = (2 * Math.sqrt(G * (v.height_m - v.fill_m))) / v.radius_m;
  if (wet <= dryRate(v)) return wet;
  return v.height_m / (v.radius_m * Math.sqrt(v.fill_m / G));
}

export function spinUpTimeS(v: Vessel, rate: number): number | null {
  return rate > 0 ? v.fill_m / Math.sqrt(NU * rate) : null;
}

/** `dω/dt = (ω_v − ω)/τ`, τ at the faster of the two rates. */
function spinRhs(v: Vessel, vesselRate: number) {
  return (_t: number, y: readonly number[]): number[] => {
    const fastest = Math.max(Math.abs(vesselRate), Math.abs(y[0]));
    if (fastest === 0) return [0.0];
    return [((vesselRate - y[0]) * Math.sqrt(NU * fastest)) / v.fill_m];
  };
}

/** One step of the water following the vessel: what a page calls every frame. */
export function spinStep(v: Vessel, vesselRate: number, waterRate: number, t: number, stepS = SPIN_STEP_S): number {
  return rk4(spinRhs(v, vesselRate), t, [waterRate], stepS)[0];
}

/** The engine's `SpinRun`. */
export interface SpinRun {
  t: number[];
  water_rate: number[];
  centre_m: number[];
  rim_m: number[];
}

export function spin(v: Vessel, vesselRate: number, durationS: number, startRate = 0.0, stepS = SPIN_STEP_S): SpinRun {
  check(vesselRate);
  check(startRate);
  if (!(stepS > 0 && stepS <= 0.1)) throw new RangeError("the step lies between 0 and 100 ms");
  if (!(durationS > 0 && durationS <= MAX_DURATION_S))
    throw new RangeError(`a spin lasts more than nothing and at most ${MAX_DURATION_S} s`);
  const f = spinRhs(v, vesselRate);
  let y = [startRate];
  const steps = roundHalfEven(durationS / stepS);
  const every = sampleEvery(stepS);
  const run: SpinRun = { t: [], water_rate: [], centre_m: [], rim_m: [] };
  for (let i = 0; i <= steps; i++) {
    const t = i * stepS;
    if (i % every === 0) {
      const s = surface(v, y[0]);
      run.t.push(t);
      run.water_rate.push(y[0]);
      run.centre_m.push(s.centre_m);
      run.rim_m.push(s.rim_m);
    }
    if (i < steps) y = rk4(f, t, y, stepS);
  }
  return run;
}
