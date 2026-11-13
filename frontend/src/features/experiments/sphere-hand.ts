/**
 * The hand that moves the hanging sphere, for the page.
 *
 * The engine takes the sphere's acceleration as given (`experiments.sphere`:
 * the ropes keep it in the horizontal plane, the hand moves it where it likes).
 * A finger on a screen does not give an acceleration: it gives a position, in
 * jumps, a frame at a time — differentiating that twice would hand the ball a
 * spike every frame. So the sphere follows the finger the way a hand follows
 * an intention: as a critically damped spring at {@link HAND_HZ}, which is
 * smooth (the acceleration is continuous) and about as quick as an arm. The
 * acceleration that spring produces is what the ball is given, step by step,
 * through the port's `handStep`.
 *
 * The same spring carries the autopilot, which circles a target round at a
 * tempo that changes either at once or slowly ({@link SLOW_HZ_PER_S}, the
 * engine's sweep from 0.7 to 2.5 Hz over thirty seconds).
 *
 * What it is not: a model of an arm. Nothing here pushes back.
 */

/** How quickly the hand follows the finger: a critically damped spring's
 *  natural frequency. At the 2.5 Hz the ball needs high up, it lags by about
 *  45° and moves 85 % as far — a hand, not a robot. */
export const HAND_HZ = 6;

/** The farthest the hand pushes the sphere from where it hangs. */
export const MAX_PUSH_M = 0.05;

/** The autopilot's circle. */
export const AUTO_RADIUS_M = 0.02;

/** "Slowly": the engine's default sweep, 0.7 to 2.5 Hz over 30 s. */
export const SLOW_HZ_PER_S = 1.8 / 30;

/** How long the measured tempo takes to settle. */
const TEMPO_SETTLE_S = 0.5;

/** Below this the hand is "at rest" and has no tempo to measure. */
const STILL_M = 0.003;

export interface Hand {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** The autopilot's angle round its circle, and its current tempo. */
  phase: number;
  tempoHz: number;
  /** The tempo measured from the hand's own motion, smoothed. */
  measuredHz: number;
  /** The last angle the hand was at, for the measurement. */
  lastAngle: number | null;
}

export function restingHand(): Hand {
  return { x: 0, y: 0, vx: 0, vy: 0, phase: 0, tempoHz: 0, measuredHz: 0, lastAngle: null };
}

/** The finger's point, kept within reach. */
export function clampPush(x: number, y: number): [number, number] {
  const r = Math.hypot(x, y);
  return r <= MAX_PUSH_M ? [x, y] : [(x * MAX_PUSH_M) / r, (y * MAX_PUSH_M) / r];
}

/** One step of the hand towards `(tx, ty)`: the spring's acceleration, then
 *  the hand moved by it (semi-implicit Euler, which a spring at 6 Hz stepped
 *  every millisecond does not notice). Answers the acceleration it had over
 *  the step — what the ball is handed. */
export function follow(hand: Hand, tx: number, ty: number, h: number): [number, number] {
  const w = 2 * Math.PI * HAND_HZ;
  const ax = w * w * (tx - hand.x) - 2 * w * hand.vx;
  const ay = w * w * (ty - hand.y) - 2 * w * hand.vy;
  hand.vx += ax * h;
  hand.vy += ay * h;
  hand.x += hand.vx * h;
  hand.y += hand.vy * h;
  measure(hand, h);
  return [ax, ay];
}

/** Where the autopilot's finger is after one more step at a tempo moving
 *  towards `setHz` — at once, or slowly. */
export function autopilotTarget(hand: Hand, setHz: number, slowly: boolean, h: number): [number, number] {
  if (slowly) {
    const most = SLOW_HZ_PER_S * h;
    hand.tempoHz += Math.max(-most, Math.min(most, setHz - hand.tempoHz));
  } else {
    hand.tempoHz = setHz;
  }
  hand.phase += 2 * Math.PI * hand.tempoHz * h;
  return [AUTO_RADIUS_M * Math.cos(hand.phase), AUTO_RADIUS_M * Math.sin(hand.phase)];
}

