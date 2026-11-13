import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pause, Play, RotateCcw } from "lucide-react";
import { AlertBanner, Button, LoadingState, ToggleGroup } from "@eifi1/ui-kit";
import { apiErrorMessage } from "@/shared/api/client";
import { SeriesChart } from "@/shared/charts/series-chart";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber } from "@/shared/lib/format";
import { useChartHex } from "@/shared/state/palette-store";
import type { Orbit, SphereFigures, SphereRequest } from "@/shared/types";
import { SliderField } from "@/shared/ui/slider-field";
import { Figures, WidgetCard } from "@/shared/ui/widget";
import { Equation } from "./equation";
import { ExhibitFrame } from "./exhibit-frame";
import {
  RESISTANCE_FADE_M_S,
  STEP_S,
  angleOf,
  handStep,
  startState,
  type SphereParameters,
  type SphereState,
} from "./simulate/sphere";
import {
  type Hand,
  autopilotTarget,
  clampPush,
  follow,
  leadDeg,
  perfectTarget,
  restingHand,
  MAX_TEMPO_HZ,
} from "./sphere-hand";
import { SideView, TopView } from "./sphere-views";
import { PreviewPending, type PreviewMode, type PreviewProps } from "./preview-mode";
import { SIDE, STAGE } from "./stage";
import { useExperimentsDefaults, useSphereFigures } from "./use-experiments";

/** Who pushes the sphere: the reader's finger, a steady circle at a chosen
 *  tempo, or the auto mode with perfect timing. */
type Mode = "hand" | "circle" | "perfect";
const MODES: Mode[] = ["hand", "circle", "perfect"];

/** How often the chart's "you are here" point moves: a chart redrawn every
 *  frame would cost more than the whole simulation. */
const CHART_EVERY_S = 0.25;

interface View {
  ball: [number, number, number];
  hand: [number, number];
  angle: number;
  tempoHz: number;
  lead: number;
}

function viewOf(s: SphereParameters, y: SphereState, hand: Hand): View {
  return {
    ball: [y[0], y[1], y[2]],
    hand: [hand.x, hand.y],
    angle: angleOf(s, y),
    tempoHz: hand.measuredHz,
    lead: leadDeg(hand, y[0], y[1]),
  };
}

/** The tempo the backbone gives for a height, interpolated between the
 *  engine's whole degrees; nothing above its last orbit. */
export function tempoFor(backbone: Orbit[], angleDeg: number): number | null {
  if (backbone.length === 0) return null;
  if (angleDeg <= backbone[0].angle_deg) return backbone[0].rate_hz;
  for (let j = 1; j < backbone.length; j++) {
    const a = backbone[j - 1];
    const b = backbone[j];
    if (angleDeg <= b.angle_deg) {
      const f = (angleDeg - a.angle_deg) / (b.angle_deg - a.angle_deg);
      return a.rate_hz + f * (b.rate_hz - a.rate_hz);
    }
  }
  return null;
}

/**
 * The ball in the hanging sphere (`experiments.sphere`): push the sphere round
 * with a finger, or let a steady circle or perfect timing do it, and watch the
 * ball climb towards the equator. The ball is the engine's, ported
 * (`simulate/sphere.ts`, held by `simulate.test.ts`), stepped every millisecond
 * of the time that passed; the hand between the finger and the ball is
 * `sphere-hand.ts`. The orbits and the swing are the server's, for the
 * sphere the sliders describe.
 */
