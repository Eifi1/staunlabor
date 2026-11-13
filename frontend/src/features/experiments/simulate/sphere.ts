/**
 * The ball in the hanging sphere, run in the browser: a line-for-line port of
 * `backend/staunlabor/domain/experiments/sphere.py` (`step`, `run` and
 * what they call).
 *
 * Why it is here rather than asked of the engine: the page lets the reader push
 * the sphere round with a finger, and the ball has to answer that hand sixty
 * times a second — no round trip can. What it does not do is decide anything:
 * the model, its constants and its step are the engine's, copied rather than
 * improved (the order of every sum, Python's half-to-even `round`), and
 * `simulate.test.ts` holds this file to what the engine answers for the cases
 * it wrote (`engine-cases.json`, written by `scripts/write-experiments-cases.py`;
 * the backend suite fails when the engine and the file drift apart). A change
 * to the physics is made in Python first.
 *
 * Two ways in. {@link run} replays a scripted hand (the engine's `Drive`) and
 * is what the test holds to the engine. {@link handStep} is what a page calls
 * every frame: one engine step with the hand's acceleration held over it —
 * the same Runge–Kutta step, with the drive's formula replaced by whatever the
 * finger did.
 */

/** Standard gravity, as the engine uses. */
export const G = 9.80665;
/** I/(m·r²) for the two balls the page offers. */
export const SOLID = 2 / 5;
export const HOLLOW = 2 / 3;
/** The speed below which rolling resistance fades in rather than switching sign. */
export const RESISTANCE_FADE_M_S = 1e-3;
/** The engine's step: 1 ms. */
export const STEP_S = 1e-3;
/** Samples a run returns per second, whatever its step. */
export const SAMPLES_PER_S = 50;
/** The longest run the engine takes. */
export const MAX_DURATION_S = 120.0;

export type BallKind = "solid" | "hollow";
export type DrivePath = "circle" | "line";

/** The engine's `Sphere`. */
export interface SphereParameters {
  shell_radius_m: number;
  ball_radius_m: number;
  ball: BallKind;
  rolling_resistance: number;
}

/** The engine's `Drive`: a circle (or a line) whose rate sweeps, then holds. */
export interface Drive {
  radius_m: number;
  start_hz: number;
  end_hz: number;
  sweep_s: number;
  hold_s: number;
  path: DrivePath;
}

/** The engine's `SphereRun`, in its names. */
export interface SphereRun {
  t: number[];
  angle_deg: number[];
  depth_below_equator_m: number[];
  drive_hz: number[];
  lead_deg: number[];
  final_angle_deg: number;
  highest_angle_deg: number;
  friction_needed: number;
  left_the_wall: boolean;
}

/** The ball's state: its centre relative to the sphere's, and its velocity. */
export type SphereState = [number, number, number, number, number, number];

/** Python's `round`: half to even, as the step counts are taken. */
export function roundHalfEven(x: number): number {
  const down = Math.floor(x);
  const rest = x - down;
  if (rest > 0.5) return down + 1;
  if (rest < 0.5) return down;
  return down % 2 === 0 ? down : down + 1;
}

/** `math.radians` and `math.degrees`: one multiplication by CPython's constant. */
const DEG_TO_RAD = Math.PI / 180.0;
const RAD_TO_DEG = 180.0 / Math.PI;

/** The engine's `Sphere.__post_init__`: the sliders never reach these, so a
 *  refusal here is a defect upstream, said in the engine's words. */
export function checkSphere(s: SphereParameters): void {
  if (!(s.shell_radius_m > 0) || !(s.ball_radius_m > 0)) {
    throw new RangeError("the sphere and the ball need a positive radius");
  }
  if (s.ball_radius_m >= s.shell_radius_m) throw new RangeError("the ball has to fit inside the sphere");
  if (s.rolling_resistance < 0) throw new RangeError("rolling resistance cannot be negative");
}

/** ρ: how far the ball's centre stays from the sphere's centre. */
export const pathRadius = (s: SphereParameters) => s.shell_radius_m - s.ball_radius_m;
export const inertiaFactor = (s: SphereParameters) => (s.ball === "solid" ? SOLID : HOLLOW);
/** 1/(1 + k): 5/7 for a solid ball, 3/5 for a hollow one. */
export const gravityShare = (s: SphereParameters) => 1 / (1 + inertiaFactor(s));

