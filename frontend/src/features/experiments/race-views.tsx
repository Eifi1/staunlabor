/**
 * The race's two drawings, and where a ball is at a time.
 *
 * Nothing here simulates: the engine (`experiments.race`) answers each track
 * with a time table — where the ball is, how fast and how it accelerates, at
 * each of its 241 times — and the page only looks a time up in it
 * ({@link ballState}). Energy decides the speed at every height, so the table
 * is the whole motion; the browser needs no port of a loop, as the coil and the
 * sphere do. Past the flag the pit's port (`simulate/pit.ts`): the balls fly
 * into a padded pit and heap up at its bottom, a time loop the page runs once
 * per build.
 *
 * * {@link RaceView}: the six tracks from one start to one finish, a ball on
 *   each, the finish's height drawn across so a track that dips below it shows,
 *   and past the flag the pit the balls fly into ({@link raceLayout}).
 * * {@link ValleyView}: a cycloid valley or a circular bowl, four balls let go
 *   together from different heights, swinging on: on the cycloid they meet at
 *   the bottom every time; on the bowl they drift apart.
 */

import type { CurveKind, RaceBasin, RacePath, RaceRun, RaceTrack, ValleyStart } from "@/shared/types";
import { G, type Entry, type PitBall, type PitRun } from "./simulate/pit";
import { STAGE } from "./stage";
import { useChartHex } from "@/shared/state/palette-store";

/** Which palette hue each track is drawn in. */
export const TRACK_HUE: Record<CurveKind, number> = {
  line: 1,
  cycloid: 2,
  circle: 3,
  parabola: 6,
  hyperbola: 7,
  hump: 4,
};

/** Where `t` falls in a time table: the sample before it and how far on to the
 *  next, clamped to the table's ends. */
function sampleAt(ts: number[], t: number): [number, number] {
  const last = ts.length - 1;
  if (t <= 0) return [0, 0];
  if (t >= ts[last]) return [last - 1, 1];
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (ts[mid] <= t) lo = mid;
    else hi = mid;
  }
  return [lo, (t - ts[lo]) / (ts[hi] - ts[lo])];
}

/** `values` between the samples `[lo, f]` names, linearly. */
const between = (values: number[], [lo, f]: [number, number]) => values[lo] + f * (values[lo + 1] - values[lo]);

/** Where the ball on `path` is at `t`: between the two table times around it,
 *  linearly; at the end once it has arrived. */
export function positionAt(path: RacePath, t: number): [number, number] {
  const at = sampleAt(path.t_s, t);
  return [between(path.x_m, at), between(path.y_m, at)];
}

/** A racing ball at one moment: where it is (m), its velocity (m/s) and its
 *  acceleration (m/s²), x to the right and y up. */
export interface BallState {
  at: [number, number];
  v: [number, number];
  a: [number, number];
}

/** A racing ball at `t`, everything the engine's: on its track, the time
 *  table, until it arrives; then in the pit, the run of the pit's port
 *  (`simulate/pit.ts`, held to the engine) — its flight from the finish under
 *  `g` until its first sample, then its samples, until it lies still. (First a
 *  brake the page had made up stopped the balls, then a sand pit where each
 *  lay where it fell; neither was physics, and the pit is.) */
export function ballState(track: RaceTrack, t: number, inPit: PitBall, sampleS: number): BallState {
  const { path, motion } = track;
  const last = path.t_s.length - 1;
  const after = t - path.t_s[last];
  if (after <= 0) {
    const at = sampleAt(path.t_s, t);
    return {
      at: [between(path.x_m, at), between(path.y_m, at)],
      v: [between(motion.vx_m_s, at), between(motion.vy_m_s, at)],
      a: [between(motion.ax_m_s2, at), between(motion.ay_m_s2, at)],
    };
  }
  if (t < inPit.start_s) {
    // Off the track, not yet sampled: the throw, as the pit begins it.
    const [vx, vy] = [motion.vx_m_s[last], motion.vy_m_s[last]];
    return {
      at: [path.x_m[last] + vx * after, path.y_m[last] + vy * after - (G * after * after) / 2],
      v: [vx, vy - G * after],
      a: [0, -G],
    };
  }
  const end = inPit.x_m.length - 1;
  const k = (t - inPit.start_s) / sampleS;
  if (k >= end) return { at: [inPit.x_m[end], inPit.y_m[end]], v: [0, 0], a: [0, 0] };
  const at: [number, number] = [Math.floor(k), k - Math.floor(k)];
  return {
    at: [between(inPit.x_m, at), between(inPit.y_m, at)],
    v: [between(inPit.vx_m_s, at), between(inPit.vy_m_s, at)],
    a: [between(inPit.ax_m_s2, at), between(inPit.ay_m_s2, at)],
  };
}

