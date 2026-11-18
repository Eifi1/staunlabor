import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pause, Play, RotateCcw, TrendingUp } from "lucide-react";
import { Button, StaticLegend, Switch, ToggleGroup, seriesLegendEntries } from "@eifi1/ui-kit";
import { SeriesChart } from "@/shared/charts/series-chart";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber } from "@/shared/lib/format";
import { useTones } from "@/shared/lib/use-tones";
import { useChartHex } from "@/shared/state/palette-store";
import { SliderField } from "@/shared/ui/slider-field";
import { Figures, WidgetCard } from "@/shared/ui/widget";
import { Equation } from "./equation";
import { ExhibitFrame } from "./exhibit-frame";
import { BuildPending } from "./build-pending";
import { PreviewPending, type PreviewMode, type PreviewProps } from "./preview-mode";
import { naturalHz, shape, start, steadyM, step, swingM, STEP_S, type Rack, type Shaking } from "./simulate/resonance";
import { SIDE } from "./stage";
import { useExperimentsDefaults } from "./use-experiments";

const SPEEDS = [1, 4] as const;
type Speed = (typeof SPEEDS)[number];

/** The drive's range on the slider and the sweep's, Hz. */
const LOWEST_HZ = 0.5;
const HIGHEST_HZ = 7;
const SWEEP_FROM_HZ = 1;
const SWEEP_TO_HZ = 6.5;
/** The sweep's pace: the one "The trick" quotes (half the swing, late). */
const SWEEP_HZ_PER_S = 0.05;
/** A sweep's recorded point every 100 ms of the run, and the chart redrawn
 *  with them every half second: redrawn at every frame, its thousands of points
 *  made the page stutter. */
const RECORD_EVERY = 100;
const REDRAW_EVERY = 500;
/** The steady curves' points: log-spaced across the slider's range, and each
 *  rod's own frequency among them, so no peak is cut short between two. */
const GRID_POINTS = 600;
/** The rods stand this far apart in the drawing, m. */
const PITCH_M = 0.2;
/** A rod's tone: its own frequency seven octaves up, where it can be heard. */
const OCTAVES_UP = 2 ** 7;
/** The swing at which a rod's tone is at full level, m. */
const LOUDEST_M = 0.08;

interface Sim {
  s: Shaking;
  drive: number;
  sweeping: boolean;
  owed: number;
  i: number;
  /** The sweep's record: the drive and every rod's swing. */
  recorded: Array<{ hz: number; swings: number[] }>;
}

/**
 * The resonance rods (`experiments.resonance`): six rods on a trembling table,
 * from the browser port (`simulate/resonance.ts`, held to the engine by
 * `simulate.test.ts`), stepped as the reader turns the beat. No route. The one
 * page that can sound: muted until the reader turns the tones on
 * (`shared/lib/use-tones.ts`).
 */
export function ResonancePage() {
  const { t } = useTranslation();
  const defaults = useExperimentsDefaults();
  const [build, setBuild] = useState<Rack | null>(null);
  const rack = build ?? defaults.data?.resonance ?? null;
  return (
    <ExhibitFrame
      exhibit="resonance"
      atTheExhibit={
        <>
          <p>{t("experiments.resonance.at.rods")}</p>
          <p>{t("experiments.resonance.at.one")}</p>
        </>
      }
      whatHappens={<ResonanceModel />}
      computed={<ResonanceComputed />}
      sweetSpot={<ResonanceTrick />}
    >
      {defaults.isPending || !rack ? (
        <BuildPending pending={defaults.isPending} error={defaults.error} />
      ) : (
        <ResonancePlay rack={rack} onChange={setBuild} />
      )}
    </ExhibitFrame>
  );
}

/** The table in step with the third rod, for the overview. Silent. */
export function ResonancePreview({ paused }: PreviewProps) {
  const defaults = useExperimentsDefaults();
  const rack = defaults.data?.resonance;
  return rack ? <ResonancePlay rack={rack} preview paused={paused} /> : <PreviewPending />;
}

/** In step with the third rod, to the slider's hundredth. */
const inStep = (rack: Rack) =>
  Math.round(naturalHz(rack, rack.lengths_m[Math.min(2, rack.lengths_m.length - 1)]) * 100) / 100;

