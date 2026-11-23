import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { Hand, RotateCcw } from "lucide-react";
import { Button, LoadingState } from "@eifi1/ui-kit";
import { SeriesChart } from "@/shared/charts/series-chart";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber } from "@/shared/lib/format";
import { useChartHue } from "@/shared/state/palette-store";
import { holdTouch } from "@/shared/ui/grab";
import { svgPoint } from "@/shared/ui/svg-point";
import { SliderField } from "@/shared/ui/slider-field";
import { Figures, WidgetCard } from "@/shared/ui/widget";
import { Equation } from "./equation";
import { ExhibitFrame } from "./exhibit-frame";
import { BuildPending } from "./build-pending";
import { settingNumber, useCheckSetting, useTakeCheckRequest } from "./check-setting";
import { PreviewPending, type PreviewMode, type PreviewProps } from "./preview-mode";
import { useFrameLoop, useRunning } from "./play";
import { RunPauseButton, SpeedToggle } from "./play-controls";
import {
  KEEL_M,
  MAST_M,
  STEP_S,
  buoyancyCentre,
  curveM,
  figures,
  floats,
  gravityM,
  rightingArmM,
  section,
  step,
  underWater,
  type Hull,
  type Point,
  type ShipFigures,
  type Weight,
} from "./simulate/ship";
import { SIDE, VIEW_FRAME } from "./stage";
import { useExperimentsDefaults } from "./use-experiments";

const SPEEDS = [1, 0.25] as const;
type Speed = (typeof SPEEDS)[number];

/** The push of "Push": the hull let go at rest this far over, degrees. */
const PUSH_DEG = 10;
/** Arrow keys tilt the held hull by this much, and by the second with Shift, degrees. */
const KEY_DEG = [1, 5] as const;
/** The preview: the weight on the deck, the hull let go 25° over every few seconds. */
const PREVIEW = { heelDeg: 25, everyS: 4 } as const;
/** Upright and still: within this of upright, degrees, and slower than this, rad/s. */
const STILL = { deg: 1, rate: 0.05 } as const;

/** The drawing, in centimetres: G stays at the middle, the water's surface across it. */
const VIEW = { left: -42, width: 84, top: 0, height: 84, surface: 42 } as const;
const WATER_HUE = 2;
const HULL_HUE = 0;
const B_HUE = 2;
const G_HUE = 4;
const CHART_POINTS = 181;
/** The trick's three heights of the weight: the keel's foot, the deck, up the mast, m. */
const TRICK_HEIGHTS = [KEEL_M, 0.12, 0.35] as const;
const TRICK_HUES = [2, 0, 4];

type Motion = "held" | "upright" | "on_edge" | "loll" | "keel_up" | "capsizing" | "rolling";

/** The heel folded into (−180°, 180°]. */
const folded = (phi: number) => Math.atan2(Math.sin(phi), Math.cos(phi));
const deg = (rad: number) => (rad * 180) / Math.PI;
const rad = (d: number) => (d * Math.PI) / 180;

function motionOf(f: ShipFigures, phi: number, rate: number, held: boolean): Motion {
  if (held) return "held";
  const heel = Math.abs(deg(folded(phi)));
  const still = Math.abs(rate) < STILL.rate;
  if (heel > 150 && still) return "keel_up";
  if (heel < STILL.deg && still) return f.gm_m > 0 ? "upright" : "on_edge";
  if (f.loll_deg !== null && Math.abs(heel - f.loll_deg) < STILL.deg && still) return "loll";
  if (heel > (f.vanishing_deg ?? 180)) return "capsizing";
  return "rolling";
}

interface Build {
  hull: Hull;
  weightKg: number;
  damping: number;
}

/**
 * The ship that rights itself (`experiments.ship`): a box hull in a basin, its
 * heel stepped by the browser port (`simulate/ship.ts`, held to the engine by
 * `simulate.test.ts`); the reader's hand tilts it and moves its weight up and
 * down. No route.
 */
