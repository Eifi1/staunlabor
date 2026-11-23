/**
 * The standing string, in the browser: a line-for-line port of
 * `backend/staunlabor/domain/experiments/string.py` — the cord's tones, its
 * steady swing along it, and its modes stepped exactly while the vibrator
 * runs — held to it by `simulate.test.ts`.
 *
 * Why here: the reader turns the vibrator's tone and the weight's pull while
 * the cord swings, and the drawing answers every frame. There is no route. The
 * engine's searches for the peaks and the nodes are not ported (the page names
 * the tones by the formula); a change to the physics is made in Python first.
 */

/** The modes the time loop keeps. */
export const MODES = 40;
/** The museum's vibrator, where the page starts, Hz. */
export const VIBRATOR_HZ = 100.0;
/** The highest drive, Hz, and the longest step, s. */
export const MAX_DRIVE_HZ = 200.0;
export const MAX_STEP_S = 0.05;

const SEARCH_STEPS = 80;
const GOLDEN = (Math.sqrt(5) - 1) / 2;

/** The engine's `Cord`. */
export interface Cord {
  length_m: number;
  tension_n: number;
  density_kg_m: number;
  damping_per_s: number;
  drive_m: number;
}

/** A complex number, `[re, im]`, with Python's arithmetic. */
type Complex = readonly [number, number];

const mul = (a: Complex, b: Complex): Complex => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const scale = (k: number, a: Complex): Complex => [k * a[0], k * a[1]];
const absC = (a: Complex) => Math.hypot(a[0], a[1]);

/** Python's complex division (Smith's), so a quotient rounds as the engine's does. */
function div(a: Complex, b: Complex): Complex {
  if (Math.abs(b[0]) >= Math.abs(b[1])) {
    const ratio = b[1] / b[0];
    const denom = b[0] + b[1] * ratio;
    return [(a[0] + a[1] * ratio) / denom, (a[1] - a[0] * ratio) / denom];
  }
  const ratio = b[0] / b[1];
  const denom = b[0] * ratio + b[1];
  return [(a[0] * ratio + a[1]) / denom, (a[1] * ratio - a[0]) / denom];
}

/** The principal square root, as `cmath.sqrt`. */
function sqrtC(a: Complex): Complex {
  const r = Math.hypot(a[0], a[1]);
  if (a[0] >= 0) {
    const t = Math.sqrt((r + a[0]) / 2);
    return [t, t === 0 ? 0 : a[1] / (2 * t)];
  }
  const t = Math.sqrt((r - a[0]) / 2);
  return [Math.abs(a[1]) / (2 * t), a[1] < 0 ? -t : t];
}

const sinC = (a: Complex): Complex => [Math.sin(a[0]) * Math.cosh(a[1]), Math.cos(a[0]) * Math.sinh(a[1])];
const expI = (theta: number): Complex => [Math.cos(theta), Math.sin(theta)];

/** `v = √(T/μ)`. */
export const waveSpeedMS = (cord: Cord) => Math.sqrt(cord.tension_n / cord.density_kg_m);

/** `fₙ = n/(2L)·√(T/μ)`. */
export function modeHz(cord: Cord, n: number): number {
  if (n < 1) throw new Error("a mode has at least one loop");
  return (n * waveSpeedMS(cord)) / (2 * cord.length_m);
}

/** `2Lf/v`: the half-waves of the drive's tone between the ends. */
export const halfWaves = (cord: Cord, driveHz: number) => (2 * cord.length_m * driveHz) / waveSpeedMS(cord);

/** `T = μ·(2Lf/n)²`: the pull for `n` half-waves at `driveHz`. */
export const pullN = (cord: Cord, driveHz: number, n: number) =>
  cord.density_kg_m * ((2 * cord.length_m * driveHz) / n) ** 2;

function checkDrive(driveHz: number): void {
  if (!(driveHz > 0 && driveHz <= MAX_DRIVE_HZ)) throw new Error("the vibrator runs at more than 0 and at most 200 Hz");
}

/** `k = (Ω/v)·√(1 − iγ/Ω)`. */
export function wavenumber(cord: Cord, driveHz: number): Complex {
  checkDrive(driveHz);
  const big = 2 * Math.PI * driveHz;
  return scale(big / waveSpeedMS(cord), sqrtC([1, -cord.damping_per_s / big]));
}

/** `Y(x) = A·sin(k(L − x))/sin(kL)`. */
export function steady(cord: Cord, driveHz: number, xM: number): Complex {
  const k = wavenumber(cord, driveHz);
  return div(scale(cord.drive_m, sinC(scale(cord.length_m - xM, k))), sinC(scale(cord.length_m, k)));
}

