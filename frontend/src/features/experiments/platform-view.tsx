/**
 * The spinning platform from above: the disc with four spokes so its turn
 * shows, the handlebar across the axis, and the visitor on it — the legs at the
 * axis (the feet do not move), the trunk and head leaning out by the lean, and
 * the arms from the hands on the bar to the shoulders. Everything in metres and
 * turned by the platform's angle; the sizes are the engine's (`inertia`'s
 * lumps), so what the reader sees leaning out is what the moment of inertia
 * counts.
 */

import { useTranslation } from "react-i18next";
import { useChartHex } from "@/shared/state/palette-store";
import type { Body, Platform, Posture } from "./simulate/platform";

/** The visitor's hue: the palette's hue for what the visitor moves, as the sphere's ball. */
const BODY_HUE = 3;

export function PlatformView({
  body,
  platform,
  posture,
  angleRad,
}: {
  body: Body;
  platform: Platform;
  posture: Posture;
  /** How far the platform has turned. */
  angleRad: number;
}) {
  const { t } = useTranslation();
  const hex = useChartHex();
  const extent = Math.max(platform.radius_m, body.shoulder_m + 0.5) + 0.05;
  const d = posture.lean_m;
  const s = body.shoulder_m;
  const colour = hex[BODY_HUE % hex.length];
  return (
    <svg
      viewBox={`${-extent} ${-extent} ${2 * extent} ${2 * extent}`}
      role="img"
      aria-label={t("experiments.platform.view")}
      className="aspect-square w-full rounded-lg border border-subtle bg-surface-2 text-muted"
    >
      <g transform={`rotate(${(-angleRad * 180) / Math.PI})`}>
        <circle
          r={platform.radius_m}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
        {[0, 1, 2, 3].map((k) => {
          const a = (k * Math.PI) / 2;
          return (
            <line
              key={k}
              x1={0}
              y1={0}
              x2={platform.radius_m * Math.cos(a)}
              y2={platform.radius_m * Math.sin(a)}
              stroke="currentColor"
              opacity={0.5}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
        {/* The legs at the axis; the trunk and the head out by the lean. */}
        <ellipse cx={0} cy={0} rx={0.07} ry={0.12} fill={colour} opacity={0.45} />
        <ellipse cx={d} cy={0} rx={0.11} ry={s} fill={colour} opacity={0.75} />
        {/* The arms, from the hands on the bar to the shoulders. */}
        {[-1, 1].map((side) => (
          <line
            key={side}
            x1={0}
            y1={side * s}
            x2={d}
            y2={side * s}
            stroke={colour}
            strokeWidth={6}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <circle cx={d + 0.02} cy={0} r={0.09} className="fill-current text-primary" opacity={0.85} />
        {/* The handlebar, fixed to the platform across its axis. */}
        <line
          x1={-0.02}
          y1={-s - 0.06}
          x2={-0.02}
          y2={s + 0.06}
          stroke="currentColor"
          strokeWidth={4}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </g>
      {/* The axis, which does not turn. */}
      <circle r={0.015} className="fill-current text-primary" />
    </svg>
  );
}
