import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Hand, Pause, Play } from "lucide-react";
import { AlertBanner, Button, LoadingState, ToggleGroup, useDebounce } from "@eifi1/ui-kit";
import { apiErrorMessage } from "@/shared/api/client";
import { SeriesChart } from "@/shared/charts/series-chart";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber, formatPowerOfTen } from "@/shared/lib/format";
import { useChartHex } from "@/shared/state/palette-store";
import { SliderField } from "@/shared/ui/slider-field";
import { Figures, WidgetCard } from "@/shared/ui/widget";
import { Equation } from "./equation";
import { ExhibitFrame } from "./exhibit-frame";
import { PreviewPending, type PreviewMode, type PreviewProps } from "./preview-mode";
import { lyapunov, modeRates, rhs, run, separation, startState, twinOf, type DoublePendulum } from "./simulate/chaos";
import { STEP_S, rk4 } from "./simulate/pendulum";
import { SIDE } from "./stage";
import { useExperimentsDefaults } from "./use-experiments";

/** Where the arms start, in degrees from hanging straight down. */
interface Start {
  upper: number;
  lower: number;
}

/** The three starts the page offers by name. */
const PRESETS: Record<"gentle" | "wild" | "headstand", Start> = {
  gentle: { upper: 5, lower: 7 },
  wild: { upper: 120, lower: 120 },
  headstand: { upper: 179, lower: 0 },
};

/** How far the twin's upper arm is nudged, degrees. */
const NUDGES = [1, 0.01, 0.001, 0.00001] as const;
type Nudge = (typeof NUDGES)[number];

const SPEEDS = [1, 0.25] as const;
type Speed = (typeof SPEEDS)[number];

const MAIN_HUE = 2;
const TWIN_HUE = 6;

/** The trail of the lower bob: this many seconds. */
const TRAIL_S = 3;

/** The exponent is measured over this long: long enough to settle, short
 *  enough that a slider's settle does not keep the reader waiting. */
const MEASURE_S = 30;

/**
 * The chaotic pendulum (`experiments.chaos`): a double pendulum and its twin,
 * a nudge apart, stepped together by the browser port (`simulate/chaos.ts`,
 * held to the engine by `simulate.test.ts`), with the gap between them drawn on
 * a logarithmic scale and the Lyapunov exponent measured for the start on
 * screen. No route.
 */
export function ChaosPage() {
  const { t } = useTranslation();
  const defaults = useExperimentsDefaults();
  const [build, setBuild] = useState<DoublePendulum | null>(null);
  const [start, setStart] = useState<Start>(PRESETS.wild);
  const [nudge, setNudge] = useState<Nudge>(0.001);
  const dp = build ?? defaults.data?.chaos ?? null;
  return (
    <ExhibitFrame
      exhibit="chaos"
      atTheExhibit={
        <>
          <p>{t("experiments.chaos.at.pendulum")}</p>
          <p>{t("experiments.chaos.at.twice")}</p>
        </>
      }
      whatHappens={<ChaosModel />}
      computed={<ChaosComputed />}
      sweetSpot={<ChaosTrick dp={dp} start={start} nudge={nudge} />}
    >
      {defaults.isPending ? (
        <LoadingState className="py-10" label={t("common.loading")} />
      ) : !dp ? (
        <AlertBanner tone="danger">{apiErrorMessage(defaults.error, t("experiments.failed"))}</AlertBanner>
      ) : (
        <>
          <ChaosPlay
            key={JSON.stringify({ dp, start, nudge })}
            dp={dp}
            start={start}
            nudge={nudge}
            onStart={setStart}
            onNudge={setNudge}
          />
          <ChaosBuild dp={dp} onChange={setBuild} />
        </>
      )}
    </ExhibitFrame>
  );
}

/** The wild start and its twin, for the overview: they part within seconds. */
export function ChaosPreview({ paused }: PreviewProps) {
  const defaults = useExperimentsDefaults();
  const dp = defaults.data?.chaos;
  return dp ? <ChaosPlay dp={dp} start={PRESETS.wild} nudge={1} preview paused={paused} /> : <PreviewPending />;
}

function arms(dp: DoublePendulum, y: readonly number[]): [[number, number], [number, number]] {
  const p1: [number, number] = [dp.length1_m * Math.sin(y[0]), dp.length1_m * Math.cos(y[0])];
  return [p1, [p1[0] + dp.length2_m * Math.sin(y[1]), p1[1] + dp.length2_m * Math.cos(y[1])]];
}

