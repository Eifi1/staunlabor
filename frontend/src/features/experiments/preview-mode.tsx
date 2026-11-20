/**
 * An exhibit's twin played as a preview: its own auto mode, with none of its
 * controls, for the overview's experiment of the week and its list
 * (`exhibit-preview.tsx` places it).
 *
 * The preview is the page's own play component in a mode, not a drawing made
 * for the overview: the motion in it is the motion on the page, computed by
 * the same browser port, so it cannot drift from the exhibit it advertises,
 * and a fix to one is a fix to both. What the mode changes is only what is
 * shown and who drives: the auto mode from the start, no buttons, no sliders,
 * no figures, and the clock run by `paused` rather than by a Pause button.
 */

import { Skeleton } from "@eifi1/ui-kit";

/** What a page's `<X>Preview` takes. */
export interface PreviewProps {
  /** Held still: off screen, under reduced motion, or a list's card that is
   *  not being looked at. The first frame is then the still. */
  paused: boolean;
}

/** What a page's play component takes besides its own props, for the
 *  preview. */
export interface PreviewMode {
  preview?: boolean;
  paused?: boolean;
}

/**
 * The space a preview takes while its build is on its way: the drawing's
 * outline, pulsing. On a cold start the server takes some seconds to wake, and
 * the still grey box with an icon this was read as nothing happening (Marcel,
 * 2026-11-17). The kit's `Skeleton`, so it pulses as every kit placeholder
 * does and holds still under reduced motion; `aria-busy` says the drawing is
 * on its way, and the placeholder itself is hidden.
 */
export function PreviewPending() {
  return (
    <div aria-busy="true" className="aspect-[4/3] w-full">
      <Skeleton shape="block" className="size-full rounded-lg" />
    </div>
  );
}
