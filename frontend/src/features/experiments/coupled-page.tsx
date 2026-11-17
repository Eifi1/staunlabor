import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pause, Play } from "lucide-react";
import { AlertBanner, Button, LoadingState, ToggleGroup } from "@eifi1/ui-kit";
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
import { startsRunning } from "./play";
import {
  beatS,
  energies,
  exchangeShare,
  modeRates,
  rhs,
  startState,
  swing,
  type CoupledPendulums,
  type Start,
} from "./simulate/coupled";
import { STEP_S, rk4 } from "./simulate/pendulum";
import { SIDE } from "./stage";
import { useExperimentsDefaults } from "./use-experiments";

/** How far a pendulum is pulled aside: wide enough to see, small enough that the
 *  modes are the small swing's. */
const START_DEG = 10;
const STARTS: readonly Start[] = ["one", "together", "against"];
const SPEEDS = [1, 3] as const;
type Speed = (typeof SPEEDS)[number];

/** The left bob's hue and the right's, here and in the chart. */
const LEFT_HUE = 2;
const RIGHT_HUE = 6;

/** Whether the build hangs: the spring between each pivot and its bob. */
export function hangs(cp: CoupledPendulums): boolean {
  return cp.spring_at_m > 0 && cp.spring_at_m <= Math.min(cp.left.length_m, cp.right.length_m);
}

/**
 * The coupled pendulums (`experiments.coupled`): the pair stepped by the
 * browser port (`simulate/coupled.ts`, held to the engine by
 * `simulate.test.ts`), each pendulum's energy shown as it wanders, and the
 * modes, the beat and the share handed over read off the port: no route.
 */
export function CoupledPage() {
  const { t } = useTranslation();
  const defaults = useExperimentsDefaults();
  const [build, setBuild] = useState<CoupledPendulums | null>(null);
  const cp = build ?? defaults.data?.coupled ?? null;
  const fine = cp ? hangs(cp) : false;
  return (
    <ExhibitFrame
      exhibit="coupled"
      atTheExhibit={
        <>
          <p>{t("experiments.coupled.at.pair")}</p>
          <p>{t("experiments.coupled.at.wanders")}</p>
        </>
      }
      whatHappens={<CoupledModel />}
      computed={<CoupledComputed />}
      sweetSpot={<CoupledTrick cp={fine ? cp : null} />}
    >
      {defaults.isPending || !cp ? (
        <BuildPending pending={defaults.isPending} error={defaults.error} />
      ) : (
        <>
          {fine ? (
            <CoupledPlay key={JSON.stringify(cp)} cp={cp} />
          ) : (
            <AlertBanner tone="warning">{t("experiments.coupled.refused")}</AlertBanner>
          )}
          <CoupledBuild cp={cp} onChange={setBuild} />
        </>
      )}
    </ExhibitFrame>
  );
}

/** One pushed, left to wander, three times real time, for the overview. */
export function CoupledPreview({ paused }: PreviewProps) {
  const defaults = useExperimentsDefaults();
  const cp = defaults.data?.coupled;
  return cp ? <CoupledPlay cp={cp} preview paused={paused} /> : <PreviewPending />;
}

