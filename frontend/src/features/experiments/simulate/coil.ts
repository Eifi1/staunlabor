/**
 * The magnet car and the coil, run in the browser: a line-for-line port of
 * `backend/staunlabor/domain/experiments/coil.py` (`run`, `timing_curve`
 * and what they call).
 *
 * Why it is here rather than asked of the engine: the page's two buttons are
 * pressed by the reader, and the car, the current and the meter have to answer
 * them within a frame. What it does not do is decide anything: the model, its
 * constants and its step are the engine's, copied rather than improved (the
 * order of every sum, Python's half-to-even `round`, `copysign`'s signed zero),
 * and `simulate.test.ts` holds this file to what the engine answers for the
 * cases it wrote (`engine-cases.json`, written by
 * `scripts/write-experiments-cases.py`; the backend suite fails when the
 * engine and the file drift apart). A change to the physics is made in Python
 * first.
 *
 * Two ways in. {@link run} replays a visitor (the press rule or a recording)
 * and is what the test holds to the engine. A page drives a {@link CoilSim}
 * itself, one {@link frame} per step with the buttons as they are held — the
 * same two halves {@link run} calls, in the same order.
 */

/** Standard gravity, as the engine uses. */
export const G = 9.80665;
/** The magnetic constant, 4π·10⁻⁷ H/m. */
export const MU0 = 4e-7 * Math.PI;
/** The speed below which rolling resistance fades in rather than switching sign. */
export const RESISTANCE_FADE_M_S = 1e-3;
/** The engine's step: 0.2 ms. */
export const STEP_S = 2e-4;
export const SAMPLES_PER_S = 200;
export const MAX_DURATION_S = 60.0;
/** The steepest a ramp's arc may end, radians. */
export const STEEPEST_RAD = 1.2;
/** Below this the rule presses nothing: a car standing still is neither coming
 *  in nor going out. */
export const STANDING_M_S = 0.01;

/** −1, 0, +1: the minus button, none, the plus button. */
export type Press = -1 | 0 | 1;
export type Idle = "closed" | "open";

export interface Magnet {
  remanence_t: number;
  diameter_m: number;
  length_m: number;
}

export interface Coil {
  turns: number;
  mean_diameter_m: number;
  length_m: number;
  resistance_ohm: number;
}

export interface Track {
  car_mass_kg: number;
  flat_length_m: number;
  ramp_length_m: number;
  ramp_radius_m: number;
  rolling_resistance: number;
}

/** The engine's `CoilExhibit`. */
export interface CoilExhibit {
  magnet: Magnet;
  coil: Coil;
  track: Track;
  supply_v: number;
  idle: Idle;
}

/** The engine's `PressRule`: plus coming in, minus going out, within a window. */
export interface PressRule {
  kind: "rule";
  window_m: number;
  late_s: number;
  reversed: boolean;
}

/** The engine's `Scripted`: presses at fixed times, `[from_s, to_s, press]`. */
export interface Scripted {
  kind: "scripted";
  presses: [number, number, Press][];
}

export type Visitor = PressRule | Scripted | null;

export interface EnergyAccount {
  battery_j: number;
  heat_j: number;
  rolling_j: number;
  switching_j: number;
  end_stops_j: number;
  mechanical_change_j: number;
  field_change_j: number;
  unaccounted_j: number;
}

/** The engine's `CoilRun`, in its names. */
export interface CoilRun {
  t: number[];
  x_m: number[];
  speed_m_s: number[];
  current_a: number[];
  induced_v: number[];
  press: number[];
  height_m: number[];
  peaks_m: number[];
  tops: number;
  energy: EnergyAccount;
}

export interface TimingPoint {
  late_s: number;
  gain_j: number;
}

/** Python's `round`: half to even, as the step counts are taken. */
export function roundHalfEven(x: number): number {
  const down = Math.floor(x);
  const rest = x - down;
  if (rest > 0.5) return down + 1;
  if (rest < 0.5) return down;
  return down % 2 === 0 ? down : down + 1;
}

/** `math.copysign`: the sign of `sign`, a negative zero included. */
const copysign = (magnitude: number, sign: number) =>
  sign < 0 || Object.is(sign, -0) ? -Math.abs(magnitude) : Math.abs(magnitude);

// ── the exhibit's parts ─────────────────────────────────────────────────────

/** `m = B_r·V/μ₀`. */
export const moment = (m: Magnet) => (m.remanence_t * Math.PI * (m.diameter_m / 2) ** 2 * m.length_m) / MU0;

