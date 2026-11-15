import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pause, Play, RotateCcw } from "lucide-react";
import { AlertBanner, Button, LoadingState, ToggleGroup } from "@eifi1/ui-kit";
import { apiErrorMessage } from "@/shared/api/client";
import { SeriesChart } from "@/shared/charts/series-chart";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber } from "@/shared/lib/format";
import { useChartHex } from "@/shared/state/palette-store";
import { SliderField } from "@/shared/ui/slider-field";
import { Figures, WidgetCard } from "@/shared/ui/widget";
import { Equation } from "./equation";
import { ExhibitFrame } from "./exhibit-frame";
import { PreviewPending, type PreviewMode, type PreviewProps } from "./preview-mode";
import {
  STEP_TAU,
  cupLevel,
  hopfRho,
  regime,
  run,
  startWheel,
  steadyX,
  stepWheel,
  type WaterWheel,
} from "./simulate/waterwheel";
import { STAGE } from "./stage";
import { useExperimentsDefaults } from "./use-experiments";

const SPEEDS = [1, 4] as const;
type Speed = (typeof SPEEDS)[number];

/** Cups round the rim. */
const CUPS = 8;
/** The butterfly's trail: this many seconds of the wheel's state. */
const TRAIL_S = 60;

const WATER_HUE = 0;
const WHEEL_HUE = 2;

/** Turns a minute from radians a second. */
const RPM = 60 / (2 * Math.PI);

/**
 * The chaotic waterwheel (`experiments.waterwheel`): Lorenz's equations with
 * b = 1 stepped by the browser port (`simulate/waterwheel.ts`, held to the
 * engine by `simulate.test.ts`) and turned back into the wheel — its turn and
 * how full each cup is — and into Lorenz's butterfly beside it. No route.
 */
export function WaterwheelPage() {
  const { t } = useTranslation();
  const defaults = useExperimentsDefaults();
  const [build, setBuild] = useState<WaterWheel | null>(null);
  const w = build ?? defaults.data?.waterwheel ?? null;
  return (
    <ExhibitFrame
      exhibit="waterwheel"
      atTheExhibit={
        <>
          <p>{t("experiments.waterwheel.at.wheel")}</p>
          <p>{t("experiments.waterwheel.at.never")}</p>
        </>
      }
      whatHappens={<WaterwheelModel />}
      computed={<WaterwheelComputed />}
      sweetSpot={<WaterwheelTrick w={w} />}
    >
      {defaults.isPending ? (
        <LoadingState className="py-10" label={t("common.loading")} />
      ) : !w ? (
        <AlertBanner tone="danger">{apiErrorMessage(defaults.error, t("experiments.failed"))}</AlertBanner>
      ) : (
        <WaterwheelPlay key={JSON.stringify(w)} w={w} onChange={setBuild} />
      )}
    </ExhibitFrame>
  );
}

/** The default tap, four times real time, for the overview. */
export function WaterwheelPreview({ paused }: PreviewProps) {
  const defaults = useExperimentsDefaults();
  const w = defaults.data?.waterwheel;
  return w ? <WaterwheelPlay w={w} preview paused={paused} /> : <PreviewPending />;
}

function WheelView({ w, angle, y, z }: { w: WaterWheel; angle: number; y: number; z: number }) {
  const { t } = useTranslation();
  const hex = useChartHex();
  const water = hex[WATER_HUE % hex.length];
  const wheel = hex[WHEEL_HUE % hex.length];
  const R = 1;
  const cup = 0.22;
  const stream = Math.min(0.08, 0.01 + w.rho * 0.002);
  return (
    <svg
      viewBox="-1.45 -1.55 2.9 3"
      role="img"
      aria-label={t("experiments.waterwheel.views.wheel")}
      className="aspect-square w-full rounded-lg border border-subtle bg-surface-2 text-muted"
    >
      {/* The tap, and the water falling into the top. */}
      <rect x={-0.12} y={-1.55} width={0.24} height={0.12} className="fill-current" opacity={0.6} />
      {w.rho > 0 && <rect x={-stream / 2} y={-1.43} width={stream} height={0.3} fill={water} opacity={0.7} />}
      <circle r={R} fill="none" stroke={wheel} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      <circle r={0.05} className="fill-current text-primary" />
      {Array.from({ length: CUPS }, (_, k) => {
        // θ from the top, clockwise as the wheel turns positive.
        const theta = angle + (2 * Math.PI * k) / CUPS;
        const cx = R * Math.sin(theta);
        const cy = -R * Math.cos(theta);
        const level = cupLevel(w, y, z, theta);
        return (
          <g key={k}>
            <line
              x1={0}
              y1={0}
              x2={cx}
              y2={cy}
              stroke={wheel}
              opacity={0.4}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            {/* The cups hang upright, whatever the wheel's turn. */}
            <rect
              x={cx - cup / 2}
              y={cy - cup / 2}
              width={cup}
              height={cup}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
            <rect
              x={cx - cup / 2}
              y={cy + cup / 2 - cup * level}
              width={cup}
              height={cup * level}
              fill={water}
              opacity={0.75}
            />
          </g>
        );
      })}
    </svg>
  );
}

