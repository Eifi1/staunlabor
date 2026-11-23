import { useMemo, useRef, useState, type PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUpToLine, Hand } from "lucide-react";
import { Button, LoadingState, StaticLegend, Switch, seriesLegendEntries, useDebounce } from "@eifi1/ui-kit";
import { SeriesChart } from "@/shared/charts/series-chart";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber } from "@/shared/lib/format";
import { useChartHue } from "@/shared/state/palette-store";
import { holdTouch } from "@/shared/ui/grab";
import { SliderField } from "@/shared/ui/slider-field";
import { svgPoint } from "@/shared/ui/svg-point";
import { Figures, WidgetCard } from "@/shared/ui/widget";
import { Equation } from "./equation";
import { ExhibitFrame } from "./exhibit-frame";
import { BuildPending } from "./build-pending";
import { settingNumber, useCheckSetting, useTakeCheckRequest } from "./check-setting";
import { HeldAnswer, useHeld, type Held } from "./held";
import { useFrameLoop, useRunning } from "./play";
import { RunPauseButton, SpeedToggle } from "./play-controls";
import { PreviewPending, type PreviewMode, type PreviewProps } from "./preview-mode";
import {
  effectivePotential,
  kapitzaFrequencyHz,
  leastFrequencyHz,
  MAX_SHARE,
  ownFrequencyHz,
  pivotM,
  refusal,
  rhs,
  slowRateTop,
  stable,
  startState,
  stepFor,
  swingUpBandHz,
  type KapitzaPendulum,
} from "./simulate/kapitza";
import { rk4 } from "./simulate/numerics";
import { TO_DEG, TO_RAD } from "./simulate/python";
import { SIDE, VIEW_FRAME } from "./stage";
import { useExperimentsDefaults } from "./use-experiments";

/** Real time, and slow enough that the shaking itself can be seen. */
const SPEEDS = [1, 0.1, 0.05] as const;
type Speed = (typeof SPEEDS)[number];

/** Where "Upright" sets the rod: three degrees off the top, so a top that
 *  does not hold shows it at once. */
const UPRIGHT_DEG = 177;

/** A nudge: this much angular speed, rad/s, one way and then the other. At the
 *  page's drive it takes the rod some 20° off the top and back. */
const NUDGE_RAD_S = 2;

/** The motor has held (or not held) the rod for this long, seconds, before the
 *  answer to the page's question comes out. */
const TRIED_AFTER_S = 3;

/** Above this many shakes a second on the screen, the pivot is drawn as the
 *  blur of its travel: at 60 frames a second a faster one would strobe. */
const BLUR_HZ = 6;

/** The drives the play card offers by name: fine and fast (the page's own),
 *  wide and slow, and twice the rod's own frequency, from hanging. */
const PRESETS = {
  fast: { amplitude_m: 0.01, frequency_hz: 40, start_deg: UPRIGHT_DEG },
  slow: { amplitude_m: 0.04, frequency_hz: 9, start_deg: UPRIGHT_DEG },
  swing: { amplitude_m: 0.01, frequency_hz: 2.23, start_deg: 5 },
} as const;
type Preset = keyof typeof PRESETS;

const ROD_HUE = 2;
const GRAVITY_HUE = 0;
const SHAKE_HUE = 4;
const SUM_HUE = 2;

/** The rod's state and its own clock, which starts again whenever the drive
 *  changes, so the drive's phase stays the engine's `cos ωt` on that clock. */
interface Sim {
  y: number[];
  clock: number;
  owed: number;
  /** Time since the rod was last set upright with the motor running. */
  upright: number | null;
  /** Which way the next nudge goes. */
  side: 1 | -1;
}

/**
 * Kapitza's pendulum (`experiments.kapitza`): the rod stepped by the browser
 * port (`simulate/kapitza.ts`, held to the engine by `simulate.test.ts`), at a
 * hundredth of the drive's period, a hand nudging it or holding it out; the
 * Floquet multipliers and the least drive asked of the same port. No route.
 */
