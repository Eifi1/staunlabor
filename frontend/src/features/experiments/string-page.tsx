import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LoadingState, StaticLegend, seriesLegendEntries } from "@eifi1/ui-kit";
import { SeriesChart } from "@/shared/charts/series-chart";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber } from "@/shared/lib/format";
import { useChartHue } from "@/shared/state/palette-store";
import { SliderField } from "@/shared/ui/slider-field";
import { Figures, WidgetCard } from "@/shared/ui/widget";
import { Equation } from "./equation";
import { ExhibitFrame } from "./exhibit-frame";
import { BuildPending } from "./build-pending";
import { settingNumber, useCheckSetting } from "./check-setting";
import { HeldAnswer, useHeld } from "./held";
import { useFrameLoop, useRunning } from "./play";
import { RestartButton, RunPauseButton } from "./play-controls";
import { PreviewPending, type PreviewMode, type PreviewProps } from "./preview-mode";
import {
  halfWaves,
  modeHz,
  pullN,
  start,
  step,
  strobeM,
  swingM,
  VIBRATOR_HZ,
  waveSpeedMS,
  widestM,
  type Cord,
  type Shaking,
} from "./simulate/string";
import { SIDE, STAGE, VIEW_FRAME } from "./stage";
import { useExperimentsDefaults } from "./use-experiments";

/** The hand's pull on its logarithmic slider, N: from eight loops at the
 *  vibrator's hundred hertz to one. */
const PULL_MIN = 0.3;
const PULL_MAX = 25;
/** The vibrator's tone on its slider, Hz. */
const TONE_MIN = 20;
const TONE_MAX = 200;
/** The drawing is this many times as high as the cord's swing: true to scale,
 *  a swing of two centimetres on a metre of cord is a hair on a phone. Said in
 *  the caption. */
const TALLER = 3;
/** Places along the cord the drawing reads. */
const POINTS = 97;
/** The strobe lamp's slip: the cord drawn as a lamp this many hertz off the
 *  tone shows it. */
const STROBE_HZ = 0.6;
/** A swing this many times the vibrator's own is a pattern plainly found: the
 *  chart comes out then. */
const FOUND = 4;
/** The chart over the half-waves, and its points. */
const HALF_WAVES_MAX = 8;
const CHART_POINTS = 640;
/** The trick's three pulls, each four times the last, and the tones it spans. */
const TRICK_PULLS = [1.25, 5, 20];
const TRICK_HUES = [2, 0, 4];
const BLUR_HUE = 0;
const STROBE_HUE = 3;
/** The peg's radius in the drawing, m. */
const PEG_M = 0.025;

interface Sim {
  s: Shaking;
  tone: number;
  /** The strobe's phase, turning at `STROBE_HZ`. */
  phase: number;
}

/**
 * The standing string (`experiments.string`): a cord a vibrator shakes at one
 * end, pulled over a peg by the reader's hand. From the browser port
 * (`simulate/string.ts`, held to the engine by `simulate.test.ts`), stepped
 * as the reader pulls and turns the tone. No route.
 */
export function StringPage() {
  const { t } = useTranslation();
  const defaults = useExperimentsDefaults();
  const [built, setBuilt] = useState<Cord | null>(null);
  const cord = built ?? defaults.data?.string ?? null;
  return (
    <ExhibitFrame
      exhibit="string"
      atTheExhibit={
        <>
          <p>{t("experiments.string.at.cord")}</p>
          <p>{t("experiments.string.at.loops")}</p>
        </>
      }
      whatHappens={<StringModel />}
      computed={<StringComputed />}
      sweetSpot={cord ? <StringTrick cord={cord} /> : <LoadingState className="py-6" label={t("common.loading")} />}
    >
      {defaults.isPending || !cord ? (
        <BuildPending pending={defaults.isPending} error={defaults.error} />
      ) : (
        <>
          <StringPlay cord={cord} onChange={setBuilt} />
          <StringBuild cord={cord} onChange={setBuilt} />
        </>
      )}
    </ExhibitFrame>
  );
}

/** The cord pulled for three loops at the vibrator's tone, for the overview. */
export function StringPreview({ paused }: PreviewProps) {
  const defaults = useExperimentsDefaults();
  const cord = defaults.data?.string;
  if (!cord) return <PreviewPending />;
  const three = { ...cord, tension_n: pullN(cord, VIBRATOR_HZ, 3) };
  return <StringPlay cord={three} preview paused={paused} />;
}

