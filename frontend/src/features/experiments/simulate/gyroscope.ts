/**
 * The gyroscope wheel, in the browser: a line-for-line port of
 * `backend/staunlabor/domain/experiments/gyroscope.py` — Lagrange's heavy
 * symmetric top, its two momenta kept, the tilt stepped by Runge–Kutta — held
 * to it by `simulate.test.ts`.
 *
 * The page lets the wheel go as the reader watches, so there is no route. The
 * engine's `run` is not ported: the page steps the wheel itself, and the test
 * samples it the engine's way. A change to the physics is made in Python first.
 */

import { G } from "./pendulum";

export const STEP_S = 1e-3;

/** (θ, θ̇, φ, ψ): rad, rad/s, rad, rad. */
export type State = [number, number, number, number];

/** The engine's `Wheel`. */
export interface Wheel {
  mass_kg: number;
  radius_m: number;
  axle_m: number;
  rpm: number;
}

/** The engine's `Release`. */
export interface Release {
  tilt_deg: number;
  steady: boolean;
}

/** The engine's `Motion`: the two kept momenta. */
export interface Motion {
  p_phi: number;
  l3: number;
}

const TO_RAD = Math.PI / 180.0;
const TO_DEG = 180.0 / Math.PI;

export const spinRadS = (w: Wheel) => (w.rpm * 2 * Math.PI) / 60;
const i3 = (w: Wheel) => w.mass_kg * w.radius_m ** 2;
const i1 = (w: Wheel) => (w.mass_kg * w.radius_m ** 2) / 2 + w.mass_kg * w.axle_m ** 2;
const torque = (w: Wheel) => w.mass_kg * G * w.axle_m;

/** The steady turn of a level axle: m·g·d/(I₃·ω₃). */
export function precessionRadS(w: Wheel): number {
  if (spinRadS(w) === 0) throw new RangeError("a still wheel does not turn: it falls");
  return torque(w) / (i3(w) * spinRadS(w));
}

/** The fast wheel's nodding rate, I₃·ω₃/I₁. */
export const nutationRadS = (w: Wheel) => (i3(w) * spinRadS(w)) / i1(w);

/** What the hands must supply to turn a level axle at `turnDegS`. */
export const suitcaseTorqueNM = (w: Wheel, turnDegS: number) => i3(w) * spinRadS(w) * turnDegS * TO_RAD;

function steadyRate(w: Wheel, theta: number): number {
  const c = Math.cos(theta);
  const l3 = i3(w) * spinRadS(w);
  if (Math.abs(c) < 1e-12) return torque(w) / l3;
  const disc = l3 * l3 - 4 * i1(w) * torque(w) * c;
  if (disc < 0) throw new RangeError("too slow a wheel has no steady turn at this tilt");
  return (l3 - Math.sqrt(disc)) / (2 * i1(w) * c);
}

export function start(w: Wheel, release: Release): [State, Motion] {
  const theta = release.tilt_deg * TO_RAD;
  const rate = release.steady && spinRadS(w) > 0 ? steadyRate(w, theta) : 0.0;
  const l3 = i3(w) * spinRadS(w);
  const pPhi = i1(w) * rate * Math.sin(theta) ** 2 + l3 * Math.cos(theta);
  return [[theta, 0.0, 0.0, 0.0], { p_phi: pPhi, l3 }];
}

/** φ̇ from the kept momenta. */
export const turnRate = (w: Wheel, m: Motion, theta: number) =>
  (m.p_phi - m.l3 * Math.cos(theta)) / (i1(w) * Math.sin(theta) ** 2);

function rates(w: Wheel, m: Motion, y: State): State {
  const [theta, td] = y;
  const s = Math.sin(theta);
  const c = Math.cos(theta);
  const pd = turnRate(w, m, theta);
  const tdd = (i1(w) * pd * pd * s * c - m.l3 * pd * s + torque(w) * s) / i1(w);
  const spin = i3(w) > 0 ? m.l3 / i3(w) : 0.0;
  return [td, tdd, pd, spin - pd * c];
}

const ahead = (y: State, k: State, h: number): State => [
  y[0] + h * k[0],
  y[1] + h * k[1],
  y[2] + h * k[2],
  y[3] + h * k[3],
];

export function step(w: Wheel, m: Motion, y: State): State {
  const h = STEP_S;
  const k1 = rates(w, m, y);
  const k2 = rates(w, m, ahead(y, k1, h / 2));
  const k3 = rates(w, m, ahead(y, k2, h / 2));
  const k4 = rates(w, m, ahead(y, k3, h));
  return [
    y[0] + (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
    y[1] + (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
    y[2] + (h / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]),
    y[3] + (h / 6) * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]),
  ];
}

/** The wheel has dropped: the axle hangs within this of straight down. */
export const HANGING_DEG = 170.0;

export const tiltDeg = (y: State) => y[0] * TO_DEG;