export function KapitzaPage() {
  const { t } = useTranslation();
  const defaults = useExperimentsDefaults();
  const [build, setBuild] = useState<KapitzaPendulum | null>(null);
  const [motor, setMotor] = useState(false);
  // A new play for a check case or a preset: its start comes with it.
  const [session, setSession] = useState({ n: 0, start: UPRIGHT_DEG, run: false });
  const k = build ?? defaults.data?.kapitza ?? null;
  const held = useHeld();
  useTakeCheckRequest("kapitza", k, (setting, current) => {
    const frequency = settingNumber(setting, "frequency_hz", current.frequency_hz);
    setBuild({
      ...current,
      length_m: settingNumber(setting, "length_m", current.length_m),
      amplitude_m: settingNumber(setting, "amplitude_m", current.amplitude_m),
      frequency_hz: frequency > 0 ? frequency : current.frequency_hz,
      damping_per_s: settingNumber(setting, "damping_per_s", current.damping_per_s),
    });
    setMotor(frequency > 0);
    setSession((s) => ({ n: s.n + 1, start: settingNumber(setting, "start_deg", UPRIGHT_DEG), run: false }));
  });
  const preset = (name: Preset) => {
    if (!k) return;
    const p = PRESETS[name];
    setBuild({
      ...k,
      amplitude_m: Math.min(p.amplitude_m, MAX_SHARE * k.length_m),
      frequency_hz: p.frequency_hz,
    });
    setMotor(true);
    setSession((s) => ({ n: s.n + 1, start: p.start_deg, run: true }));
  };
  // One object per build and switch: the play starts its drive's clock again
  // when this changes, so not on every render of the page.
  const driven = useMemo(() => k && { ...k, frequency_hz: motor ? k.frequency_hz : 0 }, [k, motor]);
  return (
    <ExhibitFrame
      exhibit="kapitza"
      atTheExhibit={
        <>
          <p>{t("experiments.kapitza.at.rod")}</p>
          <p>{t("experiments.kapitza.at.motor")}</p>
        </>
      }
      whatHappens={<KapitzaModel />}
      computed={<KapitzaComputed />}
      sweetSpot={<KapitzaTrick k={k && !refusal(k) ? k : null} />}
    >
      {defaults.isPending || !k || !driven ? (
        <BuildPending pending={defaults.isPending} error={defaults.error} />
      ) : (
        <>
          <KapitzaPlay
            key={session.n}
            k={driven}
            dial={k}
            motor={motor}
            startDeg={session.start}
            startRunning={session.run}
            onMotor={setMotor}
            onDial={setBuild}
            onPreset={preset}
            held={held}
          />
          <KapitzaBuild k={k} onChange={setBuild} />
        </>
      )}
    </ExhibitFrame>
  );
}

/** The rod standing on the page's drive, nudged now and then, for the overview. */
export function KapitzaPreview({ paused }: PreviewProps) {
  const defaults = useExperimentsDefaults();
  const k = defaults.data?.kapitza;
  return k ? (
    <KapitzaPlay k={k} dial={k} motor startDeg={UPRIGHT_DEG} startRunning preview paused={paused} />
  ) : (
    <PreviewPending />
  );
}

/** Where the bob is from the pivot, m, y down: hanging at `θ = 0`. */
function bobOf(k: KapitzaPendulum, theta: number): [number, number] {
  return [k.length_m * Math.sin(theta), k.length_m * Math.cos(theta)];
}