export function ShipPage() {
  const { t } = useTranslation();
  const defaults = useExperimentsDefaults();
  const data = defaults.data?.ship;
  const [build, setBuild] = useState<Build | null>(null);
  const [heightHere, setHeight] = useState<number | null>(null);
  const shown: Build | null =
    build ?? (data ? { hull: data.hull, weightKg: data.weight.mass_kg, damping: data.damping_per_s } : null);
  const height = heightHere ?? data?.weight.height_m ?? null;
  // A check case's "Set it up": the beam, the weight and the damping here;
  // the play, built anew for them or already on them, sets the weight's
  // height and the heel it lets go at.
  useTakeCheckRequest("ship", shown, (setting, current) => {
    const beam = settingNumber(setting, "beam_m", current.hull.beam_m);
    const kg = settingNumber(setting, "weight_kg", current.weightKg);
    const damping = settingNumber(setting, "damping_per_s", current.damping);
    if (beam !== current.hull.beam_m || kg !== current.weightKg || damping !== current.damping) {
      setBuild({ hull: { ...current.hull, beam_m: beam }, weightKg: kg, damping });
    }
  });
  const weight = shown && height !== null ? { mass_kg: shown.weightKg, height_m: height } : null;
  return (
    <ExhibitFrame
      exhibit="ship"
      atTheExhibit={
        <>
          <p>{t("experiments.ship.at.basin")}</p>
          <p>{t("experiments.ship.at.low")}</p>
          <p>{t("experiments.ship.at.high")}</p>
        </>
      }
      whatHappens={<ShipModel />}
      computed={<ShipComputed />}
      sweetSpot={
        shown && weight ? (
          <ShipTrick hull={shown.hull} weightKg={shown.weightKg} />
        ) : (
          <LoadingState className="py-6" label={t("common.loading")} />
        )
      }
    >
      {defaults.isPending || !shown || !weight ? (
        <BuildPending pending={defaults.isPending} error={defaults.error} />
      ) : (
        <>
          {/* A new hull, weight or damping starts again upright. */}
          <ShipPlay key={JSON.stringify(shown)} build={shown} height={weight.height_m} onHeight={(h) => setHeight(h)} />
          <ShipBuild build={shown} weight={weight} onChange={setBuild} />
        </>
      )}
    </ExhibitFrame>
  );
}

/** The hull let go over and over, rocking back upright. */
export function ShipPreview({ paused }: PreviewProps) {
  const defaults = useExperimentsDefaults();
  const data = defaults.data?.ship;
  return data ? (
    <ShipPlay
      build={{ hull: data.hull, weightKg: data.weight.mass_kg, damping: data.damping_per_s }}
      height={data.weight.height_m}
      preview
      paused={paused}
    />
  ) : (
    <PreviewPending />
  );
}

/** A point of the hull's own `(y, z)`, m, in the drawing's centimetres, the
 *  hull heeled by `phi` about `K`, G at the middle and the water at its line. */
function placer(hull: Hull, weight: Weight, phi: number, level: number) {
  const s = Math.sin(phi);
  const c = Math.cos(phi);
  const kg = gravityM(hull, weight);
  const gy = kg * s;
  return ([y, z]: Point): Point => {
    const across = y * c + z * s - gy;
    const up = -y * s + z * c - level;
    return [across * 100, VIEW.surface - up * 100];
  };
}

/** The waterline's level with the hull heeled about `K`: the height of the
 *  under-water part's highest corner, read off the clipped section. */
function levelOf(under: readonly Point[], phi: number): number {
  const s = Math.sin(phi);
  const c = Math.cos(phi);
  return Math.max(...under.map(([y, z]) => -y * s + z * c));
}