export function SpherePage() {
  const { t } = useTranslation();
  const defaults = useExperimentsDefaults();
  const [build, setBuild] = useState<SphereRequest | null>(null);
  const sphere = build ?? defaults.data?.sphere ?? null;
  const figures = useSphereFigures(sphere);
  const data = figures.data ?? null;

  return (
    <ExhibitFrame
      exhibit="sphere"
      atTheExhibit={
        <>
          <p>{t("experiments.sphere.at.sphere")}</p>
          <p>{t("experiments.sphere.at.push")}</p>
        </>
      }
      whatHappens={<SphereModel />}
      computed={<SphereComputed />}
      sweetSpot={<SphereTrick figures={data} />}
    >
      {defaults.isPending || (sphere && !data && figures.isPending) ? (
        <LoadingState className="py-10" label={t("common.loading")} />
      ) : !sphere || !data ? (
        <AlertBanner tone="danger">
          {apiErrorMessage(defaults.error ?? figures.error, t("experiments.failed"))}
        </AlertBanner>
      ) : (
        <>
          <SpherePlay key={JSON.stringify(sphere)} sphere={sphere} figures={data} />
          <SphereBuild sphere={sphere} onChange={setBuild} />
        </>
      )}
    </ExhibitFrame>
  );
}

/** The exhibit's auto mode alone, for the overview's previews
 *  (`preview-mode.tsx`): the hand that pushes at the ball's own frequency, from
 *  rest until the ball runs round the equator. */
export function SpherePreview({ paused }: PreviewProps) {
  const defaults = useExperimentsDefaults();
  const sphere = defaults.data?.sphere ?? null;
  const figures = useSphereFigures(sphere);
  return sphere && figures.data ? (
    <SpherePlay sphere={sphere} figures={figures.data} preview paused={paused} />
  ) : (
    <PreviewPending />
  );
}