/** Wheeler's single-layer formula. */
export function inductance(c: Coil): number {
  const a = c.mean_diameter_m / 2;
  return (MU0 * c.turns ** 2 * Math.PI * a * a) / (c.length_m + 0.9 * a);
}

export const endOf = (t: Track) => t.flat_length_m / 2 + t.ramp_length_m;
export const topHeight = (t: Track) => t.ramp_radius_m * (1 - Math.cos(t.ramp_length_m / t.ramp_radius_m));

/** The engine's `__post_init__`s: the sliders never reach these. */
export function checkExhibit(ex: CoilExhibit): void {
  const { magnet: m, coil: c, track: t } = ex;
  if (m.remanence_t <= 0 || m.diameter_m <= 0 || m.length_m <= 0) {
    throw new RangeError("the magnet needs a positive remanence and size");
  }
  if (c.turns < 1 || c.mean_diameter_m <= 0 || c.length_m <= 0 || c.resistance_ohm <= 0) {
    throw new RangeError("the coil needs turns, a size and a resistance");
  }
  if (t.car_mass_kg <= 0 || t.flat_length_m <= 0 || t.ramp_length_m <= 0) {
    throw new RangeError("the car needs a mass and the track a length");
  }
  if (t.ramp_radius_m <= 0 || t.ramp_length_m / t.ramp_radius_m > STEEPEST_RAD) {
    throw new RangeError("a ramp's arc ends steeper than 69°: make it shorter or its radius larger");
  }
  if (t.rolling_resistance < 0) throw new RangeError("rolling resistance cannot be negative");
  if (ex.supply_v <= 0) throw new RangeError("the supply needs a voltage");
  if (c.length_m / 2 >= t.flat_length_m / 2) {
    throw new RangeError("the coil has to fit on the flat between the ramps");
  }
}

// ── the curve ───────────────────────────────────────────────────────────────

const prefactor = (ex: CoilExhibit) => (MU0 * moment(ex.magnet) * ex.coil.turns) / (2 * ex.coil.length_m);

/** k(x) = dΨ/dx: volts per metre per second, newtons per ampere. */
export function coupling(ex: CoilExhibit, x: number): number {
  const a = ex.coil.mean_diameter_m / 2;
  const u1 = x + ex.coil.length_m / 2;
  const u2 = x - ex.coil.length_m / 2;
  return prefactor(ex) * a * a * ((a * a + u1 * u1) ** -1.5 - (a * a + u2 * u2) ** -1.5);
}

// ── the track ───────────────────────────────────────────────────────────────

/** dh/dx along the track, `sin(s/R)` up a ramp's arc, signed with `x`. */
export function slope(ex: CoilExhibit, x: number): number {
  const t = ex.track;
  const s = Math.abs(x) - t.flat_length_m / 2;
  if (s <= 0) return 0.0;
  return copysign(Math.sin(s / t.ramp_radius_m), x);
}

/** `1/R` on a ramp, zero on the flat. */
export function curvature(ex: CoilExhibit, x: number): number {
  const t = ex.track;
  return Math.abs(x) > t.flat_length_m / 2 ? 1 / t.ramp_radius_m : 0.0;
}

/** The track's height: `R·(1 − cos(s/R))` up a ramp's arc. */
export function height(ex: CoilExhibit, x: number): number {
  const t = ex.track;
  const s = Math.abs(x) - t.flat_length_m / 2;
  if (s <= 0) return 0.0;
  return t.ramp_radius_m * (1 - Math.cos(s / t.ramp_radius_m));
}

const mechanical = (ex: CoilExhibit, x: number, v: number) =>
  0.5 * ex.track.car_mass_kg * v * v + ex.track.car_mass_kg * G * height(ex, x);

/** `(x, v, i, battery, heat, rolling)` → their rates, into `out`. */
function derivatives(ex: CoilExhibit, y: number[], u: number, openCircuit: boolean, out: number[]): void {
  const x = y[0];
  const v = y[1];
  const i = y[2];
  const t = ex.track;
  const k = coupling(ex, x);
  const r = ex.coil.resistance_ohm;
  const grade = slope(ex, x);
  const cosA = Math.sqrt(1 - grade * grade);
  const normal = G * cosA + v * v * curvature(ex, x);
  const resist = (t.rolling_resistance * t.car_mass_kg * normal * v) / Math.sqrt(v * v + RESISTANCE_FADE_M_S ** 2);
  out[0] = v;
  out[1] = (k * i - t.car_mass_kg * G * grade - resist) / t.car_mass_kg;
  out[2] = openCircuit ? 0.0 : (u - r * i - k * v) / inductance(ex.coil);
  out[3] = u * i;
  out[4] = r * i * i;
  out[5] = resist * v;
}

