import { useId, useMemo, useRef, useState, type PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { LoadingState, Switch } from "@eifi1/ui-kit";
import { SeriesChart } from "@/shared/charts/series-chart";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber } from "@/shared/lib/format";
import { useChartHue } from "@/shared/state/palette-store";
import { holdTouch } from "@/shared/ui/grab";
import { SliderField } from "@/shared/ui/slider-field";
import { svgPoint } from "@/shared/ui/svg-point";
import { Figures, WidgetCard } from "@/shared/ui/widget";
import { BuildPending } from "./build-pending";
import { settingNumber, useCheckSetting } from "./check-setting";
import { Equation } from "./equation";
import { ExhibitFrame } from "./exhibit-frame";
import { useFrameLoop } from "./play";
import { PreviewPending, type PreviewMode, type PreviewProps } from "./preview-mode";
import { css, onScreen } from "./simulate/colour";
import { IDEAL, MOST_BETWEEN, POLAROID, figures, stacked, three, through, type Sheet } from "./simulate/polarizer";
import { SIDE } from "./stage";
import { useExperimentsDefaults } from "./use-experiments";

/**
 * The stack's drawing: the lamp, the three filters (each as one sees it
 * looking through it, its lines along its axis), the window at the end, all on
 * the beam's line `mid`.
 */
const STACK = {
  width: 400,
  height: 150,
  mid: 72,
  lamp: 30,
  filters: [112, 200, 288],
  window: 366,
  r: 27,
  windowR: 24,
  arrow: 13,
  label: 140,
} as const;
/** The preview's middle filter turns half a turn in this long, s: four bright spells. */
const PREVIEW_HALF_TURN_S = 10;
const ROOM = "#0b0d12";
const INK = "#c9ced8";
const SHEET = "#2b3342";
/** The lamp's warm white, scaled by the light. */
const WARM = [1, 0.95, 0.82] as const;
const IDEAL_HUE = 0;
const REAL_HUE = 4;

type Station = "middle" | "last";

/** The light as the screen shows it: after the first filter (half the lamp's) full white. */
const glow = (light: number) => css(onScreen(WARM.map((c) => c * Math.min(1, 2 * light))));

/** An angle as the stack's filters take it: 0 to 180°, a filter at 180° being the one at 0°. */
const halfTurn = (deg: number) => ((deg % 180) + 180) % 180;

const percent = (share: number) => 100 * share;

/**
 * The third polarising filter (`experiments.polarizer`): two crossed filters,
 * a third slid between them, ideal sheets or real ones, from the browser port
 * (`simulate/polarizer.ts`, held to the engine by `simulate.test.ts`). No
 * route: the real sheet comes with the defaults.
 */
export function PolarizerPage() {
  const { t } = useTranslation();
  const defaults = useExperimentsDefaults();
  const data = defaults.data?.polarizer;
  const [built, setSheet] = useState<Sheet | null>(null);
  const [middleDeg, setMiddleDeg] = useState(45);
  const sheet = built ?? data ?? null;
  return (
    <ExhibitFrame
      exhibit="polarizer"
      atTheExhibit={
        <>
          <p>{t("experiments.polarizer.at.lamp")}</p>
          <p>{t("experiments.polarizer.at.third")}</p>
        </>
      }
      whatHappens={<PolarizerModel />}
      computed={<PolarizerComputed />}
      sweetSpot={
        sheet ? (
          <PolarizerTrick sheet={sheet} middleDeg={middleDeg} />
        ) : (
          <LoadingState className="py-6" label={t("common.loading")} />
        )
      }
    >
      {defaults.isPending || !sheet || !data ? (
        <BuildPending pending={defaults.isPending} error={defaults.error} />
      ) : (
        <>
          <PolarizerPlay
            sheet={sheet}
            middleDeg={middleDeg}
            onMiddleDeg={setMiddleDeg}
            onSheet={() => setSheet(POLAROID)}
          />
          <PolarizerBuild sheet={sheet} onChange={setSheet} />
        </>
      )}
    </ExhibitFrame>
  );
}

