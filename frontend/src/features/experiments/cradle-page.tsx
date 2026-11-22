import { useDeferredValue, useMemo, useRef, useState, type PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { Hand } from "lucide-react";
import { Button, StaticLegend, ToggleGroup, seriesLegendEntries } from "@eifi1/ui-kit";
import { SeriesChart } from "@/shared/charts/series-chart";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber } from "@/shared/lib/format";
import { useChartHue } from "@/shared/state/palette-store";
import { holdTouch } from "@/shared/ui/grab";
import { svgPoint } from "@/shared/ui/svg-point";
import { SliderField } from "@/shared/ui/slider-field";
import { Figures, WidgetCard } from "@/shared/ui/widget";
import { Equation } from "./equation";
import { ExhibitFrame } from "./exhibit-frame";
import { BuildPending } from "./build-pending";
import { PreviewPending, type PreviewMode, type PreviewProps } from "./preview-mode";
import { impact, start, step, STEP_S, type Cradle, type Pull } from "./simulate/cradle";
import { SIDE, VIEW_FRAME } from "./stage";
import { useExperimentsDefaults } from "./use-experiments";
import { HeldAnswer, useHeld } from "./held";
import { settingNumber, useCheckSetting } from "./check-setting";
import { useFrameLoop, useRunning } from "./play";
import { RunPauseButton, SpeedToggle } from "./play-controls";

const SPEEDS = [1, 0.25, 0.1] as const;
type Speed = (typeof SPEEDS)[number];

type Spacing = "touching" | "gap";
const SPACINGS: readonly Spacing[] = ["touching", "gap"];
/** A hair's gap: enough that the balls meet one pair at a time. */
const GAP_M = 1e-4;

/**
 * The most a frame spends stepping, ms. A row that has come to swing together
 * presses on itself for long stretches, a thousand microsecond steps to the
 * millisecond; past this the clock slips for a moment instead of the page
 * stuttering.
 */
const BUDGET_MS = 10;

/** The chart's points: each ball's widest swing over a second. The exhibit's
 *  period is 0.78 s, so each end ball reaches its widest in every second. */
const WINDOW_STEPS = Math.round(1 / STEP_S);
const KEEP_POINTS = 60;

/** The preview lets go again after this long. */
const PREVIEW_S = 20;

const TO_DEG = 180 / Math.PI;

type AmplitudeRow = Record<string, number>;

interface Sim {
  th: number[];
  w: number[];
  /** Steps taken. */
  i: number;
  /** Steps owed to the clock. */
  owed: number;
  widest: number[];
  rows: AmplitudeRow[];
}

function widestRow(t: number, widest: number[]): AmplitudeRow {
  return { t, ...Object.fromEntries(widest.map((a, b) => [`b${b}`, a])) };
}

function begin(cr: Cradle, pull: Pull): Sim {
  const [th, w] = start(cr, pull);
  const widest = th.map((a) => Math.abs(a) * TO_DEG);
  // The chart starts where the balls are let go from.
  return { th, w, i: 0, owed: 0, widest, rows: [widestRow(0, widest)] };
}

/**
 * Newton's cradle (`experiments.cradle`): a row of steel balls on strings,
 * stepped in the browser by the port (`simulate/cradle.ts`, held to the engine
 * by `simulate.test.ts`) — Hertz's contacts, a microsecond at a time while two
 * meet. No route.
 */
export function CradlePage() {
  const { t } = useTranslation();
  const defaults = useExperimentsDefaults();
  const [build, setBuild] = useState<Cradle | null>(null);
  const cr = build ?? defaults.data?.cradle ?? null;
  return (
    <ExhibitFrame
      exhibit="cradle"
      atTheExhibit={
        <>
          <p>{t("experiments.cradle.at.row")}</p>
          <p>{t("experiments.cradle.at.two")}</p>
        </>
      }
      whatHappens={<CradleModel />}
      computed={<CradleComputed />}
      sweetSpot={<CradleTrick />}
    >
      {defaults.isPending || !cr ? (
        <BuildPending pending={defaults.isPending} error={defaults.error} />
      ) : (
        <CradlePlay cr={cr} onChange={setBuild} />
      )}
    </ExhibitFrame>
  );
}

