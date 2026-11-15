/**
 * The Cartesian diver, in the browser: a line-for-line port of
 * `backend/staunlabor/domain/experiments/diver.py` — its bubble, its lift,
 * the depth it would hover at and its steps — held to it by `simulate.test.ts`.
 *
 * Why here: the reader's hand is a slider, and the diver must answer it every
 * frame. There is no route; a change to the physics is made in Python first.
 */

export const G = 9.80665;
export const WATER_DENSITY = 998.0;
export const SURFACE_PA = 101325.0;
const DRAG_COEFFICIENT = 1.0;
/** The step the motion is integrated with, s. */
export const STEP_S = 0.002;

/** The engine's `Diver`. */
export interface Diver {
  glass_kg: number;
  glass_m3: number;
  air_m3: number;
  diameter_m: number;
}

/** The engine's `Bottle`. */
export interface Bottle {
  depth_m: number;
}

export function bubbleM3(diver: Diver, depthM: number, squeezePa: number): number {
  return (diver.air_m3 * SURFACE_PA) / (SURFACE_PA + squeezePa + WATER_DENSITY * G * Math.max(0.0, depthM));
}

export function liftN(diver: Diver, depthM: number, squeezePa: number): number {
  return WATER_DENSITY * G * (diver.glass_m3 + bubbleM3(diver, depthM, squeezePa)) - diver.glass_kg * G;
}

const neededM3 = (diver: Diver) => diver.glass_kg / WATER_DENSITY - diver.glass_m3;

export function hoverDepthM(diver: Diver, squeezePa: number): number {
  return ((SURFACE_PA * diver.air_m3) / neededM3(diver) - SURFACE_PA - squeezePa) / (WATER_DENSITY * G);
}

function accel(diver: Diver, depthM: number, speed: number, squeezePa: number): number {
  const volume = diver.glass_m3 + bubbleM3(diver, depthM, squeezePa);
  const inertia = diver.glass_kg + 0.5 * WATER_DENSITY * volume;
  const area = (Math.PI * diver.diameter_m ** 2) / 4;
  const drag = 0.5 * WATER_DENSITY * DRAG_COEFFICIENT * area * speed * Math.abs(speed);
  return (diver.glass_kg * G - WATER_DENSITY * G * volume - drag) / inertia;
}

/** One step of `STEP_S`: `[depth, downward speed]`, stopped at the surface and on the bottom. */
export function step(diver: Diver, bottle: Bottle, depthM: number, speed: number, squeezePa: number): [number, number] {
  const f = (z: number, v: number): [number, number] => [v, accel(diver, z, v, squeezePa)];
  const h = STEP_S;
  const k1 = f(depthM, speed);
  const k2 = f(depthM + (h / 2) * k1[0], speed + (h / 2) * k1[1]);
  const k3 = f(depthM + (h / 2) * k2[0], speed + (h / 2) * k2[1]);
  const k4 = f(depthM + h * k3[0], speed + h * k3[1]);
  const z = depthM + (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
  const v = speed + (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
  if (z <= 0) return [0.0, 0.0];
  if (z >= bottle.depth_m) return [bottle.depth_m, 0.0];
  return [z, v];
}

/** The engine's `DiverFigures`. */
export interface DiverFigures {
  reserve_kg: number;
  hover_bubble_m3: number;
  sinking_pa: number;
  bottom_pa: number;
}

export function figures(diver: Diver, bottle: Bottle): DiverFigures {
  const sinking = (SURFACE_PA * diver.air_m3) / neededM3(diver) - SURFACE_PA;
  return {
    reserve_kg: liftN(diver, 0.0, 0.0) / G,
    hover_bubble_m3: neededM3(diver),
    sinking_pa: sinking,
    bottom_pa: sinking - WATER_DENSITY * G * bottle.depth_m,
  };
}
