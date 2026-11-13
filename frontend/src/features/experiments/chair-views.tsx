/**
 * The chair's view: one chamber, the three objects side by side, each seen in
 * perspective from a viewpoint that circles a point inside the chamber — the
 * same turn and tilt for all three. At no turn and no tilt the viewpoint is the
 * hole itself, and the three pictures are one; anywhere else they come apart,
 * and they fall back into one chair the moment the hole's angle is met again.
 *
 * The projection is drawn here rather than in a 3D library because it is the
 * subject: a point's picture is where the line from the viewpoint to it meets
 * a screen a metre in front — `(x/z, y/z)` in the viewpoint's own frame, the
 * same two lines as `perspective.image` in the engine once the viewpoint is
 * the hole. The geometry is the engine's (`GET /experiments/chair`); the
 * browser only turns the viewpoint, which a drag needs at frame rate.
 */

import { useRef, type PointerEvent } from "react";
import type { FigureKind, Peephole, Point3D } from "@/shared/types";
import { useChartHex } from "@/shared/state/palette-store";

/** Which palette hue each object is drawn in. */
const HUE: Record<FigureKind, number> = { chair: 2, skewed: 3, scattered: 4 };

/** The hole, where the engine's eye is. */
export const HOLE: Point3D = [0, 0, 0];

/** The point the viewpoint circles: half a metre into the chamber, at the
 *  chair's middle height, so all three objects stay in front of it whichever
 *  way it turns. */
export const PIVOT: Point3D = [0, -0.08, 0.5];

/** A viewpoint: where it is and the three directions of its frame. */
export interface Camera {
  at: Point3D;
  forward: Point3D;
  right: Point3D;
  up: Point3D;
}

const sub = (a: Point3D, b: Point3D): Point3D => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Point3D, b: Point3D) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Point3D, b: Point3D): Point3D => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (a: Point3D): Point3D => {
  const n = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / n, a[1] / n, a[2] / n];
};

/** The viewpoint turned `yawDeg` round the vertical through the pivot and
 *  tilted `pitchDeg` over it, looking at the pivot. At zero and zero it is the
 *  hole. */
export function cameraAt(yawDeg: number, pitchDeg: number): Camera {
  const yaw = (yawDeg * Math.PI) / 180;
  const pitch = (pitchDeg * Math.PI) / 180;
  // The hole as seen from the pivot, tilted about the horizontal and then
  // turned about the vertical.
  const [hx, hy, hz] = sub(HOLE, PIVOT);
  const y1 = hy * Math.cos(pitch) - hz * Math.sin(pitch);
  const z1 = hy * Math.sin(pitch) + hz * Math.cos(pitch);
  const x2 = hx * Math.cos(yaw) + z1 * Math.sin(yaw);
  const z2 = -hx * Math.sin(yaw) + z1 * Math.cos(yaw);
  const at: Point3D = [PIVOT[0] + x2, PIVOT[1] + y1, PIVOT[2] + z2];
  const forward = unit(sub(PIVOT, at));
  const right = unit(cross([0, 1, 0], forward));
  const up = cross(forward, right);
  return { at, forward, right, up };
}

/** Where `p` lands on a screen a metre in front of the viewpoint, or null
 *  for a point at or behind it. */
export function project(p: Point3D, camera: Camera): [number, number] | null {
  const d = sub(p, camera.at);
  const z = dot(d, camera.forward);
  if (z <= 1e-6) return null;
  return [dot(d, camera.right) / z, dot(d, camera.up) / z];
}

/** The square, in screen units, that holds the chair through the hole with
 *  room to turn: one frame for all three views and every turn, so they
 *  compare at a glance and nothing jumps. */
export function frameOf(peephole: Peephole, room = 1.6): number {
  const camera = cameraAt(0, 0);
  const points = peephole.figure.segments
    .flatMap((s) => [project(s.a, camera), project(s.b, camera)])
    .filter((p): p is [number, number] => p !== null);
  return Math.max(...points.map((p) => Math.max(Math.abs(p[0]), Math.abs(p[1])))) * room;
}

/** How far a drag turns the views: half a degree per pixel. */
const DEGREES_PER_PIXEL = 0.5;

/** One object in its part of the chamber, from the shared viewpoint. Dragged,
 *  it turns all three: sideways on any pointer, up and down with a mouse (a
 *  finger's vertical drag is left to the page, so a phone still scrolls). */
export function OrbitView({
  peephole,
  yaw,
  pitch,
  half,
  onTurn,
  label,
}: {
  peephole: Peephole;
  yaw: number;
  pitch: number;
  half: number;
  onTurn: (yaw: number, pitch: number) => void;
  label: string;
}) {
  const hex = useChartHex();
  const drag = useRef<{ x: number; y: number; yaw: number; pitch: number; mouse: boolean } | null>(null);
  const camera = cameraAt(yaw, pitch);
  const colour = hex[HUE[peephole.figure.kind] % hex.length];
  const line = (a: Point3D, b: Point3D): [number, number, number, number] | null => {
    const pa = project(a, camera);
    const pb = project(b, camera);
    return pa && pb ? [pa[0], -pa[1], pb[0], -pb[1]] : null;
  };
  const hole = project(HOLE, camera);

  const down = (e: PointerEvent<SVGSVGElement>) => {
    drag.current = { x: e.clientX, y: e.clientY, yaw, pitch, mouse: e.pointerType === "mouse" };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const move = (e: PointerEvent<SVGSVGElement>) => {
    const start = drag.current;
    if (!start) return;
    let next = start.yaw + (e.clientX - start.x) * DEGREES_PER_PIXEL;
    next = ((((next + 180) % 360) + 360) % 360) - 180;
    const tilt = start.mouse
      ? Math.max(-60, Math.min(60, start.pitch + (e.clientY - start.y) * DEGREES_PER_PIXEL))
      : start.pitch;
    onTurn(next, tilt);
  };
  const up = () => {
    drag.current = null;
  };

  return (
    <svg
      viewBox={`${-half} ${-half} ${2 * half} ${2 * half}`}
      role="img"
      aria-label={label}
      className="aspect-square w-full cursor-grab touch-pan-y rounded-lg border border-subtle bg-surface-2 text-muted active:cursor-grabbing"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      {peephole.sight_lines.map((s, i) => {
        const l = line(s.a, s.b);
        return (
          l && (
            <line
              key={`sight-${i}`}
              x1={l[0]}
              y1={l[1]}
              x2={l[2]}
              y2={l[3]}
              stroke="currentColor"
              strokeWidth={1}
              strokeDasharray="3 4"
              opacity={0.6}
              vectorEffect="non-scaling-stroke"
            />
          )
        );
      })}
      {peephole.figure.segments.map((s, i) => {
        const l = line(s.a, s.b);
        return (
          l && (
            <line
              key={`rod-${i}`}
              x1={l[0]}
              y1={l[1]}
              x2={l[2]}
              y2={l[3]}
              stroke={colour}
              strokeWidth={3}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          )
        );
      })}
      {hole && <circle cx={hole[0]} cy={-hole[1]} r={half * 0.025} className="fill-current text-primary" />}
    </svg>
  );
}
