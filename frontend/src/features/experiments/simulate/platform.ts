/**
 * The spinning platform's engine (`domain/experiments/platform.py`), ported for
 * the page: the moment of inertia of a posture, part by part; the pull on the
 * hands on the bar; the bearing's friction on the angular momentum; the lean a
 * sequence of moves has reached; and the sampled run the engine writes.
 *
 * Line for line, as the other ports are (`sphere.ts`, `coil.ts`):
 * `engine-cases.json` holds the engine's answers and `simulate.test.ts` holds
 * this file to them. The page calls `inertia`, `pullN` and `frictionStep` every
 * frame — the run is there so the cases can replay whole sequences.
 */

import { roundHalfEven } from "./sphere";

export const SAMPLES_PER_S = 50;
export const MAX_DURATION_S = 120.0;

export interface Body {
  mass_kg: number;
  arm_share: number;
  trunk_share: number;
  trunk_gyration_m: number;
  legs_gyration_m: number;
  shoulder_m: number;
}

export interface Platform {
  mass_kg: number;
  radius_m: number;
  friction_n_m: number;
}

export interface Posture {
  lean_m: number;
}

export interface Inertia {
  platform: number;
  legs: number;
  trunk: number;
  arms: number;
  total: number;
}

export interface Move {
  at_s: number;
  lean_m: number;
  over_s: number;
  push: number;
}

export interface PlatformRun {
  t: number[];
  rev_per_s: number[];
  inertia_kg_m2: number[];
  momentum: number[];
  energy_j: number[];
  pull_n: number[];
}

const armKg = (b: Body) => b.mass_kg * b.arm_share;
const trunkKg = (b: Body) => b.mass_kg * b.trunk_share;
const legsKg = (b: Body) => b.mass_kg * (1 - 2 * b.arm_share - b.trunk_share);

export function inertia(b: Body, plat: Platform, p: Posture): Inertia {
  const d = p.lean_m;
  const s = b.shoulder_m;
  const platform = 0.5 * plat.mass_kg * plat.radius_m ** 2;
  const legs = legsKg(b) * b.legs_gyration_m ** 2;
  const trunk = trunkKg(b) * (b.trunk_gyration_m ** 2 + d * d);
  const arms = 2 * armKg(b) * (s * s + (d * d) / 3);
  return { platform, legs, trunk, arms, total: platform + legs + trunk + arms };
}

/** What the hands hold on the bar at `omega`: the trunk and the arms, out by the lean. */
export function pullN(b: Body, p: Posture, omega: number): number {
  const d = p.lean_m;
  return omega ** 2 * d * (trunkKg(b) + armKg(b));
}

/** The bearing over `dt`: the momentum's size falls by `τ·dt`, and stops at zero. */
export function frictionStep(momentum: number, frictionNm: number, dt: number): number {
  if (momentum > 0) return Math.max(0.0, momentum - frictionNm * dt);
  return Math.min(0.0, momentum + frictionNm * dt);
}

/** The posture at `t`: each move blends from where the last left off. */
export function postureAt(start: Posture, moves: Move[], t: number): Posture {
  let lean = start.lean_m;
  for (const move of moves) {
    if (t <= move.at_s) break;
    const f = move.over_s <= 0 ? 1.0 : Math.min(1.0, (t - move.at_s) / move.over_s);
    lean += (move.lean_m - lean) * f;
  }
  return { lean_m: lean };
}

export function run(
  b: Body,
  plat: Platform,
  start: Posture,
  momentum: number,
  moves: Move[],
  durationS: number,
): PlatformRun {
  if (!(durationS > 0 && durationS <= MAX_DURATION_S))
    throw new RangeError(`a run lasts between 0 and ${MAX_DURATION_S} s`);
  const dt = 1 / SAMPLES_PER_S;
  const steps = roundHalfEven(durationS * SAMPLES_PER_S);
  const pushes = moves
    .filter((m) => m.push)
    .map((m) => [m.at_s, m.push] as [number, number])
    .sort((a, c) => a[0] - c[0] || a[1] - c[1]);
  const out: PlatformRun = { t: [], rev_per_s: [], inertia_kg_m2: [], momentum: [], energy_j: [], pull_n: [] };
  let bigL = momentum;
  let pushed = 0;
  for (let n = 0; n <= steps; n++) {
    const t = n * dt;
    while (pushed < pushes.length && pushes[pushed][0] <= t) {
      bigL += pushes[pushed][1];
      pushed += 1;
    }
    const posture = postureAt(start, moves, t);
    const i = inertia(b, plat, posture).total;
    const omega = bigL / i;
    out.t.push(t);
    out.rev_per_s.push(omega / (2 * Math.PI));
    out.inertia_kg_m2.push(i);
    out.momentum.push(bigL);
    out.energy_j.push((bigL * bigL) / (2 * i));
    out.pull_n.push(pullN(b, posture, omega));
    bigL = frictionStep(bigL, plat.friction_n_m, dt);
  }
  return out;
}
