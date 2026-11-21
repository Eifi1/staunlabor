import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router";

/** Where each entry of the tab's history was scrolled to, by the router's key. */
const positions = new Map<string, number>();

/** How long a way back tries to reach its place, in frames: a lazy page and
 *  its drawings take a moment to be as tall as they were. */
const TRIES = 60;

/**
 * The browser's own scroll memory, done for a single-page site (Marcel,
 * 2026-11-20: back with the mouse's side button lands where one clicked).
 * The browser restores a position before the page it belongs to is drawn
 * again, so on a shorter page it lands too high; here a way back (`POP`)
 * goes to where the page was left once the page is there, trying for up to a
 * second while it grows, and every new page starts at its top, which the
 * router alone did not do. A page that opens at an anchor (`#…`) is left to
 * it.
 *
 * The position is kept under the entry shown while the reader scrolls, and
 * the entry changes before the new page can move the window: the jump to a
 * shorter page cannot overwrite where the last one was left.
 */
export function useScrollMemory() {
  const location = useLocation();
  const kind = useNavigationType();
  const shown = useRef(location.key);
  useEffect(() => {
    if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
    const keep = () => positions.set(shown.current, window.scrollY);
    window.addEventListener("scroll", keep, { passive: true });
    return () => window.removeEventListener("scroll", keep);
  }, []);
  useLayoutEffect(() => {
    shown.current = location.key;
    if (location.hash) return;
    if (kind !== "POP") {
      window.scrollTo(0, 0);
      return;
    }
    const target = positions.get(location.key) ?? 0;
    let frame = 0;
    let tries = 0;
    const reach = () => {
      window.scrollTo(0, target);
      if (Math.abs(window.scrollY - target) > 1 && tries++ < TRIES) frame = requestAnimationFrame(reach);
    };
    reach();
    return () => cancelAnimationFrame(frame);
  }, [location.key, location.hash, kind]);
}