/** One ball let go, over and over, for the overview. */
export function CradlePreview({ paused }: PreviewProps) {
  const defaults = useExperimentsDefaults();
  const cr = defaults.data?.cradle;
  return cr ? <CradlePlay cr={cr} preview paused={paused} /> : <PreviewPending />;
}

/**
 * The row, drawn. Given `onPull`, the left balls can be taken by mouse or
 * finger (Marcel, 2026-11-20: "über den Touchscreen oder Maus ausgelegt"): the
 * ball taken and every one to its left lift together, as on the exhibit, at
 * the angle the pointer makes with the taken ball's string, in whole degrees
 * within the slider's 5–60°; letting go of it lets them go. Only the left: the
 * engine lifts from the left, and the right would be its mirror.
 */
function CradleView({
  cr,
  th,
  onPull,
  onLetGo,
}: {
  cr: Cradle;
  th: number[];
  onPull?: (pull: Pull) => void;
  onLetGo?: (pull: Pull) => void;
}) {
  const { t } = useTranslation();
  const hue = useChartHue();
  // How many balls the pointer holds lifted, while it does.
  // A ref for the handlers, which a move can reach before React has drawn the
  // hold; the state for the cursor.
  const [held, setHeld] = useState<number | null>(null);
  const holding = useRef<number | null>(null);
  const last = useRef<Pull | null>(null);
  // Millimetres, so the drawing's numbers stay near one.
  const d = cr.diameter_m * 1000;
  const L = cr.string_m * 1000;
  const pitch = d + cr.gap_m * 1000;
  const half = ((cr.count - 1) / 2) * pitch;
  // Room for a ball lifted the furthest the page allows, 60°.
  const reach = half + L * Math.sin(Math.PI / 3) + d;
  const top = -d;
  const bottom = L + d;
  // The pointer in the drawing's millimetres.
  const pullAt = (svg: SVGSVGElement, x: number, y: number, balls: number): Pull | null => {
    const p = svgPoint(svg, x, y);
    if (!p) return null;
    const [px, py] = p;
    const pivot = -half + (balls - 1) * pitch;
    const angle = (Math.atan2(pivot - px, Math.max(py, d / 2)) * 180) / Math.PI;
    return { balls, angle_deg: Math.round(Math.min(60, Math.max(5, angle))) };
  };
  const follow = (svg: SVGSVGElement, x: number, y: number, balls: number) => {
    const next = pullAt(svg, x, y, balls);
    if (!next) return;
    last.current = next;
    onPull?.(next);
  };
  const release = () => {
    if (holding.current === null) return;
    holding.current = null;
    setHeld(null);
    if (last.current) onLetGo?.(last.current);
  };
  return (
    <svg
      viewBox={`${-reach} ${top} ${2 * reach} ${bottom - top}`}
      role="img"
      aria-label={t("experiments.cradle.view")}
      className={`${VIEW_FRAME} ${onPull ? "select-none" : ""} ${held !== null ? "cursor-grabbing" : ""}`}
      onPointerMove={(e: PointerEvent<SVGSVGElement>) => {
        if (holding.current !== null) follow(e.currentTarget, e.clientX, e.clientY, holding.current);
      }}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <line
        x1={-half - d}
        y1={0}
        x2={half + d}
        y2={0}
        stroke="currentColor"
        strokeWidth={4}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {th.map((a, i) => {
        const pivot = -half + i * pitch;
        const x = pivot + L * Math.sin(a);
        const y = L * Math.cos(a);
        return (
          <g key={i}>
            <line x1={pivot} y1={0} x2={x} y2={y} stroke="currentColor" vectorEffect="non-scaling-stroke" />
            <circle
              cx={x}
              cy={y}
              r={d / 2}
              fill={hue(i)}
              stroke="currentColor"
              vectorEffect="non-scaling-stroke"
              className={onPull && i < cr.count - 1 && held === null ? "cursor-grab" : undefined}
              ref={onPull && i < cr.count - 1 ? holdTouch : undefined}
              onPointerDown={(e: PointerEvent<SVGCircleElement>) => {
                const svg = e.currentTarget.ownerSVGElement;
                if (!onPull || i >= cr.count - 1 || !svg) return;
                svg.setPointerCapture?.(e.pointerId);
                holding.current = i + 1;
                setHeld(i + 1);
                follow(svg, e.clientX, e.clientY, i + 1);
              }}
            />
          </g>
        );
      })}
    </svg>
  );
}