/** The pair from the front: the bar, two rods and bobs, and the spring between. */
export function CoupledView({ cp, left, right }: { cp: CoupledPendulums; left: number; right: number }) {
  const { t } = useTranslation();
  const hex = useChartHex();
  const longest = Math.max(cp.left.length_m, cp.right.length_m);
  const gap = Math.max(0.6 * longest, 0.2);
  const bob = longest * 0.06;
  const pivots: [number, number] = [-gap / 2, gap / 2];
  const at = (pivot: number, length: number, angle: number): [number, number] => [
    pivot + length * Math.sin(angle),
    length * Math.cos(angle),
  ];
  const b1 = at(pivots[0], cp.left.length_m, left);
  const b2 = at(pivots[1], cp.right.length_m, right);
  const s1 = at(pivots[0], cp.spring_at_m, left);
  const s2 = at(pivots[1], cp.spring_at_m, right);
  // The spring as a zigzag of eight turns between its two ends.
  const turns = 8;
  const dx = s2[0] - s1[0];
  const dy = s2[1] - s1[1];
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;
  const zig = Array.from({ length: 2 * turns + 1 }, (_, i) => {
    const f = i / (2 * turns);
    const off = i === 0 || i === 2 * turns ? 0 : (i % 2 ? 1 : -1) * bob * 0.5;
    return `${s1[0] + dx * f + nx * off},${s1[1] + dy * f + ny * off}`;
  }).join(" ");
  const half = gap / 2 + longest * 0.6;
  return (
    <svg
      viewBox={`${-half} ${-bob * 2} ${2 * half} ${longest + bob * 4}`}
      role="img"
      aria-label={t("experiments.coupled.view")}
      className="max-h-[60dvh] w-full rounded-lg border border-subtle bg-surface-2 text-muted"
    >
      <line
        x1={-half * 0.8}
        y1={0}
        x2={half * 0.8}
        y2={0}
        stroke="currentColor"
        strokeWidth={4}
        vectorEffect="non-scaling-stroke"
      />
      <polyline points={zig} fill="none" stroke="currentColor" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      {[
        [pivots[0], b1, LEFT_HUE],
        [pivots[1], b2, RIGHT_HUE],
      ].map(([pivot, end, hue]) => {
        const [x, y] = end as [number, number];
        return (
          <g key={pivot as number}>
            <line
              x1={pivot as number}
              y1={0}
              x2={x}
              y2={y}
              stroke="currentColor"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={x} cy={y} r={bob} fill={hex[(hue as number) % hex.length]} />
          </g>
        );
      })}
    </svg>
  );
}

