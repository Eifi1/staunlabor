/**
 * A pointer in a drawing's own units: where a finger or the mouse is, in the
 * SVG's user space (its view box, y down), for a drawing the reader drags in.
 *
 * Every browser gives the screen-to-drawing matrix (`getScreenCTM`), and that
 * is the answer wherever the drawing's aspect differs from its box. Where there
 * is none (jsdom, so the tests), the view box is laid over the drawing's
 * bounding box, which is right for a drawing that keeps its aspect across its
 * box, as these do. Nine drawings wrote this out by hand, each with its view
 * box spelt a second time in the fallback, and one had no fallback at all, so
 * its drag did nothing under test.
 *
 * It returns the point as the SVG has it; a drawing whose y points up flips it
 * itself. Null where neither way can say: no matrix and a box of no size.
 */
export function svgPoint(svg: SVGSVGElement, clientX: number, clientY: number): [number, number] | null {
  const matrix = svg.getScreenCTM?.();
  if (matrix) {
    const p = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    return [p.x, p.y];
  }
  const view = viewBoxOf(svg);
  const box = svg.getBoundingClientRect();
  if (!view || !box.width || !box.height) return null;
  return [
    view.x + ((clientX - box.left) / box.width) * view.width,
    view.y + ((clientY - box.top) / box.height) * view.height,
  ];
}

/** The view box, from the DOM where it has one, else from the attribute
 *  (jsdom does not parse it). */
function viewBoxOf(svg: SVGSVGElement): { x: number; y: number; width: number; height: number } | null {
  const parsed = svg.viewBox?.baseVal;
  if (parsed && parsed.width && parsed.height) return parsed;
  const numbers = (svg.getAttribute("viewBox") ?? "")
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (numbers.length !== 4 || numbers.some((n) => !Number.isFinite(n))) return null;
  const [x, y, width, height] = numbers;
  return width && height ? { x, y, width, height } : null;
}