function CradlePlay({
  cr,
  onChange,
  preview = false,
  paused = false,
}: { cr: Cradle; onChange?: (next: Cradle) => void } & PreviewMode) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hue = useChartHue();
  const [pull, setPull] = useState<Pull>({ balls: 1, angle_deg: 30 });
  const sim = useRef(begin(cr, pull));
  const [th, setTh] = useState(() => start(cr, pull)[0]);
  const [rows, setRows] = useState(() => begin(cr, pull).rows);
  const { running, setRunning } = useRunning({ preview, paused, initially: false });
  const [speedHere, setSpeed] = useState<Speed>(1);
  // What leaves the other end after the first knock, once the reader has let
  // the balls go and seen it: the chart's first second.
  const held = useHeld();
  const show = held.show;
  const speed = preview ? 1 : speedHere;

  useFrameLoop(running, (dt) => {
    const s = sim.current;
    s.owed += (dt * speed) / STEP_S;
    const began = performance.now();
    let closed = false;
    while (s.owed >= 1) {
      [s.th, s.w] = step(cr, s.th, s.w);
      s.owed -= 1;
      s.i += 1;
      for (let b = 0; b < cr.count; b++) s.widest[b] = Math.max(s.widest[b], Math.abs(s.th[b]) * TO_DEG);
      if (s.i % WINDOW_STEPS === 0) {
        s.rows.push(widestRow(s.i * STEP_S, s.widest));
        if (s.rows.length > KEEP_POINTS) s.rows.shift();
        s.widest = s.th.map((a) => Math.abs(a) * TO_DEG);
        closed = true;
      }
      if (performance.now() - began > BUDGET_MS) {
        s.owed = 0;
        break;
      }
    }
    if (preview && s.i * STEP_S > PREVIEW_S) sim.current = begin(cr, pull);
    setTh(sim.current.th);
    if (closed) {
      setRows([...sim.current.rows]);
      show();
    }
  });

  // "Set it up" (a check case's button): the build and the pull it names, the
  // balls hung up again and let go, as the case reads them. The preview takes
  // none: it is not the page's exhibit.
  useCheckSetting("cradle", (setting) => {
    if (preview) return false;
    const nextCr = {
      ...cr,
      gap_m: settingNumber(setting, "gap_m", cr.gap_m),
      restitution: settingNumber(setting, "restitution", cr.restitution),
    };
    const nextPull = {
      balls: settingNumber(setting, "balls", pull.balls),
      angle_deg: settingNumber(setting, "angle_deg", pull.angle_deg),
    };
    onChange?.(nextCr);
    setPull(nextPull);
    sim.current = begin(nextCr, nextPull);
    setTh(sim.current.th);
    setRows([...sim.current.rows]);
    setRunning(true);
    return true;
  });

  // The impact is some ten thousand microsecond steps: a slider dragged across
  // asks for it at every notch, and the drag must not wait for each.
  const shownCr = useDeferredValue(cr);
  const shownPull = useDeferredValue(pull);
  const im = useMemo(() => impact(shownCr, shownPull), [shownCr, shownPull]);

  const chart = useMemo(() => {
    const series = Array.from({ length: cr.count }, (_, b) => ({
      key: `b${b}`,
      label: t("experiments.cradle.play.ball", { n: b + 1 }),
      color: hue(b),
    }));
    return (
      <>
        <SeriesChart
          rows={rows}
          series={series}
          axes={[
            {
              id: "y",
              title: `${t("experiments.cradle.chart.widest")} (°)`,
              format: (v) => formatNumber(v, 0, locale),
            },
          ]}
          x={{
            key: "t",
            title: `${t("experiments.cradle.chart.time")} (s)`,
            format: (v) => formatNumber(v, 0, locale),
          }}
        />
        <StaticLegend entries={seriesLegendEntries(series)} />
      </>
    );
  }, [rows, cr.count, hue, locale, t]);

  // A new setting hangs the balls up again, lifted as set: the reader lets go.
  const reset = (nextCr: Cradle, nextPull: Pull, go: boolean) => {
    sim.current = begin(nextCr, nextPull);
    setTh(sim.current.th);
    setRows([...sim.current.rows]);
    setRunning(go);
  };
  // Taken by the pointer: held as it moves, let go when it lets go.
  const hold = (next: Pull) => {
    setPull(next);
    reset(cr, next, false);
  };
  const letGoFrom = (next: Pull) => {
    setPull(next);
    reset(cr, next, true);
  };
  const view = preview ? (
    <CradleView cr={cr} th={th} />
  ) : (
    <CradleView cr={cr} th={th} onPull={hold} onLetGo={letGoFrom} />
  );
  if (preview) return view;

  const changeCradle = (next: Cradle) => {
    onChange?.(next);
    reset(next, pull, false);
  };
  const changePull = (next: Pull) => {
    setPull(next);
    reset(cr, next, false);
  };
  // Below half a centimetre a second, a speed is printed as nothing, not "−0.00".
  const after = im.after_m_s.map((v) => formatNumber(Math.abs(v) < 0.005 ? 0 : v, 2, locale)).join(" · ");
  return (
    <WidgetCard
      title={t("experiments.cradle.play.title")}
      hint={t("experiments.cradle.play.hint")}
      actions={
        <>
          <Button variant="accent" size="sm" onClick={() => reset(cr, pull, true)}>
            <Hand className="size-4" aria-hidden />
            {t("experiments.cradle.play.let_go")}
          </Button>
          <RunPauseButton running={running} onToggle={() => setRunning(!running)} />
        </>
      }
    >
      <div className={`${SIDE.grid} ${SIDE.cap.xl}`}>
        <div className={`${SIDE.top} flex flex-wrap gap-4`}>
          <ToggleGroup
            label={t("experiments.cradle.play.lifted")}
            labelPlacement="above"
            size="sm"
            value={String(pull.balls)}
            onChange={(v: string) => changePull({ ...pull, balls: Number(v) })}
            options={Array.from({ length: cr.count - 1 }, (_, k) => ({ value: String(k + 1), label: String(k + 1) }))}
          />
          <ToggleGroup
            label={t("experiments.cradle.play.spacing")}
            labelPlacement="above"
            size="sm"
            value={cr.gap_m > 0 ? "gap" : "touching"}
            onChange={(v: Spacing) => changeCradle({ ...cr, gap_m: v === "gap" ? GAP_M : 0 })}
            options={SPACINGS.map((v) => ({ value: v, label: t(`experiments.cradle.play.spacings.${v}`) }))}
          />
          <SpeedToggle speeds={SPEEDS} value={speed} onChange={setSpeed} />
        </div>
        <div className={`${SIDE.views} mx-auto w-full max-w-xl space-y-2`}>
          {view}
          <p className="text-sm text-secondary">{t("experiments.cradle.play.drag_hint")}</p>
          <HeldAnswer held={held}>
            <p className="text-sm text-secondary">{t("experiments.cradle.play.after", { speeds: after })}</p>
          </HeldAnswer>
        </div>
        <div className={SIDE.column}>
          <SliderField
            label={t("experiments.cradle.play.angle")}
            unit="°"
            value={pull.angle_deg}
            min={5}
            max={60}
            step={1}
            digits={0}
            onChange={(v) => changePull({ ...pull, angle_deg: v })}
          />
          <SliderField
            label={t("experiments.cradle.play.restitution")}
            unit="e"
            value={cr.restitution}
            min={0.5}
            max={1}
            step={0.01}
            digits={2}
            hint={t("experiments.cradle.play.restitution_hint")}
            onChange={(v) => changeCradle({ ...cr, restitution: v })}
          />
          <Figures
            tiles={[
              {
                key: "far",
                label: t("experiments.cradle.play.far"),
                value: im.far_share * 100,
                digits: 1,
                unit: "%",
                held: !held.shown,
              },
              {
                key: "duration",
                label: t("experiments.cradle.play.duration"),
                value: im.duration_s * 1e6,
                digits: 0,
                unit: "µs",
              },
              { key: "peak", label: t("experiments.cradle.play.peak"), value: im.peak_n, digits: 0, unit: "N" },
            ]}
          />
          {held.shown && <p className="text-sm text-secondary">{t("experiments.cradle.play.far_hint")}</p>}
        </div>
      </div>
      {/* One point is no line: the chart waits for the first second. */}
      {rows.length > 1 && (
        <figure className="space-y-1">
          {chart}
          <figcaption className="text-center text-caption text-muted">
            {t("experiments.cradle.chart.caption")}
          </figcaption>
        </figure>
      )}
    </WidgetCard>
  );
}

