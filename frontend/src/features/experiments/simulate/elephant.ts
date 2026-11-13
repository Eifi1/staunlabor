/**
 * The Bernoulli elephant's engine (`domain/experiments/elephant.py`), ported
 * for the page: the jet's bell-shaped profile, the sums over the ball's
 * cross-section, the forces, a Runge–Kutta step with the rim that holds the
 * ball, and the sampled run the engine writes.
 *
 * Line for line, as the other ports are (`sphere.ts`, `coil.ts`, `platform.ts`):
 * `engine-cases.json` holds the engine's answers and `simulate.test.ts` holds
 * this file to them. The page calls `step` every frame with the tilt and the
 * air the reader has set; the run is there so the cases can replay whole
 * sequences.
 */

import { roundHalfEven } from "./sphere";

export const G = 9.80665;
export const RHO = 1.2;
export const DRAG = 0.47;
export const DECAY = 6.0;
export const SPREAD = 1 / (Math.sqrt(2) * DECAY);
export const RINGS = 12;
export const SPOKES = 24;
export const STEP_S = 2e-3;
export const SAMPLES_PER_S = 50;
export const MAX_DURATION_S = 60.0;
export const MAX_TILT_DEG = 80.0;

export interface Jet {
  opening_m: number;
  speed_m_s: number;
}

export interface FloatingBall {
  diameter_m: number;
  mass_kg: number;
}

export interface Elephant {
  jet: Jet;
  ball: FloatingBall;
  coanda: number;
}

export type State = [number, number, number, number];

const radiusOf = (ball: FloatingBall) => ball.diameter_m / 2;
const areaOf = (ball: FloatingBall) => Math.PI * radiusOf(ball) ** 2;
export const displacedKg = (ball: FloatingBall) => ((RHO * 4) / 3) * Math.PI * radiusOf(ball) ** 3;

/** What the engine refuses, refused here too: the page keeps its sliders inside. */
export function checkElephant(el: Elephant): void {
  if (el.jet.opening_m <= 0) throw new Error("an opening needs a size");
  if (el.jet.speed_m_s < 0) throw new Error("the air cannot blow backwards");
  if (el.ball.diameter_m <= 0 || el.ball.mass_kg <= 0) throw new Error("a ball needs a size and a mass");
  if (el.ball.mass_kg <= displacedKg(el.ball))
    throw new Error("a ball lighter than the air it displaces rises on its own");
  if (el.ball.diameter_m <= el.jet.opening_m) throw new Error("the ball has to be wider than the opening it sits on");
  if (el.coanda < 0) throw new Error("the air does not push the ball out of the jet");
}

// ── the jet ──────────────────────────────────────────────────────────────────

export function width(jet: Jet, s: number): number {
  return jet.opening_m / Math.sqrt(2) + SPREAD * s;
}

export function centreSpeed(jet: Jet, s: number): number {
  return (jet.speed_m_s * jet.opening_m) / (Math.sqrt(2) * width(jet, s));
}

export function airSpeed(jet: Jet, s: number, r: number): number {
  if (s <= 0) return 0;
  const b = width(jet, s);
  return centreSpeed(jet, s) * Math.exp(-(r * r) / (b * b));
}

/** The rule's nodes as [radius share, cos, sin], in the engine's order: half the
 *  spokes, each summed with the node opposite it. */
export const NODES: readonly (readonly [number, number, number])[] = Array.from(
  { length: (RINGS * SPOKES) / 2 },
  (_, k) => {
    const i = Math.floor(k / (SPOKES / 2));
    const j = k % (SPOKES / 2);
    const angle = (2 * Math.PI * (j + 0.5)) / SPOKES;
    return [Math.sqrt((i + 0.5) / RINGS), Math.cos(angle), Math.sin(angle)] as const;
  },
);

export interface Cover {
  mean_square: number;
  moment: number;
}

export function cover(el: Elephant, s: number, e: number): Cover {
  if (s <= 0) return { mean_square: 0, moment: 0 };
  const jet = el.jet;
  const rBall = radiusOf(el.ball);
  const b = width(jet, s);
  const uc = centreSpeed(jet, s);
  const peak = uc * uc;
  let total = 0;
  let moment = 0;
  for (const [share, c, sn] of NODES) {
    const rho = rBall * share;
    const near = e + rho * c;
    const far = e - rho * c;
    const y2 = (rho * sn) ** 2;
    const u2Near = peak * Math.exp((-2 * (near * near + y2)) / (b * b));
    const u2Far = peak * Math.exp((-2 * (far * far + y2)) / (b * b));
    total += u2Near + u2Far;
    moment += (u2Near - u2Far) * c;
  }
  const n = 2 * NODES.length;
  return { mean_square: total / n, moment: moment / n };
}

// ── the forces and a step ────────────────────────────────────────────────────

/** The jet's axis and the direction across it, toward the lower side. */
export function axes(tiltDeg: number): [[number, number], [number, number]] {
  const a = (tiltDeg * Math.PI) / 180;
  return [
    [Math.sin(a), Math.cos(a)],
    [Math.cos(a), -Math.sin(a)],
  ];
}

export function restHeight(el: Elephant): number {
  const r = radiusOf(el.ball);
  const half = el.jet.opening_m / 2;
  return Math.sqrt(r * r - half * half);
}

export function netWeightN(el: Elephant): number {
  return (el.ball.mass_kg - displacedKg(el.ball)) * G;
}

