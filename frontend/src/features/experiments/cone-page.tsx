import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Hand, Pause, Play } from "lucide-react";
import { AlertBanner, Button, LoadingState, ToggleGroup } from "@eifi1/ui-kit";
import { apiErrorMessage } from "@/shared/api/client";
import { SeriesChart } from "@/shared/charts/series-chart";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber } from "@/shared/lib/format";
import { useChartHex } from "@/shared/state/palette-store";
import { SliderField } from "@/shared/ui/slider-field";
import { Figures, WidgetCard } from "@/shared/ui/widget";
import { ConeFrontView, ConeSideView } from "./cone-views";
import { Equation } from "./equation";
import { ExhibitFrame } from "./exhibit-frame";
import { PreviewPending, type PreviewMode, type PreviewProps } from "./preview-mode";
import {
  axisHeightM,
  axisSlope,
  contactRadiusM,
  motionOf,
  railHeightM,
  refusal,
  roll,
  rollStep,
  startFor,
  thresholdDeg,
  type ConeExhibit,
  type RollState,
} from "./simulate/cone";
import { STEP_S } from "./simulate/pendulum";
import { SIDE } from "./stage";
import { useExperimentsDefaults } from "./use-experiments";

/** Real time, or four times slower: the roll takes a second and a half. */
const SPEEDS = [1, 0.25] as const;
type Speed = (typeof SPEEDS)[number];

/** The auto mode rests this long at the end before laying the cone again. */
const REST_S = 1.2;

/** Where the cone is going: up the rails, down them, or nowhere. */
export function verdict(ex: ConeExhibit): "up" | "down" | "stays" {
  const m = axisSlope(ex);
  return m < 0 ? "up" : m > 0 ? "down" : "stays";
}

/**
 * The double cone that rolls uphill (`experiments.cone`). The geometry and the
 * roll are the browser port's (`simulate/cone.ts`, held to the engine by
 * `simulate.test.ts`): no route, since every slider redraws the heights and
 * the cone rolls as the reader watches.
 */
export function ConePage() {
  const { t } = useTranslation();
  const defaults = useExperimentsDefaults();
  const [build, setBuild] = useState<ConeExhibit | null>(null);
  const ex = build ?? defaults.data?.cone ?? null;
  const refused = ex ? refusal(ex) : null;

  return (
    <ExhibitFrame
      exhibit="cone"
      atTheExhibit={
        <>
          <p>{t("experiments.cone.at.rails")}</p>
          <p>{t("experiments.cone.at.rolls")}</p>
        </>
      }
      whatHappens={<ConeModel />}
      computed={<ConeComputed />}
      sweetSpot={<ConeTrick ex={refused ? null : ex} />}
    >
      {defaults.isPending ? (
        <LoadingState className="py-10" label={t("common.loading")} />
      ) : !ex ? (
        <AlertBanner tone="danger">{apiErrorMessage(defaults.error, t("experiments.failed"))}</AlertBanner>
      ) : (
        <>
          {refused ? (
            <AlertBanner tone="warning">{t(`experiments.cone.refused.${refused}`)}</AlertBanner>
          ) : (
            <ConePlay key={JSON.stringify(ex)} ex={ex} />
          )}
          <ConeBuild ex={ex} onChange={setBuild} />
        </>
      )}
    </ExhibitFrame>
  );
}

/** Laid, let go and laid again, for the overview. */
export function ConePreview({ paused }: PreviewProps) {
  const defaults = useExperimentsDefaults();
  const ex = defaults.data?.cone;
  return ex ? <ConePlay ex={ex} preview paused={paused} /> : <PreviewPending />;
}

interface View {
  x: number;
  turnDeg: number;
  speed: number;
  spin: number;
}

