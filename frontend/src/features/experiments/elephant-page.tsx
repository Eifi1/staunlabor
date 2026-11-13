import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, Pause, Play, RotateCcw } from "lucide-react";
import {
  AlertBanner,
  Button,
  Chip,
  LoadingState,
  StaticLegend,
  Switch,
  seriesLegendEntries,
  useDebounce,
} from "@eifi1/ui-kit";
import { apiErrorMessage } from "@/shared/api/client";
import { SeriesChart } from "@/shared/charts/series-chart";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber } from "@/shared/lib/format";
import { useChartHex } from "@/shared/state/palette-store";
import type { ElephantFigures, ElephantRequest } from "@/shared/types";
import { SliderField } from "@/shared/ui/slider-field";
import { Figures, WidgetCard } from "@/shared/ui/widget";
import { ElephantView, JET_DRAWN_M, type Streak } from "./elephant-view";
import { Equation } from "./equation";
import { ExhibitFrame } from "./exhibit-frame";
import {
  STEP_S,
  airSpeed,
  axes,
  cover,
  displacedKg,
  fallen,
  jetCoordinates,
  startState,
  step,
  width,
  type State,
  run,
} from "./simulate/elephant";
import { PreviewPending, type PreviewMode, type PreviewProps } from "./preview-mode";
import { STAGE } from "./stage";
import { useElephantFigures, useExperimentsDefaults } from "./use-experiments";

/** A push across: the ball given this speed sideways, about what a flick of a finger gives. */
const PUSH_M_S = 0.8;
/** The auto mode tilts the trunk this many degrees a second, and waits this long once the ball is down. */
const AUTO_DEG_PER_S = 3;
const AUTO_PAUSE_S = 1.5;
/** How long the rise from the trunk is drawn, seconds: long enough for the bob to die away. */
const RISE_S = 8;
/** The steepest the page's slider tilts the trunk. */
const MAX_TILT = 60;
/** How fast the trunk turns to the tilt the reader sets, degrees a second: a
 *  trunk turned by hand, not one that jumps. A jump of 30° swings the jet out
 *  from under the ball in no time, and it falls — true, and not the exhibit. */
const TURN_DEG_PER_S = 15;
/** The air in the drawing moves at the jet's speed times this, so an eye can follow it. */
const SLOW = 0.06;
const STREAKS = 70;
/** Where the floor is, metres below the opening, as the drawing has it. */
const FLOOR_M = -0.55;

interface Sim {
  state: State;
  tilt: number;
  /** Seconds since the ball fell, while it lies on the floor in the auto mode. */
  down: number | null;
  streaks: { s: number; q: number }[];
}

interface View {
  ball: [number, number];
  s: number;
  e: number;
  air: number;
  tilt: number;
  status: "resting" | "floating" | "fallen";
  streaks: Streak[];
}

const freshStreaks = () =>
  Array.from({ length: STREAKS }, () => ({ s: Math.random() * JET_DRAWN_M, q: Math.random() * 2 - 1 }));

/**
 * The Bernoulli elephant (`experiments.elephant`): a ball floating on the air
 * an elephant blows up through its trunk. The ball's flight is the engine's,
 * stepped in the browser every frame (`simulate/elephant.ts`, held by
 * `simulate.test.ts`), with the air, the tilt and the pushes the reader sets;
 * the float height, the curves and the tilt it falls at are the server's.
 */
