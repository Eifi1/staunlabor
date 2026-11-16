/**
 * Chladni figures, in the browser: what the page needs of
 * `backend/staunlabor/domain/experiments/chladni.py`, ported line for line and
 * held to it by `simulate.test.ts` — the polynomials, a mode's deflection, the
 * tones and the plate's answer when shaken at its middle.
 *
 * The modes themselves are the engine's, fetched from `GET /experiments/chladni`
 * (`ChladniModesOut`): finding them takes Jacobi's rotations on a 66-row
 * matrix, done once a process on the server, not on every phone.
 */

/** The engine's `NU`: steel's, and Leissa's tables'. */
const NU = 0.3;

/** The engine's `Plate`. */
export interface Plate {
  side_m: number;
  thickness_m: number;
  youngs_gpa: number;
  density_kg_m3: number;
  damping_ratio: number;
}

/** A driven mode as the route sends it: λ and the deflection Σ c·p_m(ξ)·p_n(η). */
export interface Mode {
  lam: number;
  m: number[];
  n: number[];
  c: number[];
}

/** The normalised Legendre polynomials p_n = √((2n+1)/2)·P_n up to `degree` at `x`. */
export function legendre(degree: number, x: number): number[] {
  const p = [1.0, x];
  for (let k = 2; k <= degree; k++) p.push(((2 * k - 1) * x * p[k - 1] - (k - 1) * p[k - 2]) / k);
  return p.slice(0, degree + 1).map((a, k) => a * Math.sqrt((2 * k + 1) / 2));
}

/** The mode's deflection at (x, y) of the square [−1, 1]². */
export function modeValue(mode: Mode, degree: number, x: number, y: number): number {
  const px = legendre(degree, x);
  const py = legendre(degree, y);
  return mode.c.reduce((sum, c, i) => sum + c * px[mode.m[i]] * py[mode.n[i]], 0);
}

/** f = λ/(2π·a²)·√(D/(ρh)). */
export function frequencyHz(plate: Plate, lam: number): number {
  const d = (plate.youngs_gpa * 1e9 * plate.thickness_m ** 3) / (12 * (1 - NU ** 2));
  return (lam / (2 * Math.PI * plate.side_m ** 2)) * Math.sqrt(d / (plate.density_kg_m3 * plate.thickness_m));
}

/** The plate's swing at (x, y), shaken at its middle at `driveHz`, from each
 *  mode's value there and at the middle. */
export function responseFrom(plate: Plate, modes: Mode[], driveHz: number, here: number[], middle: number[]): number {
  const big = 2 * Math.PI * driveHz;
  let re = 0.0;
  let im = 0.0;
  modes.forEach((mode, k) => {
    const w = 2 * Math.PI * frequencyHz(plate, mode.lam);
    const weight = here[k] * middle[k];
    const a = w * w - big * big;
    const b = 2 * plate.damping_ratio * w * big;
    const den = a * a + b * b;
    re += (weight * a) / den;
    im -= (weight * b) / den;
  });
  return Math.hypot(re, im);
}

/** The engine's `response`: the plate's swing at (x, y). */
export function response(plate: Plate, modes: Mode[], degree: number, driveHz: number, x: number, y: number): number {
  return responseFrom(
    plate,
    modes,
    driveHz,
    modes.map((mode) => modeValue(mode, degree, x, y)),
    modes.map((mode) => modeValue(mode, degree, 0.0, 0.0)),
  );
}

/** Every mode on a `size` × `size` grid across the plate, row by row: the
 *  same sums as `modeValue`, the polynomials worked out once per line. */
export function modeGrids(modes: Mode[], degree: number, size: number): Float64Array[] {
  const axis = Array.from({ length: size }, (_, i) => legendre(degree, -1 + (2 * i) / (size - 1)));
  return modes.map((mode) => {
    const out = new Float64Array(size * size);
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        let sum = 0;
        for (let k = 0; k < mode.c.length; k++) sum += mode.c[k] * axis[i][mode.m[k]] * axis[j][mode.n[k]];
        out[i * size + j] = sum;
      }
    }
    return out;
  });
}
