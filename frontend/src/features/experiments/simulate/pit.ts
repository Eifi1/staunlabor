/**
 * The pit the race's balls jump into (`domain/experiments/pit.py`), ported for
 * the page: from the moment each ball leaves its track at the finish until all
 * of them lie still together at the bottom — the flight under g, the bounces
 * off the padded sides, the knocks between balls, the friction that sets them
 * spinning and the rolling resistance that brings them to rest.
 *
 * Line for line, as the other ports are, and bit for bit: balls knocking into
 * balls is chaotic, so a last bit that rounded differently would grow until the
 * page drew another heap than the engine computes. The engine uses only what
 * rounds the same in Python and here (`+ − × ÷`, `sqrt`; `sin`, `cos` and `log`
 * of the inputs it uses agree to the bit, which `simulate.test.ts` checks
 * through the cases). The page runs it once per build — the time loop the API's
 * budget has no room for — and looks the running time up in its samples.
 */

import { roundHalfEven } from "./sphere";

export const G = 9.80665;
export const STIFFNESS = 1.0e6;
export const LINING_RESTITUTION = 0.3;
export const BALL_RESTITUTION = 0.6;
export const FRICTION = 0.4;
export const SLIP_DAMPING = 1000.0;
export const ROLLING = 0.08;
export const DT = 1e-4;
export const EVERY = 50;
export const STILL_M_S = 3e-3;
export const STILL_FOR_S = 0.3;
export const LONGEST_AFTER_S = 6.0;

export interface Basin {
  left_x_m: number;
  right_x_m: number;
  rim_y_m: number;
  top_y_m: number;
  bottom_x_m: number;
  bottom_y_m: number;
  bottom_radius_m: number;
  slope_rad: number;
}

export interface Entry {
  time_s: number;
  x_m: number;
  y_m: number;
  vx_m_s: number;
  vy_m_s: number;
}

export interface PitBall {
  start_s: number;
  x_m: number[];
  y_m: number[];
  vx_m_s: number[];
  vy_m_s: number[];
  ax_m_s2: number[];
  ay_m_s2: number[];
}

export interface PitRun {
  sample_s: number;
  balls: PitBall[];
  settled_s: number;
  still: boolean;
}

type Contact = [number, number, number];

function damping(restitution: number, mass: number): number {
  const log = Math.log(restitution);
  const zeta = -log / Math.sqrt(Math.PI * Math.PI + log * log);
  return 2 * zeta * Math.sqrt(STIFFNESS * mass);
}

interface Balls {
  x: number[];
  y: number[];
  vx: number[];
  vy: number[];
  w: number[];
  active: boolean[];
  met: boolean[];
}

function arrive(balls: Balls, entries: Entry[], t: number, radius: number, turns: boolean): number[] {
  const arrived: number[] = [];
  entries.forEach((e, i) => {
    if (balls.active[i] || t < e.time_s) return;
    const late = t - e.time_s;
    balls.x[i] = e.x_m + e.vx_m_s * late;
    balls.y[i] = e.y_m + e.vy_m_s * late;
    balls.vx[i] = e.vx_m_s;
    balls.vy[i] = e.vy_m_s;
    balls.w[i] = turns ? -Math.sqrt(e.vx_m_s * e.vx_m_s + e.vy_m_s * e.vy_m_s) / radius : 0.0;
    balls.active[i] = true;
    arrived.push(i);
  });
  return arrived;
}

function side(ax: number, ay: number, bx: number, by: number, radius: number, x: number, y: number): Contact | null {
  const dx = bx - ax;
  const dy = by - ay;
  const length = Math.sqrt(dx * dx + dy * dy);
  const along = ((x - ax) * dx + (y - ay) * dy) / length;
  if (along < 0 || along >= length) return null;
  const qx = ax + (along * dx) / length;
  const qy = ay + (along * dy) / length;
  const d = Math.sqrt((x - qx) * (x - qx) + (y - qy) * (y - qy));
  if (d >= radius) return null;
  return [radius - d, (x - qx) / d, (y - qy) / d];
}

