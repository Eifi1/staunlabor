import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Hand, Pause, Play, RotateCcw } from "lucide-react";
import { AlertBanner, Button, LoadingState, Switch } from "@eifi1/ui-kit";
import { apiErrorMessage } from "@/shared/api/client";
import { SeriesChart } from "@/shared/charts/series-chart";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber } from "@/shared/lib/format";
import { useChartHex } from "@/shared/state/palette-store";
import type { PlatformExhibitRequest, PlatformFigures } from "@/shared/types";
import { SliderField } from "@/shared/ui/slider-field";
import { Figures, WidgetCard } from "@/shared/ui/widget";
import { Equation } from "./equation";
import { ExhibitFrame } from "./exhibit-frame";
import { PlatformView } from "./platform-view";
import { frictionStep, inertia, pullN, run, type Move, type Posture } from "./simulate/platform";
import { PreviewPending, type PreviewMode, type PreviewProps } from "./preview-mode";
import { STAGE } from "./stage";
import { useExperimentsDefaults, usePlatformFigures } from "./use-experiments";

/** A helper's push: the angular momentum one shove gives, kg·m²/s — about
 *  85 N for a fifth of a second at a metre. It turns the default visitor half
 *  a turn a second leaning out, the spin the figures start from
 *  (`platform.START_REV_PER_S`), and 1.6 turns a second upright. */
const PUSH = 17;

/** The two ends of the range, as the engine's figures have them: leaning out
 *  with straight arms, and upright. */
const LEANING: Posture = { lean_m: 0.3 };
const UPRIGHT: Posture = { lean_m: 0 };

/** The auto mode's cycle: three seconds leaning out, a second and a half to
 *  stand up, two and a half upright, a second to lean out again. */
const CYCLE_S = 8;

/** The posture the auto mode has at `t` into its cycle. */
export function autoPosture(t: number): Posture {
  const c = ((t % CYCLE_S) + CYCLE_S) % CYCLE_S;
  const blend = (f: number): Posture => ({ lean_m: LEANING.lean_m + (UPRIGHT.lean_m - LEANING.lean_m) * f });
  if (c < 3) return LEANING;
  if (c < 4.5) return blend((c - 3) / 1.5);
  if (c < 7) return UPRIGHT;
  return blend(1 - (c - 7));
}

/** The auto mode as the engine's moves, for the replay: the same cycle as
 *  {@link autoPosture}, twice over, and the same linear blends. */
const AUTO_MOVES: Move[] = [0, CYCLE_S].flatMap((start) => [
  { at_s: start + 3, lean_m: UPRIGHT.lean_m, over_s: 1.5, push: 0 },
  { at_s: start + 7, lean_m: LEANING.lean_m, over_s: 1, push: 0 },
]);

interface View {
  angle: number;
  momentum: number;
  posture: Posture;
}

/**
 * The spinning platform (`experiments.platform`): stand on it holding the
 * bar, get a push, and lean out or stand up. The rate is `L/I` every frame —
 * the engine's inertia and the bearing's friction ported
 * (`simulate/platform.ts`, held by `simulate.test.ts`) — and the figures and
 * curves are the server's.
 */
export function PlatformPage() {
  const { t } = useTranslation();
  const defaults = useExperimentsDefaults();
  const [build, setBuild] = useState<PlatformExhibitRequest | null>(null);
  const exhibit = build ?? defaults.data?.platform ?? null;
  const figures = usePlatformFigures(exhibit);

  return (
    <ExhibitFrame
      exhibit="platform"
      atTheExhibit={
        <>
          <p>{t("experiments.platform.at.stand")}</p>
          <p>{t("experiments.platform.at.pull")}</p>
        </>
      }
      whatHappens={<PlatformModel />}
      computed={<PlatformComputed />}
      sweetSpot={<PlatformTrick figures={figures.data ?? null} exhibit={exhibit} />}
    >
      {defaults.isPending ? (
        <LoadingState className="py-10" label={t("common.loading")} />
      ) : !exhibit ? (
        <AlertBanner tone="danger">{apiErrorMessage(defaults.error, t("experiments.failed"))}</AlertBanner>
      ) : (
        <>
          <PlatformPlay key={JSON.stringify(exhibit)} exhibit={exhibit} />
          <PlatformBuild exhibit={exhibit} onChange={setBuild} />
        </>
      )}
    </ExhibitFrame>
  );
}

/** The exhibit's auto mode alone, for the overview's previews
 *  (`preview-mode.tsx`): pushed once, leaning out and standing up in turn. */
export function PlatformPreview({ paused }: PreviewProps) {
  const defaults = useExperimentsDefaults();
  const exhibit = defaults.data?.platform;
  return exhibit ? <PlatformPlay exhibit={exhibit} preview paused={paused} /> : <PreviewPending />;
}

