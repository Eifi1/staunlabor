import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, LoadingState, ToggleGroup } from "@eifi1/ui-kit";
import { SeriesChart } from "@/shared/charts/series-chart";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber } from "@/shared/lib/format";
import { useChartHue } from "@/shared/state/palette-store";
import { SliderField } from "@/shared/ui/slider-field";
import { Figures, WidgetCard } from "@/shared/ui/widget";
import { Equation } from "./equation";
import { ExhibitFrame } from "./exhibit-frame";
import { BuildPending } from "./build-pending";
import { sameBuild, settingNumber, useCheckSetting, useTakeCheckRequest, type CheckSetting } from "./check-setting";
import { PreviewPending, type PreviewMode, type PreviewProps } from "./preview-mode";
import { useFrameLoop, useRunning } from "./play";
import { RunPauseButton, SpeedToggle } from "./play-controls";
import { HeldAnswer, useHeld, type Held } from "./held";
import {
  boardM,
  coupling,
  hold,
  inStepS,
  MAX_COUNT,
  order,
  phase,
  RATE_PER_S,
  release,
  rhs,
  run,
  startState,
  STEP_S,
  THETA0_RAD,
  type Metronomes,
  type Start,
} from "./simulate/metronomes";
import { rk4 } from "./simulate/numerics";
import { SIDE, STAGE, VIEW_FRAME } from "./stage";
import { useExperimentsDefaults } from "./use-experiments";

const SPEEDS = [1, 4] as const;
type Speed = (typeof SPEEDS)[number];
const STARTS: readonly Start[] = ["scattered", "opposite", "together", "small"];

/** The board's motion drawn this many times larger: at true size its couple
 *  of millimetres are a line's width on a phone. The hint says so. */
const MAGNIFIED = 10;
/** The drawing's measures, cm: a metronome's spacing on the board, its body,
 *  its rod and the cans' radius (a drinks can, 6.6 cm across). */
const SPACING_CM = 9;
const BODY_CM = 8;
const ROD_CM = 9;
const CAN_CM = 3.3;
/** How long the order parameter's trace in the play reaches back, s, and how
 *  often it is sampled. */
const TRACE_S = 60;
const TRACE_EVERY_S = 0.25;
/** The trick's two runs, s. */
const TRICK_S = 120;
/** R above this counts as in step, here and in the engine's `in_step_s`. */
const IN_STEP = 0.99;

/** The hue of metronome `i`, here, in the dial and in the chart. */
const hueIndex = (i: number) => i;

/** A check case's build: how many, the board, the spread, free or held. */
function caseBuild(mt: Metronomes, setting: CheckSetting): Metronomes {
  return {
    count: settingNumber(setting, "count", mt.count),
    board_kg: settingNumber(setting, "board_kg", mt.board_kg),
    spread: settingNumber(setting, "spread", mt.spread),
    free: setting.board === "held" ? false : setting.board === "free" ? true : mt.free,
  };
}

/**
 * The metronomes (`experiments.metronomes`): Pantaleone's model stepped by the
 * browser port (`simulate/metronomes.ts`, held to the engine by
 * `simulate.test.ts`), the hand starting and stopping each metronome and
 * freeing or holding the board, and how in step they are, Kuramoto's R, read
 * off the port as they swing: no route.
 */
