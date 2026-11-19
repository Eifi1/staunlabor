import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CircleDot, Pause, Play, Send } from "lucide-react";
import { Button, ToggleGroup } from "@eifi1/ui-kit";
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
import { SIDE, STAGE } from "./stage";
import { useExperimentsDefaults } from "./use-experiments";

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
  const hex = useChartHex();
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
      className="aspect-square w-full rounded-lg border border-subtle bg-surface-2 text-muted"
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
        stroke={hex[BALL_HUE % hex.length]}
        strokeWidth={1.5}
        opacity={0.8}
        vectorEffect="non-scaling-stroke"
      />
      {ride.outcome !== "hole" && (
        <circle cx={r * Math.cos(phi)} cy={-r * Math.sin(phi)} r={R * 0.03} fill={hex[BALL_HUE % hex.length]} />
      )}
    </svg>
  );
}

function SideView({ f, ride }: { f: Funnel; ride: Ride }) {
  const { t } = useTranslation();
  const hex = useChartHex();
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
      className="w-full rounded-lg border border-subtle bg-surface-2 text-muted"
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
        <circle cx={r * Math.cos(phi)} cy={-heightM(f, r)} r={R * 0.03} fill={hex[BALL_HUE % hex.length]} />
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
  const hex = useChartHex();
  const [launch, setLaunch] = useState<Launch>(() => circular(f));
  const sim = useRef(launchFrom(f, launch));
  const [frame, setFrame] = useState(() => {
    const first = launchFrom(f, launch);
    return { ride: first.ride, trail: first.trail };
  });
  const [laps, setLaps] = useState<Lap[]>([]);
  const [runningHere, setRunning] = useState(false);
  const [speedHere, setSpeed] = useState<Speed>(1);
  const running = preview ? !paused : runningHere;
  const speed = preview ? 4 : speedHere;

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
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
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, speed, f, preview]);

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
          { key: "lap", label: t("experiments.well.chart.lap"), color: hex[BALL_HUE % hex.length] },
          {
            key: "kepler",
            label: t("experiments.well.chart.kepler"),
            color: hex[KEPLER_HUE % hex.length],
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
  }, [laps, f, hex, locale, t]);

  const views = (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-center">
      <TopView f={f} trail={frame.trail} ride={frame.ride} />
      <SideView f={f} ride={frame.ride} />
    </div>
  );
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
          <Button
            variant="secondary"
            size="sm"
            disabled={ride.outcome !== "rolling"}
            onClick={() => setRunning(!running)}
          >
            {running ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
            {running ? t("experiments.well.play.pause") : t("experiments.well.play.run")}
          </Button>
        </>
      }
    >
      <div className={`${SIDE.grid} ${STAGE.twoWithSide}`}>
        <div className={`${SIDE.top} flex flex-wrap gap-4`}>
          <ToggleGroup
            label={t("experiments.well.play.speed")}
            labelPlacement="above"
            size="sm"
            value={String(speed)}
            onChange={(v: string) => setSpeed(Number(v) as Speed)}
            options={SPEEDS.map((v) => ({ value: String(v), label: t(`experiments.well.play.speeds.${v}`) }))}
          />
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