/** The middle filter turning between the crossed pair: dark, bright, dark, four times a turn. */
export function PolarizerPreview({ paused }: PreviewProps) {
  const defaults = useExperimentsDefaults();
  const data = defaults.data?.polarizer;
  return data ? <PolarizerPlay sheet={data} middleDeg={45} preview paused={paused} /> : <PreviewPending />;
}

/** One filter, face on: its sheet, its lines along its axis, a knob at its rim to turn it by. */
function FilterDisc({
  x,
  deg,
  clip,
  turnable,
  held,
  onHold,
}: {
  x: number;
  deg: number;
  clip: string;
  turnable: boolean;
  held: boolean;
  onHold?: (e: PointerEvent<SVGGElement>) => void;
}) {
  const { mid, r } = STACK;
  const lines = Array.from({ length: 9 }, (_, k) => (k - 4) * 6);
  const rad = (deg * Math.PI) / 180;
  return (
    <g
      ref={turnable ? holdTouch : undefined}
      onPointerDown={onHold}
      className={turnable ? (held ? "cursor-grabbing" : "cursor-grab") : undefined}
    >
      <clipPath id={clip}>
        <circle cx={x} cy={mid} r={r} />
      </clipPath>
      <circle cx={x} cy={mid} r={r} fill={SHEET} fillOpacity={0.85} />
      <g clipPath={`url(#${clip})`} transform={`rotate(${deg} ${x} ${mid})`}>
        {lines.map((dx) => (
          <line key={dx} x1={x + dx} y1={mid - r} x2={x + dx} y2={mid + r} stroke={INK} strokeOpacity={0.45} />
        ))}
      </g>
      <circle cx={x} cy={mid} r={r} fill="none" stroke={INK} strokeWidth={1.5} />
      <circle
        cx={x + r * Math.sin(rad)}
        cy={mid - r * Math.cos(rad)}
        r={turnable ? 5 : 3}
        fill={turnable ? "#e0a030" : INK}
      />
    </g>
  );
}

/** The light's direction on a beam: a double arrow along it, as long as its amplitude; a star for unpolarised light. */
function Polarisation({ x, deg, light, marker }: { x: number; deg: number | null; light: number; marker: string }) {
  const y = STACK.mid - 34;
  const a = STACK.arrow * Math.sqrt(Math.min(1, 2 * light));
  if (deg === null) {
    return (
      <g stroke={INK} strokeWidth={1.5} strokeLinecap="round">
        {[0, 45, 90, 135].map((d) => {
          const rad = (d * Math.PI) / 180;
          const dx = 8 * Math.sin(rad);
          const dy = 8 * Math.cos(rad);
          return <line key={d} x1={x - dx} y1={y + dy} x2={x + dx} y2={y - dy} />;
        })}
      </g>
    );
  }
  if (a < 1.5) return null;
  const rad = (deg * Math.PI) / 180;
  const dx = a * Math.sin(rad);
  const dy = a * Math.cos(rad);
  return (
    <line
      x1={x - dx}
      y1={y + dy}
      x2={x + dx}
      y2={y - dy}
      stroke={INK}
      strokeWidth={1.5}
      markerStart={`url(#${marker})`}
      markerEnd={`url(#${marker})`}
    />
  );
}

/**
 * The lamp, the three filters and the window, with the beam as bright as the
 * light between them and its direction above it. Given `onTurn`, the middle and
 * the back filter are taken by mouse or finger and turned (Marcel,
 * 2026-11-20: the exhibits "ähnlich interaktiv"), in whole degrees.
 */
