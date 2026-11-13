import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { Hand, Pause, Play, RotateCcw } from "lucide-react";
import { AlertBanner, Button, Chip, LoadingState, StaticLegend, Switch, seriesLegendEntries } from "@eifi1/ui-kit";
import { apiErrorMessage } from "@/shared/api/client";
import { SeriesChart } from "@/shared/charts/series-chart";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber } from "@/shared/lib/format";
import { useChartHex } from "@/shared/state/palette-store";
import type { SmokeExhibitRequest, SmokeFigures } from "@/shared/types";
import { SliderField } from "@/shared/ui/slider-field";
import { Figures, WidgetCard } from "@/shared/ui/widget";
import { Equation } from "./equation";
import { ExhibitFrame } from "./exhibit-frame";
import { CORE_SHARE, SAMPLES_PER_S, flight, pressDepth, ringOf, type Flight, type Ring } from "./simulate/smoke";
import { SmokeView, type Puff } from "./smoke-view";
import { PreviewPending, type PreviewMode, type PreviewProps } from "./preview-mode";
import { STAGE } from "./stage";
import { useExperimentsDefaults, useSmokeFigures } from "./use-experiments";

/** How long a ring's flight is drawn, seconds, and how many particles carry its smoke. */
const FLIGHT_S = 6;
const PUFFS = 140;
/** A drag of this many metres in the drawing presses the ring its full stroke. */
const DRAG_FOR_FULL_M = 0.45;
/** The skin springs back over this long once let go. */
const RETURN_S = 0.35;
/** The auto mode's three presses when the server has not yet said its window, seconds. */
const AUTO_FALLBACK: [number, number, number] = [0.1, 0.5, 2.0];
/** Between the auto mode's presses, seconds. */
const AUTO_GAP_S = 4;

interface Particle {
  side: 1 | -1;
  angle: number;
  /** Distance from its core, as a share of the core's radius; and a drift of its own. */
  reach: number;
  dx: number;
  dy: number;
}

interface Sim {
  /** The press being made: the samples so far, and whether a hand or the button makes it. */
  press: { times: number[]; depths: number[]; source: "drag" | "button"; duration: number; depth: number } | null;
  start: number;
  depth: number;
  /** Where the skin was when let go, and how long ago. */
  released: { from: number; age: number } | null;
  flying: { ring: Ring; flight: Flight; age: number } | null;
  particles: Particle[];
  /** The auto mode: which of its three presses is next, and when. */
  autoNext: number;
  autoAt: number;
}

interface View {
  depth: number;
  puffs: Puff[];
  ring: { x: number; z: number; radius: number } | null;
}

const freshParticles = (): Particle[] =>
  Array.from({ length: PUFFS }, (_, i) => ({
    side: i % 2 === 0 ? 1 : -1,
    angle: Math.random() * 2 * Math.PI,
    reach: Math.sqrt(Math.random()),
    dx: Math.random() * 2 - 1,
    dy: Math.random() * 2 - 1,
  }));

/**
 * The smoke ring (`experiments.smoke`): press the skin of a drum full of smoke
 * and a ring flies out of its hole — or the smoke swirls apart, or drifts off.
 * The ring is the engine's, computed in the browser from the press as the page
 * samples it (`simulate/smoke.ts`, held by `simulate.test.ts`); the window, the
 * curves and the best press are the server's.
 */
