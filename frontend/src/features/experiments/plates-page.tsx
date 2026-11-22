import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDown } from "lucide-react";
import { Button, LoadingState, ToggleGroup } from "@eifi1/ui-kit";
import { SeriesChart } from "@/shared/charts/series-chart";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber } from "@/shared/lib/format";
import { useChartHue } from "@/shared/state/palette-store";
import { SliderField } from "@/shared/ui/slider-field";
import { Figures, WidgetCard } from "@/shared/ui/widget";
import { Equation } from "./equation";
import { ExhibitFrame } from "./exhibit-frame";
import { BuildPending } from "./build-pending";
import { PreviewPending, type PreviewMode, type PreviewProps } from "./preview-mode";
import { fallTimeS, figures, motion, stream, type MagnetColumn, type Material, type Plate } from "./simulate/plates";
import { SIDE, VIEW_FRAME } from "./stage";
import { useExperimentsDefaults } from "./use-experiments";
import { settingNumber, useTakeCheckRequest } from "./check-setting";
import { useFrameLoop, useRunning } from "./play";
import { RestartButton, RunPauseButton, SpeedToggle } from "./play-controls";
import { G } from "./simulate/constants";

/** Real time, and a quarter of it for the plastic plate, which is gone in a blink. */
const SPEEDS = [1, 0.25] as const;
type Speed = (typeof SPEEDS)[number];

/** The exhibit's four, as the page names them. */
const KINDS = ["copper", "aluminium", "slotted", "plastic"] as const;
type Kind = (typeof KINDS)[number];
const MATERIAL_CHOICES: Material[] = ["copper", "aluminium", "brass", "plastic"];

/** The preview holds the plates at the top for a moment, lets them go and,
 *  when the slowest is down, holds them there a moment too. */
const PREVIEW_HOLD_S = 1;
const PREVIEW_DOWN_S = 1.5;

/** The column as drawn: its top, its height and the lanes' middles, in the drawing's units. */
const VIEW = { width: 260, height: 196, top: 8, column: 176, lanes: [35, 98, 162, 225], magnet: 4 } as const;

/** The close-up's canvas, in pixels: the plate drawn at 2000 px a metre in its middle. */
const CLOSE = { width: 300, height: 300, scale: 2000, cell: 4, terms: 12 } as const;

const NORTH_HUE = 4;
const SOUTH_HUE = 0;
const COPPER_HUE = 3;
const ANTICLOCKWISE_HUE = 2;
const CLOCKWISE_HUE = 1;
const SLOTTED_HUE = 2;
const WHOLE_HUE = 3;
const FREE_HUE = 6;

/** The eddy currents' own field over the magnets' above which the page says
 *  the computation, which leaves it out, is stretched. */
const REACTION_SMALL = 0.1;

/** Tooth heights the build's chart runs over, in mm. */
const TEETH_MM = Array.from({ length: 59 }, (_, k) => k + 2);
/** Fields the trick's chart runs over, in T. */
const FIELDS_T = Array.from({ length: 36 }, (_, k) => 0.05 + k * 0.01);

const kindOf = (plate: Plate): Kind =>
  plate.tooth_m > 0
    ? "slotted"
    : plate.material === "copper" || plate.material === "plastic"
      ? plate.material
      : "aluminium";

function rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/**
 * The falling plates (`experiments.plates`): copper, aluminium, slotted
 * aluminium and plastic dropped between magnets, their fall and their eddy
 * currents from the browser port (`simulate/plates.ts`, held to the engine by
 * `simulate.test.ts`). No route.
 */
