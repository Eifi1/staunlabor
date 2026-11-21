import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { Pause, Play, RotateCcw } from "lucide-react";
import { Button, LoadingState, ToggleGroup } from "@eifi1/ui-kit";
import { SeriesChart } from "@/shared/charts/series-chart";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber } from "@/shared/lib/format";
import { useChartHex } from "@/shared/state/palette-store";
import { holdTouch } from "@/shared/ui/grab";
import { SliderField } from "@/shared/ui/slider-field";
import { Figures, WidgetCard } from "@/shared/ui/widget";
import { Equation } from "./equation";
import { ExhibitFrame } from "./exhibit-frame";
import { BuildPending } from "./build-pending";
import { PreviewPending, type PreviewMode, type PreviewProps } from "./preview-mode";
import { startsRunning } from "./play";
import { settingNumber, useCheckRequest, useCheckSetting } from "./check-setting";
import {
  STEP_TAU,
  behaviour,
  cupLevel,
  hopfRho,
  run,
  startWheel,
  steadyX,
  stepWheel,
  type Behaviour,
  type WaterWheel,
  type WheelTurns,
} from "./simulate/waterwheel";
import { STAGE } from "./stage";
import { useExperimentsDefaults } from "./use-experiments";

const SPEEDS = [1, 4] as const;
/** The run the page reads what the wheel does from, and charts, seconds. */
const SHOWN_S = 200;
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
  // A check case's "Set it up": the tap and the brake here; the play, built
  // anew for them or already on them, starts the wheel from rest.
  const request = useCheckRequest("waterwheel");
  const [seen, setSeen] = useState<number | null>(null);
  if (request && !request.done && request.nonce !== seen && w) {
    setSeen(request.nonce);
    const next = {
      ...w,
      sigma: settingNumber(request.setting, "sigma", w.sigma),
      rho: settingNumber(request.setting, "rho", w.rho),
    };
    if (next.sigma !== w.sigma || next.rho !== w.rho) setBuild(next);
  }
  // One run from rest for the play card's line and the chart: what the page
  // says the wheel does is what it does here, not what ρ_H alone suggests.
  const shown = useMemo(() => (w ? run(w, SHOWN_S) : null), [w]);
  const kind = w && shown ? behaviour(w, shown) : null;
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
      sweetSpot={<WaterwheelTrick w={w} shown={shown} kind={kind} />}
    >
      {defaults.isPending || !w ? (
        <BuildPending pending={defaults.isPending} error={defaults.error} />
      ) : (
        <WaterwheelPlay key={JSON.stringify(w)} w={w} kind={kind} onChange={setBuild} />
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

/** The tap's lever: its pivot on the tap, its length, and the tap's range,
 *  shut (lever down) to the slider's 40 (lever across). */
const LEVER = { x: 0.14, y: -1.49, length: 0.28, most: 40 };
/** The brake's knob on a dial round the axle, from the slider's 4 at the lower
 *  right to its 20 at the lower left: the brake is the axle's friction. */
const DIAL = { radius: 0.3, from: 30, to: 150, least: 4, most: 20 };
const TO_DEG = 180 / Math.PI;

type Grip = "tap" | "brake";

/**
 * The wheel, drawn. Given `onDraft`, the tap's lever and the brake's knob can
 * be turned by mouse or finger (Marcel, 2026-11-20: the exhibits "ähnlich
 * interaktiv" as the cradle): the wheel runs on while they turn, and starts
 * again from rest with the new tap and brake once they are let go, as the
 * sliders start it.
 */
function WheelView({
  w,
  angle,
  y,
  z,
  onDraft,
  onCommit,
}: {
  w: WaterWheel;
  angle: number;
  y: number;
  z: number;
  onDraft?: (next: { rho: number; sigma: number }) => void;
  onCommit?: (next: { rho: number; sigma: number }) => void;
}) {
  const { t } = useTranslation();
  const hex = useChartHex();
  // Which control the pointer holds: a ref for the handlers, which a move can
  // reach before React has drawn the hold; the state for the cursor.
  const [grip, setGrip] = useState<Grip | null>(null);
  const gripped = useRef<Grip | null>(null);
  const last = useRef<{ rho: number; sigma: number } | null>(null);
  // The pointer in the drawing's units. The view box is not the box's shape,
  // so the browser's own matrix maps it; a page without one (a test) has the
  // box stand for the view box.
  const at = (svg: SVGSVGElement, clientX: number, clientY: number) => {
    const matrix = svg.getScreenCTM?.();
    if (matrix) {
      const p = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
      return { x: p.x, y: p.y };
    }
    const box = svg.getBoundingClientRect();
    if (!box.width || !box.height) return null;
    return { x: -1.45 + ((clientX - box.left) / box.width) * 2.9, y: -1.55 + ((clientY - box.top) / box.height) * 3 };
  };
  const turn = (svg: SVGSVGElement, clientX: number, clientY: number, which: Grip) => {
    const p = at(svg, clientX, clientY);
    if (!p) return;
    const half = (v: number) => Math.round(v * 2) / 2;
    const next = { rho: w.rho, sigma: w.sigma };
    if (which === "tap") {
      const deg = Math.min(90, Math.max(0, Math.atan2(p.x - LEVER.x, p.y - LEVER.y) * TO_DEG));
      next.rho = half((deg / 90) * LEVER.most);
    } else {
      const deg = Math.min(DIAL.to, Math.max(DIAL.from, Math.atan2(p.y, p.x) * TO_DEG));
      next.sigma = half(DIAL.least + ((deg - DIAL.from) / (DIAL.to - DIAL.from)) * (DIAL.most - DIAL.least));
    }
    last.current = next;
    onDraft?.(next);
  };
  const release = () => {
    if (gripped.current === null) return;
    gripped.current = null;
    setGrip(null);
    if (last.current) onCommit?.(last.current);
  };
  const take = (which: Grip, e: PointerEvent<SVGCircleElement>) => {
    const svg = e.currentTarget.ownerSVGElement;
    if (!onDraft || !svg) return;
    svg.setPointerCapture?.(e.pointerId);
    gripped.current = which;
    setGrip(which);
    turn(svg, e.clientX, e.clientY, which);
  };
  const lever = (w.rho / LEVER.most) * (Math.PI / 2);
  const leverEnd = { x: LEVER.x + LEVER.length * Math.sin(lever), y: LEVER.y + LEVER.length * Math.cos(lever) };
  const knob = (DIAL.from + ((w.sigma - DIAL.least) / (DIAL.most - DIAL.least)) * (DIAL.to - DIAL.from)) / TO_DEG;
  const knobAt = { x: DIAL.radius * Math.cos(knob), y: DIAL.radius * Math.sin(knob) };
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
      className={`aspect-square w-full rounded-lg border border-subtle bg-surface-2 text-muted ${onDraft ? "select-none" : ""} ${grip ? "cursor-grabbing" : ""}`}
      onPointerMove={(e: PointerEvent<SVGSVGElement>) => {
        if (gripped.current) turn(e.currentTarget, e.clientX, e.clientY, gripped.current);
      }}
      onPointerUp={release}
      onPointerCancel={release}
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
      {onDraft && (
        <>
          {/* The brake's dial round the axle, and its knob. */}
          <path
            d={`M ${DIAL.radius * Math.cos(DIAL.from / TO_DEG)} ${DIAL.radius * Math.sin(DIAL.from / TO_DEG)} A ${DIAL.radius} ${DIAL.radius} 0 0 1 ${DIAL.radius * Math.cos(DIAL.to / TO_DEG)} ${DIAL.radius * Math.sin(DIAL.to / TO_DEG)}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            opacity={0.5}
            vectorEffect="non-scaling-stroke"
          />
          <circle
            cx={knobAt.x}
            cy={knobAt.y}
            r={0.07}
            className={`fill-current text-primary ${grip ? "" : "cursor-grab"}`}
            ref={holdTouch}
            onPointerDown={(e) => take("brake", e)}
          />
          {/* The tap's lever. */}
          <line
            x1={LEVER.x}
            y1={LEVER.y}
            x2={leverEnd.x}
            y2={leverEnd.y}
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <circle
            cx={leverEnd.x}
            cy={leverEnd.y}
            r={0.07}
            className={`fill-current text-primary ${grip ? "" : "cursor-grab"}`}
            ref={holdTouch}
            onPointerDown={(e) => take("tap", e)}
          />
        </>
      )}
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
  kind = null,
  onChange,
  preview = false,
  paused = false,
}: { w: WaterWheel; kind?: Behaviour | null; onChange?: (next: WaterWheel) => void } & PreviewMode) {
  const { t } = useTranslation();
  const sim = useRef({ state: startWheel(), owed: 0, trail: [] as Array<[number, number]> });
  const [runningHere, setRunning] = useState(startsRunning);
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

  const restart = () => {
    sim.current = { state: startWheel(), owed: 0, trail: [] };
    setFrame({ y: [1e-3, 0, 0], angle: 0, trail: [] });
  };
  // A case whose tap and brake are already the page's builds no new play: this
  // one starts the wheel from rest for it, and from rest is what the cases read.
  useCheckSetting("waterwheel", (setting) => {
    if (preview) return false;
    if (settingNumber(setting, "sigma", w.sigma) !== w.sigma || settingNumber(setting, "rho", w.rho) !== w.rho) {
      return false;
    }
    restart();
    setRunning(true);
    return true;
  });
  // The tap and brake as the reader turns them, before they are let go.
  const [draft, setDraft] = useState<{ rho: number; sigma: number } | null>(null);
  const shownW = draft ? { ...w, ...draft } : w;
  const wheel = preview ? (
    <WheelView w={w} angle={frame.angle} y={frame.y[1]} z={frame.y[2]} />
  ) : (
    <WheelView
      w={shownW}
      angle={frame.angle}
      y={frame.y[1]}
      z={frame.y[2]}
      onDraft={setDraft}
      onCommit={(next) => {
        setDraft(null);
        onChange?.({ ...w, ...next });
      }}
    />
  );
  if (preview) return wheel;
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
          <p className="text-sm text-secondary">{t("experiments.waterwheel.play.turn_hint")}</p>
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
          value={shownW.rho}
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
          value={shownW.sigma}
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
      {kind && <p className="text-sm font-medium text-primary">{t(`experiments.waterwheel.play.regime_${kind}`)}</p>}
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

function WaterwheelTrick({
  w,
  shown,
  kind,
}: {
  w: WaterWheel | null;
  shown: WheelTurns | null;
  kind: Behaviour | null;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  const runs = useMemo(
    () =>
      shown && {
        rows: shown.t.flatMap((time, i) => (i % 2 === 0 ? [{ t: time, rate: shown.rate_rad_s[i] * RPM }] : [])),
        reversals: shown.reversals_s.length,
      },
    [shown],
  );
  if (!w || !runs || !kind) return <LoadingState className="py-6" label={t("common.loading")} />;
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
        {kind === "steady"
          ? t("experiments.waterwheel.sweet.steady", {
              rpm: formatNumber((steady ?? 0) * w.leak_per_s * RPM, 1, locale),
            })
          : t(`experiments.waterwheel.sweet.${kind}`, { reversals: runs.reversals })}
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
