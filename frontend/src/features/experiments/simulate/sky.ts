/**
 * Why the sky is blue, in the browser: a line-for-line port of
 * `backend/staunlabor/domain/experiments/sky.py` — the light scattered out of a
 * cloudy tube along its length, the light at its end, the sun's light and the
 * sky's through the air — held to it by `simulate.test.ts`.
 *
 * Why here: the reader turns the cloudiness and the sun's height, and the tube
 * is recoloured place by place from 81 wavelengths each time. There is no
 * route; a change to the optics is made in Python first.
 */

import { WAVELENGTHS_NM, lamp, onScreen, seen, tristimulus, type Rgb } from "./colour";

const REFERENCE_NM = 550.0;
export const BLUE_NM = 450.0;
export const RED_NM = 650.0;
export const LAMP_K = 3000.0;
export const SUN_K = 5778.0;
const AIR_DEPTH = 0.097;

/** The engine's `Tube`. */
export interface Tube {
  length_m: number;
  radius_m: number;
  cloudiness_per_m: number;
}

export function scattering(cloudiness: number, nm: number): number {
  return cloudiness * (REFERENCE_NM / nm) ** 4;
}

export function sideAt(tube: Tube, x: number, nm: number): number {
  return scattering(1.0, nm) * Math.exp(-scattering(tube.cloudiness_per_m, nm) * (x + tube.radius_m));
}

export function sideLight(tube: Tube, x: number): number[] {
  return WAVELENGTHS_NM.map((nm) => sideAt(tube, x, nm));
}

export function endLight(tube: Tube): number[] {
  return WAVELENGTHS_NM.map((nm) => Math.exp(-scattering(tube.cloudiness_per_m, nm) * tube.length_m));
}

export function airMass(heightDeg: number): number {
  return 1 / (Math.sin(heightDeg * (Math.PI / 180)) + 0.50572 * (heightDeg + 6.07995) ** -1.6364);
}

export function sunLight(heightDeg: number): number[] {
  const m = airMass(heightDeg);
  return WAVELENGTHS_NM.map((nm) => Math.exp(-m * scattering(AIR_DEPTH, nm)));
}

export function scatteredDown(tau: number, m: number): number {
  if (m === 1) return tau * Math.exp(-tau);
  return (-Math.exp(-tau) * Math.expm1(-(m - 1) * tau)) / (m - 1);
}

export function skyLight(heightDeg: number): number[] {
  const m = airMass(heightDeg);
  return WAVELENGTHS_NM.map((nm) => scatteredDown(scattering(AIR_DEPTH, nm), m));
}

export function hue(source: readonly number[], factors: readonly number[]): Rgb {
  const rgb = seen(source, factors);
  const top = Math.max(...rgb);
  if (top <= 0) return [0.0, 0.0, 0.0];
  return onScreen(rgb.map((c) => c / top));
}

export function brightness(source: readonly number[], factors: readonly number[]): number {
  return tristimulus(source.map((s, k) => s * factors[k]))[1] / tristimulus(source)[1];
}

/** The engine's `SkyFigures`. */
export interface SkyFigures {
  blue_over_red: number;
  end_brightness: number;
  end_blue: number;
  end_red: number;
  blue_half_m: number;
  red_wins_m: number;
}

export function figures(tube: Tube): SkyFigures {
  const source = lamp(LAMP_K);
  const blue = scattering(tube.cloudiness_per_m, BLUE_NM);
  const red = scattering(tube.cloudiness_per_m, RED_NM);
  return {
    blue_over_red: blue / red,
    end_brightness: brightness(source, endLight(tube)),
    end_blue: Math.exp(-blue * tube.length_m),
    end_red: Math.exp(-red * tube.length_m),
    blue_half_m: Math.log(2) / blue,
    red_wins_m: Math.log(blue / red) / (blue - red) - tube.radius_m,
  };
}
