/**
 * The complex plane with a system's poles on it — and, for a second-order pair,
 * the poles to drag.
 *
 * A drawing rather than a chart: what it shows is positions, not a quantity over
 * an abscissa, and dragging a point is not something the kit's charts do. Inline
 * SVG in the site's tokens, like the exhibits' drawings. The left
 * half-plane is tinted as stable and the right as unstable; the dashed half
 * circle is |λ| = ω₀, on which an under-damped pair moves as only its damping
 * changes.
 *
 * The scale follows the poles until a drag starts and is held while it lasts —
 * a plane that rescaled under the pointer would move the pole away from it.
 * Dragging reports the pole's position; the engine turns it into ω₀ and D
 * (`eigen.pole_from`). The sliders beside it stay the keyboard's way in.
 */

import { useRef, useState, type PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber } from "@/shared/lib/format";
import { useChartHex } from "@/shared/state/palette-store";
import type { Complex } from "@/shared/types";
import { HUE } from "./colours";

const W = 360;
const H = 300;
const PAD = 28;

/** A round span (1, 2 or 5 times a power of ten) at least as wide as `need`. */
function niceSpan(need: number): number {
  const p = 10 ** Math.floor(Math.log10(need));
  for (const m of [1, 2, 5, 10]) if (m * p >= need) return m * p;
  return 10 * p;
}

export function PolePlane({
  poles,
  omega0,
  onDrag,
  label,
}: {
  poles: Complex[];
  /** The radius of the dashed half circle, rad/s — a second-order pair's ω₀. */
  omega0?: number;
  /** Given, the upper pole can be dragged; reports its new position, rad/s. */
  onDrag?: (re: number, im: number) => void;
  label: string;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  const svg = useRef<SVGSVGElement>(null);
  const [held, setHeld] = useState<number | null>(null);
  const reach = Math.max(1, ...poles.map((p) => Math.max(Math.abs(p.re), Math.abs(p.im))), omega0 ?? 0);
  const span = held ?? niceSpan(1.25 * reach);
  // x from −span to +span/3 (the stable side is where the interest is), y ±span.
  const xmin = -span;
  const xmax = span / 3;
  const sx = (re: number) => PAD + ((re - xmin) / (xmax - xmin)) * (W - 2 * PAD);
  const sy = (im: number) => H / 2 - (im / span) * (H / 2 - PAD);
  const fromScreen = (px: number, py: number) => ({
    re: xmin + ((px - PAD) / (W - 2 * PAD)) * (xmax - xmin),
    im: ((H / 2 - py) / (H / 2 - PAD)) * span,
  });

  const move = (event: PointerEvent<SVGSVGElement>) => {
    if (held === null || !onDrag || !svg.current) return;
    const box = svg.current.getBoundingClientRect();
    const p = fromScreen(((event.clientX - box.left) / box.width) * W, ((event.clientY - box.top) / box.height) * H);
    onDrag(p.re, Math.max(p.im, span * 0.01));
  };
  const upper = poles.reduce<Complex | null>((best, p) => (best === null || p.im > best.im ? p : best), null);
  const draggable = onDrag && upper && upper.im > 0;

  return (
    <svg
      ref={svg}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={label}
      className="w-full max-w-md touch-none select-none"
      onPointerMove={move}
      onPointerUp={() => setHeld(null)}
      onPointerLeave={() => setHeld(null)}
    >
      <rect x={PAD} y={PAD} width={sx(0) - PAD} height={H - 2 * PAD} className="fill-surface" />
      <rect x={sx(0)} y={PAD} width={W - PAD - sx(0)} height={H - 2 * PAD} fill={hex[HUE.pole]} opacity={0.12} />
      <text x={PAD + 4} y={PAD + 12} className="fill-muted" fontSize={10}>
        {t("course.poles.stable")}
      </text>
      <text x={W - PAD - 4} y={PAD + 12} textAnchor="end" className="fill-muted" fontSize={10}>
        {t("course.poles.unstable")}
      </text>
      {/* axes */}
      <line x1={PAD} y1={H / 2} x2={W - PAD} y2={H / 2} className="stroke-strong" strokeWidth={1} />
      <line x1={sx(0)} y1={PAD} x2={sx(0)} y2={H - PAD} className="stroke-strong" strokeWidth={1} />
      <text x={W - PAD} y={H / 2 - 4} textAnchor="end" className="fill-muted" fontSize={10}>
        Re
      </text>
      <text x={sx(0) + 4} y={PAD - 6} className="fill-muted" fontSize={10}>
        Im
      </text>
      {[-span, -span / 2, span / 2, span].map((v) => (
        <text key={`i${v}`} x={sx(0) - 4} y={sy(v) + 3} textAnchor="end" className="fill-muted" fontSize={9}>
          {formatNumber(v, 0, locale)}
        </text>
      ))}
      {[-span, -span / 2].map((v) => (
        <text key={`r${v}`} x={sx(v)} y={H / 2 + 12} textAnchor="middle" className="fill-muted" fontSize={9}>
          {formatNumber(v, 0, locale)}
        </text>
      ))}
      <text x={W / 2} y={H - 6} textAnchor="middle" className="fill-muted" fontSize={10}>
        rad/s
      </text>
      {omega0 !== undefined && omega0 > 0 && (
        <path
          d={`M ${sx(0)} ${sy(omega0)} A ${sx(0) - sx(-omega0)} ${sy(0) - sy(omega0)} 0 0 0 ${sx(0)} ${sy(-omega0)}`}
          fill="none"
          stroke={hex[HUE.envelope]}
          strokeDasharray="4 3"
          strokeWidth={1.5}
        />
      )}
      {poles.map((p, i) => {
        const x = Math.min(Math.max(sx(p.re), PAD), W - PAD);
        const y = Math.min(Math.max(sy(p.im), PAD), H - PAD);
        const grab = draggable && p === upper;
        return (
          <g
            key={i}
            className={grab ? "cursor-grab" : undefined}
            onPointerDown={(event) => {
              if (!grab) return;
              (event.target as Element).setPointerCapture?.(event.pointerId);
              setHeld(span);
            }}
          >
            {grab && <circle cx={x} cy={y} r={14} fill="transparent" />}
            <path
              d={`M ${x - 6} ${y - 6} L ${x + 6} ${y + 6} M ${x - 6} ${y + 6} L ${x + 6} ${y - 6}`}
              stroke={hex[HUE.pole]}
              strokeWidth={2.5}
            />
          </g>
        );
      })}
    </svg>
  );
}