function PlatformPlay({ exhibit, preview = false, paused = false }: { exhibit: PlatformExhibitRequest } & PreviewMode) {
  const { t } = useTranslation();
  const locale = useLocale();
  const sim = useRef<{ momentum: number; angle: number; clock: number } | null>(null);
  if (sim.current === null) sim.current = { momentum: 0, angle: 0, clock: 0 };
  const [lean, setLean] = useState(LEANING.lean_m);
  const [auto, setAuto] = useState(preview);
  const [runningHere, setRunning] = useState(true);
  const running = preview ? !paused : runningHere;
  const [view, setView] = useState<View>({ angle: 0, momentum: 0, posture: LEANING });
  const body = exhibit.body;
  const platform = exhibit.platform;

  // Every frame: the bearing takes its share of the momentum, the lean is the
  // reader's (or the auto mode's), and the platform turns by L/I.
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const current = sim.current;
      if (!current) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      current.clock += dt;
      if (auto && current.momentum === 0) current.momentum = PUSH;
      const posture = auto ? autoPosture(current.clock) : { lean_m: lean };
      const omega = current.momentum / inertia(body, platform, posture).total;
      current.angle += omega * dt;
      current.momentum = frictionStep(current.momentum, platform.friction_n_m, dt);
      setView({ angle: current.angle, momentum: current.momentum, posture });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, auto, lean, body, platform]);

  const push = () => {
    if (sim.current) sim.current.momentum += Math.sign(sim.current.momentum || 1) * PUSH;
  };
  const restart = () => {
    sim.current = { momentum: 0, angle: 0, clock: 0 };
    setView({ angle: 0, momentum: 0, posture: { lean_m: lean } });
  };

  const parts = inertia(body, platform, view.posture);
  const omega = view.momentum / parts.total;
  const leaning = inertia(body, platform, LEANING).total;

  if (preview) return <PlatformView body={body} platform={platform} posture={view.posture} angleRad={view.angle} />;
  return (
    <WidgetCard
      title={t("experiments.platform.play.title")}
      hint={t(auto ? "experiments.platform.play.hint_auto" : "experiments.platform.play.hint")}
      actions={
        <>
          <Button variant="accent" size="sm" onClick={push}>
            <Hand className="size-4" aria-hidden />
            {t("experiments.platform.play.push")}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setRunning(!running)}>
            {running ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
            {running ? t("experiments.platform.play.pause") : t("experiments.platform.play.run")}
          </Button>
          <Button variant="secondary" size="sm" onClick={restart}>
            <RotateCcw className="size-4" aria-hidden />
            {t("experiments.platform.play.restart")}
          </Button>
        </>
      }
    >
      <div className={`grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_18rem] ${STAGE.withSide}`}>
        <PlatformView body={body} platform={platform} posture={view.posture} angleRad={view.angle} />
        <div className="space-y-4">
          <Switch
            label={t("experiments.platform.play.auto")}
            description={t("experiments.platform.play.auto_hint")}
            checked={auto}
            onCheckedChange={setAuto}
          />
          <SliderField
            label={t("experiments.platform.play.lean")}
            unit="cm"
            value={(auto ? view.posture.lean_m : lean) * 100}
            min={0}
            max={40}
            step={1}
            digits={0}
            hint={t("experiments.platform.play.lean_hint")}
            onChange={(v) => {
              setAuto(false);
              setLean(v / 100);
            }}
          />
          {/* Under the slider, beside the drawing: what the
              lean does is read while leaning, not a scroll away under a
              square as tall as the screen. On a phone the column falls
              under the drawing, and the figures still follow the slider. */}
          <Figures
            tiles={[
              {
                key: "rate",
                label: t("experiments.platform.play.rate"),
                value: Math.abs(omega) / (2 * Math.PI),
                digits: 2,
                unit: t("experiments.platform.play.rate_unit"),
              },
              {
                key: "inertia",
                label: t("experiments.platform.play.inertia"),
                value: parts.total,
                digits: 2,
                unit: "kg·m²",
              },
              {
                key: "momentum",
                label: t("experiments.platform.play.momentum"),
                value: Math.abs(view.momentum),
                digits: 1,
                unit: "kg·m²/s",
              },
              {
                key: "energy",
                label: t("experiments.platform.play.energy"),
                value: (view.momentum * view.momentum) / (2 * parts.total),
                digits: 0,
                unit: "J",
              },
              {
                key: "pull",
                label: t("experiments.platform.play.pull"),
                value: pullN(body, view.posture, omega),
                digits: 0,
                unit: "N",
              },
              {
                key: "times",
                label: t("experiments.platform.play.times"),
                value: leaning / parts.total,
                digits: 1,
                unit: "×",
              },
            ]}
          />
        </div>
      </div>
      <p className="text-sm text-secondary">
        {t("experiments.platform.play.reading", { push: formatNumber(PUSH, 0, locale) })}
      </p>
    </WidgetCard>
  );
}