function SpherePlay({
  sphere,
  figures,
  preview = false,
  paused = false,
}: { sphere: SphereRequest; figures: SphereFigures } & PreviewMode) {
  const { t } = useTranslation();
  const locale = useLocale();
  const s = sphere as SphereParameters;
  const sim = useRef<{ y: SphereState; hand: Hand } | null>(null);
  if (sim.current === null) sim.current = { y: startState(s), hand: restingHand() };
  const finger = useRef<[number, number]>([0, 0]);
  const [view, setView] = useState<View>(() => viewOf(s, startState(s), restingHand()));
  const [runningHere, setRunning] = useState(true);
  const running = preview ? !paused : runningHere;
  const [mode, setMode] = useState<Mode>(preview ? "perfect" : "hand");
  const [tempo, setTempo] = useState(1.5);
  const [slowly, setSlowly] = useState(true);
  const f0 = figures.lowest_orbit_hz;

  // The loop: every millisecond of the time that passed (at most a twentieth
  // of a second per frame), the hand one step towards its target and the ball
  // one step with the hand's acceleration.
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const current = sim.current;
      if (!current) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const steps = Math.round(dt / STEP_S);
      for (let k = 0; k < steps; k++) {
        const y = current.y;
        const [tx, ty] =
          mode === "hand"
            ? finger.current
            : mode === "circle"
              ? autopilotTarget(current.hand, tempo, slowly, STEP_S)
              : perfectTarget(current.hand, { x: y[0], y: y[1], vx: y[3], vy: y[4] }, f0, STEP_S);
        const [ax, ay] = follow(current.hand, tx, ty, STEP_S);
        current.y = handStep(s, y, ax, ay);
      }
      setView(viewOf(s, current.y, current.hand));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, mode, tempo, slowly, f0, s]);

  const restart = () => {
    sim.current = { y: startState(s), hand: restingHand() };
    finger.current = [0, 0];
    setView(viewOf(s, sim.current.y, sim.current.hand));
  };
  const rho = s.shell_radius_m - s.ball_radius_m;
  const needed = tempoFor(figures.backbone, view.angle);

  if (preview) {
    return (
      <div className="grid grid-cols-2 gap-2">
        <TopView
          shellRadiusM={s.shell_radius_m}
          pathRadiusM={rho}
          ballRadiusM={s.ball_radius_m}
          hand={view.hand}
          ball={[view.ball[0], view.ball[1]]}
          disabled
          onPush={() => {}}
          onRelease={() => {}}
        />
        <SideView shellRadiusM={s.shell_radius_m} pathRadiusM={rho} ballRadiusM={s.ball_radius_m} ball={view.ball} />
      </div>
    );
  }
  return (
    <WidgetCard
      title={t("experiments.sphere.play.title")}
      hint={t(`experiments.sphere.play.hint_${mode}`)}
      actions={
        <>
          <Button variant="secondary" size="sm" onClick={() => setRunning(!running)}>
            {running ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
            {running ? t("experiments.sphere.play.pause") : t("experiments.sphere.play.run")}
          </Button>
          <Button variant="secondary" size="sm" onClick={restart}>
            <RotateCcw className="size-4" aria-hidden />
            {t("experiments.sphere.play.restart")}
          </Button>
        </>
      }
    >
      <div className={`${SIDE.grid} ${STAGE.twoWithSide}`}>
        <div className={SIDE.top}>
          <ToggleGroup
            label={t("experiments.sphere.play.who")}
            labelPlacement="above"
            size="sm"
            overflow="wrap"
            value={mode}
            onChange={(v: Mode) => {
              setMode(v);
              finger.current = [0, 0];
            }}
            options={MODES.map((m) => ({ value: m, label: t(`experiments.sphere.play.modes.${m}`) }))}
          />
        </div>
        <div className={SIDE.views}>
          <div className={`grid grid-cols-2 gap-2 sm:gap-4 ${STAGE.two}`}>
            <figure className="space-y-1">
              <TopView
                shellRadiusM={s.shell_radius_m}
                pathRadiusM={rho}
                ballRadiusM={s.ball_radius_m}
                hand={view.hand}
                ball={[view.ball[0], view.ball[1]]}
                disabled={mode !== "hand"}
                onPush={(x, y) => {
                  finger.current = clampPush(x, y);
                }}
                onRelease={() => {
                  finger.current = [0, 0];
                }}
              />
              <figcaption className="text-center text-caption text-muted">
                {t("experiments.sphere.views.top_caption")}
              </figcaption>
            </figure>
            <figure className="space-y-1">
              <SideView
                shellRadiusM={s.shell_radius_m}
                pathRadiusM={rho}
                ballRadiusM={s.ball_radius_m}
                ball={view.ball}
              />
              <figcaption className="text-center text-caption text-muted">
                {t("experiments.sphere.views.side_caption")}
              </figcaption>
            </figure>
          </div>
        </div>
        <div className={SIDE.column}>
          {mode === "circle" && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-1">
              <SliderField
                label={t("experiments.sphere.play.tempo")}
                unit="Hz"
                value={tempo}
                min={0.3}
                max={MAX_TEMPO_HZ}
                step={0.05}
                digits={2}
                onChange={setTempo}
              />
              <ToggleGroup
                label={t("experiments.sphere.play.change")}
                labelPlacement="above"
                size="sm"
                value={slowly ? "slowly" : "at_once"}
                onChange={(v: string) => setSlowly(v === "slowly")}
                options={[
                  { value: "slowly", label: t("experiments.sphere.play.slowly") },
                  { value: "at_once", label: t("experiments.sphere.play.at_once") },
                ]}
              />
            </div>
          )}
          <Figures
            tiles={[
              { key: "angle", label: t("experiments.sphere.play.angle"), value: view.angle, digits: 0, unit: "°" },
              {
                key: "depth",
                label: t("experiments.sphere.play.depth"),
                value: -view.ball[2] * 100,
                digits: 1,
                unit: "cm",
              },
              {
                key: "tempo",
                label: t("experiments.sphere.play.your_tempo"),
                value: view.tempoHz,
                digits: 2,
                unit: "Hz",
              },
              { key: "needed", label: t("experiments.sphere.play.needed"), value: needed, digits: 2, unit: "Hz" },
              { key: "lead", label: t("experiments.sphere.play.lead"), value: view.lead, digits: 0, unit: "°" },
            ]}
          />
        </div>
      </div>
      <p className="text-sm text-secondary">
        {t("experiments.sphere.play.reading", { f0: formatNumber(f0, 2, locale) })}
      </p>
      <BackboneChart figures={figures} angle={view.angle} tempoHz={view.tempoHz} />
    </WidgetCard>
  );
}

