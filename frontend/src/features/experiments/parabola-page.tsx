import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pause, Play, RotateCcw } from "lucide-react";
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
import { ParabolaSideView, ParabolaTopView } from "./parabola-views";
import { PreviewPending, type PreviewMode, type PreviewProps } from "./preview-mode";
import { startsRunning } from "./play";
import {
  SPIN_STEP_S,
  dryRate,
  spillRate,
  spin,
  spinStep,
  spinUpTimeS,
  surface,
  type Vessel,
} from "./simulate/parabola";
import { SIDE, STAGE } from "./stage";
import { useExperimentsDefaults } from "./use-experiments";

/** Real time, or ten times faster: the water takes half a minute to follow. */
const SPEEDS = [1, 10] as const;
type Speed = (typeof SPEEDS)[number];

/** Turns a minute ↔ radians a second. */
const RPM = (2 * Math.PI) / 60;

/** The tempo the page starts at: well short of the dry middle, in turns a minute. */
const START_RPM = 90;

/** The preview's turntable: up to 110 turns a minute and back down, ten times
 *  faster than real time, so the water's lag shows within its loop. */
const PREVIEW_SPEED = 10;
const PREVIEW_CYCLE_S = 160;
const PREVIEW_RPM = 110;

function previewTarget(t: number): number {
  return t % PREVIEW_CYCLE_S < PREVIEW_CYCLE_S / 2 ? PREVIEW_RPM : 0;
}

type Frame = "outside" | "turning";

/** Whether the vessel's build is one the engine takes: the water below the top. */
export function wellFilled(v: Vessel): boolean {
  return v.fill_m > 0 && v.fill_m < v.height_m;
}

/**
 * The water parabola (`experiments.parabola`). The surface, the rates and the
 * water's spin-up are the browser port's (`simulate/parabola.ts`, held to the
 * engine by `simulate.test.ts`): no route, since the water follows the
 * turntable frame by frame.
 */
export function ParabolaPage() {
  const { t } = useTranslation();
  const defaults = useExperimentsDefaults();
  const [build, setBuild] = useState<Vessel | null>(null);
  const v = build ?? defaults.data?.parabola ?? null;
  const [rate, setRate] = useState(START_RPM * RPM);

  return (
    <ExhibitFrame
      exhibit="parabola"
      atTheExhibit={
        <>
          <p>{t("experiments.parabola.at.vessel")}</p>
          <p>{t("experiments.parabola.at.dry")}</p>
        </>
      }
      whatHappens={<ParabolaModel />}
      computed={<ParabolaComputed />}
      sweetSpot={<ParabolaTrick v={v && wellFilled(v) ? v : null} rate={rate} refused={!!v && !wellFilled(v)} />}
    >
      {defaults.isPending || !v ? (
        <BuildPending pending={defaults.isPending} error={defaults.error} />
      ) : (
        <>
          {wellFilled(v) ? (
            <ParabolaPlay key={JSON.stringify(v)} v={v} target={rate} onTarget={setRate} />
          ) : (
            <AlertBanner tone="warning">{t("experiments.parabola.refused")}</AlertBanner>
          )}
          <ParabolaBuild v={v} onChange={setBuild} />
        </>
      )}
    </ExhibitFrame>
  );
}

/** The turntable switched on and off, ten times faster, for the overview. */
export function ParabolaPreview({ paused }: PreviewProps) {
  const defaults = useExperimentsDefaults();
  const v = defaults.data?.parabola;
  return v ? <ParabolaPlay v={v} preview paused={paused} target={0} /> : <PreviewPending />;
}

interface View {
  water: number;
  vesselAngle: number;
  waterAngle: number;
}