export function MetronomesPage() {
  const { t } = useTranslation();
  const defaults = useExperimentsDefaults();
  const [build, setBuild] = useState<Metronomes | null>(null);
  const held = useHeld();
  const mt = build ?? defaults.data?.metronomes ?? null;
  useTakeCheckRequest("metronomes", mt, (setting, current) => {
    const next = caseBuild(current, setting);
    if (!sameBuild(next, current)) setBuild(next);
  });
  return (
    <ExhibitFrame
      exhibit="metronomes"
      atTheExhibit={
        <>
          <p>{t("experiments.metronomes.at.board")}</p>
          <p>{t("experiments.metronomes.at.agree")}</p>
        </>
      }
      whatHappens={<MetronomesModel />}
      computed={<MetronomesComputed />}
      sweetSpot={<MetronomesTrick mt={mt} />}
    >
      {defaults.isPending || !mt ? (
        <BuildPending pending={defaults.isPending} error={defaults.error} />
      ) : (
        <>
          <MetronomesPlay key={JSON.stringify(mt)} mt={mt} held={held} />
          <MetronomesBuild mt={mt} onChange={setBuild} />
        </>
      )}
    </ExhibitFrame>
  );
}

/** Let go at the exhibit's scattered start, four times real time, for the
 *  overview: they fall in step within a quarter of a minute. */
export function MetronomesPreview({ paused }: PreviewProps) {
  const defaults = useExperimentsDefaults();
  const mt = defaults.data?.metronomes;
  return mt ? <MetronomesPlay mt={mt} preview paused={paused} /> : <PreviewPending />;
}

/** The board on its two cans and the metronomes on it, from the front; a
 *  metronome is a button that starts or stops it. */
export function MetronomesView({
  mt,
  y,
  running,
  onToggle,
}: {
  mt: Metronomes;
  y: readonly number[];
  running: readonly boolean[];
  onToggle?: (i: number) => void;
}) {
  const { t } = useTranslation();
  const hue = useChartHue();
  const n = mt.count;
  const half = (Math.max(n, 3) * SPACING_CM) / 2 + 4;
  // Board and cans: the board moves by x, the cans roll by half of it.
  const x = boardM(mt, y) * 100 * MAGNIFIED;
  const floor = 2 * CAN_CM + 1.2;
  const roll = x / 2 / CAN_CM;
  const top = -BODY_CM - ROD_CM - 1;
  return (
    <svg
      viewBox={`${-half - 2} ${top} ${2 * half + 4} ${floor - top + 1}`}
      role="img"
      aria-label={t("experiments.metronomes.view")}
      className={`${STAGE.wide} ${VIEW_FRAME}`}
    >
      <line
        x1={-half - 2}
        y1={floor}
        x2={half + 2}
        y2={floor}
        stroke="currentColor"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      {/* The two cans, each with a mark that shows it rolling. */}
      {[-1, 1].map((side) => {
        const cx = side * (half - 6) + x / 2;
        const cy = floor - CAN_CM;
        return (
          <g key={side}>
            <circle
              cx={cx}
              cy={cy}
              r={CAN_CM}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={cx}
              y1={cy}
              x2={cx + CAN_CM * Math.sin(roll)}
              y2={cy - CAN_CM * Math.cos(roll)}
              stroke="currentColor"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        );
      })}
      <rect x={-half + x} y={-1.2} width={2 * half} height={1.2} rx={0.3} fill="currentColor" opacity={0.6} />
      {Array.from({ length: n }, (_, i) => {
        const base = (i - (n - 1) / 2) * SPACING_CM + x;
        const on = running[i];
        const theta = y[i];
        const pivotY = -1.2 - 1.5;
        const tipX = base + ROD_CM * Math.sin(theta);
        const tipY = pivotY - ROD_CM * Math.cos(theta);
        const weight = 0.6;
        const colour = on ? hue(hueIndex(i)) : "currentColor";
        return (
          <g
            key={i}
            // A tap on the drawing for a pointer; the numbered buttons under it
            // are the same control for a keyboard and a screen reader, since
            // the drawing is one image to them.
            className={onToggle ? "cursor-pointer" : undefined}
            onClick={onToggle ? () => onToggle(i) : undefined}
          >
            <path
              d={`M ${base - 2} -1.2 L ${base + 2} -1.2 L ${base + 0.8} ${-1.2 - BODY_CM} L ${base - 0.8} ${-1.2 - BODY_CM} Z`}
              fill="currentColor"
              opacity={on ? 0.35 : 0.2}
            />
            <line
              x1={base}
              y1={pivotY}
              x2={tipX}
              y2={tipY}
              stroke={colour}
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={base + weight * ROD_CM * Math.sin(theta)}
              cy={pivotY - weight * ROD_CM * Math.cos(theta)}
              r={0.8}
              fill={colour}
            />
          </g>
        );
      })}
    </svg>
  );
}

