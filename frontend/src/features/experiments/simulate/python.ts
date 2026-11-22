/**
 * Python's built-ins as the ports need them, to the last bit: the engine's
 * numbers come out of CPython, and a port that rounds a half the other way or
 * converts an angle by another constant lands a step or a bit off.
 *
 * One module, where each port kept its own copy (two `roundHalfEven`s, a dozen
 * pairs of `TO_RAD`/`TO_DEG`), and the pendulum, the shared base, imported its
 * rounding from the sphere's module. Nothing here is physics.
 */

/** Python's `round`: half to even, as the engine takes its step counts. */
export function roundHalfEven(x: number): number {
  const down = Math.floor(x);
  const rest = x - down;
  if (rest > 0.5) return down + 1;
  if (rest < 0.5) return down;
  return down % 2 === 0 ? down : down + 1;
}

/** `math.radians` and `math.degrees`: one multiplication each, by CPython's
 *  constants (`π/180`, `180/π`), so the last bit is the engine's. */
export const TO_RAD = Math.PI / 180.0;
export const TO_DEG = 180.0 / Math.PI;
export const radians = (deg: number) => deg * TO_RAD;
export const degrees = (rad: number) => rad * TO_DEG;

/** `math.fmod`: the remainder with the sign of the dividend, as JS's `%`. */
export const fmod = (a: number, b: number) => a % b;

/** Python's `%` on floats: the remainder with the sign of the divisor. */
export const pyMod = (a: number, b: number) => ((a % b) + b) % b;

/** `math.copysign`: the size of `magnitude` with the sign of `sign`, a
 *  negative zero's included. */
export const copysign = (magnitude: number, sign: number) =>
  sign < 0 || Object.is(sign, -0) ? -Math.abs(magnitude) : Math.abs(magnitude);
