/**
 * The pendulum, run in the browser: a line-for-line port of
 * `backend/staunlabor/domain/experiments/pendulum.py`, the block the swinging
 * exhibits stand on.
 *
 * Two ways to answer a plane pendulum, as in the engine: exactly, by Jacobi's
 * elliptic functions (`angleDeg` — any instant without stepping to it, which is
 * what lets the pendulum wave jump to "half a cycle later"), and stepped, by
 * classical Runge–Kutta (`swing`, on `numerics.ts`'s `rk4`) for what has no
 * closed form. Gravity is `constants.ts`'s, the stepping `numerics.ts`'s, as
 * in the engine since both moved out of `pendulum.py`. Nothing
 * here decides anything: the constants, the order of every sum and the step are
 * the engine's, and `simulate.test.ts` holds this file to what the engine
 * answers (`engine-cases.json`, written by `scripts/write-experiments-cases.py`).
 * A change to the physics is made in Python first.
 */

import { G } from "./constants";
import { checkRun, type Rhs, rk4, sampleEvery, STEP_S } from "./numerics";
import { degrees, fmod, radians, roundHalfEven } from "./python";

const AGM_TOLERANCE = 1e-15;

/** The arithmetic-geometric mean of two positive numbers. */
export function agm(a0: number, b0: number): number {
  if (!(a0 > 0 && b0 >= 0)) throw new RangeError("the AGM takes a positive and a non-negative number");
  let a = a0;
  let b = b0;
  while (Math.abs(a - b) > AGM_TOLERANCE * a) {
    const next = (a + b) / 2;
    b = Math.sqrt(a * b);
    a = next;
  }
  return a;
}

/** `K(m)`, the complete elliptic integral of the first kind. */
export function ellipk(m: number): number {
  if (!(m >= 0 && m < 1)) throw new RangeError("K(m) is finite for 0 ≤ m < 1");
  return Math.PI / (2 * agm(1.0, Math.sqrt(1 - m)));
}

/** `[sn, cn, dn]` of `u` at parameter `m`, by the AGM (the engine's `jacobi`). */
export function jacobi(u: number, m: number): [number, number, number] {
  if (!(m >= 0 && m <= 1)) throw new RangeError("the parameter lies between 0 and 1");
  if (m === 0) return [Math.sin(u), Math.cos(u), 1.0];
  if (m === 1) {
    const sech = 1 / Math.cosh(u);
    return [Math.tanh(u), sech, sech];
  }
  const a = [1.0];
  const c = [Math.sqrt(m)];
  let b = Math.sqrt(1 - m);
  while (Math.abs(c[c.length - 1]) > AGM_TOLERANCE) {
    const an = a[a.length - 1];
    const bn = b;
    a.push((an + bn) / 2);
    c.push((an - bn) / 2);
    b = Math.sqrt(an * bn);
  }
  const n = a.length - 1;
  let phi = 2 ** n * a[n] * u;
  let previous = phi;
  for (let i = n; i > 0; i--) {
    previous = phi;
    phi = (phi + Math.asin((c[i] / a[i]) * Math.sin(phi))) / 2;
  }
  const sn = Math.sin(phi);
  const cn = Math.cos(phi);
  const dn = n > 0 ? cn / Math.cos(previous - phi) : 1.0;
  return [sn, cn, dn];
}

/** `ω₀ = √(g/L)`, rad/s. */
export function naturalRate(lengthM: number, g = G): number {
  if (!(lengthM > 0)) throw new RangeError("a pendulum needs a positive length");
  return Math.sqrt(g / lengthM);
}

/** `T₀ = 2π·√(L/g)`. */
export function smallPeriodS(lengthM: number, g = G): number {
  return (2 * Math.PI) / naturalRate(lengthM, g);
}

function modulus(amplitudeDeg: number): number {
  if (!(amplitudeDeg >= 0 && amplitudeDeg < 180)) throw new RangeError("a swing's amplitude lies between 0° and 180°");
  return Math.sin(radians(amplitudeDeg) / 2);
}

/** `T/T₀` for a swing of `amplitudeDeg` each side. */
export function periodFactor(amplitudeDeg: number): number {
  const k = modulus(amplitudeDeg);
  return 1 / agm(1.0, Math.sqrt(1 - k * k));
}

/** The exact period of a swing `amplitudeDeg` each side of the bottom. */
export function periodS(lengthM: number, amplitudeDeg: number, g = G): number {
  return smallPeriodS(lengthM, g) * periodFactor(amplitudeDeg);
}

/** The length whose swing of `amplitudeDeg` takes `period` seconds. */
export function lengthFor(period: number, amplitudeDeg = 0.0, g = G): number {
  if (!(period > 0)) throw new RangeError("a period is positive");
  const small = period / periodFactor(amplitudeDeg);
  return g * (small / (2 * Math.PI)) ** 2;
}

/** Where a pendulum released from rest at `amplitudeDeg` is `t` seconds later, exactly. */
export function angleDeg(lengthM: number, amplitudeDeg: number, t: number, g = G): number {
  const k = modulus(amplitudeDeg);
  if (k === 0) return 0.0;
  const m = k * k;
  const quarter = ellipk(m);
  const u = fmod(naturalRate(lengthM, g) * t, 4 * quarter);
  const [, cn, dn] = jacobi(u, m);
  return degrees(2 * Math.asin(Math.max(-1.0, Math.min(1.0, (k * cn) / dn))));
}

/** One pendulum as a system: `(θ, θ')' = (θ', −(g/L)·sin θ − c·θ')`. */
export function swingRhs(lengthM: number, dampingPerS = 0.0, g = G): Rhs {
  const w2 = naturalRate(lengthM, g) ** 2;
  return (_t, y) => [y[1], -w2 * Math.sin(y[0]) - dampingPerS * y[1]];
}

/** The engine's `SwingRun`, in its names. */
export interface SwingRun {
  t: number[];
  angle_deg: number[];
  rate_deg_s: number[];
}

/** One pendulum released from rest at `amplitudeDeg`, stepped for `durationS`. */
export function swing(
  lengthM: number,
  amplitudeDeg: number,
  durationS: number,
  dampingPerS = 0.0,
  stepS = STEP_S,
  g = G,
): SwingRun {
  checkRun(durationS, stepS);
  if (dampingPerS < 0) throw new RangeError("damping cannot be negative");
  modulus(amplitudeDeg);
  const f = swingRhs(lengthM, dampingPerS, g);
  let y: number[] = [radians(amplitudeDeg), 0.0];
  const steps = roundHalfEven(durationS / stepS);
  const every = sampleEvery(stepS);
  const run: SwingRun = { t: [], angle_deg: [], rate_deg_s: [] };
  for (let i = 0; i <= steps; i++) {
    const t = i * stepS;
    if (i % every === 0) {
      run.t.push(t);
      run.angle_deg.push(degrees(y[0]));
      run.rate_deg_s.push(degrees(y[1]));
    }
    if (i < steps) y = rk4(f, t, y, stepS);
  }
  return run;
}