function CoupledPlay({ cp, preview = false, paused = false }: { cp: CoupledPendulums } & PreviewMode) {
  const { t } = useTranslation();
  const hex = useChartHex();
  const sim = useRef({ y: startState("one", START_DEG), clock: 0, owed: 0 });
  const [runningHere, setRunning] = useState(startsRunning);
  const [speedHere, setSpeed] = useState<Speed>(1);
  const [start, setStart] = useState<Start>("one");
  const [y, setY] = useState<number[]>(() => startState("one", START_DEG));
  const running = preview ? !paused : runningHere;
  const speed = preview ? 3 : speedHere;

  useEffect(() => {
    if (!running) return;
    const f = rhs(cp);
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      // A frame's timestamp can lie a little before the effect started: never a
      // step back in time.
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      const s = sim.current;
      s.owed += (dt * speed) / STEP_S;
      const steps = Math.floor(s.owed);
      s.owed -= steps;
      for (let k = 0; k < steps; k++) {
        s.y = rk4(f, s.clock, s.y, STEP_S);
        s.clock += STEP_S;
      }
      setY(s.y);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, speed, cp]);

  const letGo = (how: Start) => {
    sim.current = { y: startState(how, START_DEG), clock: 0, owed: 0 };
    setStart(how);
    setY(sim.current.y);
    setRunning(true);
  };

  const view = <CoupledView cp={cp} left={y[0]} right={y[1]} />;
  if (preview) return view;
  const [e1, e2] = energies(cp, y);
  // Shares of everything put in, the spring's stretch at the start included:
  // pulled aside alone, the left pendulum also stretches the spring.
  const [first, second, spring] = energies(cp, startState(start, START_DEG));
  const total = first + second + spring;
  return (
    <WidgetCard
      title={t("experiments.coupled.play.title")}
      hint={t("experiments.coupled.play.hint")}
      actions={
        <Button variant="secondary" size="sm" onClick={() => setRunning(!running)}>
          {running ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
          {running ? t("experiments.coupled.play.pause") : t("experiments.coupled.play.run")}
        </Button>
      }
    >
      <div className={SIDE.grid}>
        <div className={`${SIDE.top} space-y-2`}>
          <p className="text-sm text-secondary">{t("experiments.coupled.play.let_go")}</p>
          <div className="flex flex-wrap gap-2">
            {STARTS.map((how) => (
              <Button key={how} variant={start === how ? "accent" : "secondary"} size="sm" onClick={() => letGo(how)}>
                {t(`experiments.coupled.play.starts.${how}`)}
              </Button>
            ))}
          </div>
        </div>
        <div className={`${SIDE.views} mx-auto w-full max-w-xl`}>{view}</div>
        <div className={SIDE.column}>
          <ToggleGroup
            label={t("experiments.coupled.play.speed")}
            labelPlacement="above"
            size="sm"
            value={String(speed)}
            onChange={(x: string) => setSpeed(Number(x) as Speed)}
            options={SPEEDS.map((x) => ({ value: String(x), label: t(`experiments.coupled.play.speeds.${x}`) }))}
          />
          {/* Each pendulum's share of what was put in, as it wanders. */}
          <div className="space-y-2" aria-label={t("experiments.coupled.play.energy")} role="group">
            {[
              [t("experiments.coupled.play.left"), e1, LEFT_HUE],
              [t("experiments.coupled.play.right"), e2, RIGHT_HUE],
            ].map(([label, energy, hue]) => (
              <div key={label as string} className="space-y-1">
                <div className="flex justify-between text-sm text-secondary">
                  <span>{label as string}</span>
                  <span>{Math.round((100 * (energy as number)) / total)} %</span>
                </div>
                <div className="h-2 rounded-full bg-surface-2">
                  <div
                    className="h-2 rounded-full"
                    style={{
                      width: `${Math.min(100, (100 * (energy as number)) / total)}%`,
                      background: hex[(hue as number) % hex.length],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <CoupledFigures cp={cp} />
        </div>
      </div>
    </WidgetCard>
  );
}

function CoupledFigures({ cp }: { cp: CoupledPendulums }) {
  const { t } = useTranslation();
  const [w1, w2] = modeRates(cp);
  const beat = beatS(cp);
  return (
    <Figures
      tiles={[
        {
          key: "together",
          label: t("experiments.coupled.figures.together"),
          value: (2 * Math.PI) / w1,
          digits: 3,
          unit: "s",
        },
        {
          key: "against",
          label: t("experiments.coupled.figures.against"),
          value: (2 * Math.PI) / w2,
          digits: 3,
          unit: "s",
        },
        ...(beat === null
          ? []
          : [{ key: "beat", label: t("experiments.coupled.figures.beat"), value: beat, digits: 1, unit: "s" }]),
        {
          key: "share",
          label: t("experiments.coupled.figures.share"),
          value: exchangeShare(cp) * 100,
          digits: 0,
          unit: "%",
        },
      ]}
    />
  );
}

function CoupledBuild({ cp, onChange }: { cp: CoupledPendulums; onChange: (next: CoupledPendulums) => void }) {
  const { t } = useTranslation();
  const mass = (m: number) => onChange({ ...cp, left: { ...cp.left, mass_kg: m }, right: { ...cp.right, mass_kg: m } });
  return (
    <WidgetCard title={t("experiments.coupled.change.title")} hint={t("experiments.coupled.change.hint")}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SliderField
          label={t("experiments.coupled.change.spring")}
          unit="N/m"
          value={cp.spring_n_m}
          min={0}
          max={5}
          step={0.1}
          digits={1}
          hint={t("experiments.coupled.change.spring_hint")}
          onChange={(x) => onChange({ ...cp, spring_n_m: x })}
        />
        <SliderField
          label={t("experiments.coupled.change.spring_at")}
          unit="cm"
          value={cp.spring_at_m * 100}
          min={5}
          max={50}
          step={1}
          digits={0}
          hint={t("experiments.coupled.change.spring_at_hint")}
          onChange={(x) => onChange({ ...cp, spring_at_m: x / 100 })}
        />
        <SliderField
          label={t("experiments.coupled.change.right_length")}
          unit="cm"
          value={cp.right.length_m * 100}
          min={30}
          max={80}
          step={1}
          digits={0}
          hint={t("experiments.coupled.change.right_length_hint")}
          onChange={(x) => onChange({ ...cp, right: { ...cp.right, length_m: x / 100 } })}
        />
        <SliderField
          label={t("experiments.coupled.change.mass")}
          unit="g"
          value={cp.left.mass_kg * 1000}
          min={50}
          max={1000}
          step={10}
          digits={0}
          onChange={(x) => mass(x / 1000)}
        />
        <SliderField
          label={t("experiments.coupled.change.damping")}
          unit="1/s"
          value={cp.damping_per_s}
          min={0}
          max={0.2}
          step={0.01}
          digits={2}
          onChange={(x) => onChange({ ...cp, damping_per_s: x })}
        />
      </div>
    </WidgetCard>
  );
}

function CoupledModel() {
  const { t } = useTranslation();
  const s = (key: string) => t(`experiments.coupled.symbols.${key}`);
  return (
    <>
      <p>{t("experiments.coupled.model.intro")}</p>
      <Equation
        tex={String.raw`\ddot\theta_1 = -\frac{g}{L}\sin\theta_1 + \kappa\,(\sin\theta_2 - \sin\theta_1)\cos\theta_1`}
        reads={t("experiments.coupled.model.equation")}
        symbols={[
          { tex: String.raw`\theta_1, \theta_2`, meaning: s("theta"), unit: "rad" },
          { tex: "L", meaning: s("length"), unit: "m" },
          { tex: "g", meaning: s("g"), unit: "m/s²" },
          { tex: String.raw`\kappa = \frac{k\,a^2}{m\,L^2}`, meaning: s("kappa"), unit: "1/s²" },
          { tex: "k", meaning: s("k"), unit: "N/m" },
          { tex: "a", meaning: s("a"), unit: "m" },
          { tex: "m", meaning: s("m"), unit: "kg" },
        ]}
      />
      <Equation
        tex={String.raw`\omega_1 = \sqrt{\frac{g}{L}}, \qquad \omega_2 = \sqrt{\frac{g}{L} + 2\kappa}`}
        reads={t("experiments.coupled.model.modes")}
        symbols={[{ tex: String.raw`\omega_1, \omega_2`, meaning: s("omega"), unit: "1/s" }]}
      />
      <Equation
        tex={String.raw`T_{\text{beat}} = \frac{2\pi}{\omega_2 - \omega_1}`}
        reads={t("experiments.coupled.model.beat")}
        symbols={[{ tex: String.raw`T_{\text{beat}}`, meaning: s("beat"), unit: "s" }]}
      />
    </>
  );
}

function CoupledTrick({ cp }: { cp: CoupledPendulums | null }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  const rows = useMemo(() => {
    if (!cp) return [];
    const beat = beatS(cp) ?? 20;
    const run = swing(cp, "one", START_DEG, Math.min(2 * beat, 120), 0.002);
    const total = run.left_j[0] + run.right_j[0] + run.spring_j[0];
    return run.t.flatMap((time, i) =>
      i % 5 === 0 ? [{ t: time, left: (100 * run.left_j[i]) / total, right: (100 * run.right_j[i]) / total }] : [],
    );
  }, [cp]);
  if (!cp) return <LoadingState className="py-6" label={t("common.loading")} />;
  const beat = beatS(cp);
  return (
    <>
      <p>{t("experiments.coupled.sweet.modes")}</p>
      <SeriesChart
        rows={rows}
        series={[
          { key: "left", label: t("experiments.coupled.play.left"), color: hex[LEFT_HUE % hex.length] },
          { key: "right", label: t("experiments.coupled.play.right"), color: hex[RIGHT_HUE % hex.length] },
        ]}
        axes={[
          {
            id: "y",
            title: `${t("experiments.coupled.chart.energy")} (%)`,
            format: (v) => formatNumber(v, 0, locale),
            includeZero: true,
          },
        ]}
        x={{
          key: "t",
          title: `${t("experiments.coupled.chart.time")} (s)`,
          format: (v) => formatNumber(v, 0, locale),
        }}
      />
      {beat !== null && (
        <p>
          {t("experiments.coupled.sweet.beat", {
            beat: formatNumber(beat, 1, locale),
            share: formatNumber(exchangeShare(cp) * 100, 0, locale),
          })}
        </p>
      )}
      <Equation
        tex={String.raw`\text{share} = \frac{4\,\kappa_1\kappa_2}{(a_1 - a_2)^2 + 4\,\kappa_1\kappa_2}, \quad a_i = \frac{g}{L_i} + \kappa_i`}
        reads={t("experiments.coupled.sweet.unequal")}
        symbols={[{ tex: String.raw`\kappa_1, \kappa_2`, meaning: t("experiments.coupled.symbols.kappa_i") }]}
      />
    </>
  );
}

/** How the engine computes the pair: four first-order equations, stepped together. */
function CoupledComputed() {
  const { t } = useTranslation();
  return (
    <Equation
      tex={String.raw`\frac{d}{dt}\begin{pmatrix}\theta_1\\ \theta_2\\ \dot\theta_1\\ \dot\theta_2\end{pmatrix} = \begin{pmatrix}\dot\theta_1\\ \dot\theta_2\\ \ddot\theta_1(\theta_1, \theta_2, \dot\theta_1)\\ \ddot\theta_2(\theta_1, \theta_2, \dot\theta_2)\end{pmatrix}`}
      reads={t("experiments.coupled.computed.system")}
      symbols={[]}
    />
  );
}
