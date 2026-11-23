/**
 * The drum's skin and the press that moves it, for the smoke ring's page.
 *
 * A press is sampled a frame at a time — its times and depths are what the
 * engine's port makes a ring of (`ringOf`, `simulate/smoke.ts`) — and is made
 * one of two ways: by the button, which pushes the skin in along the port's
 * `pressDepth` over the duration the reader set and lets go when it is done,
 * or by a hand dragging the skin, which lets go when the finger does. Once let
 * go the skin springs back. The auto mode presses on its own, too fast, just
 * right and too slow in turn, with a pause between.
 *
 * Pure and stepped by the page's frame loop, as `sphere-hand.ts` is for the
 * sphere: the page keeps the drum in a ref and draws what it holds. What it is
 * not: the ring's flight or its smoke, which are the page's drawing.
 */

import type { SmokeExhibitRequest } from "@/shared/types";
import { pressDepth, ringOf, type Ring } from "./simulate/smoke";

/** A drag of this many metres in the drawing presses the skin its full stroke. */
const DRAG_FOR_FULL_M = 0.45;

/** The skin springs back over this long once let go, seconds. */
export const RETURN_S = 0.35;

/** Between the auto mode's presses, seconds. */
export const AUTO_GAP_S = 4;

/** The press being made: the samples so far, whether a hand or the button
 *  makes it, and the drum it began on — a slider moved mid-press changes the
 *  next press, not this one (a stroke lowered under its depth stopped the
 *  animation). */
interface Press {
  times: number[];
  depths: number[];
  source: "drag" | "button";
  duration: number;
  depth: number;
  exhibit: SmokeExhibitRequest;
}

export interface Drum {
  press: Press | null;
  /** When the press began, seconds on the frames' clock. */
  start: number;
  /** How far the skin is pressed in, metres. */
  depth: number;
  /** Where the skin was when let go, and how long ago. */
  released: { from: number; age: number } | null;
  /** The auto mode: which of its three presses is next, and when. */
  autoNext: number;
  autoAt: number;
}

export function restingDrum(): Drum {
  return { press: null, start: 0, depth: 0, released: null, autoNext: 0, autoAt: 0 };
}

/** Start a press at `now` (seconds): the button's, of `duration` to `depth`,
 *  or a hand's (whose depth the drag sets as it goes). */
export function startPress(
  drum: Drum,
  source: Press["source"],
  now: number,
  duration: number,
  depth: number,
  exhibit: SmokeExhibitRequest,
) {
  drum.press = { times: [now], depths: [drum.depth], source, duration, depth, exhibit };
  drum.start = now;
  drum.released = null;
}

/** How deep a drag from `y0` to `y` (metres, up positive) presses the skin:
 *  down presses, within the stroke. */
export function dragDepth(y0: number, y: number, stroke: number): number {
  return Math.min(stroke, Math.max(0, ((y0 - y) / DRAG_FOR_FULL_M) * stroke));
}

/** A ring a press made, and the drum it was pressed on, which its flight is
 *  computed for. */
export interface Made {
  ring: Ring;
  exhibit: SmokeExhibitRequest;
}

/** Let go: the skin starts back, and the press's ring is made — `null` for a
 *  press too short to have a pace (fewer than two samples) or none at all. */
export function release(drum: Drum): Made | null {
  const press = drum.press;
  drum.press = null;
  drum.released = { from: drum.depth, age: 0 };
  if (!press || press.times.length < 2) return null;
  const times = press.times.map((x) => x - press.times[0]);
  return { ring: ringOf(press.exhibit, times, press.depths), exhibit: press.exhibit };
}

/** One sample of a press, if its time has moved on: a frame can fall on the
 *  instant the press began, and two samples at one time are no pace at all
 *  (the engine refuses them). */
function record(press: Press, now: number, depth: number) {
  if (now > press.times[press.times.length - 1]) {
    press.times.push(now);
    press.depths.push(depth);
  }
}

/**
 * One frame at `now` (seconds), `dt` after the last: the auto mode's next
 * press when it is due, the button's press pushed on (and let go at its end),
 * a hand's press sampled, or the skin springing back. Answers what a press let
 * go of in this frame made, else `null`.
 */
export function stepDrum(
  drum: Drum,
  now: number,
  dt: number,
  auto: { on: boolean; presses: readonly [number, number, number]; exhibit: SmokeExhibitRequest },
): Made | null {
  if (auto.on && !drum.press && now >= drum.autoAt) {
    const duration = auto.presses[drum.autoNext % 3];
    startPress(drum, "button", now, duration, auto.exhibit.drum.stroke_m, auto.exhibit);
    drum.autoNext += 1;
    drum.autoAt = now + duration + AUTO_GAP_S;
  }
  const press = drum.press;
  if (press?.source === "button") {
    const into = now - drum.start;
    drum.depth = pressDepth(press.depth, press.duration, into);
    record(press, now, drum.depth);
    if (into >= press.duration) return release(drum);
  } else if (press?.source === "drag") {
    record(press, now, drum.depth);
  } else if (drum.released) {
    drum.released.age += dt;
    drum.depth = drum.released.from * Math.max(0, 1 - drum.released.age / RETURN_S);
  }
  return null;
}