export function PlatesPage() {
  const { t } = useTranslation();
  const defaults = useExperimentsDefaults();
  const [build, setBuild] = useState<{ column: MagnetColumn; plate: Plate } | null>(null);
  const data = defaults.data?.plates;
  const column = build?.column ?? data?.column ?? null;
  const plate = build?.plate ?? data?.plate ?? null;
  // A check case's "Set it up": the column and the plate; a new column builds
  // the race anew.
  useTakeCheckRequest("plates", column && plate ? { column, plate } : null, (s, { column, plate }) => {
    const material = typeof s.material === "string" ? (s.material as Plate["material"]) : plate.material;
    setBuild({
      column: {
        ...column,
        field_t: settingNumber(s, "field_t", column.field_t),
        pitch_m: settingNumber(s, "pitch_m", column.pitch_m),
      },
      plate: {
        ...plate,
        material,
        thickness_m: settingNumber(s, "thickness_m", plate.thickness_m),
        tooth_m: settingNumber(s, "tooth_m", plate.tooth_m),
      },
    });
  });
  return (
    <ExhibitFrame
      exhibit="plates"
      atTheExhibit={
        <>
          <p>{t("experiments.plates.at.build")}</p>
          <p>{t("experiments.plates.at.drop")}</p>
          <p>{t("experiments.plates.at.slots")}</p>
        </>
      }
      whatHappens={<PlatesModel />}
      computed={<PlatesComputed />}
      sweetSpot={
        column && data ? (
          <PlatesTrick column={column} plates={data.exhibit} />
        ) : (
          <LoadingState className="py-6" label={t("common.loading")} />
        )
      }
    >
      {defaults.isPending || !column || !plate || !data ? (
        <BuildPending pending={defaults.isPending} error={defaults.error} />
      ) : (
        <>
          {/* A new column is a new start: the plates go back to the top. */}
          <PlatesPlay key={JSON.stringify(column)} column={column} plates={data.exhibit} />
          <PlatesBuild column={column} plate={plate} onChange={setBuild} />
        </>
      )}
    </ExhibitFrame>
  );
}

/** The four let go, down, and back at the top, again and again. */
export function PlatesPreview({ paused }: PreviewProps) {
  const defaults = useExperimentsDefaults();
  const data = defaults.data?.plates;
  return data ? <PlatesPlay column={data.column} plates={data.exhibit} preview paused={paused} /> : <PreviewPending />;
}

