/**
 * The smoke ring's engine (`domain/experiments/smoke.py`), ported for the page:
 * the volume a press squeezes out, the ring a press makes — from the reader's own
 * press as the page samples it — and the ring's flight.
 *
 * Line for line, as the other ports are: `engine-cases.json` holds the engine's
 * answers and `simulate.test.ts` holds this file to them. The page calls
 * `ringOf` when the reader lets go of the skin, and `flight` to draw what
 * follows; the figures and curves are the server's.
 */

import { roundHalfEven } from "./sphere";

export const RHO = 1.2;
export const NU = 1.5e-5;
export const FORMATION = 4.0;
export const RING_SHARE = 0.6;
export const CORE_SHARE = 0.35;
export const TURBULENT_GROWTH = 0.01;
export const FLIGHT_STEP_S = 0.01;
export const SAMPLES_PER_S = 50;
export const MAX_FLIGHT_S = 20.0;
export const CEILING_M = 3.0;

export interface Drum {
  diameter_m: number;
  depth_m: number;
  hole_m: number;
  ring_m: number;
  stroke_m: number;
  tension_n_m: number;
}

export interface Room {
  draught_m_s: number;
  turbulent_reynolds: number;
}

export interface SmokeExhibit {
  drum: Drum;
  room: Room;
}

export type Verdict = "ring" | "too_fast" | "too_slow" | "none";

export interface Ring {
  duration_s: number;
  stroke_m: number;
  stroke_ratio: number;
  trailing: boolean;
  circulation_m2_s: number;
  reynolds: number;
  radius_m: number;
  speed_m_s: number;
  peak_jet_m_s: number;
  peak_force_n: number;
  verdict: Verdict;
}

export const holeArea = (drum: Drum) => (Math.PI * drum.hole_m ** 2) / 4;

export function effectiveArea(drum: Drum): number {
  const big = drum.diameter_m / 2;
  const a = drum.ring_m / 2;
  const h = drum.hole_m / 2;
  const skin = 2 * Math.PI * ((big * big - a * a) / (4 * Math.log(big / a)) - (a * a) / 2);
  return skin + Math.PI * (a * a - h * h);
}

export function stiffnessNM(drum: Drum): number {
  return (2 * Math.PI * drum.tension_n_m) / Math.log(drum.diameter_m / drum.ring_m);
}

/** How far down a smooth press is `t` into it: half a cosine, down by `depthM`
 *  over `durationS`, at rest at both ends — the engine's `push_samples` at any
 *  time, which the page asks every frame. */
export function pressDepth(depthM: number, durationS: number, t: number): number {
  const f = Math.min(1, Math.max(0, t / durationS));
  return (depthM / 2) * (1 - Math.cos(Math.PI * f));
}

export function ringSpeed(circulation: number, radius: number, core: number): number {
  return (circulation / (4 * Math.PI * radius)) * (Math.log((8 * radius) / core) - 0.25);
}

export function ringOf(exhibit: SmokeExhibit, times: readonly number[], depths: readonly number[]): Ring {
  if (times.length !== depths.length || times.length < 2)
    throw new Error("a press is at least two samples, a time for each");
  const { drum, room } = exhibit;
  if (depths.some((d) => d < 0 || d > drum.stroke_m + 1e-9))
    throw new Error(`the ring goes down between 0 and ${drum.stroke_m} m`);
  const ratio = effectiveArea(drum) / holeArea(drum);
  const aEff = effectiveArea(drum);
  const spring = stiffnessNM(drum);
  const limit = FORMATION * drum.hole_m;
  let stroke = 0;
  let circulation = 0;
  let peakJet = 0;
  let peakForce = spring * Math.max(...depths);
  for (let k = 0; k < times.length - 1; k += 1) {
    const dt = times[k + 1] - times[k];
    if (dt <= 0) throw new Error("a press's times go forward");
    const u = (ratio * (depths[k + 1] - depths[k])) / dt;
    if (u <= 0) continue;
    peakJet = Math.max(peakJet, u);
    const mid = (depths[k] + depths[k + 1]) / 2;
    peakForce = Math.max(peakForce, spring * mid + 0.5 * RHO * u * u * aEff);
    if (stroke < limit) {
      const share = Math.min(1, (limit - stroke) / (u * dt));
      circulation += 0.5 * u * u * dt * share;
    }
    stroke += u * dt;
  }
  const radius = RING_SHARE * drum.hole_m;
  const speed = ringSpeed(circulation, radius, CORE_SHARE * radius);
  const reynolds = circulation / NU;
  const verdict: Verdict =
    circulation <= 0
      ? "none"
      : speed < room.draught_m_s
        ? "too_slow"
        : reynolds > room.turbulent_reynolds
          ? "too_fast"
          : "ring";
  return {
    duration_s: times[times.length - 1] - times[0],
    stroke_m: stroke,
    stroke_ratio: stroke / drum.hole_m,
    trailing: stroke > limit,
    circulation_m2_s: circulation,
    reynolds,
    radius_m: radius,
    speed_m_s: speed,
    peak_jet_m_s: peakJet,
    peak_force_n: peakForce,
    verdict,
  };
}

export interface Flight {
  t: number[];
  x_m: number[];
  z_m: number[];
  radius_m: number[];
  speed_m_s: number[];
}

export function flight(exhibit: SmokeExhibit, ring: Ring, durationS: number): Flight {
  if (!(durationS > 0 && durationS <= MAX_FLIGHT_S)) throw new Error(`a flight lasts between 0 and ${MAX_FLIGHT_S} s`);
  const turbulent = ring.verdict === "too_fast";
  const g0 = ring.circulation_m2_s;
  const r0 = ring.radius_m;
  const a0 = CORE_SHARE * r0;
  const draught = exhibit.room.draught_m_s;
  const speed = (t: number, r: number) =>
    turbulent ? ringSpeed(g0 * (r0 / r) ** 2, r, CORE_SHARE * r) : ringSpeed(g0, r0, Math.sqrt(a0 * a0 + 4 * NU * t));
  const f = (t: number, r: number): [number, number] => {
    const u = speed(t, r);
    return [u, turbulent ? TURBULENT_GROWTH * u : 0];
  };
  const steps = roundHalfEven(durationS / FLIGHT_STEP_S);
  const every = roundHalfEven(1 / (SAMPLES_PER_S * FLIGHT_STEP_S));
  const h = FLIGHT_STEP_S;
  let z = 0;
  let r = r0;
  const out: Flight = { t: [], x_m: [], z_m: [], radius_m: [], speed_m_s: [] };
  for (let n = 0; n <= steps; n += 1) {
    const t = n * h;
    const last = z >= CEILING_M || n === steps;
    if (n % every === 0 || last) {
      out.t.push(t);
      out.x_m.push(draught * t);
      out.z_m.push(z);
      out.radius_m.push(r);
      out.speed_m_s.push(speed(t, r));
    }
    if (last) break;
    const k1 = f(t, r);
    const k2 = f(t + h / 2, r + (h / 2) * k1[1]);
    const k3 = f(t + h / 2, r + (h / 2) * k2[1]);
    const k4 = f(t + h, r + h * k3[1]);
    z += (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
    r += (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
  }
  return out;
}
