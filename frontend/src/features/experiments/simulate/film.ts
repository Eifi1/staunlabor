/**
 * The soap film between two rings, in the browser: a line-for-line port of
 * `backend/staunlabor/domain/experiments/film.py` — the catenoid's boundary
 * problem halved on each side of its peak, the tear and the equal-area
 * distance, the film's waist and area — held to it by `simulate.test.ts`.
 *
 * Why here: the hand drags a ring, and the film must follow it at every
 * frame. There is no route; a change to the physics is made in Python first.
 */

/** How often a bracket is halved. */
const BISECTIONS = 100;

function halve(rises: (t: number) => number, lo: number, hi: number): number {
  for (let i = 0; i < BISECTIONS; i++) {
    const mid = (lo + hi) / 2;
    if (rises(mid) < 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** `h/R` of the catenoid whose ends lie at `z = ±c·t`. */
export const span = (t: number) => (2 * t) / Math.cosh(t);

export const TANGENT_T = halve((t) => t * Math.tanh(t) - 1, 0.5, 2.0);
export const TEAR_RATIO = span(TANGENT_T);
export const EQUAL_T = halve((t) => 2 * t - Math.exp(-2 * t) - 1, 0.0, TANGENT_T);
export const EQUAL_RATIO = span(EQUAL_T);

/** The engine's `Rings`. */
export interface Rings {
  radius_m: number;
  distance_m: number;
}

/** The engine's `Catenoid`. */
export interface Catenoid {
  neck_m: number;
  area_m2: number;
}

export const areaM2 = (neck: number, distance: number) =>
  Math.PI * neck * (distance + neck * Math.sinh(distance / neck));

export const discsM2 = (radius: number) => 2 * Math.PI * radius ** 2;

/** The wide (stable) and the thin (unstable) catenoid, or `null` past the tear. */
export function catenoids(rings: Rings): [Catenoid, Catenoid] | null {
  const ratio = rings.distance_m / rings.radius_m;
  if (ratio > TEAR_RATIO) return null;
  const wide = halve((t) => span(t) - ratio, 0.0, TANGENT_T);
  let hi = 2 * TANGENT_T;
  while (span(hi) > ratio) hi *= 2;
  const thin = halve((t) => ratio - span(t), TANGENT_T, hi);
  const [a, b] = [wide, thin].map((t) => {
    const neck = rings.distance_m / (2 * t);
    return { neck_m: neck, area_m2: areaM2(neck, rings.distance_m) };
  });
  return [a, b];
}

/** The film's radius at `z` from its waist. */
export const radiusAt = (neck: number, z: number) => neck * Math.cosh(z / neck);

export const tears = (rings: Rings) => catenoids(rings) === null;

/** The engine's `FilmFigures`. */
export interface FilmFigures {
  ratio: number;
  neck_m: number | null;
  area_m2: number | null;
  thin_neck_m: number | null;
  thin_area_m2: number | null;
  discs_m2: number;
  least: boolean;
  equal_m: number;
  tear_m: number;
}

export function figures(rings: Rings): FilmFigures {
  const both = catenoids(rings);
  const discs = discsM2(rings.radius_m);
  return {
    ratio: rings.distance_m / rings.radius_m,
    neck_m: both ? both[0].neck_m : null,
    area_m2: both ? both[0].area_m2 : null,
    thin_neck_m: both ? both[1].neck_m : null,
    thin_area_m2: both ? both[1].area_m2 : null,
    discs_m2: discs,
    least: both !== null && both[0].area_m2 < discs,
    equal_m: EQUAL_RATIO * rings.radius_m,
    tear_m: TEAR_RATIO * rings.radius_m,
  };
}
