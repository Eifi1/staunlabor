/**
 * A chain of inertias turning: a disc with a pointer per inertia, a zigzag per
 * spring, and under each spring a bar for how much it is twisted right now.
 *
 * What it draws are the engine's complex amplitudes — a forced response's
 * phasors, or a mode shape's real entries — turned in **slow motion at a fixed
 * period of two seconds**, whatever the physical frequency: a 40 Hz mode is
 * not something an eye can follow, and the point is the *shape* (which way each
 * inertia turns against its neighbour), not the speed. The pointers are scaled
 * so the largest amplitude swings ±60°.
 *
 * Pausable, and paused from the start for a reader who asked for reduced
 * motion; the frame shown then is the instant of largest deflection.
 */

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pause, Play } from "lucide-react";
import { IconButton, prefersReducedMotion } from "@eifi1/ui-kit";
import { useChartHex } from "@/shared/state/palette-store";
import type { Phasor } from "@/shared/types";
import { HUE } from "./colours";

const PERIOD_MS = 2000;
const SWING_DEG = 60;

export function ChainAnimation({
  phasors,
  names,
  groundLeft = false,
  groundRight = false,
  highlight,
  label,
}: {
  phasors: Phasor[];
  names: string[];
  groundLeft?: boolean;
  groundRight?: boolean;
  /** Which inertia is the test object, drawn in its colour. */
  highlight?: number;
  label: string;
}) {
  const { t } = useTranslation();
  const hex = useChartHex();
  const [playing, setPlaying] = useState(() => !prefersReducedMotion());
  const [phase, setPhase] = useState(0);
  // Where a pause left the turn, so playing again resumes there; written by
  // the button, read by the clock below.
  const resumeAt = useRef(0);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const start = performance.now() - (resumeAt.current / (2 * Math.PI)) * PERIOD_MS;
    const tick = (now: number) => {
      setPhase((((now - start) % PERIOD_MS) / PERIOD_MS) * 2 * Math.PI);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  const biggest = Math.max(1e-30, ...phasors.map((p) => p.magnitude));
  const angles = phasors.map(
    (p) => (p.magnitude / biggest) * SWING_DEG * Math.cos(phase + (p.phase_deg * Math.PI) / 180),
  );
  const n = phasors.length;
  const W = 120 + n * 110;
  const H = 170;
  const cx = (i: number) => 70 + i * 110 + (groundLeft ? 20 : 0);
  const cy = 70;
  const R = 26;

  const spring = (x1: number, x2: number) => {
    const zigs = 6;
    const pts = [`${x1},${cy}`];
    for (let k = 1; k < zigs * 2; k++) {
      const x = x1 + ((x2 - x1) * k) / (zigs * 2);
      pts.push(`${x},${cy + (k % 2 ? -8 : 8)}`);
    }
    pts.push(`${x2},${cy}`);
    return pts.join(" ");
  };
  const springs: { from: number; to: number; twist: number }[] = [];
  if (groundLeft) springs.push({ from: 12, to: cx(0) - R, twist: angles[0] });
  for (let i = 0; i < n - 1; i++)
    springs.push({ from: cx(i) + R, to: cx(i + 1) - R, twist: angles[i] - angles[i + 1] });
  if (groundRight) springs.push({ from: cx(n - 1) + R, to: W - 12, twist: angles[n - 1] });
  const width = groundRight ? W : W - 40;

  return (
    <div className="space-y-1">
      <div className="overflow-x-auto">
        {/* No wider than about one and a half times its own units: two discs
            drawn across a whole column would be a poster. */}
        <svg
          viewBox={`0 0 ${width} ${H}`}
          role="img"
          aria-label={label}
          className="mx-auto w-full min-w-[20rem]"
          style={{ maxWidth: `${Math.round(width * 1.5)}px` }}
        >
          {groundLeft && <line x1={10} y1={cy - 30} x2={10} y2={cy + 30} className="stroke-strong" strokeWidth={4} />}
          {groundRight && (
            <line x1={width - 10} y1={cy - 30} x2={width - 10} y2={cy + 30} className="stroke-strong" strokeWidth={4} />
          )}
          {springs.map((s, k) => {
            const mid = (s.from + s.to) / 2;
            const bar = (Math.abs(s.twist) / (2 * SWING_DEG)) * 40;
            return (
              <g key={k}>
                <polyline points={spring(s.from, s.to)} fill="none" className="stroke-secondary" strokeWidth={1.5} />
                <rect x={mid - 6} y={H - 30 - bar} width={12} height={bar} fill={hex[HUE.second]} opacity={0.8} />
                <line x1={mid - 10} y1={H - 30} x2={mid + 10} y2={H - 30} className="stroke-subtle" />
              </g>
            );
          })}
          {phasors.map((_, i) => {
            const a = (angles[i] * Math.PI) / 180;
            const colour = i === highlight ? hex[HUE.object] : hex[HUE.measuring];
            return (
              <g key={i}>
                <circle cx={cx(i)} cy={cy} r={R} className="fill-surface" stroke={colour} strokeWidth={2.5} />
                <line
                  x1={cx(i)}
                  y1={cy}
                  x2={cx(i) + R * Math.sin(a)}
                  y2={cy - R * Math.cos(a)}
                  stroke={colour}
                  strokeWidth={3}
                  strokeLinecap="round"
                />
                <text x={cx(i)} y={cy + R + 16} textAnchor="middle" className="fill-secondary" fontSize={11}>
                  {names[i]}
                </text>
              </g>
            );
          })}
          <text x={8} y={H - 8} className="fill-muted" fontSize={10}>
            {t("course.animation.twist")}
          </text>
        </svg>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted">
        <IconButton
          size="sm"
          label={playing ? t("course.animation.pause") : t("course.animation.play")}
          onClick={() => {
            resumeAt.current = phase;
            setPlaying(!playing);
          }}
        >
          {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
        </IconButton>
        {t("course.animation.slow")}
      </div>
    </div>
  );
}
