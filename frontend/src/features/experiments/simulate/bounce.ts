/**
 * The bouncing ball, in the browser: a line-for-line port of
 * `backend/staunlabor/domain/experiments/bounce.py` — the flights with the
 * air's drag, the strikes, the series' closed-form rest and the figures — held
 * to it by `simulate.test.ts`.
 *
 * Why here: the ball is drawn and clicks every frame, and a slider that
 * changes its restitution must change the rhythm at once. There is no route; a
 * change to the physics is made in Python first.
 */

import { G } from "./constants";

const AIR_DENSITY = 1.204;
const DRAG_COEFFICIENT = 0.47;
const SHORTEST_FLIGHT_S = 1e-4;
/** A bounce counts while its flight lasts at least this long. */
const COUNTED_FLIGHT_S = 0.01;

/** The engine's `BouncingBall`. */
export interface BouncingBall {
  mass_kg: number;
  diameter_m: number;
  restitution: number;
}

export function terminalSpeed(ball: BouncingBall): number {
  const area = (Math.PI * ball.diameter_m ** 2) / 4;
  return Math.sqrt((2 * ball.mass_kg * G) / (AIR_DENSITY * DRAG_COEFFICIENT * area));
}

const lnCosh = (u: number) => Math.log1p(2 * Math.sinh(u / 2) ** 2);

/** `[t, h]`: thrown up at `speed`, how long to the top and how high. */
function rise(speed: number, terminal: number): [number, number] {
  const ratio = speed / terminal;
  return [(terminal / G) * Math.atan(ratio), (terminal ** 2 / (2 * G)) * Math.log1p(ratio * ratio)];
}

/** `[v, t]`: let go at rest `height` up, how fast it lands and when. */
function fall(height: number, terminal: number): [number, number] {
  const landing = terminal * Math.sqrt(-Math.expm1((-2 * G * height) / terminal ** 2));
  return [landing, (terminal / G) * Math.atanh(landing / terminal)];
}

/** The engine's `Bounces`. */
export interface Bounces {
  impacts_s: number[];
  speeds_m_s: number[];
  apexes_m: number[];
  still_s: number;
}

export function bounces(ball: BouncingBall, heightM: number): Bounces {
  const terminal = terminalSpeed(ball);
  const e = ball.restitution;
  let [speed, t] = fall(heightM, terminal);
  const impacts = [t];
  const speeds = [speed];
  const apexes: number[] = [];
  for (;;) {
    const out = e * speed;
    const [upS, apex] = rise(out, terminal);
    const [landing, downS] = fall(apex, terminal);
    if (upS + downS < SHORTEST_FLIGHT_S)
      return { impacts_s: impacts, speeds_m_s: speeds, apexes_m: apexes, still_s: t + (2 * out) / (G * (1 - e)) };
    apexes.push(apex);
    t += upS + downS;
    speed = landing;
    impacts.push(t);
    speeds.push(speed);
  }
}

/** The last index whose value is at most `x` (`bisect_right − 1`). */
function lastAtMost(values: number[], x: number): number {
  let lo = 0;
  let hi = values.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (values[mid] <= x) lo = mid + 1;
    else hi = mid;
  }
  return lo - 1;
}

/** `[y, v]` `tS` after the ball is let go. Before it (a negative time, the
 *  page's ball held over the plate) it waits at the top, where the engine
 *  refuses to be asked. */
export function state(ball: BouncingBall, heightM: number, run: Bounces, tS: number): [number, number] {
  if (tS < 0) return [heightM, 0];
  const terminal = terminalSpeed(ball);
  if (tS < run.impacts_s[0]) {
    const u = (G * tS) / terminal;
    return [heightM - (terminal ** 2 / G) * lnCosh(u), -terminal * Math.tanh(u)];
  }
  const i = lastAtMost(run.impacts_s, tS);
  if (i >= run.apexes_m.length) return [0.0, 0.0];
  const tau = tS - run.impacts_s[i];
  const out = ball.restitution * run.speeds_m_s[i];
  const lead = Math.atan(out / terminal);
  const upS = (terminal / G) * lead;
  if (tau <= upS) {
    const x = (G * tau) / terminal;
    const y = (terminal ** 2 / G) * Math.log1p(-2 * Math.sin(x / 2) ** 2 + Math.tan(lead) * Math.sin(x));
    return [y, terminal * Math.tan(lead - x)];
  }
  const u = (G * (tau - upS)) / terminal;
  return [run.apexes_m[i] - (terminal ** 2 / G) * lnCosh(u), -terminal * Math.tanh(u)];
}

/** The engine's `BounceFigures`. */
export interface BounceFigures {
  terminal_m_s: number;
  landing_s: number;
  first_apex_m: number;
  first_flight_s: number;
  still_s: number;
  counted: number;
  rhythm: number;
}

export function figures(ball: BouncingBall, heightM: number): BounceFigures {
  const run = bounces(ball, heightM);
  const flights = run.impacts_s.slice(1).map((b, i) => b - run.impacts_s[i]);
  return {
    terminal_m_s: terminalSpeed(ball),
    landing_s: run.impacts_s[0],
    first_apex_m: run.apexes_m[0],
    first_flight_s: flights[0],
    still_s: run.still_s,
    counted: flights.filter((f) => f >= COUNTED_FLIGHT_S).length,
    rhythm: flights[1] / flights[0],
  };
}
