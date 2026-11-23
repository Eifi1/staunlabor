import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Hand } from "lucide-react";
import { Button, LoadingState, ToggleGroup, useDebounce } from "@eifi1/ui-kit";
import { logAxis } from "@/shared/charts/log-axis";
import { SeriesChart } from "@/shared/charts/series-chart";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber, formatPowerOfTen } from "@/shared/lib/format";
import { useChartHue } from "@/shared/state/palette-store";
import { SliderField } from "@/shared/ui/slider-field";
import { Figures, WidgetCard } from "@/shared/ui/widget";
import { Equation } from "./equation";
import { ExhibitFrame } from "./exhibit-frame";
import { BuildPending } from "./build-pending";
import { sameBuild, settingNumber, useCheckSetting, useTakeCheckRequest, type CheckSetting } from "./check-setting";
import { useFrameLoop, useRunning } from "./play";
import { RunPauseButton, SpeedToggle } from "./play-controls";
import { PreviewPending, type PreviewMode, type PreviewProps } from "./preview-mode";
import {
  lyapunov,
  modeRates,
  rhs,
  run,
  separation,
  startState,
  stepFor,
  twinOf,
  type DoublePendulum,
} from "./simulate/chaos";
import { SIDE, VIEW_FRAME } from "./stage";
import { useExperimentsDefaults } from "./use-experiments";
import { rk4 } from "./simulate/numerics";

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
/** How often the trail takes a point, seconds. */
const TRAIL_EVERY_S = 0.01;

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
/** The build and the start a check case's setting asks for, the rest as they are. */
function chaosOf(dp: DoublePendulum, start: Start, setting: CheckSetting): { dp: DoublePendulum; start: Start } {
  return {
    dp: {
      ...dp,
      length1_m: settingNumber(setting, "length1_m", dp.length1_m),
      length2_m: settingNumber(setting, "length2_m", dp.length2_m),
      mass1_kg: settingNumber(setting, "mass1_kg", dp.mass1_kg),
      mass2_kg: settingNumber(setting, "mass2_kg", dp.mass2_kg),
      damping_per_s: settingNumber(setting, "damping_per_s", dp.damping_per_s),
    },
    start: {
      ...start,
      upper: settingNumber(setting, "upper", start.upper),
      lower: settingNumber(setting, "lower", start.lower),
    },
  };
}

export function ChaosPage() {
  const { t } = useTranslation();
  const defaults = useExperimentsDefaults();
  const [build, setBuild] = useState<DoublePendulum | null>(null);
  const [start, setStart] = useState<Start>(PRESETS.wild);
  const [nudge, setNudge] = useState<Nudge>(0.001);
  const dp = build ?? defaults.data?.chaos ?? null;
  // A check case's "Set it up": the build and the start here (the slow mode's
  // lower arm at √2°, finer than the start slider's whole degrees); the play,
  // built anew for them or already on them, lets go.
  useTakeCheckRequest("chaos", dp, (setting, current) => {
    const next = chaosOf(current, start, setting);
    if (!sameBuild(next.dp, current)) setBuild(next.dp);
    if (!sameBuild(next.start, start)) setStart(next.start);
  });
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
      {defaults.isPending || !dp ? (
        <BuildPending pending={defaults.isPending} error={defaults.error} />
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
  const hue = useChartHue();
  const reach = (dp.length1_m + dp.length2_m) * 1.1;
  const bob = reach * 0.035;
  const draw = (y: readonly number[], index: number, opacity: number) => {
    const [p1, p2] = arms(dp, y);
    const colour = hue(index);
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
      className={`aspect-square ${VIEW_FRAME}`}
    >
      <polyline
        points={trail.map(([x, y]) => `${x},${y}`).join(" ")}
        fill="none"
        stroke={hue(MAIN_HUE)}
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
  const { running, setRunning } = useRunning({ preview, paused, initially: false });
  const [speedHere, setSpeed] = useState<Speed>(1);
  const [frame, setFrame] = useState(begin);
  const speed = preview ? 1 : speedHere;

  // The engine's step for this build and start: 1 ms, or a part of it where a
  // light upper arm whips round.
  const stepping = useMemo(() => {
    const h = stepFor(dp, start.upper, start.lower);
    return { f: rhs(dp), h, per: Math.round(TRAIL_EVERY_S / h) };
  }, [dp, start.upper, start.lower]);
  useFrameLoop(running, (dt) => {
    const { f, h, per } = stepping;
    const keep = Math.round(TRAIL_S / TRAIL_EVERY_S);
    const s = sim.current;
    s.owed += (dt * speed) / h;
    const steps = Math.floor(s.owed);
    s.owed -= steps;
    for (let k = 0; k < steps; k++) {
      s.a = rk4(f, s.clock, s.a, h);
      s.b = rk4(f, s.clock, s.b, h);
      s.clock += h;
      s.i += 1;
      if (s.i % per === 0) {
        s.trail.push(arms(dp, s.a)[1]);
        if (s.trail.length > keep) s.trail.shift();
      }
    }
    // The preview starts again after a while: its two have long parted.
    if (preview && s.clock > 20) sim.current = begin();
    setFrame({ ...sim.current, trail: [...sim.current.trail] });
  });
  useCheckSetting("chaos", (setting) => {
    if (preview || !sameBuild(chaosOf(dp, start, setting), { dp, start })) return false;
    sim.current = begin();
    setFrame({ ...sim.current });
    setRunning(true);
    return true;
  });

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
          <RunPauseButton running={running} onToggle={() => setRunning(!running)} />
        </>
      }
    >
      <div className={`${SIDE.grid} ${SIDE.cap.xl}`}>
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
          <SpeedToggle speeds={SPEEDS} value={speed} onChange={setSpeed} />
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
  const hue = useChartHue();
  // Asked again only once the sliders have held still: a measurement is half a
  // minute of two pendulums stepped a millisecond at a time.
  const settled = useDebounce({ dp, start, nudge }, 300, { key: JSON.stringify({ dp, start, nudge }) });
  const measured = useMemo(() => {
    if (!settled.dp) return null;
    const r = run(settled.dp, settled.start.upper, settled.start.lower, 20, settled.nudge);
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
        series={[{ key: "gap", label: t("experiments.chaos.chart.gap"), color: hue(MAIN_HUE) }]}
        axes={[logAxis("y", t("experiments.chaos.chart.gap"), locale)]}
        x={{ key: "t", title: `${t("experiments.chaos.chart.time")} (s)`, format: (v) => formatNumber(v, 0, locale) }}
      />
      <p>
        {chaotic
          ? t("experiments.chaos.sweet.chaotic", {
              // One decimal: half a minute is one stretch of one path, a few
              // tenths either way (the step alone moves it from 2.4 to 3.1).
              lambda: formatNumber(measured.exponent, 1, locale),
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
            digits: 1,
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
