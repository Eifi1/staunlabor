/**
 * Each racing ball's velocity and acceleration, as arrows in a coordinate
 * system and as values beside, the absolute amount among them.
 *
 * * {@link VectorPlane}: one coordinate system, every ball's vector drawn from
 *   its origin in the ball's colour — the velocity in one, the acceleration in
 *   the other. All arrows start at one point, so their lengths and directions
 *   compare at a glance; drawn on the balls they would be scattered over the
 *   race and hide its tracks.
 * * {@link MotionTable}: the same numbers, by rank — each ball's time, its
 *   speed and acceleration with their components, x to the right and y up.
 *
 * A drawing rather than one of the kit's charts:
 * what it shows is arrows in a plane, not quantities over an abscissa. The scale
 * is the build's — the fastest any ball goes, the hardest any is pushed on its
 * track or pulled in the air — and holds for the whole race, so an arrow
 * growing is the ball speeding up, not the axes moving. A knock in the pit, a
 * jolt many times harder, runs off it: drawn to the edge and dashed.
 */

import { useTranslation } from "react-i18next";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber } from "@/shared/lib/format";
import { useChartHex } from "@/shared/state/palette-store";
import type { CurveKind, RaceTrack } from "@/shared/types";
import { TRACK_HUE, type BallState } from "./race-views";

const W = 240;
const H = 240;
const PAD = 30;

/** A round span at least as wide as `need`, its half a round tick too: finer
 *  steps than the usual 1, 2, 5, since with those the default build's
 *  2.8 m/s took a span of 5 and its arrows filled half the plane. */
export function niceSpan(need: number): number {
  const p = 10 ** Math.floor(Math.log10(need));
  for (const m of [1, 1.5, 2, 3, 4, 5, 6, 8, 10]) if (m * p >= need) return m * p;
  return 10 * p;
}

/** A symbol with a subscript, as SVG text: `v` with `x` set below. */
function Sym({ base, sub }: { base: string; sub?: string }) {
  return (
    <>
      <tspan fontStyle="italic">{base}</tspan>
      {sub && (
        <tspan fontSize={8} dy={3} fontStyle="italic">
          {sub}
        </tspan>
      )}
    </>
  );
}

export function VectorPlane({
  symbol,
  unit,
  span,
  vectors,
  label,
}: {
  /** The quantity's letter: `v` or `a`. */
  symbol: string;
  unit: string;
  /** The axes' half width, in the unit. */
  span: number;
  vectors: { kind: CurveKind; value: [number, number] }[];
  label: string;
}) {
  const locale = useLocale();
  const hex = useChartHex();
  const half = W / 2 - PAD;
  const sx = (x: number) => W / 2 + (x / span) * half;
  const sy = (y: number) => H / 2 - (y / span) * half;
  const ticks = [-span, -span / 2, span / 2, span];
  // As many decimals as the half step needs: 25 none, 2.5 one, 0.25 two.
  let digits = 0;
  while (digits < 3 && Math.abs((span / 2) * 10 ** digits - Math.round((span / 2) * 10 ** digits)) > 1e-9) digits++;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={label}
      className="w-full max-w-56 rounded-lg border border-subtle bg-surface-2"
    >
      <line x1={PAD} y1={H / 2} x2={W - PAD} y2={H / 2} className="stroke-strong" strokeWidth={1} />
      <line x1={W / 2} y1={PAD} x2={W / 2} y2={H - PAD} className="stroke-strong" strokeWidth={1} />
      {ticks.map((v) => (
        <g key={v} className="fill-muted" fontSize={9}>
          <line x1={sx(v)} y1={H / 2 - 3} x2={sx(v)} y2={H / 2 + 3} className="stroke-strong" />
          <text x={sx(v)} y={H / 2 + 13} textAnchor="middle">
            {formatNumber(v, digits, locale)}
          </text>
          <line x1={W / 2 - 3} y1={sy(v)} x2={W / 2 + 3} y2={sy(v)} className="stroke-strong" />
          <text x={W / 2 - 6} y={sy(v) + 3} textAnchor="end">
            {formatNumber(v, digits, locale)}
          </text>
        </g>
      ))}
      {/* Each axis's title with its unit: x at the right end, y at the top. */}
      <text x={W - 4} y={H / 2 - 6} textAnchor="end" className="fill-muted" fontSize={10}>
        <Sym base={symbol} sub="x" /> <tspan dy={-3}>({unit})</tspan>
      </text>
      <text x={W / 2 + 6} y={PAD - 12} className="fill-muted" fontSize={10}>
        <Sym base={symbol} sub="y" /> <tspan dy={-3}>({unit})</tspan>
      </text>
      {vectors.map(({ kind, value }) => {
        const [x, y] = value;
        const length = Math.hypot(x, y);
        const colour = hex[TRACK_HUE[kind] % hex.length];
        if (length < span * 0.01) return <circle key={kind} cx={W / 2} cy={H / 2} r={3} fill={colour} />;
        // Off the scale (a knock in the pit): drawn to the edge, dashed, and the
        // table gives its size.
        const off = length > span;
        const tipX = sx(off ? (x / length) * span : x);
        const tipY = sy(off ? (y / length) * span : y);
        // The arrowhead: 8 px back along the arrow, 4 px either side.
        const ux = (tipX - W / 2) / Math.hypot(tipX - W / 2, tipY - H / 2);
        const uy = (tipY - H / 2) / Math.hypot(tipX - W / 2, tipY - H / 2);
        const head = `${tipX},${tipY} ${tipX - 8 * ux - 4 * uy},${tipY - 8 * uy + 4 * ux} ${tipX - 8 * ux + 4 * uy},${tipY - 8 * uy - 4 * ux}`;
        return (
          <g key={kind}>
            <line
              x1={W / 2}
              y1={H / 2}
              x2={tipX - 6 * ux}
              y2={tipY - 6 * uy}
              stroke={colour}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeDasharray={off ? "5 4" : undefined}
            />
            <polygon points={head} fill={colour} />
          </g>
        );
      })}
    </svg>
  );
}

