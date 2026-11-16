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
 */

import { useLayoutEffect, useState } from "react";
import { ExhibitPreview } from "./exhibit-preview";
import type { Exhibit } from "./exhibits";

export function FittedPreview({
  exhibit,
  still = false,
  height,
  box = "",
  frame = "",
}: {
  exhibit: Exhibit;
  still?: boolean;
  /** The box's height, in pixels. */
  height: number;
  /** Classes for the box, which is `height` tall and as wide as it is given. */
  box?: string;
  /** Classes for the frame round the preview itself, which is what scales. */
  frame?: string;
}) {
  const [scale, setScale] = useState(1);
  const [inner, setInner] = useState<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    if (!inner || typeof ResizeObserver !== "function") return;
    const fit = () => setScale(inner.offsetHeight > height ? height / inner.offsetHeight : 1);
    const observer = new ResizeObserver(fit);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [inner, height]);
  return (
    <div className={`flex items-center justify-center overflow-hidden ${box}`} style={{ height }}>
      <div
        ref={setInner}
        data-still={exhibit}
        className={`w-full shrink-0 ${frame}`}
        style={scale < 1 ? { transform: `scale(${scale})` } : undefined}
      >
        <ExhibitPreview exhibit={exhibit} still={still} />
      </div>
    </div>
  );
}
