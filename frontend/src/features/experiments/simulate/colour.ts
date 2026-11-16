/**
 * A spectrum as the eye sees it and the screen shows it, in the browser: a
 * line-for-line port of `backend/staunlabor/domain/experiments/colour.py`,
 * held to it by `simulate.test.ts`.
 *
 * Why here: the light exhibits recolour their drawings whenever the reader
 * moves a slider, from the light at every wavelength. A change to the colours
 * is made in Python first.
 */

/** The wavelengths a spectrum is given at, nm: 380 to 780 in steps of 5. */
export const WAVELENGTHS_NM: readonly number[] = Array.from({ length: 81 }, (_, k) => 380 + 5 * k);
const STEP_NM = 5.0;

/** The fit's bells, `[weight, centre nm, width below, width above]`, for x̄, ȳ and z̄. */
const LOBES: readonly (readonly (readonly [number, number, number, number])[])[] = [
  [
    [1.056, 599.8, 37.9, 31.0],
    [0.362, 442.0, 16.0, 26.7],
    [-0.065, 501.1, 20.4, 26.2],
  ],
  [
    [0.821, 568.8, 46.9, 40.5],
    [0.286, 530.9, 16.3, 31.1],
  ],
  [
    [1.217, 437.0, 11.8, 36.0],
    [0.681, 459.0, 26.0, 13.8],
  ],
];

const TO_RGB: readonly (readonly [number, number, number])[] = [
  [3.2406, -1.5372, -0.4986],
  [-0.9689, 1.8758, 0.0415],
  [0.0557, -0.204, 1.057],
];

const C2 = 1.438776877e-2;
const PLANCK_REFERENCE_NM = 560.0;

export type Rgb = [number, number, number];

function bell(nm: number, centre: number, below: number, above: number): number {
  const width = nm < centre ? below : above;
  return Math.exp(-0.5 * ((nm - centre) / width) ** 2);
}

export function matching(nm: number): Rgb {
  const [x, y, z] = LOBES.map((lobes) => lobes.reduce((sum, [w, c, lo, hi]) => sum + w * bell(nm, c, lo, hi), 0));
  return [x, y, z];
}

/** The observer at every wavelength, once: the same numbers `matching` gives. */
const MATCHING = WAVELENGTHS_NM.map(matching);

export function planck(nm: number, kelvin: number): number {
  const lam = nm * 1e-9;
  const ref = PLANCK_REFERENCE_NM * 1e-9;
  return ((ref / lam) ** 5 * Math.expm1(C2 / (ref * kelvin))) / Math.expm1(C2 / (lam * kelvin));
}

export function lamp(kelvin: number): number[] {
  return WAVELENGTHS_NM.map((nm) => planck(nm, kelvin));
}

export function tristimulus(power: readonly number[]): Rgb {
  let x = 0.0;
  let y = 0.0;
  let z = 0.0;
  power.forEach((p, k) => {
    const [mx, my, mz] = MATCHING[k];
    x += p * mx;
    y += p * my;
    z += p * mz;
  });
  return [x * STEP_NM, y * STEP_NM, z * STEP_NM];
}

export function linearRgb(xyz: readonly number[]): Rgb {
  const [r, g, b] = TO_RGB.map((row) => row[0] * xyz[0] + row[1] * xyz[1] + row[2] * xyz[2]);
  return [r, g, b];
}

/** The light `source` after the exhibit multiplied each wavelength by
 *  `factors`, relative to the source's own white. `white` may be passed when
 *  it is known: `linearRgb(tristimulus(source))`. */
export function seen(source: readonly number[], factors: readonly number[], white?: Rgb): Rgb {
  const w = white ?? linearRgb(tristimulus(source));
  const light = linearRgb(tristimulus(source.map((s, k) => s * factors[k])));
  return [light[0] / w[0], light[1] / w[1], light[2] / w[2]];
}

function encode(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

export function onScreen(rgb: readonly number[]): Rgb {
  let clipped = rgb.map((c) => Math.max(0.0, c));
  const top = Math.max(...clipped);
  if (top > 1) clipped = clipped.map((c) => c / top);
  return [encode(clipped[0]), encode(clipped[1]), encode(clipped[2])];
}

/** A screen colour as CSS writes it. */
export function css(rgb: readonly number[]): string {
  const byte = (c: number) => Math.round(Math.min(1, Math.max(0, c)) * 255);
  return `rgb(${byte(rgb[0])} ${byte(rgb[1])} ${byte(rgb[2])})`;
}
