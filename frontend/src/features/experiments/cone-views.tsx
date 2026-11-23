/**
 * The double cone on its rails, drawn twice at true scale.
 *
 * From the side, looking along the cone's axis: the two rails are one rising
 * line, and the cone is its middle disc with, inside it, the circle it rolls on
 * — where the rails hold it — and a spoke that turns. The dashed line is the
 * path of its axis, which falls while the rails rise: the whole exhibit in one
 * picture.
 *
 * From the front, looking up the rails: they spread as they climb, and the
 * cone, a rhombus seen this way, sinks between them, held further out where it
 * is thinner.
 */

import { useTranslation } from "react-i18next";
import { useChartHue } from "@/shared/state/palette-store";
import {
  axisHeightM,
  contactRadiusM,
  halfGapM,
  halfLengthM,
  offsets,
  radiusUnderM,
  railHeightM,
  type ConeExhibit,
} from "./simulate/cone";
import { STAGE, VIEW_FRAME } from "./stage";

/** The cone's hue: the palette's hue for what moves by itself. */
const CONE_HUE = 2;
/** The rails' hue, as the race's tracks. */
const RAIL_HUE = 6;

const sinDeg = (deg: number) => Math.sin((deg * Math.PI) / 180);
const cosDeg = (deg: number) => Math.cos((deg * Math.PI) / 180);

/** The contact's place along the rails, for the cone lying across them at `x`. */
function contactX(ex: ConeExhibit, x: number): number {
  return x + offsets(ex)[0] * radiusUnderM(ex, x);
}

/** `axisPath`: the axis's dashed path, which says which way the cone will
 *  roll and why; the play card leaves it out until the reader has let it go. */
export function ConeSideView({
  ex,
  x,
  turnDeg,
  axisPath = true,
}: {
  ex: ConeExhibit;
  x: number;
  turnDeg: number;
  axisPath?: boolean;
}) {
  const { t } = useTranslation();
  const hue = useChartHue();
  const colour = hue(CONE_HUE);
  const rail = hue(RAIL_HUE);
  const { radius_m: big } = ex.cone;
  const length = ex.rails.length_m;
  const margin = big * 0.4;
  const top = Math.max(axisHeightM(ex, 0), axisHeightM(ex, length)) + big + margin;
  const bottom = -margin - big * 0.3;
  const left = -big - margin;
  const width = length + 2 * (big + margin);
  // SVG's y runs down: heights are drawn as −z.
  const z = axisHeightM(ex, x);
  const rho = contactRadiusM(ex, x);
  const cx = contactX(ex, x);
  return (
    <svg
      viewBox={`${left} ${-top} ${width} ${top - bottom}`}
      role="img"
      aria-label={t("experiments.cone.views.side")}
      className={`${STAGE.wide} ${VIEW_FRAME}`}
    >
      {/* The rails, one line from the side, on their stand. */}
      <line
        x1={0}
        y1={0}
        x2={length}
        y2={-railHeightM(ex, length)}
        stroke={rail}
        strokeWidth={4}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1={left}
        y1={0}
        x2={left + width}
        y2={0}
        stroke="currentColor"
        opacity={0.3}
        vectorEffect="non-scaling-stroke"
      />
      {/* The axis's path: falling while the rails rise. */}
      {axisPath && (
        <line
          x1={0}
          y1={-axisHeightM(ex, 0)}
          x2={length}
          y2={-axisHeightM(ex, length)}
          stroke="currentColor"
          strokeDasharray="4 3"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      )}
      <circle cx={x} cy={-z} r={big} fill={colour} opacity={0.25} />
      <circle cx={x} cy={-z} r={rho} fill="none" stroke={colour} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      <line
        x1={x}
        y1={-z}
        x2={x + big * cosDeg(-turnDeg)}
        y2={-z - big * sinDeg(-turnDeg)}
        stroke={colour}
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={x} cy={-z} r={big * 0.06} className="fill-current text-primary" />
      <circle cx={cx} cy={-railHeightM(ex, cx)} r={big * 0.07} className="fill-current text-primary" />
    </svg>
  );
}

export function ConeFrontView({ ex, x }: { ex: ConeExhibit; x: number }) {
  const { t } = useTranslation();
  const hue = useChartHue();
  const colour = hue(CONE_HUE);
  const rail = hue(RAIL_HUE);
  const big = ex.cone.radius_m;
  const half = halfLengthM(ex.cone);
  const length = ex.rails.length_m;
  const margin = big * 0.4;
  const z = axisHeightM(ex, x);
  const cx = contactX(ex, x);
  const gap = halfGapM(ex, cx);
  const top = Math.max(axisHeightM(ex, 0), axisHeightM(ex, length), railHeightM(ex, length)) + big + margin;
  const bottom = -margin;
  return (
    <svg
      viewBox={`${-half - margin} ${-top} ${2 * (half + margin)} ${top - bottom}`}
      role="img"
      aria-label={t("experiments.cone.views.front")}
      className={`${STAGE.wide} ${VIEW_FRAME}`}
    >
      {/* The rails from the low end: spreading as they climb. */}
      {[-1, 1].map((side) => (
        <line
          key={side}
          x1={side * halfGapM(ex, 0)}
          y1={0}
          x2={side * halfGapM(ex, length)}
          y2={-railHeightM(ex, length)}
          stroke={rail}
          strokeWidth={3}
          strokeLinecap="round"
          opacity={0.6}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {/* The cone from the front: a rhombus, its tips on its axis. */}
      <polygon
        points={`${-half},${-z} 0,${-z - big} ${half},${-z} 0,${-z + big}`}
        fill={colour}
        opacity={0.35}
        stroke={colour}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1={-half}
        y1={-z}
        x2={half}
        y2={-z}
        stroke="currentColor"
        strokeDasharray="4 3"
        vectorEffect="non-scaling-stroke"
      />
      {/* Where the rails hold it. */}
      {[-1, 1].map((side) => (
        <circle
          key={side}
          cx={side * gap}
          cy={-railHeightM(ex, cx)}
          r={big * 0.07}
          className="fill-current text-primary"
        />
      ))}
    </svg>
  );
}
