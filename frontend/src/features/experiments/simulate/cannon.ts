/**
 * The ball cannon's engine (`domain/experiments/cannon.py`), ported for the
 * page: every ball by Newton's second law at once, Hertz's contacts damped as
 * Flores gives them, RK4 in large steps in flight and small ones in contact,
 * the contacts' bookkeeping, the forces over the impact, and the top ball's
 * launch.
 *
 * Line for line, as the other ports are: `engine-cases.json` holds the
 * engine's answers and `simulate.test.ts` holds this file to them. The page
 * runs `drop` when the reader lets the stack go and draws what it answers —
 * the flight, the squash and the forces; the comparison of one, two and three
 * balls is the server's.
 */

import { roundHalfEven } from "./sphere";

export const G = 9.80665;
export const RHO = 1.2;
export const CD = 0.47;
export const POISSON = 0.5;
export const STEP_S = 5e-4;
export const SUBSTEPS = 50;
export const CONTACT_STEP_S = STEP_S / SUBSTEPS;
export const SAMPLES_PER_S = 100;
export const MAX_S = 12.0;
export const MIN_CLOSING_M_S = 0.01;
export const IMPACT_EVERY = 10;
export const IMPACT_WINDOW_S = 0.03;
export const LAUNCH_WINDOW_S = 0.5;

export interface Ball {
  diameter_m: number;
  density_kg_m3: number;
}

export interface BallStack {
  /** Bottom first. */
  balls: Ball[];
  drop_m: number;
  gap_m: number;
  floor_restitution: number;
  ball_restitution: number;
  youngs_mpa: number;
}

export const massKg = (ball: Ball) => ((ball.density_kg_m3 * Math.PI) / 6) * ball.diameter_m ** 3;

/** `k` in the drag's deceleration `k·v·|v|`: `ρ·C_d·A / (2m)`. */
export const dragPerM = (ball: Ball) => (RHO * CD * Math.PI * ball.diameter_m ** 2) / 4 / (2 * massKg(ball));

function check(stack: BallStack): void {
  if (stack.balls.length < 1 || stack.balls.length > 3) throw new Error("a stack is one, two or three balls");
  for (const ball of stack.balls) {
    if (ball.diameter_m < 0.01 || ball.diameter_m > 0.4) throw new Error("a ball is between 1 and 40 cm across");
  }
  if (stack.drop_m < 0.05 || stack.drop_m > 3) throw new Error("the stack is dropped from between 5 cm and 3 m");
  if (stack.gap_m < 0 || stack.gap_m > 0.1) throw new Error("the gap between two balls is between 0 and 10 cm");
  for (const e of [stack.floor_restitution, stack.ball_restitution]) {
    if (e < 0.3 || e > 1) throw new Error("a coefficient of restitution is between 0.3 and 1 here");
  }
  if (stack.youngs_mpa < 0.5 || stack.youngs_mpa > 200)
    throw new Error("the elastomer's Young's modulus is between 0.5 and 200 MPa");
}

/** Hertz's `K` of contact `c`: `(4/3)·E*·√R*`, the floor rigid. */
export function stiffness(stack: BallStack, c: number): number {
  const eBall = (stack.youngs_mpa * 1e6) / (1 - POISSON ** 2);
  if (c === 0) return (4 / 3) * eBall * Math.sqrt(stack.balls[0].diameter_m / 2);
  const ra = stack.balls[c - 1].diameter_m / 2;
  const rb = stack.balls[c].diameter_m / 2;
  return (4 / 3) * (eBall / 2) * Math.sqrt((ra * rb) / (ra + rb));
}

const gapOf = (balls: Ball[], y: number[], c: number) => (c === 0 ? y[0] : y[c] - (y[c - 1] + balls[c - 1].diameter_m));
const closingOf = (v: number[], c: number) => (c === 0 ? -v[0] : v[c - 1] - v[c]);