function KapitzaView({
  k,
  theta,
  pivot,
  blurred,
  onHold,
  onLetGo,
}: {
  k: KapitzaPendulum;
  theta: number;
  /** The pivot below its middle, m. */
  pivot: number;
  /** Drawn as the blur of its travel rather than where it is. */
  blurred: boolean;
  /** The bob taken by mouse or finger, to the angle given, and let go. */
  onHold?: (theta: number) => void;
  onLetGo?: () => void;
}) {
  const { t } = useTranslation();
  const hue = useChartHue();
  const colour = hue(ROD_HUE);
  const svg = useRef<SVGSVGElement | null>(null);
  const holding = useRef(false);
  const [dragging, setDragging] = useState(false);
  const l = k.length_m;
  const margin = l * 0.2;
  const base = l * 1.35;
  const shown = blurred ? 0 : pivot;
  const [bx, by] = bobOf(k, theta);
  const bob = l * 0.06;
  const follow = (clientX: number, clientY: number) => {
    const point = svg.current ? svgPoint(svg.current, clientX, clientY) : null;
    if (!point) return;
    onHold?.(Math.atan2(point[0], point[1] - shown));
  };
  const release = () => {
    if (!holding.current) return;
    holding.current = false;
    setDragging(false);
    onLetGo?.();
  };
  return (
    <svg
      ref={svg}
      viewBox={`${-(l + margin)} ${-(l + margin)} ${2 * (l + margin)} ${l + margin + base + margin * 0.5}`}
      role="img"
      aria-label={t("experiments.kapitza.view")}
      className={`${VIEW_FRAME} ${onHold ? "select-none" : ""}`}
      onPointerMove={(e) => {
        if (holding.current) follow(e.clientX, e.clientY);
      }}
      onPointerUp={release}
      onPointerCancel={release}
    >
      {/* Upright, dashed: where the rod stands when it stands. */}
      <line
        x1={0}
        y1={shown}
        x2={0}
        y2={shown - l * 1.1}
        stroke="currentColor"
        strokeDasharray="4 4"
        opacity={0.5}
        vectorEffect="non-scaling-stroke"
      />
      {/* The motor's block and the post it shakes, behind the rod. */}
      <rect
        x={-l * 0.25}
        y={base - l * 0.12}
        width={l * 0.5}
        height={l * 0.2}
        rx={l * 0.03}
        className="fill-current text-secondary"
        opacity={0.35}
      />
      <line
        x1={0}
        y1={base - l * 0.12}
        x2={0}
        y2={shown}
        stroke="currentColor"
        strokeWidth={6}
        opacity={0.35}
        vectorEffect="non-scaling-stroke"
      />
      {blurred && k.amplitude_m > 0 && (
        // The pivot's travel, ±a, true to scale.
        <rect
          x={-bob * 0.9}
          y={-k.amplitude_m - bob * 0.6}
          width={bob * 1.8}
          height={2 * k.amplitude_m + bob * 1.2}
          rx={bob * 0.6}
          className="fill-current text-primary"
          opacity={0.25}
        />
      )}
      <line
        x1={0}
        y1={shown}
        x2={bx}
        y2={shown + by}
        stroke={colour}
        strokeWidth={4}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={0} cy={shown} r={bob * 0.45} className="fill-current text-primary" />
      <circle cx={bx} cy={shown + by} r={bob} fill={colour} />
      {onHold && (
        // A moving bob is hard to catch: the hold is three of its radii round it, unseen.
        <circle
          cx={bx}
          cy={shown + by}
          r={bob * 3}
          fill="transparent"
          className={dragging ? "cursor-grabbing" : "cursor-grab"}
          ref={holdTouch}
          onPointerDown={(e: PointerEvent<SVGCircleElement>) => {
            e.currentTarget.ownerSVGElement?.setPointerCapture?.(e.pointerId);
            holding.current = true;
            setDragging(true);
            follow(e.clientX, e.clientY);
          }}
        />
      )}
    </svg>
  );
}