export function SmokePage() {
  const { t } = useTranslation();
  const defaults = useExperimentsDefaults();
  const [build, setBuild] = useState<SmokeExhibitRequest | null>(null);
  const exhibit = build ?? defaults.data?.smoke ?? null;
  const figures = useSmokeFigures(exhibit);

  return (
    <ExhibitFrame
      exhibit="smoke"
      atTheExhibit={
        <>
          <p>{t("experiments.smoke.at.drum")}</p>
          <p>{t("experiments.smoke.at.press")}</p>
        </>
      }
      whatHappens={<SmokeModel />}
      computed={<SmokeComputed />}
      sweetSpot={<SmokeTrick figures={figures.data ?? null} exhibit={exhibit} />}
    >
      {defaults.isPending ? (
        <LoadingState className="py-10" label={t("common.loading")} />
      ) : !exhibit ? (
        <AlertBanner tone="danger">{apiErrorMessage(defaults.error, t("experiments.failed"))}</AlertBanner>
      ) : (
        <>
          <SmokePlay exhibit={exhibit} figures={figures.data ?? null} />
          <SmokeBuild exhibit={exhibit} onChange={setBuild} />
        </>
      )}
    </ExhibitFrame>
  );
}

/** One sample of a press, if its time has moved on: a frame can fall on the
 *  instant the press began, and two samples at one time are no pace at all
 *  (the engine refuses them). */
function record(press: { times: number[]; depths: number[] }, now: number, depth: number) {
  if (now > press.times[press.times.length - 1]) {
    press.times.push(now);
    press.depths.push(depth);
  }
}

/** The exhibit's auto mode alone, for the overview's previews
 *  (`preview-mode.tsx`): too fast, just right, too slow, over and over. */
export function SmokePreview({ paused }: PreviewProps) {
  const defaults = useExperimentsDefaults();
  const exhibit = defaults.data?.smoke ?? null;
  const figures = useSmokeFigures(exhibit);
  return exhibit ? (
    <SmokePlay exhibit={exhibit} figures={figures.data ?? null} preview paused={paused} />
  ) : (
    <PreviewPending />
  );
}