/** The race's balls as they leave their tracks, for the pit. */
export function pitEntries(tracks: RaceTrack[]): Entry[] {
  return tracks.map((tr) => {
    const last = tr.path.t_s.length - 1;
    return {
      time_s: tr.time_s,
      x_m: tr.path.x_m[last],
      y_m: tr.path.y_m[last],
      vx_m_s: tr.motion.vx_m_s[last],
      vy_m_s: tr.motion.vy_m_s[last],
    };
  });
}

/** How the race is laid out on the page: the frame, the balls' size, and the
 *  pit past the flag, its walls as high as any ball rises in it. */
export interface RaceLayout {
  deepest: number;
  right: number;
  pad: number;
  ball: number;
  basin: RaceBasin;
  wallTop: number;
}

export function raceLayout(drop: number, run: number, race: RaceRun, pit: PitRun): RaceLayout {
  const { basin } = race;
  const ball = race.ball_radius_m;
  const highest = Math.max(...pit.balls.flatMap((b) => b.y_m));
  const wallTop = Math.max(basin.top_y_m, highest + 2 * ball);
  const floor = basin.bottom_y_m - basin.bottom_radius_m;
  const deepest = Math.max(drop, -floor + ball, ...race.tracks.map((tr) => tr.lowest_m));
  return { deepest, right: basin.right_x_m, pad: 0.05 * Math.max(run, deepest), ball, basin, wallTop };
}

/** The pit's lining as an SVG path, y down: down the left side, round the
 *  bottom, up the right side. */
function liningPath(b: RaceBasin): string {
  const s = Math.sin(b.slope_rad);
  const c = Math.cos(b.slope_rad);
  const r = b.bottom_radius_m;
  const meetY = -(b.bottom_y_m - r * c);
  return (
    `M ${b.left_x_m} ${-b.rim_y_m} L ${b.bottom_x_m - r * s} ${meetY} ` +
    `A ${r} ${r} 0 0 0 ${b.bottom_x_m + r * s} ${meetY} L ${b.right_x_m} ${-b.rim_y_m}`
  );
}

/** Where a ball let go on a valley's left side is at `t`, swinging on: down
 *  to the bottom in `T` (the table), up the right side in another `T` (the
 *  table mirrored, backwards in time), and back — a period of `4T`. */
export function swingAt(path: RacePath, t: number): [number, number] {
  const big_t = path.t_s[path.t_s.length - 1];
  const c = ((t % (4 * big_t)) + 4 * big_t) % (4 * big_t);
  if (c < big_t) return positionAt(path, c);
  if (c < 2 * big_t) {
    const [x, y] = positionAt(path, 2 * big_t - c);
    return [-x, y];
  }
  if (c < 3 * big_t) {
    const [x, y] = positionAt(path, c - 2 * big_t);
    return [-x, y];
  }
  return positionAt(path, 4 * big_t - c);
}