function forcesOf(stack: BallStack, ks: number[], y: number[], v: number[], closed: number[]): number[] {
  return ks.map((k, c) => {
    const overlap = -gapOf(stack.balls, y, c);
    if (overlap <= 0) return 0;
    const rate = closingOf(v, c);
    const e = c === 0 ? stack.floor_restitution : stack.ball_restitution;
    const at = closed[c] > 0 ? closed[c] : Math.max(rate, MIN_CLOSING_M_S);
    const force = k * overlap ** 1.5 * (1 + (((8 * (1 - e)) / (5 * e)) * rate) / at);
    return Math.max(force, 0);
  });
}

function accelerations(stack: BallStack, ks: number[], y: number[], v: number[], closed: number[]): number[] {
  const forces = forcesOf(stack, ks, y, v, closed);
  const n = stack.balls.length;
  return stack.balls.map((ball, i) => {
    const above = i + 1 < n ? forces[i + 1] : 0;
    return -G - dragPerM(ball) * v[i] * Math.abs(v[i]) + (forces[i] - above) / massKg(ball);
  });
}

function rk4(
  stack: BallStack,
  ks: number[],
  y: number[],
  v: number[],
  closed: number[],
  h: number,
): [number[], number[]] {
  const n = y.length;
  const idx = Array.from({ length: n }, (_, i) => i);
  const a1 = accelerations(stack, ks, y, v, closed);
  const y2 = idx.map((i) => y[i] + (h / 2) * v[i]);
  const v2 = idx.map((i) => v[i] + (h / 2) * a1[i]);
  const a2 = accelerations(stack, ks, y2, v2, closed);
  const y3 = idx.map((i) => y[i] + (h / 2) * v2[i]);
  const v3 = idx.map((i) => v[i] + (h / 2) * a2[i]);
  const a3 = accelerations(stack, ks, y3, v3, closed);
  const y4 = idx.map((i) => y[i] + h * v3[i]);
  const v4 = idx.map((i) => v[i] + h * a3[i]);
  const a4 = accelerations(stack, ks, y4, v4, closed);
  const ny = idx.map((i) => y[i] + (h / 6) * (v[i] + 2 * v2[i] + 2 * v3[i] + v4[i]));
  const nv = idx.map((i) => v[i] + (h / 6) * (a1[i] + 2 * a2[i] + 2 * a3[i] + a4[i]));
  return [ny, nv];
}

export interface Contact {
  contact: number;
  start_s: number;
  end_s: number | null;
  closing_m_s: number;
  parting_m_s: number;
  peak_force_n: number;
  peak_overlap_m: number;
  impulse_n_s: number;
}

export interface Impact {
  t_ms: number[];
  force_n: number[][];
  overlap_mm: number[][];
  y_m: number[][];
}

export interface Drop {
  t: number[];
  y_m: number[][];
  v_m_s: number[][];
  contacts: Contact[];
  impact: Impact;
}

export function start(stack: Pick<BallStack, "balls" | "drop_m" | "gap_m">): number[] {
  const y: number[] = [];
  let at = stack.drop_m;
  for (const ball of stack.balls) {
    y.push(at);
    at += ball.diameter_m + stack.gap_m;
  }
  return y;
}

interface Episode {
  start: number;
  closing: number;
  peak: number;
  deep: number;
  impulse: number;
}

class Run {
  stack: BallStack;
  ks: number[];
  y: number[];
  v: number[];
  t = 0;
  closed: number[];
  openSince: (Episode | null)[];
  contacts: Contact[] = [];
  first: number | null = null;
  impactT: number[] = [];
  impactF: number[][];
  impactD: number[][];
  impactY: number[][];
  small = 0;

  constructor(stack: BallStack) {
    const n = stack.balls.length;
    this.stack = stack;
    this.ks = stack.balls.map((_, c) => stiffness(stack, c));
    this.y = start(stack);
    this.v = new Array<number>(n).fill(0);
    this.closed = new Array<number>(n).fill(0);
    this.openSince = new Array<Episode | null>(n).fill(null);
    this.impactF = stack.balls.map(() => []);
    this.impactD = stack.balls.map(() => []);
    this.impactY = stack.balls.map(() => []);
  }

