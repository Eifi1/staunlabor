import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDown, Pause, Play, RotateCcw } from "lucide-react";
import { Button, LoadingState, Switch, ToggleGroup } from "@eifi1/ui-kit";
import { SeriesChart } from "@/shared/charts/series-chart";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber } from "@/shared/lib/format";
import { useClicks } from "@/shared/lib/use-clicks";
import { useChartHex } from "@/shared/state/palette-store";
import { SliderField } from "@/shared/ui/slider-field";
import { Figures, WidgetCard } from "@/shared/ui/widget";
import { Equation } from "./equation";
import { ExhibitFrame } from "./exhibit-frame";
import { BuildPending } from "./build-pending";
import { PreviewPending, type PreviewMode, type PreviewProps } from "./preview-mode";
import { G, bounces, figures, state, type Bounces, type BouncingBall } from "./simulate/bounce";
import { SIDE } from "./stage";
import { useExperimentsDefaults } from "./use-experiments";

/** Real time, and a quarter of it for the last quick bounces. */
const SPEEDS = { real: 1, slow: 0.25 } as const;
type Speed = keyof typeof SPEEDS;

/** The exhibit's two, as the page names them, steel first. */
const KINDS = ["steel", "tennis"] as const;
type Kind = (typeof KINDS)[number];

/** Each ball's knock: the steel one high and hard, the hollow one lower. */
const PITCH_HZ: Record<Kind, number> = { steel: 2800, tennis: 1100 };
const HUE: Record<Kind, number> = { steel: 2, tennis: 3 };
const NO_AIR_HUE = 6;

/** The preview holds the balls a moment, lets them go and, when both are
 *  still, holds them a moment too. */
const PREVIEW_HOLD_S = 1;
const PREVIEW_STILL_S = 1.5;

/** The drawing: the plate's top, the height the drop spans, the lanes' middles. */
const VIEW = { width: 260, height: 170, plate: 156, span: 128, lanes: [85, 175] } as const;
/** The rhythm strip: where its time axis starts and ends. */
const STRIP = { width: 260, height: 52, left: 8, right: 252 } as const;

const CHART_POINTS = 801;
/** Restitutions the trick's chart runs over. */
const RESTITUTIONS = Array.from({ length: 49 }, (_, k) => 0.5 + k * 0.01);