/** Along the axis and across it, of a point in the plane. */
export function jetCoordinates(tiltDeg: number, x: number, y: number): [number, number] {
  const [[ax, ay], [nx, ny]] = axes(tiltDeg);
  return [x * ax + y * ay, x * nx + y * ny];
}

export function acceleration(el: Elephant, tiltDeg: number, state: State): [number, number] {
  const [x, y, vx, vy] = state;
  const [[ax, ay], [nx, ny]] = axes(tiltDeg);
  const s = x * ax + y * ay;
  const e = x * nx + y * ny;
  const c = cover(el, s, e);
  const ball = el.ball;
  const mean = Math.sqrt(c.mean_square);
  const wx = mean * ax - vx;
  const wy = mean * ay - vy;
  const w = Math.sqrt(wx * wx + wy * wy);
  const drag = 0.5 * RHO * DRAG * areaOf(ball) * w;
  const side = el.coanda * 0.5 * RHO * areaOf(ball) * c.moment;
  const inertia = ball.mass_kg + 0.5 * displacedKg(ball);
  const fx = drag * wx + side * nx;
  const fy = drag * wy + side * ny - netWeightN(el);
  return [fx / inertia, fy / inertia];
}

export function seat(el: Elephant, tiltDeg: number, state: State): State {
  let [x, y, vx, vy] = state;
  const [[ax, ay], [nx, ny]] = axes(tiltDeg);
  const s = x * ax + y * ay;
  const e = x * nx + y * ny;
  const floor = restHeight(el);
  if (s >= floor || Math.abs(e) > el.jet.opening_m / 2) return state;
  x = floor * ax + e * nx;
  y = floor * ay + e * ny;
  const into = vx * ax + vy * ay;
  if (into < 0) {
    vx = vx - into * ax;
    vy = vy - into * ay;
  }
  return [x, y, vx, vy];
}

export function step(el: Elephant, tiltDeg: number, state: State, h = STEP_S): State {
  const f = (st: State): State => {
    const [ax, ay] = acceleration(el, tiltDeg, st);
    return [st[2], st[3], ax, ay];
  };
  const add = (st: State, k: State, scale: number): State => [
    st[0] + scale * k[0],
    st[1] + scale * k[1],
    st[2] + scale * k[2],
    st[3] + scale * k[3],
  ];
  const k1 = f(state);
  const k2 = f(add(state, k1, h / 2));
  const k3 = f(add(state, k2, h / 2));
  const k4 = f(add(state, k3, h));
  const next = [0, 1, 2, 3].map((i) => state[i] + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])) as State;
  return seat(el, tiltDeg, next);
}

export function fallen(el: Elephant, state: State): boolean {
  const [x, y] = state;
  return y < 0 && Math.abs(x) > el.jet.opening_m / 2 + radiusOf(el.ball);
}

export function startState(el: Elephant, tiltDeg = 0): State {
  const [[ax, ay]] = axes(tiltDeg);
  const h = restHeight(el);
  return [h * ax, h * ay, 0, 0];
}

// ── a run ────────────────────────────────────────────────────────────────────

export interface Move {
  at_s: number;
  tilt_deg: number;
  over_s: number;
  nudge_m_s: number;
}

export function tiltAt(moves: readonly Move[], t: number): number {
  let tilt = 0;
  for (const move of moves) {
    if (t <= move.at_s) break;
    const f = move.over_s <= 0 ? 1 : Math.min(1, (t - move.at_s) / move.over_s);
    tilt += (move.tilt_deg - tilt) * f;
  }
  return tilt;
}

export interface ElephantRun {
  t: number[];
  x_m: number[];
  y_m: number[];
  tilt_deg: number[];
  air_m_s: number[];
  fell_at_s: number | null;
}

export function run(el: Elephant, moves: readonly Move[], durationS: number): ElephantRun {
  checkElephant(el);
  if (!(durationS > 0 && durationS <= MAX_DURATION_S)) throw new Error(`a run lasts between 0 and ${MAX_DURATION_S} s`);
  for (const move of moves) {
    if (Math.abs(move.tilt_deg) > MAX_TILT_DEG) throw new Error(`the trunk tilts at most ${MAX_TILT_DEG}°`);
  }
  const steps = roundHalfEven(durationS / STEP_S);
  const every = roundHalfEven(1 / (SAMPLES_PER_S * STEP_S));
  const nudges = moves
    .filter((m) => m.nudge_m_s)
    .map((m) => [m.at_s, m.nudge_m_s] as const)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let state = startState(el, tiltAt(moves, 0));
  const out: ElephantRun = { t: [], x_m: [], y_m: [], tilt_deg: [], air_m_s: [], fell_at_s: null };
  let pushed = 0;
  for (let n = 0; n <= steps; n += 1) {
    const t = n * STEP_S;
    const tilt = tiltAt(moves, t);
    while (pushed < nudges.length && nudges[pushed][0] <= t) {
      const [, [nx, ny]] = axes(tilt);
      const push = nudges[pushed][1];
      state = [state[0], state[1], state[2] + push * nx, state[3] + push * ny];
      pushed += 1;
    }
    if (n % every === 0) {
      const [s, e] = jetCoordinates(tilt, state[0], state[1]);
      out.t.push(t);
      out.x_m.push(state[0]);
      out.y_m.push(state[1]);
      out.tilt_deg.push(tilt);
      out.air_m_s.push(Math.sqrt(cover(el, s, e).mean_square));
    }
    if (fallen(el, state)) {
      out.fell_at_s = t;
      break;
    }
    if (n < steps) state = step(el, tilt, state);
  }
  return out;
}