/** The engine's `Drive.__post_init__`. */
export function checkDrive(d: Drive): void {
  if (d.radius_m < 0 || d.start_hz < 0 || d.end_hz < 0) {
    throw new RangeError("the drive's radius and rates cannot be negative");
  }
  if (d.sweep_s < 0 || d.hold_s < 0) throw new RangeError("the drive's times cannot be negative");
  if (d.sweep_s + d.hold_s > MAX_DURATION_S) throw new RangeError(`a run lasts at most ${MAX_DURATION_S} s`);
}

/** The hand's phase, rate (rad/s) and rate of change of rate at `t`. */
export function driveState(d: Drive, t: number): [number, number, number] {
  const w0 = 2 * Math.PI * (d.sweep_s > 0 ? d.start_hz : d.end_hz);
  const w1 = 2 * Math.PI * d.end_hz;
  if (d.sweep_s > 0 && t < d.sweep_s) {
    const alpha = (w1 - w0) / d.sweep_s;
    return [w0 * t + 0.5 * alpha * t * t, w0 + alpha * t, alpha];
  }
  const swept = d.sweep_s > 0 ? 0.5 * (w0 + w1) * d.sweep_s : 0.0;
  return [swept + w1 * (t - (d.sweep_s > 0 ? d.sweep_s : 0.0)), w1, 0.0];
}

/** The sphere's horizontal acceleration under the scripted hand. */
export function shellAcceleration(d: Drive, t: number): [number, number] {
  const [phase, rate, alpha] = driveState(d, t);
  const a = d.radius_m;
  const c = Math.cos(phase);
  const s = Math.sin(phase);
  const ax = a * (-rate * rate * c - alpha * s);
  if (d.path === "line") return [ax, 0.0];
  return [ax, a * (-rate * rate * s + alpha * c)];
}

/**
 * The ball centre's acceleration relative to the sphere, and the wall's push
 * per kilogram (`acceleration` in the engine): the push `G − A` along the wall
 * at 1/(1 + k), the centripetal term across it, rolling resistance `C·N`
 * against the motion. Written into `out` rather than returned as a tuple: four
 * calls a step, sixty steps a frame.
 */
export function acceleration(
  s: SphereParameters,
  px: number,
  py: number,
  pz: number,
  vx: number,
  vy: number,
  vz: number,
  shellAx: number,
  shellAy: number,
  out: number[],
): number {
  const rho = pathRadius(s);
  const nx = px / rho;
  const ny = py / rho;
  const nz = pz / rho;
  const gx = -shellAx;
  const gy = -shellAy;
  const gz = -G;
  const gN = gx * nx + gy * ny + gz * nz;
  const v2 = vx * vx + vy * vy + vz * vz;
  const normal = v2 / rho + gN;
  const resist = (s.rolling_resistance * Math.max(normal, 0.0)) / Math.sqrt(v2 + RESISTANCE_FADE_M_S ** 2);
  const share = gravityShare(s);
  out[0] = (gx - gN * nx - resist * vx) * share - (v2 / rho) * nx;
  out[1] = (gy - gN * ny - resist * vy) * share - (v2 / rho) * ny;
  out[2] = (gz - gN * nz - resist * vz) * share - (v2 / rho) * nz;
  return normal;
}

/** The ball `angleDeg` up the wall towards +x, rolling round at `speed` along +y. */
export function startState(s: SphereParameters, angleDeg = 0.0, speedMS = 0.0): SphereState {
  const rho = pathRadius(s);
  const th = angleDeg * DEG_TO_RAD;
  return [rho * Math.sin(th), 0.0, -rho * Math.cos(th), 0.0, speedMS, 0.0];
}

/**
 * One classical Runge–Kutta step under the hand `shell(t)`, then the centre
 * put back on its sphere and the velocity back on its tangent plane — the
 * engine's `step`, with the drive's formula a parameter.
 */
