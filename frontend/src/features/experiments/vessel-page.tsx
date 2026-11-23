import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, LoadingState } from "@eifi1/ui-kit";
import { SeriesChart } from "@/shared/charts/series-chart";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber } from "@/shared/lib/format";
import { useChartHue } from "@/shared/state/palette-store";
import type { DrainingVesselRequest } from "@/shared/types";
import { SliderField } from "@/shared/ui/slider-field";
import { Figures, WidgetCard } from "@/shared/ui/widget";
import { Equation } from "./equation";
import { ExhibitFrame } from "./exhibit-frame";
import { BuildPending } from "./build-pending";
import { sameBuild, settingNumber, useCheckSetting, useTakeCheckRequest, type CheckSetting } from "./check-setting";
import { useFrameLoop, useRunning } from "./play";
import { RestartButton, RunPauseButton, SpeedToggle } from "./play-controls";
import { PreviewPending, type PreviewMode, type PreviewProps } from "./preview-mode";
import {
  WIDEST_HOLE,
  advance,
  figures,
  filled,
  jetRange,
  levelExact,
  outflow,
  type Draining,
  type DrainingVessel,
} from "./simulate/vessel";
import { SIDE, STAGE, VIEW_FRAME } from "./stage";
import { useExperimentsDefaults } from "./use-experiments";

/** Real time, as at the exhibit, and two quicker: the tube takes a minute. */
const SPEEDS = [1, 5, 20] as const;
type Speed = (typeof SPEEDS)[number];

/** The preview pulls every plug at once, lets the tube run down to its lowest
 *  hole this much faster than real time, holds it there and fills it again. */
const PREVIEW_SPEED = 8;
const PREVIEW_HOLD_S = 1.5;

const CHART_POINTS = 401;

const WATER_HUE = 0;
const RANGE_HUE = 2;

/** The holes' heights in centimetres, as the page names them. */
const cm = (m: number) => Math.round(m * 100);

/**
 * The draining vessel (`experiments.vessel`): a tube of water whose plugs the
 * reader pulls and puts back, its level stepped by the browser port
 * (`simulate/vessel.ts`, held to the engine by `simulate.test.ts`) and its
 * jets thrown at Torricelli's speed. No route.
 */
/** The build a check case's setting asks for, the rest as `vessel`. */
function vesselOf(vessel: DrainingVessel, setting: CheckSetting): DrainingVessel {
  return {
    ...vessel,
    diameter_m: settingNumber(setting, "diameter_m", vessel.diameter_m),
    fill_m: settingNumber(setting, "fill_m", vessel.fill_m),
    hole_diameter_m: settingNumber(setting, "hole_diameter_m", vessel.hole_diameter_m),
    discharge: settingNumber(setting, "discharge", vessel.discharge),
    stand_m: settingNumber(setting, "stand_m", vessel.stand_m),
  };
}

export function VesselPage() {
  const { t } = useTranslation();
  const defaults = useExperimentsDefaults();
  const [build, setBuild] = useState<DrainingVesselRequest | null>(null);
  const vessel = build ?? defaults.data?.vessel ?? null;
  // A check case's "Set it up": the build here, which fills the tube anew; the
  // play, built anew for it or already on it, pulls the case's plugs.
  useTakeCheckRequest("vessel", vessel, (setting, current) => {
    const next = vesselOf(current, setting);
    if (!sameBuild(next, current)) setBuild(next);
  });
  return (
    <ExhibitFrame
      exhibit="vessel"
      atTheExhibit={
        <>
          <p>{t("experiments.vessel.at.build")}</p>
          <p>{t("experiments.vessel.at.drain")}</p>
          <p>{t("experiments.vessel.at.origin")}</p>
        </>
      }
      whatHappens={<VesselModel />}
      computed={<VesselComputed />}
      sweetSpot={
        vessel ? <VesselTrick vessel={vessel} /> : <LoadingState className="py-6" label={t("common.loading")} />
      }
    >
      {defaults.isPending || !vessel ? (
        <BuildPending pending={defaults.isPending} error={defaults.error} />
      ) : (
        <>
          {/* A new build is a new filling: every plug back in. */}
          <VesselPlay key={JSON.stringify(vessel)} vessel={vessel} />
          <VesselBuild vessel={vessel} onChange={setBuild} />
        </>
      )}
    </ExhibitFrame>
  );
}

