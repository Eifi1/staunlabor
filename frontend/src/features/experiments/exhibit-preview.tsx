/**
 * An exhibit's twin, playing by itself, where the exhibit is advertised: the
 * overview's experiment of the day and its history.
 *
 * Each preview is its page's `<X>Preview` (`preview-mode.tsx`), imported
 * lazily from the page's own module, so it is the chunk the reader's click
 * would load anyway, fetched a little early, and the overview, which is in
 * the first wave, carries none of the simulations.
 *
 * It moves only when moving is wanted:
 *
 * - **not before it has been on screen**: a preview below the fold mounts once
 *   it scrolls near, so the history's seven cards do not load seven pages and
 *   ask the server for four computations before anybody looks at them;
 * - **not while it is off screen**: the frame loop stops (the page's own
 *   Pause), and starts again where it was;
 * - **never under reduced motion** (`prefers-reduced-motion`): the first frame,
 *   as a still. Where the preference cannot be read, a still too: a moving
 *   picture nobody asked for is the worse mistake;
 * - **`still`** asks for the still regardless: a history card that is not being
 *   pointed at or focused.
 */

import { Suspense, lazy, useEffect, useState, type ComponentType, type LazyExoticComponent } from "react";
import { prefersReducedMotion } from "@eifi1/ui-kit";
import type { Exhibit } from "./exhibits";
import { PreviewPending, type PreviewProps } from "./preview-mode";

const PREVIEWS: Record<Exhibit, LazyExoticComponent<ComponentType<PreviewProps>>> = {
  chair: lazy(() => import("./chair-page").then((m) => ({ default: m.ChairPreview }))),
  coil: lazy(() => import("./coil-page").then((m) => ({ default: m.CoilPreview }))),
  sphere: lazy(() => import("./sphere-page").then((m) => ({ default: m.SpherePreview }))),
  platform: lazy(() => import("./platform-page").then((m) => ({ default: m.PlatformPreview }))),
  race: lazy(() => import("./race-page").then((m) => ({ default: m.RacePreview }))),
  elephant: lazy(() => import("./elephant-page").then((m) => ({ default: m.ElephantPreview }))),
  smoke: lazy(() => import("./smoke-page").then((m) => ({ default: m.SmokePreview }))),
  cannon: lazy(() => import("./cannon-page").then((m) => ({ default: m.CannonPreview }))),
};

/** Whether the element is on screen (`margin` beyond it counts), and whether
 *  it ever has been. Without an IntersectionObserver both are true: the
 *  preview then behaves as if it were in view, which is what it did before
 *  there were observers. */
function useOnScreen(margin: string): { ref: (el: HTMLElement | null) => void; seen: boolean; visible: boolean } {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const observable = typeof IntersectionObserver === "function";
  const [visible, setVisible] = useState(!observable);
  const [seen, setSeen] = useState(!observable);
  useEffect(() => {
    if (!el || !observable) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting);
        if (entry.isIntersecting) setSeen(true);
      },
      { rootMargin: margin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [el, margin, observable]);
  return { ref: setEl, seen, visible };
}

export function ExhibitPreview({ exhibit, still = false }: { exhibit: Exhibit; still?: boolean }) {
  const { ref, seen, visible } = useOnScreen("200px");
  const [reduced] = useState(() => prefersReducedMotion(true));
  const Preview = PREVIEWS[exhibit];
  return (
    <div ref={ref} className="pointer-events-none select-none">
      {seen ? (
        <Suspense fallback={<PreviewPending />}>
          <Preview paused={still || reduced || !visible} />
        </Suspense>
      ) : (
        <PreviewPending />
      )}
    </div>
  );
}
