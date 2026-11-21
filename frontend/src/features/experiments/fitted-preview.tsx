/**
 * An exhibit's preview (`ExhibitPreview`) no taller than `height`: laid out at
 * the width it is given, as everywhere, and scaled down, centred, where its
 * drawing would be taller — the elephant, the diver and the rods are drawn
 * upright. For a row of previews of one height: the overview's list and the
 * link-preview cards (`preview-card.tsx`).
 *
 * A transform rather than a narrower box, so the preview lays itself out as it
 * was drawn and only the picture shrinks. Without a ResizeObserver it is never
 * scaled, and a tall drawing is cut at the box's edges, not stretched.
 *
 * `plain` is for a box that is itself the picture's frame, one size for every
 * exhibit (Marcel, 2026-11-20: "eine feste Grösse für die Vorschaubilder"):
 * it takes the drawing's own frames and grounds off, so a wide track is not a
 * small framed strip inside the box's frame. A drawing's colours are fills,
 * which it leaves alone.
 */

import { useLayoutEffect, useState } from "react";
import { ExhibitPreview } from "./exhibit-preview";
import type { Exhibit } from "./exhibits";

/** The drawing's own frames and grounds, the svg's and its wrappers' (the
 *  harmonograph's paper, the chair's three peepholes), taken off. */
const PLAIN = "[&_*]:rounded-none [&_*]:border-0 [&_*]:bg-transparent";

export function FittedPreview({
  exhibit,
  still = false,
  height,
  box = "",
  frame = "",
  shrink = false,
  plain = false,
}: {
  exhibit: Exhibit;
  still?: boolean;
  /** The box's height, in pixels. */
  height: number;
  /** Classes for the box, which is `height` tall and as wide as it is given. */
  box?: string;
  /** Classes for the frame round the preview itself, which is what scales. */
  frame?: string;
  /** `height` is the most, and a wide drawing's box only as tall as the
   *  drawing: for one preview alone (the front page's), where a band of
   *  empty box above and below it would push the text off the screen. */
  shrink?: boolean;
  /** The box is the frame: the drawing's own frames and grounds go. */
  plain?: boolean;
}) {
  const [scale, setScale] = useState(1);
  const [natural, setNatural] = useState<number | null>(null);
  const [inner, setInner] = useState<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    if (!inner || typeof ResizeObserver !== "function") return;
    const fit = () => {
      setScale(inner.offsetHeight > height ? height / inner.offsetHeight : 1);
      setNatural(inner.offsetHeight);
    };
    const observer = new ResizeObserver(fit);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [inner, height]);
  return (
    <div
      className={`flex items-center justify-center overflow-hidden ${box}`}
      style={{ height: shrink && natural !== null ? Math.min(height, natural) : height }}
    >
      <div
        ref={setInner}
        data-still={exhibit}
        className={`w-full shrink-0 ${plain ? PLAIN : ""} ${frame}`}
        style={scale < 1 ? { transform: `scale(${scale})` } : undefined}
      >
        <ExhibitPreview exhibit={exhibit} still={still} />
      </div>
    </div>
  );
}