function ChaosView({
  dp,
  main,
  twin,
  trail,
}: {
  dp: DoublePendulum;
  main: readonly number[];
  twin: readonly number[];
  trail: Array<[number, number]>;
}) {
  const { t } = useTranslation();
  const hex = useChartHex();
  const reach = (dp.length1_m + dp.length2_m) * 1.1;
  const bob = reach * 0.035;
  const draw = (y: readonly number[], hue: number, opacity: number) => {
    const [p1, p2] = arms(dp, y);
    const colour = hex[hue % hex.length];
    return (
      <g opacity={opacity}>
        <polyline
          points={`0,0 ${p1[0]},${p1[1]} ${p2[0]},${p2[1]}`}
          fill="none"
          stroke={colour}
          strokeWidth={3}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx={p1[0]} cy={p1[1]} r={bob} fill={colour} />
        <circle cx={p2[0]} cy={p2[1]} r={bob} fill={colour} />
      </g>
    );
  };
  return (
    <svg
      viewBox={`${-reach} ${-reach} ${2 * reach} ${2 * reach}`}
      role="img"
      aria-label={t("experiments.chaos.view")}
      className="aspect-square w-full rounded-lg border border-subtle bg-surface-2 text-muted"
    >
      <polyline
        points={trail.map(([x, y]) => `${x},${y}`).join(" ")}
        fill="none"
        stroke={hex[MAIN_HUE % hex.length]}
        opacity={0.3}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      {draw(twin, TWIN_HUE, 0.6)}
      {draw(main, MAIN_HUE, 1)}
      <circle r={bob * 0.6} className="fill-current text-primary" />
    </svg>
  );
}

function ChaosPlay({
  dp,
  start,
  nudge,
  onStart,
  onNudge,
  preview = false,
  paused = false,
}: {
  dp: DoublePendulum;
  start: Start;
  nudge: Nudge;
  onStart?: (next: Start) => void;
  onNudge?: (next: Nudge) => void;
} & PreviewMode) {
  const { t } = useTranslation();
  const locale = useLocale();
  const begin = () => {
    const a = startState(start.upper, start.lower);
    return { a, b: twinOf(a, nudge), clock: 0, owed: 0, i: 0, trail: [] as Array<[number, number]> };
  };
  const sim = useRef(begin());
  const [runningHere, setRunning] = useState(preview);
  const [speedHere, setSpeed] = useState<Speed>(1);
  const [frame, setFrame] = useState(begin);
  const running = preview ? !paused : runningHere;
  const speed = preview ? 1 : speedHere;

  useEffect(() => {
    if (!running) return;
    const f = rhs(dp);
    const keep = Math.round(TRAIL_S / (STEP_S * 10));
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      const s = sim.current;
      s.owed += (dt * speed) / STEP_S;
      const steps = Math.floor(s.owed);
      s.owed -= steps;
      for (let k = 0; k < steps; k++) {
        s.a = rk4(f, s.clock, s.a, STEP_S);
        s.b = rk4(f, s.clock, s.b, STEP_S);
        s.clock += STEP_S;
        s.i += 1;
        if (s.i % 10 === 0) {
          s.trail.push(arms(dp, s.a)[1]);
          if (s.trail.length > keep) s.trail.shift();
        }
      }
      // The preview starts again after a while: its two have long parted.
      if (preview && s.clock > 20) sim.current = begin();
      setFrame({ ...sim.current, trail: [...sim.current.trail] });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // `begin` reads the start and the nudge, which a new start remounts for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, speed, dp, preview]);

  const view = <ChaosView dp={dp} main={frame.a} twin={frame.b} trail={frame.trail} />;
  if (preview) return view;
  const letGo = () => {
    sim.current = begin();
    setFrame({ ...sim.current });
    setRunning(true);
  };
  return (
    <WidgetCard
      title={t("experiments.chaos.play.title")}
      hint={t("experiments.chaos.play.hint")}
      actions={
        <>
          <Button variant="accent" size="sm" onClick={letGo}>
            <Hand className="size-4" aria-hidden />
            {t("experiments.chaos.play.let_go")}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setRunning(!running)}>
            {running ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
            {running ? t("experiments.chaos.play.pause") : t("experiments.chaos.play.run")}
          </Button>
        </>
      }
    >
      <div className={SIDE.grid}>
        <div className={`${SIDE.top} space-y-2`}>
          <p className="text-sm text-secondary">{t("experiments.chaos.play.presets_label")}</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(PRESETS) as Array<keyof typeof PRESETS>).map((name) => (
              <Button key={name} variant="secondary" size="sm" onClick={() => onStart?.(PRESETS[name])}>
                {t(`experiments.chaos.play.presets.${name}`)}
              </Button>
            ))}
          </div>
        </div>
        <div className={`${SIDE.views} mx-auto w-full max-w-xl`}>{view}</div>
        <div className={SIDE.column}>
          <SliderField
            label={t("experiments.chaos.play.upper")}
            unit="°"
            value={start.upper}
            min={-180}
            max={180}
            step={1}
            digits={0}
            onChange={(v) => onStart?.({ ...start, upper: v })}
          />
          <SliderField
            label={t("experiments.chaos.play.lower")}
            unit="°"
            value={start.lower}
            min={-180}
            max={180}
            step={1}
            digits={0}
            onChange={(v) => onStart?.({ ...start, lower: v })}
          />
          <ToggleGroup
            label={t("experiments.chaos.play.nudge")}
            labelPlacement="above"
            size="sm"
            overflow="wrap"
            value={String(nudge)}
            onChange={(v: string) => onNudge?.(Number(v) as Nudge)}
            options={NUDGES.map((n) => ({
              value: String(n),
              label: `${formatNumber(n, Math.max(0, -Math.floor(Math.log10(n))), locale)}°`,
            }))}
          />
          <ToggleGroup
            label={t("experiments.chaos.play.speed")}
            labelPlacement="above"
            size="sm"
            value={String(speed)}
            onChange={(v: string) => setSpeed(Number(v) as Speed)}
            options={SPEEDS.map((v) => ({ value: String(v), label: t(`experiments.chaos.play.speeds.${v * 100}`) }))}
          />
          <Figures
            tiles={[{ key: "time", label: t("experiments.chaos.play.time"), value: frame.clock, digits: 1, unit: "s" }]}
          />
          <p className="text-sm text-secondary">
            {t("experiments.chaos.play.gap", { gap: formatPowerOfTen(separation(dp, frame.a, frame.b), locale) })}
          </p>
        </div>
      </div>
    </WidgetCard>
  );
}