function PlatformBuild({
  exhibit,
  onChange,
}: {
  exhibit: PlatformExhibitRequest;
  onChange: (next: PlatformExhibitRequest) => void;
}) {
  const { t } = useTranslation();
  const { body, platform } = exhibit;
  return (
    <WidgetCard title={t("experiments.platform.change.title")} hint={t("experiments.platform.change.hint")}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SliderField
          label={t("experiments.platform.change.mass")}
          unit="kg"
          value={body.mass_kg}
          min={30}
          max={120}
          step={1}
          digits={0}
          onChange={(v) => onChange({ ...exhibit, body: { ...body, mass_kg: v } })}
        />
        <SliderField
          label={t("experiments.platform.change.platform_mass")}
          unit="kg"
          value={platform.mass_kg}
          min={0}
          max={60}
          step={1}
          digits={0}
          onChange={(v) => onChange({ ...exhibit, platform: { ...platform, mass_kg: v } })}
        />
        <SliderField
          label={t("experiments.platform.change.diameter")}
          unit="cm"
          value={platform.radius_m * 200}
          min={30}
          max={150}
          step={5}
          digits={0}
          onChange={(v) => onChange({ ...exhibit, platform: { ...platform, radius_m: v / 200 } })}
        />
        <SliderField
          label={t("experiments.platform.change.friction")}
          unit="N·m"
          value={platform.friction_n_m}
          min={0}
          max={1}
          step={0.05}
          digits={2}
          hint={t("experiments.platform.change.friction_hint")}
          onChange={(v) => onChange({ ...exhibit, platform: { ...platform, friction_n_m: v } })}
        />
      </div>
    </WidgetCard>
  );
}

function PlatformModel() {
  const { t } = useTranslation();
  const s = (key: string) => t(`experiments.platform.symbols.${key}`);
  return (
    <>
      <p>{t("experiments.platform.model.intro")}</p>
      <Equation
        tex={String.raw`L = I\,\omega, \qquad \frac{dL}{dt} = -\tau_f`}
        reads={t("experiments.platform.model.momentum")}
        symbols={[
          { tex: "L", meaning: s("momentum"), unit: "kg·m²/s" },
          { tex: "I", meaning: s("inertia"), unit: "kg·m²" },
          { tex: String.raw`\omega`, meaning: s("omega"), unit: "1/s" },
          { tex: String.raw`\tau_f`, meaning: s("friction"), unit: "N·m" },
        ]}
      />
      <Equation tex={String.raw`\omega = \frac{L}{I}`} reads={t("experiments.platform.model.rate")} symbols={[]} />
      <Equation
        tex={String.raw`I = \sum m\, r^2`}
        reads={t("experiments.platform.model.sum")}
        symbols={[
          { tex: "m", meaning: s("piece"), unit: "kg" },
          { tex: "r", meaning: s("r"), unit: "m" },
        ]}
      />
      <Equation
        tex={String.raw`I_{\text{platform}} = \tfrac12\, M R^2`}
        reads={t("experiments.platform.model.disc")}
        symbols={[
          { tex: "M", meaning: s("platform_mass"), unit: "kg" },
          { tex: "R", meaning: s("platform_radius"), unit: "m" },
        ]}
      />
      <Equation
        tex={String.raw`I = I_{\text{own}} + m\, d^2`}
        reads={t("experiments.platform.model.lean")}
        symbols={[
          { tex: String.raw`I_{\text{own}}`, meaning: s("own"), unit: "kg·m²" },
          { tex: "d", meaning: s("lean"), unit: "m" },
        ]}
      />
      <Equation
        tex={String.raw`I_{\text{arm}} = m_a \left(s^2 + \frac{d^2}{3}\right)`}
        reads={t("experiments.platform.model.arm")}
        symbols={[
          { tex: "m_a", meaning: s("arm_mass"), unit: "kg" },
          { tex: "s", meaning: s("shoulder"), unit: "m" },
        ]}
      />
    </>
  );
}