function StackView({
  middleIn,
  middleDeg,
  lastDeg,
  light,
  onTurn,
}: {
  middleIn: boolean;
  middleDeg: number;
  lastDeg: number;
  /** After the front filter, the middle one (or the front again, without it), the back one. */
  light: [number, number, number];
  onTurn?: (station: Station, deg: number) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const marker = `${id}-head`;
  const [held, setHeld] = useState<Station | null>(null);
  const holding = useRef<Station | null>(null);
  const [front, middle, back] = STACK.filters;
  const follow = (svg: SVGSVGElement, clientX: number, clientY: number) => {
    const station = holding.current;
    const p = svgPoint(svg, clientX, clientY);
    if (!station || !p) return;
    const cx = station === "middle" ? middle : back;
    const deg = (Math.atan2(p[0] - cx, STACK.mid - p[1]) * 180) / Math.PI;
    onTurn?.(station, Math.round(halfTurn(deg)) % 180);
  };
  const hold = (station: Station, e: PointerEvent<SVGGElement>) => {
    const svg = (e.currentTarget as SVGGElement).ownerSVGElement;
    if (!onTurn || !svg) return;
    svg.setPointerCapture?.(e.pointerId);
    holding.current = station;
    setHeld(station);
  };
  const release = () => {
    holding.current = null;
    setHeld(null);
  };
  const beams: Array<{ from: number; to: number; light: number; deg: number | null }> = [
    { from: STACK.lamp, to: front, light: 0.5, deg: null },
    { from: front, to: middle, light: light[0], deg: 0 },
    { from: middle, to: back, light: light[1], deg: middleIn ? middleDeg : 0 },
    { from: back, to: STACK.window, light: light[2], deg: lastDeg },
  ];
  return (
    <svg
      viewBox={`0 0 ${STACK.width} ${STACK.height}`}
      role="img"
      aria-label={t("experiments.polarizer.stack_view")}
      className={`w-full rounded-lg border border-subtle ${onTurn ? "select-none" : ""}`}
      style={{ background: ROOM }}
      onPointerMove={(e: PointerEvent<SVGSVGElement>) => {
        if (holding.current) follow(e.currentTarget, e.clientX, e.clientY);
      }}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <defs>
        <marker
          id={marker}
          viewBox="0 0 6 6"
          refX={3}
          refY={3}
          markerWidth={5}
          markerHeight={5}
          orient="auto-start-reverse"
        >
          <path d="M0,0 L6,3 L0,6 z" fill={INK} />
        </marker>
      </defs>
      {beams.map((beam) => (
        <rect
          key={beam.from}
          x={beam.from}
          y={STACK.mid - 5}
          width={beam.to - beam.from}
          height={10}
          fill={glow(beam.light)}
        />
      ))}
      {beams.map((beam) => (
        <Polarisation key={beam.from} x={(beam.from + beam.to) / 2} deg={beam.deg} light={beam.light} marker={marker} />
      ))}
      <circle cx={STACK.lamp} cy={STACK.mid} r={20} fill={glow(1)} fillOpacity={0.25} />
      <circle cx={STACK.lamp} cy={STACK.mid} r={12} fill={glow(1)} />
      <FilterDisc x={front} deg={0} clip={`${id}-front`} turnable={false} held={false} />
      {middleIn ? (
        <FilterDisc
          x={middle}
          deg={middleDeg}
          clip={`${id}-middle`}
          turnable={!!onTurn}
          held={held === "middle"}
          onHold={(e) => hold("middle", e)}
        />
      ) : (
        <circle
          cx={middle}
          cy={STACK.mid}
          r={STACK.r}
          fill="none"
          stroke={INK}
          strokeOpacity={0.4}
          strokeDasharray="4 4"
        />
      )}
      <FilterDisc
        x={back}
        deg={lastDeg}
        clip={`${id}-back`}
        turnable={!!onTurn}
        held={held === "last"}
        onHold={(e) => hold("last", e)}
      />
      <circle cx={STACK.window} cy={STACK.mid} r={STACK.windowR} fill={glow(light[2])} stroke={INK} strokeWidth={1.5} />
      {(
        [
          [STACK.lamp, "lamp"],
          [front, "front"],
          [middle, middleIn ? "middle" : "slot"],
          [back, "back"],
          [STACK.window, "window"],
        ] as const
      ).map(([x, key]) => (
        <text key={key} x={x} y={STACK.label} fontSize={12} fill={INK} textAnchor="middle">
          {t(`experiments.polarizer.play.labels.${key}`)}
        </text>
      ))}
    </svg>
  );
}

function PolarizerPlay({
  sheet,
  middleDeg,
  onMiddleDeg,
  onSheet,
  preview = false,
  paused = false,
}: {
  sheet: Sheet;
  middleDeg: number;
  onMiddleDeg?: (deg: number) => void;
  /** Back to Polaroid's sheet (the engine's, which the defaults also send), for a check case that names it. */
  onSheet?: () => void;
} & PreviewMode) {
  const { t } = useTranslation();
  const locale = useLocale();
  const [middleIn, setMiddleIn] = useState(false);
  const [lastDeg, setLastDeg] = useState(90);
  const [real, setReal] = useState(false);
  // A check case's "Set it up" for the stack: the middle filter in or out and
  // its angle, the back one's, the sheet. The count between is the build's.
  useCheckSetting("polarizer", (setting) => {
    if (preview || !("middle" in setting)) return false;
    setMiddleIn(setting.middle === "in");
    onMiddleDeg?.(settingNumber(setting, "middle_deg", middleDeg));
    setLastDeg(settingNumber(setting, "last_deg", lastDeg));
    setReal(setting.sheet === "polaroid");
    if (setting.sheet === "polaroid") onSheet?.();
    return true;
  });
  const [time, setTime] = useState(0);
  // Only a preview runs a clock, for its auto mode; on the page the reader turns the filters.
  useFrameLoop(preview && !paused, (dt) => setTime((s) => s + dt));
  const shownIn = preview || middleIn;
  const shownMiddle = preview ? halfTurn((180 * time) / PREVIEW_HALF_TURN_S) : middleDeg;
  const used = real && !preview ? sheet : IDEAL;
  const angles = shownIn ? [0, shownMiddle, lastDeg] : [0, lastDeg];
  const light = through(angles, used);
  const stages: [number, number, number] = shownIn ? [light[0], light[1], light[2]] : [light[0], light[0], light[1]];
  const turn = (station: Station, deg: number) => (station === "middle" ? onMiddleDeg?.(deg) : setLastDeg(deg));
  const view = (
    <StackView
      middleIn={shownIn}
      middleDeg={shownMiddle}
      lastDeg={lastDeg}
      light={stages}
      onTurn={preview ? undefined : turn}
    />
  );
  if (preview) return view;

  const out = stages[2];
  // Under two thousandths of the lamp: what a crossed Polaroid pair lets through.
  const status =
    out < 0.002
      ? t("experiments.polarizer.play.status_dark")
      : t("experiments.polarizer.play.status_light", { share: formatNumber(percent(out), 1, locale) });
  return (
    <WidgetCard title={t("experiments.polarizer.play.title")} hint={t("experiments.polarizer.play.hint")}>
      <div className={`${SIDE.grid} ${SIDE.cap["3xl"]}`}>
        <div className={`${SIDE.top} space-y-4`}>
          <Switch
            label={t("experiments.polarizer.play.middle")}
            description={t("experiments.polarizer.play.middle_hint")}
            checked={middleIn}
            onCheckedChange={setMiddleIn}
          />
          {middleIn && (
            <SliderField
              label={t("experiments.polarizer.play.middle_deg")}
              unit="°"
              value={middleDeg}
              min={0}
              max={180}
              step={1}
              digits={0}
              hint={t("experiments.polarizer.play.middle_deg_hint")}
              onChange={(v) => onMiddleDeg?.(v)}
            />
          )}
          <SliderField
            label={t("experiments.polarizer.play.last_deg")}
            unit="°"
            value={lastDeg}
            min={0}
            max={180}
            step={1}
            digits={0}
            hint={t("experiments.polarizer.play.last_deg_hint")}
            onChange={setLastDeg}
          />
          <Switch
            label={t("experiments.polarizer.play.real")}
            description={t("experiments.polarizer.play.real_hint")}
            checked={real}
            onCheckedChange={setReal}
          />
        </div>
        <div className={`${SIDE.views} mx-auto w-full max-w-3xl`}>
          <figure className="space-y-2">
            {view}
            <figcaption className="text-center text-caption text-muted">
              {t("experiments.polarizer.play.caption")}
            </figcaption>
          </figure>
        </div>
        <div className={SIDE.column}>
          <p className="text-sm font-medium text-primary" role="status">
            {status}
          </p>
          <Figures
            tiles={[
              {
                key: "front",
                label: t("experiments.polarizer.figures.front"),
                value: percent(stages[0]),
                digits: 1,
                unit: "%",
              },
              ...(middleIn
                ? [
                    {
                      key: "middle",
                      label: t("experiments.polarizer.figures.middle"),
                      value: percent(stages[1]),
                      digits: 1,
                      unit: "%",
                    },
                  ]
                : []),
              {
                key: "out",
                label: t("experiments.polarizer.figures.out"),
                value: percent(out),
                digits: out < 0.01 ? 2 : 1,
                unit: "%",
              },
            ]}
          />
        </div>
      </div>
    </WidgetCard>
  );
}

function PolarizerBuild({ sheet, onChange }: { sheet: Sheet; onChange: (next: Sheet) => void }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hue = useChartHue();
  const [between, setBetween] = useState(1);
  // A check case's "Set it up" for many filters: the count between the pair.
  useCheckSetting("polarizer", (setting) => {
    if (!("between" in setting)) return false;
    setBetween(settingNumber(setting, "between", between));
    return true;
  });
  const rows = useMemo(
    () =>
      Array.from({ length: MOST_BETWEEN + 1 }, (_, n) => ({
        n,
        ideal: percent(stacked(n)),
        real: percent(stacked(n, sheet)),
      })),
    [sheet],
  );
  const shown = figures(sheet);
  return (
    <WidgetCard title={t("experiments.polarizer.change.title")} hint={t("experiments.polarizer.change.hint")}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SliderField
          label={t("experiments.polarizer.change.between")}
          unit=""
          value={between}
          min={0}
          max={MOST_BETWEEN}
          step={1}
          digits={0}
          hint={t("experiments.polarizer.change.between_hint")}
          onChange={(v) => setBetween(Math.round(Math.min(MOST_BETWEEN, Math.max(0, v))))}
        />
        <SliderField
          label={t("experiments.polarizer.change.transmission")}
          unit="%"
          value={100 * sheet.transmission}
          min={50}
          max={100}
          step={1}
          digits={0}
          hint={t("experiments.polarizer.change.transmission_hint")}
          onChange={(v) => onChange({ ...sheet, transmission: Math.min(1, Math.max(0.1, v / 100)) })}
        />
        <SliderField
          label={t("experiments.polarizer.change.extinction")}
          unit=""
          value={sheet.extinction > 0 ? 1 / sheet.extinction : 100000}
          min={10}
          max={100000}
          step={1}
          digits={0}
          log
          hint={t("experiments.polarizer.change.extinction_hint")}
          onChange={(v) => onChange({ ...sheet, extinction: 1 / Math.min(100000, Math.max(2, v)) })}
        />
      </div>
      <Figures
        tiles={[
          {
            key: "ideal",
            label: t("experiments.polarizer.figures.between_ideal", { n: between }),
            value: percent(stacked(between)),
            digits: 1,
            unit: "%",
          },
          {
            key: "real",
            label: t("experiments.polarizer.figures.between_real", { n: between }),
            value: percent(stacked(between, sheet)),
            digits: 2,
            unit: "%",
          },
          {
            key: "best",
            label: t("experiments.polarizer.figures.best_between"),
            value: shown.best_between,
            digits: 0,
          },
          {
            key: "one",
            label: t("experiments.polarizer.figures.one"),
            value: percent(shown.one),
            digits: 1,
            unit: "%",
          },
        ]}
      />
      <p className="text-sm text-secondary">{t("experiments.polarizer.chart.hint")}</p>
      <SeriesChart
        rows={rows}
        series={[
          { key: "ideal", label: t("experiments.polarizer.chart.ideal"), color: hue(IDEAL_HUE) },
          { key: "real", label: t("experiments.polarizer.chart.real"), color: hue(REAL_HUE) },
        ]}
        axes={[
          {
            id: "y",
            title: `${t("experiments.polarizer.chart.light")} (%)`,
            format: (v) => formatNumber(v, 0, locale),
            includeZero: true,
          },
        ]}
        x={{
          key: "n",
          title: t("experiments.polarizer.chart.between"),
          format: (v) => formatNumber(v, 0, locale),
        }}
      />
    </WidgetCard>
  );
}

function PolarizerModel() {
  const { t } = useTranslation();
  const s = (key: string) => t(`experiments.polarizer.symbols.${key}`);
  return (
    <>
      <p>{t("experiments.polarizer.model.intro")}</p>
      <Equation
        tex={String.raw`I = I_0\,\cos^2\theta`}
        reads={t("experiments.polarizer.model.malus")}
        symbols={[
          { tex: "I", meaning: s("i"), unit: "W/m²" },
          { tex: "I_0", meaning: s("i0"), unit: "W/m²" },
          { tex: String.raw`\theta`, meaning: s("theta"), unit: "°" },
        ]}
      />
      <Equation
        tex={String.raw`I_1 = \tfrac12\,I_L`}
        reads={t("experiments.polarizer.model.half")}
        symbols={[
          { tex: "I_1", meaning: s("i1"), unit: "W/m²" },
          { tex: "I_L", meaning: s("il"), unit: "W/m²" },
        ]}
      />
      <Equation
        tex={String.raw`I_3 = \tfrac12\,I_L\cos^2\varphi\,\cos^2(90^\circ - \varphi) = \tfrac18\,I_L\,\sin^2 2\varphi`}
        reads={t("experiments.polarizer.model.three")}
        symbols={[
          { tex: "I_3", meaning: s("i3"), unit: "W/m²" },
          { tex: String.raw`\varphi`, meaning: s("phi"), unit: "°" },
        ]}
      />
      <Equation
        tex={String.raw`I = \tfrac12\,I_L\,\cos^{2(n+1)}\!\left(\frac{90^\circ}{n+1}\right) \;\longrightarrow\; \tfrac12\,I_L`}
        reads={t("experiments.polarizer.model.many")}
        symbols={[{ tex: "n", meaning: s("n") }]}
      />
    </>
  );
}

/** The light through the crossed pair over the middle filter's angle, ideal and real: an eighth at 45°. */
function PolarizerTrick({ sheet, middleDeg }: { sheet: Sheet; middleDeg: number }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hue = useChartHue();
  const rows = useMemo(
    () =>
      Array.from({ length: 181 }, (_, k) => ({
        deg: k,
        ideal: percent(three(k)),
        real: percent(three(k, sheet)),
      })),
    [sheet],
  );
  return (
    <>
      <p>{t("experiments.polarizer.sweet.turns")}</p>
      <p>{t("experiments.polarizer.sweet.real")}</p>
      <p className="text-sm text-secondary">
        {t("experiments.polarizer.sweet.chart_hint", {
          deg: formatNumber(middleDeg, 0, locale),
          share: formatNumber(percent(three(middleDeg)), 1, locale),
        })}
      </p>
      <SeriesChart
        rows={rows}
        series={[
          { key: "ideal", label: t("experiments.polarizer.chart.ideal"), color: hue(IDEAL_HUE) },
          { key: "real", label: t("experiments.polarizer.chart.real"), color: hue(REAL_HUE) },
        ]}
        axes={[
          {
            id: "y",
            title: `${t("experiments.polarizer.chart.light")} (%)`,
            format: (v) => formatNumber(v, 1, locale),
            includeZero: true,
          },
        ]}
        x={{
          key: "deg",
          title: `${t("experiments.polarizer.chart.middle")} (°)`,
          format: (v) => formatNumber(v, 0, locale),
        }}
      />
    </>
  );
}

function PolarizerComputed() {
  const { t } = useTranslation();
  const c = (key: string) => t(`experiments.polarizer.computed.${key}`);
  return (
    <>
      <p>{c("system")}</p>
      <p>{c("real")}</p>
      <p>{c("check")}</p>
      <p>{c("left_out")}</p>
    </>
  );
}
