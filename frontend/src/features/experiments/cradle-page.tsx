import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Hand, Pause, Play } from "lucide-react";
import { Button, StaticLegend, ToggleGroup, seriesLegendEntries } from "@eifi1/ui-kit";
import { SeriesChart } from "@/shared/charts/series-chart";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber } from "@/shared/lib/format";
import { useChartHex } from "@/shared/state/palette-store";
import { SliderField } from "@/shared/ui/slider-field";
import { Figures, WidgetCard } from "@/shared/ui/widget";
import { Equation } from "./equation";
import { ExhibitFrame } from "./exhibit-frame";
import { BuildPending } from "./build-pending";
import { PreviewPending, type PreviewMode, type PreviewProps } from "./preview-mode";
import { impact, start, step, STEP_S, type Cradle, type Pull } from "./simulate/cradle";
import { SIDE } from "./stage";
import { useExperimentsDefaults } from "./use-experiments";

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

function CradleView({ cr, th }: { cr: Cradle; th: number[] }) {
  const { t } = useTranslation();
  const hex = useChartHex();
  // Millimetres, so the drawing's numbers stay near one.
  const d = cr.diameter_m * 1000;
  const L = cr.string_m * 1000;
  const pitch = d + cr.gap_m * 1000;
  const half = ((cr.count - 1) / 2) * pitch;
  // Room for a ball lifted the furthest the page allows, 60°.
  const reach = half + L * Math.sin(Math.PI / 3) + d;
  const top = -d;
  const bottom = L + d;
  return (
    <svg
      viewBox={`${-reach} ${top} ${2 * reach} ${bottom - top}`}
      role="img"
      aria-label={t("experiments.cradle.view")}
      className="w-full rounded-lg border border-subtle bg-surface-2 text-muted"
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
              fill={hex[i % hex.length]}
              stroke="currentColor"
              vectorEffect="non-scaling-stroke"
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
  const hex = useChartHex();
  const [pull, setPull] = useState<Pull>({ balls: 1, angle_deg: 30 });
  const sim = useRef(begin(cr, pull));
  const [th, setTh] = useState(() => start(cr, pull)[0]);
  const [rows, setRows] = useState(() => begin(cr, pull).rows);
  const [runningHere, setRunning] = useState(false);
  const [speedHere, setSpeed] = useState<Speed>(1);
  const running = preview ? !paused : runningHere;
  const speed = preview ? 1 : speedHere;

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
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
      if (closed) setRows([...sim.current.rows]);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, speed, cr, pull, preview]);

  // The impact is some ten thousand microsecond steps: a slider dragged across
  // asks for it at every notch, and the drag must not wait for each.
  const shownCr = useDeferredValue(cr);
  const shownPull = useDeferredValue(pull);
  const im = useMemo(() => impact(shownCr, shownPull), [shownCr, shownPull]);

  const chart = useMemo(() => {
    const series = Array.from({ length: cr.count }, (_, b) => ({
      key: `b${b}`,
      label: t("experiments.cradle.play.ball", { n: b + 1 }),
      color: hex[b % hex.length],
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
  }, [rows, cr.count, hex, locale, t]);

  const view = <CradleView cr={cr} th={th} />;
  if (preview) return view;

  // A new setting hangs the balls up again, lifted as set: the reader lets go.
  const reset = (nextCr: Cradle, nextPull: Pull, go: boolean) => {
    sim.current = begin(nextCr, nextPull);
    setTh(sim.current.th);
    setRows([...sim.current.rows]);
    setRunning(go);
  };
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
          <Button variant="secondary" size="sm" onClick={() => setRunning(!running)}>
            {running ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
            {running ? t("experiments.cradle.play.pause") : t("experiments.cradle.play.run")}
          </Button>
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
          <ToggleGroup
            label={t("experiments.cradle.play.speed")}
            labelPlacement="above"
            size="sm"
            overflow="wrap"
            value={String(speed)}
            onChange={(v: string) => setSpeed(Number(v) as Speed)}
            options={SPEEDS.map((v) => ({
              value: String(v),
              label: t(`experiments.cradle.play.speeds.${Math.round(v * 100)}`),
            }))}
          />
        </div>
        <div className={`${SIDE.views} mx-auto w-full max-w-xl space-y-2`}>
          {view}
          <p className="text-sm text-secondary">{t("experiments.cradle.play.after", { speeds: after })}</p>
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
              { key: "far", label: t("experiments.cradle.play.far"), value: im.far_share * 100, digits: 1, unit: "%" },
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
          <p className="text-sm text-secondary">{t("experiments.cradle.play.far_hint")}</p>
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
