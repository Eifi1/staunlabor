/**
 * Maxwell's wheel, in the browser: a line-for-line port of
 * `backend/staunlabor/domain/experiments/maxwell.py`, held to it by
 * `simulate.test.ts`.
 *
 * The wheel's motion is a closed form — uniform fall and climb, a spring's jerk
 * between — so the page asks {@link stateAt} for any instant, every frame, and
 * draws the strings' pull as it is then: no route. A change to the physics is
 * made in Python first.
 */

import { G } from "./constants";
import { MAX_DURATION_S, SAMPLES_PER_S } from "./numerics";
import { roundHalfEven } from "./python";

export type Shape = "disc" | "ring";
export type Phase = "down" | "jerk" | "up";

/** I/(M·R²) for the two wheels. */
const SPIN_SHARE: Record<Shape, number> = { disc: 0.5, ring: 1.0 };

export interface MaxwellWheel {
  mass_kg: number;
  wheel_radius_m: number;
  axle_radius_m: number;
  shape: Shape;
  drop_m: number;
  loss: number;
  stiffness_n_m: number;
}

export function refusal(w: MaxwellWheel): "axle" | null {
  return w.axle_radius_m > 0 && w.axle_radius_m < w.wheel_radius_m ? null : "axle";
}

export function inertiaRatio(w: MaxwellWheel): number {
  return SPIN_SHARE[w.shape] * (w.wheel_radius_m / w.axle_radius_m) ** 2;
}

function fallAcceleration(w: MaxwellWheel): number {
  return G / (1 + inertiaRatio(w) / (1 - w.loss));
}

function climbDeceleration(w: MaxwellWheel): number {
  return G / (1 + inertiaRatio(w) / (1 + w.loss));
}

function rollTensionN(w: MaxwellWheel, phase: Phase = "down"): number {
  const a = phase === "down" ? fallAcceleration(w) : climbDeceleration(w);
  return w.mass_kg * (G - a);
}

export function rotationShare(w: MaxwellWheel): number {
  const k = inertiaRatio(w);
  return k / (1 + k);
}

/** The engine's: on strings already stretched by the rolling pull, only a↓ is left to catch. */
function jerk(w: MaxwellWheel, v: number): [number, number, number] {
  const rate = Math.sqrt(w.stiffness_n_m / w.mass_kg);
  const down = fallAcceleration(w);
  const duration = (2 * Math.PI - 2 * Math.atan((v * rate) / down)) / rate;
  const amplitude = Math.hypot(down / rate ** 2, v / rate);
  return [rate, duration, w.mass_kg * G + w.stiffness_n_m * amplitude];
}

/** The engine's `Bounce`. */
export interface Bounce {
  from_m: number;
  fall_s: number;
  bottom_speed_m_s: number;
  bottom_spin_hz: number;
  jerk_s: number;
  peak_tension_n: number;
  stretch_m: number;
  climb_s: number;
  to_m: number;
}

export function bounce(w: MaxwellWheel, heightM: number): Bounce {
  const down = fallAcceleration(w);
  const up = climbDeceleration(w);
  const fall = Math.sqrt((2 * heightM) / down);
  const v = down * fall;
  const [, duration, peak] = jerk(w, v);
  return {
    from_m: heightM,
    fall_s: fall,
    bottom_speed_m_s: v,
    bottom_spin_hz: v / (2 * Math.PI * w.axle_radius_m),
    jerk_s: duration,
    peak_tension_n: peak,
    stretch_m: peak / w.stiffness_n_m,
    climb_s: v / up,
    to_m: (v * v) / (2 * up),
  };
}

export function bounces(w: MaxwellWheel, count = 8): Bounce[] {
  const out: Bounce[] = [];
  let height = w.drop_m;
  for (let i = 0; i < count; i++) {
    const b = bounce(w, height);
    out.push(b);
    height = b.to_m;
  }
  return out;
}

/** The engine's `WheelState`. */
export interface WheelState {
  height_m: number;
  velocity_m_s: number;
  tension_n: number;
  turns: number;
  phase: Phase;
  bounce: number;
}

export function stateAt(w: MaxwellWheel, t: number): WheelState {
  if (t < 0) throw new RangeError("the wheel is let go at t = 0");
  const down = fallAcceleration(w);
  const up = climbDeceleration(w);
  const r = w.axle_radius_m;
  const circumference = 2 * Math.PI * r;
  let height = w.drop_m;
  let clock = 0.0;
  let n = 0;
  while (height > 1e-9) {
    const b = bounce(w, height);
    const sense = n % 2 === 0 ? 1 : -1;
    if (t < clock + b.fall_s) {
      const s = t - clock;
      const fallen = 0.5 * down * s * s;
      return {
        height_m: height - fallen,
        velocity_m_s: -down * s,
        tension_n: rollTensionN(w, "down"),
        turns: (sense * fallen) / circumference,
        phase: "down",
        bounce: n,
      };
    }
    clock += b.fall_s;
    const v = b.bottom_speed_m_s;
    if (t < clock + b.jerk_s) {
      const [rate] = jerk(w, v);
      const x = rate * (t - clock);
      const z = -(down / rate ** 2) * (1 - Math.cos(x)) - (v / rate) * Math.sin(x);
      const turned = height + v * (t - clock);
      return {
        height_m: z,
        velocity_m_s: -(down / rate) * Math.sin(x) - v * Math.cos(x),
        tension_n: rollTensionN(w, "down") - w.stiffness_n_m * z,
        turns: (sense * turned) / circumference,
        phase: "jerk",
        bounce: n,
      };
    }
    clock += b.jerk_s;
    const turned = height + v * b.jerk_s;
    if (t < clock + b.climb_s) {
      const s = t - clock;
      const climbed = v * s - 0.5 * up * s * s;
      return {
        height_m: climbed,
        velocity_m_s: v - up * s,
        tension_n: rollTensionN(w, "up"),
        turns: (sense * (turned + climbed)) / circumference,
        phase: "up",
        bounce: n,
      };
    }
    clock += b.climb_s;
    height = b.to_m;
    n += 1;
  }
  return { height_m: 0.0, velocity_m_s: 0.0, tension_n: w.mass_kg * G, turns: 0.0, phase: "down", bounce: n };
}

/** The engine's `WheelRun`. */
export interface WheelRun {
  t: number[];
  height_m: number[];
  velocity_m_s: number[];
  tension_n: number[];
}

export function run(w: MaxwellWheel, durationS: number, samplesPerS = SAMPLES_PER_S): WheelRun {
  if (!(durationS > 0 && durationS <= MAX_DURATION_S))
    throw new RangeError(`a run lasts more than nothing and at most ${MAX_DURATION_S} s`);
  if (!(samplesPerS >= 1 && samplesPerS <= 10000))
    throw new RangeError("between one and ten thousand samples a second");
  const n = roundHalfEven(durationS * samplesPerS);
  const out: WheelRun = { t: [], height_m: [], velocity_m_s: [], tension_n: [] };
  for (let i = 0; i <= n; i++) {
    const s = stateAt(w, i / samplesPerS);
    out.t.push(i / samplesPerS);
    out.height_m.push(s.height_m);
    out.velocity_m_s.push(s.velocity_m_s);
    out.tension_n.push(s.tension_n);
  }
  return out;
}