/** Where a ball at `(x, y)` presses into the lining: how deep, and the
 *  direction the lining pushes it. */
export function touching(bowl: Basin, radius: number, x: number, y: number): Contact[] {
  const contacts: Contact[] = [];
  const s = Math.sin(bowl.slope_rad);
  const c = Math.cos(bowl.slope_rad);
  const r = bowl.bottom_radius_m;
  const leftX = bowl.bottom_x_m - r * s;
  const rightX = bowl.bottom_x_m + r * s;
  const meetY = bowl.bottom_y_m - r * c;
  for (const contact of [
    side(bowl.left_x_m, bowl.rim_y_m, leftX, meetY, radius, x, y),
    side(rightX, meetY, bowl.right_x_m, bowl.rim_y_m, radius, x, y),
  ]) {
    if (contact !== null) contacts.push(contact);
  }
  const dx = x - bowl.bottom_x_m;
  const dy = y - bowl.bottom_y_m;
  if (dy < 0 && Math.abs(dx) * c <= -dy * s) {
    const d = Math.sqrt(dx * dx + dy * dy);
    const sink = d + radius - r;
    if (sink > 0) contacts.push([sink, -dx / d, -dy / d]);
  }
  if (y > bowl.rim_y_m) {
    if (x - bowl.left_x_m < radius) contacts.push([radius - (x - bowl.left_x_m), 1.0, 0.0]);
    if (bowl.right_x_m - x < radius) contacts.push([radius - (bowl.right_x_m - x), -1.0, 0.0]);
  }
  return contacts;
}

interface Pushes {
  ax: number[];
  ay: number[];
  spin: number[];
  roll: number[];
}

function lining(balls: Balls, bowl: Basin, radius: number, inertia: number, damp: number, out: Pushes): void {
  for (let i = 0; i < balls.x.length; i++) {
    if (!balls.active[i]) continue;
    for (const [sink, nx, ny] of touching(bowl, radius, balls.x[i], balls.y[i])) {
      const push = STIFFNESS * sink - damp * (balls.vx[i] * nx + balls.vy[i] * ny);
      if (push <= 0) continue;
      const tx = -ny;
      const ty = nx;
      const slip = balls.vx[i] * tx + balls.vy[i] * ty - radius * balls.w[i];
      const f = Math.max(-FRICTION * push, Math.min(FRICTION * push, SLIP_DAMPING * slip));
      out.ax[i] += push * nx - f * tx;
      out.ay[i] += push * ny - f * ty;
      if (inertia > 0) {
        out.spin[i] += f / (inertia * radius);
        out.roll[i] += (ROLLING * push) / (inertia * radius);
      }
    }
  }
}

function pairs(balls: Balls, radius: number, inertia: number, damp: number, out: Pushes): void {
  const n = balls.x.length;
  const reach2 = 2 * radius * (2 * radius);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (!(balls.met[i] && balls.met[j])) continue;
      const dx = balls.x[i] - balls.x[j];
      const dy = balls.y[i] - balls.y[j];
      const d2 = dx * dx + dy * dy;
      if (d2 >= reach2) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const ny = dy / d;
      const rvx = balls.vx[i] - balls.vx[j];
      const rvy = balls.vy[i] - balls.vy[j];
      const push = STIFFNESS * (2 * radius - d) - damp * (rvx * nx + rvy * ny);
      if (push <= 0) continue;
      const tx = -ny;
      const ty = nx;
      const slip = rvx * tx + rvy * ty - radius * (balls.w[i] + balls.w[j]);
      const f = Math.max(-FRICTION * push, Math.min(FRICTION * push, SLIP_DAMPING * slip));
      const fx = push * nx - f * tx;
      const fy = push * ny - f * ty;
      out.ax[i] += fx;
      out.ay[i] += fy;
      out.ax[j] -= fx;
      out.ay[j] -= fy;
      if (inertia > 0) {
        out.spin[i] += f / (inertia * radius);
        out.spin[j] += f / (inertia * radius);
      }
    }
  }
}