/** How many strikes have happened by `t`. */
function strikesBy(run: Bounces, t: number): number {
  let lo = 0;
  let hi = run.impacts_s.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (run.impacts_s[mid] <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * The bouncing ball (`experiments.bounce`): a steel ball and a table-tennis
 * ball dropped on a plate, their strikes and flights from the browser port
 * (`simulate/bounce.ts`, held to the engine by `simulate.test.ts`), clicking if
 * the reader turns the sound on. No route.
 */
export function BouncePage() {
  const { t } = useTranslation();
  const defaults = useExperimentsDefaults();
  const data = defaults.data?.bounce;
  const [build, setBuild] = useState<{ ball: BouncingBall; height: number } | null>(null);
  const height = build?.height ?? data?.height_m ?? null;
  const ball = build?.ball ?? data?.balls[0] ?? null;
  return (
    <ExhibitFrame
      exhibit="bounce"
      atTheExhibit={
        <>
          <p>{t("experiments.bounce.at.plate")}</p>
          <p>{t("experiments.bounce.at.rhythm")}</p>
          <p>{t("experiments.bounce.at.steel")}</p>
        </>
      }
      whatHappens={<BounceModel />}
      computed={<BounceComputed />}
      sweetSpot={
        data && height !== null ? (
          <BounceTrick balls={data.balls} height={height} />
        ) : (
          <LoadingState className="py-6" label={t("common.loading")} />
        )
      }
    >
      {defaults.isPending || !data || height === null || !ball ? (
        <BuildPending pending={defaults.isPending} error={defaults.error} />
      ) : (
        <>
          {/* A new height is a new start: the balls go back up. */}
          <BouncePlay key={height} balls={data.balls} height={height} />
          <BounceBuild ball={ball} height={height} presets={data.balls} onChange={setBuild} />
        </>
      )}
    </ExhibitFrame>
  );
}

/** The two let go, bouncing out, and held up again, over and over. */
export function BouncePreview({ paused }: PreviewProps) {
  const defaults = useExperimentsDefaults();
  const data = defaults.data?.bounce;
  return data ? <BouncePlay balls={data.balls} height={data.height_m} preview paused={paused} /> : <PreviewPending />;
}

/** The two balls over the plate, at true scale but never smaller than a dot. */
function DropView({ balls, height, heights }: { balls: BouncingBall[]; height: number; heights: number[] }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  const scale = VIEW.span / height;
  return (
    <svg
      viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
      role="img"
      aria-label={t("experiments.bounce.view")}
      className="w-full rounded-lg border border-subtle bg-surface-2 text-muted"
    >
      <line
        x1={20}
        y1={VIEW.plate - VIEW.span}
        x2={240}
        y2={VIEW.plate - VIEW.span}
        stroke="currentColor"
        strokeDasharray="3 3"
        vectorEffect="non-scaling-stroke"
      />
      <text x={22} y={VIEW.plate - VIEW.span - 4} fontSize={7} fill="currentColor">
        {formatNumber(height * 100, 0, locale)} cm
      </text>
      <rect x={20} y={VIEW.plate} width={220} height={6} className="fill-current" fillOpacity={0.45} />
      {VIEW.lanes.map((x, i) => {
        const kind = KINDS[i];
        const r = Math.max(3, (balls[i].diameter_m / 2) * scale);
        return (
          <g key={kind}>
            <circle
              cx={x}
              cy={VIEW.plate - heights[i] * scale - r}
              r={r}
              fill={kind === "steel" ? hex[HUE.steel % hex.length] : "var(--bg-surface)"}
              stroke={hex[HUE[kind] % hex.length]}
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
            <text x={x} y={VIEW.height - 2} fontSize={7} textAnchor="middle" fill="currentColor">
              {t(`experiments.bounce.short.${kind}`)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Every strike on a time line, one row a ball: the rhythm, seen. */
function RhythmStrip({ runs, time, span }: { runs: Bounces[]; time: number; span: number }) {
  const { t } = useTranslation();
  const hex = useChartHex();
  const at = (s: number) => STRIP.left + ((STRIP.right - STRIP.left) * Math.min(s, span)) / span;
  return (
    <svg
      viewBox={`0 0 ${STRIP.width} ${STRIP.height}`}
      role="img"
      aria-label={t("experiments.bounce.strip")}
      className="w-full rounded-lg border border-subtle bg-surface-2 text-muted"
    >
      {runs.map((run, i) => {
        const kind = KINDS[i];
        const y = 20 + i * 22;
        return (
          <g key={kind}>
            <text x={STRIP.left} y={y - 9} fontSize={6} fill="currentColor">
              {t(`experiments.bounce.short.${kind}`)}
            </text>
            <line x1={STRIP.left} y1={y} x2={STRIP.right} y2={y} stroke="currentColor" strokeOpacity={0.3} />
            {run.impacts_s.map((s, n) => (
              <line
                key={n}
                x1={at(s)}
                y1={y - 6}
                x2={at(s)}
                y2={y + 6}
                stroke={hex[HUE[kind] % hex.length]}
                strokeOpacity={s <= time ? 1 : 0.25}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        );
      })}
      <line
        x1={at(Math.max(0, time))}
        y1={2}
        x2={at(Math.max(0, time))}
        y2={STRIP.height - 2}
        className="stroke-current text-primary"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function BouncePlay({
  balls,
  height,
  preview = false,
  paused = false,
}: { balls: BouncingBall[]; height: number } & PreviewMode) {
  const { t } = useTranslation();
  const locale = useLocale();
  const clock = useRef(0);
  const [time, setTime] = useState(0);
  const [dropped, setDropped] = useState(false);
  const [runningHere, setRunning] = useState(false);
  const [speedHere, setSpeed] = useState<Speed>("real");
  const [sound, setSound] = useState(false);
  const clicks = useClicks(sound && !preview);
  const runs = useMemo(() => balls.map((b) => bounces(b, height)), [balls, height]);
  const still = Math.max(...runs.map((r) => r.still_s));
  const loop = PREVIEW_HOLD_S + still + PREVIEW_STILL_S;
  // Once both lie still there is nothing left to draw: the clock stops.
  const running = preview ? !paused : dropped && runningHere && time < still;
  const speed = preview ? SPEEDS.real : SPEEDS[speedHere];

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      // A frame's timestamp can lie a little before the effect started: never a step back in time.
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      clock.current += dt * speed;
      setTime(clock.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, speed]);

  // The run's time: negative while the balls are held up.
  const runTime = preview ? (time % loop) - PREVIEW_HOLD_S : dropped ? time : -1;
  const heights = balls.map((b, i) => state(b, height, runs[i], runTime)[0]);
  const struck = runs.map((r) => (runTime < 0 ? 0 : strikesBy(r, runTime)));

  // A knock for each ball whose strikes went up since the last frame, as loud
  // as the strike was hard; the quickest ones, many to a frame, as one.
  const heard = useRef<number[]>([0, 0]);
  const { click } = clicks;
  const struckKey = struck.join(" ");
  useEffect(() => {
    struck.forEach((count, i) => {
      if (count > heard.current[i] && count > 0)
        click(runs[i].speeds_m_s[count - 1] / runs[i].speeds_m_s[0], PITCH_HZ[KINDS[i]]);
    });
    heard.current = struck;
    // The counts by value: a new array with the same counts makes no knock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [struckKey, click, runs]);

  const views = (
    <div className="space-y-2">
      <DropView balls={balls} height={height} heights={heights} />
      <RhythmStrip runs={runs} time={runTime} span={still} />
    </div>
  );
  if (preview) return views;

  const reset = () => {
    clock.current = 0;
    setTime(0);
    setDropped(false);
    setRunning(false);
  };
  return (
    <WidgetCard
      title={t("experiments.bounce.play.title")}
      hint={t("experiments.bounce.play.hint")}
      actions={
        dropped ? (
          <>
            {time < still && (
              <Button variant="secondary" size="sm" onClick={() => setRunning(!runningHere)}>
                {runningHere ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
                {runningHere ? t("experiments.bounce.play.pause") : t("experiments.bounce.play.run")}
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={reset}>
              <RotateCcw className="size-4" aria-hidden />
              {t("experiments.bounce.play.top")}
            </Button>
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
            {t("experiments.bounce.play.drop")}
          </Button>
        )
      }
    >
      <div className={`${SIDE.grid} ${SIDE.cap.xl}`}>
        <div className={`${SIDE.top} flex flex-wrap items-end gap-4`}>
          <ToggleGroup
            label={t("experiments.bounce.play.speed")}
            labelPlacement="above"
            size="sm"
            overflow="wrap"
            value={speedHere}
            onChange={(v: string) => setSpeed(v as Speed)}
            options={(Object.keys(SPEEDS) as Speed[]).map((s) => ({
              value: s,
              label: t(`experiments.bounce.play.speeds.${s}`),
            }))}
          />
          <Switch
            label={t("experiments.bounce.play.sound")}
            description={
              clicks.available ? t("experiments.bounce.play.sound_hint") : t("experiments.bounce.play.no_sound")
            }
            checked={sound}
            disabled={!clicks.available}
            onCheckedChange={setSound}
          />
        </div>
        <div className={`${SIDE.views} mx-auto w-full max-w-xl`}>
          <figure className="space-y-1">
            {views}
            <figcaption className="text-center text-caption text-muted">
              {t("experiments.bounce.play.caption", { height: formatNumber(height * 100, 0, locale) })}
            </figcaption>
          </figure>
          {!dropped && (
            <p className="text-sm text-secondary" role="status">
              {t("experiments.bounce.play.waiting")}
            </p>
          )}
        </div>
        <div className={SIDE.column}>
          <Figures
            tiles={[
              {
                key: "time",
                label: t("experiments.bounce.play.time"),
                value: Math.min(Math.max(0, runTime), still),
                digits: 2,
                unit: "s",
              },
              ...KINDS.map((kind, i) => ({
                key: kind,
                label: t("experiments.bounce.play.strikes", { ball: t(`experiments.bounce.short.${kind}`) }),
                value: struck[i],
                digits: 0,
              })),
            ]}
          />
        </div>
      </div>
    </WidgetCard>
  );
}

function BounceBuild({
  ball,
  height,
  presets,
  onChange,
}: {
  ball: BouncingBall;
  height: number;
  presets: BouncingBall[];
  onChange: (next: { ball: BouncingBall; height: number }) => void;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  const kind: Kind =
    ball.mass_kg === presets[1].mass_kg && ball.diameter_m === presets[1].diameter_m ? "tennis" : "steel";
  const shown = useMemo(() => figures(ball, height), [ball, height]);
  const rows = useMemo(() => {
    const run = bounces(ball, height);
    const span = run.still_s * 1.02;
    return Array.from({ length: CHART_POINTS }, (_, k) => {
      const s = (span * k) / (CHART_POINTS - 1);
      return { s, height: state(ball, height, run, s)[0] * 100 };
    });
  }, [ball, height]);
  return (
    <WidgetCard title={t("experiments.bounce.change.title")} hint={t("experiments.bounce.change.hint")}>
      <ToggleGroup
        label={t("experiments.bounce.change.kind")}
        labelPlacement="above"
        size="sm"
        overflow="wrap"
        value={kind}
        onChange={(v: string) => {
          const preset = presets[KINDS.indexOf(v as Kind)];
          onChange({ ball: { ...preset }, height });
        }}
        options={KINDS.map((k) => ({ value: k, label: t(`experiments.bounce.short.${k}`) }))}
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SliderField
          label={t("experiments.bounce.change.restitution")}
          unit=""
          value={ball.restitution}
          min={0.5}
          max={0.98}
          step={0.01}
          digits={2}
          hint={t("experiments.bounce.change.restitution_hint")}
          onChange={(v) => onChange({ ball: { ...ball, restitution: v }, height })}
        />
        <SliderField
          label={t("experiments.bounce.change.height")}
          unit="cm"
          value={height * 100}
          min={5}
          max={100}
          step={1}
          digits={0}
          hint={t("experiments.bounce.change.height_hint")}
          onChange={(v) => onChange({ ball, height: v / 100 })}
        />
      </div>
      <p className="text-sm font-medium text-primary" role="status">
        {t("experiments.bounce.change.status", {
          time: formatNumber(shown.still_s, 1, locale),
          count: shown.counted,
        })}
      </p>
      <Figures
        tiles={[
          { key: "still", label: t("experiments.bounce.figures.still"), value: shown.still_s, digits: 2, unit: "s" },
          { key: "counted", label: t("experiments.bounce.figures.counted"), value: shown.counted, digits: 0 },
          {
            key: "apex",
            label: t("experiments.bounce.figures.apex"),
            value: shown.first_apex_m * 100,
            digits: 1,
            unit: "cm",
          },
          {
            key: "flight",
            label: t("experiments.bounce.figures.flight"),
            value: shown.first_flight_s,
            digits: 2,
            unit: "s",
          },
          { key: "rhythm", label: t("experiments.bounce.figures.rhythm"), value: shown.rhythm, digits: 3 },
          {
            key: "terminal",
            label: t("experiments.bounce.figures.terminal"),
            value: shown.terminal_m_s,
            digits: 1,
            unit: "m/s",
          },
        ]}
      />
      <SeriesChart
        rows={rows}
        series={[{ key: "height", label: t("experiments.bounce.chart.height"), color: hex[HUE[kind] % hex.length] }]}
        axes={[
          {
            id: "y",
            title: `${t("experiments.bounce.chart.height")} (cm)`,
            format: (v) => formatNumber(v, 0, locale),
            includeZero: true,
          },
        ]}
        x={{
          key: "s",
          title: `${t("experiments.bounce.chart.time")} (s)`,
          format: (v) => formatNumber(v, 1, locale),
        }}
      />
    </WidgetCard>
  );
}

function BounceModel() {
  const { t } = useTranslation();
  const s = (key: string) => t(`experiments.bounce.symbols.${key}`);
  return (
    <>
      <p>{t("experiments.bounce.model.intro")}</p>
      <Equation
        tex={String.raw`v_\text{after} = e\,v_\text{before}, \qquad h_{n+1} = e^2\,h_n`}
        reads={t("experiments.bounce.model.bounce")}
        symbols={[
          { tex: "e", meaning: s("e"), unit: "1" },
          { tex: "v", meaning: s("v"), unit: "m/s" },
          { tex: "h_n", meaning: s("h"), unit: "m" },
        ]}
      />
      <Equation
        tex={String.raw`t_{n+1} = e\,t_n`}
        reads={t("experiments.bounce.model.series")}
        symbols={[{ tex: "t_n", meaning: s("tn"), unit: "s" }]}
      />
      <Equation
        tex={String.raw`T = t_0 + t_1\left(1 + e + e^2 + \dots\right) = t_0 + \frac{t_1}{1 - e}`}
        reads={t("experiments.bounce.model.sum")}
        symbols={[
          { tex: "T", meaning: s("still"), unit: "s" },
          { tex: "t_0", meaning: s("t0"), unit: "s" },
        ]}
      />
      <Equation
        tex={String.raw`m\,\frac{dv}{dt} = -m\,g - \tfrac12\,\rho\,c_d\,A\,v\,|v|, \qquad v_T = \sqrt{\frac{2\,m\,g}{\rho\,c_d\,A}}`}
        reads={t("experiments.bounce.model.air")}
        symbols={[
          { tex: "m", meaning: s("m"), unit: "kg" },
          { tex: "g", meaning: s("g"), unit: "m/s²" },
          { tex: String.raw`\rho`, meaning: s("rho"), unit: "kg/m³" },
          { tex: "c_d", meaning: s("cd"), unit: "1" },
          { tex: "A", meaning: s("a"), unit: "m²" },
          { tex: "v_T", meaning: s("vt"), unit: "m/s" },
        ]}
      />
    </>
  );
}

function BounceTrick({ balls, height }: { balls: BouncingBall[]; height: number }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  const rows = useMemo(() => {
    const drop = Math.sqrt((2 * height) / G);
    return RESTITUTIONS.map((e) => ({
      e,
      steel: bounces({ ...balls[0], restitution: e }, height).still_s,
      tennis: bounces({ ...balls[1], restitution: e }, height).still_s,
      none: (drop * (1 + e)) / (1 - e),
    }));
  }, [balls, height]);
  return (
    <>
      <p>{t("experiments.bounce.sweet.zeno")}</p>
      <p>{t("experiments.bounce.sweet.steel")}</p>
      <p>{t("experiments.bounce.sweet.rhythm")}</p>
      <p>{t("experiments.bounce.sweet.rules")}</p>
      <p className="text-sm text-secondary">{t("experiments.bounce.chart.still_hint")}</p>
      <SeriesChart
        rows={rows}
        series={[
          ...KINDS.map((k) => ({ key: k, label: t(`experiments.bounce.short.${k}`), color: hex[HUE[k] % hex.length] })),
          {
            key: "none",
            label: t("experiments.bounce.chart.no_air"),
            color: hex[NO_AIR_HUE % hex.length],
            dashed: true,
          },
        ]}
        axes={[
          {
            id: "y",
            title: `${t("experiments.bounce.chart.still")} (s)`,
            format: (v) => formatNumber(v, 0, locale),
            includeZero: true,
          },
        ]}
        x={{
          key: "e",
          title: t("experiments.bounce.chart.restitution"),
          format: (v) => formatNumber(v, 2, locale),
        }}
      />
    </>
  );
}

function BounceComputed() {
  const { t } = useTranslation();
  const c = (key: string) => t(`experiments.bounce.computed.${key}`);
  return (
    <>
      <p>{c("system")}</p>
      <Equation
        tex={String.raw`v(t) = v_T\,\tan\!\left(\arctan\frac{v_0}{v_T} - \frac{g\,t}{v_T}\right), \qquad h_\text{top} = \frac{v_T^2}{2g}\,\ln\!\left(1 + \frac{v_0^2}{v_T^2}\right), \qquad v_\downarrow(t) = -v_T\,\tanh\frac{g\,t}{v_T}`}
        reads={c("exact")}
        symbols={[
          { tex: "v_0", meaning: c("v0"), unit: "m/s" },
          { tex: String.raw`h_\text{top}`, meaning: c("top"), unit: "m" },
        ]}
      />
      <p>{c("check")}</p>
      <p>{c("left_out")}</p>
    </>
  );
}