/** The orbits (round and round) and the swing (back and forth), with where the
 *  reader is: the ball's height against the tempo the hand circles at. The
 *  point moves a few times a second, not every frame. */
function BackboneChart({ figures, angle, tempoHz }: { figures: SphereFigures; angle: number; tempoHz: number }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  const [point, setPoint] = useState<{ angle: number; tempo: number } | null>(null);
  const latest = useRef({ angle, tempo: tempoHz });
  useEffect(() => {
    latest.current = { angle, tempo: tempoHz };
  }, [angle, tempoHz]);
  useEffect(() => {
    const id = window.setInterval(() => setPoint({ ...latest.current }), CHART_EVERY_S * 1000);
    return () => window.clearInterval(id);
  }, []);
  const rows = useMemo(() => {
    const byAngle = new Map<number, { angle: number; circle?: number; swing?: number }>();
    for (const o of figures.backbone) byAngle.set(o.angle_deg, { angle: o.angle_deg, circle: o.rate_hz });
    for (const p of figures.swing) {
      const row = byAngle.get(p.amplitude_deg) ?? { angle: p.amplitude_deg };
      row.swing = p.rate_hz;
      byAngle.set(p.amplitude_deg, row);
    }
    return [...byAngle.values()].sort((a, b) => a.angle - b.angle);
  }, [figures]);
  return (
    <SeriesChart
      rows={rows}
      connectNulls
      series={[
        { key: "circle", label: t("experiments.sphere.chart.circle"), color: hex[2 % hex.length] },
        { key: "swing", label: t("experiments.sphere.chart.swing"), color: hex[6 % hex.length], dash: 1 },
      ]}
      axes={[
        {
          id: "y",
          title: `${t("experiments.sphere.chart.tempo")} (Hz)`,
          format: (v) => formatNumber(v, 1, locale),
          domain: [0, Math.max(MAX_TEMPO_HZ + 0.5, figures.lowest_orbit_hz * 2)],
        },
      ]}
      x={{
        key: "angle",
        title: `${t("experiments.sphere.chart.angle")} (°)`,
        format: (v) => formatNumber(v, 0, locale),
      }}
      markers={
        point && point.tempo > 0.05
          ? [{ x: point.angle, y: point.tempo, label: t("experiments.sphere.chart.you"), tone: "danger" as const }]
          : []
      }
    />
  );
}

function SphereBuild({ sphere, onChange }: { sphere: SphereRequest; onChange: (next: SphereRequest) => void }) {
  const { t } = useTranslation();
  return (
    <WidgetCard title={t("experiments.sphere.change.title")} hint={t("experiments.sphere.change.hint")}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SliderField
          label={t("experiments.sphere.change.shell")}
          unit="cm"
          value={sphere.shell_radius_m * 200}
          min={20}
          max={80}
          step={1}
          digits={0}
          hint={t("experiments.sphere.change.shell_hint")}
          onChange={(v) => onChange({ ...sphere, shell_radius_m: v / 200 })}
        />
        <SliderField
          label={t("experiments.sphere.change.ball")}
          unit="cm"
          value={sphere.ball_radius_m * 200}
          min={1}
          max={10}
          step={0.5}
          digits={1}
          onChange={(v) => onChange({ ...sphere, ball_radius_m: v / 200 })}
        />
        <ToggleGroup
          label={t("experiments.sphere.change.kind")}
          labelPlacement="above"
          size="sm"
          value={sphere.ball}
          onChange={(v: SphereRequest["ball"]) => onChange({ ...sphere, ball: v })}
          options={[
            { value: "solid", label: t("experiments.sphere.change.solid") },
            { value: "hollow", label: t("experiments.sphere.change.hollow") },
          ]}
        />
        <SliderField
          label={t("experiments.sphere.change.rolling")}
          unit=""
          value={sphere.rolling_resistance}
          min={0}
          max={0.02}
          step={0.001}
          digits={3}
          onChange={(v) => onChange({ ...sphere, rolling_resistance: v })}
        />
      </div>
    </WidgetCard>
  );
}