function SmokePlay({
  exhibit,
  figures,
  preview = false,
  paused = false,
}: { exhibit: SmokeExhibitRequest; figures: SmokeFigures | null } & PreviewMode) {
  const { t } = useTranslation();
  const locale = useLocale();
  const stroke = exhibit.drum.stroke_m;
  const [duration, setDuration] = useState(0.5);
  const [depth, setDepth] = useState(stroke);
  const [auto, setAuto] = useState(preview);
  const [runningHere, setRunning] = useState(true);
  const running = preview ? !paused : runningHere;
  const [ring, setRing] = useState<Ring | null>(null);
  const [initial] = useState<Sim>(() => ({
    press: null,
    start: 0,
    depth: 0,
    released: null,
    flying: null,
    particles: freshParticles(),
    autoNext: 0,
    autoAt: 0,
  }));
  const sim = useRef<Sim>(initial);
  const [view, setView] = useState<View>({ depth: 0, puffs: [], ring: null });
  const svg = useRef<SVGSVGElement | null>(null);
  const drag = useRef<{ y0: number } | null>(null);
  const autoPresses: [number, number, number] =
    figures?.fastest_s && figures.slowest_s && figures.best_s
      ? [figures.fastest_s / 2, figures.best_s, figures.slowest_s * 1.5]
      : AUTO_FALLBACK;
  const latest = useRef({ exhibit, auto, autoPresses });
  useEffect(() => {
    latest.current = { exhibit, auto, autoPresses };
  });

  /** Let go: the ring the press made, its flight, and the skin springing back. */
  const release = () => {
    const current = sim.current;
    const press = current.press;
    current.press = null;
    current.released = { from: current.depth, age: 0 };
    if (!press || press.times.length < 2) return;
    const times = press.times.map((x) => x - press.times[0]);
    const made = ringOf(latest.current.exhibit, times, press.depths);
    setRing(made);
    if (made.verdict === "none") return;
    current.flying = { ring: made, flight: flight(latest.current.exhibit, made, FLIGHT_S), age: 0 };
    current.particles = freshParticles();
  };

  const startPress = (source: "drag" | "button", now: number, pressDuration: number, pressDepth: number) => {
    const current = sim.current;
    current.press = { times: [now], depths: [current.depth], source, duration: pressDuration, depth: pressDepth };
    current.start = now;
    current.released = null;
  };

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now() / 1000;
    const tick = (ms: number) => {
      const now = ms / 1000;
      const dt = Math.min(0.05, now - last);
      last = now;
      const current = sim.current;
      const { auto: autoOn, autoPresses: presses, exhibit: ex } = latest.current;
      if (autoOn && !current.press && now >= current.autoAt) {
        const d = presses[current.autoNext % 3];
        startPress("button", now, d, ex.drum.stroke_m);
        current.autoNext += 1;
        current.autoAt = now + d + AUTO_GAP_S;
      }
      const press = current.press;
      if (press?.source === "button") {
        const into = now - current.start;
        current.depth = pressDepth(press.depth, press.duration, into);
        record(press, now, current.depth);
        if (into >= press.duration) release();
      } else if (press?.source === "drag") {
        record(press, now, current.depth);
      } else if (current.released) {
        current.released.age += dt;
        current.depth = current.released.from * Math.max(0, 1 - current.released.age / RETURN_S);
      }
      if (current.flying) current.flying.age += dt;
      setView(viewOf(current, dt));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  /** The pointer's height in the drawing, metres. */
  const pointerY = (event: ReactPointerEvent<SVGSVGElement>): number | null => {
    const el = svg.current;
    const matrix = el?.getScreenCTM?.();
    if (!el || !matrix) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return -point.y;
  };
  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    const y = pointerY(event);
    if (y === null || sim.current.press) return;
    setAuto(false);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drag.current = { y0: y };
    startPress("drag", performance.now() / 1000, 0, 0);
  };
  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!drag.current) return;
    const y = pointerY(event);
    if (y === null) return;
    sim.current.depth = Math.min(stroke, Math.max(0, ((drag.current.y0 - y) / DRAG_FOR_FULL_M) * stroke));
  };
  const onPointerUp = () => {
    if (!drag.current) return;
    drag.current = null;
    release();
  };

  const n = (value: number, digits: number) => formatNumber(value, digits, locale);
  const verdict = ring?.verdict ?? "none";
  if (preview) return <SmokeView drum={exhibit.drum} pressM={view.depth} puffs={view.puffs} ring={view.ring} />;
  return (
    <WidgetCard
      title={t("experiments.smoke.play.title")}
      hint={t(auto ? "experiments.smoke.play.hint_auto" : "experiments.smoke.play.hint")}
      actions={
        <>
          <Button variant="secondary" size="sm" onClick={() => setRunning(!running)}>
            {running ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
            {running ? t("experiments.smoke.play.pause") : t("experiments.smoke.play.run")}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              sim.current.flying = null;
              sim.current.press = null;
              sim.current.depth = 0;
              setRing(null);
            }}
          >
            <RotateCcw className="size-4" aria-hidden />
            {t("experiments.smoke.play.restart")}
          </Button>
        </>
      }
    >
      <div className={`grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_18rem] ${STAGE.withSide}`}>
        <SmokeView
          drum={exhibit.drum}
          pressM={view.depth}
          puffs={view.puffs}
          ring={view.ring}
          svgRef={svg}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        />
        <div className="space-y-4">
          <SliderField
            label={t("experiments.smoke.play.duration")}
            unit="s"
            value={duration}
            min={0.05}
            max={3}
            step={0.05}
            digits={2}
            onChange={setDuration}
          />
          <SliderField
            label={t("experiments.smoke.play.depth")}
            unit="cm"
            value={Math.min(depth, stroke) * 100}
            min={1}
            max={stroke * 100}
            step={0.5}
            digits={1}
            onChange={(v) => setDepth(v / 100)}
          />
          <Button
            variant="accent"
            size="sm"
            onClick={() => {
              if (sim.current.press) return;
              setAuto(false);
              startPress("button", performance.now() / 1000, duration, Math.min(depth, stroke));
            }}
          >
            <Hand className="size-4" aria-hidden />
            {t("experiments.smoke.play.press")}
          </Button>
          <p className="text-caption text-muted">{t("experiments.smoke.play.drag")}</p>
          <Switch
            label={t("experiments.smoke.play.auto")}
            description={t("experiments.smoke.play.auto_hint", {
              fast: n(autoPresses[0], 2),
              best: n(autoPresses[1], 2),
              slow: n(autoPresses[2], 1),
            })}
            checked={auto}
            onCheckedChange={(on) => {
              setAuto(on);
              sim.current.autoAt = 0;
              sim.current.autoNext = 0;
            }}
          />
          <Chip tone={verdict === "ring" ? "success" : verdict === "none" ? "neutral" : "danger"}>
            {t(`experiments.smoke.play.verdict.${verdict}`)}
          </Chip>
          <Figures
            tiles={[
              {
                key: "last",
                label: t("experiments.smoke.play.last"),
                value: ring?.duration_s ?? null,
                digits: 2,
                unit: "s",
              },
              {
                key: "jet",
                label: t("experiments.smoke.play.jet"),
                value: ring?.peak_jet_m_s ?? null,
                digits: 1,
                unit: "m/s",
              },
              { key: "re", label: t("experiments.smoke.play.reynolds"), value: ring?.reynolds ?? null, digits: 0 },
              {
                key: "speed",
                label: t("experiments.smoke.play.speed"),
                value: ring?.speed_m_s ?? null,
                digits: 2,
                unit: "m/s",
              },
              {
                key: "force",
                label: t("experiments.smoke.play.force"),
                value: ring?.peak_force_n ?? null,
                digits: 0,
                unit: "N",
              },
            ]}
          />
        </div>
      </div>
    </WidgetCard>
  );
}

