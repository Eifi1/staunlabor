/**
 * The smoke drum in cross-section, in metres, the skin's rim at height 0: the
 * drum on its legs, the skin pressed down at the ring round the hole in the
 * shape a stretched membrane takes (the engine's `effective_area` integrates
 * the same shape), the smoke inside, two hands on the ring, and the smoke that
 * has left the hole — a ring seen edge-on, two swirling cores, or a puff — as
 * the particles the page moves.
 *
 * Drawn here rather than in a chart: it is the exhibit, not a plot.
 */

import type { PointerEvent as ReactPointerEvent, Ref } from "react";
import { useTranslation } from "react-i18next";
import { useChartHex } from "@/shared/state/palette-store";
import type { Drum } from "./simulate/smoke";

/** How far the drawing reaches, metres. */
const LEFT = -1.15;
const RIGHT = 1.15;
const FLOOR = -1.0;
const TOP = 1.9;

export interface Puff {
  x: number;
  y: number;
  opacity: number;
}

/** The skin from the rim to the ring at a press of `x`, as the membrane's
 *  log profile, then the ring flat to the hole; one side, outward in. */
function skinSide(drum: Drum, x: number, sign: 1 | -1): [number, number][] {
  const big = drum.diameter_m / 2;
  const a = drum.ring_m / 2;
  const h = drum.hole_m / 2;
  const points: [number, number][] = [];
  for (let i = 0; i <= 24; i += 1) {
    const r = big - ((big - a) * i) / 24;
    points.push([sign * r, (-x * Math.log(big / r)) / Math.log(big / a)]);
  }
  points.push([sign * h, -x]);
  return points;
}

export function SmokeView({
  drum,
  pressM,
  puffs,
  ring,
  svgRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  drum: Drum;
  /** How far the ring is pressed now. */
  pressM: number;
  puffs: readonly Puff[];
  /** The ring's place and size while a ring flies, for its faint outline. */
  ring: { x: number; z: number; radius: number } | null;
  svgRef?: Ref<SVGSVGElement>;
  onPointerDown?: (event: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerMove?: (event: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerUp?: (event: ReactPointerEvent<SVGSVGElement>) => void;
}) {
  const { t } = useTranslation();
  const hex = useChartHex();
  const big = drum.diameter_m / 2;
  const a = drum.ring_m / 2;
  const h = drum.hole_m / 2;
  const left = skinSide(drum, pressM, -1);
  const right = skinSide(drum, pressM, 1);
  const toSvg = ([x, y]: [number, number]) => `${x.toFixed(4)},${(-y).toFixed(4)}`;
  const bottom = -drum.depth_m;
  // The smoke inside: from the bottom up to the skin, both sides and the hole.
  const inside = [
    [-big, bottom] as [number, number],
    ...left,
    ...right.slice().reverse(),
    [big, bottom] as [number, number],
  ]
    .map(toSvg)
    .join(" ");
  const smoke = hex[6 % hex.length];
  const handY = -pressM + 0.035;
  return (
    <svg
      ref={svgRef}
      viewBox={`${LEFT} ${-TOP} ${RIGHT - LEFT} ${TOP - FLOOR}`}
      role="img"
      aria-label={t("experiments.smoke.view")}
      className="aspect-[230/290] w-full touch-none select-none rounded-lg border border-subtle bg-surface-2 text-muted"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <line x1={LEFT} x2={RIGHT} y1={-FLOOR} y2={-FLOOR} stroke="currentColor" strokeWidth={0.008} />
      {/* The legs and the drum's wall. */}
      <g stroke="currentColor" strokeWidth={0.012} fill="none">
        <line x1={-big + 0.1} x2={-big + 0.1} y1={-bottom} y2={-FLOOR} />
        <line x1={big - 0.1} x2={big - 0.1} y1={-bottom} y2={-FLOOR} />
        <polyline points={`${-big},0 ${-big},${-bottom} ${big},${-bottom} ${big},0`} />
      </g>
      <polygon points={inside} fill={smoke} fillOpacity={0.22} stroke="none" />
      {/* The skin and the rigid ring round the hole. */}
      <polyline points={left.slice(0, 25).map(toSvg).join(" ")} fill="none" stroke="currentColor" strokeWidth={0.01} />
      <polyline points={right.slice(0, 25).map(toSvg).join(" ")} fill="none" stroke="currentColor" strokeWidth={0.01} />
      <line x1={-a} x2={-h} y1={pressM} y2={pressM} stroke="currentColor" strokeWidth={0.03} />
      <line x1={h} x2={a} y1={pressM} y2={pressM} stroke="currentColor" strokeWidth={0.03} />
      {/* Two hands on the ring. */}
      <g fill="currentColor" fillOpacity={0.35} stroke="currentColor" strokeWidth={0.006}>
        <rect x={-a - 0.02} y={-handY - 0.05} width={a - h + 0.04} height={0.05} rx={0.02} />
        <rect x={h - 0.02} y={-handY - 0.05} width={a - h + 0.04} height={0.05} rx={0.02} />
      </g>
      {ring && (
        <ellipse
          cx={ring.x}
          cy={-ring.z}
          rx={ring.radius}
          ry={ring.radius * 0.28}
          fill="none"
          stroke={smoke}
          strokeOpacity={0.35}
          strokeWidth={0.01}
        />
      )}
      {puffs.map((p, i) => (
        <circle key={i} cx={p.x} cy={-p.y} r={0.014} fill={smoke} fillOpacity={p.opacity} />
      ))}
    </svg>
  );
}
