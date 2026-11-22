import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUp } from "lucide-react";
import { Button, LoadingState } from "@eifi1/ui-kit";
import { SeriesChart } from "@/shared/charts/series-chart";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber } from "@/shared/lib/format";
import { useChartHue } from "@/shared/state/palette-store";
import { SliderField } from "@/shared/ui/slider-field";
import { Figures, WidgetCard } from "@/shared/ui/widget";
import { Equation } from "./equation";
import { ExhibitFrame } from "./exhibit-frame";
import { BuildPending } from "./build-pending";
import { settingNumber, useCheckSetting, useTakeCheckRequest } from "./check-setting";
import { PreviewPending, type PreviewMode, type PreviewProps } from "./preview-mode";
import { useFrameLoop, useRunning } from "./play";
import { RunPauseButton } from "./play-controls";
import { STEP_S, bubbleM3, figures, hoverDepthM, liftN, step, type Bottle, type Diver } from "./simulate/diver";
import { SIDE, VIEW_FRAME } from "./stage";
import { useExperimentsDefaults } from "./use-experiments";

/** The hand's squeeze the slider spans, kPa. */
const MOST_SQUEEZE_KPA = 25;
/** The preview's hand: squeezing and easing off around this, by this much, this slowly. */
const PREVIEW_SQUEEZE = { mean: 9400, swing: 1600, period: 10 } as const;
/** Within this of its hover depth, and this slow, the diver is said to hover (for now). */
const HOVERING = { depth: 0.005, speed: 0.003 } as const;
/** The hover case's start below the hover depth, m: its micrometre (`domain/checks/diver.py`). */
const HOVER_OFF_M = 1e-6;

/** The drawing: the water's surface, the depth drawn, the bottle's sides; the diver, not to scale. */
const VIEW = { width: 200, height: 290, surface: 40, span: 230, left: 55, right: 145, tube: 14, tall: 34 } as const;
const WATER_HUE = 2;
const AIR_HUE = 5;
const HOVER_HUE = 4;
const LIFT_HUES = [0, 2, 4];
/** The squeezes the trick's chart draws the lift for, kPa. */
const TRICK_SQUEEZES = [9, 10, 11];
const CHART_POINTS = 121;

type Motion = "floats" | "rises" | "hovers" | "sinks" | "bottom";

function motionOf(diver: Diver, bottle: Bottle, depth: number, speed: number, squeeze: number): Motion {
  if (depth <= 0 && liftN(diver, 0, squeeze) >= 0) return "floats";
  if (depth >= bottle.depth_m) return "bottom";
  if (Math.abs(depth - hoverDepthM(diver, squeeze)) < HOVERING.depth && Math.abs(speed) < HOVERING.speed)
    return "hovers";
  return speed < 0 ? "rises" : "sinks";
}

/**
 * The Cartesian diver (`experiments.diver`): a glass tube with a bubble in a
 * bottle, squeezed by the reader's hand (a slider), its motion stepped by the
 * browser port (`simulate/diver.ts`, held to the engine by `simulate.test.ts`).
 * No route.
 */
export function DiverPage() {
  const { t } = useTranslation();
  const defaults = useExperimentsDefaults();
  const data = defaults.data?.diver;
  const [build, setBuild] = useState<{ diver: Diver; bottle: Bottle } | null>(null);
  const diver = build?.diver ?? data?.diver ?? null;
  const bottle = build?.bottle ?? (data ? { depth_m: data.depth_m } : null);
  // A check case's "Set it up": the diver's air and the bottle's depth here;
  // the play, built anew for them or already on them, sets the hand and where
  // the diver starts.
  useTakeCheckRequest("diver", diver && bottle ? { diver, bottle } : null, (setting, current) => {
    const air = settingNumber(setting, "air_m3", current.diver.air_m3);
    const depth = settingNumber(setting, "depth_m", current.bottle.depth_m);
    if (air !== current.diver.air_m3 || depth !== current.bottle.depth_m) {
      setBuild({ diver: { ...current.diver, air_m3: air }, bottle: { depth_m: depth } });
    }
  });
  return (
    <ExhibitFrame
      exhibit="diver"
      atTheExhibit={
        <>
          <p>{t("experiments.diver.at.bottle")}</p>
          <p>{t("experiments.diver.at.squeeze")}</p>
          <p>{t("experiments.diver.at.hover")}</p>
        </>
      }
      whatHappens={<DiverModel />}
      computed={<DiverComputed />}
      sweetSpot={
        diver && bottle ? (
          <DiverTrick diver={diver} bottle={bottle} />
        ) : (
          <LoadingState className="py-6" label={t("common.loading")} />
        )
      }
    >
      {defaults.isPending || !diver || !bottle ? (
        <BuildPending pending={defaults.isPending} error={defaults.error} />
      ) : (
        <>
          {/* A new diver or bottle starts again at the surface. */}
          <DiverPlay key={JSON.stringify([diver, bottle])} diver={diver} bottle={bottle} />
          <DiverBuild diver={diver} bottle={bottle} onChange={setBuild} />
        </>
      )}
    </ExhibitFrame>
  );
}