/** The smoke where the flight has it: a ring's two cores swirling, a turbulent
 *  ring's smoke spreading out of them, or a puff drifting off and thinning. */
function viewOf(current: Sim, dt: number): View {
  const flying = current.flying;
  if (!flying) return { depth: current.depth, puffs: [], ring: null };
  const { flight: f, ring, age } = flying;
  const i = Math.min(f.t.length - 1, Math.floor(age * SAMPLES_PER_S));
  const x = f.x_m[i];
  const z = f.z_m[i];
  const radius = f.radius_m[i];
  const core = CORE_SHARE * radius;
  const spin = (ring.speed_m_s / Math.max(core, 1e-3)) * 0.15;
  const fade = Math.max(0, 1 - age / FLIGHT_S);
  const puffs = current.particles.map((p) => {
    p.angle += spin * dt * (p.side === 1 ? -1 : 1);
    if (ring.verdict === "too_slow") {
      const spread = 0.06 + 0.25 * age;
      return {
        x: x + p.side * radius * 0.5 + p.dx * spread,
        y: z + p.dy * spread + 0.08 * age,
        opacity: 0.5 * Math.max(0, 1 - age / 2.5),
      };
    }
    const spread = ring.verdict === "too_fast" ? 0.35 * age : 0;
    return {
      x: x + p.side * radius + p.reach * core * Math.cos(p.angle) + p.dx * spread,
      y: z + p.reach * core * Math.sin(p.angle) + p.dy * spread,
      opacity: (ring.verdict === "too_fast" ? 0.6 * Math.max(0, 1 - age / 1.2) : 0.7) * fade,
    };
  });
  return {
    depth: current.depth,
    puffs,
    ring: ring.verdict === "ring" && age < FLIGHT_S ? { x, z, radius } : null,
  };
}

