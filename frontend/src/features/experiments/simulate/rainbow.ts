/**
 * The glass-bead rainbow, in the browser: a line-for-line port of
 * `backend/staunlabor/domain/experiments/rainbow.py` — the ray through a bead,
 * the angle it leaves at, the light per angle and the ring's colours — held to
 * it by `simulate.test.ts`.
 *
 * Why here: the reader moves the ray and changes the bead's index, and the
 * ring is recoloured from 81 wavelengths each time. There is no route; a
 * change to the optics is made in Python first.
 */

import { WAVELENGTHS_NM, lamp, linearRgb, onScreen, seen, tristimulus, type Rgb } from "./colour";
import { degrees, radians } from "./python";

export const SODIUM_NM = 589.3;
export const RED_NM = 700.0;
export const VIOLET_NM = 400.0;
export const PROFILE_STEP_DEG = 0.1;
export const PROFILE_BINS = 600;
const RINGS = 2000;
const LAMP_RADIUS_DEG = 0.25;
const LAMP_K = 3000.0;
const NEAR_DEG = 1.0;

/** The engine's `Bead`. */
export interface Bead {
  index: number;
  dispersion_nm2: number;
}

export function indexAt(bead: Bead, nm: number): number {
  return bead.index + bead.dispersion_nm2 * (1 / nm ** 2 - 1 / SODIUM_NM ** 2);
}

export function exitAngle(n: number, b: number): number {
  const i = Math.asin(b);
  const r = Math.asin(b / n);
  return 4 * r - 2 * i;
}

export function rainbowImpact(n: number): number {
  return Math.sqrt((4 - n * n) / 3);
}

export function rainbowAngle(n: number): number {
  return exitAngle(n, rainbowImpact(n));
}

export function rayShare(n: number, b: number): number {
  const ci = Math.cos(Math.asin(b));
  const cr = Math.cos(Math.asin(b / n));
  const across = ((ci - n * cr) / (ci + n * cr)) ** 2;
  const along = ((n * ci - cr) / (n * ci + cr)) ** 2;
  return 0.5 * ((1 - across) ** 2 * across + (1 - along) ** 2 * along);
}

type Vec = [number, number];

/** The engine's `RayPath`. */
export interface RayPath {
  entry: Vec;
  back: Vec;
  exit: Vec;
  out: Vec;
}

function refract(d: Vec, normal: Vec, eta: number): Vec {
  const cosI = -(d[0] * normal[0] + d[1] * normal[1]);
  const cosT = Math.sqrt(Math.max(0.0, 1 - eta * eta * (1 - cosI * cosI)));
  const k = eta * cosI - cosT;
  return [eta * d[0] + k * normal[0], eta * d[1] + k * normal[1]];
}

function across(p: Vec, d: Vec): Vec {
  const t = -2 * (p[0] * d[0] + p[1] * d[1]);
  return [p[0] + t * d[0], p[1] + t * d[1]];
}

export function trace(n: number, b: number): RayPath {
  const entry: Vec = [-Math.sqrt(1 - b * b), b];
  const inside = refract([1.0, 0.0], entry, 1 / n);
  const back = across(entry, inside);
  const along = inside[0] * back[0] + inside[1] * back[1];
  const reflected: Vec = [inside[0] - 2 * along * back[0], inside[1] - 2 * along * back[1]];
  const leave = across(back, reflected);
  const out = refract(reflected, [-leave[0], -leave[1]], n);
  return { entry, back, exit: leave, out };
}

function blur(power: readonly number[]): number[] {
  const reach = Math.trunc(LAMP_RADIUS_DEG / PROFILE_STEP_DEG);
  const offsets = Array.from({ length: 2 * reach + 1 }, (_, k) => k - reach);
  const weights = offsets.map((k) => Math.sqrt(1 - ((k * PROFILE_STEP_DEG) / LAMP_RADIUS_DEG) ** 2));
  const total = weights.reduce((sum, w) => sum + w, 0);
  const out = new Array<number>(power.length).fill(0.0);
  power.forEach((p, j) => {
    offsets.forEach((k, m) => {
      let at = j + k;
      at = at < 0 ? -at - 1 : at;
      if (at < out.length) out[at] += (p * weights[m]) / total;
    });
  });
  return out;
}

