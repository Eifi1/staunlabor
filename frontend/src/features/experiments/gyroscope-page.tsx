import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Hand, Pause, Play } from "lucide-react";
import { Button, ToggleGroup } from "@eifi1/ui-kit";
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
  HANGING_DEG,
  nutationRadS,
  precessionRadS,
  start,
  step,
  STEP_S,
  suitcaseTorqueNM,
  tiltDeg,
  type Motion,
  type Release,
  type State,
  type Wheel,
} from "./simulate/gyroscope";
import { SIDE } from "./stage";
import { useExperimentsDefaults } from "./use-experiments";

const SPEEDS = [1, 0.25] as const;
type Speed = (typeof SPEEDS)[number];
type Start = "rest" | "steady";
const STARTS: readonly Start[] = ["rest", "steady"];

const WHEEL_HUE = 0;
const SPOKE_HUE = 3;
/** The camera looks down at the wheel this steeply. */
const ELEVATION = (20 * Math.PI) / 180;
/** The trace keeps the last turn round the string, sampled every 20 ms. */
const TRACE_EVERY = 20;
/** The suitcase is turned a quarter turn a second: the figure "The trick" quotes. */
const SUITCASE_DEG_S = 90;
const TO_DEG = 180 / Math.PI;

interface Sim {
  y: State;
  m: Motion;
  owed: number;
  i: number;
  /** (φ, θ) in degrees, for the trace. */
  trace: Array<[number, number]>;
  deepest: number;
  dropped: number | null;
}

function letGo(w: Wheel, release: Release): Sim {
  const [y, m] = start(w, release);
  return { y, m, owed: 0, i: 0, trace: [[0, tiltDeg(y)]], deepest: tiltDeg(y), dropped: null };
}

/** Screen coordinates of a point in the room, z up, seen a little from above. */
function seen([x, y, z]: [number, number, number]): [number, number] {
  return [y, -(z * Math.cos(ELEVATION) - x * Math.sin(ELEVATION))];
}

/**
 * The gyroscope wheel (`experiments.gyroscope`): a spinning wheel on a string,
 * from the browser port (`simulate/gyroscope.ts`, held to the engine by
 * `simulate.test.ts`), let go as the reader watches. No route.
 */
export function GyroscopePage() {
  const { t } = useTranslation();
  const defaults = useExperimentsDefaults();
  const [build, setBuild] = useState<Wheel | null>(null);
  const w = build ?? defaults.data?.gyroscope ?? null;
  return (
    <ExhibitFrame
      exhibit="gyroscope"
      atTheExhibit={
        <>
          <p>{t("experiments.gyroscope.at.wheel")}</p>
          <p>{t("experiments.gyroscope.at.suitcase")}</p>
        </>
      }
      whatHappens={<GyroscopeModel />}
      computed={<GyroscopeComputed />}
      sweetSpot={<GyroscopeTrick />}
    >
      {defaults.isPending || !w ? (
        <BuildPending pending={defaults.isPending} error={defaults.error} />
      ) : (
        <GyroscopePlay w={w} onChange={setBuild} />
      )}
    </ExhibitFrame>
  );
}

/** The spun wheel let go from rest, for the overview. */
export function GyroscopePreview({ paused }: PreviewProps) {
  const defaults = useExperimentsDefaults();
  const w = defaults.data?.gyroscope;
  return w ? <GyroscopePlay w={w} preview paused={paused} /> : <PreviewPending />;
}