function BasinView({
  hull,
  weight,
  phi,
  onTilt,
  onLetGo,
  onKey,
}: {
  hull: Hull;
  weight: Weight;
  phi: number;
  onTilt?: (phi: number) => void;
  onLetGo?: () => void;
  onKey?: (event: KeyboardEvent<SVGElement>) => void;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hue = useChartHue();
  const svg = useRef<SVGSVGElement | null>(null);
  const grab = useRef<{ pointer: number; phi: number } | null>(null);
  const under = underWater(hull, weight, phi);
  const at = placer(hull, weight, phi, levelOf(under, phi));
  const outline = section(hull).map(at);
  const kg = gravityM(hull, weight);
  const [gx, gy] = at([0, kg]);
  const [bx, by] = at(buoyancyCentre(hull, weight, phi));
  const arm = rightingArmM(hull, weight, phi);
  const mast = [at([0, hull.depth_m]), at([0, MAST_M])];
  const keel = [at([0, 0]), at([0, KEEL_M])];
  const [wx, wy] = at([0, weight.height_m]);
  const path = (points: readonly Point[]) => `M ${points.map(([x, y]) => `${x} ${y}`).join(" L ")} Z`;
  // The pointer's angle round G, measured from straight up, clockwise as the
  // drawing heels to starboard.
  const angleAt = (e: PointerEvent<SVGElement>) => {
    const p = svg.current ? svgPoint(svg.current, e.clientX, e.clientY) : null;
    return p ? Math.atan2(p[0] - gx, gy - p[1]) : null;
  };
  const heelDeg = deg(folded(phi));
  return (
    <svg
      ref={svg}
      viewBox={`${VIEW.left} ${VIEW.top} ${VIEW.width} ${VIEW.height}`}
      role={onTilt ? "group" : "img"}
      aria-label={t("experiments.ship.view")}
      className={`${VIEW_FRAME} ${onTilt ? "select-none" : ""}`}
      onPointerMove={(e) => {
        const g = grab.current;
        const angle = angleAt(e);
        if (!g || angle === null || !onTilt) return;
        onTilt(g.phi + angle - g.pointer);
      }}
      onPointerUp={() => {
        if (grab.current) onLetGo?.();
        grab.current = null;
      }}
      onPointerCancel={() => {
        if (grab.current) onLetGo?.();
        grab.current = null;
      }}
    >
      <rect
        x={VIEW.left}
        y={VIEW.surface}
        width={VIEW.width}
        height={VIEW.height - VIEW.surface}
        fill={hue(WATER_HUE)}
        fillOpacity={0.18}
      />
      <line x1={VIEW.left} y1={VIEW.surface} x2={VIEW.left + VIEW.width} y2={VIEW.surface} stroke={hue(WATER_HUE)} />
      {/* The keel and the mast the weight slides along, thin: their volume is left out. */}
      <line x1={keel[0][0]} y1={keel[0][1]} x2={keel[1][0]} y2={keel[1][1]} stroke="currentColor" strokeWidth={1.6} />
      <line x1={mast[0][0]} y1={mast[0][1]} x2={mast[1][0]} y2={mast[1][1]} stroke="currentColor" strokeWidth={0.8} />
      <path d={path(outline)} fill={hue(HULL_HUE)} fillOpacity={0.12} stroke="currentColor" strokeWidth={1} />
      {/* What is under water: its centre is B. */}
      <path d={path(under.map(at))} fill={hue(WATER_HUE)} fillOpacity={0.35} stroke="none" />
      {/* The weight, a block on the mast or the keel. */}
      <rect x={wx - 2.2} y={wy - 2.2} width={4.4} height={4.4} rx={0.6} className="fill-current text-primary" />
      {/* The two lines of action, buoyancy up through B, weight down through G,
          and the arm between them. */}
      <line x1={bx} y1={by} x2={bx} y2={by - 22} stroke={hue(B_HUE)} strokeWidth={0.8} />
      <line x1={gx} y1={gy} x2={gx} y2={gy + 22} stroke={hue(G_HUE)} strokeWidth={0.8} />
      <path d={`M ${bx} ${by - 22} l -1.5 3 l 3 0 z`} fill={hue(B_HUE)} />
      <path d={`M ${gx} ${gy + 22} l -1.5 -3 l 3 0 z`} fill={hue(G_HUE)} />
      {Math.abs(arm) > 0.001 && (
        <line x1={gx} y1={gy} x2={bx} y2={gy} stroke="currentColor" strokeWidth={1.4} strokeDasharray="1.5 1" />
      )}
      <circle cx={gx} cy={gy} r={1.6} fill={hue(G_HUE)} />
      <circle cx={bx} cy={by} r={1.6} fill={hue(B_HUE)} />
      <text x={gx - 2.5} y={gy - 1.5} fontSize={4} textAnchor="end" fill="currentColor">
        G
      </text>
      <text x={bx + 2.5} y={by + 4.5} fontSize={4} fill="currentColor">
        B
      </text>
      <text x={VIEW.left + 2} y={VIEW.top + 6} fontSize={4} fill="currentColor">
        {`${formatNumber(heelDeg, 0, locale)}°`}
      </text>
      {onTilt && (
        // The hand: the whole hull and some water round it, unseen.
        <circle
          cx={gx}
          cy={gy}
          r={26}
          fill="transparent"
          tabIndex={0}
          role="slider"
          aria-label={t("experiments.ship.play.tilt")}
          aria-valuemin={-180}
          aria-valuemax={180}
          aria-valuenow={Math.round(heelDeg)}
          aria-valuetext={`${formatNumber(heelDeg, 0, locale)}°`}
          className="cursor-grab outline-none focus-visible:stroke-current"
          ref={holdTouch}
          onKeyDown={onKey}
          onKeyUp={(e) => {
            if (e.key.startsWith("Arrow")) onLetGo?.();
          }}
          onPointerDown={(e) => {
            const angle = angleAt(e);
            if (angle === null) return;
            e.currentTarget.ownerSVGElement?.setPointerCapture?.(e.pointerId);
            grab.current = { pointer: angle, phi };
            onTilt(phi);
          }}
        />
      )}
    </svg>
  );
}

function ShipPlay({
  build,
  height,
  onHeight,
  preview = false,
  paused = false,
}: { build: Build; height: number; onHeight?: (height: number) => void } & PreviewMode) {
  const { t } = useTranslation();
  const { hull, weightKg, damping } = build;
  const weight: Weight = { mass_kg: weightKg, height_m: height };
  const f = useMemo(() => figures(hull, { mass_kg: weightKg, height_m: height }), [hull, weightKg, height]);
  const { running, setRunning } = useRunning({ preview, paused });
  const [speedHere, setSpeed] = useState<Speed>(1);
  const speed = preview ? 1 : speedHere;
  const startPhi = preview ? rad(PREVIEW.heelDeg) : 0;
  const sim = useRef({ phi: startPhi, rate: 0, owed: 0, clock: 0, held: false });
  const [frame, setFrame] = useState({ phi: startPhi, rate: 0, held: false });
  // The weight as the hand last set it, for the frame loop, which may run
  // before React has drawn the new height.
  const latest = useRef(weight);
  useLayoutEffect(() => {
    latest.current = { mass_kg: weightKg, height_m: height };
  }, [weightKg, height]);

  // A case's heel, once the page's build and weight are the case's.
  useCheckSetting("ship", (setting) => {
    if (preview) return false;
    if (
      settingNumber(setting, "beam_m", hull.beam_m) !== hull.beam_m ||
      settingNumber(setting, "weight_kg", weightKg) !== weightKg ||
      settingNumber(setting, "damping_per_s", damping) !== damping
    ) {
      return false;
    }
    const raised = settingNumber(setting, "weight_m", height);
    onHeight?.(raised);
    latest.current = { mass_kg: weightKg, height_m: raised };
    const phi = rad(settingNumber(setting, "heel_deg", 0));
    sim.current = { phi, rate: 0, owed: 0, clock: 0, held: false };
    setFrame({ phi, rate: 0, held: false });
    setRunning(true);
    return true;
  });

  useFrameLoop(running, (dt) => {
    const m = sim.current;
    if (m.held) return;
    m.owed += (dt * speed) / STEP_S;
    const steps = Math.floor(m.owed);
    m.owed -= steps;
    for (let k = 0; k < steps; k++) {
      [m.phi, m.rate] = step(hull, latest.current, damping, m.phi, m.rate);
      m.clock += STEP_S;
      if (preview && m.clock >= PREVIEW.everyS) {
        m.clock = 0;
        m.phi = rad(PREVIEW.heelDeg);
        m.rate = 0;
      }
    }
    setFrame({ phi: m.phi, rate: m.rate, held: false });
  });

  const view = <BasinView hull={hull} weight={weight} phi={frame.phi} />;
  if (preview) return view;

  const hold = (phi: number) => {
    sim.current = { ...sim.current, phi, rate: 0, owed: 0, held: true };
    setFrame({ phi, rate: 0, held: true });
  };
  const letGo = () => {
    sim.current = { ...sim.current, held: false };
    setFrame({ phi: sim.current.phi, rate: 0, held: false });
    setRunning(true);
  };
  const push = () => {
    sim.current = { ...sim.current, phi: rad(PUSH_DEG), rate: 0, owed: 0, held: false };
    setFrame({ phi: rad(PUSH_DEG), rate: 0, held: false });
    setRunning(true);
  };
  const upright = () => {
    sim.current = { ...sim.current, phi: 0, rate: 0, owed: 0, held: false };
    setFrame({ phi: 0, rate: 0, held: false });
  };
  const key = (e: KeyboardEvent<SVGElement>) => {
    const by = rad(KEY_DEG[e.shiftKey ? 1 : 0]);
    if (e.key === "ArrowRight" || e.key === "ArrowUp") hold(sim.current.phi + by);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") hold(sim.current.phi - by);
    else return;
    e.preventDefault();
  };
  const motion = motionOf(f, frame.phi, frame.rate, frame.held);
  return (
    <WidgetCard
      title={t("experiments.ship.play.title")}
      hint={t("experiments.ship.play.hint")}
      actions={
        <>
          <Button variant="accent" size="sm" onClick={push}>
            <Hand className="size-4" aria-hidden />
            {t("experiments.ship.play.push")}
          </Button>
          <Button variant="secondary" size="sm" onClick={upright}>
            <RotateCcw className="size-4" aria-hidden />
            {t("experiments.ship.play.upright")}
          </Button>
          <RunPauseButton running={running} onToggle={() => setRunning(!running)} />
        </>
      }
    >
      <div className={`${SIDE.grid} ${SIDE.cap.md}`}>
        <div className={`${SIDE.top} space-y-4`}>
          <SliderField
            label={t("experiments.ship.play.weight")}
            unit="cm"
            value={height * 100}
            min={KEEL_M * 100}
            max={MAST_M * 100}
            step={0.5}
            digits={1}
            hint={t("experiments.ship.play.weight_hint")}
            onChange={(cm) => onHeight?.(Math.round(cm * 10) / 1000)}
          />
          <SpeedToggle speeds={SPEEDS} value={speed} onChange={setSpeed} />
        </div>
        <div className={`${SIDE.views} mx-auto w-full max-w-md`}>
          <figure className="space-y-1">
            <BasinView hull={hull} weight={weight} phi={frame.phi} onTilt={hold} onLetGo={letGo} onKey={key} />
            <figcaption className="text-center text-caption text-muted">
              {t("experiments.ship.play.caption")}
            </figcaption>
          </figure>
        </div>
        <div className={SIDE.column}>
          <p
            className={`text-sm font-medium ${motion === "upright" ? "text-primary" : "text-secondary"}`}
            role="status"
          >
            {t(`experiments.ship.play.motion.${motion}`)}
          </p>
          <Figures
            tiles={[
              {
                key: "heel",
                label: t("experiments.ship.play.heel"),
                value: deg(folded(frame.phi)),
                digits: 0,
                unit: "°",
              },
              {
                key: "arm",
                label: t("experiments.ship.play.arm"),
                value: rightingArmM(hull, weight, frame.phi) * 100,
                digits: 1,
                unit: "cm",
              },
              { key: "gm", label: t("experiments.ship.play.gm"), value: f.gm_m * 100, digits: 1, unit: "cm" },
              {
                key: "period",
                label: t("experiments.ship.play.period"),
                value: f.period_s,
                digits: 2,
                unit: "s",
              },
            ]}
          />
        </div>
      </div>
    </WidgetCard>
  );
}

function ShipBuild({ build, weight, onChange }: { build: Build; weight: Weight; onChange: (next: Build) => void }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hue = useChartHue();
  const f = figures(build.hull, weight);
  const rows = useMemo(() => {
    const angles = Array.from({ length: CHART_POINTS }, (_, k) => (180 * k) / (CHART_POINTS - 1));
    const arms = curveM(build.hull, weight, angles);
    return angles.map((a, k) => ({ deg: a, arm: arms[k] * 100, small: f.gm_m * Math.sin(rad(a)) * 100 }));
  }, [build.hull, weight, f.gm_m]);
  // A build that would sink is not offered: the sliders stop where it floats.
  const change = (next: Build) => {
    if (floats(next.hull, { mass_kg: next.weightKg, height_m: weight.height_m })) onChange(next);
  };
  return (
    <WidgetCard title={t("experiments.ship.change.title")} hint={t("experiments.ship.change.hint")}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SliderField
          label={t("experiments.ship.change.beam")}
          unit="cm"
          value={build.hull.beam_m * 100}
          min={12}
          max={40}
          step={1}
          digits={0}
          hint={t("experiments.ship.change.beam_hint")}
          onChange={(cm) => change({ ...build, hull: { ...build.hull, beam_m: cm / 100 } })}
        />
        <SliderField
          label={t("experiments.ship.change.weight")}
          unit="kg"
          value={build.weightKg}
          min={0.2}
          max={3}
          step={0.1}
          digits={1}
          hint={t("experiments.ship.change.weight_hint")}
          onChange={(kg) => change({ ...build, weightKg: Math.round(kg * 10) / 10 })}
        />
        <SliderField
          label={t("experiments.ship.change.damping")}
          unit="1/s"
          value={build.damping}
          min={0}
          max={2}
          step={0.05}
          digits={2}
          hint={t("experiments.ship.change.damping_hint")}
          onChange={(d) => change({ ...build, damping: Math.round(d * 100) / 100 })}
        />
      </div>
      <Figures
        tiles={[
          { key: "draft", label: t("experiments.ship.figures.draft"), value: f.draft_m * 100, digits: 1, unit: "cm" },
          { key: "kb", label: t("experiments.ship.figures.kb"), value: f.kb_m * 100, digits: 1, unit: "cm" },
          { key: "bm", label: t("experiments.ship.figures.bm"), value: f.bm_m * 100, digits: 1, unit: "cm" },
          { key: "kg", label: t("experiments.ship.figures.kg"), value: f.kg_m * 100, digits: 1, unit: "cm" },
          {
            key: "limit",
            label: t("experiments.ship.figures.limit"),
            value: f.weight_limit_m === null ? null : f.weight_limit_m * 100,
            digits: 1,
            unit: "cm",
          },
          {
            key: "vanishing",
            label: t("experiments.ship.figures.vanishing"),
            value: f.gm_m > 0 ? (f.vanishing_deg ?? 180) : null,
            digits: 0,
            unit: "°",
          },
        ]}
      />
      <p className="text-sm text-secondary">{t("experiments.ship.chart.curve_hint")}</p>
      <SeriesChart
        rows={rows}
        series={[
          { key: "arm", label: t("experiments.ship.chart.arm"), color: hue(HULL_HUE) },
          { key: "small", label: t("experiments.ship.chart.small"), color: hue(G_HUE), dashed: true },
        ]}
        axes={[
          {
            id: "y",
            title: `${t("experiments.ship.chart.arm")} (cm)`,
            format: (v) => formatNumber(v, 1, locale),
            includeZero: true,
          },
        ]}
        x={{ key: "deg", title: `${t("experiments.ship.chart.heel")} (°)`, format: (v) => formatNumber(v, 0, locale) }}
      />
    </WidgetCard>
  );
}

function ShipModel() {
  const { t } = useTranslation();
  const s = (key: string) => t(`experiments.ship.symbols.${key}`);
  return (
    <>
      <p>{t("experiments.ship.model.intro")}</p>
      <Equation
        tex={String.raw`\rho\,L\,b\,d = m_h + m_w`}
        reads={t("experiments.ship.model.draft")}
        symbols={[
          { tex: String.raw`\rho`, meaning: s("rho"), unit: "kg/m³" },
          { tex: "L", meaning: s("l"), unit: "m" },
          { tex: "b", meaning: s("b"), unit: "m" },
          { tex: "d", meaning: s("d"), unit: "m" },
          { tex: "m_h", meaning: s("mh"), unit: "kg" },
          { tex: "m_w", meaning: s("mw"), unit: "kg" },
        ]}
      />
      <Equation
        tex={String.raw`KG = \frac{m_h\,z_h + m_w\,z_w}{m_h + m_w}`}
        reads={t("experiments.ship.model.gravity")}
        symbols={[
          { tex: "KG", meaning: s("kg"), unit: "m" },
          { tex: "z_h", meaning: s("zh"), unit: "m" },
          { tex: "z_w", meaning: s("zw"), unit: "m" },
        ]}
      />
      <Equation
        tex={String.raw`GZ(\varphi) = y_B\cos\varphi + (z_B - KG)\sin\varphi`}
        reads={t("experiments.ship.model.arm")}
        symbols={[
          { tex: "GZ", meaning: s("gz"), unit: "m" },
          { tex: String.raw`\varphi`, meaning: s("phi"), unit: "rad" },
          { tex: "y_B, z_B", meaning: s("yzb"), unit: "m" },
        ]}
      />
      <Equation
        tex={String.raw`GM = KB + BM - KG, \qquad KB = \frac{d}{2}, \qquad BM = \frac{I}{V} = \frac{b^2}{12\,d}`}
        reads={t("experiments.ship.model.metacentre")}
        symbols={[
          { tex: "GM", meaning: s("gm"), unit: "m" },
          { tex: "KB", meaning: s("kb"), unit: "m" },
          { tex: "BM", meaning: s("bm"), unit: "m" },
          { tex: "I", meaning: s("i"), unit: "m⁴" },
          { tex: "V", meaning: s("v"), unit: "m³" },
        ]}
      />
      <Equation
        tex={String.raw`GZ = \sin\varphi\left(GM + \tfrac12\,BM\,\tan^2\varphi\right) \approx GM\,\sin\varphi`}
        reads={t("experiments.ship.model.wall")}
        symbols={[
          { tex: "GZ", meaning: s("gz"), unit: "m" },
          { tex: String.raw`\varphi`, meaning: s("phi"), unit: "rad" },
          { tex: "GM", meaning: s("gm"), unit: "m" },
          { tex: "BM", meaning: s("bm"), unit: "m" },
        ]}
      />
    </>
  );
}

function ShipComputed() {
  const { t } = useTranslation();
  const s = (key: string) => t(`experiments.ship.symbols.${key}`);
  return (
    <>
      <p>{t("experiments.ship.computed.system")}</p>
      <Equation
        tex={String.raw`I\,\ddot\varphi = -m\,g\,GZ(\varphi) - 2\beta\,I\,\dot\varphi, \qquad I = m_h k_h^2 + m_h (z_h - KG)^2 + m_w (z_w - KG)^2`}
        reads={t("experiments.ship.computed.roll")}
        symbols={[
          { tex: "I", meaning: s("inertia"), unit: "kg·m²" },
          { tex: String.raw`\varphi`, meaning: s("phi"), unit: "rad" },
          { tex: "m", meaning: s("m"), unit: "kg" },
          { tex: "g", meaning: s("g"), unit: "m/s²" },
          { tex: "GZ", meaning: s("gz"), unit: "m" },
          { tex: String.raw`\beta`, meaning: s("beta"), unit: "1/s" },
          { tex: "k_h", meaning: s("kh"), unit: "m" },
        ]}
      />
      <Equation
        tex={String.raw`T = 2\pi\sqrt{\frac{I}{m\,g\,GM}}`}
        reads={t("experiments.ship.computed.period")}
        symbols={[
          { tex: "T", meaning: s("t"), unit: "s" },
          { tex: "GM", meaning: s("gm"), unit: "m" },
        ]}
      />
      <p>{t("experiments.ship.computed.check")}</p>
      <p>{t("experiments.ship.computed.left_out")}</p>
    </>
  );
}

function ShipTrick({ hull, weightKg }: { hull: Hull; weightKg: number }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hue = useChartHue();
  const rows = useMemo(() => {
    const angles = Array.from({ length: CHART_POINTS }, (_, k) => (180 * k) / (CHART_POINTS - 1));
    const curves = TRICK_HEIGHTS.map((h) => curveM(hull, { mass_kg: weightKg, height_m: h }, angles));
    return angles.map((a, k) => {
      const row: Record<string, number> = { deg: a };
      TRICK_HEIGHTS.forEach((_, i) => {
        row[`h${i}`] = curves[i][k] * 100;
      });
      return row;
    });
  }, [hull, weightKg]);
  return (
    <>
      <p>{t("experiments.ship.sweet.moves")}</p>
      <p>{t("experiments.ship.sweet.numbers")}</p>
      <p>{t("experiments.ship.sweet.high")}</p>
      <p className="text-sm text-secondary">{t("experiments.ship.chart.trick_hint")}</p>
      <SeriesChart
        rows={rows}
        series={TRICK_HEIGHTS.map((h, i) => ({
          key: `h${i}`,
          label: t("experiments.ship.chart.weight_at", { cm: formatNumber(h * 100, 0, locale) }),
          color: hue(TRICK_HUES[i]),
        }))}
        axes={[
          {
            id: "y",
            title: `${t("experiments.ship.chart.arm")} (cm)`,
            format: (v) => formatNumber(v, 1, locale),
            includeZero: true,
          },
        ]}
        x={{ key: "deg", title: `${t("experiments.ship.chart.heel")} (°)`, format: (v) => formatNumber(v, 0, locale) }}
      />
    </>
  );
}
