/**
 * The water parabola, drawn twice at true scale.
 *
 * Cut through the middle from the side: the vessel, the water under its
 * surface, and — where it lies in the picture — the focus of the bowl as a
 * mirror, with two rays coming straight down and reflected to it.
 *
 * From above: the vessel's rim with four marks that turn with it, and a few
 * specks floating in the water that turn with the water. Seen turning along
 * with the vessel, its marks stand still and the specks show how far the water
 * still lags behind.
 */

import { useTranslation } from "react-i18next";
import { useChartHue } from "@/shared/state/palette-store";
import { heightAt, profile, surface, type Vessel } from "./simulate/parabola";
import { STAGE, VIEW_FRAME } from "./stage";
import { G } from "./simulate/constants";

/** The water's hue, as the elephant's air. */
const WATER_HUE = 0;
/** The light's hue, for the rays to the focus. */
const LIGHT_HUE = 4;

/** The specks in the water: their distance from the axis as a share of the
 *  radius, and where they start round it. */
const SPECKS: ReadonlyArray<readonly [number, number]> = [
  [0.25, 0],
  [0.5, 2.1],
  [0.7, 4.2],
  [0.85, 1.2],
  [0.4, 3.6],
  [0.95, 5.4],
];

export function ParabolaSideView({ v, rate }: { v: Vessel; rate: number }) {
  const { t } = useTranslation();
  const hue = useChartHue();
  const water = hue(WATER_HUE);
  const light = hue(LIGHT_HUE);
  const s = surface(v, rate);
  const heights = profile(v, rate);
  const n = heights.length - 1;
  const wall = v.radius_m * 0.04;
  const top = Math.max(v.height_m, Math.min(s.rim_m, v.height_m * 1.15)) + v.radius_m * 0.15;
  const left = -v.radius_m - 2 * wall - v.radius_m * 0.1;
  const width = -2 * left;
  // The water to the top of the vessel at most: past it, it has spilled.
  const surfacePoints = heights.map((z, i) => {
    const x = -v.radius_m + (2 * v.radius_m * i) / n;
    return `${x},${-Math.min(z, v.height_m)}`;
  });
  const polygon = [`${-v.radius_m},0`, ...surfacePoints, `${v.radius_m},0`].join(" ");
  // The focus, above the paraboloid's vertex: drawn where it falls in the picture.
  const vertex = s.dry_radius_m > 0 ? -(rate ** 2 / (2 * G)) * s.dry_radius_m ** 2 : s.centre_m;
  const focus = s.focus_m === null ? null : vertex + s.focus_m;
  const showFocus = focus !== null && focus < top && focus > 0;
  const rayX = v.radius_m * 0.6;
  const surfaceZ = heightAt(s, rayX);
  return (
    <svg
      viewBox={`${left} ${-top} ${width} ${top + wall * 2}`}
      role="img"
      aria-label={t("experiments.parabola.views.side")}
      className={`${STAGE.wide} ${VIEW_FRAME}`}
    >
      <polygon points={polygon} fill={water} opacity={0.45} />
      <polyline
        points={surfacePoints.join(" ")}
        fill="none"
        stroke={water}
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
      {/* The water at rest, for comparison. */}
      <line
        x1={-v.radius_m}
        y1={-v.fill_m}
        x2={v.radius_m}
        y2={-v.fill_m}
        stroke="currentColor"
        strokeDasharray="4 3"
        opacity={0.6}
        vectorEffect="non-scaling-stroke"
      />
      {/* The vessel: a bottom and two walls. */}
      <path
        d={`M ${-v.radius_m - wall} ${-v.height_m} V ${wall} H ${v.radius_m + wall} V ${-v.height_m}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        vectorEffect="non-scaling-stroke"
      />
      <line x1={0} y1={wall} x2={0} y2={-top} stroke="currentColor" opacity={0.25} vectorEffect="non-scaling-stroke" />
      {showFocus && (
        <g stroke={light} strokeWidth={1.5} fill="none" vectorEffect="non-scaling-stroke">
          {[-1, 1].map((side) => (
            <polyline
              key={side}
              points={`${side * rayX},${-top} ${side * rayX},${-surfaceZ} 0,${-focus}`}
              vectorEffect="non-scaling-stroke"
              opacity={0.8}
            />
          ))}
          <circle cx={0} cy={-focus} r={v.radius_m * 0.03} fill={light} />
        </g>
      )}
    </svg>
  );
}

export function ParabolaTopView({
  v,
  vesselAngle,
  waterAngle,
}: {
  v: Vessel;
  /** How far the vessel has turned, in the frame the picture is seen in. */
  vesselAngle: number;
  waterAngle: number;
}) {
  const { t } = useTranslation();
  const hue = useChartHue();
  const water = hue(WATER_HUE);
  const extent = v.radius_m * 1.12;
  return (
    <svg
      viewBox={`${-extent} ${-extent} ${2 * extent} ${2 * extent}`}
      role="img"
      aria-label={t("experiments.parabola.views.top")}
      className={`aspect-square ${VIEW_FRAME}`}
    >
      <circle r={v.radius_m} fill={water} opacity={0.2} />
      <circle r={v.radius_m} fill="none" stroke="currentColor" strokeWidth={3} vectorEffect="non-scaling-stroke" />
      {[0, 1, 2, 3].map((k) => {
        const a = vesselAngle + (k * Math.PI) / 2;
        return (
          <line
            key={k}
            x1={v.radius_m * 0.98 * Math.cos(a)}
            y1={v.radius_m * 0.98 * Math.sin(a)}
            x2={v.radius_m * 1.1 * Math.cos(a)}
            y2={v.radius_m * 1.1 * Math.sin(a)}
            stroke="currentColor"
            strokeWidth={4}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
      {SPECKS.map(([share, phase], k) => {
        const a = waterAngle + phase;
        return (
          <circle
            key={k}
            cx={v.radius_m * share * Math.cos(a)}
            cy={v.radius_m * share * Math.sin(a)}
            r={v.radius_m * 0.04}
            fill={water}
          />
        );
      })}
      <circle r={v.radius_m * 0.02} className="fill-current text-primary" />
    </svg>
  );
}