/** The hand's tempo, read off how fast its angle round the rest point turns,
 *  smoothed; zero while it is still. */
function measure(hand: Hand, h: number) {
  if (Math.hypot(hand.x, hand.y) < STILL_M) {
    hand.lastAngle = null;
    hand.measuredHz += (0 - hand.measuredHz) * (h / TEMPO_SETTLE_S);
    return;
  }
  const angle = Math.atan2(hand.y, hand.x);
  if (hand.lastAngle !== null) {
    let turned = angle - hand.lastAngle;
    if (turned > Math.PI) turned -= 2 * Math.PI;
    if (turned < -Math.PI) turned += 2 * Math.PI;
    const hz = Math.abs(turned) / (2 * Math.PI * h);
    hand.measuredHz += (hz - hand.measuredHz) * (h / TEMPO_SETTLE_S);
  }
  hand.lastAngle = angle;
}

/** How far the hand leads the ball round, degrees in (−180, 180]: a quarter
 *  turn ahead is the push that does the most work. */
export function leadDeg(hand: Hand, ballX: number, ballY: number): number {
  let d = ((Math.atan2(hand.y, hand.x) - Math.atan2(ballY, ballX)) * 180) / Math.PI;
  while (d <= -180) d += 360;
  while (d > 180) d -= 360;
  return d;
}

/** The fastest the auto mode circles: about as fast as a person can push a
 *  hanging sphere round. The ball would climb on towards the equator at any
 *  faster tempo; a hand cannot follow it there. */
export const MAX_TEMPO_HZ = 4;

/** The ball's tempo round the sphere's axis, hertz, signed (positive
 *  anticlockwise seen from above); zero while it is too near the bottom to
 *  have a direction. */
export function ballTempoHz(bx: number, by: number, vx: number, vy: number): number {
  const r2 = bx * bx + by * by;
  if (r2 < 0.005 * 0.005) return 0;
  return (bx * vy - by * vx) / r2 / (2 * Math.PI);
}

/**
 * The finger for perfect timing: always a quarter turn ahead of the ball, so
 * every push does the most work it can — plus the hand's own lag at the ball's
 * tempo (`2·atan(f/f_hand)`, a critically damped spring's), so that it is the
 * sphere, not the finger, that leads by the quarter turn. The tempo is not
 * chosen at all: the hand speeds up exactly as the ball climbs, which is the
 * whole trick done right.
 *
 * Until the ball has a direction it circles at `startHz` (the lowest orbit's,
 * where the ball answers most) to set it going. The target's angle may turn no
 * faster than {@link MAX_TEMPO_HZ}: past that it falls behind its quarter turn,
 * pushes less, and the ball settles where a person's arm gives out.
 */
export function perfectTarget(
  hand: Hand,
  ball: { x: number; y: number; vx: number; vy: number },
  startHz: number,
  h: number,
): [number, number] {
  const hz = ballTempoHz(ball.x, ball.y, ball.vx, ball.vy);
  if (Math.abs(hz) < 0.3 * startHz) return autopilotTarget(hand, startHz, false, h);
  const lag = 2 * Math.atan(Math.abs(hz) / HAND_HZ);
  const wanted = Math.atan2(ball.y, ball.x) + Math.sign(hz) * (Math.PI / 2 + lag);
  let turn = wanted - hand.phase;
  turn -= 2 * Math.PI * Math.round(turn / (2 * Math.PI));
  const most = 2 * Math.PI * MAX_TEMPO_HZ * h;
  hand.phase += Math.max(-most, Math.min(most, turn));
  hand.tempoHz = Math.abs(hz);
  return [AUTO_RADIUS_M * Math.cos(hand.phase), AUTO_RADIUS_M * Math.sin(hand.phase)];
}