function ConePlay({ ex, preview = false, paused = false }: { ex: ConeExhibit } & PreviewMode) {
  const { t } = useTranslation();
  const lay = (): RollState => ({ i: 0, x: startFor(ex), v: 0, stopped: false });
  const state = useRef<RollState>(lay());
  const turn = useRef(0);
  const rest = useRef(0);
  const [rolling, setRolling] = useState(preview);
  const [speedHere, setSpeed] = useState<Speed>(1);
  const [view, setView] = useState<View>(() => ({ x: startFor(ex), turnDeg: 0, speed: 0, spin: 0 }));
  const running = preview ? !paused : rolling;
  const speed = preview ? 1 : speedHere;

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    let owed = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = state.current;
      if (s.stopped && preview) {
        // The auto mode: a moment at the end, then laid again.
        rest.current += dt;
        if (rest.current > REST_S) {
          state.current = lay();
          rest.current = 0;
        }
      }
      owed += (dt * speed) / STEP_S;
      const steps = Math.floor(owed);
      owed -= steps;
      for (let k = 0; k < steps && !state.current.stopped; k++) {
        const { x, v } = state.current;
        turn.current += (v * STEP_S) / contactRadiusM(ex, x);
        rollStep(ex, state.current);
      }
      const { x, v } = state.current;
      const motion = motionOf(ex, x, v);
      setView({ x, turnDeg: (turn.current * 180) / Math.PI, speed: motion.speed, spin: motion.spin });
      if (state.current.stopped && !preview) setRolling(false);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // `lay` reads the build, which a new build remounts for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, speed, preview, ex]);

  const letGo = () => {
    state.current = lay();
    setView((v) => ({ ...v, x: state.current.x, speed: 0, spin: 0 }));
    setRolling(true);
  };

  const side = <ConeSideView ex={ex} x={view.x} turnDeg={view.turnDeg} />;
  if (preview) return side;
  const where = verdict(ex);
  return (
    <WidgetCard
      title={t("experiments.cone.play.title")}
      hint={t(`experiments.cone.play.hint_${where}`)}
      actions={
        <>
          <Button variant="accent" size="sm" onClick={letGo}>
            <Hand className="size-4" aria-hidden />
            {t("experiments.cone.play.let_go")}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setRolling(!rolling)}>
            {rolling ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
            {rolling ? t("experiments.cone.play.pause") : t("experiments.cone.play.run")}
          </Button>
        </>
      }
    >
      <div className={SIDE.grid}>
        <div className={SIDE.top}>
          <ToggleGroup
            label={t("experiments.cone.play.speed")}
            labelPlacement="above"
            size="sm"
            value={String(speed)}
            onChange={(v: string) => setSpeed(Number(v) as Speed)}
            options={SPEEDS.map((s) => ({ value: String(s), label: t(`experiments.cone.play.speeds.${s * 100}`) }))}
          />
        </div>
        <div className={SIDE.views}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <figure className="space-y-1">
              {side}
              <figcaption className="text-center text-caption text-muted">
                {t("experiments.cone.views.side_caption")}
              </figcaption>
            </figure>
            <figure className="space-y-1">
              <ConeFrontView ex={ex} x={view.x} />
              <figcaption className="text-center text-caption text-muted">
                {t("experiments.cone.views.front_caption")}
              </figcaption>
            </figure>
          </div>
        </div>
        <div className={SIDE.column}>
          <p className="text-sm font-medium text-primary">{t(`experiments.cone.play.verdict_${where}`)}</p>
          <Figures
            tiles={[
              {
                key: "along",
                label: t("experiments.cone.play.along"),
                value: view.x * 100,
                digits: 1,
                unit: "cm",
              },
              {
                key: "axis",
                label: t("experiments.cone.play.axis"),
                value: axisHeightM(ex, view.x) * 100,
                digits: 2,
                unit: "cm",
              },
              {
                key: "speed",
                label: t("experiments.cone.play.speed_now"),
                value: view.speed * 100,
                digits: 1,
                unit: "cm/s",
              },
              {
                key: "spin",
                label: t("experiments.cone.play.spin"),
                value: view.spin,
                digits: 1,
                unit: t("experiments.cone.play.spin_unit"),
              },
            ]}
          />
        </div>
      </div>
    </WidgetCard>
  );
}