function ParabolaPlay({
  v,
  target,
  onTarget,
  preview = false,
  paused = false,
}: { v: Vessel; target: number; onTarget?: (rate: number) => void } & PreviewMode) {
  const { t } = useTranslation();
  // The page's turntable has been running before the reader came: the water
  // turns with it. The preview starts from rest.
  const sim = useRef({ water: preview ? 0 : target, vesselAngle: 0, waterAngle: 0, clock: 0, owed: 0 });
  const [runningHere, setRunning] = useState(startsRunning);
  const [speedHere, setSpeed] = useState<Speed>(1);
  const [frame, setFrame] = useState<Frame>("outside");
  const [view, setView] = useState<View>(() => ({ water: preview ? 0 : target, vesselAngle: 0, waterAngle: 0 }));
  const running = preview ? !paused : runningHere;
  const speed = preview ? PREVIEW_SPEED : speedHere;

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      // A frame's timestamp can lie a little before the effect started: never a
      // step back in time.
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      const s = sim.current;
      const vessel = preview ? previewTarget(s.clock) * RPM : target;
      s.owed += (dt * speed) / SPIN_STEP_S;
      const steps = Math.floor(s.owed);
      s.owed -= steps;
      for (let k = 0; k < steps; k++) {
        s.water = spinStep(v, vessel, s.water, s.clock);
        s.clock += SPIN_STEP_S;
      }
      // The picture turns at what the eye can follow: the true angle would be a
      // blur at ten times real speed, so the angles advance in real time.
      s.vesselAngle += vessel * dt;
      s.waterAngle += s.water * dt;
      setView({ water: s.water, vesselAngle: s.vesselAngle, waterAngle: s.waterAngle });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, speed, preview, target, v]);

  const turning = frame === "turning";
  const vesselAngle = turning ? 0 : view.vesselAngle;
  const waterAngle = turning ? view.waterAngle - view.vesselAngle : view.waterAngle;
  const side = <ParabolaSideView v={v} rate={view.water} />;
  if (preview) return side;

  const s = surface(v, view.water);
  const tau = spinUpTimeS(v, Math.max(target, view.water));
  return (
    <WidgetCard
      title={t("experiments.parabola.play.title")}
      hint={t("experiments.parabola.play.hint")}
      actions={
        <>
          <Button variant="secondary" size="sm" onClick={() => setRunning(!running)}>
            {running ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
            {running ? t("experiments.parabola.play.pause") : t("experiments.parabola.play.run")}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onTarget?.(0)}>
            <RotateCcw className="size-4" aria-hidden />
            {t("experiments.parabola.play.stop")}
          </Button>
        </>
      }
    >
      <div className={`${SIDE.grid} ${STAGE.twoWithSide}`}>
        <div className={`${SIDE.top} flex flex-wrap gap-4`}>
          <ToggleGroup
            label={t("experiments.parabola.play.frame")}
            labelPlacement="above"
            size="sm"
            value={frame}
            onChange={(f: Frame) => setFrame(f)}
            options={(["outside", "turning"] as const).map((f) => ({
              value: f,
              label: t(`experiments.parabola.play.frames.${f}`),
            }))}
          />
          <ToggleGroup
            label={t("experiments.parabola.play.speed")}
            labelPlacement="above"
            size="sm"
            value={String(speed)}
            onChange={(x: string) => setSpeed(Number(x) as Speed)}
            options={SPEEDS.map((x) => ({ value: String(x), label: t(`experiments.parabola.play.speeds.${x}`) }))}
          />
        </div>
        <div className={SIDE.views}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <figure className="space-y-1">
              {side}
              <figcaption className="text-center text-caption text-muted">
                {t("experiments.parabola.views.side_caption")}
              </figcaption>
            </figure>
            <figure className="mx-auto w-full max-w-xs space-y-1">
              <ParabolaTopView v={v} vesselAngle={vesselAngle} waterAngle={waterAngle} />
              <figcaption className="text-center text-caption text-muted">
                {t(`experiments.parabola.views.top_caption_${frame}`)}
              </figcaption>
            </figure>
          </div>
        </div>
        <div className={SIDE.column}>
          <SliderField
            label={t("experiments.parabola.play.rate")}
            unit={t("experiments.parabola.play.rpm")}
            value={target / RPM}
            min={0}
            max={240}
            step={1}
            digits={0}
            hint={t("experiments.parabola.play.rate_hint")}
            onChange={(x) => onTarget?.(x * RPM)}
          />
          {s.spills && <AlertBanner tone="warning">{t("experiments.parabola.play.spills")}</AlertBanner>}
          <Figures
            tiles={[
              {
                key: "water",
                label: t("experiments.parabola.play.water"),
                value: view.water / RPM,
                digits: 0,
                unit: t("experiments.parabola.play.rpm"),
              },
              {
                key: "centre",
                label: t("experiments.parabola.play.centre"),
                value: s.centre_m * 100,
                digits: 1,
                unit: "cm",
              },
              { key: "rim", label: t("experiments.parabola.play.rim"), value: s.rim_m * 100, digits: 1, unit: "cm" },
              ...(tau === null
                ? []
                : [{ key: "tau", label: t("experiments.parabola.play.tau"), value: tau, digits: 0, unit: "s" }]),
            ]}
          />
        </div>
      </div>
    </WidgetCard>
  );
}

