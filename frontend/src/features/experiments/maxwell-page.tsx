import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Hand, Pause, Play } from "lucide-react";
import { AlertBanner, Button, LoadingState, ToggleGroup } from "@eifi1/ui-kit";
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
import {
  bounce,
  bounces,
  inertiaRatio,
  refusal,
  rotationShare,
  run,
  stateAt,
  type MaxwellWheel,
  type Shape,
} from "./simulate/maxwell";
import { G } from "./simulate/pendulum";
import { SIDE } from "./stage";
import { useExperimentsDefaults } from "./use-experiments";

/** Real time, a quarter, and a twentieth: the jerk at the bottom lasts some
 *  hundredths of a second, which only the slowest shows. */
const SPEEDS = [1, 0.25, 0.05] as const;
type Speed = (typeof SPEEDS)[number];
const SHAPES: readonly Shape[] = ["disc", "ring"];

const WHEEL_HUE = 2;
const ROTATION_HUE = 2;
const TRANSLATION_HUE = 6;

/**
 * Maxwell's wheel (`experiments.maxwell`): a closed form the browser port
 * (`simulate/maxwell.ts`, held to the engine by `simulate.test.ts`) answers for
 * any instant, so each frame asks where the wheel is and what the strings pull.
 * No route.
 */
export function MaxwellPage() {
  const { t } = useTranslation();
  const defaults = useExperimentsDefaults();
  const [build, setBuild] = useState<MaxwellWheel | null>(null);
  const w = build ?? defaults.data?.maxwell ?? null;
  const fine = w ? refusal(w) === null : false;
  return (
    <ExhibitFrame
      exhibit="maxwell"
      atTheExhibit={
        <>
          <p>{t("experiments.maxwell.at.wheel")}</p>
          <p>{t("experiments.maxwell.at.climbs")}</p>
        </>
      }
      whatHappens={<MaxwellModel />}
      computed={<MaxwellComputed />}
      sweetSpot={<MaxwellTrick w={fine ? w : null} />}
    >
      {defaults.isPending || !w ? (
        <BuildPending pending={defaults.isPending} error={defaults.error} />
      ) : (
        <>
          {fine ? (
            <MaxwellPlay key={JSON.stringify(w)} w={w} />
          ) : (
            <AlertBanner tone="warning">{t("experiments.maxwell.refused")}</AlertBanner>
          )}
          <MaxwellBuild w={w} onChange={setBuild} />
        </>
      )}
    </ExhibitFrame>
  );
}

/** Let go and left to bounce, for the overview. */
export function MaxwellPreview({ paused }: PreviewProps) {
  const defaults = useExperimentsDefaults();
  const w = defaults.data?.maxwell;
  return w ? <MaxwellPlay w={w} preview paused={paused} /> : <PreviewPending />;
}