// ── the visitor ─────────────────────────────────────────────────────────────

/** The engine's `_press`: which button the visitor holds now. */
export function pressOf(visitor: Visitor, t: number, x: number, v: number, crossedAt: number | null): Press {
  if (visitor === null) return 0;
  if (visitor.kind === "scripted") {
    for (const [start, end, press] of visitor.presses) {
      if (start <= t && t < end) return press;
    }
    return 0;
  }
  if (Math.abs(x) > visitor.window_m || Math.abs(v) < STANDING_M_S) return 0;
  const comingIn = x * v < 0;
  let press: Press;
  if (comingIn) {
    const toCentre = v !== 0 ? Math.abs(x) / Math.abs(v) : Infinity;
    press = visitor.late_s < 0 && toCentre < -visitor.late_s ? -1 : 1;
  } else if (visitor.late_s > 0 && crossedAt !== null && t - crossedAt < visitor.late_s) {
    press = 1;
  } else {
    press = -1;
  }
  return visitor.reversed ? (-press as Press) : press;
}

// ── the simulation, one step at a time ──────────────────────────────────────

/** Everything a run carries from one step to the next. */
export interface CoilSim {
  /** `(x, v, i, battery, heat, rolling)`. */
  y: number[];
  /** Steps taken; the time is `n·step`, as the engine counts it. */
  n: number;
  crossedAt: number | null;
  switching: number;
  stops: number;
  tops: number;
  peaks: number[];
  /** Kinetic and potential at the start, for the account. */
  mech0: number;
}

export function start(ex: CoilExhibit, startX: number | null = null, startSpeed = 0.0): CoilSim {
  checkExhibit(ex);
  const t = ex.track;
  const x0 = startX !== null ? startX : -(t.flat_length_m / 2 + t.ramp_length_m / 2);
  if (Math.abs(x0) > endOf(t)) throw new RangeError("the car has to start on the track");
  return {
    y: [x0, startSpeed, 0.0, 0.0, 0.0, 0.0],
    n: 0,
    crossedAt: null,
    switching: 0.0,
    stops: 0.0,
    tops: 0,
    peaks: [],
    mech0: mechanical(ex, x0, startSpeed),
  };
}

/** The first half of a step: with the coil open and no button held, the
 *  current stops and its field's energy goes into the spark. Answers whether
 *  the circuit is open for the step. */
export function release(ex: CoilExhibit, sim: CoilSim, press: Press): boolean {
  const openCircuit = ex.idle === "open" && press === 0;
  if (openCircuit && sim.y[2] !== 0.0) {
    const i = sim.y[2];
    sim.switching += 0.5 * inductance(ex.coil) * i * i;
    sim.y = [sim.y[0], sim.y[1], 0.0, sim.y[3], sim.y[4], sim.y[5]];
  }
  return openCircuit;
}

/** The second half: one Runge–Kutta step with the button held, then the
 *  centre crossing, a turn-around on a ramp and the end stop. */
