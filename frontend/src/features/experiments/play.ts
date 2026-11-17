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
 */
export function startsRunning(): boolean {
  return !prefersReducedMotion(false);
}
