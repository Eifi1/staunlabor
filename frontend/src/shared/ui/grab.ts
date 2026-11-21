/**
 * A handle in a drawing that a finger can take on a phone, while a swipe
 * anywhere else on the drawing still scrolls the page.
 *
 * `touch-action: none` on the whole drawing would catch every swipe that
 * starts on it, and on a phone a drawing is most of the screen. On the handle
 * alone it does nothing: Chrome ignores `touch-action` on an SVG element
 * inside the drawing (tested 2026-11-20: the page scrolled under the finger).
 * So the handle stops its own touches from scrolling, in a `touchstart`
 * listener that must not be passive, which React's own are. Pointer events
 * still arrive, and do the dragging.
 *
 * Use it as the handle's `ref`; React 19 runs the returned cleanup.
 */

const stay = (event: Event) => event.preventDefault();

export function holdTouch(handle: Element | null): (() => void) | undefined {
  if (!handle) return undefined;
  handle.addEventListener("touchstart", stay, { passive: false });
  return () => handle.removeEventListener("touchstart", stay);
}
