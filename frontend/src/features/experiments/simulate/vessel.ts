/**
 * The draining vessel, in the browser: a line-for-line port of
 * `backend/staunlabor/domain/experiments/vessel.py` — the level stepped by
 * Runge–Kutta as the holes are opened and closed, the jets, the closed form for
 * one hole and the figures — held to it by `simulate.test.ts`.
 *
 * Why here: a hand pulls a plug or puts it back at any moment, and the level
 * and the jets must answer within the frame. There is no route; a change to
 * the physics is made in Python first.
 */

import { G } from "./constants";
import { roundHalfEven } from "./python";

/** The step: 5 ms. */
export const STEP_S = 0.005;
/** Samples a run returns per second. */
export const SAMPLES_PER_S = 10;
/** The longest run the engine takes. */
export const MAX_DURATION_S = 1200.0;
/** The widest hole, as a share of the tube's diameter. */
export const WIDEST_HOLE = 0.25;
/** The share of the emptying time in which half the depth over a hole runs out: `1 − 1/√2`. */
export const HALF_SHARE = 1 - 1 / Math.sqrt(2);

/** The engine's `DrainingVessel`. */
export interface DrainingVessel {
  diameter_m: number;
  height_m: number;
  fill_m: number;
  holes_m: number[];
  hole_diameter_m: number;
  discharge: number;
  stand_m: number;
}

/** `μ·a/A`. */
export function rateConstant(vessel: DrainingVessel): number {
  return vessel.discharge * (vessel.hole_diameter_m / vessel.diameter_m) ** 2;
}

/** Torricelli's `√(2g·(h − y))`; none from a hole above the level. */
export function jetSpeed(levelM: number, holeM: number): number {
  return Math.sqrt(2 * G * Math.max(0.0, levelM - holeM));
}

/** `2·√((h − y)·(s + y))`: where the jet lands, from the wall. */
export function jetRange(vessel: DrainingVessel, levelM: number, holeM: number): number {
  return 2 * Math.sqrt(Math.max(0.0, levelM - holeM) * (vessel.stand_m + holeM));
}

/** The jet's height over the basin's floor at `xM` from the wall. */
export function jetPath(vessel: DrainingVessel, levelM: number, holeM: number, xM: number): number {
  const start = vessel.stand_m + holeM;
  const v = jetSpeed(levelM, holeM);
  if (v === 0) return start;
  return Math.max(0.0, start - (G * xM * xM) / (2 * v * v));
}

/** `dh/dt`, m/s: the open holes below the level together. */
export function fallRate(vessel: DrainingVessel, levelM: number, opened: readonly boolean[]): number {
  const k = rateConstant(vessel);
  let total = 0.0;
  vessel.holes_m.forEach((y, i) => {
    if (opened[i] && levelM > y) total += Math.sqrt(2 * G * (levelM - y));
  });
  return -k * total;
}

/** The water leaving all open holes, in litres a minute. */
export function outflow(vessel: DrainingVessel, levelM: number, opened: readonly boolean[]): number {
  const area = (Math.PI * vessel.diameter_m ** 2) / 4;
  return -area * fallRate(vessel, levelM, opened) * 60000;
}

function floorM(vessel: DrainingVessel, levelM: number, opened: readonly boolean[]): number | null {
  const below = vessel.holes_m.filter((y, i) => opened[i] && y < levelM);
  return below.length ? Math.min(...below) : null;
}

/** The level `dtS` later: one Runge–Kutta step, held at the lowest open hole below the level. */
export function step(vessel: DrainingVessel, levelM: number, opened: readonly boolean[], dtS: number): number {
  const floor = floorM(vessel, levelM, opened);
  if (floor === null) return levelM;
  const k1 = fallRate(vessel, levelM, opened);
  const k2 = fallRate(vessel, levelM + (dtS / 2) * k1, opened);
  const k3 = fallRate(vessel, levelM + (dtS / 2) * k2, opened);
  const k4 = fallRate(vessel, levelM + dtS * k3, opened);
  return Math.max(floor, levelM + (dtS / 6) * (k1 + 2 * k2 + 2 * k3 + k4));
}

/** The level `tS` after the hole at `holeM` alone is opened under a full tube (closed form). */
export function levelExact(vessel: DrainingVessel, holeM: number, tS: number): number {
  const head = vessel.fill_m - holeM;
  if (head <= 0) return vessel.fill_m;
  const root = Math.max(0.0, Math.sqrt(head) - rateConstant(vessel) * Math.sqrt(G / 2) * Math.max(0, tS));
  return holeM + root * root;
}

