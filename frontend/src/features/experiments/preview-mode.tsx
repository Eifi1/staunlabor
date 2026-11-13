/**
 * An exhibit's twin played as a preview: its own auto mode, with none of its
 * controls, for the overview's experiment of the day and its history
 * (`exhibit-preview.tsx` places it).
 *
 * The preview is the page's own play component in a mode, not a drawing made
 * for the overview: the motion in it is the motion on the page, computed by
 * the same browser port, so it cannot drift from the exhibit it advertises,
 * and a fix to one is a fix to both. What the mode changes is only what is
 * shown and who drives: the auto mode from the start, no buttons, no sliders,
 * no figures, and the clock run by `paused` rather than by a Pause button.
 */

import { FlaskConical } from "lucide-react";

/** What a page's `<X>Preview` takes. */
export interface PreviewProps {
  /** Held still: off screen, under reduced motion, or a history card that is
   *  not being looked at. The first frame is then the still. */
  paused: boolean;
}

/** What a page's play component takes besides its own props, for the
 *  preview. */
export interface PreviewMode {
  preview?: boolean;
  paused?: boolean;
}

/** The space a preview takes while its build is on its way. */
export function PreviewPending() {
  return (
    <div
      aria-busy="true"
      className="flex aspect-[4/3] w-full items-center justify-center rounded-lg border border-subtle bg-surface-2"
    >
      <FlaskConical className="size-8 text-muted" aria-hidden />
    </div>
  );
}
