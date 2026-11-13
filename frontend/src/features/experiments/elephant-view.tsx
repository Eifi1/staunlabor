/**
 * The Bernoulli elephant from the side, in metres, the trunk's opening at the
 * origin: the elephant standing on the floor with its trunk raised, the trunk
 * ending along the jet's axis (tilted as the reader tilts it), the jet as a
 * widening band out to where it carries little, the air as streaks moving at
 * the jet's own speed (slowed so an eye can follow), and the ball. The jet's
 * width is the engine's (`simulate/elephant.ts`), so the band the reader sees
 * widen is the width the ball's lift is computed from.
 *
 * Drawn here rather than in a chart: it is the exhibit, not a plot. The
 * elephant is the site's own drawing.
 */

import { useTranslation } from "react-i18next";
import { useChartHex } from "@/shared/state/palette-store";
import { axes, width, type Elephant } from "./simulate/elephant";

/** How far the drawing reaches, metres: the floor under the elephant, the air above the ball. */
const LEFT = -0.75;
const RIGHT = 0.75;
const FLOOR = -0.55;
const TOP = 1.05;
/** How far up the jet is drawn, and how wide: the band edge at 1.4 widths, where the air has a seventh of its speed. */
export const JET_DRAWN_M = 1.1;
const JET_EDGE = 1.4;

/** The ball's hues: three panels of a beach ball, the chart palette's. */
const PANEL_HUES = [2, 4, 6];

export interface Streak {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** A point along the jet: `s` along its axis, `e` across it toward the low side. */
function at(tiltDeg: number, s: number, e: number): [number, number] {
  const [[ax, ay], [nx, ny]] = axes(tiltDeg);
  return [s * ax + e * nx, s * ay + e * ny];
}

export function ElephantView({
  elephant,
  tiltDeg,
  ball,
  streaks,
}: {
  elephant: Elephant;
  tiltDeg: number;
  /** The ball's centre, metres from the opening. */
  ball: [number, number];
  streaks: readonly Streak[];
}) {
  const { t } = useTranslation();
  const hex = useChartHex();
  const brand = hex[0];
  const jet = elephant.jet;
  const radius = elephant.ball.diameter_m / 2;
  const opening = jet.opening_m;
  // The jet's band: one edge up, the other back down.
  const samples = Array.from({ length: 23 }, (_, i) => (JET_DRAWN_M * i) / 22);
  const band = [
    ...samples.map((s) => at(tiltDeg, s, -JET_EDGE * width(jet, s))),
    ...samples.reverse().map((s) => at(tiltDeg, s, JET_EDGE * width(jet, s))),
  ]
    .map(([x, y]) => `${x.toFixed(4)},${(-y).toFixed(4)}`)
    .join(" ");
  // The trunk: from under the head, down and forward, then up into the axis.
  const [[ax, ay]] = axes(tiltDeg);
  const trunk = `M -0.17 0.24 C -0.06 0.38 ${(-0.2 * ax).toFixed(4)} ${(0.2 * ay).toFixed(4)} 0 0`;
  const [r1x, r1y] = at(tiltDeg, 0, -opening / 2 - 0.012);
  const [r2x, r2y] = at(tiltDeg, 0, opening / 2 + 0.012);
  const [bx, by] = ball;
  return (
    <svg
      viewBox={`${LEFT} ${-TOP} ${RIGHT - LEFT} ${TOP - FLOOR}`}
      role="img"
      aria-label={t("experiments.elephant.view")}
      className="aspect-[150/160] w-full rounded-lg border border-subtle bg-surface-2 text-muted"
    >
      <line x1={LEFT} x2={RIGHT} y1={-FLOOR} y2={-FLOOR} stroke="currentColor" strokeWidth={0.006} />
      {/* The jet, then the air in it. */}
      <polygon points={band} fill={brand} fillOpacity={0.1} stroke="none" />
      {streaks.map((st, i) => (
        <line
          key={i}
          x1={st.x1}
          y1={-st.y1}
          x2={st.x2}
          y2={-st.y2}
          stroke={brand}
          strokeOpacity={0.55}
          strokeWidth={0.006}
          strokeLinecap="round"
        />
      ))}
      {/* The elephant: legs, body, ear, head, trunk, eye. */}
      <g fill="currentColor" fillOpacity={0.35} stroke="currentColor" strokeWidth={0.006}>
        <rect x={-0.64} y={0.38} width={0.09} height={-FLOOR - 0.38} rx={0.02} />
        <rect x={-0.44} y={0.38} width={0.09} height={-FLOOR - 0.38} rx={0.02} />
        <ellipse cx={-0.5} cy={0.3} rx={0.24} ry={0.16} />
        <ellipse cx={-0.34} cy={0.14} rx={0.08} ry={0.11} fillOpacity={0.5} />
        <circle cx={-0.25} cy={0.16} r={0.12} />
      </g>
      <path
        d={trunk}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.35}
        strokeWidth={Math.max(0.04, opening * 0.9)}
        strokeLinecap="butt"
      />
      <line x1={r1x} y1={-r1y} x2={r2x} y2={-r2y} stroke="currentColor" strokeWidth={0.012} strokeLinecap="round" />
      <circle cx={-0.2} cy={0.11} r={0.012} fill="currentColor" />
      {/* The ball: three panels round its centre. */}
      <g transform={`translate(${bx} ${-by})`}>
        {PANEL_HUES.map((hue, k) => {
          const a0 = (k * 2 * Math.PI) / 3 - Math.PI / 2;
          const a1 = a0 + (2 * Math.PI) / 3;
          return (
            <path
              key={hue}
              d={`M 0 0 L ${radius * Math.cos(a0)} ${radius * Math.sin(a0)} A ${radius} ${radius} 0 0 1 ${radius * Math.cos(a1)} ${radius * Math.sin(a1)} Z`}
              fill={hex[hue % hex.length]}
              fillOpacity={0.85}
            />
          );
        })}
        <circle r={radius} fill="none" stroke="currentColor" strokeWidth={0.006} />
      </g>
    </svg>
  );
}