function ParabolaBuild({ v, onChange }: { v: Vessel; onChange: (next: Vessel) => void }) {
  const { t } = useTranslation();
  return (
    <WidgetCard title={t("experiments.parabola.change.title")} hint={t("experiments.parabola.change.hint")}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SliderField
          label={t("experiments.parabola.change.radius")}
          unit="cm"
          value={v.radius_m * 100}
          min={5}
          max={50}
          step={1}
          digits={0}
          onChange={(x) => onChange({ ...v, radius_m: x / 100 })}
        />
        <SliderField
          label={t("experiments.parabola.change.fill")}
          unit="cm"
          value={v.fill_m * 100}
          min={2}
          max={40}
          step={1}
          digits={0}
          onChange={(x) => onChange({ ...v, fill_m: x / 100 })}
        />
        <SliderField
          label={t("experiments.parabola.change.height")}
          unit="cm"
          value={v.height_m * 100}
          min={5}
          max={60}
          step={1}
          digits={0}
          onChange={(x) => onChange({ ...v, height_m: x / 100 })}
        />
      </div>
    </WidgetCard>
  );
}

function ParabolaModel() {
  const { t } = useTranslation();
  const s = (key: string) => t(`experiments.parabola.symbols.${key}`);
  return (
    <>
      <p>{t("experiments.parabola.model.intro")}</p>
      <Equation
        tex={String.raw`z(r) = z_0 + \frac{\omega^2 r^2}{2g}`}
        reads={t("experiments.parabola.model.surface")}
        symbols={[
          { tex: "z", meaning: s("z"), unit: "m" },
          { tex: "r", meaning: s("r"), unit: "m" },
          { tex: "z_0", meaning: s("z0"), unit: "m" },
          { tex: String.raw`\omega`, meaning: s("omega"), unit: "1/s" },
          { tex: "g", meaning: s("g"), unit: "m/s²" },
        ]}
      />
      <Equation
        tex={String.raw`z_0 = h - \frac{\omega^2 R^2}{4g}`}
        reads={t("experiments.parabola.model.volume")}
        symbols={[
          { tex: "h", meaning: s("h"), unit: "m" },
          { tex: "R", meaning: s("radius"), unit: "m" },
        ]}
      />
      <Equation
        tex={String.raw`\omega_{\text{dry}} = \frac{2\sqrt{g\,h}}{R}`}
        reads={t("experiments.parabola.model.dry")}
        symbols={[{ tex: String.raw`\omega_{\text{dry}}`, meaning: s("dry"), unit: "1/s" }]}
      />
    </>
  );
}