function RodsView({ rack, s }: { rack: Rack; s: Shaking }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  const n = rack.lengths_m.length;
  const tallest = Math.max(...rack.lengths_m);
  const width = n * PITCH_M;
  const label = tallest * 0.08;
  // The table's place, true to scale: a millimetre, which is the point.
  const table = rack.table_m * Math.sin(s.theta);
  return (
    <svg
      viewBox={`${-PITCH_M / 2} ${-tallest * 1.08} ${width} ${tallest * 1.08 + label * 1.6}`}
      role="img"
      aria-label={t("experiments.resonance.view")}
      className="w-full rounded-lg border border-subtle bg-surface-2 text-muted"
    >
      <rect
        x={-PITCH_M * 0.45 + table}
        y={0}
        width={width - PITCH_M * 0.1}
        height={label * 0.35}
        className="fill-current"
        opacity={0.5}
      />
      {rack.lengths_m.map((length, i) => {
        const base = i * PITCH_M + table;
        const points = Array.from({ length: 21 }, (_, k) => {
          const xi = k / 20;
          return `${base + s.q[i] * shape(xi)},${-xi * length}`;
        }).join(" ");
        return (
          <g key={i}>
            <polyline
              points={points}
              fill="none"
              stroke={hex[i % hex.length]}
              strokeWidth={3}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={base + s.q[i]} cy={-length} r={tallest * 0.012} fill={hex[i % hex.length]} />
            <text
              x={i * PITCH_M}
              y={label * 1.3}
              textAnchor="middle"
              fontSize={label * 0.5}
              className="fill-current text-secondary"
            >
              {`${formatNumber(naturalHz(rack, length), 2, locale)} Hz`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function ResonancePlay({
  rack,
  onChange,
  preview = false,
  paused = false,
}: { rack: Rack; onChange?: (next: Rack) => void } & PreviewMode) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  const begin = (drive: number): Sim => ({ s: start(rack), drive, sweeping: false, owed: 0, i: 0, recorded: [] });
  const sim = useRef(begin(inStep(rack)));
  const [frame, setFrame] = useState(() => ({ s: start(rack), drive: inStep(rack), sweeping: false }));
  const [recorded, setRecorded] = useState<Sim["recorded"]>([]);
  const [chartDrive, setChartDrive] = useState(() => inStep(rack));
  const [runningHere, setRunning] = useState(false);
  const [speedHere, setSpeed] = useState<Speed>(1);
  const [sound, setSound] = useState(false);
  const running = preview ? !paused : runningHere;
  const speed = preview ? 1 : speedHere;

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      const m = sim.current;
      m.owed += (dt * speed) / STEP_S;
      let noted = false;
      while (m.owed >= 1) {
        m.s = step(rack, m.s, m.drive);
        m.owed -= 1;
        m.i += 1;
        if (m.sweeping) {
          m.drive += SWEEP_HZ_PER_S * STEP_S;
          if (m.i % RECORD_EVERY === 0) {
            m.recorded.push({ hz: m.drive, swings: rack.lengths_m.map((_, rod) => swingM(m.s, rod, m.drive)) });
          }
          if (m.i % REDRAW_EVERY === 0) noted = true;
          if (m.drive >= SWEEP_TO_HZ) {
            m.sweeping = false;
            noted = true;
          }
        }
      }
      setFrame({ s: m.s, drive: m.drive, sweeping: m.sweeping });
      if (noted) {
        setRecorded([...m.recorded]);
        setChartDrive(m.drive);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, speed, rack]);

  const swings = rack.lengths_m.map((_, rod) => swingM(frame.s, rod, frame.drive));
  const pitches = useMemo(() => rack.lengths_m.map((length) => naturalHz(rack, length) * OCTAVES_UP), [rack]);
  const levels = useMemo(() => swings.map((swing) => (running ? swing / LOUDEST_M : 0)), [swings, running]);
  const tones = useTones(sound && !preview, pitches, levels);

  const steadyRows = useMemo(() => {
    const grid = [
      ...Array.from({ length: GRID_POINTS + 1 }, (_, k) => LOWEST_HZ * (HIGHEST_HZ / LOWEST_HZ) ** (k / GRID_POINTS)),
      ...rack.lengths_m.map((length) => naturalHz(rack, length)),
    ].sort((a, b) => a - b);
    return grid.map((hz) => ({
      hz,
      ...Object.fromEntries(rack.lengths_m.map((length, rod) => [`s${rod}`, steadyM(rack, length, hz) * 1000])),
    }));
  }, [rack]);

  const chart = useMemo(() => {
    const recordedRows = recorded.map((point) => ({
      hz: point.hz,
      ...Object.fromEntries(point.swings.map((swing, rod) => [`m${rod}`, swing * 1000])),
    }));
    const steady = rack.lengths_m.map((length, rod) => ({
      key: `s${rod}`,
      label: t("experiments.resonance.play.rod", { n: rod + 1, hz: formatNumber(naturalHz(rack, length), 2, locale) }),
      color: hex[rod % hex.length],
    }));
    const measured = rack.lengths_m.map((_, rod) => ({
      key: `m${rod}`,
      label: t("experiments.resonance.chart.swept", { n: rod + 1 }),
      color: hex[rod % hex.length],
      dashed: true,
    }));
    return (
      <>
        <SeriesChart
          rows={[...steadyRows, ...recordedRows]}
          series={[...steady, ...measured]}
          connectNulls
          axes={[
            {
              id: "y",
              title: `${t("experiments.resonance.chart.swing")} (mm)`,
              format: (v) => formatNumber(v, 0, locale),
            },
          ]}
          x={{
            key: "hz",
            title: `${t("experiments.resonance.chart.beat")} (Hz)`,
            format: (v) => formatNumber(v, 1, locale),
          }}
          references={[{ axis: "x", value: chartDrive }]}
        />
        <StaticLegend entries={seriesLegendEntries(steady)} />
      </>
    );
  }, [rack, steadyRows, recorded, chartDrive, hex, locale, t]);

  const view = <RodsView rack={rack} s={frame.s} />;
  if (preview) return view;

  const setDrive = (hz: number) => {
    sim.current.drive = hz;
    sim.current.sweeping = false;
    setFrame({ ...frame, drive: hz, sweeping: false });
    setChartDrive(hz);
  };
  const calm = () => {
    sim.current = begin(sim.current.drive);
    setFrame({ s: sim.current.s, drive: sim.current.drive, sweeping: false });
    setRecorded([]);
  };
  const sweep = () => {
    sim.current = { ...begin(SWEEP_FROM_HZ), sweeping: true };
    setFrame({ s: sim.current.s, drive: SWEEP_FROM_HZ, sweeping: true });
    setRecorded([]);
    setChartDrive(SWEEP_FROM_HZ);
    setRunning(true);
  };
  const widest = Math.max(...swings);
  return (
    <WidgetCard
      title={t("experiments.resonance.play.title")}
      hint={t("experiments.resonance.play.hint")}
      actions={
        <>
          <Button variant="accent" size="sm" onClick={() => setRunning(!running)}>
            {running ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
            {running ? t("experiments.resonance.play.stop") : t("experiments.resonance.play.shake")}
          </Button>
          <Button variant="secondary" size="sm" onClick={sweep}>
            <TrendingUp className="size-4" aria-hidden />
            {t("experiments.resonance.play.sweep")}
          </Button>
          <Button variant="secondary" size="sm" onClick={calm}>
            <RotateCcw className="size-4" aria-hidden />
            {t("experiments.resonance.play.calm")}
          </Button>
        </>
      }
    >
      <div className={SIDE.grid}>
        <div className={`${SIDE.top} flex flex-wrap gap-4`}>
          <ToggleGroup
            label={t("experiments.resonance.play.speed")}
            labelPlacement="above"
            size="sm"
            value={String(speed)}
            onChange={(v: string) => setSpeed(Number(v) as Speed)}
            options={SPEEDS.map((v) => ({ value: String(v), label: t(`experiments.resonance.play.speeds.${v}`) }))}
          />
        </div>
        <div className={`${SIDE.views} mx-auto w-full max-w-xl`}>{view}</div>
        <div className={SIDE.column}>
          <SliderField
            label={t("experiments.resonance.play.beat")}
            unit="Hz"
            value={frame.drive}
            min={LOWEST_HZ}
            max={HIGHEST_HZ}
            step={0.01}
            digits={2}
            hint={frame.sweeping ? t("experiments.resonance.play.sweeping") : t("experiments.resonance.play.beat_hint")}
            onChange={setDrive}
          />
          <SliderField
            label={t("experiments.resonance.play.damping")}
            unit="ζ"
            value={rack.damping_ratio}
            min={0.002}
            max={0.05}
            step={0.001}
            digits={3}
            hint={t("experiments.resonance.play.damping_hint")}
            onChange={(v) => onChange?.({ ...rack, damping_ratio: v })}
          />
          <Switch
            label={t("experiments.resonance.play.sound")}
            description={
              tones.available ? t("experiments.resonance.play.sound_hint") : t("experiments.resonance.play.no_sound")
            }
            checked={sound}
            disabled={!tones.available}
            onCheckedChange={setSound}
          />
          <Figures
            tiles={[
              {
                key: "widest",
                label: t("experiments.resonance.play.widest"),
                value: widest * 1000,
                digits: 1,
                unit: "mm",
              },
              {
                key: "table",
                label: t("experiments.resonance.play.table"),
                value: rack.table_m * 1000,
                digits: 1,
                unit: "mm",
              },
            ]}
          />
        </div>
      </div>
      <figure className="space-y-1">
        {chart}
        <figcaption className="text-center text-caption text-muted">
          {t("experiments.resonance.chart.caption")}
        </figcaption>
      </figure>
    </WidgetCard>
  );
}

function ResonanceModel() {
  const { t } = useTranslation();
  const s = (key: string) => t(`experiments.resonance.symbols.${key}`);
  return (
    <>
      <p>{t("experiments.resonance.model.intro")}</p>
      <Equation
        tex={String.raw`f_1 = \frac{\beta_1^2}{2\pi L^2}\sqrt{\frac{E\,I}{\rho\,A}}`}
        reads={t("experiments.resonance.model.frequency")}
        symbols={[
          { tex: String.raw`\beta_1`, meaning: s("beta") },
          { tex: "L", meaning: s("l"), unit: "m" },
          { tex: "E", meaning: s("e"), unit: "Pa" },
          { tex: String.raw`I = \tfrac{\pi d^4}{64}`, meaning: s("i"), unit: "m⁴" },
          { tex: String.raw`\rho`, meaning: s("rho"), unit: "kg/m³" },
          { tex: String.raw`A = \tfrac{\pi d^2}{4}`, meaning: s("a"), unit: "m²" },
        ]}
      />
      <Equation
        tex={String.raw`\ddot q + 2\zeta\omega\,\dot q + \omega^2 q = -\Gamma\,\ddot y_b`}
        reads={t("experiments.resonance.model.motion")}
        symbols={[
          { tex: "q", meaning: s("q"), unit: "m" },
          { tex: String.raw`\omega = 2\pi f_1`, meaning: s("omega"), unit: "1/s" },
          { tex: String.raw`\zeta`, meaning: s("zeta") },
          { tex: String.raw`\Gamma`, meaning: s("gamma") },
          { tex: "y_b", meaning: s("yb"), unit: "m" },
        ]}
      />
      <Equation
        tex={String.raw`\hat q = \frac{\Gamma\,r^2\,Y}{\sqrt{(1 - r^2)^2 + (2\zeta r)^2}}`}
        reads={t("experiments.resonance.model.steady")}
        symbols={[
          { tex: String.raw`r = \tfrac{\Omega}{\omega}`, meaning: s("r") },
          { tex: "Y", meaning: s("y"), unit: "m" },
        ]}
      />
    </>
  );
}

function ResonanceTrick() {
  const { t } = useTranslation();
  return (
    <>
      <p>{t("experiments.resonance.sweet.step")}</p>
      <p>{t("experiments.resonance.sweet.patience")}</p>
      <p>{t("experiments.resonance.sweet.everywhere")}</p>
    </>
  );
}

function ResonanceComputed() {
  const { t } = useTranslation();
  return (
    <>
      <p>{t("experiments.resonance.computed.system")}</p>
      <p>{t("experiments.resonance.computed.sound")}</p>
      <p>{t("experiments.resonance.computed.left_out")}</p>
    </>
  );
}
