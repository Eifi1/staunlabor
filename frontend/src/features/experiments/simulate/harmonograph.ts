/**
 * The harmonograph, drawn in the browser: a line-for-line port of
 * `backend/staunlabor/domain/experiments/harmonograph.py` (`start`, `draw`,
 * `figures` and what they call), held to it by `simulate.test.ts`.
 *
 * Why here and nowhere else: the pen draws while the reader watches, a few
 * hundred Runge–Kutta steps a frame, and the figures — the ratio the beats are
 * near, how long the picture takes to turn, how long until it fades — change
 * with every slider, so there is no route: the page asks the port. A change to
 * the physics is made in Python first.
 *
 * {@link draw} is the engine's replay; {@link advance} is what the page calls
 * every frame — the same steps, carried on from where the last frame stopped.
 */

import { angleDeg, naturalRate, periodS, swingRhs } from "./pendulum";
import { MAX_DURATION_S, rk4, sampleEvery, STEP_S } from "./numerics";
import { radians, roundHalfEven } from "./python";

/** The ratios a picture is said to be near: p:q with both at most this. */
const MAX_RATIO_TERM = 6;
/** A swing has died away once it is down to this share of its start. */
const FADED = 0.1;

/** The engine's `HarmonographPendulum`. */
export interface HarmonographPendulum {
  length_m: number;
  amplitude_deg: number;
  phase_deg: number;
  damping_per_s: number;
}

/** The engine's `Harmonograph`: the pen's pendulum and the board's. */
export interface Harmonograph {
  pen: HarmonographPendulum;
  board: HarmonographPendulum;
}

/** The pendulum's angle and rate at `t = 0`: the exact pendulum let go at its
 *  swing, a share `φ/360°` of its period on. */
export function start(p: HarmonographPendulum): [number, number] {
  const later = (p.phase_deg / 360) * periodS(p.length_m, p.amplitude_deg);
  const theta = radians(angleDeg(p.length_m, p.amplitude_deg, later));
  const falling = Math.sin(radians(p.phase_deg)) > 0 ? -1.0 : 1.0;
  const energy = Math.max(0.0, Math.cos(theta) - Math.cos(radians(p.amplitude_deg)));
  return [theta, falling * naturalRate(p.length_m) * Math.sqrt(2 * energy)];
}

/** The engine's `HarmonographRun`. */
export interface HarmonographRun {
  t: number[];
  x_m: number[];
  y_m: number[];
}

/** Where a drawing in progress stands: the step it is at and both pendulums. */
export interface DrawingState {
  i: number;
  pen: number[];
  board: number[];
}

export function startDrawing(h: Harmonograph): DrawingState {
  return { i: 0, pen: start(h.pen), board: start(h.board) };
}

/** The pen's place on the board for a state. */
export function penAt(h: Harmonograph, state: DrawingState): [number, number] {
  return [h.pen.length_m * Math.sin(state.pen[0]), h.board.length_m * Math.sin(state.board[0])];
}

/** `steps` more steps of both pendulums, in place; `onStep` hears every state
 *  after a step, so a page draws as finely as it likes. */
export function advance(
  h: Harmonograph,
  state: DrawingState,
  steps: number,
  stepS = STEP_S,
  onStep?: (state: DrawingState) => void,
): void {
  const pen = swingRhs(h.pen.length_m, h.pen.damping_per_s);
  const board = swingRhs(h.board.length_m, h.board.damping_per_s);
  for (let k = 0; k < steps; k++) {
    const t = state.i * stepS;
    state.pen = rk4(pen, t, state.pen, stepS);
    state.board = rk4(board, t, state.board, stepS);
    state.i += 1;
    onStep?.(state);
  }
}

/** Both pendulums stepped together for `durationS`, the pen's place sampled. */
export function draw(h: Harmonograph, durationS: number, stepS = STEP_S): HarmonographRun {
  if (!(stepS > 0 && stepS <= 0.01)) throw new RangeError("the step lies between 0 and 10 ms");
  if (!(durationS > 0 && durationS <= MAX_DURATION_S))
    throw new RangeError(`a drawing lasts more than nothing and at most ${MAX_DURATION_S} s`);
  const pen = swingRhs(h.pen.length_m, h.pen.damping_per_s);
  const board = swingRhs(h.board.length_m, h.board.damping_per_s);
  let a: number[] = start(h.pen);
  let b: number[] = start(h.board);
  const steps = roundHalfEven(durationS / stepS);
  const every = sampleEvery(stepS);
  const run: HarmonographRun = { t: [], x_m: [], y_m: [] };
  for (let i = 0; i <= steps; i++) {
    const t = i * stepS;
    if (i % every === 0) {
      run.t.push(t);
      run.x_m.push(h.pen.length_m * Math.sin(a[0]));
      run.y_m.push(h.board.length_m * Math.sin(b[0]));
    }
    if (i < steps) {
      a = rk4(pen, t, a, stepS);
      b = rk4(board, t, b, stepS);
    }
  }
  return run;
}

/** The engine's: beats per second at the swing it is let go at, 1/T(L, θ₀). */
function frequencyHz(p: HarmonographPendulum): number {
  return 1 / periodS(p.length_m, p.amplitude_deg);
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** The simple ratio `p:q` nearest to `penHz : boardHz`, in lowest terms. */
function nearestRatio(penHz: number, boardHz: number): [number, number] {
  const target = boardHz / penHz;
  let best: [number, number] = [1, 1];
  let bestError = Infinity;
  for (let p = 1; p <= MAX_RATIO_TERM; p++) {
    for (let q = 1; q <= MAX_RATIO_TERM; q++) {
      if (gcd(p, q) !== 1) continue;
      const error = Math.abs(q / p - target) / target;
      if (error < bestError - 1e-12) {
        best = [p, q];
        bestError = error;
      }
    }
  }
  return best;
}

/** The engine's `HarmonographFigures`. */
export interface HarmonographFigures {
  pen_hz: number;
  board_hz: number;
  ratio: [number, number];
  detune: number;
  turn_s: number | null;
  pen_fades_s: number | null;
  board_fades_s: number | null;
}

const fades = (p: HarmonographPendulum) => (p.damping_per_s > 0 ? (2 * Math.log(1 / FADED)) / p.damping_per_s : null);

export function figures(h: Harmonograph): HarmonographFigures {
  const f1 = frequencyHz(h.pen);
  const f2 = frequencyHz(h.board);
  const [p, q] = nearestRatio(f1, f2);
  const beat = Math.abs(q * f1 - p * f2);
  return {
    pen_hz: f1,
    board_hz: f2,
    ratio: [p, q],
    detune: f2 / f1 / (q / p) - 1,
    turn_s: beat > 1e-12 ? 1 / beat : null,
    pen_fades_s: fades(h.pen),
    board_fades_s: fades(h.board),
  };
}