  private imminent(): boolean {
    const balls = this.stack.balls;
    for (let c = 0; c < balls.length; c += 1) {
      const gap = gapOf(balls, this.y, c);
      const rate = closingOf(this.v, c);
      if (gap <= 0 || (rate > 0 && gap < 2 * rate * STEP_S + 1e-6)) return true;
    }
    return false;
  }

  private book(h: number): void {
    const balls = this.stack.balls;
    const forces = forcesOf(this.stack, this.ks, this.y, this.v, this.closed);
    for (let c = 0; c < balls.length; c += 1) {
      const overlap = -gapOf(balls, this.y, c);
      let episode = this.openSince[c];
      if (overlap > 0 && episode === null) {
        const rate = Math.max(closingOf(this.v, c), MIN_CLOSING_M_S);
        this.closed[c] = rate;
        episode = { start: this.t, closing: rate, peak: 0, deep: 0, impulse: 0 };
        this.openSince[c] = episode;
        if (c === 0 && this.first === null) this.first = this.t;
      }
      if (episode === null) continue;
      if (overlap > 0) {
        episode.peak = Math.max(episode.peak, forces[c]);
        episode.deep = Math.max(episode.deep, overlap);
        episode.impulse += forces[c] * h;
      } else {
        this.contacts.push({
          contact: c,
          start_s: episode.start,
          end_s: this.t,
          closing_m_s: episode.closing,
          parting_m_s: -closingOf(this.v, c),
          peak_force_n: episode.peak,
          peak_overlap_m: episode.deep,
          impulse_n_s: episode.impulse,
        });
        this.openSince[c] = null;
        this.closed[c] = 0;
      }
    }
    if (this.first !== null && this.t - this.first <= IMPACT_WINDOW_S + 1e-12) {
      if (this.small % IMPACT_EVERY === 0) {
        this.impactT.push((this.t - this.first) * 1000);
        for (let c = 0; c < balls.length; c += 1) {
          this.impactF[c].push(forces[c]);
          this.impactD[c].push(Math.max(-gapOf(balls, this.y, c), 0) * 1000);
          this.impactY[c].push(this.y[c]);
        }
      }
      this.small += 1;
    }
  }

  step(): void {
    const recording = this.first !== null && this.t - this.first <= IMPACT_WINDOW_S;
    if (!recording && !this.imminent()) {
      const [ny, nv] = rk4(this.stack, this.ks, this.y, this.v, this.closed, STEP_S);
      if (this.stack.balls.every((_, c) => gapOf(this.stack.balls, ny, c) > 0)) {
        this.y = ny;
        this.v = nv;
        this.t += STEP_S;
        return;
      }
    }
    const startT = this.t;
    for (let k = 1; k <= SUBSTEPS; k += 1) {
      [this.y, this.v] = rk4(this.stack, this.ks, this.y, this.v, this.closed, CONTACT_STEP_S);
      this.t = startT + k * CONTACT_STEP_S;
      this.book(CONTACT_STEP_S);
    }
  }

  stillOpen(): Contact[] {
    const out: Contact[] = [];
    this.openSince.forEach((e, c) => {
      if (e === null) return;
      out.push({
        contact: c,
        start_s: e.start,
        end_s: null,
        closing_m_s: e.closing,
        parting_m_s: 0,
        peak_force_n: e.peak,
        peak_overlap_m: e.deep,
        impulse_n_s: e.impulse,
      });
    });
    return out;
  }

  impact(): Impact {
    return { t_ms: this.impactT, force_n: this.impactF, overlap_mm: this.impactD, y_m: this.impactY };
  }
}