export function advance(ex: CoilExhibit, sim: CoilSim, press: Press, openCircuit: boolean, h = STEP_S): void {
  const t = ex.track;
  const now = sim.n * h;
  const y = sim.y;
  const x = y[0];
  const v = y[1];
  const u = ex.supply_v * press;
  const k1 = [0, 0, 0, 0, 0, 0];
  const k2 = [0, 0, 0, 0, 0, 0];
  const k3 = [0, 0, 0, 0, 0, 0];
  const k4 = [0, 0, 0, 0, 0, 0];
  derivatives(ex, y, u, openCircuit, k1);
  derivatives(
    ex,
    y.map((value, j) => value + (h / 2) * k1[j]),
    u,
    openCircuit,
    k2,
  );
  derivatives(
    ex,
    y.map((value, j) => value + (h / 2) * k2[j]),
    u,
    openCircuit,
    k3,
  );
  derivatives(
    ex,
    y.map((value, j) => value + h * k3[j]),
    u,
    openCircuit,
    k4,
  );
  let nxt = y.map((value, j) => value + (h / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
  if (x < 0 !== nxt[0] < 0) sim.crossedAt = now + h;
  // A turn-around on a ramp: the speed changes sign away from the flat.
  if (v * nxt[1] < 0 && Math.abs(nxt[0]) > t.flat_length_m / 2) sim.peaks.push(height(ex, nxt[0]));
  const end = endOf(t);
  if (Math.abs(nxt[0]) >= end) {
    // The end stop: the car stops dead at the top and rolls back.
    const top = copysign(end, nxt[0]);
    sim.stops += mechanical(ex, nxt[0], nxt[1]) - mechanical(ex, top, 0.0);
    nxt = [top, 0.0, nxt[2], nxt[3], nxt[4], nxt[5]];
    sim.tops += 1;
    sim.peaks.push(topHeight(t));
  }
  sim.y = nxt;
  sim.n += 1;
}

/** What a page calls per step: the button as the reader holds it. */
export function frame(ex: CoilExhibit, sim: CoilSim, press: Press, h = STEP_S): void {
  advance(ex, sim, press, release(ex, sim, press), h);
}

/** The battery's energy and where it went, at this step. */
export function account(ex: CoilExhibit, sim: CoilSim): EnergyAccount {
  const [x, v, i] = sim.y;
  const mech = mechanical(ex, x, v) - sim.mech0;
  const field = 0.5 * inductance(ex.coil) * i * i;
  const y = sim.y;
  return {
    battery_j: y[3],
    heat_j: y[4],
    rolling_j: y[5],
    switching_j: sim.switching,
    end_stops_j: sim.stops,
    mechanical_change_j: mech,
    field_change_j: field,
    unaccounted_j: y[3] - (y[4] + y[5] + sim.switching + sim.stops) - mech - field,
  };
}

/** The car under a visitor, from `startX` (default: halfway up the left ramp). */
export function run(
  ex: CoilExhibit,
  visitor: Visitor,
  durationS = 10.0,
  startX: number | null = null,
  startSpeed = 0.0,
  stepS = STEP_S,
): CoilRun {
  if (!(durationS > 0 && durationS <= MAX_DURATION_S)) {
    throw new RangeError(`a run lasts between 0 and ${MAX_DURATION_S} s`);
  }
  if (!(stepS > 0 && stepS <= 1e-3)) throw new RangeError("the step lies between 0 and 1 ms");
  const sim = start(ex, startX, startSpeed);
  const steps = roundHalfEven(durationS / stepS);
  const every = Math.max(1, roundHalfEven(1 / (SAMPLES_PER_S * stepS)));
  const out: CoilRun = {
    t: [],
    x_m: [],
    speed_m_s: [],
    current_a: [],
    induced_v: [],
    press: [],
    height_m: [],
    peaks_m: [],
    tops: 0,
    energy: account(ex, sim),
  };
  for (let n = 0; n <= steps; n++) {
    const now = n * stepS;
    const press = pressOf(visitor, now, sim.y[0], sim.y[1], sim.crossedAt);
    const openCircuit = release(ex, sim, press);
    if (n % every === 0) {
      const [x, v, i] = sim.y;
      out.t.push(now);
      out.x_m.push(x);
      out.speed_m_s.push(v);
      out.current_a.push(i);
      out.induced_v.push(coupling(ex, x) * v);
      out.press.push(press);
      out.height_m.push(height(ex, x));
    }
    if (n === steps) break;
    advance(ex, sim, press, openCircuit, stepS);
  }
  out.peaks_m = sim.peaks;
  out.tops = sim.tops;
  out.energy = account(ex, sim);
  return out;
}

/**
 * The energy one pass through the coil gains, at `speedMS`, against how late
 * the hand reaches the minus button — on the flat, without rolling resistance,
 * so the number is the coil's alone (the engine's `timing_curve`).
 */
export function timingCurve(ex: CoilExhibit, speedMS: number, latesS: number[], windowM = 0.06): TimingPoint[] {
  if (speedMS <= 0) throw new RangeError("the car has to be moving");
  const flat: CoilExhibit = { ...ex, track: { ...ex.track, rolling_resistance: 0.0 } };
  const startX = -(windowM + 0.01);
  const distance = 2 * (windowM + 0.01);
  const duration = Math.min(MAX_DURATION_S, (2.5 * distance) / speedMS);
  const kinetic = 0.5 * flat.track.car_mass_kg * speedMS ** 2;
  return latesS.map((late) => {
    const result = run(
      flat,
      { kind: "rule", window_m: windowM, late_s: late, reversed: false },
      duration,
      startX,
      speedMS,
    );
    let end = result.x_m.findIndex((x, j) => x > windowM + 0.01 || result.speed_m_s[j] <= 0);
    if (end < 0) end = result.x_m.length - 1;
    return { late_s: late, gain_j: 0.5 * flat.track.car_mass_kg * result.speed_m_s[end] ** 2 - kinetic };
  });
}
