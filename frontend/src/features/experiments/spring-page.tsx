import { useMemo, useRef, useState, type PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button, LoadingState } from "@eifi1/ui-kit";
import { SeriesChart } from "@/shared/charts/series-chart";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber } from "@/shared/lib/format";
import { useChartHue } from "@/shared/state/palette-store";
import { holdTouch } from "@/shared/ui/grab";
import { SliderField } from "@/shared/ui/slider-field";
import { svgPoint } from "@/shared/ui/svg-point";
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
  aloneRates,
  beatS,
  energies,
  exchangeShare,
  MAX_PULL_M,
  MAX_TWIST_RAD,
  rhs,
  run,
  startState,
  tunedRadiusM,
  type Start,
  type WilberforceSpring,
} from "./simulate/spring";
import { SIDE, STAGE, VIEW_FRAME } from "./stage";
import { useExperimentsDefaults } from "./use-experiments";
import { rk4, STEP_S } from "./simulate/numerics";

const STARTS: readonly Start[] = ["down", "twisted", "fast", "slow"];
const SPEEDS = [1, 3] as const;
type Speed = (typeof SPEEDS)[number];

/** The bobbing's hue and the twist's, here and in the charts. */
const BOB_HUE = 2;
const TWIST_HUE = 6;

/** Where the nuts may sit on the arms, mm: from just outside the weight's
 *  body to the arm's end. */
const NUT_MIN_MM = 15;
const NUT_MAX_MM = 40;

/** A check case's build: where the nuts sit and the damping. */
function caseBuild(s: WilberforceSpring, setting: CheckSetting): WilberforceSpring {
  return {
    ...s,
    nut_radius_m: settingNumber(setting, "nut_radius_m", s.nut_radius_m),
    damping_per_s: settingNumber(setting, "damping_per_s", s.damping_per_s),
  };
}

/** `value` as a share of `total`, in per cent; nothing put in, none. */
function percent(value: number, total: number): number {
  return total > 1e-12 ? (100 * value) / total : 0;
}

/**
 * The Wilberforce spring (`experiments.spring`): the weight stepped by the
 * browser port (`simulate/spring.ts`, held to the engine by
 * `simulate.test.ts`), pulled and twisted by a hand or let go by a button, the
 * bobbing's and the twist's energy shown as they trade, and the modes, the beat
 * and the share handed over read off the port: no route.
 */
export function SpringPage() {
  const { t } = useTranslation();
  const defaults = useExperimentsDefaults();
  const [build, setBuild] = useState<WilberforceSpring | null>(null);
  const held = useHeld();
  const s = build ?? defaults.data?.spring ?? null;
  useTakeCheckRequest("spring", s, (setting, current) => {
    const next = caseBuild(current, setting);
    if (!sameBuild(next, current)) setBuild(next);
  });
  return (
    <ExhibitFrame
      exhibit="spring"
      atTheExhibit={
        <>
          <p>{t("experiments.spring.at.weight")}</p>
          <p>{t("experiments.spring.at.trade")}</p>
          <p>{t("experiments.spring.at.nuts")}</p>
        </>
      }
      whatHappens={<SpringModel />}
      computed={<SpringComputed />}
      sweetSpot={<SpringTrick s={s} />}
    >
      {defaults.isPending || !s ? (
        <BuildPending pending={defaults.isPending} error={defaults.error} />
      ) : (
        <>
          <SpringPlay key={JSON.stringify(s)} s={s} held={held} />
          <SpringBuild s={s} onChange={setBuild} />
        </>
      )}
    </ExhibitFrame>
  );
}

/** Pulled down and let go, three times real time, for the overview. */
export function SpringPreview({ paused }: PreviewProps) {
  const defaults = useExperimentsDefaults();
  const s = defaults.data?.spring;
  return s ? <SpringPlay s={s} preview paused={paused} /> : <PreviewPending />;
}

/** The drawing's units are millimetres, y down from the ceiling; the spring
 *  itself is drawn shorter than its near two metres. */
