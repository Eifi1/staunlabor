import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CircleDot, Send } from "lucide-react";
import { Button } from "@eifi1/ui-kit";
import { SeriesChart } from "@/shared/charts/series-chart";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber } from "@/shared/lib/format";
import { useChartHue } from "@/shared/state/palette-store";
import { SliderField } from "@/shared/ui/slider-field";
import { Figures, WidgetCard } from "@/shared/ui/widget";
import { Equation } from "./equation";
import { ExhibitFrame } from "./exhibit-frame";
import { BuildPending } from "./build-pending";
import { PreviewPending, type PreviewMode, type PreviewProps } from "./preview-mode";
import { useFrameLoop, useRunning } from "./play";
import { RunPauseButton, SpeedToggle } from "./play-controls";
import {
  advance,
  begin,
  circularPeriod,
  circularSpeed,
  heightM,
  startM,
  STEP_S,
  type Funnel,
  type Lap,
  type Launch,
  type Ride,
} from "./simulate/well";
import { SIDE, STAGE, VIEW_FRAME } from "./stage";
import { useExperimentsDefaults } from "./use-experiments";
import { settingNumber, useCheckSetting } from "./check-setting";

const SPEEDS = [1, 4] as const;
type Speed = (typeof SPEEDS)[number];

const BALL_HUE = 0;
const KEPLER_HUE = 3;

/** The path is drawn from a point every 20 ms of the ride, the last 4000 of
 *  them: the whole spiral from the start, at most 80 s of it. */
const TRAIL_EVERY = 20;
const TRAIL_KEEP = 4000;
/** The height between two of the top view's rings, m. */
const RING_STEP_M = 0.02;
/** The preview lets go again this long after the ball has dropped in. */
const PREVIEW_REST_S = 1;

interface Sim {
  ride: Ride;
  owed: number;
  i: number;
  trail: Array<[number, number]>;
  laps: Lap[];
}

function launchFrom(f: Funnel, launch: Launch): Sim {
  const ride = begin(f, launch);
  return { ride, owed: 0, i: 0, trail: [[ride.y[0], ride.y[2]]], laps: [] };
}

/** The circle the ball keeps at the start, if nothing brakes it. */
const circular = (f: Funnel): Launch => ({ speed_m_s: circularSpeed(f, startM(f)), aim_deg: 0 });

function speedOf(f: Funnel, y: Ride["y"]): number {
  const slope = f.k_m2 / (y[0] * y[0]);
  return Math.sqrt((1 + slope * slope) * y[1] ** 2 + (y[0] * y[3]) ** 2);
}

/**
 * The gravity well (`experiments.well`): a ball rolling round a funnel, from
 * the browser port (`simulate/well.ts`, held to the engine by
 * `simulate.test.ts`), stepped as the reader watches. No route.
 */
export function WellPage() {
  const { t } = useTranslation();
  const defaults = useExperimentsDefaults();
  const [build, setBuild] = useState<Funnel | null>(null);
  const f = build ?? defaults.data?.well ?? null;
  return (
    <ExhibitFrame
      exhibit="well"
      atTheExhibit={
        <>
          <p>{t("experiments.well.at.funnel")}</p>
          <p>{t("experiments.well.at.faster")}</p>
        </>
      }
      whatHappens={<WellModel />}
      computed={<WellComputed />}
      sweetSpot={<WellTrick />}
    >
      {defaults.isPending || !f ? (
        <BuildPending pending={defaults.isPending} error={defaults.error} />
      ) : (
        <WellPlay f={f} onChange={setBuild} />
      )}
    </ExhibitFrame>
  );
}

/** The circular start spiralling in, four times as fast, for the overview. */
export function WellPreview({ paused }: PreviewProps) {
  const defaults = useExperimentsDefaults();
  const f = defaults.data?.well;
  return f ? <WellPlay f={f} preview paused={paused} /> : <PreviewPending />;
}