/** A hand squeezing and easing off, the diver sinking and rising with it. */
export function DiverPreview({ paused }: PreviewProps) {
  const defaults = useExperimentsDefaults();
  const data = defaults.data?.diver;
  return data ? (
    <DiverPlay diver={data.diver} bottle={{ depth_m: data.depth_m }} preview paused={paused} />
  ) : (
    <PreviewPending />
  );
}

/** The bottle with its water, the hand's push on its sides, the depth the
 *  diver would hover at, and the diver with its bubble. */
function BottleView({
  diver,
  bottle,
  depth,
  squeeze,
}: {
  diver: Diver;
  bottle: Bottle;
  depth: number;
  squeeze: number;
}) {
  const { t } = useTranslation();
  const hue = useChartHue();
  const y = (z: number) => VIEW.surface + (z / bottle.depth_m) * VIEW.span;
  const hover = hoverDepthM(diver, squeeze);
  const bubble = bubbleM3(diver, depth, squeeze);
  // The tube holds the surface's bubble in four fifths of its height; the rest is water.
  const air = 0.8 * VIEW.tall * (bubble / diver.air_m3);
  const top = Math.max(VIEW.surface - 6, y(depth) - 4);
  const cx = (VIEW.left + VIEW.right) / 2;
  const push = Math.min(1, squeeze / (MOST_SQUEEZE_KPA * 1000));
  return (
    <svg
      viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
      role="img"
      aria-label={t("experiments.diver.view")}
      className={VIEW_FRAME}
    >
      <rect
        x={VIEW.left}
        y={VIEW.surface}
        width={VIEW.right - VIEW.left}
        height={VIEW.span}
        fill={hue(WATER_HUE)}
        fillOpacity={0.18}
      />
      <path
        d={`M ${cx - 12} 10 L ${cx - 12} 22 L ${VIEW.left} 32 L ${VIEW.left} ${VIEW.surface + VIEW.span} L ${VIEW.right} ${VIEW.surface + VIEW.span} L ${VIEW.right} 32 L ${cx + 12} 22 L ${cx + 12} 10 Z`}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1={VIEW.left}
        y1={VIEW.surface}
        x2={VIEW.right}
        y2={VIEW.surface}
        stroke="currentColor"
        strokeOpacity={0.5}
      />
      {/* The hand's push, as arrows on both sides, as long as it is hard. */}
      {push > 0 &&
        [-1, 1].map((side) => {
          const x0 = side < 0 ? VIEW.left - 6 - 30 * push : VIEW.right + 6 + 30 * push;
          const x1 = side < 0 ? VIEW.left - 4 : VIEW.right + 4;
          return (
            <g key={side} stroke="currentColor" strokeWidth={2} className="text-primary">
              <line x1={x0} y1={150} x2={x1} y2={150} />
              <path d={`M ${x1} 150 l ${-side * 5} -4 M ${x1} 150 l ${-side * 5} 4`} />
            </g>
          );
        })}
      {hover > 0 && hover < bottle.depth_m && (
        <g>
          <line
            x1={VIEW.left}
            y1={y(hover)}
            x2={VIEW.right}
            y2={y(hover)}
            stroke={hue(HOVER_HUE)}
            strokeDasharray="4 3"
            vectorEffect="non-scaling-stroke"
          />
          <text x={VIEW.right - 2} y={y(hover) - 3} fontSize={7} textAnchor="end" fill="currentColor">
            {t("experiments.diver.play.hover_line")}
          </text>
        </g>
      )}
      {/* The diver: an upturned tube, its bubble at the top and water below it. */}
      <rect
        x={cx - VIEW.tube / 2}
        y={top}
        width={VIEW.tube}
        height={VIEW.tall}
        rx={VIEW.tube / 2}
        fill={hue(WATER_HUE)}
        fillOpacity={0.35}
        stroke="currentColor"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      <rect
        x={cx - VIEW.tube / 2 + 1.5}
        y={top + 1.5}
        width={VIEW.tube - 3}
        height={Math.max(0, air - 1.5)}
        rx={(VIEW.tube - 3) / 2}
        fill={hue(AIR_HUE)}
        fillOpacity={0.6}
      />
    </svg>
  );
}