function PlatformTrick({
  figures,
  exhibit,
}: {
  figures: PlatformFigures | null;
  exhibit: PlatformExhibitRequest | null;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  const s = (key: string) => t(`experiments.platform.symbols.${key}`);
  const leanRows = useMemo(
    () => (figures ? figures.lean_curve.map((p) => ({ lean: p.lean_m * 100, rate: p.rev_per_s })) : []),
    [figures],
  );
  // The auto mode from one push, as the engine's run replays it: the speed
  // leaps as the visitor stands up, the angular momentum only runs down.
  const replay = useMemo(() => {
    if (!exhibit) return [];
    const r = run(exhibit.body, exhibit.platform, LEANING, PUSH, AUTO_MOVES, 2 * CYCLE_S);
    return r.t.map((time, j) => ({ t: time, rate: r.rev_per_s[j], momentum: r.momentum[j] }));
  }, [exhibit]);
  if (!figures) return <LoadingState className="py-6" label={t("common.loading")} />;
  const rateUnit = t("experiments.platform.play.rate_unit");
  const rate = `${t("experiments.platform.chart.rate")} (${rateUnit})`;
  return (
    <>
      <p>{t("experiments.platform.sweet.faster", { ratio: formatNumber(figures.speed_ratio, 1, locale) })}</p>
      <Equation
        tex={String.raw`E = \frac{L^2}{2\,I}`}
        reads={t("experiments.platform.sweet.energy")}
        symbols={[{ tex: "E", meaning: s("energy"), unit: "J" }]}
      />
      <Equation
        tex={String.raw`F = \omega^2\, d\,\left(m_t + m_a\right)`}
        reads={t("experiments.platform.sweet.pull")}
        symbols={[
          { tex: "F", meaning: s("pull"), unit: "N" },
          { tex: "m_t", meaning: s("trunk_mass"), unit: "kg" },
        ]}
      />
      <p>
        {t("experiments.platform.sweet.paid", {
          work: formatNumber(figures.work_to_stand_up_j, 0, locale),
          from: formatNumber(figures.leaning.energy_j, 0, locale),
          to: formatNumber(figures.upright.energy_j, 0, locale),
        })}
      </p>
      <p>{t("experiments.platform.sweet.replay", { push: formatNumber(PUSH, 0, locale) })}</p>
      <SeriesChart
        rows={replay}
        series={[
          { key: "rate", label: t("experiments.platform.chart.rate"), color: hex[2 % hex.length], axis: "rate" },
          {
            key: "momentum",
            label: t("experiments.platform.play.momentum"),
            color: hex[6 % hex.length],
            axis: "momentum",
            dash: 1,
          },
        ]}
        axes={[
          { id: "rate", title: rate, orientation: "left", format: (v) => formatNumber(v, 1, locale) },
          {
            id: "momentum",
            title: `${t("experiments.platform.play.momentum")} (kg·m²/s)`,
            orientation: "right",
            format: (v) => formatNumber(v, 0, locale),
            includeZero: true,
          },
        ]}
        x={{
          key: "t",
          title: `${t("experiments.platform.chart.time")} (s)`,
          format: (v) => formatNumber(v, 0, locale),
        }}
      />
      <SeriesChart
        rows={leanRows}
        series={[{ key: "rate", label: t("experiments.platform.chart.rate"), color: hex[3 % hex.length] }]}
        axes={[{ id: "y", title: rate, format: (v) => formatNumber(v, 1, locale) }]}
        x={{
          key: "lean",
          title: `${t("experiments.platform.chart.lean")} (cm)`,
          format: (v) => formatNumber(v, 0, locale),
        }}
      />
      <Figures
        tiles={[
          {
            key: "leaning",
            label: t("experiments.platform.figures.leaning"),
            value: figures.leaning.rev_per_s,
            digits: 2,
            unit: rateUnit,
          },
          {
            key: "upright",
            label: t("experiments.platform.figures.upright"),
            value: figures.upright.rev_per_s,
            digits: 2,
            unit: rateUnit,
          },
          {
            key: "work",
            label: t("experiments.platform.figures.work"),
            value: figures.work_to_stand_up_j,
            digits: 0,
            unit: "J",
          },
          {
            key: "pull",
            label: t("experiments.platform.figures.pull_leaning"),
            value: figures.leaning.pull_n,
            digits: 0,
            unit: "N",
          },
          {
            key: "stops",
            label: t("experiments.platform.figures.stops"),
            value: figures.stops_after_s,
            digits: 0,
            unit: "s",
          },
        ]}
      />
    </>
  );
}

/** How the engine computes the spin: one equation, solved exactly. */
function PlatformComputed() {
  const { t } = useTranslation();
  const c = (key: string) => t(`experiments.platform.computed.${key}`);
  return (
    <Equation
      tex={String.raw`\frac{dL}{dt} = -\tau_f \;\Rightarrow\; L(t) = \max\left(0,\; L_0 - \tau_f\,t\right), \qquad \omega(t) = \frac{L(t)}{I}`}
      reads={c("system")}
      symbols={[
        { tex: "L_0", meaning: c("l0"), unit: "kg·m²/s" },
        { tex: "t", meaning: c("t"), unit: "s" },
      ]}
    />
  );
}
