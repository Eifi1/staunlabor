/**
 * The double slit, in the browser: a line-for-line port of
 * `backend/staunlabor/domain/experiments/slits.py` — the light on the wall
 * behind two slits, where its stripes lie, and the wall's colours under a
 * laser and under white light — held to it by `simulate.test.ts`.
 *
 * Why here: the reader moves the slits, the wall and the wavelength, and the
 * wall is redrawn column by column each time. There is no route; a change to
 * the optics is made in Python first.
 */

import { WAVELENGTHS_NM, lamp, linearRgb, matching, onScreen, seen, tristimulus, type Rgb } from "./colour";

export const LASER_NM = 650.0;
const LAMP_K = 3000.0;

/** The engine's `Slits`. */
export interface Slits {
  spacing_m: number;
  width_m: number;
  distance_m: number;
}

const sinc = (x: number) => (x === 0 ? 1.0 : Math.sin(x) / x);

export function intensity(slits: Slits, nm: number, y: number, both = true): number {
  const s = y / Math.hypot(y, slits.distance_m);
  const lam = nm * 1e-9;
  const envelope = sinc((Math.PI * slits.width_m * s) / lam) ** 2;
  if (!both) return envelope / 4;
  return envelope * Math.cos((Math.PI * slits.spacing_m * s) / lam) ** 2;
}

export function brightM(slits: Slits, nm: number, k: number): number {
  const s = (k * nm * 1e-9) / slits.spacing_m;
  return (slits.distance_m * s) / Math.sqrt(1 - s * s);
}

export function darkM(slits: Slits, nm: number, k: number): number {
  const s = ((k + 0.5) * nm * 1e-9) / slits.spacing_m;
  return (slits.distance_m * s) / Math.sqrt(1 - s * s);
}

export function laserColour(nm: number): Rgb {
  const rgb = linearRgb(matching(nm));
  const top = Math.max(...rgb);
  return [rgb[0] / top, rgb[1] / top, rgb[2] / top];
}

export function laserPattern(slits: Slits, nm: number, ys: readonly number[], both = true): Rgb[] {
  const colour = laserColour(nm);
  return ys.map((y) => {
    const i = intensity(slits, nm, y, both);
    return onScreen(colour.map((c) => c * i));
  });
}

export function whitePattern(slits: Slits, ys: readonly number[], both = true): Rgb[] {
  const source = lamp(LAMP_K);
  const white = linearRgb(tristimulus(source));
  return ys.map((y) =>
    onScreen(
      seen(
        source,
        WAVELENGTHS_NM.map((nm) => intensity(slits, nm, y, both)),
        white,
      ),
    ),
  );
}

/** The engine's `SlitsFigures`. */
export interface SlitsFigures {
  spacing_m: number;
  first_dark_m: number;
  envelope_m: number;
  stripes: number;
  one_slit_there: number;
}

export function figures(slits: Slits, nm: number): SlitsFigures {
  const firstDark = darkM(slits, nm, 0);
  const sEnv = (nm * 1e-9) / slits.width_m;
  const beyond = Math.ceil(slits.spacing_m / slits.width_m - 1e-9) - 1;
  return {
    spacing_m: (nm * 1e-9 * slits.distance_m) / slits.spacing_m,
    first_dark_m: firstDark,
    envelope_m: (slits.distance_m * sEnv) / Math.sqrt(1 - sEnv * sEnv),
    stripes: 2 * beyond + 1,
    one_slit_there: 4 * intensity(slits, nm, firstDark, false),
  };
}
