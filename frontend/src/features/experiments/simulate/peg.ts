/**
 * Galileo's interrupted pendulum, in the browser: a line-for-line port of
 * `backend/staunlabor/domain/experiments/peg.py` — the three ways the bob
 * moves (round the pivot, round the peg, free) and the switches between them,
 * each found within its step by the same bisection — held to it by
 * `simulate.test.ts`.
 *
 * The page swings the bob as the reader watches, a step a millisecond, and
 * moves the peg with a finger, so there is no route. A change to the physics
 * is made in Python first.
 */

import { MAX_DURATION_S, STEP_S, G, rk4, sampleEvery, type Rhs } from "./pendulum";
import { roundHalfEven } from "./sphere";

/** Halvings that find an event within its step. */
export const BISECTIONS = 40;

export type Mode = "big" | "small" | "free";
export type Event = "caught" | "released" | "slack" | "taut" | "over_the_top";

export interface PegPendulum {
  length_m: number;
  peg_depth_m: number;
  start_deg: number;
}

export interface PegState {
  mode: Mode;
  y: number[];
  wound: boolean;
}

/** What happened in a step: when, what, and where the bob was. */
export type Happening = [number, Event, number, number];

const TO_RAD = Math.PI / 180.0;

export const smallRadiusM = (p: PegPendulum) => p.length_m - p.peg_depth_m;

/** Why the engine would refuse the build, or `null`. */
export function refusal(p: PegPendulum): "peg" | null {
  return p.peg_depth_m > 0 && p.peg_depth_m < p.length_m ? null : "peg";
}

export function start(p: PegPendulum): PegState {
  return { mode: "big", y: [p.start_deg * TO_RAD, 0.0], wound: false };
}

export function position(p: PegPendulum, s: PegState): [number, number] {
  if (s.mode === "big") return [p.length_m * Math.sin(s.y[0]), -p.length_m * Math.cos(s.y[0])];
  if (s.mode === "small") {
    const r = smallRadiusM(p);
    return [r * Math.sin(s.y[0]), -p.peg_depth_m - r * Math.cos(s.y[0])];
  }
  return [s.y[0], s.y[1]];
}

function rhsOf(p: PegPendulum, mode: Mode): Rhs {
  if (mode === "free") return (_t, y) => [y[2], y[3], 0.0, -G];
  const w2 = G / (mode === "big" ? p.length_m : smallRadiusM(p));
  return (_t, y) => [y[1], -w2 * Math.sin(y[0])];
}

function locate(f: Rhs, t: number, y0: readonly number[], h: number, event: (y: readonly number[]) => number): number {
  let lo = 0.0;
  let hi = h;
  const e0 = event(y0);
  for (let i = 0; i < BISECTIONS; i++) {
    const mid = (lo + hi) / 2;
    if (event(rk4(f, t, y0, mid)) > 0 === e0 > 0) lo = mid;
    else hi = mid;
  }
  return hi;
}

const crossed = (a: number, b: number) => (a > 0 && b < 0) || (a < 0 && b > 0);