/** `T = (A/μa)·√(2·(h₀ − y)/g)`. */
export function drainTime(vessel: DrainingVessel, holeM: number): number {
  const head = Math.max(0.0, vessel.fill_m - holeM);
  return Math.sqrt((2 * head) / G) / rateConstant(vessel);
}

/** The engine's `Plug`: at `at_s` the hand pulls hole `hole`'s plug or puts it back. */
export interface Plug {
  at_s: number;
  hole: number;
  opened: boolean;
}

/** The engine's `DrainRun`. */
export interface DrainRun {
  t_s: number[];
  level_m: number[];
  outflow_l_min: number[];
  ranges_m: number[][];
}

/** The engine's `run`: every hole plugged, the hand's plugs at the first step at or after their moment. */
export function run(vessel: DrainingVessel, plugs: readonly Plug[], durationS: number, stepS = STEP_S): DrainRun {
  const pending = [...plugs].sort((a, b) => a.at_s - b.at_s);
  const opened = vessel.holes_m.map(() => false);
  let level = vessel.fill_m;
  const steps = Math.ceil(durationS / stepS - 1e-9);
  const every = Math.max(1, roundHalfEven(1 / (SAMPLES_PER_S * stepS)));
  const out: DrainRun = { t_s: [], level_m: [], outflow_l_min: [], ranges_m: vessel.holes_m.map(() => []) };
  for (let n = 0; n <= steps; n++) {
    const t = n * stepS;
    while (pending.length && pending[0].at_s <= t) {
      const plug = pending.shift()!;
      opened[plug.hole] = plug.opened;
    }
    if (n % every === 0 || n === steps) {
      out.t_s.push(t);
      out.level_m.push(level);
      out.outflow_l_min.push(outflow(vessel, level, opened));
      vessel.holes_m.forEach((y, i) => out.ranges_m[i].push(opened[i] ? jetRange(vessel, level, y) : 0.0));
    }
    if (n < steps) level = step(vessel, level, opened, stepS);
  }
  return out;
}

/**
 * The page's clock, frame by frame: whole steps of `STEP_S` counted from the
 * fill, as `run` takes them, up to `toS`; a plug pulled between two frames acts
 * on the next step, as a hand's plug in `run` at that step's moment.
 */
export interface Draining {
  steps: number;
  level_m: number;
}

export function filled(vessel: DrainingVessel): Draining {
  return { steps: 0, level_m: vessel.fill_m };
}

export function advance(
  vessel: DrainingVessel,
  state: Draining,
  opened: readonly boolean[],
  toS: number,
  stepS = STEP_S,
): Draining {
  let { steps, level_m: level } = state;
  while ((steps + 1) * stepS <= toS + 1e-12) {
    level = step(vessel, level, opened, stepS);
    steps += 1;
  }
  return { steps, level_m: level };
}

/** The engine's `VesselFigures`. */
export interface VesselFigures {
  rate_constant: number;
  drain_s: number;
  half_s: number;
  speed_m_s: number;
  outflow_l_min: number;
  ranges_m: number[];
  farthest_hole_m: number | null;
  farthest_m: number;
  volume_l: number;
  approach: number;
}

export function figures(vessel: DrainingVessel): VesselFigures {
  const lowest = vessel.holes_m[0];
  const alone = vessel.holes_m.map((_, i) => i === 0);
  const drain = drainTime(vessel, lowest);
  const best = (vessel.fill_m - vessel.stand_m) / 2;
  const k = rateConstant(vessel);
  return {
    rate_constant: k,
    drain_s: drain,
    half_s: HALF_SHARE * drain,
    speed_m_s: jetSpeed(vessel.fill_m, lowest),
    outflow_l_min: outflow(vessel, vessel.fill_m, alone),
    ranges_m: vessel.holes_m.map((y) => jetRange(vessel, vessel.fill_m, y)),
    farthest_hole_m: best >= 0 ? best : null,
    farthest_m: best >= 0 ? vessel.fill_m + vessel.stand_m : jetRange(vessel, vessel.fill_m, 0.0),
    volume_l: ((Math.PI * vessel.diameter_m ** 2) / 4) * Math.max(0.0, vessel.fill_m - lowest) * 1000,
    approach: k * k,
  };
}
