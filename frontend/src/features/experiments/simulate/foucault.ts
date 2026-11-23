/**
 * Foucault's pendulum, in the browser: a line-for-line port of
 * `backend/staunlabor/domain/experiments/foucault.py` — the linear swing on
 * the turning Earth, in closed form — held to it by `simulate.test.ts`.
 *
 * Closed, so the page can show any hour of the swing at once and run a day
 * past in a minute: no route, nothing stepped. A change to the physics is made
 * in Python first.
 */

import { G } from "./constants";
import { TO_DEG, TO_RAD } from "./python";

/** The Earth's turn against the stars, rad/s. */
const EARTH_RATE = 7.292115e-5;
/** Winterthur's latitude, degrees north. */
export const WINTERTHUR_DEG = 47.5;

export interface FoucaultPendulum {
  length_m: number;
  amplitude_m: number;
  latitude_deg: number;
}

function verticalRate(p: FoucaultPendulum): number {
  return EARTH_RATE * Math.sin(p.latitude_deg * TO_RAD);
}

export function degreesPerHour(p: FoucaultPendulum): number {
  return verticalRate(p) * TO_DEG * 3600;
}

export function fullTurnH(p: FoucaultPendulum): number | null {
  const rate = Math.abs(verticalRate(p));
  return rate > 1e-15 ? (2 * Math.PI) / rate / 3600 : null;
}

export function periodS(p: FoucaultPendulum): number {
  return (2 * Math.PI) / Math.sqrt(G / p.length_m);
}

export function position(p: FoucaultPendulum, t: number): [number, number] {
  const w0 = Math.sqrt(G / p.length_m);
  const wz = verticalRate(p);
  const wp = Math.sqrt(w0 * w0 + wz * wz);
  const re = Math.cos(wp * t);
  const im = (wz / wp) * Math.sin(wp * t);
  const c = Math.cos(wz * t);
  const s = Math.sin(wz * t);
  return [p.amplitude_m * (re * c + im * s), p.amplitude_m * (im * c - re * s)];
}

export function planeDeg(p: FoucaultPendulum, t: number): number {
  return -(verticalRate(p) * t * TO_DEG);
}

/** The engine's `LatitudePoint`. */
export interface LatitudePoint {
  latitude_deg: number;
  degrees_per_hour: number;
}

export function latitudeCurve(p: FoucaultPendulum): LatitudePoint[] {
  const out: LatitudePoint[] = [];
  for (let lat = -90; lat <= 90; lat += 5)
    out.push({ latitude_deg: lat, degrees_per_hour: degreesPerHour({ ...p, latitude_deg: lat }) });
  return out;
}