function CradleModel() {
  const { t } = useTranslation();
  const s = (key: string) => t(`experiments.cradle.symbols.${key}`);
  return (
    <>
      <p>{t("experiments.cradle.model.intro")}</p>
      <Equation
        tex={String.raw`F = K\,\delta^{3/2}\left(1 + \alpha\,\dot\delta\right)`}
        reads={t("experiments.cradle.model.hertz")}
        symbols={[
          { tex: "F", meaning: s("f"), unit: "N" },
          { tex: String.raw`\delta`, meaning: s("delta"), unit: "m" },
          { tex: String.raw`K = \tfrac{4}{3}\,E^*\sqrt{R^*}`, meaning: s("k"), unit: "N/m¹·⁵" },
          { tex: String.raw`E^* = \frac{E}{2(1 - \nu^2)}`, meaning: s("e_star"), unit: "Pa" },
          { tex: String.raw`R^* = \tfrac{d}{4}`, meaning: s("r_star"), unit: "m" },
          { tex: String.raw`\alpha = \frac{8(1 - e)}{5e}`, meaning: s("alpha"), unit: "s/m" },
          { tex: "e", meaning: s("e") },
        ]}
      />
      <p>{t("experiments.cradle.model.brief")}</p>
      <Equation
        tex={String.raw`m L\,\ddot\theta_i = -m g \sin\theta_i + F_{i-1} - F_i`}
        reads={t("experiments.cradle.model.swing")}
        symbols={[
          { tex: String.raw`\theta_i`, meaning: s("theta"), unit: "rad" },
          { tex: "L", meaning: s("l"), unit: "m" },
          { tex: "m", meaning: s("m"), unit: "kg" },
          { tex: "g", meaning: s("g"), unit: "m/s²" },
          { tex: "F_i", meaning: s("fi"), unit: "N" },
        ]}
      />
      <Equation
        tex={String.raw`m v = 2m \cdot \tfrac{v}{2}, \quad \tfrac12 m v^2 \ne 2 \cdot \tfrac12 m \left(\tfrac{v}{2}\right)^2`}
        reads={t("experiments.cradle.model.why")}
        symbols={[{ tex: "v", meaning: s("v"), unit: "m/s" }]}
      />
    </>
  );
}

function CradleTrick() {
  const { t } = useTranslation();
  return (
    <>
      <p>{t("experiments.cradle.sweet.wave")}</p>
      <p>{t("experiments.cradle.sweet.gap")}</p>
      <p>{t("experiments.cradle.sweet.two")}</p>
      <p>{t("experiments.cradle.sweet.together")}</p>
    </>
  );
}

function CradleComputed() {
  const { t } = useTranslation();
  return <p>{t("experiments.cradle.computed.system")}</p>;
}
