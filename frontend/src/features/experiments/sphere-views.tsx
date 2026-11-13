/**
 * The hanging sphere's two views, drawn here because they are the exhibit:
 *
 * * **From above** — where the reader pushes. The sphere's outline follows the
 *   hand; the dashed circle inside is the path of the ball's centre at the
 *   equator; the ball is where the engine's port puts it. A finger or a mouse
 *   on this view is the hand's target (`sphere-hand.ts`).
 * * **From the side** — how high the ball rides: a cut through the sphere along
 *   the ball's own direction, the ropes above and below, the equator dashed.
 *
 * Both in metres, as the engine has them; the colours are the chart palette's
 * for the ball and the page's own greys for the glass and the ropes.
 */

import type { PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { useChartHex } from "@/shared/state/palette-store";
import { MAX_PUSH_M } from "./sphere-hand";

/** The ball's hue: the palette's hue for what the visitor moves, as the platform's visitor. */
const BALL_HUE = 3;

/** The hand's target from a pointer on the top view, in metres (x right, y
 *  away), or null where the browser cannot map the point (jsdom). */
function pointOf(e: PointerEvent<SVGSVGElement>): [number, number] | null {
  const svg = e.currentTarget;
  const matrix = svg.getScreenCTM?.();
  if (!matrix) return null;
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse());
  return [p.x, -p.y];
}

export function TopView({
  shellRadiusM,
  pathRadiusM,
  ballRadiusM,
  hand,
  ball,
  onPush,
  onRelease,
  disabled,
}: {
  shellRadiusM: number;
  pathRadiusM: number;
  ballRadiusM: number;
  /** Where the hand has the sphere's centre, metres. */
  hand: [number, number];
  /** The ball's centre relative to the sphere's, metres. */
  ball: [number, number];
  onPush: (x: number, y: number) => void;
  onRelease: () => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const hex = useChartHex();
  const extent = shellRadiusM + MAX_PUSH_M + 0.02;
  const [hx, hy] = hand;
  const push = (e: PointerEvent<SVGSVGElement>) => {
    const p = pointOf(e);
    if (p) onPush(p[0], p[1]);
  };
  return (
    <svg
      viewBox={`${-extent} ${-extent} ${2 * extent} ${2 * extent}`}
      role="img"
      aria-label={t("experiments.sphere.views.top")}
      className={`aspect-square w-full touch-none rounded-lg border border-subtle bg-surface-2 text-muted ${disabled ? "" : "cursor-grab active:cursor-grabbing"}`}
      onPointerDown={(e) => {
        if (disabled) return;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        push(e);
      }}
      onPointerMove={(e) => {
        if (!disabled && e.buttons > 0) push(e);
      }}
      onPointerUp={() => onRelease()}
      onPointerCancel={() => onRelease()}
    >
      {/* Where the sphere hangs when nobody pushes. */}
      <circle
        cx={0}
        cy={0}
        r={MAX_PUSH_M}
        fill="none"
        stroke="currentColor"
        strokeDasharray="2 4"
        opacity={0.5}
        vectorEffect="non-scaling-stroke"
      />
      <line x1={-0.01} y1={0} x2={0.01} y2={0} stroke="currentColor" vectorEffect="non-scaling-stroke" />
      <line x1={0} y1={-0.01} x2={0} y2={0.01} stroke="currentColor" vectorEffect="non-scaling-stroke" />
      <g transform={`translate(${hx} ${-hy})`}>
        <circle r={shellRadiusM} fill="none" stroke="currentColor" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        <circle
          r={pathRadiusM}
          fill="none"
          stroke="currentColor"
          strokeDasharray="4 4"
          opacity={0.7}
          vectorEffect="non-scaling-stroke"
        />
        <circle cx={ball[0]} cy={-ball[1]} r={ballRadiusM} fill={hex[BALL_HUE % hex.length]} />
      </g>
    </svg>
  );
}

export function SideView({
  shellRadiusM,
  pathRadiusM,
  ballRadiusM,
  ball,
}: {
  shellRadiusM: number;
  pathRadiusM: number;
  ballRadiusM: number;
  /** The ball's centre relative to the sphere's, metres: x, y, z (z up). */
  ball: [number, number, number];
}) {
  const { t } = useTranslation();
  const hex = useChartHex();
  const extent = shellRadiusM * 1.35;
  // The cut along the ball's own direction: how far out, and how high.
  const out = Math.hypot(ball[0], ball[1]);
  const up = ball[2];
  return (
    <svg
      viewBox={`${-extent} ${-extent} ${2 * extent} ${2 * extent}`}
      role="img"
      aria-label={t("experiments.sphere.views.side")}
      className="aspect-square w-full rounded-lg border border-subtle bg-surface-2 text-muted"
    >
      {/* The ropes, to the ceiling and to the floor. */}
      <line x1={0} y1={-extent} x2={0} y2={-shellRadiusM} stroke="currentColor" vectorEffect="non-scaling-stroke" />
      <line x1={0} y1={shellRadiusM} x2={0} y2={extent} stroke="currentColor" vectorEffect="non-scaling-stroke" />
      <circle r={shellRadiusM} fill="none" stroke="currentColor" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      {/* The equator, where the ball's centre would ride at an endless tempo. */}
      <line
        x1={-pathRadiusM}
        y1={0}
        x2={pathRadiusM}
        y2={0}
        stroke="currentColor"
        strokeDasharray="4 4"
        vectorEffect="non-scaling-stroke"
      />
      <line x1={0} y1={0} x2={out} y2={-up} stroke="currentColor" opacity={0.5} vectorEffect="non-scaling-stroke" />
      <circle cx={out} cy={-up} r={ballRadiusM} fill={hex[BALL_HUE % hex.length]} />
    </svg>
  );
}
