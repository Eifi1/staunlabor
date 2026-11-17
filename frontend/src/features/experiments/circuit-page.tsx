import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pause, Play, RotateCcw, Zap } from "lucide-react";
import { Button, LoadingState, ToggleGroup } from "@eifi1/ui-kit";
import { SeriesChart } from "@/shared/charts/series-chart";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber } from "@/shared/lib/format";
import { useChartHex } from "@/shared/state/palette-store";
import type { CircuitRequest } from "@/shared/types";
import { SliderField } from "@/shared/ui/slider-field";
import { Figures, WidgetCard } from "@/shared/ui/widget";
import { Equation } from "./equation";
import { ExhibitFrame } from "./exhibit-frame";
import { BuildPending } from "./build-pending";
import { PreviewPending, type PreviewMode, type PreviewProps } from "./preview-mode";
import { energies, figures, rates, state, type Circuit } from "./simulate/circuit";
import { SIDE } from "./stage";
import { useExperimentsDefaults } from "./use-experiments";

/** Real time, and a quarter of it for a quick circuit whose needle would blur. */
const SPEEDS = { real: 1, slow: 0.25 } as const;
type Speed = keyof typeof SPEEDS;

/** The preview charges for a moment, throws the switch and lets it ring out,
 *  over and over: this long a run, the first part of it charged. */
const PREVIEW_LOOP_S = 14;
const PREVIEW_CHARGED_S = 1.5;

/** The meter's needle at full scale, either side of zero. */
const NEEDLE_DEG = 50;
/** The twin's block at full charge, in the drawing's units. */
const TWIN_REACH = 70;

const CHART_POINTS = 601;
/** The charts span three of the slowest decay's time constants: the needle's
 *  swings are a twentieth of the first by then. Never under two swings, never
 *  over half a minute. */
const CHART_DECAYS = 3;
const CHART_MAX_S = 30;

const CAPACITOR_HUE = 0;
const COIL_HUE = 1;
const LEFT_HUE = 2;
const HEAT_HUE = 3;

/** The meter's full scale: the first round value (1, 2 or 5 a power of ten)
 *  over the strongest current, in mA. */
function meterRangeMa(peakA: number): number {
  const ma = peakA * 1000;
  const p = 10 ** Math.floor(Math.log10(ma));
  for (const m of [1, 2, 5]) if (m * p >= ma) return m * p;
  return 10 * p;
}

/** How long the charts run: by the slowest decay, `γ`, or `γ − β` when it creeps. */
function chartSpanS(circuit: Circuit): number {
  const [omega0, gamma] = rates(circuit);
  const slowest = gamma - Math.sqrt(Math.max(0, gamma * gamma - omega0 * omega0));
  const natural = (2 * Math.PI) / omega0;
  return Math.min(CHART_MAX_S, Math.max(CHART_DECAYS / slowest, 2 * natural));
}

/**
 * The slow LC circuit (`experiments.circuit`): a capacitor thrown over to a
 * big coil, its exact charge and current from the browser port
 * (`simulate/circuit.ts`, held to the engine by `simulate.test.ts`), drawn as a
 * circuit with its meter and as the spring that obeys the same equation. No route.
 */
export function CircuitPage() {
  const { t } = useTranslation();
  const defaults = useExperimentsDefaults();
  const [build, setBuild] = useState<CircuitRequest | null>(null);
  const circuit = build ?? defaults.data?.circuit ?? null;
  return (
    <ExhibitFrame
      exhibit="circuit"
      atTheExhibit={
        <>
          <p>{t("experiments.circuit.at.build")}</p>
          <p>{t("experiments.circuit.at.swing")}</p>
          <p>{t("experiments.circuit.at.origin")}</p>
        </>
      }
      whatHappens={<CircuitModel />}
      computed={<CircuitComputed />}
      sweetSpot={
        circuit ? <CircuitTrick circuit={circuit} /> : <LoadingState className="py-6" label={t("common.loading")} />
      }
    >
      {defaults.isPending || !circuit ? (
        <BuildPending pending={defaults.isPending} error={defaults.error} />
      ) : (
        <>
          {/* A new build is a new charge: the run starts again with the switch on the battery. */}
          <CircuitPlay key={JSON.stringify(circuit)} circuit={circuit} />
          <CircuitBuild circuit={circuit} onChange={setBuild} />
        </>
      )}
    </ExhibitFrame>
  );
}