function golden(f: (x: number) => number, lo: number, hi: number): number {
  let a = lo;
  let b = hi;
  let c = b - GOLDEN * (b - a);
  let d = a + GOLDEN * (b - a);
  let fc = f(c);
  let fd = f(d);
  for (let i = 0; i < SEARCH_STEPS; i++) {
    if (fc >= fd) {
      b = d;
      d = c;
      fd = fc;
      c = b - GOLDEN * (b - a);
      fc = f(c);
    } else {
      a = c;
      c = d;
      fc = fd;
      d = a + GOLDEN * (b - a);
      fd = f(d);
    }
  }
  return (a + b) / 2;
}

/** The steady swing at the cord's widest point, each way. */
export function widestM(cord: Cord, driveHz: number): number {
  const k = wavenumber(cord, driveHz);
  const a = k[0];
  const length = cord.length_m;
  const last = Math.max(0, Math.floor((a * length) / Math.PI - 0.5));
  const s = golden((s) => absC(sinC(scale(s, k))), (last * Math.PI) / a, Math.min(length, ((last + 1) * Math.PI) / a));
  const end = absC(sinC(scale(length, k)));
  return (cord.drive_m * Math.max(absC(sinC(scale(s, k))), end)) / end;
}

// ── the time loop ──────────────────────────────────────────────────────────

/** The engine's `Shaking`. */
export interface Shaking {
  t: number;
  theta: number;
  q: number[];
  v: number[];
}

export function start(): Shaking {
  return { t: 0.0, theta: 0.0, q: new Array(MODES).fill(0.0), v: new Array(MODES).fill(0.0) };
}

function forced(cord: Cord, n: number, big: number): Complex {
  const omega = (Math.PI * n * waveSpeedMS(cord)) / cord.length_m;
  const g = cord.damping_per_s;
  const push = scale((2 * cord.drive_m) / (n * Math.PI), [big * big, -(g * big)]);
  return div(push, [omega * omega - big * big, g * big]);
}

/** `dt` on, the vibrator held at `driveHz`: each mode exactly. */
export function step(cord: Cord, s: Shaking, driveHz: number, dt: number): Shaking {
  checkDrive(driveHz);
  if (!(dt >= 0 && dt <= MAX_STEP_S)) throw new Error("a step lasts 0 to 0.05 s");
  const big = 2 * Math.PI * driveHz;
  const theta = s.theta + big * dt;
  const now = expI(s.theta);
  const then = expI(theta);
  const alpha = cord.damping_per_s / 2;
  const fade = Math.exp(-alpha * dt);
  const q: number[] = [];
  const v: number[] = [];
  for (let i = 0; i < MODES; i++) {
    const n = i + 1;
    const omega = (Math.PI * n * waveSpeedMS(cord)) / cord.length_m;
    const damped = Math.sqrt(omega * omega - alpha * alpha);
    const f = forced(cord, n, big);
    const turning = mul([0, big], f);
    const h0 = s.q[i] - mul(f, now)[1];
    const r0 = s.v[i] - mul(turning, now)[1];
    const c = Math.cos(damped * dt);
    const sn = Math.sin(damped * dt);
    const tilt = (r0 + alpha * h0) / damped;
    q.push(mul(f, then)[1] + fade * (h0 * c + tilt * sn));
    v.push(mul(turning, then)[1] + fade * (r0 * c - (damped * h0 + alpha * tilt) * sn));
  }
  return { t: s.t + dt, theta, q, v };
}

/** The cord's place at `xM` now. */
export function placeM(cord: Cord, s: Shaking, xM: number): number {
  const line = cord.drive_m * Math.sin(s.theta) * (1 - xM / cord.length_m);
  let modes = 0;
  for (let i = 0; i < MODES; i++) modes += s.q[i] * Math.sin(((i + 1) * Math.PI * xM) / cord.length_m);
  return line + modes;
}

/** How fast the cord moves at `xM` now. */
export function rateMS(cord: Cord, s: Shaking, driveHz: number, xM: number): number {
  const big = 2 * Math.PI * driveHz;
  const line = cord.drive_m * big * Math.cos(s.theta) * (1 - xM / cord.length_m);
  let modes = 0;
  for (let i = 0; i < MODES; i++) modes += s.v[i] * Math.sin(((i + 1) * Math.PI * xM) / cord.length_m);
  return line + modes;
}

/** `√(y² + (ẏ/Ω)²)`: the blur's half-width at `xM`. */
export function swingM(cord: Cord, s: Shaking, driveHz: number, xM: number): number {
  const big = 2 * Math.PI * driveHz;
  return Math.hypot(placeM(cord, s, xM), rateMS(cord, s, driveHz, xM) / big);
}

/** The cord at `xM` as it stands `phase` of a turn later, were it swinging steadily. */
export function strobeM(cord: Cord, s: Shaking, driveHz: number, xM: number, phase: number): number {
  const big = 2 * Math.PI * driveHz;
  const y = placeM(cord, s, xM);
  return y * Math.cos(phase) + (rateMS(cord, s, driveHz, xM) / big) * Math.sin(phase);
}
