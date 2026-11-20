/**
 * A 2×2 system's phase portrait: twelve trajectories from the unit circle, and
 * the real eigenvectors as lines through the origin.
 *
 * Inline SVG with a square aspect, because a trajectory's shape is the point and
 * a chart stretched to its container's width would turn a circle (a centre)
 * into an ellipse. The trajectories are the engine's, computed from the
 * closed-form matrix exponential, cut where they leave the box; each ends in an
 * arrow, so the direction of time is drawn rather than said.
 */

import { useChartHex } from "@/shared/state/palette-store";
import type { Eigenvector, Trajectory } from "@/shared/types";
import { HUE } from "./colours";

const S = 320;
const BOX = 3;

export function PhasePortrait({
  trajectories,
  eigenvectors,
  label,
}: {
  trajectories: Trajectory[];
  eigenvectors: Eigenvector[];
  label: string;
}) {
  const hex = useChartHex();
  const sx = (v: number) => S / 2 + (v / BOX) * (S / 2 - 8);
  const sy = (v: number) => S / 2 - (v / BOX) * (S / 2 - 8);
  return (
    <svg viewBox={`0 0 ${S} ${S}`} role="img" aria-label={label} className="mx-auto w-full max-w-sm">
      <defs>
        <marker
          id="portrait-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={hex[HUE.measuring]} />
        </marker>
      </defs>
      <rect x={0} y={0} width={S} height={S} className="fill-surface stroke-subtle" />
      <line x1={0} y1={S / 2} x2={S} y2={S / 2} className="stroke-strong" strokeWidth={0.75} />
      <line x1={S / 2} y1={0} x2={S / 2} y2={S} className="stroke-strong" strokeWidth={0.75} />
      <text x={S - 6} y={S / 2 - 6} textAnchor="end" className="fill-muted" fontSize={11}>
        x₁
      </text>
      <text x={S / 2 + 6} y={14} className="fill-muted" fontSize={11}>
        x₂
      </text>
      <circle cx={S / 2} cy={S / 2} r={(S / 2 - 8) / BOX} fill="none" className="stroke-subtle" strokeDasharray="2 3" />
      {eigenvectors.map((v) => (
        <line
          key={`${v.eigenvalue}-${v.x1}`}
          x1={sx(-BOX * 2 * v.x1)}
          y1={sy(-BOX * 2 * v.x2)}
          x2={sx(BOX * 2 * v.x1)}
          y2={sy(BOX * 2 * v.x2)}
          stroke={hex[HUE.pole]}
          strokeWidth={1.5}
          strokeDasharray="6 4"
        />
      ))}
      {trajectories.map((tr, k) => (
        <g key={k}>
          <polyline
            points={tr.x1.map((x, i) => `${sx(x)},${sy(tr.x2[i])}`).join(" ")}
            fill="none"
            stroke={hex[HUE.measuring]}
            strokeWidth={1.5}
            markerEnd="url(#portrait-arrow)"
          />
          <circle cx={sx(tr.x1[0])} cy={sy(tr.x2[0])} r={2.5} fill={hex[HUE.measuring]} />
        </g>
      ))}
    </svg>
  );
}
