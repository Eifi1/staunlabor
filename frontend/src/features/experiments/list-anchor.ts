import { EXHIBITS_ANCHOR } from "./exhibits";

/**
 * Down to the front page's list of every exhibit, visibly: a smooth scroll
 * rather than a jump, which read as a new page loading (Marcel, 2026-11-20:
 * "Es soll visuell scrollen und nicht den Bereich wie eine neue Page laden"),
 * except for a reader whose system asks for less motion. The list's heading
 * takes the focus, so the keyboard and a screen reader go on from there, and
 * the address says where the page is without a navigation of the router's.
 *
 * Returns false when the list is not on this page, so a link elsewhere can
 * go to `/#all-exhibits` instead.
 */
export function scrollToList(behavior: ScrollBehavior = "smooth"): boolean {
  const heading = document.getElementById(EXHIBITS_ANCHOR);
  if (!heading) return false;
  const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  heading.scrollIntoView?.({ behavior: still ? "auto" : behavior, block: "start" });
  heading.focus({ preventScroll: true });
  if (window.location.hash !== `#${EXHIBITS_ANCHOR}`) {
    window.history.replaceState(window.history.state, "", `#${EXHIBITS_ANCHOR}`);
  }
  return true;
}