function DiverPlay({ diver, bottle, preview = false, paused = false }: { diver: Diver; bottle: Bottle } & PreviewMode) {
  const { t } = useTranslation();
  const locale = useLocale();
  const [frame, setFrame] = useState({ depth: 0, speed: 0, time: 0 });
  const [squeezeKpa, setSqueeze] = useState(0);
  const { running, setRunning } = useRunning({ preview, paused });
  const motion = useRef({ depth: 0, speed: 0, time: 0, carry: 0 });
  const hand = useRef(0);
  useEffect(() => {
    hand.current = squeezeKpa * 1000;
  }, [squeezeKpa]);
  // A case's hand and start, once the page's diver and bottle are the case's:
  // at the surface, on the bottom, or a micrometre below the hover depth, where
  // only the case can put it.
  useCheckSetting("diver", (setting) => {
    if (preview) return false;
    if (
      settingNumber(setting, "air_m3", diver.air_m3) !== diver.air_m3 ||
      settingNumber(setting, "depth_m", bottle.depth_m) !== bottle.depth_m
    ) {
      return false;
    }
    const kpa = settingNumber(setting, "squeeze_kpa", squeezeKpa);
    const depth =
      setting.start === "bottom"
        ? bottle.depth_m
        : setting.start === "hover"
          ? hoverDepthM(diver, kpa * 1000) + HOVER_OFF_M
          : 0;
    setSqueeze(kpa);
    hand.current = kpa * 1000;
    motion.current = { depth, speed: 0, time: 0, carry: 0 };
    setFrame({ depth, speed: 0, time: 0 });
    setRunning(true);
    return true;
  });

  useFrameLoop(running, (dt) => {
    const m = motion.current;
    m.carry += dt;
    while (m.carry >= STEP_S) {
      const squeeze = preview
        ? PREVIEW_SQUEEZE.mean + PREVIEW_SQUEEZE.swing * Math.sin((2 * Math.PI * m.time) / PREVIEW_SQUEEZE.period)
        : hand.current;
      [m.depth, m.speed] = step(diver, bottle, m.depth, m.speed, squeeze);
      m.time += STEP_S;
      m.carry -= STEP_S;
    }
    setFrame({ depth: m.depth, speed: m.speed, time: m.time });
  });

  const squeeze = preview
    ? PREVIEW_SQUEEZE.mean + PREVIEW_SQUEEZE.swing * Math.sin((2 * Math.PI * frame.time) / PREVIEW_SQUEEZE.period)
    : squeezeKpa * 1000;
  const view = <BottleView diver={diver} bottle={bottle} depth={frame.depth} squeeze={squeeze} />;
  if (preview) return view;

  const hover = hoverDepthM(diver, squeeze);
  const state = motionOf(diver, bottle, frame.depth, frame.speed, squeeze);
  const surface = () => {
    motion.current = { depth: 0, speed: 0, time: 0, carry: 0 };
    setFrame({ depth: 0, speed: 0, time: 0 });
  };
  return (
    <WidgetCard
      title={t("experiments.diver.play.title")}
      hint={t("experiments.diver.play.hint")}
      actions={
        <>
          <RunPauseButton running={running} onToggle={() => setRunning(!running)} />
          <Button variant="secondary" size="sm" onClick={surface}>
            <ArrowUp className="size-4" aria-hidden />
            {t("experiments.diver.play.surface")}
          </Button>
        </>
      }
    >
      <div className={`${SIDE.grid} ${SIDE.cap.xs}`}>
        <div className={SIDE.top}>
          <SliderField
            label={t("experiments.diver.play.squeeze")}
            unit="kPa"
            value={squeezeKpa}
            min={0}
            max={MOST_SQUEEZE_KPA}
            step={0.05}
            digits={2}
            hint={t("experiments.diver.play.squeeze_hint")}
            onChange={(kpa) => {
              setSqueeze(kpa);
              // A squeeze is the reader asking to see the diver answer: paused
              // (reduced motion), it starts the clock.
              setRunning(true);
            }}
          />
        </div>
        <div className={`${SIDE.views} mx-auto w-full max-w-xs`}>
          <figure className="space-y-1">
            {view}
            <figcaption className="text-center text-caption text-muted">
              {t("experiments.diver.play.caption", { depth: formatNumber(bottle.depth_m * 100, 0, locale) })}
            </figcaption>
          </figure>
        </div>
        <div className={SIDE.column}>
          <p className={`text-sm font-medium ${state === "hovers" ? "text-primary" : "text-secondary"}`} role="status">
            {t(`experiments.diver.play.motion.${state}`)}
          </p>
          <Figures
            tiles={[
              {
                key: "depth",
                label: t("experiments.diver.play.depth"),
                value: frame.depth * 100,
                digits: 1,
                unit: "cm",
              },
              {
                key: "speed",
                label: t("experiments.diver.play.speed"),
                value: frame.speed * 100,
                digits: 1,
                unit: "cm/s",
              },
              {
                key: "bubble",
                label: t("experiments.diver.play.bubble"),
                value: bubbleM3(diver, frame.depth, squeeze) * 1e6,
                digits: 3,
                unit: "cm³",
              },
              {
                key: "hover",
                label: t("experiments.diver.play.hover"),
                value: hover > 0 && hover < bottle.depth_m ? hover * 100 : null,
                digits: 1,
                unit: "cm",
              },
            ]}
          />
        </div>
      </div>
    </WidgetCard>
  );
}