const BOB_TOP_MM = 190;
const BOB_HALF_MM = 14;
const BOB_HEIGHT_MM = 50;
const ARM_MM = 44;
const ARM_AT_MM = BOB_TOP_MM + 18;
/** Millimetres of sideways drag to a radian of twist: the arm's end follows
 *  the finger. */
const DRAG_MM_PER_RAD = ARM_MM;

/**
 * The weight on its spring from the front: the coils stretch with `z` (down,
 * metres) and the four arms with their nuts turn with `theta`. With `onHold`,
 * a finger takes the weight: down and up pulls, sideways twists.
 */
export function SpringView({
  s,
  z,
  theta,
  onHold,
  onLetGo,
}: {
  s: WilberforceSpring;
  z: number;
  theta: number;
  onHold?: (z: number, theta: number) => void;
  onLetGo?: () => void;
}) {
  const { t } = useTranslation();
  const hue = useChartHue();
  const svg = useRef<SVGSVGElement>(null);
  const grip = useRef<{ x: number; y: number; z: number; theta: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const top = BOB_TOP_MM + z * 1000;
  // The coils: a zigzag of forty turns from the ceiling to the weight.
  const turns = 40;
  const coil = Array.from({ length: 2 * turns + 1 }, (_, i) => {
    const y = 12 + ((top - 12) * i) / (2 * turns);
    const x = i === 0 || i === 2 * turns ? 0 : i % 2 ? 9 : -9;
    return `${x},${y}`;
  }).join(" ");
  const armY = ARM_AT_MM + z * 1000;
  const nut = s.nut_radius_m * 1000;
  // Four arms, a quarter turn apart; those behind are drawn first and faint.
  const arms = [0, 1, 2, 3]
    .map((k) => theta + (k * Math.PI) / 2)
    .map((phi) => ({ x: Math.sin(phi), front: Math.cos(phi) >= 0 }))
    .sort((a, b) => Number(a.front) - Number(b.front));
  const follow = (clientX: number, clientY: number) => {
    const g = grip.current;
    const point = svg.current ? svgPoint(svg.current, clientX, clientY) : null;
    if (!g || !point || !onHold) return;
    const pull = Math.max(-MAX_PULL_M, Math.min(MAX_PULL_M, g.z + (point[1] - g.y) / 1000));
    const twist = Math.max(-MAX_TWIST_RAD, Math.min(MAX_TWIST_RAD, g.theta + (point[0] - g.x) / DRAG_MM_PER_RAD));
    onHold(pull, twist);
  };
  const take = (e: PointerEvent<SVGRectElement>) => {
    const point = svg.current ? svgPoint(svg.current, e.clientX, e.clientY) : null;
    if (!point) return;
    svg.current?.setPointerCapture?.(e.pointerId);
    grip.current = { x: point[0], y: point[1], z, theta };
    setDragging(true);
    onHold?.(z, theta);
  };
  const release = () => {
    if (!grip.current) return;
    grip.current = null;
    setDragging(false);
    onLetGo?.();
  };
  const body = hue(BOB_HUE);
  return (
    <svg
      ref={svg}
      viewBox="-80 0 160 300"
      role="img"
      aria-label={t("experiments.spring.view")}
      className={`${STAGE.wide} ${VIEW_FRAME} ${onHold ? "select-none" : ""}`}
      onPointerMove={(e) => {
        if (grip.current) follow(e.clientX, e.clientY);
      }}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <line x1={-50} y1={6} x2={50} y2={6} stroke="currentColor" strokeWidth={4} vectorEffect="non-scaling-stroke" />
      <line x1={0} y1={6} x2={0} y2={12} stroke="currentColor" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <polyline points={coil} fill="none" stroke="currentColor" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
      {/* Where the weight's foot hangs at rest. */}
      <line
        x1={-70}
        y1={BOB_TOP_MM + BOB_HEIGHT_MM}
        x2={70}
        y2={BOB_TOP_MM + BOB_HEIGHT_MM}
        stroke="currentColor"
        strokeDasharray="4 3"
        opacity={0.6}
        vectorEffect="non-scaling-stroke"
      />
      {arms
        .filter((arm) => !arm.front)
        .map((arm, i) => (
          <g key={`back-${i}`} opacity={0.45}>
            <line
              x1={0}
              y1={armY}
              x2={ARM_MM * arm.x}
              y2={armY}
              stroke="currentColor"
              strokeWidth={2.5}
              vectorEffect="non-scaling-stroke"
            />
            <rect x={nut * arm.x - 4} y={armY - 6} width={8} height={12} rx={2} fill={hue(TWIST_HUE)} />
          </g>
        ))}
      <rect
        x={-BOB_HALF_MM}
        y={top}
        width={2 * BOB_HALF_MM}
        height={BOB_HEIGHT_MM}
        rx={3}
        fill={body}
        stroke="currentColor"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      {/* A stripe on the body, so its twist shows on its face. */}
      {Math.cos(theta) > 0 && (
        <line
          x1={BOB_HALF_MM * Math.sin(theta)}
          y1={top + 3}
          x2={BOB_HALF_MM * Math.sin(theta)}
          y2={top + BOB_HEIGHT_MM - 3}
          stroke="currentColor"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {arms
        .filter((arm) => arm.front)
        .map((arm, i) => (
          <g key={`front-${i}`}>
            <line
              x1={BOB_HALF_MM * arm.x}
              y1={armY}
              x2={ARM_MM * arm.x}
              y2={armY}
              stroke="currentColor"
              strokeWidth={2.5}
              vectorEffect="non-scaling-stroke"
            />
            <rect x={nut * arm.x - 4} y={armY - 6} width={8} height={12} rx={2} fill={hue(TWIST_HUE)} />
          </g>
        ))}
      {onHold && (
        // The hold: the weight and its arms, and a margin round them, unseen.
        <rect
          x={-ARM_MM - 10}
          y={top - 15}
          width={2 * ARM_MM + 20}
          height={BOB_HEIGHT_MM + 30}
          fill="transparent"
          className={dragging ? "cursor-grabbing" : "cursor-grab"}
          ref={holdTouch}
          onPointerDown={take}
        />
      )}
    </svg>
  );
}

function SpringPlay({ s, held, preview = false, paused = false }: { s: WilberforceSpring; held?: Held } & PreviewMode) {
  const { t } = useTranslation();
  const hue = useChartHue();
  const first = useMemo(() => startState(s, "down"), [s]);
  const sim = useRef({ y: first, clock: 0, owed: 0 });
  const { running, setRunning } = useRunning({ preview, paused });
  const [speedHere, setSpeed] = useState<Speed>(1);
  const [start, setStart] = useState<Start | null>("down");
  const [from, setFrom] = useState<number[]>(first);
  const [y, setY] = useState<number[]>(first);
  const [holding, setHolding] = useState(false);
  const speed = preview ? 3 : speedHere;
  const show = held?.show;

  const f = useMemo(() => rhs(s), [s]);
  // Half a beat: a pull has gone over into the twist once, and how long that
  // takes is the page's question.
  const over = useMemo(() => {
    const beat = beatS(s);
    return beat === null ? null : beat / 2;
  }, [s]);

  useFrameLoop(running && !holding, (dt) => {
    const state = sim.current;
    state.owed += (dt * speed) / STEP_S;
    const steps = Math.floor(state.owed);
    state.owed -= steps;
    for (let k = 0; k < steps; k++) {
      state.y = rk4(f, state.clock, state.y, STEP_S);
      state.clock += STEP_S;
    }
    setY(state.y);
    if (over !== null && start === "down" && state.clock >= over) show?.();
  });

  const letGoFrom = (next: number[], how: Start | null) => {
    sim.current = { y: next, clock: 0, owed: 0 };
    setStart(how);
    setFrom(next);
    setY(next);
    setRunning(true);
  };
  const letGo = (how: Start) => letGoFrom(startState(s, how), how);
  useCheckSetting("spring", (setting) => {
    if (preview) return false;
    if (!sameBuild(caseBuild(s, setting), s)) return false;
    const how = STARTS.find((x) => x === setting.start);
    if (how) letGo(how);
    return true;
  });
  // The hand: held, the weight stands where the finger puts it, at rest.
  const hold = (pull: number, twist: number) => {
    setHolding(true);
    const next = [pull, twist, 0, 0];
    sim.current = { y: next, clock: 0, owed: 0 };
    setFrom(next);
    setY(next);
  };
  const release = () => {
    setHolding(false);
    letGoFrom(sim.current.y, null);
  };

  if (preview) return <SpringView s={s} z={y[0]} theta={y[1]} />;
  const [bob, twist] = energies(s, y);
  // Shares of everything put in, the coupling's at the start included: pulled
  // and twisted at once, the coupling holds some of it too.
  const total = energies(s, from).reduce((a, b) => a + b, 0);
  return (
    <WidgetCard
      title={t("experiments.spring.play.title")}
      hint={t("experiments.spring.play.hint")}
      actions={<RunPauseButton running={running} onToggle={() => setRunning(!running)} />}
    >
      <div className={`${SIDE.grid} ${SIDE.cap.md}`}>
        <div className={`${SIDE.top} space-y-2`}>
          <p className="text-sm text-secondary">{t("experiments.spring.play.let_go")}</p>
          <div className="flex flex-wrap gap-2">
            {STARTS.map((how) => (
              <Button key={how} variant={start === how ? "accent" : "secondary"} size="sm" onClick={() => letGo(how)}>
                {t(`experiments.spring.play.starts.${how}`)}
              </Button>
            ))}
          </div>
        </div>
        <div className={`${SIDE.views} mx-auto w-full max-w-md`}>
          <SpringView s={s} z={y[0]} theta={y[1]} onHold={hold} onLetGo={release} />
        </div>
        <div className={SIDE.column}>
          <SpeedToggle speeds={SPEEDS} value={speed} onChange={setSpeed} />
          <div className="space-y-2" aria-label={t("experiments.spring.play.energy")} role="group">
            {[
              [t("experiments.spring.play.bobbing"), bob, BOB_HUE],
              [t("experiments.spring.play.twisting"), twist, TWIST_HUE],
            ].map(([label, energy, index]) => (
              <div key={label as string} className="space-y-1">
                <div className="flex justify-between text-sm text-secondary">
                  <span>{label as string}</span>
                  <span>{Math.round(percent(energy as number, total))} %</span>
                </div>
                <div className="h-2 rounded-full bg-surface-2">
                  <div
                    className="h-2 rounded-full"
                    style={{
                      width: `${Math.min(100, percent(energy as number, total))}%`,
                      background: hue(index as number),
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <SpringFigures s={s} held={!held?.shown} />
          {held && <HeldAnswer held={held}>{null}</HeldAnswer>}
        </div>
      </div>
    </WidgetCard>
  );
}

/** `held`: the beat and the share handed over answer the page's question;
 *  the two periods alone and where the nuts tune it lead to it. */
function SpringFigures({ s, held }: { s: WilberforceSpring; held: boolean }) {
  const { t } = useTranslation();
  const [wz, wt] = aloneRates(s);
  const beat = beatS(s);
  const tuned = tunedRadiusM(s);
  return (
    <Figures
      tiles={[
        {
          key: "bobbing",
          label: t("experiments.spring.figures.bobbing"),
          value: (2 * Math.PI) / wz,
          digits: 3,
          unit: "s",
        },
        {
          key: "twisting",
          label: t("experiments.spring.figures.twisting"),
          value: (2 * Math.PI) / wt,
          digits: 3,
          unit: "s",
        },
        ...(tuned === null
          ? []
          : [
              {
                key: "tuned",
                label: t("experiments.spring.figures.tuned"),
                value: tuned * 1000,
                digits: 1,
                unit: "mm",
              },
            ]),
        ...(beat === null
          ? []
          : [{ key: "beat", label: t("experiments.spring.figures.beat"), value: beat, digits: 1, unit: "s", held }]),
        {
          key: "share",
          label: t("experiments.spring.figures.share"),
          value: exchangeShare(s) * 100,
          digits: 0,
          unit: "%",
          held,
        },
      ]}
    />
  );
}

function SpringBuild({ s, onChange }: { s: WilberforceSpring; onChange: (next: WilberforceSpring) => void }) {
  const { t } = useTranslation();
  return (
    <WidgetCard title={t("experiments.spring.change.title")} hint={t("experiments.spring.change.hint")}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SliderField
          label={t("experiments.spring.change.nuts")}
          unit="mm"
          value={s.nut_radius_m * 1000}
          min={NUT_MIN_MM}
          max={NUT_MAX_MM}
          step={0.5}
          digits={1}
          hint={t("experiments.spring.change.nuts_hint")}
          onChange={(x) => onChange({ ...s, nut_radius_m: x / 1000 })}
        />
        <SliderField
          label={t("experiments.spring.change.damping")}
          unit="1/s"
          value={s.damping_per_s}
          min={0}
          max={0.2}
          step={0.01}
          digits={2}
          onChange={(x) => onChange({ ...s, damping_per_s: x })}
        />
      </div>
    </WidgetCard>
  );
}

function SpringModel() {
  const { t } = useTranslation();
  const s = (key: string) => t(`experiments.spring.symbols.${key}`);
  return (
    <>
      <p>{t("experiments.spring.model.intro")}</p>
      <Equation
        tex={String.raw`m\,\ddot z = -k\,z - \tfrac12\,\varepsilon\,\theta, \qquad I\,\ddot\theta = -\delta\,\theta - \tfrac12\,\varepsilon\,z`}
        reads={t("experiments.spring.model.equation")}
        symbols={[
          { tex: "z", meaning: s("z"), unit: "m" },
          { tex: String.raw`\theta`, meaning: s("theta"), unit: "rad" },
          { tex: "m", meaning: s("m"), unit: "kg" },
          { tex: "I", meaning: s("I"), unit: "kg·m²" },
          { tex: "k", meaning: s("k"), unit: "N/m" },
          { tex: String.raw`\delta`, meaning: s("delta"), unit: "N·m" },
          { tex: String.raw`\varepsilon`, meaning: s("epsilon"), unit: "N" },
        ]}
      />
      <Equation
        tex={String.raw`I = I_0 + 4\,m_n\,r^2`}
        reads={t("experiments.spring.model.inertia")}
        symbols={[
          { tex: "I_0", meaning: s("I0"), unit: "kg·m²" },
          { tex: "m_n", meaning: s("mn"), unit: "kg" },
          { tex: "r", meaning: s("r"), unit: "m" },
        ]}
      />
      <Equation
        tex={String.raw`\omega_{1,2}^2 = \tfrac12\Bigl(\omega_\theta^2 + \omega_z^2 \pm \sqrt{(\omega_\theta^2 - \omega_z^2)^2 + \varepsilon^2/(m I)}\Bigr), \qquad \omega_z^2 = \frac{k}{m}, \quad \omega_\theta^2 = \frac{\delta}{I}`}
        reads={t("experiments.spring.model.modes")}
        symbols={[
          { tex: String.raw`\omega_1, \omega_2`, meaning: s("omega"), unit: "1/s" },
          { tex: String.raw`\omega_z, \omega_\theta`, meaning: s("alone"), unit: "1/s" },
        ]}
      />
      <Equation
        tex={String.raw`T_{\text{beat}} = \frac{2\pi}{\omega_1 - \omega_2}`}
        reads={t("experiments.spring.model.beat")}
        symbols={[{ tex: String.raw`T_{\text{beat}}`, meaning: s("beat"), unit: "s" }]}
      />
    </>
  );
}

/** The share a pull hands to the twist, for the nuts along the arm. */
function shareAlongTheArm(s: WilberforceSpring) {
  const rows = [];
  for (let mm = NUT_MIN_MM; mm <= NUT_MAX_MM; mm += 0.5) {
    rows.push({ r: mm, share: 100 * exchangeShare({ ...s, nut_radius_m: mm / 1000 }) });
  }
  return rows;
}

function SpringTrick({ s }: { s: WilberforceSpring | null }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hue = useChartHue();
  const rows = useMemo(() => {
    if (!s) return [];
    const beat = beatS(s) ?? 30;
    const r = run(s, 0.02, 0, Math.min(2 * beat, 120), 0.002);
    const total = r.bob_j[0] + r.twist_j[0] + r.coupling_j[0];
    return r.t.flatMap((time, i) =>
      i % 5 === 0 ? [{ t: time, bob: (100 * r.bob_j[i]) / total, twist: (100 * r.twist_j[i]) / total }] : [],
    );
  }, [s]);
  const along = useMemo(() => (s ? shareAlongTheArm(s) : []), [s]);
  if (!s) return <LoadingState className="py-6" label={t("common.loading")} />;
  const beat = beatS(s);
  const tuned = tunedRadiusM(s);
  return (
    <>
      <p>{t("experiments.spring.sweet.modes")}</p>
      <SeriesChart
        rows={rows}
        series={[
          { key: "bob", label: t("experiments.spring.play.bobbing"), color: hue(BOB_HUE) },
          { key: "twist", label: t("experiments.spring.play.twisting"), color: hue(TWIST_HUE) },
        ]}
        axes={[
          {
            id: "y",
            title: `${t("experiments.spring.chart.energy")} (%)`,
            format: (v) => formatNumber(v, 0, locale),
            includeZero: true,
          },
        ]}
        x={{
          key: "t",
          title: `${t("experiments.spring.chart.time")} (s)`,
          format: (v) => formatNumber(v, 0, locale),
        }}
      />
      {beat !== null && (
        <p>
          {t("experiments.spring.sweet.beat", {
            beat: formatNumber(beat, 1, locale),
            share: formatNumber(exchangeShare(s) * 100, 0, locale),
            r: formatNumber(s.nut_radius_m * 1000, 1, locale),
          })}
        </p>
      )}
      <Equation
        tex={String.raw`\text{share} = \frac{4c^2}{(\omega_z^2 - \omega_\theta^2)^2 + 4c^2}, \qquad c = \frac{\varepsilon}{2\sqrt{m I}}`}
        reads={t("experiments.spring.sweet.detuned")}
        symbols={[{ tex: "c", meaning: t("experiments.spring.symbols.c"), unit: "1/s²" }]}
      />
      <SeriesChart
        rows={along}
        series={[{ key: "share", label: t("experiments.spring.chart.share"), color: hue(TWIST_HUE) }]}
        axes={[
          {
            id: "y",
            title: `${t("experiments.spring.chart.share")} (%)`,
            format: (v) => formatNumber(v, 0, locale),
            includeZero: true,
          },
        ]}
        x={{
          key: "r",
          title: `${t("experiments.spring.chart.nuts")} (mm)`,
          format: (v) => formatNumber(v, 0, locale),
        }}
      />
      {tuned !== null && <p>{t("experiments.spring.sweet.tuned", { tuned: formatNumber(tuned * 1000, 1, locale) })}</p>}
    </>
  );
}

/** How the engine computes the weight: four first-order equations, stepped together. */
function SpringComputed() {
  const { t } = useTranslation();
  return (
    <Equation
      tex={String.raw`\frac{d}{dt}\begin{pmatrix}z\\ \theta\\ \dot z\\ \dot\theta\end{pmatrix} = \begin{pmatrix}\dot z\\ \dot\theta\\ -(k z + \tfrac12\varepsilon\theta)/m\\ -(\delta\theta + \tfrac12\varepsilon z)/I\end{pmatrix}`}
      reads={t("experiments.spring.computed.system")}
      symbols={[]}
    />
  );
}