export function ElephantPage() {
  const { t } = useTranslation();
  const defaults = useExperimentsDefaults();
  const [build, setBuild] = useState<ElephantRequest | null>(null);
  const exhibit = build ?? defaults.data?.elephant ?? null;
  const figures = useElephantFigures(exhibit);

  return (
    <ExhibitFrame
      exhibit="elephant"
      atTheExhibit={
        <>
          <p>{t("experiments.elephant.at.blow")}</p>
          <p>{t("experiments.elephant.at.float")}</p>
        </>
      }
      whatHappens={<ElephantModel />}
      computed={<ElephantComputed />}
      sweetSpot={<ElephantTrick figures={figures.data ?? null} exhibit={exhibit} />}
    >
      {defaults.isPending ? (
        <LoadingState className="py-10" label={t("common.loading")} />
      ) : !exhibit ? (
        <AlertBanner tone="danger">{apiErrorMessage(defaults.error, t("experiments.failed"))}</AlertBanner>
      ) : (
        <>
          <ElephantPlay exhibit={exhibit} onChange={setBuild} limit={figures.data?.tilt_limit_deg ?? null} />
          <ElephantBuild exhibit={exhibit} onChange={setBuild} />
        </>
      )}
    </ExhibitFrame>
  );
}

/** The exhibit's auto mode alone, for the overview's previews
 *  (`preview-mode.tsx`): the jet tilted slowly until the ball falls, and set
 *  on the trunk again. */
export function ElephantPreview({ paused }: PreviewProps) {
  const defaults = useExperimentsDefaults();
  const exhibit = defaults.data?.elephant;
  return exhibit ? (
    <ElephantPlay exhibit={exhibit} onChange={() => {}} limit={null} preview paused={paused} />
  ) : (
    <PreviewPending />
  );
}