/** The phases as points on a circle, one per running metronome, and their
 *  mean, Kuramoto's R·e^{iψ}, as an arrow from the centre. */
function PhaseDial({ y, running }: { y: readonly number[]; running: readonly boolean[] }) {
  const { t } = useTranslation();
  const hue = useChartHue();
  const n = running.length;
  const [r, psi] = order(y, running);
  return (
    <svg
      viewBox="-1.3 -1.3 2.6 2.6"
      role="img"
      aria-label={t("experiments.metronomes.play.dial")}
      className="mx-auto w-full max-w-[10rem] text-muted"
    >
      <circle r={1} fill="none" stroke="currentColor" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      <line
        x1={0}
        y1={0}
        x2={r * Math.cos(psi)}
        y2={-r * Math.sin(psi)}
        stroke="currentColor"
        strokeWidth={2.5}
        vectorEffect="non-scaling-stroke"
      />
      {Array.from({ length: n }, (_, i) =>
        running[i] ? (
          <circle
            key={i}
            cx={Math.cos(phase(y[i], y[n + i]))}
            cy={-Math.sin(phase(y[i], y[n + i]))}
            r={0.12}
            fill={hue(hueIndex(i))}
          />
        ) : null,
      )}
    </svg>
  );
}

/** R over the last minute, a thin line in a box from 0 to 1. */
function OrderTrace({ trace }: { trace: readonly { t: number; r: number }[] }) {
  const { t } = useTranslation();
  if (trace.length < 2) return null;
  const end = trace[trace.length - 1].t;
  const points = trace.map((p) => `${(100 * (TRACE_S - (end - p.t))) / TRACE_S},${30 * (1 - p.r)}`).join(" ");
  return (
    <svg
      viewBox="0 -1 100 32"
      preserveAspectRatio="none"
      role="img"
      aria-label={t("experiments.metronomes.play.trace")}
      className="h-12 w-full rounded border border-subtle text-muted"
    >
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function MetronomesPlay({ mt, held, preview = false, paused = false }: { mt: Metronomes; held?: Held } & PreviewMode) {
  const { t } = useTranslation();
  const n = mt.count;
  const sim = useRef({ y: startState("scattered", n), clock: 0, owed: 0, sampled: 0 });
  const { running: clockRuns, setRunning } = useRunning({ preview, paused });
  const [speedHere, setSpeed] = useState<Speed>(1);
  const [free, setFree] = useState(mt.free);
  const [going, setGoing] = useState<boolean[]>(() => new Array<boolean>(n).fill(true));
  const [frame, setFrame] = useState(() => ({ y: startState("scattered", n), clock: 0 }));
  const y = frame.y;
  const [trace, setTrace] = useState<{ t: number; r: number }[]>([]);
  const speed = preview ? 4 : speedHere;
  const show = held?.show;
  const here = useMemo(() => ({ ...mt, free }), [mt, free]);
  const f = useMemo(() => rhs(here, going), [here, going]);

  useFrameLoop(clockRuns, (dt) => {
    const s = sim.current;
    s.owed += (dt * speed) / STEP_S;
    const steps = Math.floor(s.owed);
    s.owed -= steps;
    const h = STEP_S * RATE_PER_S;
    for (let k = 0; k < steps; k++) {
      s.y = rk4(f, s.clock * RATE_PER_S, s.y, h);
      s.clock += STEP_S;
    }
    setFrame({ y: s.y, clock: s.clock });
    if (preview) return;
    if (s.clock - s.sampled >= TRACE_EVERY_S) {
      s.sampled = s.clock;
      const r = order(s.y, going)[0];
      setTrace((old) => [...old.filter((p) => p.t > s.clock - TRACE_S), { t: s.clock, r }]);
      if (r > IN_STEP && going.filter(Boolean).length > 1 && s.clock > 5) show?.();
    }
  });

  const letGo = (start: Start | "random") => {
    const y0 =
      start === "random"
        ? (() => {
            const a = 2 * THETA0_RAD;
            const phases = Array.from({ length: n }, () => 2 * Math.PI * Math.random());
            return [...phases.map((p) => a * Math.cos(p)), ...phases.map((p) => -a * Math.sin(p))];
          })()
        : startState(start, n);
    sim.current = { y: y0, clock: 0, owed: 0, sampled: 0 };
    setGoing(new Array<boolean>(n).fill(true));
    setFrame({ y: y0, clock: 0 });
    setTrace([]);
    setRunning(true);
  };
  const stopAll = () => {
    sim.current = { ...sim.current, y: new Array<number>(2 * n).fill(0) };
    setGoing(new Array<boolean>(n).fill(false));
    setFrame({ y: sim.current.y, clock: sim.current.clock });
    setTrace([]);
  };
  const toggle = (i: number) => {
    const next = [...going];
    next[i] = !next[i];
    sim.current = { ...sim.current, y: next[i] ? release(sim.current.y, i) : hold(sim.current.y, i) };
    setGoing(next);
    setFrame({ y: sim.current.y, clock: sim.current.clock });
    if (next[i]) setRunning(true);
  };
  useCheckSetting("metronomes", (setting) => {
    if (preview) return false;
    if (!sameBuild(caseBuild(mt, setting), mt)) return false;
    setFree(caseBuild(mt, setting).free);
    const how = STARTS.find((s) => s === setting.start);
    if (how) letGo(how);
    return true;
  });

  const view = <MetronomesView mt={here} y={y} running={going} onToggle={preview ? undefined : toggle} />;
  if (preview) return view;
  const [r] = order(y, going);
  return (
    <WidgetCard
      title={t("experiments.metronomes.play.title")}
      hint={t("experiments.metronomes.play.hint", { times: MAGNIFIED })}
      actions={<RunPauseButton running={clockRuns} onToggle={() => setRunning(!clockRuns)} />}
    >
      <div className={`${SIDE.grid} ${SIDE.cap.xl}`}>
        <div className={`${SIDE.top} flex flex-wrap gap-2`}>
          <Button variant="accent" size="sm" onClick={() => letGo("random")}>
            {t("experiments.metronomes.play.random")}
          </Button>
          <Button variant="secondary" size="sm" onClick={stopAll}>
            {t("experiments.metronomes.play.stop_all")}
          </Button>
        </div>
        <div className={`${SIDE.views} mx-auto w-full max-w-xl`}>
          {view}
          <div className="flex flex-wrap gap-2" role="group" aria-label={t("experiments.metronomes.play.each")}>
            {going.map((on, i) => (
              <Button
                key={i}
                size="sm"
                variant={on ? "accent" : "secondary"}
                aria-pressed={on}
                aria-label={t(`experiments.metronomes.play.${on ? "stop_one" : "start_one"}`, { n: i + 1 })}
                onClick={() => toggle(i)}
              >
                {i + 1}
              </Button>
            ))}
          </div>
        </div>
        <div className={SIDE.column}>
          <ToggleGroup
            label={t("experiments.metronomes.play.board")}
            labelPlacement="above"
            size="sm"
            overflow="wrap"
            value={free ? "free" : "held"}
            onChange={(v: string) => setFree(v === "free")}
            options={[
              { value: "free", label: t("experiments.metronomes.play.free") },
              { value: "held", label: t("experiments.metronomes.play.held") },
            ]}
          />
          <SpeedToggle speeds={SPEEDS} value={speedHere} onChange={setSpeed} />
          <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-[10rem_minmax(0,1fr)] 2xl:grid-cols-1">
            <PhaseDial y={y} running={going} />
            <div className="space-y-2">
              <Figures
                tiles={[
                  { key: "order", label: t("experiments.metronomes.figures.order"), value: r, digits: 2 },
                  {
                    key: "time",
                    label: t("experiments.metronomes.figures.time"),
                    value: frame.clock,
                    digits: 0,
                    unit: "s",
                  },
                  {
                    key: "coupling",
                    label: t("experiments.metronomes.figures.coupling"),
                    value: coupling(here),
                    digits: 4,
                  },
                ]}
              />
              <OrderTrace trace={trace} />
            </div>
          </div>
          {held && (
            <HeldAnswer held={held}>
              <p className="text-sm text-secondary">{t("experiments.metronomes.play.answer")}</p>
            </HeldAnswer>
          )}
        </div>
      </div>
    </WidgetCard>
  );
}

function MetronomesBuild({ mt, onChange }: { mt: Metronomes; onChange: (next: Metronomes) => void }) {
  const { t } = useTranslation();
  return (
    <WidgetCard title={t("experiments.metronomes.change.title")} hint={t("experiments.metronomes.change.hint")}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SliderField
          label={t("experiments.metronomes.change.count")}
          unit=""
          value={mt.count}
          min={1}
          max={MAX_COUNT}
          step={1}
          digits={0}
          onChange={(v) => onChange({ ...mt, count: Math.round(v) })}
        />
        <SliderField
          label={t("experiments.metronomes.change.board")}
          unit="g"
          value={mt.board_kg * 1000}
          min={0}
          max={2000}
          step={10}
          digits={0}
          hint={t("experiments.metronomes.change.board_hint")}
          onChange={(v) => onChange({ ...mt, board_kg: v / 1000 })}
        />
        <SliderField
          label={t("experiments.metronomes.change.spread")}
          unit="%"
          value={mt.spread * 100}
          min={0}
          max={3}
          step={0.1}
          digits={1}
          hint={t("experiments.metronomes.change.spread_hint")}
          onChange={(v) => onChange({ ...mt, spread: v / 100 })}
        />
      </div>
    </WidgetCard>
  );
}

function MetronomesModel() {
  const { t } = useTranslation();
  const s = (key: string) => t(`experiments.metronomes.symbols.${key}`);
  return (
    <>
      <p>{t("experiments.metronomes.model.intro")}</p>
      <Equation
        tex={String.raw`\theta_i'' + (1 + \Delta_i)\sin\theta_i + \mu\left(\frac{\theta_i^2}{\theta_0^2} - 1\right)\theta_i' - \beta\cos\theta_i\,\frac{d^2}{d\tau^2}\sum_j \sin\theta_j = 0`}
        reads={t("experiments.metronomes.model.equation")}
        symbols={[
          { tex: String.raw`\theta_i`, meaning: s("theta"), unit: "rad" },
          { tex: String.raw`\tau = \omega t`, meaning: s("tau"), unit: "rad" },
          { tex: String.raw`\omega`, meaning: s("omega"), unit: "1/s" },
          { tex: String.raw`\Delta_i`, meaning: s("delta") },
          { tex: String.raw`\mu`, meaning: s("mu") },
          { tex: String.raw`\theta_0`, meaning: s("theta0"), unit: "rad" },
          { tex: String.raw`\beta`, meaning: s("beta") },
        ]}
      />
      <Equation
        tex={String.raw`x = -x_0\sum_j \sin\theta_j, \qquad x_0 = \frac{m\,r}{M}, \qquad \beta = \frac{x_0\,\omega^2}{g}`}
        reads={t("experiments.metronomes.model.board")}
        symbols={[
          { tex: "x", meaning: s("x"), unit: "m" },
          { tex: "m\\,r", meaning: s("mr"), unit: "kg·m" },
          { tex: "M", meaning: s("M"), unit: "kg" },
          { tex: "g", meaning: s("g"), unit: "m/s²" },
        ]}
      />
      <Equation
        tex={String.raw`R\,e^{i\psi} = \frac{1}{N}\sum_{j=1}^{N} e^{i\varphi_j}`}
        reads={t("experiments.metronomes.model.order")}
        symbols={[
          { tex: "R", meaning: s("R") },
          { tex: String.raw`\varphi_j`, meaning: s("phi"), unit: "rad" },
          { tex: "N", meaning: s("N") },
        ]}
      />
      <Equation
        tex={String.raw`\frac{d\psi}{d\tau} \approx \Delta - \frac{\beta}{\mu}\,(3\gamma + \beta)\sin\psi, \qquad \gamma = \frac{\theta_0^2}{6}`}
        reads={t("experiments.metronomes.model.lock")}
        symbols={[
          { tex: String.raw`\psi`, meaning: s("psi"), unit: "rad" },
          { tex: String.raw`\gamma`, meaning: s("gamma") },
        ]}
      />
    </>
  );
}

function MetronomesTrick({ mt }: { mt: Metronomes | null }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hue = useChartHue();
  const runs = useMemo(() => {
    if (!mt) return null;
    const free = run({ ...mt, free: true }, "scattered", TRICK_S);
    const held = run({ ...mt, free: false }, "scattered", TRICK_S);
    const rows = free.t.flatMap((time, k) =>
      k % 10 === 0 ? [{ t: time, free: free.order[k], held: held.order[k] }] : [],
    );
    return { rows, inStep: inStepS(free, IN_STEP), heldMost: Math.max(...held.order) };
  }, [mt]);
  if (!runs) return <LoadingState className="py-6" label={t("common.loading")} />;
  return (
    <>
      <p>{t("experiments.metronomes.sweet.push")}</p>
      <SeriesChart
        rows={runs.rows}
        series={[
          { key: "free", label: t("experiments.metronomes.play.free"), color: hue(2) },
          { key: "held", label: t("experiments.metronomes.play.held"), color: hue(6) },
        ]}
        axes={[
          {
            id: "y",
            title: t("experiments.metronomes.chart.order"),
            format: (v) => formatNumber(v, 1, locale),
            includeZero: true,
          },
        ]}
        x={{
          key: "t",
          title: `${t("experiments.metronomes.chart.time")} (s)`,
          format: (v) => formatNumber(v, 0, locale),
        }}
      />
      <p>
        {runs.inStep === null
          ? t("experiments.metronomes.sweet.never", { most: formatNumber(runs.heldMost, 2, locale) })
          : t("experiments.metronomes.sweet.in_step", {
              seconds: formatNumber(runs.inStep, 0, locale),
              most: formatNumber(runs.heldMost, 2, locale),
            })}
      </p>
      <p>{t("experiments.metronomes.sweet.why")}</p>
    </>
  );
}

/** How the engine computes them: 2N first-order equations, the board's
 *  acceleration solved out of them first. */
function MetronomesComputed() {
  const { t } = useTranslation();
  return (
    <>
      <Equation
        tex={String.raw`\theta_i'' = F_i + \beta\cos\theta_i\,S, \qquad S = \frac{\sum_j \left(F_j\cos\theta_j - \theta_j'^2\sin\theta_j\right)}{1 - \beta\sum_j \cos^2\theta_j}`}
        reads={t("experiments.metronomes.computed.solve")}
        symbols={[
          { tex: "F_i", meaning: t("experiments.metronomes.symbols.F") },
          { tex: "S", meaning: t("experiments.metronomes.symbols.S") },
        ]}
      />
      <p>{t("experiments.metronomes.computed.system")}</p>
    </>
  );
}