function SmokeBuild({
  exhibit,
  onChange,
}: {
  exhibit: SmokeExhibitRequest;
  onChange: (next: SmokeExhibitRequest) => void;
}) {
  const { t } = useTranslation();
  const { drum, room } = exhibit;
  // Kept a drum at every step: the hole inside the ring, the ring inside the drum.
  const withDrum = (next: Partial<SmokeExhibitRequest["drum"]>) => {
    const d = { ...drum, ...next };
    const ring = Math.min(Math.max(d.ring_m, d.hole_m + 0.02), d.diameter_m - 0.1);
    const hole = Math.min(d.hole_m, ring - 0.02);
    onChange({
      ...exhibit,
      drum: { ...d, ring_m: ring, hole_m: hole, stroke_m: Math.min(d.stroke_m, d.depth_m - 0.01) },
    });
  };
  return (
    <WidgetCard title={t("experiments.smoke.change.title")} hint={t("experiments.smoke.change.hint")}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SliderField
          label={t("experiments.smoke.change.diameter")}
          unit="m"
          value={drum.diameter_m}
          min={0.8}
          max={3}
          step={0.05}
          digits={2}
          onChange={(v) => withDrum({ diameter_m: v })}
        />
        <SliderField
          label={t("experiments.smoke.change.hole")}
          unit="cm"
          value={drum.hole_m * 100}
          min={8}
          max={50}
          step={1}
          digits={0}
          onChange={(v) => withDrum({ hole_m: v / 100, ring_m: Math.max(drum.ring_m, v / 100 + 0.1) })}
        />
        <SliderField
          label={t("experiments.smoke.change.ring")}
          unit="cm"
          value={drum.ring_m * 100}
          min={10}
          max={70}
          step={1}
          digits={0}
          onChange={(v) => withDrum({ ring_m: v / 100 })}
        />
        <SliderField
          label={t("experiments.smoke.change.stroke")}
          unit="cm"
          value={drum.stroke_m * 100}
          min={2}
          max={15}
          step={0.5}
          digits={1}
          onChange={(v) => withDrum({ stroke_m: v / 100 })}
        />
        <SliderField
          label={t("experiments.smoke.change.tension")}
          unit="N/m"
          value={drum.tension_n_m}
          min={0}
          max={600}
          step={10}
          digits={0}
          hint={t("experiments.smoke.change.tension_hint")}
          onChange={(v) => withDrum({ tension_n_m: v })}
        />
        <SliderField
          label={t("experiments.smoke.change.draught")}
          unit="m/s"
          value={room.draught_m_s}
          min={0}
          max={1.5}
          step={0.05}
          digits={2}
          hint={t("experiments.smoke.change.draught_hint")}
          onChange={(v) => onChange({ ...exhibit, room: { ...room, draught_m_s: v } })}
        />
        <SliderField
          label={t("experiments.smoke.change.turbulent")}
          unit=""
          value={room.turbulent_reynolds}
          min={2e4}
          max={1e6}
          step={1000}
          digits={0}
          log
          hint={t("experiments.smoke.change.turbulent_hint")}
          onChange={(v) => onChange({ ...exhibit, room: { ...room, turbulent_reynolds: v } })}
        />
      </div>
    </WidgetCard>
  );
}