export function step(
  s: SphereParameters,
  shell: (t: number) => [number, number],
  t: number,
  y: SphereState,
  h: number,
): SphereState {
  const acc = [0, 0, 0];
  const f = (tt: number, yy: number[]): number[] => {
    const [ax, ay] = shell(tt);
    acceleration(s, yy[0], yy[1], yy[2], yy[3], yy[4], yy[5], ax, ay, acc);
    return [yy[3], yy[4], yy[5], acc[0], acc[1], acc[2]];
  };
  const k1 = f(t, y);
  const k2 = f(
    t + h / 2,
    y.map((v, i) => v + (h / 2) * k1[i]),
  );
  const k3 = f(
    t + h / 2,
    y.map((v, i) => v + (h / 2) * k2[i]),
  );
  const k4 = f(
    t + h,
    y.map((v, i) => v + h * k3[i]),
  );
  const n = y.map((v, i) => v + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
  const rho = pathRadius(s);
  const r = Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]);
  const px = (n[0] * rho) / r;
  const py = (n[1] * rho) / r;
  const pz = (n[2] * rho) / r;
  const radial = (n[3] * px + n[4] * py + n[5] * pz) / (rho * rho);
  return [px, py, pz, n[3] - radial * px, n[4] - radial * py, n[5] - radial * pz];
}

/** What a page calls each frame: one engine step with the hand's acceleration,
 *  as the finger moved the sphere, held over the step. */
export function handStep(s: SphereParameters, y: SphereState, shellAx: number, shellAy: number, h = STEP_S) {
  const held = (): [number, number] => [shellAx, shellAy];
  return step(s, held, 0.0, y, h);
}

/** How far up the wall the ball is, degrees from the bottom. */
export const angleOf = (s: SphereParameters, y: SphereState) =>
  Math.acos(Math.max(-1.0, Math.min(1.0, -y[2] / pathRadius(s)))) * RAD_TO_DEG;

/** `math.fmod` is JavaScript's `%`; then into (−180°, 180°]. */
function wrapDeg(angle: number): number {
  const a = (angle + 180.0) % 360.0;
  return (a <= 0 ? a + 360.0 : a) - 180.0;
}

/** The ball under the scripted hand, from `startAngleDeg` up the wall. */
export function run(s: SphereParameters, d: Drive, startAngleDeg = 0.0, startSpeedMS = 0.0, stepS = STEP_S): SphereRun {
  checkSphere(s);
  checkDrive(d);
  if (!(stepS > 0 && stepS <= 0.01)) throw new RangeError("the step lies between 0 and 10 ms");
  if (!(startAngleDeg >= 0 && startAngleDeg < 180)) {
    throw new RangeError("the ball starts between the bottom and the top");
  }
  const rho = pathRadius(s);
  let y = startState(s, startAngleDeg, startSpeedMS);
  const steps = roundHalfEven((d.sweep_s + d.hold_s) / stepS);
  const every = Math.max(1, roundHalfEven(1 / (SAMPLES_PER_S * stepS)));
  const out: SphereRun = {
    t: [],
    angle_deg: [],
    depth_below_equator_m: [],
    drive_hz: [],
    lead_deg: [],
    final_angle_deg: 0,
    highest_angle_deg: 0,
    friction_needed: 0,
    left_the_wall: false,
  };
  let friction = 0.0;
  let left = false;
  const share = gravityShare(s);
  const acc = [0, 0, 0];
  const shell = (tt: number) => shellAcceleration(d, tt);
  for (let i = 0; i <= steps; i++) {
    const t = i * stepS;
    if (i % every === 0) {
      const [phase, rate] = driveState(d, t);
      const ball = Math.atan2(y[1], y[0]);
      out.t.push(t);
      out.angle_deg.push(angleOf(s, y));
      out.depth_below_equator_m.push(-y[2]);
      out.drive_hz.push(rate / (2 * Math.PI));
      out.lead_deg.push(wrapDeg((phase - ball) * RAD_TO_DEG));
    }
    const [ax, ay] = shell(t);
    const normal = acceleration(s, y[0], y[1], y[2], y[3], y[4], y[5], ax, ay, acc);
    if (normal <= 0) {
      left = true;
    } else {
      // The friction the rolling asks for: k/(1+k) of the push along the wall.
      const gx = -ax;
      const gy = -ay;
      const gz = -G;
      const gN = (gx * y[0] + gy * y[1] + gz * y[2]) / rho;
      const tangential = Math.sqrt(Math.max(0.0, gx * gx + gy * gy + gz * gz - gN * gN));
      friction = Math.max(friction, ((1 - share) * tangential) / normal);
    }
    if (i < steps) y = step(s, shell, t, y, stepS);
  }
  out.final_angle_deg = out.angle_deg[out.angle_deg.length - 1];
  out.highest_angle_deg = Math.max(...out.angle_deg);
  out.friction_needed = friction;
  out.left_the_wall = left;
  return out;
}
