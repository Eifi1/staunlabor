/**
 * The pendulum wave, in the browser: the row's lengths and how far apart it
 * comes back, ported line for line from
 * `backend/staunlabor/domain/experiments/wave.py` (`swings`, `lengths_m`,
 * `lag_deg`, `spread_deg`) and held to it by `simulate.test.ts`.
 *
 * Why here as well as on the server: the row is drawn every frame from its
 * lengths, and a slider that moves them must move the drawing at once, not a
 * round trip later. Each pendulum is the exact one (`angleDeg`), so the page
 * can show any instant of the cycle without stepping to it.
 */

import { lengthFor, periodS } from "./pendulum";

/** The engine's `PendulumWave`. */
export interface PendulumWave {
  count: number;
  cycle_s: number;
  longest_swings: number;
  tuned_deg: number;
  amplitude_deg: number;
  spacing_m: number;
}

/** `N + n`: the swings each pendulum makes in a cycle, longest first. */
export function swings(wave: PendulumWave): number[] {
  return Array.from({ length: wave.count }, (_, n) => wave.longest_swings + n);
}

/** Each pendulum's length, tuned so its swing of `tuned_deg` takes `Γ/(N + n)`. */
export function lengthsM(wave: PendulumWave): number[] {
  return swings(wave).map((s) => lengthFor(wave.cycle_s / s, wave.tuned_deg));
}

/** How far each pendulum is behind its start after one cycle, in degrees of its swing. */
export function lagDeg(wave: PendulumWave, amplitudeDeg?: number): number[] {
  const amplitude = amplitudeDeg ?? wave.amplitude_deg;
  const lengths = lengthsM(wave);
  return swings(wave).map((s, i) => 360 * (s - wave.cycle_s / periodS(lengths[i], amplitude)));
}

/** The largest lag less the smallest. */
export function spreadDeg(wave: PendulumWave, amplitudeDeg?: number): number {
  const lags = lagDeg(wave, amplitudeDeg);
  return Math.max(...lags) - Math.min(...lags);
}