function SmokeModel() {
  const { t } = useTranslation();
  const s = (key: string) => t(`experiments.smoke.symbols.${key}`);
  return (
    <>
      <p>{t("experiments.smoke.model.intro")}</p>
      <Equation
        tex={String.raw`V = A_{\text{eff}}\, x, \qquad A_{\text{eff}} = 2\pi\left(\frac{R^2 - a^2}{4\ln(R/a)} - \frac{a^2}{2}\right) + \pi\left(a^2 - r_h^2\right)`}
        reads={t("experiments.smoke.model.area")}
        symbols={[
          { tex: "V", meaning: s("v"), unit: "m³" },
          { tex: "x", meaning: s("x"), unit: "m" },
          { tex: String.raw`A_{\text{eff}}`, meaning: s("aeff"), unit: "m²" },
          { tex: "R", meaning: s("rbig"), unit: "m" },
          { tex: "a", meaning: s("a"), unit: "m" },
          { tex: "r_h", meaning: s("rh"), unit: "m" },
        ]}
      />
      <Equation
        tex={String.raw`u = \frac{A_{\text{eff}}}{A_h}\, \dot x`}
        reads={t("experiments.smoke.model.jet")}
        symbols={[
          { tex: "u", meaning: s("u"), unit: "m/s" },
          { tex: "A_h", meaning: s("ah"), unit: "m²" },
        ]}
      />
      <Equation
        tex={String.raw`\Gamma = \tfrac12 \int u^2\, dt`}
        reads={t("experiments.smoke.model.circulation")}
        symbols={[
          { tex: String.raw`\Gamma`, meaning: s("gamma"), unit: "m²/s" },
          { tex: "t", meaning: s("t"), unit: "s" },
        ]}
      />
      <Equation
        tex={String.raw`L = \int u\, dt \;\le\; 4\, D`}
        reads={t("experiments.smoke.model.formation")}
        symbols={[
          { tex: "L", meaning: s("l"), unit: "m" },
          { tex: "D", meaning: s("d"), unit: "m" },
        ]}
      />
      <Equation
        tex={String.raw`U = \frac{\Gamma}{4\pi R_r}\left(\ln\frac{8 R_r}{a_c} - \frac14\right)`}
        reads={t("experiments.smoke.model.speed")}
        symbols={[
          { tex: "U", meaning: s("uring"), unit: "m/s" },
          { tex: "R_r", meaning: s("rring"), unit: "m" },
          { tex: "a_c", meaning: s("core"), unit: "m" },
        ]}
      />
      <Equation
        tex={String.raw`Re = \frac{\Gamma}{\nu}`}
        reads={t("experiments.smoke.model.reynolds")}
        symbols={[
          { tex: "Re", meaning: s("re") },
          { tex: String.raw`\nu`, meaning: s("nu"), unit: "m²/s" },
        ]}
      />
      <Equation
        tex={String.raw`F = k\, x + \tfrac12\, \rho\, u^2 A_{\text{eff}}, \qquad k = \frac{2\pi T}{\ln(R/a)}`}
        reads={t("experiments.smoke.model.hand")}
        symbols={[
          { tex: "F", meaning: s("f"), unit: "N" },
          { tex: "k", meaning: s("k"), unit: "N/m" },
          { tex: "T", meaning: s("tension"), unit: "N/m" },
          { tex: String.raw`\rho`, meaning: s("rho"), unit: "kg/m³" },
        ]}
      />
    </>
  );
}

/** How the engine computes the ring's flight: two first-order equations. */
function SmokeComputed() {
  const { t } = useTranslation();
  const s = (key: string) => t(`experiments.smoke.symbols.${key}`);
  return (
    <Equation
      tex={String.raw`\frac{dz}{dt} = U(t, R_r), \qquad \frac{dR_r}{dt} = \alpha\, U \;\;(\text{turbulent}), \qquad a_c^2 = a_0^2 + 4\,\nu\, t \;\;(\text{laminar})`}
      reads={t("experiments.smoke.computed.system")}
      symbols={[
        { tex: "z", meaning: s("z"), unit: "m" },
        { tex: String.raw`\alpha`, meaning: s("alpha") },
        { tex: "a_0", meaning: t("experiments.smoke.computed.a0"), unit: "m" },
      ]}
    />
  );
}