export function RaceView({
  tracks,
  drop,
  run,
  layout,
  states,
  label,
}: {
  tracks: RaceTrack[];
  drop: number;
  run: number;
  layout: RaceLayout;
  states: Record<CurveKind, BallState>;
  label: string;
}) {
  const hex = useChartHex();
  const { deepest, right, pad, ball, basin, wallTop } = layout;
  const top = Math.max(0, wallTop);
  const lining = liningPath(basin);
  return (
    <svg
      viewBox={`${-pad} ${-top - pad} ${right + 2 * pad} ${deepest + top + 2 * pad}`}
      role="img"
      aria-label={label}
      className={`w-full ${STAGE.wide} rounded-lg border border-subtle bg-surface-2 text-muted`}
    >
      {/* The finish's height, across, so a track that dips below it shows. */}
      <line
        x1={0}
        y1={drop}
        x2={run}
        y2={drop}
        stroke="currentColor"
        strokeDasharray="4 4"
        opacity={0.6}
        vectorEffect="non-scaling-stroke"
      />
      {/* The pit past the flag: its inside shaded, the padded lining a soft
          broad band under a crisp line, and a wall up from each rim as high
          as any ball rises. */}
      <path d={`${lining} Z`} className="fill-current text-muted" opacity={0.12} />
      <path
        d={lining}
        fill="none"
        className="stroke-current text-warning"
        strokeWidth={7}
        strokeLinejoin="round"
        opacity={0.45}
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={`M ${basin.left_x_m} ${-wallTop} ${lining.slice(1)} L ${basin.right_x_m} ${-wallTop}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1={run}
        y1={drop - 3 * ball}
        x2={run}
        y2={drop + 0.5 * ball}
        stroke="currentColor"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
      <polygon
        points={`${run},${drop - 3 * ball} ${run + 1.6 * ball},${drop - 2.5 * ball} ${run},${drop - 2 * ball}`}
        className="fill-current text-success"
      />
      <circle r={ball * 0.6} className="fill-current text-primary" />
      {tracks.map((track) => (
        <polyline
          key={track.kind}
          points={track.path.x_m.map((x, j) => `${x},${-track.path.y_m[j]}`).join(" ")}
          fill="none"
          stroke={hex[TRACK_HUE[track.kind] % hex.length]}
          strokeWidth={2.5}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {tracks.map((track) => {
        const [x, y] = states[track.kind].at;
        return (
          <g key={`ball-${track.kind}`}>
            <circle
              cx={x}
              cy={-y}
              r={ball}
              fill={hex[TRACK_HUE[track.kind] % hex.length]}
              stroke="currentColor"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            {/* A highlight, up and to the left: a ball, not a disc. */}
            <circle cx={x - 0.35 * ball} cy={-y - 0.35 * ball} r={0.3 * ball} className="fill-surface" opacity={0.6} />
          </g>
        );
      })}
    </svg>
  );
}

/** How far either side of the bottom the bowl reaches at the cycloid's
 *  height: wider than the cycloid, whose sides are steeper. */
const bowlReach = (radius: number, bowl: number) => bowl * Math.sin(Math.acos(1 - (2 * radius) / bowl));

/** The valley's own shape, for drawing: the whole cycloid from cusp to cusp,
 *  or the bowl up to the same height. */
function valleyOutline(kind: "cycloid" | "circle", radius: number, bowl: number): string {
  const points: string[] = [];
  if (kind === "cycloid") {
    for (let j = 0; j <= 200; j++) {
      const th = (2 * Math.PI * j) / 200;
      points.push(`${radius * (th - Math.sin(th)) - radius * Math.PI},${radius * (1 - Math.cos(th))}`);
    }
  } else {
    const top = Math.acos(1 - (2 * radius) / bowl);
    for (let j = 0; j <= 200; j++) {
      const phi = -top + (2 * top * j) / 200;
      points.push(`${bowl * Math.sin(phi)},${2 * radius - bowl * (1 - Math.cos(phi))}`);
    }
  }
  return points.join(" ");
}

export function ValleyView({
  kind,
  starts,
  radius,
  bowl,
  t,
  label,
}: {
  kind: "cycloid" | "circle";
  starts: ValleyStart[];
  radius: number;
  bowl: number;
  t: number;
  label: string;
}) {
  const hex = useChartHex();
  // One frame for both valleys, wide enough for the bowl, so the two compare
  // at a glance and the highest ball on the bowl is not cut off.
  const half = Math.max(Math.PI * radius, bowlReach(radius, bowl)) + 0.05;
  const ball = 0.03 * half;
  return (
    <svg
      viewBox={`${-half} ${-0.06} ${2 * half} ${2 * radius + 0.12}`}
      role="img"
      aria-label={label}
      className={`w-full ${STAGE.wide} rounded-lg border border-subtle bg-surface-2 text-muted`}
    >
      <polyline
        points={valleyOutline(kind, radius, bowl)}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
      {starts.map((start, i) => {
        const [x, y] = swingAt(kind === "cycloid" ? start.cycloid : start.circle, t);
        return (
          <circle
            key={i}
            cx={x}
            cy={-y}
            r={ball}
            fill={hex[[2, 3, 6, 4][i % 4] % hex.length]}
            stroke="currentColor"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </svg>
  );
}