function TopView({ f, trail, ride }: { f: Funnel; trail: Array<[number, number]>; ride: Ride }) {
  const { t } = useTranslation();
  const hue = useChartHue();
  const R = f.rim_m;
  const reach = R * 1.05;
  // Rings a fixed height apart: they crowd where the wall is steep.
  const rings: number[] = [];
  for (let z = heightM(f, R); z > heightM(f, f.hole_m); z -= RING_STEP_M) rings.push(-f.k_m2 / z);
  const [r, phi] = [ride.y[0], ride.y[2]];
  // SVG's y runs down: anticlockwise is drawn anticlockwise by flipping y.
  return (
    <svg
      viewBox={`${-reach} ${-reach} ${2 * reach} ${2 * reach}`}
      role="img"
      aria-label={t("experiments.well.view_top")}
      className={`aspect-square ${VIEW_FRAME}`}
    >
      {rings.map((ring) => (
        <circle
          key={ring}
          r={ring}
          fill="none"
          stroke="currentColor"
          opacity={0.35}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <circle r={R} fill="none" stroke="currentColor" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      <circle r={f.hole_m} className="fill-current text-primary" />
      <polyline
        points={trail.map(([tr, tp]) => `${tr * Math.cos(tp)},${-tr * Math.sin(tp)}`).join(" ")}
        fill="none"
        stroke={hue(BALL_HUE)}
        strokeWidth={1.5}
        opacity={0.8}
        vectorEffect="non-scaling-stroke"
      />
      {ride.outcome !== "hole" && (
        <circle cx={r * Math.cos(phi)} cy={-r * Math.sin(phi)} r={R * 0.03} fill={hue(BALL_HUE)} />
      )}
    </svg>
  );
}

function SideView({ f, ride }: { f: Funnel; ride: Ride }) {
  const { t } = useTranslation();
  const hue = useChartHue();
  const R = f.rim_m;
  const deep = -heightM(f, f.hole_m);
  const pad = R * 0.05;
  const wall = (side: 1 | -1) =>
    Array.from({ length: 81 }, (_, i) => {
      const r = f.hole_m * (R / f.hole_m) ** (i / 80);
      return `${side * r},${-heightM(f, r)}`;
    }).join(" ");
  const [r, phi] = [ride.y[0], ride.y[2]];
  // A cut through the middle: the ball at its height, across at r·cos φ.
  return (
    <svg
      viewBox={`${-R - pad} ${-pad} ${2 * (R + pad)} ${deep + 2 * pad}`}
      role="img"
      aria-label={t("experiments.well.view_side")}
      className={VIEW_FRAME}
    >
      <line
        x1={-R - pad}
        y1={-heightM(f, R)}
        x2={R + pad}
        y2={-heightM(f, R)}
        stroke="currentColor"
        opacity={0.3}
        strokeDasharray="4 4"
        vectorEffect="non-scaling-stroke"
      />
      {([-1, 1] as const).map((side) => (
        <polyline
          key={side}
          points={wall(side)}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {ride.outcome !== "hole" && (
        <circle cx={r * Math.cos(phi)} cy={-heightM(f, r)} r={R * 0.03} fill={hue(BALL_HUE)} />
      )}
    </svg>
  );
}

function WellPlay({
  f,
  onChange,
  preview = false,
  paused = false,
}: { f: Funnel; onChange?: (next: Funnel) => void } & PreviewMode) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hue = useChartHue();
  const [launch, setLaunch] = useState<Launch>(() => circular(f));
  const sim = useRef(launchFrom(f, launch));
  const [frame, setFrame] = useState(() => {
    const first = launchFrom(f, launch);
    return { ride: first.ride, trail: first.trail };
  });
  const [laps, setLaps] = useState<Lap[]>([]);
  const { running, setRunning } = useRunning({ preview, paused, initially: false });
  const [speedHere, setSpeed] = useState<Speed>(1);
  const speed = preview ? 4 : speedHere;

  useFrameLoop(running, (dt) => {
    const s = sim.current;
    s.owed += (dt * speed) / STEP_S;
    let lapped = false;
    while (s.owed >= 1 && s.ride.outcome === "rolling") {
      const [next, lap] = advance(f, s.ride);
      s.ride = next;
      s.owed -= 1;
      s.i += 1;
      if (s.i % TRAIL_EVERY === 0 || next.outcome !== "rolling") {
        s.trail.push([next.y[0], next.y[2]]);
        if (s.trail.length > TRAIL_KEEP) s.trail.shift();
      }
      if (lap) {
        s.laps.push(lap);
        lapped = true;
      }
    }
    if (s.ride.outcome !== "rolling") {
      s.owed = 0;
      // The preview starts again a moment after the drop.
      if (preview) {
        s.i += Math.round((dt * speed) / STEP_S);
        if (s.i * STEP_S > s.ride.t + PREVIEW_REST_S) sim.current = launchFrom(f, circular(f));
      }
    }
    setFrame({ ride: sim.current.ride, trail: [...sim.current.trail] });
    if (lapped) setLaps([...sim.current.laps]);
  });

  const chart = useMemo(() => {
    const rows = laps.map((lap) => ({
      r: lap.radius_m * 100,
      lap: lap.period_s,
      kepler: circularPeriod(f, lap.radius_m),
    }));
    return (
      <SeriesChart
        rows={rows}
        series={[
          { key: "lap", label: t("experiments.well.chart.lap"), color: hue(BALL_HUE) },
          {
            key: "kepler",
            label: t("experiments.well.chart.kepler"),
            color: hue(KEPLER_HUE),
            dashed: true,
          },
        ]}
        axes={[
          {
            id: "y",
            title: `${t("experiments.well.chart.period")} (s)`,
            format: (v) => formatNumber(v, 1, locale),
          },
        ]}
        x={{
          key: "r",
          title: `${t("experiments.well.chart.radius")} (cm)`,
          format: (v) => formatNumber(v, 0, locale),
        }}
      />
    );
  }, [laps, f, hue, locale, t]);

  const views = (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-center">
      <TopView f={f} trail={frame.trail} ride={frame.ride} />
      <SideView f={f} ride={frame.ride} />
    </div>
  );
  // A check case's "Set it up": the funnel's resistance and the push, and the
  // ball pushed off at once.
  useCheckSetting("well", (setting) => {
    if (preview) return false;
    const nextF = { ...f, rolling_resistance: settingNumber(setting, "rolling_resistance", f.rolling_resistance) };
    const nextLaunch = {
      speed_m_s: settingNumber(setting, "speed_m_s", launch.speed_m_s),
      aim_deg: settingNumber(setting, "aim_deg", launch.aim_deg),
    };
    if (nextF.rolling_resistance !== f.rolling_resistance) onChange?.(nextF);
    setLaunch(nextLaunch);
    sim.current = launchFrom(nextF, nextLaunch);
    setFrame({ ride: sim.current.ride, trail: [...sim.current.trail] });
    setLaps([]);
    setRunning(true);
    return true;
  });
  if (preview) return <TopView f={f} trail={frame.trail} ride={frame.ride} />;

  const reset = (nextF: Funnel, nextLaunch: Launch, go: boolean) => {
    sim.current = launchFrom(nextF, nextLaunch);
    setFrame({ ride: sim.current.ride, trail: [...sim.current.trail] });
    setLaps([]);
    setRunning(go);
  };
  const changeLaunch = (next: Launch) => {
    setLaunch(next);
    reset(f, next, false);
  };
  const { ride } = frame;
  const lastLap = laps.length ? laps[laps.length - 1] : null;
  return (
    <WidgetCard
      title={t("experiments.well.play.title")}
      hint={t("experiments.well.play.hint")}
      actions={
        <>
          <Button variant="accent" size="sm" onClick={() => reset(f, launch, true)}>
            <Send className="size-4" aria-hidden />
            {t("experiments.well.play.launch")}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const next = circular(f);
              setLaunch(next);
              reset(f, next, true);
            }}
          >
            <CircleDot className="size-4" aria-hidden />
            {t("experiments.well.play.circle")}
          </Button>
          <RunPauseButton
            running={running}
            onToggle={() => setRunning(!running)}
            disabled={ride.outcome !== "rolling"}
          />
        </>
      }
    >
      <div className={`${SIDE.grid} ${STAGE.twoWithSide}`}>
        <div className={`${SIDE.top} flex flex-wrap gap-4`}>
          <SpeedToggle speeds={SPEEDS} value={speed} onChange={setSpeed} />
        </div>
        <div className={SIDE.views}>
          {views}
          {ride.outcome !== "rolling" && (
            <p className="text-sm font-medium text-primary" role="status">
              {ride.outcome === "hole"
                ? t("experiments.well.play.dropped", {
                    t: formatNumber(ride.t, 1, locale),
                    laps: ride.laps_done,
                  })
                : t("experiments.well.play.out")}
            </p>
          )}
        </div>
        <div className={SIDE.column}>
          <SliderField
            label={t("experiments.well.play.push")}
            unit="m/s"
            value={launch.speed_m_s}
            min={0}
            max={1.2}
            step={0.01}
            digits={2}
            onChange={(v) => changeLaunch({ ...launch, speed_m_s: v })}
          />
          <SliderField
            label={t("experiments.well.play.aim")}
            unit="°"
            value={launch.aim_deg}
            min={-60}
            max={60}
            step={1}
            digits={0}
            hint={t("experiments.well.play.aim_hint")}
            onChange={(v) => changeLaunch({ ...launch, aim_deg: v })}
          />
          <SliderField
            label={t("experiments.well.play.resistance")}
            unit="C"
            value={f.rolling_resistance}
            min={0}
            max={0.01}
            step={0.0005}
            digits={4}
            hint={t("experiments.well.play.resistance_hint")}
            onChange={(v) => {
              const next = { ...f, rolling_resistance: v };
              onChange?.(next);
              reset(next, launch, false);
            }}
          />
          <Figures
            tiles={[
              { key: "laps", label: t("experiments.well.play.laps"), value: ride.laps_done, digits: 0 },
              {
                key: "period",
                label: t("experiments.well.play.last_lap"),
                value: lastLap?.period_s ?? null,
                digits: 2,
                unit: "s",
              },
              { key: "r", label: t("experiments.well.play.distance"), value: ride.y[0] * 100, digits: 1, unit: "cm" },
              {
                key: "v",
                label: t("experiments.well.play.speed_now"),
                value: speedOf(f, ride.y),
                digits: 2,
                unit: "m/s",
              },
            ]}
          />
        </div>
      </div>
      {/* One lap is no line: the chart waits for the second. */}
      {laps.length > 1 && (
        <figure className="space-y-1">
          {chart}
          <figcaption className="text-center text-caption text-muted">{t("experiments.well.chart.caption")}</figcaption>
        </figure>
      )}
    </WidgetCard>
  );
}

function WellModel() {
  const { t } = useTranslation();
  const s = (key: string) => t(`experiments.well.symbols.${key}`);
  return (
    <>
      <p>{t("experiments.well.model.intro")}</p>
      <Equation
        tex={String.raw`z = -\frac{k}{r}`}
        reads={t("experiments.well.model.wall")}
        symbols={[
          { tex: "z", meaning: s("z"), unit: "m" },
          { tex: "r", meaning: s("r"), unit: "m" },
          { tex: "k", meaning: s("k"), unit: "m²" },
        ]}
      />
      <Equation
        tex={String.raw`\frac{v^2}{r} = \frac{5}{7}\,\frac{g\,k}{r^2}`}
        reads={t("experiments.well.model.circle")}
        symbols={[
          { tex: "v", meaning: s("v"), unit: "m/s" },
          { tex: "g", meaning: s("g"), unit: "m/s²" },
        ]}
      />
      <Equation
        tex={String.raw`T^2 = \frac{28\pi^2}{5\,g\,k}\,r^3`}
        reads={t("experiments.well.model.kepler")}
        symbols={[{ tex: "T", meaning: s("t"), unit: "s" }]}
      />
      <Equation
        tex={String.raw`F = C\,N`}
        reads={t("experiments.well.model.resistance")}
        symbols={[
          { tex: "F", meaning: s("f"), unit: "N" },
          { tex: "C", meaning: s("c") },
          { tex: "N", meaning: s("n"), unit: "N" },
        ]}
      />
    </>
  );
}

function WellTrick() {
  const { t } = useTranslation();
  return (
    <>
      <p>{t("experiments.well.sweet.kepler")}</p>
      <p>{t("experiments.well.sweet.faster")}</p>
      <p>{t("experiments.well.sweet.rosette")}</p>
    </>
  );
}

function WellComputed() {
  const { t } = useTranslation();
  return (
    <>
      <p>{t("experiments.well.computed.system")}</p>
      <p>{t("experiments.well.computed.left_out")}</p>
    </>
  );
}