function KapitzaPlay({
  k,
  dial,
  motor,
  startDeg,
  startRunning,
  onMotor,
  onDial,
  onPreset,
  held,
  preview = false,
  paused = false,
}: {
  /** The pendulum as it is driven: the dial's, at 0 Hz with the motor off. */
  k: KapitzaPendulum;
  /** The motor's dial, whether it runs or not. */
  dial: KapitzaPendulum;
  motor: boolean;
  startDeg: number;
  startRunning: boolean;
  onMotor?: (on: boolean) => void;
  onDial?: (next: KapitzaPendulum) => void;
  onPreset?: (name: Preset) => void;
  held?: Held;
} & PreviewMode) {
  const { t } = useTranslation();
  const begin = (deg: number): Sim => ({ y: startState(deg), clock: 0, owed: 0, upright: null, side: 1 });
  const sim = useRef<Sim>(begin(startDeg));
  const drive = useRef<KapitzaPendulum>(k);
  const grabbed = useRef(false);
  const { running, setRunning } = useRunning({ preview, paused, initially: startRunning });
  const [speedHere, setSpeed] = useState<Speed>(1);
  const [frame, setFrame] = useState(() => ({ theta: startState(startDeg)[0], pivot: pivotM(k, 0) }));
  const speed = preview ? 1 : speedHere;
  const show = held?.show;
  const stepping = useMemo(() => ({ f: rhs(k), h: stepFor(k) }), [k]);
  const blurred = k.frequency_hz * speed > BLUR_HZ;

  const draw = () => setFrame({ theta: sim.current.y[0], pivot: pivotM(k, sim.current.clock) });
  useFrameLoop(running, (dt) => {
    const s = sim.current;
    // A new drive: its clock from naught, the rod where it is.
    if (drive.current !== k) {
      drive.current = k;
      s.clock = 0;
      s.owed = 0;
    }
    if (grabbed.current) return;
    const { f, h } = stepping;
    s.owed += (dt * speed) / h;
    const steps = Math.floor(s.owed);
    s.owed -= steps;
    for (let i = 0; i < steps; i++) {
      s.y = rk4(f, s.clock, s.y, h);
      s.clock += h;
    }
    if (s.upright !== null && k.frequency_hz > 0) {
      s.upright += dt * speed;
      if (s.upright > TRIED_AFTER_S) show?.();
    }
    // The preview nudges its rod every few seconds, one way then the other.
    if (preview && s.clock > 4) {
      sim.current = { ...begin(UPRIGHT_DEG), y: [s.y[0], s.y[1] + s.side * NUDGE_RAD_S], side: s.side === 1 ? -1 : 1 };
    }
    draw();
  });
  useCheckSetting("kapitza", () => {
    if (preview) return false;
    sim.current = begin(startDeg);
    draw();
    setRunning(true);
    return true;
  });

  const view = (
    <KapitzaView
      k={k}
      theta={frame.theta}
      pivot={frame.pivot}
      blurred={blurred}
      onHold={
        preview
          ? undefined
          : (theta) => {
              grabbed.current = true;
              sim.current = { ...sim.current, y: [theta, 0], upright: null };
              draw();
            }
      }
      onLetGo={() => {
        grabbed.current = false;
        setRunning(true);
      }}
    />
  );
  if (preview) return view;
  const upright = () => {
    sim.current = { ...begin(UPRIGHT_DEG), upright: 0 };
    draw();
    setRunning(true);
  };
  const nudge = () => {
    const s = sim.current;
    sim.current = { ...s, y: [s.y[0], s.y[1] + s.side * NUDGE_RAD_S], side: s.side === 1 ? -1 : 1 };
    setRunning(true);
  };
  return (
    <WidgetCard
      title={t("experiments.kapitza.play.title")}
      hint={t("experiments.kapitza.play.hint")}
      actions={
        <>
          <Button variant="accent" size="sm" onClick={upright}>
            <ArrowUpToLine className="size-4" aria-hidden />
            {t("experiments.kapitza.play.upright")}
          </Button>
          <Button variant="secondary" size="sm" onClick={nudge}>
            <Hand className="size-4" aria-hidden />
            {t("experiments.kapitza.play.nudge")}
          </Button>
          <RunPauseButton running={running} onToggle={() => setRunning(!running)} />
        </>
      }
    >
      <div className={`${SIDE.grid} ${SIDE.cap.md}`}>
        <div className={`${SIDE.top} space-y-3`}>
          <Switch
            label={t("experiments.kapitza.play.motor")}
            description={t("experiments.kapitza.play.motor_hint")}
            checked={motor}
            onCheckedChange={(on: boolean) => {
              onMotor?.(on);
              if (on && sim.current.upright === null && Math.abs(Math.cos(sim.current.y[0])) > 0.95)
                sim.current.upright = 0;
            }}
          />
        </div>
        <div className={`${SIDE.views} mx-auto w-full max-w-md`}>
          {view}
          <p className="text-sm text-secondary">{t("experiments.kapitza.play.drag_hint")}</p>
        </div>
        <div className={SIDE.column}>
          <SliderField
            label={t("experiments.kapitza.play.frequency")}
            unit="Hz"
            value={dial.frequency_hz}
            min={1}
            max={200}
            step={0.5}
            digits={1}
            onChange={(v) => onDial?.({ ...dial, frequency_hz: v })}
          />
          <SliderField
            label={t("experiments.kapitza.play.amplitude")}
            unit="mm"
            value={dial.amplitude_m * 1000}
            min={1}
            max={Math.min(40, Math.floor(MAX_SHARE * dial.length_m * 1000))}
            step={0.5}
            digits={1}
            onChange={(v) => onDial?.({ ...dial, amplitude_m: v / 1000 })}
          />
          <SpeedToggle speeds={SPEEDS} value={speed} onChange={setSpeed} />
          <div className="space-y-2">
            <p className="text-sm text-secondary">{t("experiments.kapitza.play.presets_label")}</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(PRESETS) as Preset[]).map((name) => (
                <Button key={name} variant="secondary" size="sm" onClick={() => onPreset?.(name)}>
                  {t(`experiments.kapitza.play.presets.${name}`)}
                </Button>
              ))}
            </div>
          </div>
          <KapitzaFigures k={dial} motor={motor} angleDeg={frame.theta * TO_DEG} held={held} />
        </div>
      </div>
    </WidgetCard>
  );
}