function DiverBuild({
  diver,
  bottle,
  onChange,
}: {
  diver: Diver;
  bottle: Bottle;
  onChange: (next: { diver: Diver; bottle: Bottle }) => void;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hue = useChartHue();
  const shown = figures(diver, bottle);
  const rows = useMemo(
    () =>
      Array.from({ length: CHART_POINTS }, (_, k) => {
        const kpa = (MOST_SQUEEZE_KPA * k) / (CHART_POINTS - 1);
        return { kpa, hover: hoverDepthM(diver, kpa * 1000) * 100, bottom: bottle.depth_m * 100, surface: 0 };
      }),
    [diver, bottle],
  );
  return (
    <WidgetCard title={t("experiments.diver.change.title")} hint={t("experiments.diver.change.hint")}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SliderField
          label={t("experiments.diver.change.air")}
          unit="cm³"
          value={diver.air_m3 * 1e6}
          min={1.85}
          max={2.5}
          step={0.01}
          digits={2}
          hint={t("experiments.diver.change.air_hint")}
          onChange={(v) => onChange({ diver: { ...diver, air_m3: v / 1e6 }, bottle })}
        />
        <SliderField
          label={t("experiments.diver.change.depth")}
          unit="cm"
          value={bottle.depth_m * 100}
          min={10}
          max={100}
          step={1}
          digits={0}
          hint={t("experiments.diver.change.depth_hint")}
          onChange={(v) => onChange({ diver, bottle: { depth_m: v / 100 } })}
        />
      </div>
      <Figures
        tiles={[
          {
            key: "reserve",
            label: t("experiments.diver.figures.reserve"),
            value: shown.reserve_kg * 1000,
            digits: 2,
            unit: "g",
          },
          {
            key: "bubble",
            label: t("experiments.diver.figures.bubble"),
            value: shown.hover_bubble_m3 * 1e6,
            digits: 2,
            unit: "cm³",
          },
          {
            key: "sinking",
            label: t("experiments.diver.figures.sinking"),
            value: shown.sinking_pa / 1000,
            digits: 1,
            unit: "kPa",
          },
          {
            key: "bottom",
            label: t("experiments.diver.figures.bottom"),
            value: shown.bottom_pa / 1000,
            digits: 1,
            unit: "kPa",
          },
        ]}
      />
      <p className="text-sm text-secondary">{t("experiments.diver.chart.hover_hint")}</p>
      <SeriesChart
        rows={rows}
        series={[
          { key: "hover", label: t("experiments.diver.chart.hover"), color: hue(HOVER_HUE) },
          {
            key: "surface",
            label: t("experiments.diver.chart.surface"),
            color: hue(WATER_HUE),
            dashed: true,
          },
          { key: "bottom", label: t("experiments.diver.chart.bottom"), color: hue(AIR_HUE), dashed: true },
        ]}
        axes={[
          {
            id: "y",
            title: `${t("experiments.diver.chart.depth")} (cm)`,
            format: (v) => formatNumber(v, 0, locale),
            includeZero: true,
          },
        ]}
        x={{
          key: "kpa",
          title: `${t("experiments.diver.chart.squeeze")} (kPa)`,
          format: (v) => formatNumber(v, 0, locale),
        }}
      />
    </WidgetCard>
  );
}

function DiverModel() {
  const { t } = useTranslation();
  const s = (key: string) => t(`experiments.diver.symbols.${key}`);
  return (
    <>
      <p>{t("experiments.diver.model.intro")}</p>
      <Equation
        tex={String.raw`V = V_0\,\frac{p_0}{p_0 + \Delta p + \rho\,g\,z}`}
        reads={t("experiments.diver.model.boyle")}
        symbols={[
          { tex: "V", meaning: s("v"), unit: "m³" },
          { tex: "V_0", meaning: s("v0"), unit: "m³" },
          { tex: "p_0", meaning: s("p0"), unit: "Pa" },
          { tex: String.raw`\Delta p`, meaning: s("dp"), unit: "Pa" },
          { tex: String.raw`\rho`, meaning: s("rho"), unit: "kg/m³" },
          { tex: "g", meaning: s("g"), unit: "m/s²" },
          { tex: "z", meaning: s("z"), unit: "m" },
        ]}
      />
      <Equation
        tex={String.raw`F = \rho\,g\,(V_g + V) - m\,g`}
        reads={t("experiments.diver.model.lift")}
        symbols={[
          { tex: "F", meaning: s("f"), unit: "N" },
          { tex: "V_g", meaning: s("vg"), unit: "m³" },
          { tex: "m", meaning: s("m"), unit: "kg" },
        ]}
      />
      <Equation
        tex={String.raw`z^* = \frac{1}{\rho\,g}\left(\frac{p_0\,V_0}{m/\rho - V_g} - p_0 - \Delta p\right)`}
        reads={t("experiments.diver.model.hover")}
        symbols={[{ tex: "z^*", meaning: s("zs"), unit: "m" }]}
      />
      <Equation
        tex={String.raw`\left(m + \tfrac12\,\rho\,(V_g + V)\right)\ddot z = m\,g - \rho\,g\,(V_g + V) - \tfrac12\,\rho\,c_d\,A\,\dot z\,|\dot z|`}
        reads={t("experiments.diver.model.motion")}
        symbols={[
          { tex: "c_d", meaning: s("cd"), unit: "1" },
          { tex: "A", meaning: s("a"), unit: "m²" },
        ]}
      />
    </>
  );
}

function DiverTrick({ diver, bottle }: { diver: Diver; bottle: Bottle }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hue = useChartHue();
  const rows = useMemo(
    () =>
      Array.from({ length: CHART_POINTS }, (_, k) => {
        const z = (bottle.depth_m * k) / (CHART_POINTS - 1);
        const row: Record<string, number> = { cm: z * 100 };
        TRICK_SQUEEZES.forEach((kpa) => {
          row[`s${kpa}`] = liftN(diver, z, kpa * 1000) * 1000;
        });
        return row;
      }),
    [diver, bottle],
  );
  return (
    <>
      <p>{t("experiments.diver.sweet.unstable")}</p>
      <p>{t("experiments.diver.sweet.numbers")}</p>
      <p>{t("experiments.diver.sweet.chase")}</p>
      <p className="text-sm text-secondary">{t("experiments.diver.chart.lift_hint")}</p>
      <SeriesChart
        rows={rows}
        series={TRICK_SQUEEZES.map((kpa, i) => ({
          key: `s${kpa}`,
          label: `${formatNumber(kpa, 0, locale)} kPa`,
          color: hue(LIFT_HUES[i]),
        }))}
        axes={[
          {
            id: "y",
            title: `${t("experiments.diver.chart.lift")} (mN)`,
            format: (v) => formatNumber(v, 1, locale),
            includeZero: true,
          },
        ]}
        x={{
          key: "cm",
          title: `${t("experiments.diver.chart.depth")} (cm)`,
          format: (v) => formatNumber(v, 0, locale),
        }}
      />
    </>
  );
}

function DiverComputed() {
  const { t } = useTranslation();
  const c = (key: string) => t(`experiments.diver.computed.${key}`);
  return (
    <>
      <p>{c("system")}</p>
      <p>{c("check")}</p>
      <p>{c("left_out")}</p>
    </>
  );
}