function ChaosBuild({ dp, onChange }: { dp: DoublePendulum; onChange: (next: DoublePendulum) => void }) {
  const { t } = useTranslation();
  return (
    <WidgetCard title={t("experiments.chaos.change.title")} hint={t("experiments.chaos.change.hint")}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SliderField
          label={t("experiments.chaos.change.length1")}
          unit="cm"
          value={dp.length1_m * 100}
          min={10}
          max={60}
          step={1}
          digits={0}
          onChange={(v) => onChange({ ...dp, length1_m: v / 100 })}
        />
        <SliderField
          label={t("experiments.chaos.change.length2")}
          unit="cm"
          value={dp.length2_m * 100}
          min={10}
          max={60}
          step={1}
          digits={0}
          onChange={(v) => onChange({ ...dp, length2_m: v / 100 })}
        />
        <SliderField
          label={t("experiments.chaos.change.mass1")}
          unit="g"
          value={dp.mass1_kg * 1000}
          min={50}
          max={2000}
          step={10}
          digits={0}
          onChange={(v) => onChange({ ...dp, mass1_kg: v / 1000 })}
        />
        <SliderField
          label={t("experiments.chaos.change.mass2")}
          unit="g"
          value={dp.mass2_kg * 1000}
          min={50}
          max={2000}
          step={10}
          digits={0}
          onChange={(v) => onChange({ ...dp, mass2_kg: v / 1000 })}
        />
        <SliderField
          label={t("experiments.chaos.change.damping")}
          unit="1/s"
          value={dp.damping_per_s}
          min={0}
          max={0.5}
          step={0.01}
          digits={2}
          onChange={(v) => onChange({ ...dp, damping_per_s: v })}
        />
      </div>
    </WidgetCard>
  );
}