function advance(balls: Balls, out: Pushes, bowl: Basin, radius: number, inertia: number): boolean {
  let moving = false;
  for (let i = 0; i < balls.x.length; i++) {
    if (!balls.active[i]) {
      moving = true;
      continue;
    }
    balls.vx[i] += out.ax[i] * DT;
    balls.vy[i] += out.ay[i] * DT;
    balls.x[i] += balls.vx[i] * DT;
    balls.y[i] += balls.vy[i] * DT;
    balls.met[i] = balls.met[i] || balls.y[i] < bowl.rim_y_m;
    if (inertia > 0) {
      const spun = balls.w[i] + out.spin[i] * DT;
      const slowed = out.roll[i] * DT;
      balls.w[i] = Math.abs(spun) <= slowed ? 0.0 : spun - (spun < 0 ? -slowed : slowed);
    }
    if (
      Math.sqrt(balls.vx[i] * balls.vx[i] + balls.vy[i] * balls.vy[i]) > STILL_M_S ||
      Math.abs(balls.w[i]) * radius > STILL_M_S
    ) {
      moving = true;
    }
  }
  return moving;
}

/** The balls from their arrivals until they lie still: the engine's `run`. */
export function run(bowl: Basin, radius: number, inertia: number, entries: Entry[]): PitRun {
  const n = entries.length;
  const liningDamp = damping(LINING_RESTITUTION, 1.0);
  const pairDamp = damping(BALL_RESTITUTION, 0.5);
  const zeros = () => new Array<number>(n).fill(0.0);
  const balls: Balls = {
    x: zeros(),
    y: zeros(),
    vx: zeros(),
    vy: zeros(),
    w: zeros(),
    active: new Array<boolean>(n).fill(false),
    met: new Array<boolean>(n).fill(false),
  };
  const rows: number[][][] = entries.map(() => [[], [], [], [], [], []]);
  const starts = new Array<number>(n).fill(-1.0);
  const before: [number, number][] = entries.map(() => [0.0, 0.0]);
  const start = Math.min(...entries.map((e) => e.time_s));
  const limit = roundHalfEven((Math.max(...entries.map((e) => e.time_s)) - start + LONGEST_AFTER_S) / DT);
  let stillSteps = 0;
  let step = 0;
  let still = false;
  while (step <= limit) {
    const t = start + step * DT;
    for (const i of arrive(balls, entries, t, radius, inertia > 0)) before[i] = [balls.vx[i], balls.vy[i]];
    if (step % EVERY === 0) {
      for (let i = 0; i < n; i++) {
        if (!balls.active[i]) continue;
        const first = starts[i] < 0;
        if (first) starts[i] = t;
        const ax = first ? 0.0 : (balls.vx[i] - before[i][0]) / (EVERY * DT);
        const ay = first ? -G : (balls.vy[i] - before[i][1]) / (EVERY * DT);
        const values = [balls.x[i], balls.y[i], balls.vx[i], balls.vy[i], ax, ay];
        values.forEach((value, k) => rows[i][k].push(value));
        before[i] = [balls.vx[i], balls.vy[i]];
      }
    }
    const out: Pushes = { ax: zeros(), ay: new Array<number>(n).fill(-G), spin: zeros(), roll: zeros() };
    lining(balls, bowl, radius, inertia, liningDamp, out);
    pairs(balls, radius, inertia, pairDamp, out);
    stillSteps = !advance(balls, out, bowl, radius, inertia) ? stillSteps + 1 : 0;
    if (stillSteps * DT >= STILL_FOR_S && step % EVERY === 0) {
      still = true;
      break;
    }
    step += 1;
  }
  return {
    sample_s: EVERY * DT,
    balls: rows.map((r, i) => ({
      start_s: starts[i],
      x_m: r[0],
      y_m: r[1],
      vx_m_s: r[2],
      vy_m_s: r[3],
      ax_m_s2: r[4],
      ay_m_s2: r[5],
    })),
    settled_s: start + step * DT,
    still,
  };
}
