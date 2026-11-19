/**
 * What every exhibit's twin shares in how it plays, apart from the preview's
 * mode (`preview-mode.tsx`).
 */

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