function ChaosModel() {
  const { t } = useTranslation();
  const s = (key: string) => t(`experiments.chaos.symbols.${key}`);
  return (
    <>
      <p>{t("experiments.chaos.model.intro")}</p>
      <Equation
        tex={String.raw`E = \tfrac12 (m_1 + m_2) L_1^2 \dot\theta_1^2 + \tfrac12 m_2 L_2^2 \dot\theta_2^2 + m_2 L_1 L_2\, \dot\theta_1 \dot\theta_2 \cos(\theta_1 - \theta_2) - (m_1 + m_2)\, g L_1 \cos\theta_1 - m_2\, g L_2 \cos\theta_2`}
        reads={t("experiments.chaos.model.energy")}
        symbols={[
          { tex: String.raw`\theta_1, \theta_2`, meaning: s("theta"), unit: "rad" },
          { tex: "L_1, L_2", meaning: s("lengths"), unit: "m" },
          { tex: "m_1, m_2", meaning: s("masses"), unit: "kg" },
          { tex: "g", meaning: s("g"), unit: "m/s²" },
        ]}
      />
      <Equation
        tex={String.raw`\omega^2 = \frac{g}{L}\left(2 \mp \sqrt{2}\right)`}
        reads={t("experiments.chaos.model.modes")}
        symbols={[{ tex: String.raw`\omega`, meaning: s("omega"), unit: "1/s" }]}
      />
      <Equation
        tex={String.raw`d(t) \approx d_0\, e^{\lambda t}`}
        reads={t("experiments.chaos.model.lyapunov")}
        symbols={[
          { tex: "d", meaning: s("d") },
          { tex: String.raw`\lambda`, meaning: s("lambda"), unit: "1/s" },
        ]}
      />
    </>
  );
}

function ChaosTrick({ dp, start, nudge }: { dp: DoublePendulum | null; start: Start; nudge: Nudge }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  // Asked again only once the sliders have held still: a measurement is half a
  // minute of two pendulums stepped a millisecond at a time.
  const settled = useDebounce({ dp, start, nudge }, 300, { key: JSON.stringify({ dp, start, nudge }) });
  const measured = useMemo(() => {
    if (!settled.dp) return null;
    const r = run(settled.dp, settled.start.upper, settled.start.lower, 20, settled.nudge, 0.002);
    return {
      rows: r.t.flatMap((time, i) =>
        i % 5 === 0 ? [{ t: time, gap: Math.log10(Math.max(r.separation[i], 1e-16)) }] : [],
      ),
      exponent: lyapunov(settled.dp, settled.start.upper, settled.start.lower, MEASURE_S),
    };
  }, [settled]);
  if (!dp || !measured) return <LoadingState className="py-6" label={t("common.loading")} />;
  const [slow] = modeRates(dp);
  const chaotic = measured.exponent > 0.1;
  return (
    <>
      <p>{t("experiments.chaos.sweet.gap")}</p>
      <SeriesChart
        rows={measured.rows}
        series={[{ key: "gap", label: t("experiments.chaos.chart.gap"), color: hex[MAIN_HUE % hex.length] }]}
        axes={[
          {
            id: "y",
            title: t("experiments.chaos.chart.gap"),
            format: (v) => formatPowerOfTen(10 ** Math.round(v), locale),
          },
        ]}
        x={{ key: "t", title: `${t("experiments.chaos.chart.time")} (s)`, format: (v) => formatNumber(v, 0, locale) }}
      />
      <p>
        {chaotic
          ? t("experiments.chaos.sweet.chaotic", {
              lambda: formatNumber(measured.exponent, 2, locale),
              doubling: formatNumber(Math.log(2) / measured.exponent, 2, locale),
            })
          : t("experiments.chaos.sweet.regular", { lambda: formatNumber(measured.exponent, 3, locale) })}
      </p>
      <Figures
        tiles={[
          {
            key: "lambda",
            label: t("experiments.chaos.figures.lambda"),
            value: measured.exponent,
            digits: 2,
            unit: "1/s",
          },
          {
            key: "period",
            label: t("experiments.chaos.figures.slow"),
            value: (2 * Math.PI) / slow,
            digits: 2,
            unit: "s",
          },
        ]}
      />
    </>
  );
}

function ChaosComputed() {
  const { t } = useTranslation();
  const c = (key: string) => t(`experiments.chaos.computed.${key}`);
  return (
    <Equation
      tex={String.raw`\ln\frac{d_{k}}{d_0}, \qquad \lambda = \frac{1}{T}\sum_k \ln\frac{d_k}{d_0}`}
      reads={c("system")}
      symbols={[
        { tex: "d_0", meaning: c("d0") },
        { tex: "d_k", meaning: c("dk") },
        { tex: "T", meaning: c("t"), unit: "s" },
      ]}
    />
  );
}