function ButterflyView({ trail, w }: { trail: Array<[number, number]>; w: WaterWheel }) {
  const { t } = useTranslation();
  const hex = useChartHex();
  const spread = Math.max(10, Math.sqrt(Math.max(w.rho, 1)) * 4);
  const top = Math.max(20, w.rho * 1.9);
  const last = trail[trail.length - 1];
  return (
    <svg
      viewBox={`${-spread} ${-top} ${2 * spread} ${top * 1.05}`}
      role="img"
      aria-label={t("experiments.waterwheel.views.butterfly")}
      className="aspect-square w-full rounded-lg border border-subtle bg-surface-2 text-muted"
    >
      <polyline
        points={trail.map(([x, z]) => `${x},${-z}`).join(" ")}
        fill="none"
        stroke={hex[WHEEL_HUE % hex.length]}
        opacity={0.6}
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      {last && <circle cx={last[0]} cy={-last[1]} r={spread * 0.03} className="fill-current text-primary" />}
    </svg>
  );
}

function WaterwheelPlay({
  w,
  onChange,
  preview = false,
  paused = false,
}: { w: WaterWheel; onChange?: (next: WaterWheel) => void } & PreviewMode) {
  const { t } = useTranslation();
  const sim = useRef({ state: startWheel(), owed: 0, trail: [] as Array<[number, number]> });
  const [runningHere, setRunning] = useState(true);
  const [speedHere, setSpeed] = useState<Speed>(1);
  const [frame, setFrame] = useState(() => ({ y: [1e-3, 0, 0], angle: 0, trail: [] as Array<[number, number]> }));
  const running = preview ? !paused : runningHere;
  const speed = preview ? 4 : speedHere;

  useEffect(() => {
    if (!running) return;
    const keep = Math.round((TRAIL_S * w.leak_per_s) / (STEP_TAU * 2));
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      const s = sim.current;
      s.owed += (dt * speed * w.leak_per_s) / STEP_TAU;
      const steps = Math.floor(s.owed);
      s.owed -= steps;
      for (let k = 0; k < steps; k++) {
        stepWheel(w, s.state);
        if (s.state.i % 2 === 0) {
          s.trail.push([s.state.y[0], s.state.y[2]]);
          if (s.trail.length > keep) s.trail.shift();
        }
      }
      setFrame({ y: s.state.y, angle: s.state.angle, trail: [...s.trail] });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, speed, w]);

  const wheel = <WheelView w={w} angle={frame.angle} y={frame.y[1]} z={frame.y[2]} />;
  if (preview) return wheel;
  const restart = () => {
    sim.current = { state: startWheel(), owed: 0, trail: [] };
    setFrame({ y: [1e-3, 0, 0], angle: 0, trail: [] });
  };
  const rate = frame.y[0] * w.leak_per_s * RPM;
  return (
    <WidgetCard
      title={t("experiments.waterwheel.play.title")}
      hint={t("experiments.waterwheel.play.hint")}
      actions={
        <>
          <Button variant="secondary" size="sm" onClick={() => setRunning(!running)}>
            {running ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
            {running ? t("experiments.waterwheel.play.pause") : t("experiments.waterwheel.play.run")}
          </Button>
          <Button variant="secondary" size="sm" onClick={restart}>
            <RotateCcw className="size-4" aria-hidden />
            {t("experiments.waterwheel.play.restart")}
          </Button>
        </>
      }
    >
      <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${STAGE.two}`}>
        <figure className="space-y-1">
          {wheel}
          <figcaption className="text-center text-caption text-muted">
            {t("experiments.waterwheel.views.wheel_caption")}
          </figcaption>
        </figure>
        <figure className="space-y-1">
          <ButterflyView trail={frame.trail} w={w} />
          <figcaption className="text-center text-caption text-muted">
            {t("experiments.waterwheel.views.butterfly_caption")}
          </figcaption>
        </figure>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SliderField
          label={t("experiments.waterwheel.play.tap")}
          unit="ρ"
          value={w.rho}
          min={0}
          max={40}
          step={0.5}
          digits={1}
          hint={t("experiments.waterwheel.play.tap_hint")}
          onChange={(v) => onChange?.({ ...w, rho: v })}
        />
        <SliderField
          label={t("experiments.waterwheel.play.brake")}
          unit="σ"
          value={w.sigma}
          min={4}
          max={20}
          step={0.5}
          digits={1}
          hint={t("experiments.waterwheel.play.brake_hint")}
          onChange={(v) => onChange?.({ ...w, sigma: v })}
        />
      </div>
      <ToggleGroup
        label={t("experiments.waterwheel.play.speed")}
        labelPlacement="above"
        size="sm"
        value={String(speed)}
        onChange={(v: string) => setSpeed(Number(v) as Speed)}
        options={SPEEDS.map((v) => ({ value: String(v), label: t(`experiments.waterwheel.play.speeds.${v}`) }))}
      />
      <p className="text-sm font-medium text-primary">{t(`experiments.waterwheel.play.regime_${regime(w)}`)}</p>
      <Figures
        tiles={[
          {
            key: "rate",
            label: t("experiments.waterwheel.play.rate"),
            value: rate,
            digits: 1,
            unit: t("experiments.waterwheel.play.rpm"),
          },
          {
            key: "hopf",
            label: t("experiments.waterwheel.play.hopf"),
            value: hopfRho(w),
            digits: 1,
            unit: "ρ",
          },
        ]}
      />
    </WidgetCard>
  );
}

function WaterwheelModel() {
  const { t } = useTranslation();
  const s = (key: string) => t(`experiments.waterwheel.symbols.${key}`);
  return (
    <>
      <p>{t("experiments.waterwheel.model.intro")}</p>
      <Equation
        tex={String.raw`\dot A = \Omega B - K A, \quad \dot B = -\Omega A + q - K B, \quad I\dot\Omega = -\nu\Omega + \pi g r A`}
        reads={t("experiments.waterwheel.model.wheel")}
        symbols={[
          { tex: "A, B", meaning: s("ab"), unit: "kg/rad" },
          { tex: String.raw`\Omega`, meaning: s("omega"), unit: "1/s" },
          { tex: "K", meaning: s("k"), unit: "1/s" },
          { tex: "q", meaning: s("q"), unit: "kg/(rad·s)" },
          { tex: String.raw`\nu`, meaning: s("nu"), unit: "N·m·s" },
          { tex: "I", meaning: s("i"), unit: "kg·m²" },
          { tex: "r", meaning: s("r"), unit: "m" },
        ]}
      />
      <Equation
        tex={String.raw`\dot x = \sigma(y - x), \quad \dot y = x(\rho - z) - y, \quad \dot z = x y - z`}
        reads={t("experiments.waterwheel.model.lorenz")}
        symbols={[
          { tex: "x", meaning: s("x") },
          { tex: "y, z", meaning: s("yz") },
          { tex: String.raw`\sigma = \frac{\nu}{K I}`, meaning: s("sigma") },
          { tex: String.raw`\rho = \frac{\pi g r q}{\nu K^2}`, meaning: s("rho") },
        ]}
      />
      <Equation
        tex={String.raw`\rho_H = \frac{\sigma(\sigma + 4)}{\sigma - 2}`}
        reads={t("experiments.waterwheel.model.hopf")}
        symbols={[]}
      />
    </>
  );
}

function WaterwheelTrick({ w }: { w: WaterWheel | null }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  const runs = useMemo(() => {
    if (!w) return null;
    const r = run(w, 200);
    return {
      rows: r.t.flatMap((time, i) => (i % 2 === 0 ? [{ t: time, rate: r.rate_rad_s[i] * RPM }] : [])),
      reversals: r.reversals_s.length,
    };
  }, [w]);
  if (!w || !runs) return <LoadingState className="py-6" label={t("common.loading")} />;
  const steady = steadyX(w);
  return (
    <>
      <p>{t("experiments.waterwheel.sweet.lorenz")}</p>
      <SeriesChart
        rows={runs.rows}
        series={[{ key: "rate", label: t("experiments.waterwheel.play.rate"), color: hex[WHEEL_HUE % hex.length] }]}
        axes={[
          {
            id: "y",
            title: `${t("experiments.waterwheel.play.rate")} (${t("experiments.waterwheel.play.rpm")})`,
            format: (v) => formatNumber(v, 0, locale),
          },
        ]}
        x={{
          key: "t",
          title: `${t("experiments.waterwheel.chart.time")} (s)`,
          format: (v) => formatNumber(v, 0, locale),
        }}
      />
      <p>
        {regime(w) === "chaotic"
          ? t("experiments.waterwheel.sweet.chaotic", { reversals: runs.reversals })
          : regime(w) === "steady"
            ? t("experiments.waterwheel.sweet.steady", {
                rpm: formatNumber((steady ?? 0) * w.leak_per_s * RPM, 1, locale),
              })
            : t("experiments.waterwheel.sweet.still")}
      </p>
    </>
  );
}

function WaterwheelComputed() {
  const { t } = useTranslation();
  const c = (key: string) => t(`experiments.waterwheel.computed.${key}`);
  return (
    <Equation
      tex={String.raw`\tau = K t, \quad x = \frac{\Omega}{K}, \quad y = c A, \quad z = \rho - c B, \quad c = \frac{\pi g r}{\nu K}`}
      reads={c("system")}
      symbols={[{ tex: String.raw`\tau`, meaning: c("tau") }]}
    />
  );
}