/** The stack let go at rest, for `durationS`. */
export function drop(stack: BallStack, durationS = 3.0): Drop {
  check(stack);
  if (!(durationS > 0 && durationS <= MAX_S)) throw new Error(`a drop lasts between 0 and ${MAX_S} s`);
  const run = new Run(stack);
  const n = stack.balls.length;
  const steps = roundHalfEven(durationS / STEP_S);
  const every = roundHalfEven(1 / (SAMPLES_PER_S * STEP_S));
  const t: number[] = [];
  const yM: number[][] = stack.balls.map(() => []);
  const vMS: number[][] = stack.balls.map(() => []);
  for (let k = 0; k <= steps; k += 1) {
    if (k % every === 0 || k === steps) {
      t.push(k * STEP_S);
      for (let i = 0; i < n; i += 1) {
        yM[i].push(run.y[i]);
        vMS[i].push(run.v[i]);
      }
    }
    if (k === steps) break;
    run.step();
    run.t = (k + 1) * STEP_S;
  }
  return { t, y_m: yM, v_m_s: vMS, contacts: [...run.contacts, ...run.stillOpen()], impact: run.impact() };
}

export const textbookFactor = (balls: number) => 2 ** balls - 1;

export function sequentialLaunch(stack: BallStack, impactMS: number, lossless = false): number {
  const eFloor = lossless ? 1 : stack.floor_restitution;
  const e = lossless ? 1 : stack.ball_restitution;
  let up = eFloor * impactMS;
  for (let i = 1; i < stack.balls.length; i += 1) {
    const ml = massKg(stack.balls[i - 1]);
    const mu = massKg(stack.balls[i]);
    up = (ml * up - mu * impactMS + ml * e * (up + impactMS)) / (ml + mu);
  }
  return up;
}

function free(ball: Ball, y: number, v: number, h: number): [number, number] {
  const a = (u: number) => -G - dragPerM(ball) * u * Math.abs(u);
  const a1 = a(v);
  const v2 = v + (h / 2) * a1;
  const a2 = a(v2);
  const v3 = v + (h / 2) * a2;
  const a3 = a(v3);
  const v4 = v + h * a3;
  const a4 = a(v4);
  return [y + (h / 6) * (v + 2 * v2 + 2 * v3 + v4), v + (h / 6) * (a1 + 2 * a2 + 2 * a3 + a4)];
}

function until(ball: Ball, y0: number, v0: number, done: (y: number, v: number) => boolean): [number, number] {
  let y = y0;
  let v = v0;
  for (;;) {
    const [ny, nv] = free(ball, y, v, STEP_S);
    if (done(ny, nv)) {
      let lo = 0;
      let hi = STEP_S;
      for (let k = 0; k < 48; k += 1) {
        const mid = (lo + hi) / 2;
        if (done(...free(ball, y, v, mid))) hi = mid;
        else lo = mid;
      }
      return free(ball, y, v, hi);
    }
    y = ny;
    v = nv;
  }
}

export const impactSpeed = (stack: BallStack) => -until(stack.balls[0], stack.drop_m, 0, (y) => y <= 0)[1];

export interface Launch {
  balls: number;
  launch_m_s: number;
  launch_height_m: number;
  apex_m: number;
  times_drop: number;
  sequential_launch_m_s: number;
  ideal_launch_m_s: number;
  textbook_launch_m_s: number;
}

function launched(stack: BallStack): [Run, number, number] {
  const run = new Run(stack);
  const top = stack.balls.length - 1;
  for (;;) {
    run.step();
    if (run.first === null) continue;
    const left = run.openSince[top] === null && run.contacts.some((c) => c.contact === top);
    const faster = top === 0 || run.v[top] > run.v[top - 1];
    if ((left && faster && run.v[top] > 0) || run.t - run.first > LAUNCH_WINDOW_S) return [run, run.v[top], run.y[top]];
  }
}

export function launch(stack: BallStack): Launch {
  check(stack);
  const [, speed, height] = launched(stack);
  const top = stack.balls[stack.balls.length - 1];
  let apex = height;
  if (speed > 0) apex = until(top, height, speed, (_, v) => v <= 0)[0];
  const impact = impactSpeed(stack);
  return {
    balls: stack.balls.length,
    launch_m_s: speed,
    launch_height_m: height,
    apex_m: apex,
    times_drop: (apex - height) / stack.drop_m,
    sequential_launch_m_s: sequentialLaunch(stack, impact),
    ideal_launch_m_s: sequentialLaunch(stack, impact, true),
    textbook_launch_m_s: textbookFactor(stack.balls.length) * impact,
  };
}