/** The tube filled, every plug pulled, run down and filled again. */
export function VesselPreview({ paused }: PreviewProps) {
  const defaults = useExperimentsDefaults();
  const vessel = defaults.data?.vessel;
  return vessel ? <VesselPlay vessel={vessel} preview paused={paused} /> : <PreviewPending />;
}

/** How wide the drawing reaches: past the farthest a jet of this build can land. */
function reachM(vessel: DrainingVessel): number {
  const farthest = Math.max(
    figures(vessel).farthest_m,
    ...vessel.holes_m.map((y) => jetRange(vessel, vessel.fill_m, y)),
  );
  return Math.max(0.6, farthest * 1.08);
}

/** The tube on its stand over the basin, cut open at the front: the water, the
 *  plugs and the jets. A hole's plug is pulled or put back with a click on it. */
function VesselView({
  vessel,
  level,
  opened,
  onToggle,
}: {
  vessel: DrainingVessel;
  level: number;
  opened: readonly boolean[];
  onToggle?: (hole: number) => void;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hue = useChartHue();
  const water = hue(WATER_HUE);
  const d = vessel.diameter_m;
  const s = vessel.stand_m;
  const wall = 0.006;
  const reach = reachM(vessel);
  const left = -d - wall - 0.1;
  const top = s + vessel.height_m + 0.06;
  const bottom = 0.09;
  const ticks = Array.from({ length: Math.floor(reach / 0.1) + 1 }, (_, k) => k / 10);
  return (
    <svg
      viewBox={`${left} ${-top} ${reach - left} ${top + bottom}`}
      role="img"
      aria-label={t("experiments.vessel.view")}
      className={`${STAGE.wide} ${VIEW_FRAME}`}
    >
      {/* The basin: its floor, a rim at each end, and the ruler along it from the wall. */}
      <path
        d={`M ${left + 0.03} ${-0.05} V 0 H ${reach - 0.02} V ${-0.05}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      {ticks.map((x) => (
        <line
          key={x}
          x1={x}
          y1={0}
          x2={x}
          y2={Math.round(x * 10) % 5 === 0 ? 0.03 : 0.015}
          stroke="currentColor"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {ticks
        .filter((x) => x > 0 && Math.round(x * 10) % 5 === 0)
        .map((x) => (
          <text key={`label-${x}`} x={x} y={0.07} fontSize={0.045} textAnchor="middle" fill="currentColor">
            {formatNumber(x, 1, locale)} m
          </text>
        ))}
      {/* The stand. */}
      <rect x={-d - wall} y={-s} width={d + 2 * wall} height={s} className="fill-current" fillOpacity={0.18} />
      {/* The water, and the level it was filled to. */}
      <rect x={-d} y={-(s + level)} width={d} height={level} fill={water} opacity={0.45} />
      <line
        x1={-d}
        y1={-(s + level)}
        x2={0}
        y2={-(s + level)}
        stroke={water}
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1={-d - 0.05}
        y1={-(s + vessel.fill_m)}
        x2={-d - wall}
        y2={-(s + vessel.fill_m)}
        stroke="currentColor"
        strokeDasharray="3 2"
        vectorEffect="non-scaling-stroke"
      />
      {/* The tube's walls and bottom. */}
      <path
        d={`M ${-d - wall} ${-(s + vessel.height_m)} V ${-s} H ${wall} V ${-(s + vessel.height_m)}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      {vessel.holes_m.map((y, i) => {
        const at = s + y;
        const range = opened[i] ? jetRange(vessel, level, y) : 0;
        return (
          <g key={y}>
            {range > 0 && (
              <>
                {/* A level throw is a parabola: the quadratic Bézier with its control above the landing's middle. */}
                <path
                  d={`M ${wall} ${-at} Q ${wall + range / 2} ${-at} ${wall + range} 0`}
                  fill="none"
                  stroke={water}
                  strokeWidth={Math.max(1.5, Math.min(4, vessel.hole_diameter_m * 400))}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
                <ellipse cx={wall + range} cy={-0.004} rx={0.03} ry={0.008} fill={water} opacity={0.6} />
              </>
            )}
            {opened[i] ? (
              <circle cx={wall} cy={-at} r={0.006} fill="var(--bg-surface)" stroke="currentColor" strokeWidth={0.003} />
            ) : (
              <rect x={wall} y={-at - 0.008} width={0.022} height={0.016} rx={0.003} className="fill-current" />
            )}
            {onToggle && (
              <circle
                cx={wall + 0.01}
                cy={-at}
                r={0.045}
                fill="transparent"
                className="cursor-pointer"
                onClick={() => onToggle(i)}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

interface Sim {
  state: Draining;
  clock: number;
  started: boolean;
  /** When the depth over the lowest hole fell past half, once it has. */
  halvedS: number | null;
  /** The preview's wait at the bottom before it fills again. */
  heldS: number;
}

function VesselPlay({ vessel, preview = false, paused = false }: { vessel: DrainingVessel } & PreviewMode) {
  const { t } = useTranslation();
  const locale = useLocale();
  const closed = vessel.holes_m.map(() => false);
  const sim = useRef<Sim>({ state: filled(vessel), clock: 0, started: false, halvedS: null, heldS: 0 });
  const [opened, setOpened] = useState<boolean[]>(() => (preview ? vessel.holes_m.map(() => true) : closed));
  const plugs = useRef<boolean[]>(opened);
  const [view, setView] = useState({
    level: vessel.fill_m,
    clock: 0,
    halvedS: null as number | null,
    started: false,
  });
  const { running, setRunning } = useRunning({ preview, paused });
  const [speedHere, setSpeed] = useState<Speed>(1);
  const speed = preview ? PREVIEW_SPEED : speedHere;
  const lowest = vessel.holes_m[0];
  const half = lowest + (vessel.fill_m - lowest) / 2;

  const show = () =>
    setView({
      level: sim.current.state.level_m,
      clock: sim.current.clock,
      halvedS: sim.current.halvedS,
      started: sim.current.started,
    });
  const setPlugs = (next: boolean[]) => {
    plugs.current = next;
    setOpened(next);
  };
  const refill = () => {
    sim.current = { state: filled(vessel), clock: 0, started: false, halvedS: null, heldS: 0 };
    show();
  };

  useFrameLoop(running, (dt) => {
    const s = sim.current;
    if (preview) s.started = true;
    if (!s.started) return;
    if (preview && s.state.level_m <= lowest) {
      s.heldS += dt;
      if (s.heldS > PREVIEW_HOLD_S) refill();
      return;
    }
    s.clock += dt * speed;
    s.state = advance(vessel, s.state, plugs.current, s.clock);
    if (s.halvedS === null && s.state.level_m <= half) s.halvedS = s.clock;
    show();
  });

  // The case's run: the tube full, the case's plugs pulled, the clock from naught.
  useCheckSetting("vessel", (setting) => {
    if (preview || !sameBuild(vesselOf(vessel, setting), vessel)) return false;
    refill();
    setPlugs(vessel.holes_m.map((_, i) => setting.open === "all" || i === 0));
    sim.current.started = true;
    show();
    setRunning(true);
    return true;
  });

  // A plug pulled or put back: the first one pulled starts the clock.
  const toggle = (hole: number) => {
    setPlugs(plugs.current.map((o, i) => (i === hole ? !o : o)));
    sim.current.started = true;
    show();
    setRunning(true);
  };

  const views = (
    <VesselView vessel={vessel} level={view.level} opened={opened} onToggle={preview ? undefined : toggle} />
  );
  if (preview) return views;

  const flow = outflow(vessel, view.level, opened);
  const farthest = Math.max(0, ...vessel.holes_m.map((y, i) => (opened[i] ? jetRange(vessel, view.level, y) : 0)));
  return (
    <WidgetCard
      title={t("experiments.vessel.play.title")}
      hint={t("experiments.vessel.play.hint")}
      actions={
        <>
          <RunPauseButton running={running} onToggle={() => setRunning(!running)} />
          <RestartButton
            onClick={() => {
              setPlugs(closed);
              refill();
            }}
            label={t("experiments.vessel.play.refill")}
          />
        </>
      }
    >
      <div className={`${SIDE.grid} ${SIDE.cap.xl}`}>
        <div className={SIDE.top}>
          <SpeedToggle speeds={SPEEDS} value={speedHere} onChange={setSpeed} />
        </div>
        <div className={`${SIDE.views} mx-auto w-full max-w-xl`}>
          <figure className="space-y-1">
            {views}
            <figcaption className="text-center text-caption text-muted">
              {t("experiments.vessel.play.caption", {
                diameter: formatNumber(vessel.diameter_m * 100, 0, locale),
                hole: formatNumber(vessel.hole_diameter_m * 1000, 1, locale),
              })}
            </figcaption>
          </figure>
        </div>
        <div className={SIDE.column}>
          <div className="space-y-2">
            <p className="text-sm text-secondary">{t("experiments.vessel.play.plugs")}</p>
            <div className="flex flex-wrap gap-2">
              {[...vessel.holes_m.keys()].reverse().map((i) => (
                <Button
                  key={i}
                  size="sm"
                  variant={opened[i] ? "accent" : "secondary"}
                  aria-pressed={opened[i]}
                  onClick={() => toggle(i)}
                >
                  {t("experiments.vessel.play.hole", { height: cm(vessel.holes_m[i]) })}
                </Button>
              ))}
            </div>
          </div>
          {!view.started && (
            <p className="text-sm text-secondary" role="status">
              {t("experiments.vessel.play.full", { fill: cm(vessel.fill_m) })}
            </p>
          )}
          <Figures
            tiles={[
              { key: "time", label: t("experiments.vessel.play.time"), value: view.clock, digits: 1, unit: "s" },
              {
                key: "level",
                label: t("experiments.vessel.play.level"),
                value: view.level * 100,
                digits: 1,
                unit: "cm",
              },
              { key: "flow", label: t("experiments.vessel.play.flow"), value: flow, digits: 2, unit: "l/min" },
              { key: "jet", label: t("experiments.vessel.play.jet"), value: farthest, digits: 2, unit: "m" },
              {
                key: "halved",
                label: t("experiments.vessel.play.halved", { height: formatNumber(half * 100, 1, locale) }),
                value: view.halvedS,
                digits: 1,
                unit: "s",
              },
            ]}
          />
        </div>
      </div>
    </WidgetCard>
  );
}

function VesselBuild({ vessel, onChange }: { vessel: DrainingVessel; onChange: (next: DrainingVessel) => void }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hue = useChartHue();
  const shown = figures(vessel);
  const widestMm = Math.min(15, vessel.diameter_m * WIDEST_HOLE * 1000);
  const rows = useMemo(
    () =>
      Array.from({ length: CHART_POINTS }, (_, k) => {
        const y = (vessel.fill_m * k) / (CHART_POINTS - 1);
        return { y: y * 100, range: jetRange(vessel, vessel.fill_m, y) };
      }),
    [vessel],
  );
  const dry = vessel.holes_m.filter((y) => y >= vessel.fill_m).length;
  return (
    <WidgetCard title={t("experiments.vessel.change.title")} hint={t("experiments.vessel.change.hint")}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SliderField
          label={t("experiments.vessel.change.diameter")}
          unit="cm"
          value={vessel.diameter_m * 100}
          min={4}
          max={20}
          step={1}
          digits={0}
          hint={t("experiments.vessel.change.diameter_hint")}
          onChange={(v) =>
            onChange({
              ...vessel,
              diameter_m: v / 100,
              hole_diameter_m: Math.min(vessel.hole_diameter_m, (v / 100) * WIDEST_HOLE),
            })
          }
        />
        <SliderField
          label={t("experiments.vessel.change.hole")}
          unit="mm"
          value={vessel.hole_diameter_m * 1000}
          min={3}
          max={widestMm}
          step={0.5}
          digits={1}
          hint={t("experiments.vessel.change.hole_hint")}
          onChange={(v) => onChange({ ...vessel, hole_diameter_m: v / 1000 })}
        />
        <SliderField
          label={t("experiments.vessel.change.fill")}
          unit="cm"
          value={vessel.fill_m * 100}
          min={20}
          max={vessel.height_m * 100}
          step={1}
          digits={0}
          hint={t("experiments.vessel.change.fill_hint")}
          onChange={(v) => onChange({ ...vessel, fill_m: v / 100 })}
        />
        <SliderField
          label={t("experiments.vessel.change.discharge")}
          unit=""
          value={vessel.discharge}
          min={0.5}
          max={1}
          step={0.01}
          digits={2}
          hint={t("experiments.vessel.change.discharge_hint")}
          onChange={(v) => onChange({ ...vessel, discharge: v })}
        />
        <SliderField
          label={t("experiments.vessel.change.stand")}
          unit="cm"
          value={vessel.stand_m * 100}
          min={0}
          max={60}
          step={5}
          digits={0}
          hint={t("experiments.vessel.change.stand_hint")}
          onChange={(v) => onChange({ ...vessel, stand_m: v / 100 })}
        />
      </div>
      {dry > 0 && (
        <p className="text-sm text-secondary" role="status">
          {t("experiments.vessel.change.dry", { count: dry })}
        </p>
      )}
      <Figures
        tiles={[
          { key: "drain", label: t("experiments.vessel.figures.drain"), value: shown.drain_s, digits: 1, unit: "s" },
          { key: "half", label: t("experiments.vessel.figures.half"), value: shown.half_s, digits: 1, unit: "s" },
          {
            key: "speed",
            label: t("experiments.vessel.figures.speed"),
            value: shown.speed_m_s,
            digits: 2,
            unit: "m/s",
          },
          {
            key: "flow",
            label: t("experiments.vessel.figures.flow"),
            value: shown.outflow_l_min,
            digits: 2,
            unit: "l/min",
          },
          { key: "volume", label: t("experiments.vessel.figures.volume"), value: shown.volume_l, digits: 2, unit: "l" },
          {
            key: "farthest",
            label: t("experiments.vessel.figures.farthest"),
            value: shown.farthest_m,
            digits: 2,
            unit: "m",
          },
        ]}
      />
      <p className="text-sm text-secondary">{t("experiments.vessel.chart.range_hint")}</p>
      <SeriesChart
        rows={rows}
        series={[{ key: "range", label: t("experiments.vessel.chart.range"), color: hue(WATER_HUE) }]}
        axes={[
          {
            id: "y",
            title: `${t("experiments.vessel.chart.range")} (m)`,
            format: (v) => formatNumber(v, 2, locale),
            includeZero: true,
          },
        ]}
        x={{
          key: "y",
          title: `${t("experiments.vessel.chart.hole")} (cm)`,
          format: (v) => formatNumber(v, 0, locale),
        }}
      />
    </WidgetCard>
  );
}

function VesselModel() {
  const { t } = useTranslation();
  const s = (key: string) => t(`experiments.vessel.symbols.${key}`);
  return (
    <>
      <p>{t("experiments.vessel.model.intro")}</p>
      <Equation
        tex={String.raw`v = \sqrt{2\,g\,(h - y)}`}
        reads={t("experiments.vessel.model.torricelli")}
        symbols={[
          { tex: "v", meaning: s("v"), unit: "m/s" },
          { tex: "g", meaning: s("g"), unit: "m/s²" },
          { tex: "h", meaning: s("h"), unit: "m" },
          { tex: "y", meaning: s("y"), unit: "m" },
        ]}
      />
      <Equation
        tex={String.raw`Q = \mu\,a\,v`}
        reads={t("experiments.vessel.model.flow")}
        symbols={[
          { tex: "Q", meaning: s("q"), unit: "m³/s" },
          { tex: String.raw`\mu`, meaning: s("mu") },
          { tex: "a", meaning: s("a"), unit: "m²" },
        ]}
      />
      <Equation
        tex={String.raw`A\,\frac{dh}{dt} = -\mu\,a \sum_{k} \sqrt{2\,g\,(h - y_k)}`}
        reads={t("experiments.vessel.model.balance")}
        symbols={[
          { tex: "A", meaning: s("area"), unit: "m²" },
          { tex: "t", meaning: s("t"), unit: "s" },
          { tex: "y_k", meaning: s("yk"), unit: "m" },
        ]}
      />
      <Equation
        tex={String.raw`x = 2\,\sqrt{(h - y)\,(s + y)}`}
        reads={t("experiments.vessel.model.range")}
        symbols={[
          { tex: "x", meaning: s("x"), unit: "m" },
          { tex: "s", meaning: s("s"), unit: "m" },
        ]}
      />
    </>
  );
}

function VesselComputed() {
  const { t } = useTranslation();
  const c = (key: string) => t(`experiments.vessel.computed.${key}`);
  return (
    <>
      <p>{c("system")}</p>
      <Equation
        tex={String.raw`\sqrt{h(t) - y} = \sqrt{h_0 - y} - \frac{\mu\,a}{A}\,\sqrt{\frac{g}{2}}\;t, \qquad T = \frac{A}{\mu\,a}\,\sqrt{\frac{2\,(h_0 - y)}{g}}`}
        reads={c("exact")}
        symbols={[
          { tex: "h_0", meaning: c("h0"), unit: "m" },
          { tex: "T", meaning: c("T"), unit: "s" },
        ]}
      />
      <p>{c("check")}</p>
      <p>{c("left_out")}</p>
    </>
  );
}

function VesselTrick({ vessel }: { vessel: DrainingVessel }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hue = useChartHue();
  const lowest = vessel.holes_m[0];
  const drain = figures(vessel).drain_s;
  const rows = useMemo(
    () =>
      Array.from({ length: CHART_POINTS }, (_, k) => {
        const time = (drain * 1.05 * k) / (CHART_POINTS - 1);
        const level = levelExact(vessel, lowest, time);
        return { s: time, depth: (level - lowest) * 100, range: jetRange(vessel, level, lowest) };
      }),
    [vessel, lowest, drain],
  );
  return (
    <>
      <p>{t("experiments.vessel.sweet.root")}</p>
      <p>{t("experiments.vessel.sweet.numbers")}</p>
      <p>{t("experiments.vessel.sweet.jet")}</p>
      <Equation
        tex={String.raw`\frac{h - y}{h_0 - y} = \left(1 - \frac{t}{T}\right)^2, \qquad t_{1/2} = \left(1 - \frac{1}{\sqrt{2}}\right) T`}
        reads={t("experiments.vessel.sweet.half")}
        symbols={[{ tex: "t_{1/2}", meaning: t("experiments.vessel.symbols.half"), unit: "s" }]}
      />
      <p className="text-sm text-secondary">{t("experiments.vessel.chart.time_hint")}</p>
      <SeriesChart
        rows={rows}
        series={[
          { key: "depth", label: t("experiments.vessel.chart.depth"), color: hue(WATER_HUE), axis: "depth" },
          { key: "range", label: t("experiments.vessel.chart.range"), color: hue(RANGE_HUE), axis: "range" },
        ]}
        axes={[
          {
            id: "depth",
            title: `${t("experiments.vessel.chart.depth")} (cm)`,
            orientation: "left",
            format: (v) => formatNumber(v, 0, locale),
            includeZero: true,
          },
          {
            id: "range",
            title: `${t("experiments.vessel.chart.range")} (m)`,
            orientation: "right",
            format: (v) => formatNumber(v, 2, locale),
            includeZero: true,
          },
        ]}
        x={{
          key: "s",
          title: `${t("experiments.vessel.chart.time")} (s)`,
          format: (v) => formatNumber(v, 0, locale),
        }}
      />
    </>
  );
}