/** The figures beside the rod: its angle, and, once tried, the drive the top
 *  needs by Floquet and by Kapitza and whether the dial's drive holds it. */
function KapitzaFigures({
  k,
  motor,
  angleDeg,
  held,
}: {
  k: KapitzaPendulum;
  motor: boolean;
  angleDeg: number;
  held?: Held;
}) {
  const { t } = useTranslation();
  // The multipliers for the dial's drive: a period of stepping each, the least
  // drive forty such halvings, so once the sliders hold still.
  const settled = useDebounce(k, 200, { key: JSON.stringify(k) });
  const answer = useMemo(() => {
    if (refusal(settled)) return null;
    return {
      least: leastFrequencyHz(settled),
      kapitza: kapitzaFrequencyHz(settled),
      holds: stable(settled, "top"),
      swings: !stable(settled, "bottom"),
    };
  }, [settled]);
  // From the top, the shorter way round: 0° upright.
  const fromTop = ((((angleDeg - 180) % 360) + 540) % 360) - 180;
  const verdict = answer && (
    <p className="text-sm font-medium text-primary">
      {motor
        ? answer.holds
          ? t("experiments.kapitza.play.holds")
          : answer.swings
            ? t("experiments.kapitza.play.swings")
            : t("experiments.kapitza.play.falls")
        : t("experiments.kapitza.play.off")}
    </p>
  );
  return (
    <>
      {held ? <HeldAnswer held={held}>{verdict}</HeldAnswer> : verdict}
      <Figures
        tiles={[
          { key: "angle", label: t("experiments.kapitza.figures.angle"), value: fromTop, digits: 0, unit: "°" },
          {
            key: "least",
            label: t("experiments.kapitza.figures.least"),
            value: answer?.least,
            digits: 1,
            unit: "Hz",
            held: held ? !held.shown : false,
          },
          {
            key: "kapitza",
            label: t("experiments.kapitza.figures.kapitza"),
            value: answer?.kapitza,
            digits: 1,
            unit: "Hz",
            held: held ? !held.shown : false,
          },
        ]}
      />
    </>
  );
}

