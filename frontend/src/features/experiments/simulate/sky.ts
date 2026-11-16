/**
 * Why the sky is blue, in the browser: a line-for-line port of
 * `backend/staunlabor/domain/experiments/sky.py` — the light scattered out of a
 * cloudy tube along its length, the light at its end, the sun's light and the
 * sky's through the air and the ozone above it — held to it by
 * `simulate.test.ts`.
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
/** The engine's `OZONE_CROSS_SECTION_E21_CM2`: Serdyuchenko et al. (2014) at 223 K, 10⁻²¹ cm² a molecule. */
const OZONE_CROSS_SECTION_E21_CM2 = [
  0.001542, 0.002044, 0.003397, 0.006255, 0.008918, 0.01279, 0.02263, 0.02564, 0.03458, 0.06127, 0.06242, 0.08056,
  0.1303, 0.1565, 0.1737, 0.2017, 0.3467, 0.3379, 0.3785, 0.4444, 0.7188, 0.7662, 0.7692, 0.8598, 1.163, 1.545, 1.505,
  1.592, 1.768, 2.121, 2.583, 2.772, 2.851, 3.111, 3.281, 3.478, 3.87, 4.295, 4.591, 4.731, 4.56, 4.385, 4.395, 4.704,
  5.089, 5.083, 4.714, 4.303, 3.992, 3.754, 3.499, 3.228, 2.927, 2.661, 2.441, 2.24, 2.044, 1.856, 1.651, 1.468, 1.318,
  1.213, 1.077, 0.9374, 0.8182, 0.7395, 0.6882, 0.6624, 0.5902, 0.5066, 0.4433, 0.4101, 0.4037, 0.4268, 0.4096, 0.3145,
  0.2623, 0.2408, 0.2391, 0.2787, 0.3108,
];
const DOBSON_PER_CM2 = 2.6867e16;
const OZONE_COLUMN_DU = 300.0;
const OZONE_HEIGHT_KM = 22.0;
const EARTH_RADIUS_KM = 6371.0;

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

function ozoneAirMass(heightDeg: number): number {
  const ratio = EARTH_RADIUS_KM / (EARTH_RADIUS_KM + OZONE_HEIGHT_KM);
  return 1 / Math.sqrt(1 - (ratio * Math.cos(heightDeg * (Math.PI / 180))) ** 2);
}

function ozoneDepth(): number[] {
  const column = OZONE_COLUMN_DU * DOBSON_PER_CM2;
  return OZONE_CROSS_SECTION_E21_CM2.map((sigma) => sigma * 1e-21 * column);
}

export function ozoneLight(heightDeg: number): number[] {
  const m = ozoneAirMass(heightDeg);
  return ozoneDepth().map((tau) => Math.exp(-m * tau));
}

export function sunLight(heightDeg: number, ozone = true): number[] {
  const m = airMass(heightDeg);
  const air = WAVELENGTHS_NM.map((nm) => Math.exp(-m * scattering(AIR_DEPTH, nm)));
  if (!ozone) return air;
  const through = ozoneLight(heightDeg);
  return air.map((a, k) => a * through[k]);
}

export function scatteredDown(tau: number, m: number): number {
  if (m === 1) return tau * Math.exp(-tau);
  return (-Math.exp(-tau) * Math.expm1(-(m - 1) * tau)) / (m - 1);
}

export function skyLight(heightDeg: number, ozone = true): number[] {
  const m = airMass(heightDeg);
  const air = WAVELENGTHS_NM.map((nm) => scatteredDown(scattering(AIR_DEPTH, nm), m));
  if (!ozone) return air;
  const through = ozoneLight(heightDeg);
  return air.map((a, k) => a * through[k]);
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