/** The column from the front, its magnets beside each lane, north and south in turn. */
function LanesView({ column, plates, fallen }: { column: MagnetColumn; plates: Plate[]; fallen: number[] }) {
  const { t } = useTranslation();
  const hue = useChartHue();
  const height = column.drop_m + Math.max(...plates.map((p) => p.height_m));
  const scale = VIEW.column / height;
  const half = column.pitch_m / 2;
  const magnets = useMemo(() => {
    const blocks: { y: number; h: number; north: boolean }[] = [];
    // Block i is centred where the field is strongest, cos(k·z) = ±1: z = i·λ/2.
    for (let i = 0; i * half - half / 2 < height; i++) {
      const from = Math.max(0, i * half - half / 2);
      const to = Math.min(height, i * half + half / 2);
      blocks.push({ y: VIEW.top + from * scale, h: (to - from) * scale, north: i % 2 === 0 });
    }
    return blocks;
  }, [half, height, scale]);
  return (
    <svg
      viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
      role="img"
      aria-label={t("experiments.plates.view")}
      className={VIEW_FRAME}
    >
      {VIEW.lanes.map((x, lane) => {
        const plate = plates[lane];
        const kind = kindOf(plate);
        const w = plate.width_m * scale;
        const h = plate.height_m * scale;
        const y = VIEW.top + fallen[lane] * scale;
        const left = x - w / 2;
        const gap = w / 2 + 2;
        return (
          <g key={kind}>
            {[-1, 1].map((side) =>
              magnets.map((b, i) => (
                <rect
                  key={`${side}-${i}`}
                  x={side < 0 ? x - gap - VIEW.magnet : x + gap}
                  y={b.y}
                  width={VIEW.magnet}
                  height={b.h}
                  fill={hue(b.north ? NORTH_HUE : SOUTH_HUE)}
                  fillOpacity={0.75}
                />
              )),
            )}
            <rect
              x={left}
              y={y}
              width={w}
              height={h}
              rx={0.8}
              fill={kind === "copper" ? hue(COPPER_HUE) : "currentColor"}
              fillOpacity={kind === "plastic" ? 0.08 : kind === "copper" ? 0.9 : 0.5}
              stroke="currentColor"
              strokeWidth={1}
              strokeDasharray={kind === "plastic" ? "2 1.5" : undefined}
              vectorEffect="non-scaling-stroke"
            />
            {kind === "slotted" &&
              Array.from({
                length: Math.floor((plate.height_m + plate.slot_m) / (plate.tooth_m + plate.slot_m)) - 1,
              }).map((_, j) => {
                const sy = y + h - ((j + 1) * (plate.tooth_m + plate.slot_m) - plate.slot_m / 2) * scale;
                return (
                  <line
                    key={j}
                    x1={left + 1.5}
                    y1={sy}
                    x2={left + w}
                    y2={sy}
                    className="stroke-current text-primary"
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            <text x={x} y={VIEW.height - 3} fontSize={7} textAnchor="middle" fill="currentColor">
              {t(`experiments.plates.short.${kind}`)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** The current lines drawn up close: these shares of the strongest loop's stream function. */
const LOOP_LEVELS = [0.15, 0.45, 0.75];

/** Where a grid of values (`cols` × `rows` nodes, row by row) crosses `level`,
 *  by marching squares: line segments `[x0, y0, x1, y1]` in nodes. A square
 *  crossed four times (a saddle) is joined one way, which a drawing allows. */
function contour(values: number[], cols: number, rows: number, level: number): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  const at = (i: number, j: number) => values[j * cols + i] - level;
  for (let j = 0; j + 1 < rows; j++)
    for (let i = 0; i + 1 < cols; i++) {
      const a = at(i, j);
      const b = at(i + 1, j);
      const c = at(i + 1, j + 1);
      const d = at(i, j + 1);
      const points: [number, number][] = [];
      if (a > 0 !== b > 0) points.push([i + a / (a - b), j]);
      if (b > 0 !== c > 0) points.push([i + 1, j + b / (b - c)]);
      if (d > 0 !== c > 0) points.push([i + d / (d - c), j + 1]);
      if (a > 0 !== d > 0) points.push([i, j + a / (a - d)]);
      if (points.length >= 2) out.push([...points[0], ...points[1]]);
      if (points.length === 4) out.push([...points[2], ...points[3]]);
    }
  return out;
}

/** One plate up close, riding along with it: the magnets' field passing behind
 *  it in bands, and its eddy currents in front, coloured by the way they turn. */
function CloseUp({
  column,
  plate,
  fallen,
  speed,
  label,
}: {
  column: MagnetColumn;
  plate: Plate;
  fallen: number;
  speed: number;
  label: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const hue = useChartHue();
  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext?.("2d");
    if (!el || !ctx) return;
    const { width, height, scale, cell, terms } = CLOSE;
    const plateW = plate.width_m * scale;
    const plateH = plate.height_m * scale;
    const left = (width - plateW) / 2;
    const top = (height - plateH) / 2;
    const k = (2 * Math.PI) / column.pitch_m;
    ctx.clearRect(0, 0, width, height);
    // The field behind the plate, row by row: north one colour, south the other, as strong as it is.
    for (let row = 0; row < height; row += 2) {
      const field = Math.cos(k * (fallen + (row + 1 - top) / scale));
      ctx.fillStyle = rgba(hue(field >= 0 ? NORTH_HUE : SOUTH_HUE), 0.22 * Math.abs(field));
      ctx.fillRect(0, row, width, 2);
    }
    const style = getComputedStyle(el);
    const ink = style.color || "#888888";
    // The plate hides the field behind it: the card's colour first, then the metal's tint.
    ctx.fillStyle = style.getPropertyValue("--bg-surface").trim() || "#ffffff";
    ctx.fillRect(left, top, plateW, plateH);
    ctx.fillStyle = plate.material === "copper" ? rgba(hue(COPPER_HUE), 0.3) : ink;
    if (plate.material !== "copper") ctx.globalAlpha = plate.material === "plastic" ? 0.04 : 0.14;
    ctx.fillRect(left, top, plateW, plateH);
    ctx.globalAlpha = 1;
    // The currents, from the stream function at the grid's nodes, the edges'
    // included (zero there): faintly filled, and their lines drawn, which close
    // into loops inside the plate or each tooth.
    const cols = Math.round(plateW / cell);
    const rows = Math.round(plateH / cell);
    const values: number[] = [];
    let peak = 0;
    for (let j = 0; j <= rows; j++)
      for (let i = 0; i <= cols; i++) {
        const psi = stream(
          column,
          plate,
          fallen,
          speed,
          (i * cell - plateW / 2) / scale,
          plate.height_m - (j * cell) / scale,
          terms,
        );
        values.push(psi);
        peak = Math.max(peak, Math.abs(psi));
      }
    if (peak > 0) {
      const at = (i: number, j: number) => values[j * (cols + 1) + i];
      for (let j = 0; j < rows; j++)
        for (let i = 0; i < cols; i++) {
          const psi = (at(i, j) + at(i + 1, j) + at(i, j + 1) + at(i + 1, j + 1)) / 4;
          ctx.fillStyle = rgba(hue(psi > 0 ? ANTICLOCKWISE_HUE : CLOCKWISE_HUE), (0.3 * Math.abs(psi)) / peak);
          ctx.fillRect(left + i * cell, top + j * cell, cell, cell);
        }
      ctx.lineWidth = 1.6;
      for (const share of LOOP_LEVELS) {
        for (const sign of [1, -1]) {
          ctx.strokeStyle = hue(sign > 0 ? ANTICLOCKWISE_HUE : CLOCKWISE_HUE);
          ctx.beginPath();
          for (const [x0, y0, x1, y1] of contour(values, cols + 1, rows + 1, sign * share * peak)) {
            ctx.moveTo(left + x0 * cell, top + y0 * cell);
            ctx.lineTo(left + x1 * cell, top + y1 * cell);
          }
          ctx.stroke();
        }
      }
    }
    // The slots, cut from the right edge to a spine at the left, and the plate's outline.
    if (plate.tooth_m > 0) {
      ctx.fillStyle = style.getPropertyValue("--bg-surface-2").trim() || "#ffffff";
      const pitch = plate.tooth_m + plate.slot_m;
      for (let y = plate.tooth_m; y + plate.slot_m <= plate.height_m; y += pitch)
        ctx.fillRect(left + 3, top + plateH - (y + plate.slot_m) * scale, plateW - 3, plate.slot_m * scale);
    }
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.5;
    if (plate.material === "plastic") ctx.setLineDash([5, 4]);
    ctx.strokeRect(left, top, plateW, plateH);
    ctx.setLineDash([]);
  }, [column, plate, fallen, speed, hue]);
  return (
    <canvas
      ref={canvas}
      width={CLOSE.width}
      height={CLOSE.height}
      role="img"
      aria-label={label}
      className={`aspect-square ${VIEW_FRAME}`}
    />
  );
}

function Legend() {
  const { t } = useTranslation();
  const hue = useChartHue();
  const items = [
    { key: "north", hue: NORTH_HUE },
    { key: "south", hue: SOUTH_HUE },
    { key: "anticlockwise", hue: ANTICLOCKWISE_HUE },
    { key: "clockwise", hue: CLOCKWISE_HUE },
  ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted">
      {items.map((item) => (
        <li key={item.key} className="flex items-center gap-1">
          <span aria-hidden className="inline-block size-2 rounded-full" style={{ backgroundColor: hue(item.hue) }} />
          {t(`experiments.plates.play.legend.${item.key}`)}
        </li>
      ))}
    </ul>
  );
}

function PlatesPlay({
  column,
  plates,
  preview = false,
  paused = false,
}: { column: MagnetColumn; plates: Plate[] } & PreviewMode) {
  const { t } = useTranslation();
  const locale = useLocale();
  const clock = useRef(0);
  const [time, setTime] = useState(0);
  const [dropped, setDropped] = useState(false);
  const { running: on, setRunning } = useRunning({ preview, paused, initially: false });
  const [speedHere, setSpeed] = useState<Speed>(1);
  const [look, setLook] = useState<Kind>("copper");
  const falls = useMemo(() => plates.map((p) => fallTimeS(column, p)), [column, plates]);
  const slowest = Math.max(...falls);
  const loop = PREVIEW_HOLD_S + slowest + PREVIEW_DOWN_S;
  // Once the slowest is down there is nothing left to draw: the clock stops.
  const running = preview ? on : dropped && on && time < slowest;
  const speed = preview ? 1 : speedHere;

  useFrameLoop(running, (dt) => {
    clock.current += dt * speed;
    setTime(clock.current);
  });

  // The run's time: negative while the plates are held at the top.
  const runTime = preview ? (time % loop) - PREVIEW_HOLD_S : dropped ? time : -1;
  const states = plates.map((p, i) => (runTime >= falls[i] ? [column.drop_m, 0] : motion(column, p, runTime)));
  const lanes = <LanesView column={column} plates={plates} fallen={states.map((s) => s[0])} />;
  if (preview) return lanes;

  const chosen = KINDS.indexOf(look);
  const reset = () => {
    clock.current = 0;
    setTime(0);
    setDropped(false);
    setRunning(false);
  };
  return (
    <WidgetCard
      title={t("experiments.plates.play.title")}
      hint={t("experiments.plates.play.hint")}
      actions={
        dropped ? (
          <>
            {time < slowest && <RunPauseButton running={on} onToggle={() => setRunning(!on)} />}
            <RestartButton onClick={reset} label={t("experiments.plates.play.top")} />
          </>
        ) : (
          <Button
            size="sm"
            onClick={() => {
              setDropped(true);
              setRunning(true);
            }}
          >
            <ArrowDown className="size-4" aria-hidden />
            {t("experiments.plates.play.drop")}
          </Button>
        )
      }
    >
      <div className={`${SIDE.grid} ${SIDE.cap["2xl"]}`}>
        <div className={`${SIDE.top} flex flex-wrap gap-4`}>
          <SpeedToggle speeds={SPEEDS} value={speedHere} onChange={setSpeed} />
          <ToggleGroup
            label={t("experiments.plates.play.look")}
            labelPlacement="above"
            size="sm"
            overflow="wrap"
            value={look}
            onChange={(v: string) => setLook(v as Kind)}
            options={KINDS.map((k) => ({ value: k, label: t(`experiments.plates.short.${k}`) }))}
          />
        </div>
        <div className={`${SIDE.views} mx-auto w-full max-w-2xl`}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <figure className="space-y-1">
              {lanes}
              <figcaption className="text-center text-caption text-muted">
                {t("experiments.plates.play.caption", {
                  drop: formatNumber(column.drop_m * 100, 0, locale),
                  field: formatNumber(column.field_t, 2, locale),
                })}
              </figcaption>
            </figure>
            <figure className="space-y-1">
              <CloseUp
                column={column}
                plate={plates[chosen]}
                fallen={states[chosen][0]}
                speed={states[chosen][1]}
                label={t("experiments.plates.closeup", { plate: t(`experiments.plates.short.${look}`) })}
              />
              <figcaption className="text-center text-caption text-muted">
                {t(look === "plastic" ? "experiments.plates.play.none" : "experiments.plates.play.closeup_caption")}
              </figcaption>
            </figure>
          </div>
          {!dropped && (
            <p className="text-sm text-secondary" role="status">
              {t("experiments.plates.play.waiting")}
            </p>
          )}
        </div>
        <div className={SIDE.column}>
          <Legend />
          <Figures
            title={t("experiments.plates.play.watch")}
            tiles={falls.map((fall, i) => ({
              key: KINDS[i],
              label: t(`experiments.plates.short.${KINDS[i]}`),
              value: Math.min(Math.max(0, runTime), fall),
              digits: 2,
              unit: "s",
            }))}
          />
        </div>
      </div>
    </WidgetCard>
  );
}

function PlatesBuild({
  column,
  plate,
  onChange,
}: {
  column: MagnetColumn;
  plate: Plate;
  onChange: (next: { column: MagnetColumn; plate: Plate }) => void;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hue = useChartHue();
  const shown = useMemo(() => figures(column, plate), [column, plate]);
  const free = Math.sqrt((2 * column.drop_m) / G);
  const slotted = plate.tooth_m > 0;
  const set = (next: Partial<MagnetColumn>, nextPlate: Partial<Plate> = {}) =>
    onChange({ column: { ...column, ...next }, plate: { ...plate, ...nextPlate } });
  // The time through the column rather than the terminal speed: fine teeth
  // would reach theirs only far below the column's end.
  const rows = useMemo(() => {
    if (plate.material === "plastic") return [];
    const whole = fallTimeS(column, { ...plate, tooth_m: 0 });
    return TEETH_MM.map((mm) => ({ mm, slotted: fallTimeS(column, { ...plate, tooth_m: mm / 1000 }), whole, free }));
  }, [column, plate, free]);
  return (
    <WidgetCard title={t("experiments.plates.change.title")} hint={t("experiments.plates.change.hint")}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SliderField
          label={t("experiments.plates.change.field")}
          unit="T"
          value={column.field_t}
          min={0.05}
          max={0.4}
          step={0.01}
          digits={2}
          hint={t("experiments.plates.change.field_hint")}
          onChange={(v) => set({ field_t: v })}
        />
        <SliderField
          label={t("experiments.plates.change.magnet")}
          unit="mm"
          value={(column.pitch_m / 2) * 1000}
          min={10}
          max={50}
          step={1}
          digits={0}
          hint={t("experiments.plates.change.magnet_hint")}
          onChange={(v) => set({ pitch_m: (2 * v) / 1000 })}
        />
        <SliderField
          label={t("experiments.plates.change.thickness")}
          unit="mm"
          value={plate.thickness_m * 1000}
          min={1}
          max={10}
          step={0.5}
          digits={1}
          hint={t("experiments.plates.change.thickness_hint")}
          onChange={(v) => set({}, { thickness_m: v / 1000 })}
        />
        {slotted && (
          <SliderField
            label={t("experiments.plates.change.tooth")}
            unit="mm"
            value={plate.tooth_m * 1000}
            min={2}
            max={60}
            step={1}
            digits={0}
            hint={t("experiments.plates.change.tooth_hint")}
            onChange={(v) => set({}, { tooth_m: v / 1000 })}
          />
        )}
      </div>
      <div className="flex flex-wrap gap-4">
        <ToggleGroup
          label={t("experiments.plates.change.material")}
          labelPlacement="above"
          size="sm"
          overflow="wrap"
          value={plate.material}
          onChange={(v: string) => set({}, { material: v as Material })}
          options={MATERIAL_CHOICES.map((m) => ({ value: m, label: t(`experiments.plates.materials.${m}`) }))}
        />
        <ToggleGroup
          label={t("experiments.plates.change.slots")}
          labelPlacement="above"
          size="sm"
          overflow="wrap"
          value={slotted ? "slotted" : "whole"}
          onChange={(v: string) => set({}, { tooth_m: v === "slotted" ? 0.008 : 0 })}
          options={(["whole", "slotted"] as const).map((s) => ({
            value: s,
            label: t(`experiments.plates.change.cut.${s}`),
          }))}
        />
      </div>
      <p className="text-sm font-medium text-primary" role="status">
        {shown.terminal_m_s === null
          ? t("experiments.plates.change.free", { time: formatNumber(shown.fall_time_s, 2, locale) })
          : t("experiments.plates.change.status", {
              time: formatNumber(shown.fall_time_s, 1, locale),
              times: formatNumber(shown.fall_time_s / free, shown.fall_time_s / free < 10 ? 1 : 0, locale),
            })}
      </p>
      {shown.reaction !== null && shown.reaction > REACTION_SMALL && (
        <p className="text-sm text-secondary">
          {t("experiments.plates.change.reaction", { share: formatNumber(shown.reaction * 100, 0, locale) })}
        </p>
      )}
      <Figures
        tiles={[
          { key: "fall", label: t("experiments.plates.figures.fall"), value: shown.fall_time_s, digits: 2, unit: "s" },
          {
            key: "terminal",
            label: t("experiments.plates.figures.terminal"),
            value: shown.terminal_m_s === null ? null : shown.terminal_m_s * 100,
            digits: 1,
            unit: "cm/s",
          },
          {
            key: "share",
            label: t("experiments.plates.figures.share"),
            value: shown.share === null ? null : shown.share * 100,
            digits: 0,
            unit: "%",
          },
          {
            key: "mass",
            label: t("experiments.plates.figures.mass"),
            value: shown.mass_kg * 1000,
            digits: 0,
            unit: "g",
          },
          { key: "heat", label: t("experiments.plates.figures.heat"), value: shown.heat_w, digits: 2, unit: "W" },
          {
            key: "tau",
            label: t("experiments.plates.figures.tau"),
            value: shown.time_constant_s === null ? null : shown.time_constant_s * 1000,
            digits: 0,
            unit: "ms",
          },
        ]}
      />
      {rows.length > 0 ? (
        <>
          <p className="text-sm text-secondary">{t("experiments.plates.chart.teeth_hint")}</p>
          <SeriesChart
            rows={rows}
            series={[
              { key: "slotted", label: t("experiments.plates.chart.slotted"), color: hue(SLOTTED_HUE) },
              {
                key: "whole",
                label: t("experiments.plates.chart.whole"),
                color: hue(WHOLE_HUE),
                dashed: true,
              },
              {
                key: "free",
                label: t("experiments.plates.chart.free"),
                color: hue(FREE_HUE),
                dashed: true,
              },
            ]}
            axes={[
              {
                id: "y",
                title: `${t("experiments.plates.chart.fall")} (s)`,
                format: (v) => formatNumber(v, 0, locale),
                includeZero: true,
              },
            ]}
            x={{
              key: "mm",
              title: `${t("experiments.plates.chart.tooth")} (mm)`,
              format: (v) => formatNumber(v, 0, locale),
            }}
          />
        </>
      ) : (
        <p className="text-sm text-secondary">{t("experiments.plates.chart.plastic")}</p>
      )}
    </WidgetCard>
  );
}

function PlatesModel() {
  const { t } = useTranslation();
  const s = (key: string) => t(`experiments.plates.symbols.${key}`);
  return (
    <>
      <p>{t("experiments.plates.model.intro")}</p>
      <Equation
        tex={String.raw`\vec J = \sigma\,\left(\vec E + \vec v \times \vec B\right)`}
        reads={t("experiments.plates.model.current")}
        symbols={[
          { tex: String.raw`\vec J`, meaning: s("j"), unit: "A/m²" },
          { tex: String.raw`\sigma`, meaning: s("sigma"), unit: "S/m" },
          { tex: String.raw`\vec E`, meaning: s("e"), unit: "V/m" },
          { tex: String.raw`\vec v`, meaning: s("v"), unit: "m/s" },
          { tex: String.raw`\vec B`, meaning: s("b"), unit: "T" },
        ]}
      />
      <Equation
        tex={String.raw`F = \bar c\,v, \qquad \bar c = \sigma\,d\,A\,\frac{B_0^2}{2}\,\eta`}
        reads={t("experiments.plates.model.brake")}
        symbols={[
          { tex: "F", meaning: s("f"), unit: "N" },
          { tex: String.raw`\bar c`, meaning: s("c"), unit: "N·s/m" },
          { tex: "d", meaning: s("d"), unit: "m" },
          { tex: "A", meaning: s("a"), unit: "m²" },
          { tex: "B_0", meaning: s("b0"), unit: "T" },
          { tex: String.raw`\eta`, meaning: s("eta"), unit: "1" },
        ]}
      />
      <Equation
        tex={String.raw`m\,\frac{dv}{dt} = m\,g - \bar c\,v`}
        reads={t("experiments.plates.model.newton")}
        symbols={[
          { tex: "m", meaning: s("m"), unit: "kg" },
          { tex: "g", meaning: s("g"), unit: "m/s²" },
          { tex: "t", meaning: s("t"), unit: "s" },
        ]}
      />
      <Equation
        tex={String.raw`v_E = \frac{m\,g}{\bar c} = \frac{\rho\,g}{\sigma\,\frac{B_0^2}{2}\,\eta}, \qquad \tau = \frac{m}{\bar c}`}
        reads={t("experiments.plates.model.terminal")}
        symbols={[
          { tex: "v_E", meaning: s("ve"), unit: "m/s" },
          { tex: String.raw`\rho`, meaning: s("rho"), unit: "kg/m³" },
          { tex: String.raw`\tau`, meaning: s("tau"), unit: "s" },
        ]}
      />
      <Equation
        tex={String.raw`\eta_\infty = 1 - \left(\frac{\sin(k h/2)}{k h/2}\right)^2, \qquad k = \frac{2\pi}{\lambda}`}
        reads={t("experiments.plates.model.slots")}
        symbols={[
          { tex: "h", meaning: s("h"), unit: "m" },
          { tex: String.raw`\lambda`, meaning: s("lambda"), unit: "m" },
        ]}
      />
    </>
  );
}

function PlatesTrick({ column, plates }: { column: MagnetColumn; plates: Plate[] }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hue = useChartHue();
  const rows = useMemo(
    () =>
      FIELDS_T.map((field) => {
        const at = { ...column, field_t: field };
        const row: Record<string, number> = { field };
        plates.forEach((p, i) => {
          row[KINDS[i]] = fallTimeS(at, p);
        });
        return row;
      }),
    [column, plates],
  );
  const hues: Record<Kind, number> = { copper: COPPER_HUE, aluminium: 2, slotted: 0, plastic: 6 };
  return (
    <>
      <p>{t("experiments.plates.sweet.aluminium")}</p>
      <p>{t("experiments.plates.sweet.thickness")}</p>
      <p>{t("experiments.plates.sweet.slots")}</p>
      <p>{t("experiments.plates.sweet.heat")}</p>
      <p className="text-sm text-secondary">{t("experiments.plates.chart.field_hint")}</p>
      <SeriesChart
        rows={rows}
        series={KINDS.map((k) => ({
          key: k,
          label: t(`experiments.plates.short.${k}`),
          color: hue(hues[k]),
          dashed: k === "plastic",
        }))}
        axes={[
          {
            id: "y",
            title: `${t("experiments.plates.chart.fall")} (s)`,
            format: (v) => formatNumber(v, 0, locale),
            includeZero: true,
          },
        ]}
        x={{
          key: "field",
          title: `${t("experiments.plates.chart.field")} (T)`,
          format: (v) => formatNumber(v, 2, locale),
        }}
      />
    </>
  );
}

function PlatesComputed() {
  const { t } = useTranslation();
  const c = (key: string) => t(`experiments.plates.computed.${key}`);
  return (
    <>
      <p>{c("system")}</p>
      <Equation
        tex={String.raw`\bar c_\text{piece} = \sigma\,d\,\frac{h}{2} \sum_{m \ge 1} \overline{b_m^2}\,\left(W - \frac{2}{q_m}\tanh\frac{q_m W}{2}\right), \qquad q_m = \frac{m\pi}{h}`}
        reads={c("piece")}
        symbols={[
          { tex: "b_m", meaning: c("bm"), unit: "T" },
          { tex: "W", meaning: c("w"), unit: "m" },
          { tex: "q_m", meaning: c("q"), unit: "1/m" },
        ]}
      />
      <Equation
        tex={String.raw`v(t) = v_E\left(1 - e^{-t/\tau}\right), \qquad s(t) = v_E\left(t - \tau\left(1 - e^{-t/\tau}\right)\right)`}
        reads={c("fall")}
        symbols={[{ tex: "s", meaning: c("s"), unit: "m" }]}
      />
      <p>{c("check")}</p>
      <p>{c("left_out")}</p>
    </>
  );
}