function KapitzaBuild({ k, onChange }: { k: KapitzaPendulum; onChange: (next: KapitzaPendulum) => void }) {
  const { t } = useTranslation();
  return (
    <WidgetCard title={t("experiments.kapitza.change.title")} hint={t("experiments.kapitza.change.hint")}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SliderField
          label={t("experiments.kapitza.change.length")}
          unit="cm"
          value={k.length_m * 100}
          min={10}
          max={50}
          step={1}
          digits={0}
          onChange={(v) =>
            onChange({ ...k, length_m: v / 100, amplitude_m: Math.min(k.amplitude_m, MAX_SHARE * (v / 100)) })
          }
        />
        <SliderField
          label={t("experiments.kapitza.change.damping")}
          unit="1/s"
          value={k.damping_per_s}
          min={0}
          max={2}
          step={0.05}
          digits={2}
          onChange={(v) => onChange({ ...k, damping_per_s: v })}
        />
      </div>
    </WidgetCard>
  );
}

function KapitzaModel() {
  const { t } = useTranslation();
  const s = (key: string) => t(`experiments.kapitza.symbols.${key}`);
  return (
    <>
      <p>{t("experiments.kapitza.model.intro")}</p>
      <Equation
        tex={String.raw`\ddot\theta = -\frac{g + a\,\omega^2\cos\omega t}{l}\,\sin\theta - c\,\dot\theta`}
        reads={t("experiments.kapitza.model.motion")}
        symbols={[
          { tex: String.raw`\theta`, meaning: s("theta"), unit: "rad" },
          { tex: "g", meaning: s("g"), unit: "m/s²" },
          { tex: "a", meaning: s("a"), unit: "m" },
          { tex: String.raw`\omega`, meaning: s("omega"), unit: "1/s" },
          { tex: "l", meaning: s("l"), unit: "m" },
          { tex: "c", meaning: s("c"), unit: "1/s" },
        ]}
      />
      <Equation
        tex={String.raw`U = m\,g\,l\left(-\cos\theta + \frac{a^2\omega^2}{4\,g\,l}\,\sin^2\theta\right)`}
        reads={t("experiments.kapitza.model.potential")}
        symbols={[
          { tex: "U", meaning: s("u"), unit: "J" },
          { tex: "m", meaning: s("m"), unit: "kg" },
        ]}
      />
      <Equation
        tex={String.raw`a^2\omega^2 > 2\,g\,l, \qquad \Omega^2 = \frac{a^2\omega^2}{2\,l^2} - \frac{g}{l}`}
        reads={t("experiments.kapitza.model.bound")}
        symbols={[{ tex: String.raw`\Omega`, meaning: s("big_omega"), unit: "1/s" }]}
      />
    </>
  );
}

function KapitzaComputed() {
  const { t } = useTranslation();
  const c = (key: string) => t(`experiments.kapitza.computed.${key}`);
  return (
    <>
      <p>{c("system")}</p>
      <Equation
        tex={String.raw`\begin{pmatrix}\varphi\\ \dot\varphi\end{pmatrix}_{t+T} = M \begin{pmatrix}\varphi\\ \dot\varphi\end{pmatrix}_{t}, \qquad \lvert \operatorname{tr} M \rvert < 1 + \det M, \qquad \det M = e^{-cT}`}
        reads={c("floquet")}
        symbols={[
          { tex: String.raw`\varphi`, meaning: c("phi"), unit: "rad" },
          { tex: "T", meaning: c("t"), unit: "s" },
          { tex: "M", meaning: c("m") },
        ]}
      />
    </>
  );
}

