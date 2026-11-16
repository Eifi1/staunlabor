/**
 * The slow LC circuit, in the browser: a line-for-line port of
 * `backend/staunlabor/domain/experiments/circuit.py` — the exact charge and
 * current after the switch is thrown, the energies, the figures — held to it
 * by `simulate.test.ts`.
 *
 * Why here: the needle is drawn every frame from the exact solution, and a
 * slider that changes the coil must change the swing at once. There is no
 * route; a change to the physics is made in Python first.
 */

/** A swing counts while its peak is at least this share of the first's. */
const SWING_FLOOR = 0.1;

export type Regime = "swings" | "critical" | "creeps";

/** The engine's `Circuit`. */
export interface Circuit {
  inductance_h: number;
  capacitance_f: number;
  resistance_ohm: number;
  voltage_v: number;
}

/** `[ω₀, γ]`: `1/√(LC)` and `R/2L`, in 1/s. */
export function rates(circuit: Circuit): [number, number] {
  return [
    1 / Math.sqrt(circuit.inductance_h * circuit.capacitance_f),
    circuit.resistance_ohm / (2 * circuit.inductance_h),
  ];
}

export function regime(circuit: Circuit): Regime {
  const [omega0, gamma] = rates(circuit);
  if (gamma < omega0) return "swings";
  return gamma === omega0 ? "critical" : "creeps";
}

/** `e^{−γt}·c(t)` and `e^{−γt}·s(t)`, as the engine's `_modes`. */
function modes(circuit: Circuit, tS: number): [number, number] {
  const [omega0, gamma] = rates(circuit);
  const damp = Math.exp(-gamma * tS);
  const kind = regime(circuit);
  if (kind === "swings") {
    const omegaD = Math.sqrt(omega0 * omega0 - gamma * gamma);
    return [damp * Math.cos(omegaD * tS), (damp * Math.sin(omegaD * tS)) / omegaD];
  }
  if (kind === "critical") return [damp, damp * tS];
  const beta = Math.sqrt(gamma * gamma - omega0 * omega0);
  const grow = Math.exp((beta - gamma) * tS);
  const fade = Math.exp(-2 * beta * tS);
  return [(grow * (1 + fade)) / 2, (grow * -Math.expm1(-2 * beta * tS)) / (2 * beta)];
}

/** `[q, i]` at `tS` after the switch is thrown: the charge (C) and the current
 *  the capacitor drives through the coil (A), positive at first. Before it
 *  (a negative time, the page's preview between runs) the capacitor sits
 *  charged, where the engine refuses to be asked. */
export function state(circuit: Circuit, tS: number): [number, number] {
  const [omega0, gamma] = rates(circuit);
  const charge = circuit.capacitance_f * circuit.voltage_v;
  const [c, s] = modes(circuit, Math.max(0, tS));
  return [charge * (c + gamma * s), charge * omega0 * omega0 * s];
}

/** `[q²/2C, L·i²/2]`, in J. */
export function energies(circuit: Circuit, tS: number): [number, number] {
  const [q, i] = state(circuit, tS);
  return [(q * q) / (2 * circuit.capacitance_f), (circuit.inductance_h * i * i) / 2];
}

function firstPeakS(circuit: Circuit): number {
  const [omega0, gamma] = rates(circuit);
  const kind = regime(circuit);
  if (kind === "swings") {
    const omegaD = Math.sqrt(omega0 * omega0 - gamma * gamma);
    return Math.atan2(omegaD, gamma) / omegaD;
  }
  if (kind === "critical") return 1 / gamma;
  const beta = Math.sqrt(gamma * gamma - omega0 * omega0);
  return Math.atanh(beta / gamma) / beta;
}

function swings(circuit: Circuit): number {
  const [omega0, gamma] = rates(circuit);
  if (regime(circuit) !== "swings") return 1;
  const omegaD = Math.sqrt(omega0 * omega0 - gamma * gamma);
  return Math.floor((Math.log(1 / SWING_FLOOR) * omegaD) / (gamma * Math.PI)) + 1;
}

/** The engine's `CircuitFigures`. */
export interface CircuitFigures {
  regime: Regime;
  natural_period_s: number;
  period_s: number | null;
  decay_s: number;
  quality: number;
  critical_ohm: number;
  swings: number;
  peak_current_a: number;
  peak_s: number;
  energy_j: number;
}

export function figures(circuit: Circuit): CircuitFigures {
  const [omega0, gamma] = rates(circuit);
  const kind = regime(circuit);
  const peak = firstPeakS(circuit);
  return {
    regime: kind,
    natural_period_s: (2 * Math.PI) / omega0,
    period_s: kind === "swings" ? (2 * Math.PI) / Math.sqrt(omega0 * omega0 - gamma * gamma) : null,
    decay_s: 1 / gamma,
    quality: omega0 / (2 * gamma),
    critical_ohm: 2 * Math.sqrt(circuit.inductance_h / circuit.capacitance_f),
    swings: swings(circuit),
    peak_current_a: state(circuit, peak)[1],
    peak_s: peak,
    energy_j: (circuit.capacitance_f * circuit.voltage_v ** 2) / 2,
  };
}
