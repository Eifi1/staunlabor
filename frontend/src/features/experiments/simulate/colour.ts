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

/** The CIE 1931 standard observer (2°), `[x̄, ȳ, z̄]` every 5 nm from 360 to 830 nm, as the CIE publishes it. */
const TABLE_FROM_NM = 360.0;
const TABLE: readonly (readonly [number, number, number])[] = [
  [0.0001299, 3.917e-6, 0.0006061], // 360
  [0.0002321, 6.965e-6, 0.001086], // 365
  [0.0004149, 1.239e-5, 0.001946], // 370
  [0.0007416, 2.202e-5, 0.003486], // 375
  [0.001368, 3.9e-5, 0.006450001], // 380
  [0.002236, 6.4e-5, 0.01054999], // 385
  [0.004243, 0.00012, 0.02005001], // 390
  [0.00765, 0.000217, 0.03621], // 395
  [0.01431, 0.000396, 0.06785001], // 400
  [0.02319, 0.00064, 0.1102], // 405
  [0.04351, 0.00121, 0.2074], // 410
  [0.07763, 0.00218, 0.3713], // 415
  [0.13438, 0.004, 0.6456], // 420
  [0.21477, 0.0073, 1.0390501], // 425
  [0.2839, 0.0116, 1.3856], // 430
  [0.3285, 0.01684, 1.62296], // 435
  [0.34828, 0.023, 1.74706], // 440
  [0.34806, 0.0298, 1.7826], // 445
  [0.3362, 0.038, 1.77211], // 450
  [0.3187, 0.048, 1.7441], // 455
  [0.2908, 0.06, 1.6692], // 460
  [0.2511, 0.0739, 1.5281], // 465
  [0.19536, 0.09098, 1.28764], // 470
  [0.1421, 0.1126, 1.0419], // 475
  [0.09564, 0.13902, 0.8129501], // 480
  [0.05795001, 0.1693, 0.6162], // 485
  [0.03201, 0.20802, 0.46518], // 490
  [0.0147, 0.2586, 0.3533], // 495
  [0.0049, 0.323, 0.272], // 500
  [0.0024, 0.4073, 0.2123], // 505
  [0.0093, 0.503, 0.1582], // 510
  [0.0291, 0.6082, 0.1117], // 515
  [0.06327, 0.71, 0.07824999], // 520
  [0.1096, 0.7932, 0.05725001], // 525
  [0.1655, 0.862, 0.04216], // 530
  [0.2257499, 0.9148501, 0.02984], // 535
  [0.2904, 0.954, 0.0203], // 540
  [0.3597, 0.9803, 0.0134], // 545
  [0.4334499, 0.9949501, 0.008749999], // 550
  [0.5120501, 1.0, 0.005749999], // 555
  [0.5945, 0.995, 0.0039], // 560
  [0.6784, 0.9786, 0.002749999], // 565
  [0.7621, 0.952, 0.0021], // 570
  [0.8425, 0.9154, 0.0018], // 575
  [0.9163, 0.87, 0.001650001], // 580
  [0.9786, 0.8163, 0.0014], // 585
  [1.0263, 0.757, 0.0011], // 590
  [1.0567, 0.6949, 0.001], // 595
  [1.0622, 0.631, 0.0008], // 600
  [1.0456, 0.5668, 0.0006], // 605
  [1.0026, 0.503, 0.00034], // 610
  [0.9384, 0.4412, 0.00024], // 615
  [0.8544499, 0.381, 0.00019], // 620
  [0.7514, 0.321, 0.0001], // 625
  [0.6424, 0.265, 4.999999e-5], // 630
  [0.5419, 0.217, 3e-5], // 635
  [0.4479, 0.175, 2e-5], // 640
  [0.3608, 0.1382, 1e-5], // 645
  [0.2835, 0.107, 0.0], // 650
  [0.2187, 0.0816, 0.0], // 655
  [0.1649, 0.061, 0.0], // 660
  [0.1212, 0.04458, 0.0], // 665
  [0.0874, 0.032, 0.0], // 670
  [0.0636, 0.0232, 0.0], // 675
  [0.04677, 0.017, 0.0], // 680
  [0.0329, 0.01192, 0.0], // 685
  [0.0227, 0.00821, 0.0], // 690
  [0.01584, 0.005723, 0.0], // 695
  [0.01135916, 0.004102, 0.0], // 700
  [0.008110916, 0.002929, 0.0], // 705
  [0.005790346, 0.002091, 0.0], // 710
  [0.004109457, 0.001484, 0.0], // 715
  [0.002899327, 0.001047, 0.0], // 720
  [0.00204919, 0.00074, 0.0], // 725
  [0.001439971, 0.00052, 0.0], // 730
  [0.0009999493, 0.0003611, 0.0], // 735
  [0.0006900786, 0.0002492, 0.0], // 740
  [0.0004760213, 0.0001719, 0.0], // 745
  [0.0003323011, 0.00012, 0.0], // 750
  [0.0002348261, 8.48e-5, 0.0], // 755
  [0.0001661505, 6e-5, 0.0], // 760
  [0.000117413, 4.24e-5, 0.0], // 765
  [8.307527e-5, 3e-5, 0.0], // 770
  [5.870652e-5, 2.12e-5, 0.0], // 775
  [4.150994e-5, 1.499e-5, 0.0], // 780
  [2.935326e-5, 1.06e-5, 0.0], // 785
  [2.067383e-5, 7.4657e-6, 0.0], // 790
  [1.455977e-5, 5.2578e-6, 0.0], // 795
  [1.025398e-5, 3.7029e-6, 0.0], // 800
  [7.221456e-6, 2.6078e-6, 0.0], // 805
  [5.085868e-6, 1.8366e-6, 0.0], // 810
  [3.581652e-6, 1.2934e-6, 0.0], // 815
  [2.522525e-6, 9.1093e-7, 0.0], // 820
  [1.776509e-6, 6.4153e-7, 0.0], // 825
  [1.251141e-6, 4.5181e-7, 0.0], // 830
];

const TO_RGB: readonly (readonly [number, number, number])[] = [
  [3.2406, -1.5372, -0.4986],
  [-0.9689, 1.8758, 0.0415],
  [0.0557, -0.204, 1.057],
];

const C2 = 1.438776877e-2;
const PLANCK_REFERENCE_NM = 560.0;

export type Rgb = [number, number, number];

/** The observer at `nm`: the table's, straight between its steps, nothing outside 360 to 830 nm. */
export function matching(nm: number): Rgb {
  const pos = (nm - TABLE_FROM_NM) / STEP_NM;
  if (!(pos >= 0 && pos <= TABLE.length - 1)) return [0.0, 0.0, 0.0];
  const k = Math.min(Math.trunc(pos), TABLE.length - 2);
  const f = pos - k;
  const [xa, ya, za] = TABLE[k];
  const [xb, yb, zb] = TABLE[k + 1];
  return [xa + f * (xb - xa), ya + f * (yb - ya), za + f * (zb - za)];
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