/** Each ball's time, speed and acceleration, by rank, with the components. */
export function MotionTable({
  ranked,
  states,
  time,
}: {
  ranked: RaceTrack[];
  states: Record<CurveKind, BallState>;
  time: number;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  // A component that rounds to nothing shows as 0, not −0.0.
  const n = (value: number, digits: number) =>
    formatNumber(Math.abs(value) < 0.5 * 10 ** -digits ? 0 : value, digits, locale);
  const head = (symbol: string, unit: string, sub?: string) => (
    <th scope="col" className="px-2 py-1 text-right font-normal">
      <span className="italic">{symbol}</span>
      {sub && <sub className="italic">{sub}</sub>}
      <span className="block text-caption text-muted">{unit}</span>
    </th>
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm tabular-nums">
        <caption className="sr-only">{t("experiments.race.motion.table")}</caption>
        <thead className="text-secondary">
          <tr className="border-b border-subtle">
            <th scope="col" className="px-2 py-1 text-left font-normal">
              {t("experiments.race.motion.track")}
            </th>
            <th scope="col" className="px-2 py-1 text-right font-normal">
              {t("experiments.race.motion.time")}
              <span className="block text-caption text-muted">s</span>
            </th>
            {head("|v|", "m/s")}
            {head("v", "m/s", "x")}
            {head("v", "m/s", "y")}
            {head("|a|", "m/s²")}
            {head("a", "m/s²", "x")}
            {head("a", "m/s²", "y")}
          </tr>
        </thead>
        <tbody>
          {ranked.map((track, rank) => {
            const { v, a } = states[track.kind];
            const arrived = time >= track.time_s;
            return (
              <tr key={track.kind} className="border-b border-subtle last:border-0">
                <th scope="row" className="px-2 py-1 text-left font-normal">
                  <span className="flex items-center gap-2">
                    <span className="w-4 text-right text-muted">{rank + 1}.</span>
                    <span
                      aria-hidden
                      className="inline-block size-3 shrink-0 rounded-full"
                      style={{ backgroundColor: hex[TRACK_HUE[track.kind] % hex.length] }}
                    />
                    <span className="whitespace-nowrap text-primary">{t(`experiments.race.curves.${track.kind}`)}</span>
                  </span>
                </th>
                <td className={`px-2 py-1 text-right ${arrived ? "font-semibold text-primary" : "text-muted"}`}>
                  {formatNumber(track.time_s, 3, locale)}
                </td>
                <td className="px-2 py-1 text-right font-semibold text-primary">{n(Math.hypot(v[0], v[1]), 2)}</td>
                <td className="px-2 py-1 text-right text-secondary">{n(v[0], 2)}</td>
                <td className="px-2 py-1 text-right text-secondary">{n(v[1], 2)}</td>
                <td className="px-2 py-1 text-right font-semibold text-primary">{n(Math.hypot(a[0], a[1]), 1)}</td>
                <td className="px-2 py-1 text-right text-secondary">{n(a[0], 1)}</td>
                <td className="px-2 py-1 text-right text-secondary">{n(a[1], 1)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