/** The drawing's half-height, m: a little above the widest a single loop can
 *  swing on this cord at the strongest pull, so the drawing keeps its scale
 *  while the hand pulls. */
function halfHeightM(cord: Cord): number {
  const strongest = { ...cord, tension_n: PULL_MAX };
  const limit = (2 * waveSpeedMS(strongest) * cord.drive_m) / (cord.damping_per_s * cord.length_m);
  return Math.max(0.02, 1.2 * limit);
}

/** The vibrator, the cord's blur and its strobed line, the peg and the hand's pull. */
function CordView({ cord, s, tone, phase }: { cord: Cord; s: Shaking; tone: number; phase: number }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hue = useChartHue();
  const half = TALLER * halfHeightM(cord);
  const left = -0.18;
  const width = cord.length_m + 0.36;
  const top = -half - 0.03;
  const height = 2 * half + 0.06;
  const xs = Array.from({ length: POINTS }, (_, k) => (cord.length_m * k) / (POINTS - 1));
  const swings = xs.map((x) => TALLER * swingM(cord, s, tone, x));
  // The lamp flashes where the vibrator's phase is the strobe's: the cord at
  // the strobe's phase whatever the frame caught of the fast swing.
  const line = xs.map((x) => -TALLER * strobeM(cord, s, tone, x, phase - s.theta));
  const blur = [...xs.map((x, k) => `${x},${-swings[k]}`), ...xs.map((x, k) => `${x},${swings[k]}`).reverse()].join(
    " ",
  );
  const end = line[0];
  const peg = cord.length_m;
  return (
    <svg
      viewBox={`${left} ${top} ${width} ${height}`}
      role="img"
      aria-label={t("experiments.string.view")}
      className={`${VIEW_FRAME} ${STAGE.wide}`}
    >
      <rect x={-0.15} y={-0.07} width={0.12} height={0.14} rx={0.015} className="fill-current" opacity={0.45} />
      <line
        x1={-0.03}
        y1={end}
        x2={0}
        y2={end}
        stroke="currentColor"
        strokeWidth={4}
        vectorEffect="non-scaling-stroke"
      />
      <polygon points={blur} fill={hue(BLUR_HUE)} fillOpacity={0.25} stroke="none" />
      <polyline
        points={xs.map((x, k) => `${x},${line[k]}`).join(" ")}
        fill="none"
        stroke={hue(STROBE_HUE)}
        strokeWidth={2.5}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={peg} cy={PEG_M} r={PEG_M} className="fill-current" opacity={0.6} />
      <line
        x1={peg + PEG_M}
        y1={PEG_M}
        x2={peg + PEG_M}
        y2={half - 0.02}
        stroke={hue(STROBE_HUE)}
        strokeWidth={2.5}
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={`M ${peg + PEG_M - 0.025} ${half - 0.05} L ${peg + PEG_M} ${half - 0.005} L ${peg + PEG_M + 0.025} ${half - 0.05}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
      <text
        x={peg + PEG_M - 0.04}
        y={half - 0.03}
        fontSize={0.045}
        textAnchor="end"
        className="fill-current text-secondary"
      >
        {`${formatNumber(cord.tension_n, 2, locale)} N`}
      </text>
      <text x={-0.09} y={0.12} fontSize={0.045} textAnchor="middle" className="fill-current text-secondary">
        {`${formatNumber(tone, 0, locale)} Hz`}
      </text>
    </svg>
  );
}

function StringPlay({
  cord,
  onChange,
  preview = false,
  paused = false,
}: { cord: Cord; onChange?: (next: Cord) => void } & PreviewMode) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hue = useChartHue();
  const sim = useRef<Sim>({ s: start(), tone: VIBRATOR_HZ, phase: 0 });
  const [frame, setFrame] = useState<Sim>(() => ({ ...sim.current }));
  const held = useHeld();
  const { show } = held;
  const { running, setRunning } = useRunning({ preview, paused });

  useFrameLoop(running, (dt) => {
    const m = sim.current;
    m.s = step(cord, m.s, m.tone, dt);
    m.phase = (m.phase + 2 * Math.PI * STROBE_HZ * dt) % (2 * Math.PI);
    setFrame({ ...m });
    if (!preview) {
      const widest = Math.max(
        ...Array.from({ length: 25 }, (_, k) => swingM(cord, m.s, m.tone, (cord.length_m * k) / 24)),
      );
      if (widest >= FOUND * cord.drive_m) show();
    }
  });

  // A check case's "Set it up": the hand's pull and the vibrator's tone, the
  // cord at rest, and the run started.
  useCheckSetting("string", (setting) => {
    if (preview) return false;
    const pull = settingNumber(setting, "tension_n", cord.tension_n);
    if (pull !== cord.tension_n) onChange?.({ ...cord, tension_n: pull });
    sim.current = { s: start(), tone: settingNumber(setting, "drive_hz", sim.current.tone), phase: 0 };
    setFrame({ ...sim.current });
    setRunning(true);
    return true;
  });

  const rows = useMemo(() => {
    if (preview) return [];
    // Over the half-waves 2Lf/v that fit, at the tone: the pull for h of them
    // is μ(2Lf/h)². The whole numbers among the points, so no peak is cut short
    // between two.
    const grid = [
      ...Array.from({ length: CHART_POINTS + 1 }, (_, k) => 0.5 + ((HALF_WAVES_MAX - 0.5) * k) / CHART_POINTS),
      ...Array.from({ length: HALF_WAVES_MAX }, (_, k) => k + 1),
    ].sort((a, b) => a - b);
    return grid.map((h) => {
      const pulled = { ...cord, tension_n: pullN(cord, frame.tone, h) };
      return { h, swing: widestM(pulled, frame.tone) * 1000 };
    });
  }, [cord, frame.tone, preview]);

  const view = <CordView cord={cord} s={frame.s} tone={frame.tone} phase={frame.phase} />;
  if (preview) return view;

  const setTone = (hz: number) => {
    sim.current.tone = hz;
    setFrame({ ...sim.current });
  };
  const calm = () => {
    sim.current = { s: start(), tone: sim.current.tone, phase: 0 };
    setFrame({ ...sim.current });
  };
  const xs = Array.from({ length: 25 }, (_, k) => (cord.length_m * k) / 24);
  const widest = Math.max(...xs.map((x) => swingM(cord, frame.s, frame.tone, x)));
  const fitting = halfWaves(cord, frame.tone);
  return (
    <WidgetCard
      title={t("experiments.string.play.title")}
      hint={t("experiments.string.play.hint")}
      actions={
        <>
          <RunPauseButton running={running} onToggle={() => setRunning(!running)} />
          <RestartButton onClick={calm} label={t("experiments.string.play.calm")} />
        </>
      }
    >
      <div className={`${SIDE.grid} ${SIDE.cap["3xl"]}`}>
        <div className={`${SIDE.views} mx-auto w-full max-w-3xl`}>
          <figure className="space-y-1">
            {view}
            <figcaption className="text-center text-caption text-muted">
              {t("experiments.string.play.caption", { times: TALLER })}
            </figcaption>
          </figure>
        </div>
        <div className={SIDE.column}>
          <SliderField
            label={t("experiments.string.play.pull")}
            unit="N"
            value={cord.tension_n}
            min={PULL_MIN}
            max={PULL_MAX}
            step={0.01}
            digits={2}
            log
            hint={t("experiments.string.play.pull_hint")}
            onChange={(v) => onChange?.({ ...cord, tension_n: v })}
          />
          <SliderField
            label={t("experiments.string.play.tone")}
            unit="Hz"
            value={frame.tone}
            min={TONE_MIN}
            max={TONE_MAX}
            step={0.5}
            digits={1}
            hint={t("experiments.string.play.tone_hint")}
            onChange={setTone}
          />
          <Figures
            tiles={[
              {
                key: "widest",
                label: t("experiments.string.play.widest"),
                value: widest * 1000,
                digits: 1,
                unit: "mm",
              },
              {
                key: "stroke",
                label: t("experiments.string.play.stroke"),
                value: cord.drive_m * 1000,
                digits: 1,
                unit: "mm",
              },
              {
                key: "speed",
                label: t("experiments.string.play.speed"),
                value: waveSpeedMS(cord),
                digits: 1,
                unit: "m/s",
              },
            ]}
          />
        </div>
      </div>
      <HeldAnswer held={held}>
        <Figures
          tiles={[
            { key: "half", label: t("experiments.string.play.half_waves"), value: fitting, digits: 2 },
            {
              key: "three",
              label: t("experiments.string.play.three", { hz: formatNumber(frame.tone, 0, locale) }),
              value: pullN(cord, frame.tone, 3),
              digits: 2,
              unit: "N",
            },
          ]}
        />
        <figure className="space-y-1">
          <SeriesChart
            rows={rows}
            series={[{ key: "swing", label: t("experiments.string.chart.swing"), color: hue(BLUR_HUE) }]}
            axes={[
              {
                id: "y",
                title: `${t("experiments.string.chart.swing")} (mm)`,
                format: (v) => formatNumber(v, 0, locale),
                includeZero: true,
              },
            ]}
            x={{
              key: "h",
              title: t("experiments.string.chart.half_waves"),
              format: (v) => formatNumber(v, 0, locale),
            }}
            references={[{ axis: "x", value: Math.min(fitting, HALF_WAVES_MAX) }]}
          />
          <figcaption className="text-center text-caption text-muted">
            {t("experiments.string.chart.caption")}
          </figcaption>
        </figure>
      </HeldAnswer>
    </WidgetCard>
  );
}

function StringBuild({ cord, onChange }: { cord: Cord; onChange: (next: Cord) => void }) {
  const { t } = useTranslation();
  const c = (key: string) => t(`experiments.string.change.${key}`);
  const limit = (2 * waveSpeedMS(cord) * cord.drive_m) / (cord.damping_per_s * cord.length_m);
  return (
    <WidgetCard title={c("title")} hint={c("hint")}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SliderField
          label={c("length")}
          unit="m"
          value={cord.length_m}
          min={0.3}
          max={3}
          step={0.05}
          digits={2}
          hint={c("length_hint")}
          onChange={(v) => onChange({ ...cord, length_m: v })}
        />
        <SliderField
          label={c("density")}
          unit="g/m"
          value={cord.density_kg_m * 1000}
          min={0.3}
          max={10}
          step={0.1}
          digits={1}
          hint={c("density_hint")}
          onChange={(v) => onChange({ ...cord, density_kg_m: v / 1000 })}
        />
        <SliderField
          label={c("damping")}
          unit="1/s"
          value={cord.damping_per_s}
          min={2}
          max={40}
          step={0.5}
          digits={1}
          hint={c("damping_hint")}
          onChange={(v) => onChange({ ...cord, damping_per_s: v })}
        />
        <SliderField
          label={c("stroke")}
          unit="mm"
          value={cord.drive_m * 1000}
          min={0.5}
          max={5}
          step={0.1}
          digits={1}
          hint={c("stroke_hint")}
          onChange={(v) => onChange({ ...cord, drive_m: v / 1000 })}
        />
      </div>
      <Figures
        tiles={[
          { key: "f1", label: c("f1"), value: modeHz(cord, 1), digits: 1, unit: "Hz" },
          {
            key: "one",
            label: t("experiments.string.change.one", { hz: VIBRATOR_HZ }),
            value: pullN(cord, VIBRATOR_HZ, 1),
            digits: 2,
            unit: "N",
          },
          { key: "limit", label: c("limit"), value: limit * 1000, digits: 1, unit: "mm" },
        ]}
      />
    </WidgetCard>
  );
}

function StringModel() {
  const { t } = useTranslation();
  const s = (key: string) => t(`experiments.string.symbols.${key}`);
  return (
    <>
      <p>{t("experiments.string.model.intro")}</p>
      <Equation
        tex={String.raw`\mu\,\frac{\partial^2 y}{\partial t^2} + \mu\gamma\,\frac{\partial y}{\partial t} = T\,\frac{\partial^2 y}{\partial x^2}, \qquad y(0, t) = A\sin\Omega t, \qquad y(L, t) = 0`}
        reads={t("experiments.string.model.wave")}
        symbols={[
          { tex: "y", meaning: s("y"), unit: "m" },
          { tex: "x", meaning: s("x"), unit: "m" },
          { tex: "t", meaning: s("t"), unit: "s" },
          { tex: String.raw`\mu`, meaning: s("mu"), unit: "kg/m" },
          { tex: String.raw`\gamma`, meaning: s("gamma"), unit: "1/s" },
          { tex: "T", meaning: s("tension"), unit: "N" },
          { tex: "A", meaning: s("a"), unit: "m" },
          { tex: String.raw`\Omega = 2\pi f`, meaning: s("omega"), unit: "1/s" },
          { tex: "L", meaning: s("l"), unit: "m" },
        ]}
      />
      <Equation
        tex={String.raw`f_n = \frac{n}{2L}\sqrt{\frac{T}{\mu}} = \frac{n\,v}{2L}, \qquad T_n = \mu\left(\frac{2Lf}{n}\right)^2`}
        reads={t("experiments.string.model.tones")}
        symbols={[
          { tex: "f_n", meaning: s("fn"), unit: "Hz" },
          { tex: "n", meaning: s("n") },
          { tex: String.raw`v = \sqrt{T/\mu}`, meaning: s("v"), unit: "m/s" },
          { tex: "T_n", meaning: s("tn"), unit: "N" },
          { tex: "f", meaning: s("f"), unit: "Hz" },
        ]}
      />
      <Equation
        tex={String.raw`G(s) = \frac{\sinh\big(\kappa\,(L - x)\big)}{\sinh(\kappa L)}, \qquad \kappa = \frac{\sqrt{s^2 + \gamma s}}{v}, \qquad s_n = -\frac{\gamma}{2} \pm i\sqrt{\omega_n^2 - \frac{\gamma^2}{4}}`}
        reads={t("experiments.string.model.transfer")}
        symbols={[
          { tex: "G", meaning: s("g") },
          { tex: "s", meaning: s("s"), unit: "1/s" },
          { tex: String.raw`\kappa`, meaning: s("kappa"), unit: "1/m" },
          { tex: "s_n", meaning: s("sn"), unit: "1/s" },
          { tex: String.raw`\omega_n = 2\pi f_n`, meaning: s("omegan"), unit: "1/s" },
        ]}
      />
      <Equation
        tex={String.raw`\hat y \approx \frac{2\,v\,A}{\gamma L}`}
        reads={t("experiments.string.model.peak")}
        symbols={[{ tex: String.raw`\hat y`, meaning: s("peak"), unit: "m" }]}
      />
    </>
  );
}

function StringTrick({ cord }: { cord: Cord }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hue = useChartHue();
  const rows = useMemo(() => {
    // Each pull's own tones among the points, so no peak is cut short.
    const tones = TRICK_PULLS.flatMap((pull) => {
      const f1 = modeHz({ ...cord, tension_n: pull }, 1);
      return Array.from({ length: Math.floor(TONE_MAX / f1) }, (_, k) => (k + 1) * f1).filter((f) => f >= TONE_MIN);
    });
    const grid = [
      ...Array.from({ length: CHART_POINTS + 1 }, (_, k) => TONE_MIN + ((TONE_MAX - TONE_MIN) * k) / CHART_POINTS),
      ...tones,
    ].sort((a, b) => a - b);
    // Keys without a dot: the chart reads a dotted key as a path.
    return grid.map((hz) => ({
      hz,
      ...Object.fromEntries(TRICK_PULLS.map((pull, i) => [`p${i}`, widestM({ ...cord, tension_n: pull }, hz) * 1000])),
    }));
  }, [cord]);
  const series = TRICK_PULLS.map((pull, i) => ({
    key: `p${i}`,
    label: `${formatNumber(pull, Number.isInteger(pull) ? 0 : 2, locale)} N`,
    color: hue(TRICK_HUES[i]),
  }));
  return (
    <>
      <p>{t("experiments.string.sweet.trick")}</p>
      <p>{t("experiments.string.sweet.numbers")}</p>
      <p>{t("experiments.string.sweet.pull")}</p>
      <p className="text-sm text-secondary">{t("experiments.string.chart.tones_hint")}</p>
      <SeriesChart
        rows={rows}
        series={series}
        axes={[
          {
            id: "y",
            title: `${t("experiments.string.chart.swing")} (mm)`,
            format: (v) => formatNumber(v, 0, locale),
            includeZero: true,
          },
        ]}
        x={{
          key: "hz",
          title: `${t("experiments.string.chart.tone")} (Hz)`,
          format: (v) => formatNumber(v, 0, locale),
        }}
      />
      <StaticLegend entries={seriesLegendEntries(series)} />
    </>
  );
}

function StringComputed() {
  const { t } = useTranslation();
  const c = (key: string) => t(`experiments.string.computed.${key}`);
  return (
    <>
      <p>{c("system")}</p>
      <Equation
        tex={String.raw`y = A\sin\theta\,\Big(1 - \frac{x}{L}\Big) + \sum_{n=1}^{40} q_n \sin\frac{n\pi x}{L}, \qquad \ddot q_n + \gamma\,\dot q_n + \omega_n^2\, q_n = \frac{2A}{n\pi}\big(\Omega^2 \sin\theta - \gamma\,\Omega\cos\theta\big)`}
        reads={c("modes")}
        symbols={[
          { tex: String.raw`\theta`, meaning: t("experiments.string.symbols.theta"), unit: "rad" },
          { tex: "q_n", meaning: t("experiments.string.symbols.qn"), unit: "m" },
        ]}
      />
      <p>{c("drawing")}</p>
      <p>{c("left_out")}</p>
    </>
  );
}
