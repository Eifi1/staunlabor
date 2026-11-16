/**
 * Beats, in the browser: a line-for-line port of
 * `backend/staunlabor/domain/experiments/beats.py` — the rider's pull on a
 * fork's pitch, the two forks' sound and its loudness — held to it by
 * `simulate.test.ts`.
 *
 * Why here: the forks ring while the reader watches and listens, and the
 * loudness is drawn every frame. There is no route; a change to the physics is
 * made in Python first.
 */

const MODE_ROOT = 1.8751040687119611;
const SIGMA = (Math.cosh(MODE_ROOT) + Math.cos(MODE_ROOT)) / (Math.sinh(MODE_ROOT) + Math.sin(MODE_ROOT));
const HEARD_DOWN_TO = 0.01;

/** The engine's `Fork`. */
export interface Fork {
  frequency_hz: number;
  prong_kg: number;
  decay_s: number;
}

/** The engine's `Rider`. */
export interface Rider {
  mass_kg: number;
  position: number;
}

export function modeShape(xi: number): number {
  const b = MODE_ROOT * xi;
  return 0.5 * (Math.cosh(b) - Math.cos(b) - SIGMA * (Math.sinh(b) - Math.sin(b)));
}

export function frequencyHz(fork: Fork, rider: Rider): number {
  const phi = modeShape(rider.position);
  return fork.frequency_hz / Math.sqrt(1 + (rider.mass_kg * phi * phi) / (fork.prong_kg / 4));
}

export function loudness(f1: number, f2: number, decayS: number, t: number): number {
  return Math.exp(-t / decayS) * Math.abs(Math.cos(Math.PI * (f1 - f2) * t));
}

export function sound(f1: number, f2: number, decayS: number, t: number): number {
  return 0.5 * Math.exp(-t / decayS) * (Math.sin(2 * Math.PI * f1 * t) + Math.sin(2 * Math.PI * f2 * t));
}

/** The engine's `BeatsFigures`. */
export interface BeatsFigures {
  detuned_hz: number;
  beat_hz: number;
  beat_s: number | null;
  cents: number;
  beats_heard: number;
}

export function figures(fork: Fork, rider: Rider): BeatsFigures {
  const detuned = frequencyHz(fork, rider);
  const beat = Math.abs(fork.frequency_hz - detuned);
  return {
    detuned_hz: detuned,
    beat_hz: beat,
    beat_s: beat > 0 ? 1 / beat : null,
    cents: 1200 * Math.log2(fork.frequency_hz / detuned),
    beats_heard: beat * fork.decay_s * Math.log(1 / HEARD_DOWN_TO),
  };
}