function SmokeTrick({ figures, exhibit }: { figures: SmokeFigures | null; exhibit: SmokeExhibitRequest | null }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  const rows = useMemo(
    () =>
      figures
        ? figures.presses.map((p) => ({
            d: p.duration_s,
            re: p.reynolds / 1000,
            threshold: (exhibit?.room.turbulent_reynolds ?? 0) / 1000,
            speed: p.speed_m_s,
            draught: exhibit?.room.draught_m_s ?? 0,
            force: p.peak_force_n,
          }))
        : [],
    [figures, exhibit],
  );
  if (!figures) return <LoadingState className="py-6" label={t("common.loading")} />;
  const n = (value: number, digits: number) => formatNumber(value, digits, locale);
  const nearest = (target: number) =>
    figures.presses.reduce((best, p) =>
      Math.abs(Math.log(p.duration_s / target)) < Math.abs(Math.log(best.duration_s / target)) ? p : best,
    );
  // Each curve beside the threshold it crosses: where they meet is the window's end.
  const reSeries = [
    { key: "re", label: t("experiments.smoke.chart.reynolds"), color: hex[4 % hex.length] },
    { key: "threshold", label: t("experiments.smoke.chart.threshold"), color: hex[6 % hex.length], dash: 1 },
  ];
  const speedSeries = [
    { key: "speed", label: t("experiments.smoke.chart.speed"), color: hex[2 % hex.length] },
    { key: "draught", label: t("experiments.smoke.chart.draught"), color: hex[6 % hex.length], dash: 1 },
  ];
  const x = {
    key: "d" as const,
    title: `${t("experiments.smoke.chart.duration")} (s)`,
    format: (v: number) => n(v, 1),
  };
  return (
    <>
      {figures.fastest_s !== null && figures.slowest_s !== null && figures.best_s !== null ? (
        <p>
          {t("experiments.smoke.sweet.window", {
            fastest: n(figures.fastest_s, 2),
            slowest: n(figures.slowest_s, 1),
            best: n(figures.best_s, 1),
          })}
        </p>
      ) : (
        <AlertBanner tone="info">{t("experiments.smoke.sweet.none")}</AlertBanner>
      )}
      <p>{t("experiments.smoke.sweet.fast")}</p>
      <SeriesChart
        rows={rows}
        series={reSeries}
        axes={[
          {
            id: "y",
            title: `${t("experiments.smoke.chart.reynolds")} (×1000)`,
            format: (v) => n(v, 0),
            includeZero: true,
          },
        ]}
        x={x}
      />
      <StaticLegend entries={seriesLegendEntries(reSeries)} />
      <p>{t("experiments.smoke.sweet.slow")}</p>
      <SeriesChart
        rows={rows}
        series={speedSeries}
        axes={[
          { id: "y", title: `${t("experiments.smoke.chart.speed")} (m/s)`, format: (v) => n(v, 1), includeZero: true },
        ]}
        x={x}
      />
      <StaticLegend entries={seriesLegendEntries(speedSeries)} />
      <p>{t("experiments.smoke.sweet.both")}</p>
      <p>
        {t("experiments.smoke.sweet.force", {
          fast: n(nearest(0.1).peak_force_n, 0),
          slow: n(nearest(2).peak_force_n, 0),
        })}
      </p>
      <SeriesChart
        rows={rows}
        series={[{ key: "force", label: t("experiments.smoke.chart.force"), color: hex[6 % hex.length] }]}
        axes={[
          { id: "y", title: `${t("experiments.smoke.chart.force")} (N)`, format: (v) => n(v, 0), includeZero: true },
        ]}
        x={x}
      />
      <Figures
        tiles={[
          {
            key: "fastest",
            label: t("experiments.smoke.figures.fastest"),
            value: figures.fastest_s,
            digits: 2,
            unit: "s",
          },
          { key: "best", label: t("experiments.smoke.figures.best"), value: figures.best_s, digits: 2, unit: "s" },
          {
            key: "slowest",
            label: t("experiments.smoke.figures.slowest"),
            value: figures.slowest_s,
            digits: 2,
            unit: "s",
          },
          {
            key: "ratio",
            label: t("experiments.smoke.figures.ratio"),
            value: figures.area_ratio,
            digits: 1,
            unit: "×",
          },
          { key: "stroke", label: t("experiments.smoke.figures.stroke"), value: figures.stroke_ratio, digits: 1 },
        ]}
      />
      <p className="text-caption text-muted">{t("experiments.smoke.sweet.assumed")}</p>
    </>
  );
}