/** The wheel from the front on its two strings, at true scale. */
function MaxwellView({ w, height, turns }: { w: MaxwellWheel; height: number; turns: number }) {
  const { t } = useTranslation();
  const hex = useChartHex();
  const colour = hex[WHEEL_HUE % hex.length];
  const R = w.wheel_radius_m;
  const margin = R * 0.4;
  const below = w.drop_m - height;
  const width = 2 * (R + margin);
  const angle = turns * 2 * Math.PI;
  const spokes = w.shape === "disc" ? 3 : 6;
  return (
    <svg
      viewBox={`${-width / 2} ${-margin} ${width} ${w.drop_m + R + 2 * margin}`}
      role="img"
      aria-label={t("experiments.maxwell.view")}
      className="max-h-[60dvh] w-full rounded-lg border border-subtle bg-surface-2 text-muted"
    >
      <line
        x1={-width / 2 + margin / 2}
        y1={0}
        x2={width / 2 - margin / 2}
        y2={0}
        stroke="currentColor"
        strokeWidth={4}
        vectorEffect="non-scaling-stroke"
      />
      {[-1, 1].map((side) => (
        <line
          key={side}
          x1={side * R * 0.7}
          y1={0}
          x2={side * R * 0.7}
          y2={below}
          stroke="currentColor"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <g transform={`translate(0 ${below})`}>
        {w.shape === "disc" ? (
          <circle r={R} fill={colour} opacity={0.35} />
        ) : (
          <circle r={R * 0.9} fill="none" stroke={colour} strokeWidth={R * 0.2} opacity={0.6} />
        )}
        <circle r={R} fill="none" stroke={colour} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        {Array.from({ length: spokes }, (_, k) => {
          const a = angle + (2 * Math.PI * k) / spokes;
          return (
            <line
              key={k}
              x1={0}
              y1={0}
              x2={R * Math.cos(a)}
              y2={R * Math.sin(a)}
              stroke={colour}
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
        <line
          x1={-R * 0.85}
          y1={0}
          x2={R * 0.85}
          y2={0}
          stroke="currentColor"
          strokeWidth={Math.max(2, 2)}
          vectorEffect="non-scaling-stroke"
          opacity={0.6}
        />
        <circle r={Math.max(w.axle_radius_m, R * 0.05)} className="fill-current text-primary" />
      </g>
    </svg>
  );
}

function MaxwellPlay({ w, preview = false, paused = false }: { w: MaxwellWheel } & PreviewMode) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  const clock = useRef(0);
  const [time, setTime] = useState(0);
  const [runningHere, setRunning] = useState(preview);
  const [speedHere, setSpeed] = useState<Speed>(1);
  const running = preview ? !paused : runningHere;
  const speed = preview ? 1 : speedHere;

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      // A frame's timestamp can lie a little before the effect started: never a
      // step back in time.
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      clock.current += dt * speed;
      setTime(clock.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, speed]);

  const state = stateAt(w, time);
  const view = <MaxwellView w={w} height={state.height_m} turns={state.turns} />;
  if (preview) return view;

  const letGo = () => {
    clock.current = 0;
    setTime(0);
    setRunning(true);
  };
  const weight = w.mass_kg * G;
  const k = inertiaRatio(w);
  // Rolling, the spin is v/r; in the jerk it runs on at the bottom's rate.
  const spin =
    state.phase === "jerk" ? bounces(w, state.bounce + 1)[state.bounce].bottom_speed_m_s : Math.abs(state.velocity_m_s);
  const translation = 0.5 * w.mass_kg * state.velocity_m_s ** 2;
  const rotation = 0.5 * k * w.mass_kg * spin ** 2;
  const most = Math.max(translation + rotation, 1e-9);
  return (
    <WidgetCard
      title={t("experiments.maxwell.play.title")}
      hint={t("experiments.maxwell.play.hint")}
      actions={
        <>
          <Button variant="accent" size="sm" onClick={letGo}>
            <Hand className="size-4" aria-hidden />
            {t("experiments.maxwell.play.let_go")}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setRunning(!running)}>
            {running ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
            {running ? t("experiments.maxwell.play.pause") : t("experiments.maxwell.play.run")}
          </Button>
        </>
      }
    >
      <div className={SIDE.grid}>
        <div className={SIDE.top}>
          <ToggleGroup
            label={t("experiments.maxwell.play.speed")}
            labelPlacement="above"
            size="sm"
            overflow="wrap"
            value={String(speed)}
            onChange={(v: string) => setSpeed(Number(v) as Speed)}
            options={SPEEDS.map((v) => ({
              value: String(v),
              label: t(`experiments.maxwell.play.speeds.${Math.round(v * 100)}`),
            }))}
          />
        </div>
        <div className={`${SIDE.views} mx-auto w-full max-w-sm`}>{view}</div>
        <div className={SIDE.column}>
          <p className="text-sm font-medium text-primary">{t(`experiments.maxwell.play.phases.${state.phase}`)}</p>
          <Figures
            tiles={[
              {
                key: "tension",
                label: t("experiments.maxwell.play.tension"),
                value: state.tension_n,
                digits: 1,
                unit: "N",
              },
              {
                key: "times",
                label: t("experiments.maxwell.play.weight_times"),
                value: state.tension_n / weight,
                digits: 2,
                unit: "×",
              },
              {
                key: "speed",
                label: t("experiments.maxwell.play.speed_now"),
                value: Math.abs(state.velocity_m_s) * 100,
                digits: 1,
                unit: "cm/s",
              },
            ]}
          />
          <div className="space-y-2" role="group" aria-label={t("experiments.maxwell.play.energy")}>
            {[
              [t("experiments.maxwell.play.translation"), translation, TRANSLATION_HUE],
              [t("experiments.maxwell.play.rotation"), rotation, ROTATION_HUE],
            ].map(([label, energy, hue]) => (
              <div key={label as string} className="space-y-1">
                <div className="flex justify-between text-sm text-secondary">
                  <span>{label as string}</span>
                  <span>{formatNumber((energy as number) * 1000, 0, locale)} mJ</span>
                </div>
                <div className="h-2 rounded-full bg-surface-2">
                  <div
                    className="h-2 rounded-full"
                    style={{
                      width: `${(100 * (energy as number)) / most}%`,
                      background: hex[(hue as number) % hex.length],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </WidgetCard>
  );
}

function MaxwellBuild({ w, onChange }: { w: MaxwellWheel; onChange: (next: MaxwellWheel) => void }) {
  const { t } = useTranslation();
  return (
    <WidgetCard title={t("experiments.maxwell.change.title")} hint={t("experiments.maxwell.change.hint")}>
      <ToggleGroup
        label={t("experiments.maxwell.change.shape")}
        labelPlacement="above"
        size="sm"
        value={w.shape}
        onChange={(v: Shape) => onChange({ ...w, shape: v })}
        options={SHAPES.map((s) => ({ value: s, label: t(`experiments.maxwell.change.shapes.${s}`) }))}
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SliderField
          label={t("experiments.maxwell.change.axle")}
          unit="mm"
          value={w.axle_radius_m * 1000}
          min={2}
          max={20}
          step={0.5}
          digits={1}
          hint={t("experiments.maxwell.change.axle_hint")}
          onChange={(v) => onChange({ ...w, axle_radius_m: v / 1000 })}
        />
        <SliderField
          label={t("experiments.maxwell.change.wheel")}
          unit="cm"
          value={w.wheel_radius_m * 100}
          min={3}
          max={15}
          step={0.5}
          digits={1}
          onChange={(v) => onChange({ ...w, wheel_radius_m: v / 100 })}
        />
        <SliderField
          label={t("experiments.maxwell.change.mass")}
          unit="kg"
          value={w.mass_kg}
          min={0.1}
          max={3}
          step={0.05}
          digits={2}
          onChange={(v) => onChange({ ...w, mass_kg: v })}
        />
        <SliderField
          label={t("experiments.maxwell.change.drop")}
          unit="cm"
          value={w.drop_m * 100}
          min={20}
          max={100}
          step={5}
          digits={0}
          onChange={(v) => onChange({ ...w, drop_m: v / 100 })}
        />
        <SliderField
          label={t("experiments.maxwell.change.loss")}
          unit="%"
          value={w.loss * 100}
          min={0}
          max={10}
          step={0.5}
          digits={1}
          hint={t("experiments.maxwell.change.loss_hint")}
          onChange={(v) => onChange({ ...w, loss: v / 100 })}
        />
        <SliderField
          label={t("experiments.maxwell.change.stiffness")}
          unit="N/m"
          value={w.stiffness_n_m}
          min={500}
          max={100000}
          step={1}
          digits={0}
          log
          hint={t("experiments.maxwell.change.stiffness_hint")}
          onChange={(v) => onChange({ ...w, stiffness_n_m: v })}
        />
      </div>
    </WidgetCard>
  );
}

function MaxwellModel() {
  const { t } = useTranslation();
  const s = (key: string) => t(`experiments.maxwell.symbols.${key}`);
  return (
    <>
      <p>{t("experiments.maxwell.model.intro")}</p>
      <Equation
        tex={String.raw`a = \frac{g}{1 + k}, \qquad k = \frac{I}{M\,r^2}`}
        reads={t("experiments.maxwell.model.roll")}
        symbols={[
          { tex: "a", meaning: s("a"), unit: "m/s²" },
          { tex: "g", meaning: s("g"), unit: "m/s²" },
          { tex: "I", meaning: s("i"), unit: "kg·m²" },
          { tex: "M", meaning: s("m"), unit: "kg" },
          { tex: "r", meaning: s("r"), unit: "m" },
        ]}
      />
      <Equation
        tex={String.raw`T = M\,(g - a)`}
        reads={t("experiments.maxwell.model.tension")}
        symbols={[{ tex: "T", meaning: s("t"), unit: "N" }]}
      />
      <Equation
        tex={String.raw`\frac{E_{\text{spin}}}{E_{\text{motion}}} = \frac{k}{1 + k}`}
        reads={t("experiments.maxwell.model.share")}
        symbols={[]}
      />
    </>
  );
}

function MaxwellTrick({ w }: { w: MaxwellWheel | null }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  const s = (key: string) => t(`experiments.maxwell.symbols.${key}`);
  const rows = useMemo(() => {
    if (!w) return [];
    const first = bounce(w, w.drop_m);
    const cycle = first.fall_s + first.jerk_s + first.climb_s;
    const r = run(w, Math.min(2 * cycle, 60), 400);
    return r.t.map((time, i) => ({ t: time, height: r.height_m[i] * 100, tension: r.tension_n[i] }));
  }, [w]);
  if (!w) return <LoadingState className="py-6" label={t("common.loading")} />;
  const b = bounces(w, 2);
  const weight = w.mass_kg * G;
  return (
    <>
      <p>{t("experiments.maxwell.sweet.spin", { share: formatNumber(rotationShare(w) * 100, 1, locale) })}</p>
      <Equation
        tex={String.raw`T_{\max} = M g + s\,A, \qquad A = \sqrt{\left(\frac{g}{w^2}\right)^2 + \left(\frac{v}{w}\right)^2}, \quad w = \sqrt{\frac{s}{M}}`}
        reads={t("experiments.maxwell.sweet.jerk", {
          peak: formatNumber(b[0].peak_tension_n, 1, locale),
          times: formatNumber(b[0].peak_tension_n / weight, 1, locale),
          ms: formatNumber(b[0].jerk_s * 1000, 0, locale),
        })}
        symbols={[
          { tex: "s", meaning: s("s"), unit: "N/m" },
          { tex: "v", meaning: s("v"), unit: "m/s" },
        ]}
      />
      <SeriesChart
        rows={rows}
        series={[
          {
            key: "height",
            label: t("experiments.maxwell.chart.height"),
            color: hex[WHEEL_HUE % hex.length],
            axis: "height",
          },
          {
            key: "tension",
            label: t("experiments.maxwell.chart.tension"),
            color: hex[TRANSLATION_HUE % hex.length],
            axis: "tension",
          },
        ]}
        axes={[
          {
            id: "height",
            title: `${t("experiments.maxwell.chart.height")} (cm)`,
            orientation: "left",
            format: (v) => formatNumber(v, 0, locale),
          },
          {
            id: "tension",
            title: `${t("experiments.maxwell.chart.tension")} (N)`,
            orientation: "right",
            format: (v) => formatNumber(v, 0, locale),
            includeZero: true,
          },
        ]}
        x={{
          key: "t",
          title: `${t("experiments.maxwell.chart.time")} (s)`,
          format: (v) => formatNumber(v, 0, locale),
        }}
      />
      <p>
        {t("experiments.maxwell.sweet.climbs", { share: formatNumber((b[0].to_m / b[0].from_m) * 100, 0, locale) })}
      </p>
      <Figures
        tiles={[
          { key: "fall", label: t("experiments.maxwell.figures.fall"), value: b[0].fall_s, digits: 2, unit: "s" },
          {
            key: "spin",
            label: t("experiments.maxwell.figures.spin"),
            value: b[0].bottom_spin_hz,
            digits: 1,
            unit: t("experiments.maxwell.play.spin_unit"),
          },
          {
            key: "peak",
            label: t("experiments.maxwell.figures.peak"),
            value: b[0].peak_tension_n,
            digits: 1,
            unit: "N",
          },
          {
            key: "stretch",
            label: t("experiments.maxwell.figures.stretch"),
            value: b[0].stretch_m * 1000,
            digits: 1,
            unit: "mm",
          },
        ]}
      />
    </>
  );
}

function MaxwellComputed() {
  const { t } = useTranslation();
  const c = (key: string) => t(`experiments.maxwell.computed.${key}`);
  return (
    <Equation
      tex={String.raw`z(t) = -\frac{g}{w^2}\bigl(1 - \cos wt\bigr) - \frac{v}{w}\sin wt`}
      reads={c("system")}
      symbols={[{ tex: "z", meaning: c("z"), unit: "m" }]}
    />
  );
}
