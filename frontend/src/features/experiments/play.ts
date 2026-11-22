/**
 * What every exhibit's twin shares in how it plays, apart from the preview's
 * mode (`preview-mode.tsx`) and the buttons (`play-controls.tsx`): whether it
 * starts moving, who holds its clock, and the frame loop that moves it.
 */

import { useEffect, useLayoutEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { prefersReducedMotion } from "@eifi1/ui-kit";

/**
 * Whether a twin starts moving by itself as its page opens: not for a reader
 * who asked for reduced motion, who starts it with its Run button
 * (`docs/experiments.md`: "every animation pauses, and starts paused for a
 * reader who asked for reduced motion"). Read once, as the twin mounts: it is
 * a `useState` initialiser. Where the browser cannot say, the twin moves, as
 * the exhibit does; its Pause button is there.
 *
 * Paused, a twin's main action starts it (`setRunning(true)` in the action):
 * a push, a press, a let-go, a tone, a new rate, an auto mode switched on.
 * The reader is asking to see it move, and a twin that took the press and
 * showed nothing until the Run button in the header looked broken. Actions
 * that only reset leave the clock as it is.
 */
export function startsRunning(): boolean {
  return !prefersReducedMotion(false);
}

/**
 * Who holds a twin's clock: on the page its Run/Pause button (`setRunning`),
 * in a preview the overview (`paused`), which the button never sees, since a
 * preview has none. `initially` is the page's start: `startsRunning` for a
 * twin that moves as the page opens, false for one that waits for its first
 * action (a let-go, a drop, a throw). A preview always starts in its auto
 * mode, so `initially` is never read there.
 */
export function useRunning({
  preview = false,
  paused = false,
  initially = startsRunning,
}: {
  preview?: boolean;
  paused?: boolean;
  initially?: boolean | (() => boolean);
}): { running: boolean; setRunning: Dispatch<SetStateAction<boolean>> } {
  const [runningHere, setRunning] = useState(initially);
  return { running: preview ? !paused : runningHere, setRunning };
}

/** The longest step one frame may take, in seconds: a tab that was hidden
 *  for a minute, or a frame the browser dropped, must not throw a twin a
 *  minute forward, or its integrator off its step, in one go. */
const MAX_FRAME_S = 0.05;

/**
 * A twin's frame loop: `onFrame(dt, now)` once a frame while `running`, with
 * `dt` the seconds since the last frame in [0, `MAX_FRAME_S`] and `now` the
 * frame's timestamp in milliseconds (`requestAnimationFrame`'s, on
 * `performance.now()`'s clock), for a twin that keeps times of its own.
 *
 * The latest `onFrame` is the one called, kept in a ref after each commit, so
 * a new closure (a new speed, a new build) does not restart the loop; it
 * restarts only when `running` turns on again. The thirty-odd hand-written
 * copies this replaces had drifted: some had lost the zero guard below and
 * could step a twin's time backwards.
 */
export function useFrameLoop(running: boolean, onFrame: (dt: number, now: number) => void): void {
  const latest = useRef(onFrame);
  useLayoutEffect(() => {
    latest.current = onFrame;
  });
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      // A frame's timestamp can lie a little before the effect started (it is
      // the frame's start, not the callback's): never a step back in time.
      const dt = Math.max(0, Math.min(MAX_FRAME_S, (now - last) / 1000));
      last = now;
      latest.current(dt, now);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running]);
}