function ParabolaTrick({ v, rate, refused = false }: { v: Vessel | null; rate: number; refused?: boolean }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  const s = (key: string) => t(`experiments.parabola.symbols.${key}`);
  const rows = useMemo(() => {
    if (!v) return [];
    const top = Math.max(spillRate(v), dryRate(v)) * 1.1;
    return Array.from({ length: 61 }, (_, i) => {
      const w = (top * i) / 60;
      const surf = surface(v, w);
      return { rpm: w / RPM, centre: surf.centre_m * 100, rim: surf.rim_m * 100 };
    });
  }, [v]);
  // Switched on from rest to the rate on the slider: the water's rate, the
  // engine's spin-up replayed by the port, over three spin-up times.
  const spinUp = useMemo(() => {
    if (!v || rate <= 0) return [];
    const tau = spinUpTimeS(v, rate) ?? 1;
    const r = spin(v, rate, Math.min(3 * tau, 300), 0, 0.05);
    return r.t.map((time, i) => ({ t: time, water: r.water_rate[i] / RPM, vessel: rate / RPM }));
  }, [v, rate]);
  // A vessel filled over its top has nothing to wait for: say so, not "Loading".
  if (refused) return <p className="text-secondary">{t("experiments.parabola.refused")}</p>;
  if (!v) return <LoadingState className="py-6" label={t("common.loading")} />;
  const now = surface(v, rate);
  const drop = (v.fill_m - now.centre_m) * 100;
  return (
    <>
      <p>
        {now.dry_radius_m > 0
          ? t("experiments.parabola.sweet.dry", { rpm: formatNumber(dryRate(v) / RPM, 0, locale) })
          : t("experiments.parabola.sweet.equal", {
              rpm: formatNumber(rate / RPM, 0, locale),
              drop: formatNumber(drop, 1, locale),
            })}
      </p>
      <SeriesChart
        rows={rows}
        series={[
          { key: "rim", label: t("experiments.parabola.chart.rim"), color: hex[0 % hex.length] },
          { key: "centre", label: t("experiments.parabola.chart.centre"), color: hex[2 % hex.length], dash: 1 },
        ]}
        axes={[
          {
            id: "y",
            title: `${t("experiments.parabola.chart.height")} (cm)`,
            format: (x) => formatNumber(x, 0, locale),
            includeZero: true,
          },
        ]}
        x={{
          key: "rpm",
          title: `${t("experiments.parabola.chart.rate")} (${t("experiments.parabola.play.rpm")})`,
          format: (x) => formatNumber(x, 0, locale),
        }}
        markers={[
          { x: rate / RPM, y: now.rim_m * 100, label: t("experiments.parabola.chart.you"), tone: "danger" as const },
        ]}
      />
      <Figures
        tiles={[
          {
            key: "dry",
            label: t("experiments.parabola.figures.dry"),
            value: dryRate(v) / RPM,
            digits: 0,
            unit: t("experiments.parabola.play.rpm"),
          },
          {
            key: "spill",
            label: t("experiments.parabola.figures.spill"),
            value: spillRate(v) / RPM,
            digits: 0,
            unit: t("experiments.parabola.play.rpm"),
          },
          ...(now.focus_m === null
            ? []
            : [
                {
                  key: "focus",
                  label: t("experiments.parabola.figures.focus"),
                  value: now.focus_m * 100,
                  digits: 1,
                  unit: "cm",
                },
              ]),
        ]}
      />
      {spinUp.length > 0 && (
        <>
          <p>
            {t("experiments.parabola.sweet.spin_up", {
              tau: formatNumber(spinUpTimeS(v, rate) ?? 0, 0, locale),
            })}
          </p>
          <SeriesChart
            rows={spinUp}
            series={[
              { key: "vessel", label: t("experiments.parabola.chart.vessel"), color: hex[6 % hex.length], dash: 1 },
              { key: "water", label: t("experiments.parabola.play.water"), color: hex[0 % hex.length] },
            ]}
            axes={[
              {
                id: "y",
                title: `${t("experiments.parabola.chart.rate")} (${t("experiments.parabola.play.rpm")})`,
                format: (x) => formatNumber(x, 0, locale),
                includeZero: true,
              },
            ]}
            x={{
              key: "t",
              title: `${t("experiments.parabola.chart.time")} (s)`,
              format: (x) => formatNumber(x, 0, locale),
            }}
          />
        </>
      )}
      <Equation
        tex={String.raw`f = \frac{g}{2\,\omega^2}`}
        reads={t("experiments.parabola.sweet.mirror")}
        symbols={[{ tex: "f", meaning: s("f"), unit: "m" }]}
      />
    </>
  );
}

/** How the water follows the turntable: one rate relaxing to another. */
function ParabolaComputed() {
  const { t } = useTranslation();
  const c = (key: string) => t(`experiments.parabola.computed.${key}`);
  return (
    <Equation
      tex={String.raw`\frac{d\omega}{dt} = \frac{\omega_v - \omega}{\tau}, \qquad \tau = \frac{h}{\sqrt{\nu\,\Omega}}`}
      reads={c("system")}
      symbols={[
        { tex: String.raw`\omega_v`, meaning: c("omega_v"), unit: "1/s" },
        { tex: String.raw`\tau`, meaning: c("tau"), unit: "s" },
        { tex: String.raw`\nu`, meaning: c("nu"), unit: "m²/s" },
        { tex: String.raw`\Omega`, meaning: c("big_omega"), unit: "1/s" },
      ]}
    />
  );
}