/** The exhibit charged, thrown over and left to ring out, again and again. */
export function CircuitPreview({ paused }: PreviewProps) {
  const defaults = useExperimentsDefaults();
  const circuit = defaults.data?.circuit;
  return circuit ? <CircuitPlay circuit={circuit} preview paused={paused} /> : <PreviewPending />;
}

/** `charge` is `q/q₀` (−1 to 1), `needle` the current over the meter's range (clamped). */
function CircuitView({ charge, needle, thrown }: { charge: number; needle: number; thrown: boolean }) {
  const { t } = useTranslation();
  const hex = useChartHex();
  const lever = thrown ? [136, 26] : [84, 26];
  const angle = Math.max(-1, Math.min(1, needle)) * NEEDLE_DEG;
  const sign = charge >= 0 ? ["+", "−"] : ["−", "+"];
  const loops = Array.from({ length: 6 }, () => "a 4 4 0 0 1 0 8").join(" ");
  return (
    <svg
      viewBox="0 0 260 150"
      role="img"
      aria-label={t("experiments.circuit.view")}
      className="w-full rounded-lg border border-subtle bg-surface-2 text-muted"
    >
      <g fill="none" stroke="currentColor" strokeWidth={1.5} vectorEffect="non-scaling-stroke">
        {/* The battery's branch, the capacitor's and the coil's, and the wire under them all. */}
        <polyline points="82,24 30,24 30,74" />
        <line x1={30} y1={82} x2={30} y2={130} />
        <line x1={110} y1={40} x2={110} y2={72} />
        <line x1={110} y1={84} x2={110} y2={130} />
        <polyline points="138,24 230,24 230,40" />
        <line x1={230} y1={88} x2={230} y2={96} />
        <line x1={230} y1={112} x2={230} y2={130} />
        <polyline points="30,130 153,130" />
        <polyline points="187,130 230,130" />
        {/* The coil, with its iron core beside it. */}
        <path
          d={`M 230 40 ${loops}`}
          stroke={hex[COIL_HUE % hex.length]}
          strokeOpacity={0.35 + 0.65 * Math.abs(needle)}
        />
        <rect x={224} y={96} width={12} height={16} />
      </g>
      <g stroke="currentColor" strokeWidth={3} vectorEffect="non-scaling-stroke">
        <line x1={20} y1={74} x2={40} y2={74} strokeWidth={1.5} />
        <line x1={25} y1={82} x2={35} y2={82} />
        <line x1={95} y1={72} x2={125} y2={72} />
        <line x1={95} y1={84} x2={125} y2={84} />
        <line x1={242} y1={38} x2={242} y2={90} strokeWidth={1.5} />
        <line x1={245} y1={38} x2={245} y2={90} strokeWidth={1.5} />
      </g>
      {/* The charge on the plates: the signs fade as it flows off and come back the other way round. */}
      <g fontSize={9} textAnchor="middle" fill={hex[CAPACITOR_HUE % hex.length]} fillOpacity={Math.abs(charge)}>
        {[100, 110, 120].map((x) => (
          <text key={`top-${x}`} x={x} y={68}>
            {sign[0]}
          </text>
        ))}
        {[100, 110, 120].map((x) => (
          <text key={`bottom-${x}`} x={x} y={95}>
            {sign[1]}
          </text>
        ))}
      </g>
      {/* The switch: on the battery, or thrown over to the coil. */}
      <g stroke="currentColor" strokeWidth={2} vectorEffect="non-scaling-stroke" className="text-primary">
        <line x1={110} y1={40} x2={lever[0]} y2={lever[1]} />
      </g>
      {[
        [82, 24],
        [138, 24],
        [110, 40],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={2.5} className="fill-current" />
      ))}
      {/* The meter, its zero in the middle. */}
      {/* The dial in the card's own colour, light or dark. */}
      <circle
        cx={170}
        cy={130}
        r={17}
        fill="var(--bg-surface)"
        stroke="currentColor"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      {[-NEEDLE_DEG, 0, NEEDLE_DEG].map((deg) => (
        <line
          key={deg}
          x1={170}
          y1={117}
          x2={170}
          y2={120}
          transform={`rotate(${deg} 170 136)`}
          stroke="currentColor"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <line
        x1={170}
        y1={136}
        x2={170}
        y2={119}
        transform={`rotate(${angle} 170 136)`}
        stroke="currentColor"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
        className="text-danger"
      />
      <g fontSize={9} fill="currentColor" fontStyle="italic">
        <text x={44} y={81}>
          U₀
        </text>
        <text x={130} y={81}>
          C
        </text>
        <text x={250} y={68}>
          L
        </text>
        <text x={240} y={108}>
          R
        </text>
        <text x={170} y={144} fontSize={6} fontStyle="normal" textAnchor="middle">
          A
        </text>
      </g>
    </svg>
  );
}

/** The spring that obeys the circuit's equation: its block is out as far as the capacitor is charged. */
function TwinView({ charge }: { charge: number }) {
  const { t } = useTranslation();
  const block = 130 + TWIN_REACH * charge;
  const left = block - 14;
  const coils = 12;
  const points = Array.from({ length: coils + 1 }, (_, k) => {
    const x = 12 + ((left - 12) * k) / coils;
    const y = k === 0 || k === coils ? 28 : k % 2 ? 22 : 34;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg
      viewBox="0 0 260 44"
      role="img"
      aria-label={t("experiments.circuit.twin")}
      className="w-full rounded-lg border border-subtle bg-surface-2 text-muted"
    >
      <rect x={6} y={8} width={6} height={32} className="fill-current" fillOpacity={0.4} />
      <line x1={12} y1={40} x2={254} y2={40} stroke="currentColor" vectorEffect="non-scaling-stroke" />
      <line
        x1={130}
        y1={6}
        x2={130}
        y2={40}
        stroke="currentColor"
        strokeDasharray="3 3"
        vectorEffect="non-scaling-stroke"
      />
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <rect x={left} y={18} width={28} height={22} rx={2} className="fill-current text-primary" />
    </svg>
  );
}

/** Where the energy is: in the capacitor, in the coil, and what has turned into heat. */
function EnergyBar({ circuit, time }: { circuit: Circuit; time: number }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  const total = figures(circuit).energy_j;
  const [inCapacitor, inCoil] = time < 0 ? [total, 0] : energies(circuit, time);
  const parts = [
    { key: "capacitor", share: inCapacitor / total, color: hex[CAPACITOR_HUE % hex.length] },
    { key: "coil", share: inCoil / total, color: hex[COIL_HUE % hex.length] },
    { key: "heat", share: Math.max(0, 1 - (inCapacitor + inCoil) / total), color: hex[HEAT_HUE % hex.length] },
  ];
  const said = parts.map(
    (p) => `${t(`experiments.circuit.play.${p.key}`)} ${formatNumber(p.share * 100, 0, locale)} %`,
  );
  return (
    <div className="space-y-1">
      <p className="text-sm text-secondary">{t("experiments.circuit.play.energy")}</p>
      <div
        role="img"
        aria-label={`${t("experiments.circuit.play.energy")}: ${said.join(", ")}`}
        className="flex h-3 w-full overflow-hidden rounded-full border border-subtle bg-surface-2"
      >
        {parts.map((p) => (
          <div key={p.key} style={{ width: `${p.share * 100}%`, backgroundColor: p.color }} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted">
        {parts.map((p, k) => (
          <li key={p.key} className="flex items-center gap-1">
            <span aria-hidden className="inline-block size-2 rounded-full" style={{ backgroundColor: p.color }} />
            {said[k]}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CircuitPlay({ circuit, preview = false, paused = false }: { circuit: Circuit } & PreviewMode) {
  const { t } = useTranslation();
  const locale = useLocale();
  const clock = useRef(0);
  const [time, setTime] = useState(0);
  const [thrown, setThrown] = useState(false);
  const [runningHere, setRunning] = useState(false);
  const [speedHere, setSpeed] = useState<Speed>("real");
  const running = preview ? !paused : thrown && runningHere;
  const speed = preview ? SPEEDS.real : SPEEDS[speedHere];
  const peak = useMemo(() => figures(circuit).peak_current_a, [circuit]);
  const range = meterRangeMa(peak);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      // A frame's timestamp can lie a little before the effect started: never a step back in time.
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      clock.current += dt * speed;
      setTime(clock.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, speed]);

  // The preview's run: charged for a moment, then thrown; a negative time is the charged capacitor.
  const runTime = preview ? (time % PREVIEW_LOOP_S) - PREVIEW_CHARGED_S : thrown ? time : -1;
  const [q, i] = state(circuit, runTime);
  const q0 = circuit.capacitance_f * circuit.voltage_v;
  const views = (
    <div className="space-y-2">
      <CircuitView charge={q / q0} needle={(i * 1000) / range} thrown={runTime >= 0} />
      <TwinView charge={q / q0} />
    </div>
  );
  if (preview) return views;

  const recharge = () => {
    clock.current = 0;
    setTime(0);
    setThrown(false);
    setRunning(false);
  };
  return (
    <WidgetCard
      title={t("experiments.circuit.play.title")}
      hint={t("experiments.circuit.play.hint")}
      actions={
        thrown ? (
          <>
            <Button variant="secondary" size="sm" onClick={() => setRunning(!runningHere)}>
              {runningHere ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
              {runningHere ? t("experiments.circuit.play.pause") : t("experiments.circuit.play.run")}
            </Button>
            <Button variant="secondary" size="sm" onClick={recharge}>
              <RotateCcw className="size-4" aria-hidden />
              {t("experiments.circuit.play.recharge")}
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            onClick={() => {
              setThrown(true);
              setRunning(true);
            }}
          >
            <Zap className="size-4" aria-hidden />
            {t("experiments.circuit.play.throw")}
          </Button>
        )
      }
    >
      <div className={SIDE.grid}>
        <div className={SIDE.top}>
          <ToggleGroup
            label={t("experiments.circuit.play.speed")}
            labelPlacement="above"
            size="sm"
            overflow="wrap"
            value={speedHere}
            onChange={(v: string) => setSpeed(v as Speed)}
            options={(Object.keys(SPEEDS) as Speed[]).map((s) => ({
              value: s,
              label: t(`experiments.circuit.play.speeds.${s}`),
            }))}
          />
        </div>
        <div className={`${SIDE.views} mx-auto w-full max-w-xl`}>
          <figure className="space-y-1">
            {views}
            <figcaption className="text-center text-caption text-muted">
              {t("experiments.circuit.play.caption", { range: formatNumber(range, 0, locale) })}
            </figcaption>
          </figure>
          {!thrown && (
            <p className="text-sm text-secondary" role="status">
              {t("experiments.circuit.play.charged", { voltage: formatNumber(circuit.voltage_v, 0, locale) })}
            </p>
          )}
        </div>
        <div className={SIDE.column}>
          <EnergyBar circuit={circuit} time={runTime} />
          <Figures
            tiles={[
              {
                key: "time",
                label: t("experiments.circuit.play.time"),
                value: Math.max(0, runTime),
                digits: 1,
                unit: "s",
              },
              { key: "current", label: t("experiments.circuit.play.current"), value: i * 1000, digits: 2, unit: "mA" },
              {
                key: "voltage",
                label: t("experiments.circuit.play.voltage"),
                value: q / circuit.capacitance_f,
                digits: 2,
                unit: "V",
              },
            ]}
          />
        </div>
      </div>
    </WidgetCard>
  );
}

function CircuitBuild({ circuit, onChange }: { circuit: Circuit; onChange: (next: Circuit) => void }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  const shown = figures(circuit);
  const span = chartSpanS(circuit);
  const rows = useMemo(
    () =>
      Array.from({ length: CHART_POINTS }, (_, k) => {
        const s = (span * k) / (CHART_POINTS - 1);
        return { s, current: state(circuit, s)[1] * 1000 };
      }),
    [circuit, span],
  );
  return (
    <WidgetCard title={t("experiments.circuit.change.title")} hint={t("experiments.circuit.change.hint")}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SliderField
          label={t("experiments.circuit.change.inductance")}
          unit="H"
          value={circuit.inductance_h}
          min={20}
          max={400}
          step={5}
          digits={0}
          hint={t("experiments.circuit.change.inductance_hint")}
          onChange={(v) => onChange({ ...circuit, inductance_h: v })}
        />
        <SliderField
          label={t("experiments.circuit.change.capacitance")}
          unit="µF"
          value={circuit.capacitance_f * 1e6}
          min={20}
          max={1000}
          step={5}
          digits={0}
          hint={t("experiments.circuit.change.capacitance_hint")}
          onChange={(v) => onChange({ ...circuit, capacitance_f: v * 1e-6 })}
        />
        <SliderField
          label={t("experiments.circuit.change.resistance")}
          unit="Ω"
          value={circuit.resistance_ohm}
          min={10}
          max={4000}
          step={10}
          digits={0}
          hint={t("experiments.circuit.change.resistance_hint")}
          onChange={(v) => onChange({ ...circuit, resistance_ohm: v })}
        />
        <SliderField
          label={t("experiments.circuit.change.voltage")}
          unit="V"
          value={circuit.voltage_v}
          min={1}
          max={20}
          step={1}
          digits={0}
          hint={t("experiments.circuit.change.voltage_hint")}
          onChange={(v) => onChange({ ...circuit, voltage_v: v })}
        />
      </div>
      <p className={`text-sm font-medium ${shown.regime === "swings" ? "text-primary" : "text-danger"}`} role="status">
        {t(`experiments.circuit.change.${shown.regime}`)}
      </p>
      <Figures
        tiles={[
          {
            key: "period",
            label: t("experiments.circuit.figures.period"),
            value: shown.period_s,
            digits: 2,
            unit: "s",
          },
          { key: "swings", label: t("experiments.circuit.figures.swings"), value: shown.swings, digits: 0 },
          {
            key: "peak",
            label: t("experiments.circuit.figures.peak"),
            value: shown.peak_current_a * 1000,
            digits: 1,
            unit: "mA",
          },
          { key: "quality", label: t("experiments.circuit.figures.quality"), value: shown.quality, digits: 1 },
          {
            key: "critical",
            label: t("experiments.circuit.figures.critical"),
            value: shown.critical_ohm,
            digits: 0,
            unit: "Ω",
          },
        ]}
      />
      <SeriesChart
        rows={rows}
        series={[{ key: "current", label: t("experiments.circuit.chart.current"), color: hex[COIL_HUE % hex.length] }]}
        axes={[
          {
            id: "y",
            title: `${t("experiments.circuit.chart.current")} (mA)`,
            format: (v) => formatNumber(v, 1, locale),
            includeZero: true,
          },
        ]}
        x={{
          key: "s",
          title: `${t("experiments.circuit.chart.time")} (s)`,
          format: (v) => formatNumber(v, 1, locale),
        }}
      />
    </WidgetCard>
  );
}

function CircuitModel() {
  const { t } = useTranslation();
  const s = (key: string) => t(`experiments.circuit.symbols.${key}`);
  return (
    <>
      <p>{t("experiments.circuit.model.intro")}</p>
      <Equation
        tex={String.raw`u_C = \frac{q}{C}`}
        reads={t("experiments.circuit.model.capacitor")}
        symbols={[
          { tex: "u_C", meaning: s("uc"), unit: "V" },
          { tex: "q", meaning: s("q"), unit: "C" },
          { tex: "C", meaning: s("c"), unit: "F" },
        ]}
      />
      <Equation
        tex={String.raw`u_L = L\,\frac{di}{dt}`}
        reads={t("experiments.circuit.model.coil")}
        symbols={[
          { tex: "u_L", meaning: s("ul"), unit: "V" },
          { tex: "L", meaning: s("l"), unit: "H" },
          { tex: "i", meaning: s("i"), unit: "A" },
          { tex: "t", meaning: s("t"), unit: "s" },
        ]}
      />
      <Equation
        tex={String.raw`L\,\frac{di}{dt} + R\,i = \frac{q}{C}, \qquad i = -\frac{dq}{dt}`}
        reads={t("experiments.circuit.model.loop")}
        symbols={[{ tex: "R", meaning: s("r"), unit: "Ω" }]}
      />
      <Equation
        tex={String.raw`L\,\ddot q + R\,\dot q + \frac{q}{C} = 0 \quad\Longleftrightarrow\quad m\,\ddot x + b\,\dot x + k\,x = 0`}
        reads={t("experiments.circuit.model.twin")}
        symbols={[
          { tex: "m", meaning: s("m"), unit: "kg" },
          { tex: "b", meaning: s("b"), unit: "N·s/m" },
          { tex: "k", meaning: s("k"), unit: "N/m" },
          { tex: "x", meaning: s("x"), unit: "m" },
        ]}
      />
      <Equation
        tex={String.raw`T_0 = 2\pi\sqrt{L\,C}, \qquad T = \frac{2\pi}{\sqrt{\dfrac{1}{LC} - \left(\dfrac{R}{2L}\right)^2}}`}
        reads={t("experiments.circuit.model.period")}
        symbols={[
          { tex: "T_0", meaning: s("t0"), unit: "s" },
          { tex: "T", meaning: s("period"), unit: "s" },
        ]}
      />
      <Equation
        tex={String.raw`R_\mathrm{c} = 2\,\sqrt{\frac{L}{C}}`}
        reads={t("experiments.circuit.model.critical")}
        symbols={[{ tex: String.raw`R_\mathrm{c}`, meaning: s("rc"), unit: "Ω" }]}
      />
    </>
  );
}

function CircuitTrick({ circuit }: { circuit: Circuit }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  const span = chartSpanS(circuit);
  const rows = useMemo(
    () =>
      Array.from({ length: CHART_POINTS }, (_, k) => {
        const s = (span * k) / (CHART_POINTS - 1);
        const [inCapacitor, inCoil] = energies(circuit, s);
        return { s, capacitor: inCapacitor * 1000, coil: inCoil * 1000, left: (inCapacitor + inCoil) * 1000 };
      }),
    [circuit, span],
  );
  return (
    <>
      <p>{t("experiments.circuit.sweet.inertia")}</p>
      <p>{t("experiments.circuit.sweet.twin")}</p>
      <p>{t("experiments.circuit.sweet.numbers")}</p>
      <p>{t("experiments.circuit.sweet.critical")}</p>
      <p className="text-sm text-secondary">{t("experiments.circuit.chart.energy_hint")}</p>
      <SeriesChart
        rows={rows}
        series={[
          { key: "capacitor", label: t("experiments.circuit.chart.capacitor"), color: hex[CAPACITOR_HUE % hex.length] },
          { key: "coil", label: t("experiments.circuit.chart.coil"), color: hex[COIL_HUE % hex.length] },
          { key: "left", label: t("experiments.circuit.chart.left"), color: hex[LEFT_HUE % hex.length], dashed: true },
        ]}
        axes={[
          {
            id: "y",
            title: `${t("experiments.circuit.chart.energy")} (mJ)`,
            format: (v) => formatNumber(v, 1, locale),
            includeZero: true,
          },
        ]}
        x={{
          key: "s",
          title: `${t("experiments.circuit.chart.time")} (s)`,
          format: (v) => formatNumber(v, 1, locale),
        }}
      />
    </>
  );
}

function CircuitComputed() {
  const { t } = useTranslation();
  const c = (key: string) => t(`experiments.circuit.computed.${key}`);
  return (
    <>
      <p>{c("system")}</p>
      <Equation
        tex={String.raw`q(t) = q_0\,e^{-\gamma t}\left(\cos\omega_d t + \frac{\gamma}{\omega_d}\,\sin\omega_d t\right), \qquad i(t) = q_0\,\frac{\omega_0^2}{\omega_d}\,e^{-\gamma t}\,\sin\omega_d t`}
        reads={c("exact")}
        symbols={[
          { tex: "q_0 = C\\,U_0", meaning: c("q0"), unit: "C" },
          { tex: String.raw`\omega_0 = 1/\sqrt{LC}`, meaning: c("omega0"), unit: "1/s" },
          { tex: String.raw`\gamma = R/2L`, meaning: c("gamma"), unit: "1/s" },
          { tex: String.raw`\omega_d = \sqrt{\omega_0^2 - \gamma^2}`, meaning: c("omega_d"), unit: "1/s" },
        ]}
      />
      <p>{c("check")}</p>
      <p>{c("left_out")}</p>
    </>
  );
}
