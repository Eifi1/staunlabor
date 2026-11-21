/**
 * The coil exhibit seen from the side, at true scale: the two ramps and the
 * flat between them (the track's height is the port's `height`, the bends
 * included), the coil round the flat — tinted while a button drives it, in the
 * button's colour — and the car, tilted with the track, carrying its magnet.
 * And the exhibit's meter: a digital readout in milliamperes, plus or minus,
 * showing `OL` past its range as a real one would.
 *
 * Drawn here rather than in a chart: it is the exhibit, not a plot.
 */

import { useTranslation } from "react-i18next";
import type { CoilExhibitRequest } from "@/shared/types";
import { useChartHex } from "@/shared/state/palette-store";
import { endOf, height, slope, topHeight, type CoilExhibit, type Press } from "./simulate/coil";
import { STAGE } from "./stage";

/** Hues for the two buttons, from the chart palette. */
export const BUTTON_HUE: Record<1 | -1, number> = { 1: 2, [-1]: 4 };

const CAR_LENGTH_M = 0.06;
const CAR_HEIGHT_M = 0.02;

/** How far along a ramp's arc it is `h` high: the arc's `R·(1 − cos(s/R)) = h`
 *  turned round. */
function rampAlong(ex: CoilExhibit, h: number): number {
  const r = ex.track.ramp_radius_m;
  return Math.min(ex.track.ramp_length_m, r * Math.acos(Math.max(-1, Math.min(1, 1 - h / r))));
}

export function CoilTrack({
  exhibit,
  x,
  press,
  peak = null,
  reached = [false, false],
}: {
  exhibit: CoilExhibitRequest;
  x: number;
  press: Press;
  /** How high the car last came, and on which ramp (−1 left, +1 right). */
  peak?: { height: number; side: number } | null;
  /** The flags it has reached, left and right: lit, the others pale. */
  reached?: [boolean, boolean];
}) {
  const { t } = useTranslation();
  const hex = useChartHex();
  const ex = exhibit as CoilExhibit;
  const end = endOf(ex.track);
  const top = topHeight(ex.track);
  const coilRadius = ex.coil.mean_diameter_m / 2;
  const left = -end - 0.04;
  const width = 2 * end + 0.08;
  const lowest = -coilRadius - 0.01;
  const highest = Math.max(top, coilRadius) + 0.03;
  const points = Array.from({ length: 201 }, (_, j) => {
    const at = -end + (2 * end * j) / 200;
    return `${at},${-height(ex, at)}`;
  }).join(" ");
  const carY = height(ex, x);
  const tilt = (-Math.asin(Math.max(-1, Math.min(1, slope(ex, x)))) * 180) / Math.PI;
  const tint = press === 0 ? "none" : hex[BUTTON_HUE[press] % hex.length];
  const windings = 9;

  return (
    <svg
      viewBox={`${left} ${-highest} ${width} ${highest - lowest}`}
      role="img"
      aria-label={t("experiments.coil.track.label")}
      className={`w-full ${STAGE.wide} text-muted`}
      preserveAspectRatio="xMidYMid meet"
    >
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      {[-end, end].map((at, side) => (
        <g key={at} className={reached[side] ? "text-success" : "text-muted"}>
          <line
            x1={at}
            y1={-top}
            x2={at}
            y2={-top - 0.02}
            stroke="currentColor"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
          <polygon
            points={`${at},${-top - 0.02} ${at + Math.sign(at) * 0.02},${-top - 0.015} ${at},${-top - 0.01}`}
            className={`fill-current ${reached[side] ? "" : "opacity-40"}`}
          />
        </g>
      ))}
      {/* How high the car last came: a mark on that ramp, so a pass that took
          it higher shows where the eye already is. */}
      {peak && peak.height > 0 && (
        <g className="text-brand">
          <circle
            cx={peak.side * (ex.track.flat_length_m / 2 + rampAlong(ex, peak.height))}
            cy={-peak.height}
            r={0.006}
            className="fill-current"
          />
        </g>
      )}
      <rect
        x={-ex.coil.length_m / 2}
        y={-coilRadius}
        width={ex.coil.length_m}
        height={2 * coilRadius}
        fill={tint}
        fillOpacity={0.25}
        stroke="currentColor"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        rx={0.004}
      />
      {Array.from({ length: windings }, (_, j) => {
        const at = -ex.coil.length_m / 2 + (ex.coil.length_m * (j + 0.5)) / windings;
        return (
          <line
            key={j}
            x1={at}
            y1={-coilRadius}
            x2={at}
            y2={coilRadius}
            stroke="currentColor"
            strokeWidth={0.75}
            opacity={0.6}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
      <g transform={`translate(${x} ${-carY}) rotate(${tilt})`}>
        <rect
          x={-CAR_LENGTH_M / 2}
          y={-CAR_HEIGHT_M - 0.004}
          width={CAR_LENGTH_M}
          height={CAR_HEIGHT_M}
          rx={0.003}
          className="fill-current text-primary"
          opacity={0.85}
        />
        <rect
          x={-ex.magnet.length_m}
          y={-CAR_HEIGHT_M + 0.002}
          width={2 * ex.magnet.length_m}
          height={CAR_HEIGHT_M - 0.008}
          fill={hex[3 % hex.length]}
        />
        {[-CAR_LENGTH_M / 3, CAR_LENGTH_M / 3].map((at) => (
          <circle key={at} cx={at} cy={-0.003} r={0.004} className="fill-current text-primary" />
        ))}
      </g>
    </svg>
  );
}

/** A digital meter, ± its range in milliamperes, `OL` past it: the exhibit's own, and
 *  the page's second one for what the buttons drive. */
export function Meter({
  currentA,
  rangeA,
  label,
}: {
  currentA: number;
  rangeA: number;
  /** What a screen reader calls it; the exhibit's meter by default. */
  label?: string;
}) {
  const { t } = useTranslation();
  const ma = currentA * 1000;
  const over = Math.abs(currentA) > rangeA;
  const shown = over ? "OL" : `${ma < -0.5 ? "−" : ma > 0.5 ? "+" : " "}${Math.abs(ma).toFixed(0).padStart(3, " ")}`;
  return (
    // A group, not a live region: the reading changes every frame, and a
    // screen reader told each change would say nothing else.
    <div
      role="group"
      aria-label={label ?? t("experiments.coil.meter.label")}
      className="inline-flex items-baseline gap-1 rounded-md border border-strong bg-surface-2 px-2 py-2 font-mono text-primary sm:gap-2 sm:px-4"
    >
      <span className="text-2xl tabular-nums whitespace-pre sm:text-3xl">{shown}</span>
      <span className="text-sm text-secondary">mA</span>
    </div>
  );
}