/** Kapitza's potential over a whole turn, at this many points. */
const POTENTIAL_POINTS = 181;

function KapitzaTrick({ k }: { k: KapitzaPendulum | null }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hue = useChartHue();
  // Asked again only once the sliders have held still: the least drive is
  // forty periods' worth of halvings.
  const settled = useDebounce(k, 300, { key: JSON.stringify(k) });
  const figures = useMemo(() => {
    if (!settled) return null;
    const least = leastFrequencyHz(settled);
    const kapitza = kapitzaFrequencyHz(settled);
    return {
      least,
      kapitza,
      gap: least !== null && kapitza !== null ? (least / kapitza - 1) * 100 : null,
      band: swingUpBandHz(settled),
      own: ownFrequencyHz(settled),
      rate: settled.frequency_hz > 0 ? slowRateTop(settled) : null,
    };
  }, [settled]);
  if (!k || !figures) return <LoadingState className="py-6" label={t("common.loading")} />;
  // Per unit mass, J/kg, from the bottom: 0° hanging, 180° upright in the middle.
  const rows = Array.from({ length: POTENTIAL_POINTS }, (_, i) => {
    const deg = (360 * i) / (POTENTIAL_POINTS - 1);
    const theta = deg * TO_RAD;
    const gravity = effectivePotential({ ...k, amplitude_m: 0 }, theta);
    return { deg, gravity, shaking: effectivePotential(k, theta) - gravity, sum: effectivePotential(k, theta) };
  });
  const series = [
    { key: "gravity", label: t("experiments.kapitza.chart.gravity"), color: hue(GRAVITY_HUE) },
    { key: "shaking", label: t("experiments.kapitza.chart.shaking"), color: hue(SHAKE_HUE) },
    { key: "sum", label: t("experiments.kapitza.chart.sum"), color: hue(SUM_HUE) },
  ];
  return (
    <>
      <p>{t("experiments.kapitza.sweet.potential")}</p>
      <SeriesChart
        rows={rows}
        series={series}
        axes={[
          {
            id: "y",
            title: `${t("experiments.kapitza.chart.potential")} (J/kg)`,
            format: (v) => formatNumber(v, 2, locale),
          },
        ]}
        x={{
          key: "deg",
          title: `${t("experiments.kapitza.chart.angle")} (°)`,
          format: (v) => formatNumber(v, 0, locale),
        }}
        references={[{ axis: "x", value: 180 }]}
      />
      <StaticLegend entries={seriesLegendEntries(series)} />
      <p>{t("experiments.kapitza.sweet.approach")}</p>
      <Figures
        tiles={[
          { key: "least", label: t("experiments.kapitza.figures.least"), value: figures.least, digits: 2, unit: "Hz" },
          {
            key: "kapitza",
            label: t("experiments.kapitza.figures.kapitza"),
            value: figures.kapitza,
            digits: 2,
            unit: "Hz",
          },
          { key: "gap", label: t("experiments.kapitza.figures.gap"), value: figures.gap, digits: 3, unit: "%" },
          {
            key: "wobble",
            label: t("experiments.kapitza.figures.wobble"),
            value: figures.rate ? (2 * Math.PI) / figures.rate : null,
            digits: 2,
            unit: "s",
          },
        ]}
      />
      <p>
        {figures.band
          ? t("experiments.kapitza.sweet.band", {
              own: formatNumber(figures.own, 2, locale),
              low: formatNumber(figures.band[0], 2, locale),
              high: formatNumber(figures.band[1], 2, locale),
            })
          : t("experiments.kapitza.sweet.no_band", { own: formatNumber(figures.own, 2, locale) })}
      </p>
    </>
  );
}