/** One step of `h` from `s` at `t`, split at whatever happens in it. */
export function step(p: PegPendulum, state: PegState, time: number, h: number): [PegState, Happening[]] {
  const events: Happening[] = [];
  let s = state;
  let t = time;
  let left = h;
  const r = smallRadiusM(p);
  const pull = (y: readonly number[]) => r * y[1] ** 2 + G * Math.cos(y[0]);
  const stretch = (y: readonly number[]) => y[0] ** 2 + (y[1] + p.peg_depth_m) ** 2 - r * r;
  const at = (kind: Event, where: PegState): Happening => [t, kind, ...position(p, where)];
  for (let k = 0; k < 4; k++) {
    const f = rhsOf(p, s.mode);
    const y1 = rk4(f, t, s.y, left);
    if (s.mode === "big") {
      if (crossed(s.y[0], y1[0])) {
        const tau = locate(f, t, s.y, left, (y) => y[0]);
        const y = rk4(f, t, s.y, tau);
        s = { mode: "small", y: [0.0, (y[1] * p.length_m) / r], wound: s.wound };
        t += tau;
        left -= tau;
        events.push(at("caught", s));
        continue;
      }
      return [{ ...s, y: y1 }, events];
    }
    if (s.mode === "small") {
      if (pull(s.y) > 0 && pull(y1) < 0) {
        const tau = locate(f, t, s.y, left, pull);
        const [phi, rate] = rk4(f, t, s.y, tau);
        const x = r * Math.sin(phi);
        const z = -p.peg_depth_m - r * Math.cos(phi);
        s = { mode: "free", y: [x, z, r * rate * Math.cos(phi), r * rate * Math.sin(phi)], wound: s.wound };
        t += tau;
        left -= tau;
        events.push(at("slack", s));
        continue;
      }
      if (!s.wound && Math.abs(y1[0]) > Math.PI && Math.PI >= Math.abs(s.y[0])) {
        const wound: PegState = { mode: "small", y: y1, wound: true };
        events.push([t + left, "over_the_top", ...position(p, wound)]);
        return [wound, events];
      }
      if (!s.wound && crossed(s.y[0], y1[0])) {
        const tau = locate(f, t, s.y, left, (y) => y[0]);
        const y = rk4(f, t, s.y, tau);
        s = { mode: "big", y: [0.0, (y[1] * r) / p.length_m], wound: false };
        t += tau;
        left -= tau;
        events.push(at("released", s));
        continue;
      }
      return [{ ...s, y: y1 }, events];
    }
    if (stretch(s.y) < 0 && stretch(y1) >= 0) {
      const tau = locate(f, t, s.y, left, stretch);
      const [x, z, vx, vy] = rk4(f, t, s.y, tau);
      const phi = Math.atan2(x, -(z + p.peg_depth_m));
      const rate = (vx * Math.cos(phi) + vy * Math.sin(phi)) / r;
      s = { mode: "small", y: [phi, rate], wound: s.wound };
      t += tau;
      left -= tau;
      events.push(at("taut", s));
      continue;
    }
    return [{ ...s, y: y1 }, events];
  }
  return [s, events];
}

/** The engine's `PegRun`. */
export interface PegRun {
  t: number[];
  x_m: number[];
  y_m: number[];
  mode: number[];
  events: Happening[];
  peg_side_top_m: number | null;
  over_the_top: boolean;
  went_slack: boolean;
}

const MODE_CODE: Record<Mode, number> = { big: 0, small: 1, free: 2 };

export function run(p: PegPendulum, durationS: number, stepS = STEP_S): PegRun {
  if (!(stepS > 0 && stepS <= 0.01)) throw new RangeError("the step lies between 0 and 10 ms");
  if (!(durationS > 0 && durationS <= MAX_DURATION_S))
    throw new RangeError(`a run lasts more than nothing and at most ${MAX_DURATION_S} s`);
  let s = start(p);
  const steps = roundHalfEven(durationS / stepS);
  const every = sampleEvery(stepS);
  const out: PegRun = {
    t: [],
    x_m: [],
    y_m: [],
    mode: [],
    events: [],
    peg_side_top_m: null,
    over_the_top: false,
    went_slack: false,
  };
  for (let i = 0; i <= steps; i++) {
    const t = i * stepS;
    const [x, y] = position(p, s);
    if (s.mode !== "big")
      out.peg_side_top_m = out.peg_side_top_m === null ? y + p.length_m : Math.max(out.peg_side_top_m, y + p.length_m);
    if (i % every === 0) {
      out.t.push(t);
      out.x_m.push(x);
      out.y_m.push(y);
      out.mode.push(MODE_CODE[s.mode]);
    }
    if (i < steps) {
      const [next, happened] = step(p, s, t, stepS);
      s = next;
      out.events.push(...happened);
    }
  }
  out.over_the_top = out.events.some((e) => e[1] === "over_the_top");
  out.went_slack = out.events.some((e) => e[1] === "slack");
  return out;
}

export function startHeightM(p: PegPendulum): number {
  return p.length_m * (1 - Math.cos(p.start_deg * TO_RAD));
}

export function outcome(p: PegPendulum): "same_height" | "over_the_top" | "slack" {
  const h = startHeightM(p);
  const r = smallRadiusM(p);
  if (h <= r) return "same_height";
  return h >= 2.5 * r ? "over_the_top" : "slack";
}

export function slackHeightM(p: PegPendulum): number | null {
  return outcome(p) === "slack" ? (smallRadiusM(p) + 2 * startHeightM(p)) / 3 : null;
}