function spread(n: number): number[] {
  const step = radians(PROFILE_STEP_DEG);
  const power = new Array<number>(PROFILE_BINS).fill(0.0);
  const edges = Array.from({ length: RINGS }, (_, k) => exitAngle(n, Math.sqrt(k / RINGS)));
  edges.push(exitAngle(n, 1.0));
  for (let k = 0; k < RINGS; k++) {
    const light = rayShare(n, Math.sqrt((k + 0.5) / RINGS)) / RINGS;
    const a = edges[k];
    const c = edges[k + 1];
    let pieces: [number, number, number][];
    if (a * c < 0) {
      // A ring whose rays cross the way back: the part on each side of it.
      const first = Math.abs(a) / (Math.abs(a) + Math.abs(c));
      pieces = [
        [0.0, Math.abs(a), light * first],
        [0.0, Math.abs(c), light * (1 - first)],
      ];
    } else {
      pieces = [[Math.min(Math.abs(a), Math.abs(c)), Math.max(Math.abs(a), Math.abs(c)), light]];
    }
    for (const [lo, hi, p] of pieces) {
      const firstBin = Math.trunc(lo / step);
      if (hi - lo <= 1e-15 * step) {
        if (firstBin < PROFILE_BINS) power[firstBin] += p;
        continue;
      }
      const last = Math.min(Math.trunc(hi / step), PROFILE_BINS - 1);
      for (let j = firstBin; j <= last; j++) {
        const overlap = Math.min(hi, (j + 1) * step) - Math.max(lo, j * step);
        if (overlap > 0) power[j] += (p * overlap) / (hi - lo);
      }
    }
  }
  return power;
}

export function profile(bead: Bead, nm: number): number[] {
  const step = radians(PROFILE_STEP_DEG);
  return blur(spread(indexAt(bead, nm))).map(
    (p, j) => p / (2 * Math.PI * (Math.cos(j * step) - Math.cos((j + 1) * step))),
  );
}

export function ring(bead: Bead): Rgb[] {
  const source = lamp(LAMP_K);
  const white = linearRgb(tristimulus(source));
  const profiles = WAVELENGTHS_NM.map((nm) => profile(bead, nm));
  const linear = Array.from({ length: PROFILE_BINS }, (_, j) =>
    seen(
      source,
      profiles.map((p) => p[j]),
      white,
    ),
  );
  const lo = degrees(rainbowAngle(indexAt(bead, VIOLET_NM))) - NEAR_DEG;
  const hi = degrees(rainbowAngle(indexAt(bead, RED_NM))) + NEAR_DEG;
  let brightest = -Infinity;
  const end = Math.min(PROFILE_BINS, Math.trunc(hi / PROFILE_STEP_DEG) + 1);
  for (let j = Math.max(0, Math.trunc(lo / PROFILE_STEP_DEG)); j < end; j++) {
    brightest = Math.max(brightest, 0.2126 * linear[j][0] + 0.7152 * linear[j][1] + 0.0722 * linear[j][2]);
  }
  return linear.map((rgb) => onScreen(rgb.map((c) => c / brightest)));
}

/** The engine's `RainbowFigures`. */
export interface RainbowFigures {
  angle_deg: number;
  red_deg: number;
  violet_deg: number;
  width_deg: number;
  impact: number;
  reflected: number;
  near: number;
}

export function figures(bead: Bead): RainbowFigures {
  const n = indexAt(bead, SODIUM_NM);
  const angle = degrees(rainbowAngle(n));
  const red = degrees(rainbowAngle(indexAt(bead, RED_NM)));
  const violet = degrees(rainbowAngle(indexAt(bead, VIOLET_NM)));
  const near = radians(angle - NEAR_DEG);
  let total = 0.0;
  let close = 0.0;
  for (let k = 0; k < RINGS; k++) {
    const b = Math.sqrt((k + 0.5) / RINGS);
    const light = rayShare(n, b) / RINGS;
    total += light;
    if (exitAngle(n, b) >= near) close += light;
  }
  return {
    angle_deg: angle,
    red_deg: red,
    violet_deg: violet,
    width_deg: red - violet,
    impact: rainbowImpact(n),
    reflected: total,
    near: close / total,
  };
}