function WheelView({ w, y }: { w: Wheel; y: State }) {
  const { t } = useTranslation();
  const hex = useChartHex();
  const [theta, , phi, psi] = y;
  const axis: [number, number, number] = [
    Math.sin(theta) * Math.cos(phi),
    Math.sin(theta) * Math.sin(phi),
    Math.cos(theta),
  ];
  // Across the axle: e1 level, e2 = axis × e1.
  const e1: [number, number, number] = [-Math.sin(phi), Math.cos(phi), 0];
  const e2: [number, number, number] = [
    axis[1] * e1[2] - axis[2] * e1[1],
    axis[2] * e1[0] - axis[0] * e1[2],
    axis[0] * e1[1] - axis[1] * e1[0],
  ];
  const centre = axis.map((a) => a * w.axle_m) as [number, number, number];
  const rim = (alpha: number): [number, number, number] => [
    centre[0] + w.radius_m * (Math.cos(alpha) * e1[0] + Math.sin(alpha) * e2[0]),
    centre[1] + w.radius_m * (Math.cos(alpha) * e1[1] + Math.sin(alpha) * e2[1]),
    centre[2] + w.radius_m * (Math.cos(alpha) * e1[2] + Math.sin(alpha) * e2[2]),
  ];
  const reach = w.axle_m + w.radius_m * 1.1;
  const end = axis.map((a) => a * (w.axle_m * 1.25)) as [number, number, number];
  const [cx, cy] = seen(centre);
  const [ex, ey] = seen(end);
  const ring = Array.from({ length: 49 }, (_, k) => seen(rim((k / 48) * 2 * Math.PI)).join(",")).join(" ");
  return (
    <svg
      viewBox={`${-reach} ${-reach * 1.3} ${2 * reach} ${2.4 * reach}`}
      role="img"
      aria-label={t("experiments.gyroscope.view")}
      className="aspect-square w-full rounded-lg border border-subtle bg-surface-2 text-muted"
    >
      {/* The string, from above the picture to the axle's end. */}
      <line x1={0} y1={-reach * 1.3} x2={0} y2={0} stroke="currentColor" vectorEffect="non-scaling-stroke" />
      <line
        x1={0}
        y1={0}
        x2={ex}
        y2={ey}
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {[0, 1, 2, 3, 4, 5].map((k) => {
        const [sx, sy] = seen(rim(psi + (k * Math.PI) / 3));
        return (
          <line
            key={k}
            x1={cx}
            y1={cy}
            x2={sx}
            y2={sy}
            stroke={k === 0 ? hex[SPOKE_HUE % hex.length] : "currentColor"}
            strokeWidth={k === 0 ? 2.5 : 1}
            opacity={k === 0 ? 1 : 0.6}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
      <polyline
        points={ring}
        fill="none"
        stroke={hex[WHEEL_HUE % hex.length]}
        strokeWidth={3}
        vectorEffect="non-scaling-stroke"
      />
      <circle r={reach * 0.02} className="fill-current text-primary" />
    </svg>
  );
}

/** The axle's dip against its turn round the string, over the last turn:
 *  arches with points where it stood still. */
function TraceView({ trace, from }: { trace: Array<[number, number]>; from: number }) {
  const { t } = useTranslation();
  const hex = useChartHex();
  const last = trace.length ? trace[trace.length - 1][0] : 0;
  const deepest = Math.max(1, ...trace.map(([, tilt]) => Math.abs(tilt - from))) * 1.15;
  const points = trace
    .filter(([turn]) => turn >= last - 360)
    .map(([turn, tilt]) => `${turn - last + 360},${((tilt - from) / deepest) * 100}`)
    .join(" ");
  return (
    <svg
      viewBox="-5 -10 370 120"
      role="img"
      aria-label={t("experiments.gyroscope.trace")}
      preserveAspectRatio="none"
      className="h-28 w-full rounded-lg border border-subtle bg-surface-2 text-muted"
    >
      <line
        x1={0}
        y1={0}
        x2={360}
        y2={0}
        stroke="currentColor"
        strokeDasharray="4 4"
        vectorEffect="non-scaling-stroke"
      />
      <polyline
        points={points}
        fill="none"
        stroke={hex[WHEEL_HUE % hex.length]}
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function GyroscopePlay({
  w,
  onChange,
  preview = false,
  paused = false,
}: { w: Wheel; onChange?: (next: Wheel) => void } & PreviewMode) {
  const { t } = useTranslation();
  const locale = useLocale();
  const [release, setRelease] = useState<Release>({ tilt_deg: 90, steady: false });
  const sim = useRef(letGo(w, release));
  const [frame, setFrame] = useState(() => {
    const first = letGo(w, release);
    return { y: first.y, trace: first.trace, deepest: first.deepest, dropped: first.dropped };
  });
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
      while (s.owed >= 1 && s.dropped === null) {
        s.y = step(w, s.m, s.y);
        s.owed -= 1;
        s.i += 1;
        const tilt = tiltDeg(s.y);
        if (Math.abs(tilt - release.tilt_deg) > Math.abs(s.deepest - release.tilt_deg)) s.deepest = tilt;
        if (s.i % TRACE_EVERY === 0) {
          s.trace.push([s.y[2] * TO_DEG, tilt]);
          // A turn and a little: the view shows the last one.
          while (s.trace.length > 2 && s.trace[0][0] < s.trace[s.trace.length - 1][0] - 400) s.trace.shift();
          if (s.trace.length > 4000) s.trace.shift();
        }
        if (tilt >= HANGING_DEG) s.dropped = s.i * STEP_S;
      }
      if (s.dropped !== null) s.owed = 0;
      // The preview lets go again once the wheel has turned round twice, or dropped.
      if (preview && (s.dropped !== null || s.y[2] > 4 * Math.PI)) sim.current = letGo(w, release);
      const m = sim.current;
      setFrame({ y: m.y, trace: [...m.trace], deepest: m.deepest, dropped: m.dropped });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, speed, w, release, preview]);

  const view = <WheelView w={w} y={frame.y} />;
  if (preview) return view;

  const reset = (nextW: Wheel, nextRelease: Release, go: boolean) => {
    sim.current = letGo(nextW, nextRelease);
    const m = sim.current;
    setFrame({ y: m.y, trace: [...m.trace], deepest: m.deepest, dropped: m.dropped });
    setRunning(go);
  };
  const changeRelease = (next: Release) => {
    setRelease(next);
    reset(w, next, false);
  };
  const spinning = w.rpm > 0;
  return (
    <WidgetCard
      title={t("experiments.gyroscope.play.title")}
      hint={t("experiments.gyroscope.play.hint")}
      actions={
        <>
          <Button variant="accent" size="sm" onClick={() => reset(w, release, true)}>
            <Hand className="size-4" aria-hidden />
            {t("experiments.gyroscope.play.let_go")}
          </Button>
          <Button variant="secondary" size="sm" disabled={frame.dropped !== null} onClick={() => setRunning(!running)}>
            {running ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
            {running ? t("experiments.gyroscope.play.pause") : t("experiments.gyroscope.play.run")}
          </Button>
        </>
      }
    >
      <div className={SIDE.grid}>
        <div className={`${SIDE.top} flex flex-wrap gap-4`}>
          <ToggleGroup
            label={t("experiments.gyroscope.play.start")}
            labelPlacement="above"
            size="sm"
            value={release.steady ? "steady" : "rest"}
            onChange={(v: Start) => changeRelease({ ...release, steady: v === "steady" })}
            options={STARTS.map((v) => ({ value: v, label: t(`experiments.gyroscope.play.starts.${v}`) }))}
          />
          <ToggleGroup
            label={t("experiments.gyroscope.play.speed")}
            labelPlacement="above"
            size="sm"
            value={String(speed)}
            onChange={(v: string) => setSpeed(Number(v) as Speed)}
            options={SPEEDS.map((v) => ({
              value: String(v),
              label: t(`experiments.gyroscope.play.speeds.${Math.round(v * 100)}`),
            }))}
          />
        </div>
        <div className={`${SIDE.views} mx-auto w-full max-w-xl`}>
          {view}
          <figure className="space-y-1">
            <TraceView trace={frame.trace} from={release.tilt_deg} />
            <figcaption className="text-center text-caption text-muted">
              {t("experiments.gyroscope.trace_caption")}
            </figcaption>
          </figure>
          {frame.dropped !== null && (
            <p className="text-sm font-medium text-primary" role="status">
              {t("experiments.gyroscope.play.dropped", { t: formatNumber(frame.dropped, 2, locale) })}
            </p>
          )}
        </div>
        <div className={SIDE.column}>
          <SliderField
            label={t("experiments.gyroscope.play.rpm")}
            unit={t("experiments.gyroscope.play.rpm_unit")}
            value={w.rpm}
            min={0}
            max={600}
            step={10}
            digits={0}
            onChange={(v) => {
              const next = { ...w, rpm: v };
              onChange?.(next);
              reset(next, release, false);
            }}
          />
          <SliderField
            label={t("experiments.gyroscope.play.tilt")}
            unit="°"
            value={release.tilt_deg}
            min={60}
            max={120}
            step={1}
            digits={0}
            hint={t("experiments.gyroscope.play.tilt_hint")}
            onChange={(v) => changeRelease({ ...release, tilt_deg: v })}
          />
          <Figures
            tiles={[
              {
                key: "round",
                label: t("experiments.gyroscope.play.round"),
                value: spinning ? (2 * Math.PI) / precessionRadS(w) : null,
                digits: 1,
                unit: "s",
              },
              {
                key: "nods",
                label: t("experiments.gyroscope.play.nods"),
                value: spinning ? nutationRadS(w) / (2 * Math.PI) : null,
                digits: 1,
                unit: "/s",
              },
              {
                key: "dip",
                label: t("experiments.gyroscope.play.dip"),
                value: Math.abs(frame.deepest - release.tilt_deg),
                digits: 1,
                unit: "°",
              },
              {
                key: "suitcase",
                label: t("experiments.gyroscope.play.suitcase"),
                value: suitcaseTorqueNM(w, SUITCASE_DEG_S),
                digits: 1,
                unit: "N·m",
              },
            ]}
          />
          <p className="text-sm text-secondary">{t("experiments.gyroscope.play.suitcase_hint")}</p>
        </div>
      </div>
    </WidgetCard>
  );
}

function GyroscopeModel() {
  const { t } = useTranslation();
  const s = (key: string) => t(`experiments.gyroscope.symbols.${key}`);
  return (
    <>
      <p>{t("experiments.gyroscope.model.intro")}</p>
      <Equation
        tex={String.raw`\frac{d\vec L}{dt} = \vec M`}
        reads={t("experiments.gyroscope.model.torque")}
        symbols={[
          { tex: String.raw`\vec L`, meaning: s("l"), unit: "kg·m²/s" },
          { tex: String.raw`\vec M`, meaning: s("m"), unit: "N·m" },
        ]}
      />
      <Equation
        tex={String.raw`\Omega = \frac{m\,g\,d}{I_3\,\omega_3}`}
        reads={t("experiments.gyroscope.model.precession")}
        symbols={[
          { tex: String.raw`\Omega`, meaning: s("omega_p"), unit: "1/s" },
          { tex: "m", meaning: s("mass"), unit: "kg" },
          { tex: "d", meaning: s("d"), unit: "m" },
          { tex: String.raw`I_3 = m\,r^2`, meaning: s("i3"), unit: "kg·m²" },
          { tex: String.raw`\omega_3`, meaning: s("omega3"), unit: "1/s" },
        ]}
      />
      <Equation
        tex={String.raw`I_1\ddot\theta = \sin\theta\,\bigl(I_1\dot\varphi^2\cos\theta - L_3\dot\varphi + m g d\bigr)`}
        reads={t("experiments.gyroscope.model.lagrange")}
        symbols={[
          { tex: String.raw`\theta`, meaning: s("theta"), unit: "rad" },
          { tex: String.raw`\varphi`, meaning: s("phi"), unit: "rad" },
          { tex: String.raw`I_1 = \tfrac12 m r^2 + m d^2`, meaning: s("i1"), unit: "kg·m²" },
          { tex: String.raw`L_3 = I_3\,\omega_3`, meaning: s("l"), unit: "kg·m²/s" },
        ]}
      />
      <Equation
        tex={String.raw`M = I_3\,\omega_3\,\dot\alpha`}
        reads={t("experiments.gyroscope.model.suitcase")}
        symbols={[{ tex: String.raw`\dot\alpha`, meaning: s("turn"), unit: "1/s" }]}
      />
    </>
  );
}

function GyroscopeTrick() {
  const { t } = useTranslation();
  return (
    <>
      <p>{t("experiments.gyroscope.sweet.sideways")}</p>
      <p>{t("experiments.gyroscope.sweet.nod")}</p>
      <p>{t("experiments.gyroscope.sweet.suitcase")}</p>
    </>
  );
}

function GyroscopeComputed() {
  const { t } = useTranslation();
  return (
    <>
      <p>{t("experiments.gyroscope.computed.system")}</p>
      <p>{t("experiments.gyroscope.computed.left_out")}</p>
    </>
  );
}
