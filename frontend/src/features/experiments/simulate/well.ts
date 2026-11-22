/**
 * The gravity well, in the browser: a line-for-line port of
 * `backend/staunlabor/domain/experiments/well.py` — a ball rolling round the
 * funnel z = −k/r, its spin counted as 2/5 more inertia, rolling resistance
 * against the wall's whole push — held to it by `simulate.test.ts`.
 *
 * The page rolls the ball as the reader watches, so there is no route. The
 * engine's `run` is not ported: the page advances the ride itself, and the test
 * samples it the engine's way. A change to the physics is made in Python first.
 */

import { G, RESISTANCE_FADE_M_S } from "./constants";
import { TO_RAD } from "./python";

/** 1/(1 + 2/5): the share of a push along the wall that moves a rolling ball. */
const SHARE = 5 / 7;
export const STEP_S = 1e-3;
/** Where the ball is started: this share of the rim's radius. */
const START_SHARE = 0.9;

/** The engine's `Funnel`. */
export interface Funnel {
  k_m2: number;
  rim_m: number;
  hole_m: number;
  rolling_resistance: number;
}

/** The engine's `Launch`: the aim from the rim's direction, positive towards the hole. */
export interface Launch {
  speed_m_s: number;
  aim_deg: number;
}

/** (r, ṙ, φ, φ̇): m, m/s, rad, rad/s. */
export type State = [number, number, number, number];

export const startM = (f: Funnel) => START_SHARE * f.rim_m;

export const heightM = (f: Funnel, r: number) => -f.k_m2 / r;

/** The speed that keeps the ball on a circle of radius `r`. */
export const circularSpeed = (f: Funnel, r: number) => Math.sqrt((SHARE * G * f.k_m2) / r);

export const circularPeriod = (f: Funnel, r: number) => (2 * Math.PI * r) / circularSpeed(f, r);

function start(f: Funnel, launch: Launch): State {
  const r = startM(f);
  const w = Math.sqrt(1 + (f.k_m2 / (r * r)) ** 2);
  const aim = launch.aim_deg * TO_RAD;
  const along = launch.speed_m_s * Math.cos(aim);
  const inward = launch.speed_m_s * Math.sin(aim);
  return [r, -inward / w, 0.0, along / r];
}

function rates(f: Funnel, y: State): State {
  const [r, rd, , pd] = y;
  const k = f.k_m2;
  const slope = k / (r * r);
  const bend = (-2 * k) / (r * r * r);
  const q = 1 + slope * slope;
  const w = Math.sqrt(q);
  const uS = w * rd;
  const uP = r * pd;
  const v2 = uS * uS + uP * uP;
  const normal = G / w + (bend / (q * w)) * uS * uS + (slope / (r * w)) * uP * uP;
  const resist = (f.rolling_resistance * Math.max(normal, 0.0)) / Math.sqrt(v2 + RESISTANCE_FADE_M_S ** 2);
  const qR = -resist * uS * w;
  const qP = -resist * uP * r;
  const rdd = (SHARE * (-G * slope + qR) - slope * bend * rd * rd + r * pd * pd) / q;
  const pdd = (SHARE * qP - 2 * r * rd * pd) / (r * r);
  return [rd, rdd, pd, pdd];
}

const ahead = (y: State, k: State, h: number): State => [
  y[0] + h * k[0],
  y[1] + h * k[1],
  y[2] + h * k[2],
  y[3] + h * k[3],
];

function rk4(f: Funnel, y: State, h: number): State {
  const k1 = rates(f, y);
  const k2 = rates(f, ahead(y, k1, h / 2));
  const k3 = rates(f, ahead(y, k2, h / 2));
  const k4 = rates(f, ahead(y, k3, h));
  return [
    y[0] + (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
    y[1] + (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
    y[2] + (h / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]),
    y[3] + (h / 6) * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]),
  ];
}

/** The engine's `Lap`. */
export interface Lap {
  end_s: number;
  period_s: number;
  radius_m: number;
}

export type Outcome = "rolling" | "hole" | "rim";

/** The engine's `Ride`. */
export interface Ride {
  t: number;
  y: State;
  outcome: Outcome;
  laps_done: number;
  lap_start_s: number;
  r_sum: number;
}

export function begin(f: Funnel, launch: Launch): Ride {
  return { t: 0.0, y: start(f, launch), outcome: "rolling", laps_done: 0, lap_start_s: 0.0, r_sum: 0.0 };
}

/** One step, and the lap it completes if it completes one. */
export function advance(f: Funnel, ride: Ride): [Ride, Lap | null] {
  if (ride.outcome !== "rolling") return [ride, null];
  const y = rk4(f, ride.y, STEP_S);
  const t = ride.t + STEP_S;
  let rSum = ride.r_sum + ((ride.y[0] + y[0]) / 2) * STEP_S;
  const outcome: Outcome = y[0] <= f.hole_m ? "hole" : y[0] >= f.rim_m ? "rim" : "rolling";
  let lap: Lap | null = null;
  let lapsDone = ride.laps_done;
  let lapStart = ride.lap_start_s;
  if (Math.floor(y[2] / (2 * Math.PI)) > lapsDone) {
    const mark = 2 * Math.PI * (lapsDone + 1);
    const crossed = ride.t + ((mark - ride.y[2]) / (y[2] - ride.y[2])) * STEP_S;
    const period = crossed - lapStart;
    lap = { end_s: crossed, period_s: period, radius_m: rSum / (t - lapStart) };
    lapsDone += 1;
    lapStart = crossed;
    rSum = 0.0;
  }
  return [{ t, y, outcome, laps_done: lapsDone, lap_start_s: lapStart, r_sum: rSum }, lap];
}