/** What happens, equation by equation. */
function SphereModel() {
  const { t } = useTranslation();
  const s = (key: string) => t(`experiments.sphere.symbols.${key}`);
  return (
    <>
      <p>{t("experiments.sphere.model.rolling_intro")}</p>
      <Equation
        tex={String.raw`g' = \frac{g}{1 + k}, \qquad k = \frac{I}{m\,r^2} = \tfrac{2}{5} \;\Rightarrow\; g' = \tfrac{5}{7}\,g`}
        reads={t("experiments.sphere.model.rolling")}
        symbols={[
          { tex: "g'", meaning: s("g_share"), unit: "m/s²" },
          { tex: "g", meaning: s("g"), unit: "m/s²" },
          { tex: "k", meaning: s("k") },
          { tex: "I", meaning: s("inertia"), unit: "kg·m²" },
          { tex: "m", meaning: s("mass"), unit: "kg" },
          { tex: "r", meaning: s("ball_radius"), unit: "m" },
        ]}
      />
      <Equation
        tex={String.raw`\mathbf{g}_{\text{eff}} = \mathbf{g} - \mathbf{A}`}
        reads={t("experiments.sphere.model.push")}
        symbols={[{ tex: String.raw`\mathbf{A}`, meaning: s("push"), unit: "m/s²" }]}
      />
      <Equation
        tex={String.raw`\rho\,\cos\theta = \frac{g'}{\Omega^2}, \qquad \rho = R - r`}
        reads={t("experiments.sphere.model.orbit")}
        symbols={[
          { tex: String.raw`\rho`, meaning: s("rho"), unit: "m" },
          { tex: "R", meaning: s("shell_radius"), unit: "m" },
          { tex: String.raw`\theta`, meaning: s("theta"), unit: "°" },
          { tex: String.raw`\Omega`, meaning: s("omega"), unit: "1/s" },
          { tex: String.raw`\rho\cos\theta`, meaning: s("depth"), unit: "m" },
        ]}
      />
      <Equation
        tex={String.raw`\Omega_0 = \sqrt{\frac{g'}{\rho}}`}
        reads={t("experiments.sphere.model.lowest")}
        symbols={[{ tex: String.raw`\Omega_0`, meaning: s("omega0"), unit: "1/s" }]}
      />
      <Equation
        tex={String.raw`\omega_{\text{wobble}} = \Omega\,\sqrt{1 + 3\cos^2\theta}`}
        reads={t("experiments.sphere.model.wobble")}
        symbols={[{ tex: String.raw`\omega_{\text{wobble}}`, meaning: s("wobble"), unit: "1/s" }]}
      />
      <Equation
        tex={String.raw`f_{\text{swing}} = \frac{\pi}{2\,K\!\left(\sin\frac{\theta_0}{2}\right)}\,f_0`}
        reads={t("experiments.sphere.model.swing")}
        symbols={[
          { tex: String.raw`\theta_0`, meaning: s("amplitude"), unit: "°" },
          { tex: "f_0", meaning: s("f0"), unit: "Hz" },
          { tex: "K", meaning: s("elliptic") },
        ]}
      />
    </>
  );
}

