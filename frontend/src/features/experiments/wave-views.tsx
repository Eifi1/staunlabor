/**
 * The pendulum wave, drawn twice at true scale: from above, where the row's
 * bobs make the wave and the snakes, and from the end of the row, where every
 * pendulum hangs from the same bar and their lengths fan out.
 *
 * Each view is sized for the widest swing the row is let go at, not for the
 * swing on screen, so the picture does not breathe as the bobs move. The
 * angles are the caller's (`angleDeg`, the exact pendulum), one per pendulum,
 * longest first.
 */

import { useTranslation } from "react-i18next";
import { useChartHex } from "@/shared/state/palette-store";

/** The bobs' hue: the palette's hue for what moves by itself. */
const BOB_HUE = 2;

const sinDeg = (deg: number) => Math.sin((deg * Math.PI) / 180);
const cosDeg = (deg: number) => Math.cos((deg * Math.PI) / 180);

export function WaveTopView({
  lengthsM,
  anglesDeg,
  spacingM,
  reachDeg,
}: {
  lengthsM: number[];
  anglesDeg: number[];
  spacingM: number;
  /** The widest swing the view must hold. */
  reachDeg: number;
}) {
  const { t } = useTranslation();
  const hex = useChartHex();
  const colour = hex[BOB_HUE % hex.length];
  const bob = spacingM * 0.38;
  const row = (lengthsM.length - 1) * spacingM;
  const reach = Math.max(lengthsM[0] * sinDeg(Math.max(reachDeg, 5)), spacingM) + bob * 1.5;
  const margin = spacingM;
  const points = anglesDeg.map((a, i) => [i * spacingM, lengthsM[i] * sinDeg(a)] as const);
  return (
    <svg
      viewBox={`${-margin} ${-reach} ${row + 2 * margin} ${2 * reach}`}
      role="img"
      aria-label={t("experiments.wave.views.top")}
      className="max-h-[60dvh] w-full rounded-lg border border-subtle bg-surface-2 text-muted"
    >
      {/* The bar the pendulums hang from, seen from above: a line along the row. */}
      <line
        x1={-margin / 2}
        y1={0}
        x2={row + margin / 2}
        y2={0}
        stroke="currentColor"
        strokeWidth={3}
        vectorEffect="non-scaling-stroke"
      />
      <polyline
        points={points.map(([x, y]) => `${x},${y}`).join(" ")}
        fill="none"
        stroke={colour}
        opacity={0.35}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      {points.map(([x, y], i) => (
        <g key={i}>
          <line
            x1={x}
            y1={0}
            x2={x}
            y2={y}
            stroke="currentColor"
            opacity={0.5}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          <circle cx={x} cy={y} r={bob} fill={colour} />
        </g>
      ))}
    </svg>
  );
}

export function WaveSideView({
  lengthsM,
  anglesDeg,
  reachDeg,
}: {
  lengthsM: number[];
  anglesDeg: number[];
  reachDeg: number;
}) {
  const { t } = useTranslation();
  const hex = useChartHex();
  const colour = hex[BOB_HUE % hex.length];
  const longest = lengthsM[0];
  const bob = longest * 0.035;
  const half = Math.max(longest * sinDeg(Math.max(reachDeg, 5)), longest * 0.3) + bob * 2;
  const top = -bob * 2;
  const bottom = longest + bob * 2;
  return (
    <svg
      viewBox={`${-half} ${top} ${2 * half} ${bottom - top}`}
      role="img"
      aria-label={t("experiments.wave.views.side")}
      className="max-h-[60dvh] w-full rounded-lg border border-subtle bg-surface-2 text-muted"
    >
      {/* The bar, end on, and the floor of the swing's lowest point. */}
      <circle cx={0} cy={0} r={bob * 0.8} className="fill-current text-primary" />
      {lengthsM.map((length, i) => {
        const x = length * sinDeg(anglesDeg[i]);
        const y = length * cosDeg(anglesDeg[i]);
        // The longest is drawn first and faintest, the shortest last and
        // strongest: from the end of the row, the near ones are the short ones.
        const share = lengthsM.length > 1 ? i / (lengthsM.length - 1) : 1;
        return (
          <g key={i} opacity={0.35 + 0.65 * share}>
            <line x1={0} y1={0} x2={x} y2={y} stroke="currentColor" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <circle cx={x} cy={y} r={bob} fill={colour} />
          </g>
        );
      })}
    </svg>
  );
}