function ElephantPlay({
  exhibit,
  onChange,
  limit,
  preview = false,
  paused = false,
}: {
  exhibit: ElephantRequest;
  onChange: (next: ElephantRequest) => void;
  limit: number | null;
} & PreviewMode) {
  const { t } = useTranslation();
  const locale = useLocale();
  const [tilt, setTilt] = useState(0);
  const [auto, setAuto] = useState(preview);
  const [runningHere, setRunning] = useState(true);
  const running = preview ? !paused : runningHere;
  // The ball set on the trunk, once: a state's initialiser, so the render never
  // reads the ref the loop then steps.
  const [initial] = useState<Sim>(() => ({
    state: startState(exhibit),
    tilt: 0,
    down: null,
    streaks: freshStreaks(),
  }));
  const sim = useRef<Sim>(initial);
  const [view, setView] = useState<View>(() => viewOf(exhibit, initial));
  // The latest build and tilt, read by the loop without restarting it: a change
  // acts on the ball in the air rather than setting it back on the trunk.
  const latest = useRef({ exhibit, tilt, auto });
  useEffect(() => {
    latest.current = { exhibit, tilt, auto };
  }, [exhibit, tilt, auto]);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const current = sim.current;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const { exhibit: el, auto: autoOn } = latest.current;
      if (autoOn) {
        if (current.down !== null) {
          current.down += dt;
          if (current.down > AUTO_PAUSE_S) {
            current.tilt = 0;
            current.state = startState(el);
            current.down = null;
          }
        } else current.tilt = Math.min(MAX_TILT, current.tilt + AUTO_DEG_PER_S * dt);
      } else {
        const target = latest.current.tilt;
        const turn = TURN_DEG_PER_S * dt;
        current.tilt = Math.max(current.tilt - turn, Math.min(current.tilt + turn, target));
      }
      const steps = Math.round(dt / STEP_S);
      for (let k = 0; k < steps; k += 1) {
        if (current.down === null && fallen(el, current.state)) current.down = 0;
        current.state = current.down === null ? step(el, current.tilt, current.state) : drop(el, current.state);
      }
      moveStreaks(el, current, dt);
      setView(viewOf(el, current));
      if (autoOn) setTilt(Math.round(current.tilt));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  const push = (sign: 1 | -1) => {
    if (sim.current.down !== null) return;
    const [x, y, vx, vy] = sim.current.state;
    sim.current.state = [x, y, vx + sign * PUSH_M_S, vy];
  };
  const restart = () => {
    sim.current.state = startState(exhibit, tilt);
    sim.current.down = null;
    sim.current.tilt = tilt;
    setView(viewOf(exhibit, sim.current));
  };
  const flow = exhibit.jet.speed_m_s * Math.PI * (exhibit.jet.opening_m ** 2 / 4) * 3600;

  if (preview) return <ElephantView elephant={exhibit} tiltDeg={view.tilt} ball={view.ball} streaks={view.streaks} />;
  return (
    <WidgetCard
      title={t("experiments.elephant.play.title")}
      hint={t(auto ? "experiments.elephant.play.hint_auto" : "experiments.elephant.play.hint")}
      actions={
        <>
          <Button variant="secondary" size="sm" onClick={() => setRunning(!running)}>
            {running ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
            {running ? t("experiments.elephant.play.pause") : t("experiments.elephant.play.run")}
          </Button>
          <Button variant="secondary" size="sm" onClick={restart}>
            <RotateCcw className="size-4" aria-hidden />
            {t("experiments.elephant.play.restart")}
          </Button>
        </>
      }
    >
      <div className={`grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_18rem] ${STAGE.withSide}`}>
        <ElephantView elephant={exhibit} tiltDeg={view.tilt} ball={view.ball} streaks={view.streaks} />
        <div className="space-y-4">
          <SliderField
            label={t("experiments.elephant.play.air")}
            unit="m/s"
            value={exhibit.jet.speed_m_s}
            min={5}
            max={25}
            step={0.5}
            digits={1}
            hint={t("experiments.elephant.play.air_hint", { flow: formatNumber(flow, 0, locale) })}
            onChange={(v) => onChange({ ...exhibit, jet: { ...exhibit.jet, speed_m_s: v } })}
          />
          <SliderField
            label={t("experiments.elephant.play.tilt")}
            unit="°"
            value={tilt}
            min={0}
            max={MAX_TILT}
            step={1}
            digits={0}
            hint={t("experiments.elephant.play.tilt_hint")}
            onChange={(v) => {
              setAuto(false);
              setTilt(v);
            }}
          />
          <Switch
            label={t("experiments.elephant.play.auto")}
            description={t("experiments.elephant.play.auto_hint", { rate: formatNumber(AUTO_DEG_PER_S, 0, locale) })}
            checked={auto}
            onCheckedChange={(on) => {
              setAuto(on);
              if (on) {
                sim.current.tilt = 0;
                sim.current.state = startState(exhibit);
                sim.current.down = null;
              }
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => push(-1)} disabled={view.status === "fallen"}>
              <ArrowLeft className="size-4" aria-hidden />
              {t("experiments.elephant.play.push_left")}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => push(1)} disabled={view.status === "fallen"}>
              {t("experiments.elephant.play.push_right")}
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          </div>
          <Chip tone={view.status === "floating" ? "success" : view.status === "fallen" ? "danger" : "neutral"}>
            {t(`experiments.elephant.play.${view.status}`)}
          </Chip>
          <Figures
            tiles={[
              {
                key: "height",
                label: t("experiments.elephant.play.height"),
                value: view.status === "fallen" ? null : view.s * 100,
                digits: 0,
                unit: "cm",
              },
              {
                key: "air",
                label: t("experiments.elephant.play.air_at_ball"),
                value: view.status === "fallen" ? null : view.air,
                digits: 1,
                unit: "m/s",
              },
              {
                key: "off",
                label: t("experiments.elephant.play.off_axis"),
                value: view.status === "fallen" ? null : Math.abs(view.e) * 100,
                digits: 1,
                unit: "cm",
              },
              {
                key: "limit",
                label: t("experiments.elephant.play.falls_at"),
                value: limit,
                digits: 0,
                unit: "°",
              },
            ]}
          />
        </div>
      </div>
    </WidgetCard>
  );
}

/** Out of the jet, the ball falls to the floor and lies there: the drawing's
 *  end of a fall, which the engine's run stops before. */
function drop(el: ElephantRequest, state: State): State {
  const [x, y, vx, vy] = state;
  const floor = FLOOR_M + el.ball.diameter_m / 2;
  if (y <= floor) return [x, floor, 0, 0];
  const nvy = vy - 9.80665 * STEP_S;
  return [x + vx * STEP_S, Math.max(floor, y + nvy * STEP_S), vx * 0.999, nvy];
}

/** The air's streaks: each moves along the jet at the jet's speed where it is, slowed, and starts again at the trunk. */
function moveStreaks(el: ElephantRequest, sim: Sim, dt: number) {
  for (const st of sim.streaks) {
    const e = st.q * 1.4 * width(el.jet, st.s);
    st.s += airSpeed(el.jet, st.s, e) * dt * SLOW;
    if (st.s > JET_DRAWN_M) {
      st.s -= JET_DRAWN_M;
      st.q = Math.random() * 2 - 1;
    }
  }
}

function viewOf(el: ElephantRequest, sim: Sim): View {
  const [x, y] = sim.state;
  const [s, e] = jetCoordinates(sim.tilt, x, y);
  const [[ax, ay], [nx, ny]] = axes(sim.tilt);
  const resting = Math.abs(s - restOf(el)) < 1e-6 && sim.down === null;
  const u0 = Math.max(el.jet.speed_m_s, 1e-6);
  const streaks = sim.streaks.map(({ s: ss, q }) => {
    const ee = q * 1.4 * width(el.jet, ss);
    const len = (0.06 * airSpeed(el.jet, ss, ee)) / u0;
    return {
      x1: ss * ax + ee * nx,
      y1: ss * ay + ee * ny,
      x2: (ss + len) * ax + ee * nx,
      y2: (ss + len) * ay + ee * ny,
    };
  });
  return {
    ball: [x, y],
    s,
    e,
    air: Math.sqrt(cover(el, s, e).mean_square),
    tilt: sim.tilt,
    status: sim.down !== null ? "fallen" : resting ? "resting" : "floating",
    streaks,
  };
}

function restOf(el: ElephantRequest): number {
  const r = el.ball.diameter_m / 2;
  const half = el.jet.opening_m / 2;
  return Math.sqrt(r * r - half * half);
}

/** The lightest ball of a size the air does not lift on its own, in grams: a
 *  little more than the air it displaces. */
function lightest(diameterM: number): number {
  return Math.ceil(displacedKg({ diameter_m: diameterM, mass_kg: 1 }) * 1000 * 1.2) + 1;
}

function ElephantBuild({ exhibit, onChange }: { exhibit: ElephantRequest; onChange: (next: ElephantRequest) => void }) {
  const { t } = useTranslation();
  const { jet, ball } = exhibit;
  // Kept an exhibit at every step: the ball wider than the opening, heavier than its air.
  const withBall = (diameterM: number, massKg: number): ElephantRequest => {
    const diameter = Math.max(diameterM, jet.opening_m + 0.01);
    return { ...exhibit, ball: { diameter_m: diameter, mass_kg: Math.max(massKg, lightest(diameter) / 1000) } };
  };
  return (
    <WidgetCard title={t("experiments.elephant.change.title")} hint={t("experiments.elephant.change.hint")}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SliderField
          label={t("experiments.elephant.change.opening")}
          unit="cm"
          value={jet.opening_m * 100}
          min={4}
          max={15}
          step={0.5}
          digits={1}
          onChange={(v) => {
            const opening = v / 100;
            const next = { ...exhibit, jet: { ...jet, opening_m: opening } };
            const diameter = Math.max(ball.diameter_m, opening + 0.01);
            onChange({
              ...next,
              ball: { diameter_m: diameter, mass_kg: Math.max(ball.mass_kg, lightest(diameter) / 1000) },
            });
          }}
        />
        <SliderField
          label={t("experiments.elephant.change.diameter")}
          unit="cm"
          value={ball.diameter_m * 100}
          min={8}
          max={30}
          step={0.5}
          digits={1}
          onChange={(v) => onChange(withBall(v / 100, ball.mass_kg))}
        />
        <SliderField
          label={t("experiments.elephant.change.mass")}
          unit="g"
          value={ball.mass_kg * 1000}
          min={5}
          max={100}
          step={1}
          digits={0}
          onChange={(v) => onChange(withBall(ball.diameter_m, v / 1000))}
        />
        <SliderField
          label={t("experiments.elephant.change.coanda")}
          unit=""
          value={exhibit.coanda}
          min={0}
          max={2}
          step={0.1}
          digits={1}
          hint={t("experiments.elephant.change.coanda_hint")}
          onChange={(v) => onChange({ ...exhibit, coanda: v })}
        />
      </div>
    </WidgetCard>
  );
}

function ElephantModel() {
  const { t } = useTranslation();
  const s = (key: string) => t(`experiments.elephant.symbols.${key}`);
  return (
    <>
      <p>{t("experiments.elephant.model.intro")}</p>
      <Equation
        tex={String.raw`u(r, s) = u_c(s)\, e^{-r^2/b^2}, \qquad b = \frac{D}{\sqrt2} + k\, s, \qquad u_c = \frac{U_0\, D}{\sqrt2\, b}`}
        reads={t("experiments.elephant.model.jet")}
        symbols={[
          { tex: "u", meaning: s("u"), unit: "m/s" },
          { tex: "r", meaning: s("r"), unit: "m" },
          { tex: "s", meaning: s("s"), unit: "m" },
          { tex: "b", meaning: s("b"), unit: "m" },
          { tex: "u_c", meaning: s("uc"), unit: "m/s" },
          { tex: "U_0", meaning: s("u0"), unit: "m/s" },
          { tex: "D", meaning: s("d"), unit: "m" },
          { tex: "k", meaning: s("k") },
        ]}
      />
      <Equation
        tex={String.raw`\int \rho\, u^2\, dA = \rho\, U_0^2\, \frac{\pi D^2}{4}`}
        reads={t("experiments.elephant.model.momentum")}
        symbols={[{ tex: String.raw`\rho`, meaning: s("rho"), unit: "kg/m³" }]}
      />
      <Equation
        tex={String.raw`F = \tfrac12\, \rho\, C_d \int_{\text{ball}} u^2\, dA = \tfrac12\, \rho\, C_d\, A\, \bar u^2`}
        reads={t("experiments.elephant.model.lift")}
        symbols={[
          { tex: "F", meaning: s("f"), unit: "N" },
          { tex: "C_d", meaning: s("cd") },
          { tex: "A", meaning: s("area"), unit: "m²" },
          { tex: String.raw`\bar u`, meaning: s("mean"), unit: "m/s" },
        ]}
      />
      <Equation
        tex={String.raw`\left(m - \rho\, V\right) g`}
        reads={t("experiments.elephant.model.weight")}
        symbols={[
          { tex: "m", meaning: s("m"), unit: "kg" },
          { tex: "V", meaning: s("v"), unit: "m³" },
          { tex: "g", meaning: s("g"), unit: "m/s²" },
        ]}
      />
      <Equation
        tex={String.raw`F(s^*) = \left(m - \rho\, V\right) g`}
        reads={t("experiments.elephant.model.balance")}
        symbols={[]}
      />
      <Equation
        tex={String.raw`F_s = C_B\, \tfrac12\, \rho \int_{\text{ball}} u^2 \cos\varphi\; dA`}
        reads={t("experiments.elephant.model.side")}
        symbols={[
          { tex: "F_s", meaning: s("fs"), unit: "N" },
          { tex: "C_B", meaning: s("cb") },
          { tex: String.raw`\varphi`, meaning: s("phi"), unit: "rad" },
        ]}
      />
      <Equation
        tex={String.raw`F = \left(m - \rho V\right) g \cos\beta, \qquad F_s = \left(m - \rho V\right) g \sin\beta`}
        reads={t("experiments.elephant.model.tilt")}
        symbols={[{ tex: String.raw`\beta`, meaning: s("beta"), unit: "°" }]}
      />
    </>
  );
}

/** How the engine computes the ball's flight: one vector equation, four first-order ones. */
function ElephantComputed() {
  const { t } = useTranslation();
  const s = (key: string) => t(`experiments.elephant.symbols.${key}`);
  return (
    <Equation
      tex={String.raw`\left(m + \tfrac12 \rho V\right) \ddot{\mathbf p} = \tfrac12\, \rho\, C_d\, A\, |\mathbf w|\, \mathbf w + F_s\, \mathbf n - \left(m - \rho V\right) g\, \hat{\mathbf y}, \qquad \mathbf w = \bar u\, \mathbf a - \dot{\mathbf p}`}
      reads={t("experiments.elephant.computed.system")}
      symbols={[
        { tex: String.raw`m + \tfrac12 \rho V`, meaning: t("experiments.elephant.computed.inertia"), unit: "kg" },
        { tex: String.raw`\mathbf p`, meaning: s("p"), unit: "m" },
        { tex: String.raw`\mathbf w`, meaning: s("w"), unit: "m/s" },
        { tex: String.raw`\mathbf a`, meaning: s("a") },
        { tex: String.raw`\mathbf n`, meaning: s("n") },
        { tex: String.raw`\hat{\mathbf y}`, meaning: s("y") },
      ]}
    />
  );
}

function ElephantTrick({ figures, exhibit }: { figures: ElephantFigures | null; exhibit: ElephantRequest | null }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  const net = figures ? figures.weight_n - figures.buoyancy_n : 0;
  const liftRows = useMemo(
    () => (figures ? figures.lift_curve.map((p) => ({ h: p.height_m * 100, lift: p.lift_n, weight: net })) : []),
    [figures, net],
  );
  const sideRows = useMemo(
    () => (figures ? figures.side_curve.map((p) => ({ off: p.offset_m * 100, side: p.side_n })) : []),
    [figures],
  );
  const tiltRows = useMemo(
    () =>
      figures
        ? figures.tilt_curve.map((p) => ({ tilt: p.tilt_deg, sag: p.offset_m * 100, sink: p.height_m * 100 }))
        : [],
    [figures],
  );
  // The ball from the trunk, as the engine's run has it for the build on screen:
  // up, past its height, and back, the bob dying away. Once the sliders hold still.
  const settledBuild = useDebounce(exhibit, 300, { key: JSON.stringify(exhibit) });
  const riseRows = useMemo(() => {
    if (!settledBuild) return [];
    const r = run(settledBuild, [], RISE_S);
    const [[ax, ay]] = axes(0);
    return r.t.map((time, j) => ({ t: time, h: (r.x_m[j] * ax + r.y_m[j] * ay) * 100 }));
  }, [settledBuild]);
  if (!figures) return <LoadingState className="py-6" label={t("common.loading")} />;
  const n = (value: number, digits: number) => formatNumber(value, digits, locale);
  const strongest = figures.side_curve.reduce(
    (best, p) => (p.side_n > best.side_n ? p : best),
    figures.side_curve[0] ?? { offset_m: 0, side_n: 0, lift_n: 0 },
  );
  const force = `${t("experiments.elephant.chart.force")} (N)`;
  // Two lines in one plot each, so each says which is which beneath it.
  const liftSeries = [
    { key: "lift", label: t("experiments.elephant.chart.lift"), color: hex[2 % hex.length] },
    { key: "weight", label: t("experiments.elephant.chart.weight"), color: hex[6 % hex.length], dash: 1 },
  ];
  const tiltSeries = [
    { key: "sink", label: t("experiments.elephant.chart.sink"), color: hex[2 % hex.length] },
    { key: "sag", label: t("experiments.elephant.chart.sag"), color: hex[4 % hex.length], dash: 1 },
  ];
  return (
    <>
      {figures.float_height_m === null ? (
        <AlertBanner tone="info">
          {t("experiments.elephant.sweet.none", { speed: n(figures.lift_off_m_s, 1) })}
        </AlertBanner>
      ) : (
        <>
          <p>
            {t("experiments.elephant.sweet.height", {
              height: n(figures.float_height_m * 100, 0),
              bob: n(figures.bob_hz ?? 0, 1),
            })}
          </p>
          <SeriesChart
            rows={liftRows}
            series={liftSeries}
            axes={[{ id: "y", title: force, format: (v) => n(v, 2), includeZero: true }]}
            x={{ key: "h", title: `${t("experiments.elephant.chart.height")} (cm)`, format: (v) => n(v, 0) }}
          />
          <StaticLegend entries={seriesLegendEntries(liftSeries)} />
          <p>{t("experiments.elephant.sweet.middle", { offset: n(strongest.offset_m * 100, 0) })}</p>
          <SeriesChart
            rows={sideRows}
            series={[{ key: "side", label: t("experiments.elephant.chart.side"), color: hex[3 % hex.length] }]}
            axes={[{ id: "y", title: force, format: (v) => n(v, 2), includeZero: true }]}
            x={{ key: "off", title: `${t("experiments.elephant.chart.offset")} (cm)`, format: (v) => n(v, 0) }}
          />
          <p>{t("experiments.elephant.sweet.rise")}</p>
          <SeriesChart
            rows={riseRows}
            series={[{ key: "h", label: t("experiments.elephant.chart.height"), color: hex[2 % hex.length] }]}
            axes={[{ id: "y", title: `${t("experiments.elephant.chart.height")} (cm)`, format: (v) => n(v, 0) }]}
            x={{ key: "t", title: `${t("experiments.elephant.chart.time")} (s)`, format: (v) => n(v, 0) }}
          />
          {figures.tilt_limit_deg !== null && (
            <p>{t("experiments.elephant.sweet.tilt", { limit: n(figures.tilt_limit_deg, 0) })}</p>
          )}
          <SeriesChart
            rows={tiltRows}
            series={tiltSeries}
            axes={[{ id: "y", title: "cm", format: (v) => n(v, 0), includeZero: true }]}
            x={{ key: "tilt", title: `${t("experiments.elephant.chart.tilt")} (°)`, format: (v) => n(v, 0) }}
          />
          <StaticLegend entries={seriesLegendEntries(tiltSeries)} />
        </>
      )}
      <p>{t("experiments.elephant.sweet.lift_off", { speed: n(figures.lift_off_m_s, 1) })}</p>
      <p>{t("experiments.elephant.sweet.buoyancy", { share: n((100 * figures.buoyancy_n) / figures.weight_n, 0) })}</p>
      <Figures
        tiles={[
          {
            key: "height",
            label: t("experiments.elephant.figures.height"),
            value: figures.float_height_m === null ? null : figures.float_height_m * 100,
            digits: 0,
            unit: "cm",
          },
          {
            key: "lift_off",
            label: t("experiments.elephant.figures.lift_off"),
            value: figures.lift_off_m_s,
            digits: 1,
            unit: "m/s",
          },
          { key: "air", label: t("experiments.elephant.figures.air"), value: figures.air_m_s, digits: 1, unit: "m/s" },
          {
            key: "limit",
            label: t("experiments.elephant.figures.limit"),
            value: figures.tilt_limit_deg,
            digits: 0,
            unit: "°",
          },
          { key: "bob", label: t("experiments.elephant.figures.bob"), value: figures.bob_hz, digits: 2, unit: "Hz" },
          {
            key: "flow",
            label: t("experiments.elephant.figures.flow"),
            value: figures.flow_m3_s * 3600,
            digits: 0,
            unit: "m³/h",
          },
        ]}
      />
      <p className="text-caption text-muted">{t("experiments.elephant.sweet.assumed")}</p>
    </>
  );
}