function ConeBuild({ ex, onChange }: { ex: ConeExhibit; onChange: (next: ConeExhibit) => void }) {
  const { t } = useTranslation();
  const withCone = (patch: Partial<ConeExhibit["cone"]>) => onChange({ ...ex, cone: { ...ex.cone, ...patch } });
  const withRails = (patch: Partial<ConeExhibit["rails"]>) => onChange({ ...ex, rails: { ...ex.rails, ...patch } });
  return (
    <WidgetCard title={t("experiments.cone.change.title")} hint={t("experiments.cone.change.hint")}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SliderField
          label={t("experiments.cone.change.slope")}
          unit="°"
          value={ex.rails.slope_deg}
          min={0}
          max={15}
          step={0.5}
          digits={1}
          hint={t("experiments.cone.change.slope_hint")}
          onChange={(v) => withRails({ slope_deg: v })}
        />
        <SliderField
          label={t("experiments.cone.change.spread")}
          unit="°"
          value={ex.rails.spread_deg}
          min={5}
          max={40}
          step={1}
          digits={0}
          hint={t("experiments.cone.change.spread_hint")}
          onChange={(v) => withRails({ spread_deg: v })}
        />
        <SliderField
          label={t("experiments.cone.change.cone")}
          unit="°"
          value={ex.cone.cone_deg}
          min={10}
          max={40}
          step={1}
          digits={0}
          hint={t("experiments.cone.change.cone_hint")}
          onChange={(v) => withCone({ cone_deg: v })}
        />
        <SliderField
          label={t("experiments.cone.change.radius")}
          unit="cm"
          value={ex.cone.radius_m * 100}
          min={3}
          max={12}
          step={0.5}
          digits={1}
          onChange={(v) => withCone({ radius_m: v / 100 })}
        />
        <SliderField
          label={t("experiments.cone.change.length")}
          unit="cm"
          value={ex.rails.length_m * 100}
          min={10}
          max={60}
          step={1}
          digits={0}
          onChange={(v) => withRails({ length_m: v / 100 })}
        />
        <SliderField
          label={t("experiments.cone.change.start_gap")}
          unit="cm"
          value={ex.rails.start_half_gap_m * 200}
          min={0}
          max={16}
          step={0.5}
          digits={1}
          hint={t("experiments.cone.change.start_gap_hint")}
          onChange={(v) => withRails({ start_half_gap_m: v / 200 })}
        />
      </div>
    </WidgetCard>
  );
}

function ConeModel() {
  const { t } = useTranslation();
  const s = (key: string) => t(`experiments.cone.symbols.${key}`);
  return (
    <>
      <p>{t("experiments.cone.model.intro")}</p>
      <Equation
        tex={String.raw`r(y) = R - |y|\,\tan\alpha`}
        reads={t("experiments.cone.model.thin")}
        symbols={[
          { tex: "r", meaning: s("r"), unit: "m" },
          { tex: "R", meaning: s("radius"), unit: "m" },
          { tex: "y", meaning: s("y"), unit: "m" },
          { tex: String.raw`\alpha`, meaning: s("alpha"), unit: "°" },
        ]}
      />
      <Equation
        tex={String.raw`d(x) = d_0 + x\,\tan\beta, \qquad h(x) = x\,\tan\gamma`}
        reads={t("experiments.cone.model.rails")}
        symbols={[
          { tex: "x", meaning: s("x"), unit: "m" },
          { tex: "d", meaning: s("d"), unit: "m" },
          { tex: "h", meaning: s("h"), unit: "m" },
          { tex: String.raw`\beta`, meaning: s("beta"), unit: "°" },
          { tex: String.raw`\gamma`, meaning: s("gamma"), unit: "°" },
        ]}
      />
      <Equation
        tex={String.raw`z(x) = x\,\tan\gamma + c\,\bigl(R - d(x)\tan\alpha\bigr)`}
        reads={t("experiments.cone.model.axis")}
        symbols={[
          { tex: "z", meaning: s("z"), unit: "m" },
          { tex: "c", meaning: s("c") },
        ]}
      />
      <Equation
        tex={String.raw`\frac{dz}{dx} = \tan\gamma - c\,\tan\alpha\,\tan\beta`}
        reads={t("experiments.cone.model.condition")}
        symbols={[]}
      />
    </>
  );
}