/** The trick: the resonance moves while you pump. */
function SphereTrick({ figures }: { figures: SphereFigures | null }) {
  const { t } = useTranslation();
  if (!figures) return <LoadingState className="py-6" label={t("common.loading")} />;
  // The engine's angles are acos of a cosine, so 60 comes back as 59.999…: compare within a hair.
  const at = (deg: number) => figures.backbone.find((o) => Math.abs(o.angle_deg - deg) < 1e-6) ?? null;
  const o60 = at(60);
  const o80 = at(80);
  const o85 = at(85);
  const friction = Math.max(...figures.backbone.map((o) => o.friction_needed));
  return (
    <>
      <p>{t("experiments.sphere.sweet.moves")}</p>
      <p>{t("experiments.sphere.sweet.ahead")}</p>
      <p>{t("experiments.sphere.sweet.too_fast")}</p>
      {/* The question a reader asks next: can the ball go faster and faster? */}
      <p>{t("experiments.sphere.sweet.limit")}</p>
      <Figures
        tiles={[
          {
            key: "f0",
            label: t("experiments.sphere.figures.f0"),
            value: figures.lowest_orbit_hz,
            digits: 2,
            unit: "Hz",
          },
          {
            key: "f60",
            label: t("experiments.sphere.figures.at", { angle: 60 }),
            value: o60?.rate_hz,
            digits: 2,
            unit: "Hz",
          },
          {
            key: "f80",
            label: t("experiments.sphere.figures.at", { angle: 80 }),
            value: o80?.rate_hz,
            digits: 2,
            unit: "Hz",
          },
          {
            key: "f85",
            label: t("experiments.sphere.figures.at", { angle: 85 }),
            value: o85?.rate_hz,
            digits: 2,
            unit: "Hz",
          },
          {
            key: "depth85",
            label: t("experiments.sphere.figures.depth", { angle: 85 }),
            value: o85 ? o85.depth_below_equator_m * 100 : null,
            digits: 1,
            unit: "cm",
          },
          {
            key: "push80",
            label: t("experiments.sphere.figures.push", { angle: 80 }),
            value: o80 ? o80.drive_radius_needed_m * 1000 : null,
            digits: 1,
            unit: "mm",
          },
          { key: "friction", label: t("experiments.sphere.figures.friction"), value: friction, digits: 2 },
          { key: "share", label: t("experiments.sphere.figures.share"), value: figures.gravity_share, digits: 3 },
        ]}
      />
      <p className="text-caption text-muted">{t("experiments.sphere.sweet.figures_note")}</p>
    </>
  );
}

/** How the engine computes the ball: six equations, stepped. */
function SphereComputed() {
  const { t } = useTranslation();
  const locale = useLocale();
  const c = (key: string, values?: Record<string, string>) => t(`experiments.sphere.computed.${key}`, values);
  return (
    <>
      <Equation
        tex={String.raw`\begin{aligned} \dot{\mathbf p} &= \mathbf v \\ \dot{\mathbf v} &= \frac{1}{1+k}\left[(\mathbf g - \mathbf A)_\parallel - c_r\,N\,\frac{\mathbf v}{\sqrt{v^2 + v_s^2}}\right] - \frac{v^2}{\rho}\,\mathbf n \end{aligned}`}
        reads={c("system", { step: formatNumber(STEP_S * 1000, 0, locale) })}
        symbols={[
          { tex: String.raw`\mathbf p`, meaning: c("p"), unit: "m" },
          { tex: String.raw`\mathbf v`, meaning: c("v"), unit: "m/s" },
          { tex: String.raw`(\cdot)_\parallel`, meaning: c("along") },
          { tex: "N", meaning: c("normal"), unit: "m/s²" },
          { tex: String.raw`\mathbf n`, meaning: c("n") },
          { tex: "c_r", meaning: c("cr") },
          {
            tex: "v_s",
            meaning: c("fade", { fade: formatNumber(RESISTANCE_FADE_M_S * 1000, 0, locale) }),
            unit: "m/s",
          },
        ]}
      />
      <p>{c("centripetal")}</p>
    </>
  );
}
