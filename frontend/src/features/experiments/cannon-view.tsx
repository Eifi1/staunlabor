/**
 * The ball cannon from the side, in metres, the floor at height 0, in two
 * drawings at two scales:
 *
 * - **close up**, at the balls' own size: the steel wire, the floor and the
 *   stack, from the floor to a little above where the stack is let go. The hits
 *   happen here, and the reader drags the stack up here to choose its height;
 * - **the whole climb**, a narrow column as high as the small ball goes: each
 *   ball a dot at its centre, and a mark at the top ball's highest point.
 *
 * Two, because one drawing cannot be both: a ball shot to six metres drawn at
 * the scale of a 5 cm ball leaves the picture, and at the scale of six metres
 * a 5 cm ball is three pixels on a phone. Drawn here rather than in a chart:
 * it is the exhibit.
 */

import type { PointerEvent as ReactPointerEvent, Ref } from "react";
import { useTranslation } from "react-i18next";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber } from "@/shared/lib/format";
import { useChartHex } from "@/shared/state/palette-store";
import type { Ball } from "./simulate/cannon";

export function CannonView({
  balls,
  y,
  closeTopM,
  climbTopM,
  apexM,
  svgRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  balls: readonly Ball[];
  /** Each ball's underside above the floor, bottom first. */
  y: readonly number[];
  /** How high the close-up reaches, and the column. */
  closeTopM: number;
  climbTopM: number;
  /** The top ball's highest point in the last drop, once it has been there. */
  apexM: number | null;
  svgRef?: Ref<SVGSVGElement>;
  onPointerDown?: (event: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerMove?: (event: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerUp?: (event: ReactPointerEvent<SVGSVGElement>) => void;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  const colours = [hex[0], hex[2 % hex.length], hex[4 % hex.length]];

  const closeFloor = 0.04 * closeTopM;
  const closeHalf = 0.375 * (closeTopM + closeFloor);
  const closeLine = closeTopM / 300;

  const climbFloor = 0.04 * climbTopM;
  const climbHalf = 0.12 * (climbTopM + climbFloor);
  const climbLine = climbTopM / 300;
  const dot = climbTopM / 60;
  const top = balls.length - 1;

  return (
    <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,1fr)] gap-2">
      <svg
        ref={svgRef}
        viewBox={`${-closeHalf} ${-closeTopM} ${2 * closeHalf} ${closeTopM + closeFloor}`}
        role="img"
        aria-label={t("experiments.cannon.view")}
        className="aspect-[3/4] w-full touch-none select-none rounded-lg border border-subtle bg-surface-2 text-muted"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <rect x={-closeHalf} y={0} width={2 * closeHalf} height={closeFloor} fill="currentColor" fillOpacity={0.15} />
        <line x1={-closeHalf} x2={closeHalf} y1={0} y2={0} stroke="currentColor" strokeWidth={closeLine * 2} />
        <line x1={0} x2={0} y1={0} y2={-closeTopM} stroke="currentColor" strokeOpacity={0.5} strokeWidth={closeLine} />
        {balls.map((ball, i) => (
          <circle
            key={i}
            cx={0}
            cy={-(y[i] + ball.diameter_m / 2)}
            r={ball.diameter_m / 2}
            fill={colours[i]}
            fillOpacity={0.85}
            stroke="currentColor"
            strokeWidth={closeLine}
          />
        ))}
      </svg>
      <svg
        viewBox={`${-climbHalf} ${-climbTopM} ${2 * climbHalf} ${climbTopM + climbFloor}`}
        role="img"
        aria-label={t("experiments.cannon.climb_view")}
        className="h-full w-full rounded-lg border border-subtle bg-surface-2 text-muted"
        preserveAspectRatio="xMidYMax meet"
      >
        <rect x={-climbHalf} y={0} width={2 * climbHalf} height={climbFloor} fill="currentColor" fillOpacity={0.15} />
        <line x1={0} x2={0} y1={0} y2={-climbTopM} stroke="currentColor" strokeOpacity={0.5} strokeWidth={climbLine} />
        {apexM !== null && apexM > 0 && (
          <g>
            <line
              x1={-climbHalf}
              x2={climbHalf}
              y1={-apexM}
              y2={-apexM}
              stroke={colours[top]}
              strokeDasharray={`${climbLine * 6} ${climbLine * 4}`}
              strokeWidth={climbLine * 2}
            />
            <text x={0} y={-apexM} dy="-0.4em" textAnchor="middle" fontSize={climbHalf * 0.35} fill="currentColor">
              {formatNumber(apexM, 1, locale)} m
            </text>
          </g>
        )}
        {balls.map((ball, i) => (
          <circle key={i} cx={0} cy={-(y[i] + ball.diameter_m / 2)} r={dot} fill={colours[i]} />
        ))}
      </svg>
    </div>
  );
}