function ConeTrick({ ex }: { ex: ConeExhibit | null }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  const rows = useMemo(() => {
    if (!ex) return [];
    const n = 30;
    return Array.from({ length: n + 1 }, (_, i) => {
      const x = (ex.rails.length_m * i) / n;
      return { x: x * 100, rail: railHeightM(ex, x) * 100, axis: axisHeightM(ex, x) * 100 };
    });
  }, [ex]);
  const run = useMemo(() => (ex ? roll(ex, startFor(ex), 30) : null), [ex]);
  if (!ex || !run) return <LoadingState className="py-6" label={t("common.loading")} />;
  const length = ex.rails.length_m;
  const rise = railHeightM(ex, length) * 100;
  const fall = (axisHeightM(ex, 0) - axisHeightM(ex, length)) * 100;
  return (
    <>
      <p>
        {t("experiments.cone.sweet.heights", {
          rise: formatNumber(rise, 1, locale),
          fall: formatNumber(Math.abs(fall), 1, locale),
          direction: t(`experiments.cone.sweet.${fall >= 0 ? "falls" : "climbs"}`),
        })}
      </p>
      <SeriesChart
        rows={rows}
        series={[
          { key: "rail", label: t("experiments.cone.chart.rail"), color: hex[6 % hex.length] },
          { key: "axis", label: t("experiments.cone.chart.axis"), color: hex[2 % hex.length], dash: 1 },
        ]}
        axes={[
          { id: "y", title: `${t("experiments.cone.chart.height")} (cm)`, format: (v) => formatNumber(v, 1, locale) },
        ]}
        x={{
          key: "x",
          title: `${t("experiments.cone.chart.along")} (cm)`,
          format: (v) => formatNumber(v, 0, locale),
        }}
      />
      <p>
        {t("experiments.cone.sweet.threshold", {
          threshold: formatNumber(thresholdDeg(ex), 1, locale),
          slope: formatNumber(ex.rails.slope_deg, 1, locale),
        })}
      </p>
      <Figures
        tiles={[
          {
            key: "threshold",
            label: t("experiments.cone.figures.threshold"),
            value: thresholdDeg(ex),
            digits: 1,
            unit: "°",
          },
          ...(run.stopped_at_s === null
            ? []
            : [
                {
                  key: "time",
                  label: t("experiments.cone.figures.time"),
                  value: run.stopped_at_s,
                  digits: 2,
                  unit: "s",
                },
              ]),
        ]}
      />
      <p>{t("experiments.cone.sweet.exact")}</p>
    </>
  );
}

/** How the engine computes the roll: one coordinate, Lagrange's equation. */
function ConeComputed() {
  const { t } = useTranslation();
  const c = (key: string) => t(`experiments.cone.computed.${key}`);
  return (
    <Equation
      tex={String.raw`\tfrac12\,(1 + m^2)\left(1 + \frac{3}{10}\frac{R^2}{\rho(x)^2}\right)\dot x^2 + g\,m\,x = \text{const}`}
      reads={c("energy")}
      symbols={[
        { tex: "m", meaning: c("m") },
        { tex: String.raw`\rho`, meaning: c("rho"), unit: "m" },
        { tex: String.raw`\dot x`, meaning: c("x_dot"), unit: "m/s" },
        { tex: "g", meaning: c("g"), unit: "m/s²" },
      ]}
    />
  );
}
