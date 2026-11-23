/**
 * The numbers several exhibits share and none of them owns, as the engine's
 * `constants.py` holds them: standard gravity, the moments of inertia of a
 * solid ball and a thin shell, the speed below which rolling resistance fades
 * in. Each port wrote gravity out for itself; here it is once.
 *
 * Anything an exhibit tunes (its step, its sampling) stays in its own port,
 * and the stepping is `numerics.ts`.
 */

/** Standard gravity, m/s². */
export const G = 9.80665;

/** `I = k·m·r²`: a solid ball's `k`, and a thin shell's. */
export const SOLID_BALL_INERTIA = 2 / 5;
export const HOLLOW_BALL_INERTIA = 2 / 3;

/** Below this speed, m/s, rolling resistance fades in rather than flipping
 *  sign with the speed. */
export const RESISTANCE_FADE_M_S = 1e-3;
