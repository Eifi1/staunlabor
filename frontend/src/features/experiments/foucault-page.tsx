import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pause, Play, RotateCcw } from "lucide-react";
import { Button, LoadingState, ToggleGroup } from "@eifi1/ui-kit";
import { SeriesChart } from "@/shared/charts/series-chart";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber } from "@/shared/lib/format";
import { useChartHex } from "@/shared/state/palette-store";
import { SliderField } from "@/shared/ui/slider-field";
import { Figures, WidgetCard } from "@/shared/ui/widget";
import { Equation } from "./equation";
import { ExhibitFrame } from "./exhibit-frame";
import { BuildPending } from "./build-pending";
import { HeldAnswer, useHeld, type Held } from "./held";
import { PreviewPending, type PreviewMode, type PreviewProps } from "./preview-mode";
import { startsRunning } from "./play";
import {
  WINTERTHUR_DEG,
  degreesPerHour,
  fullTurnH,
  latitudeCurve,
  periodS,
  planeDeg,
  position,
  type FoucaultPendulum,
} from "./simulate/foucault";
import { SIDE } from "./stage";
import { useExperimentsDefaults } from "./use-experiments";

/** Real time, a minute a second, ten minutes a second, an hour a second. */
const SPEEDS = [1, 60, 600, 3600] as const;
type Speed = (typeof SPEEDS)[number];

/** Places to stand the pendulum in, by latitude. */
const PLACES: Record<"winterthur" | "pole" | "equator" | "sydney", number> = {
  winterthur: WINTERTHUR_DEG,
  pole: 90,
  equator: 0,
  sydney: -33.9,
};

/** Pins round the floor, the first a half-step off the release line. */
const PINS = 24;
/** The bob's trail: this many positions, one a frame. */
const TRAIL = 240;

const BOB_HUE = 2;
const PIN_HUE = 6;

/** Whether the turning plane has passed the pin at `pinDeg` after turning by
 *  `turnedDeg` (signed, anticlockwise positive): the swing's line reaches both
 *  ways, so a pin falls when either end gets to it. */
export function knocked(pinDeg: number, turnedDeg: number): boolean {
  const way = Math.sign(turnedDeg);
  if (way === 0) return false;
  const ahead = (((way * pinDeg) % 180) + 180) % 180;
  return ahead > 0 && ahead <= Math.abs(turnedDeg);
}

/**
 * Foucault's pendulum (`experiments.foucault`): the closed swing on the turning
 * Earth from the browser port (`simulate/foucault.ts`, held to the engine by
 * `simulate.test.ts`), so the clock runs up to an hour a second and the ring of
 * pins falls as the plane passes. No route.
 */
export function FoucaultPage() {
  const { t } = useTranslation();
  const defaults = useExperimentsDefaults();
  const [build, setBuild] = useState<FoucaultPendulum | null>(null);
  const held = useHeld();
  const p = build ?? defaults.data?.foucault ?? null;
  return (
    <ExhibitFrame
      exhibit="foucault"
      atTheExhibit={
        <>
          <p>{t("experiments.foucault.at.swing")}</p>
          <p>{t("experiments.foucault.at.pins")}</p>
        </>
      }
      whatHappens={<FoucaultModel />}
      computed={<FoucaultComputed />}
      sweetSpot={<FoucaultTrick p={p} />}
    >
      {defaults.isPending || !p ? (
        <BuildPending pending={defaults.isPending} error={defaults.error} />
      ) : (
        <>
          <FoucaultPlay key={JSON.stringify(p)} p={p} onChange={setBuild} held={held} />
          <FoucaultBuild p={p} onChange={setBuild} />
        </>
      )}
    </ExhibitFrame>
  );
}

/** Winterthur at an hour a second, for the overview. */
export function FoucaultPreview({ paused }: PreviewProps) {
  const defaults = useExperimentsDefaults();
  const p = defaults.data?.foucault;
  return p ? <FoucaultPlay p={p} preview paused={paused} /> : <PreviewPending />;
}

function FoucaultView({ p, time, trail }: { p: FoucaultPendulum; time: number; trail: Array<[number, number]> }) {
  const { t } = useTranslation();
  const hex = useChartHex();
  const A = p.amplitude_m;
  const reach = A * 1.3;
  const turned = planeDeg(p, time);
  const [bx, by] = position(p, time);
  const ring = A * 1.12;
  const line = (turned * Math.PI) / 180;
  // SVG's y runs down: north is drawn up, as a map's.
  return (
    <svg
      viewBox={`${-reach} ${-reach} ${2 * reach} ${2 * reach}`}
      role="img"
      aria-label={t("experiments.foucault.view")}
      className="aspect-square w-full rounded-lg border border-subtle bg-surface-2 text-muted"
    >
      <circle r={ring * 1.06} fill="none" stroke="currentColor" opacity={0.3} vectorEffect="non-scaling-stroke" />
      <line
        x1={-A * Math.cos(line)}
        y1={A * Math.sin(line)}
        x2={A * Math.cos(line)}
        y2={-A * Math.sin(line)}
        stroke="currentColor"
        strokeDasharray="4 4"
        opacity={0.5}
        vectorEffect="non-scaling-stroke"
      />
      {Array.from({ length: PINS }, (_, k) => {
        const deg = (360 * (k + 0.5)) / PINS;
        const a = (deg * Math.PI) / 180;
        const cx = ring * Math.cos(a);
        const cy = -ring * Math.sin(a);
        const down = knocked(deg, turned);
        const colour = hex[PIN_HUE % hex.length];
        return down ? (
          <line
            key={k}
            x1={cx}
            y1={cy}
            x2={cx + A * 0.07 * Math.cos(a)}
            y2={cy - A * 0.07 * Math.sin(a)}
            stroke={colour}
            strokeWidth={3}
            strokeLinecap="round"
            opacity={0.5}
            vectorEffect="non-scaling-stroke"
          />
        ) : (
          <circle key={k} cx={cx} cy={cy} r={A * 0.025} fill={colour} />
        );
      })}
      <polyline
        points={trail.map(([x, y]) => `${x},${-y}`).join(" ")}
        fill="none"
        stroke={hex[BOB_HUE % hex.length]}
        opacity={0.35}
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={bx} cy={-by} r={A * 0.05} fill={hex[BOB_HUE % hex.length]} />
      <circle r={A * 0.012} className="fill-current text-primary" />
    </svg>
  );
}

/** An hour under the pendulum: long enough to read its turn per hour off the
 *  figures, and then the full turn is the reader's to compare. */
const SEEN_AFTER_S = 3600;

function FoucaultPlay({
  p,
  onChange,
  held,
  preview = false,
  paused = false,
}: { p: FoucaultPendulum; onChange?: (next: FoucaultPendulum) => void; held?: Held } & PreviewMode) {
  const { t } = useTranslation();
  const locale = useLocale();
  const clock = useRef(0);
  const trail = useRef<Array<[number, number]>>([]);
  const [frame, setFrame] = useState<{ time: number; trail: Array<[number, number]> }>({ time: 0, trail: [] });
  const [runningHere, setRunning] = useState(startsRunning);
  const [speedHere, setSpeed] = useState<Speed>(60);
  const running = preview ? !paused : runningHere;
  const speed = preview ? 3600 : speedHere;
  const show = held?.show;

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      clock.current += dt * speed;
      if (clock.current >= SEEN_AFTER_S) show?.();
      trail.current.push(position(p, clock.current));
      if (trail.current.length > TRAIL) trail.current.shift();
      setFrame({ time: clock.current, trail: [...trail.current] });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, speed, p, show]);

  const view = <FoucaultView p={p} time={frame.time} trail={frame.trail} />;
  if (preview) return view;
  const restart = () => {
    clock.current = 0;
    trail.current = [];
    setFrame({ time: 0, trail: [] });
  };
  const hours = frame.time / 3600;
  return (
    <WidgetCard
      title={t("experiments.foucault.play.title")}
      hint={t("experiments.foucault.play.hint")}
      actions={
        <>
          <Button variant="secondary" size="sm" onClick={() => setRunning(!running)}>
            {running ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
            {running ? t("experiments.foucault.play.pause") : t("experiments.foucault.play.run")}
          </Button>
          <Button variant="secondary" size="sm" onClick={restart}>
            <RotateCcw className="size-4" aria-hidden />
            {t("experiments.foucault.play.restart")}
          </Button>
        </>
      }
    >
      <div className={`${SIDE.grid} ${SIDE.cap.xl}`}>
        <div className={`${SIDE.top} space-y-2`}>
          <p className="text-sm text-secondary">{t("experiments.foucault.play.places_label")}</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(PLACES) as Array<keyof typeof PLACES>).map((place) => (
              <Button
                key={place}
                variant={p.latitude_deg === PLACES[place] ? "accent" : "secondary"}
                size="sm"
                onClick={() => onChange?.({ ...p, latitude_deg: PLACES[place] })}
              >
                {t(`experiments.foucault.play.places.${place}`)}
              </Button>
            ))}
          </div>
        </div>
        <div className={`${SIDE.views} mx-auto w-full max-w-xl`}>{view}</div>
        <div className={SIDE.column}>
          <ToggleGroup
            label={t("experiments.foucault.play.speed")}
            labelPlacement="above"
            size="sm"
            overflow="wrap"
            value={String(speed)}
            onChange={(v: string) => setSpeed(Number(v) as Speed)}
            options={SPEEDS.map((v) => ({ value: String(v), label: t(`experiments.foucault.play.speeds.${v}`) }))}
          />
          <SliderField
            label={t("experiments.foucault.play.latitude")}
            unit="°"
            value={p.latitude_deg}
            min={-90}
            max={90}
            step={0.5}
            digits={1}
            hint={t("experiments.foucault.play.latitude_hint")}
            onChange={(v) => onChange?.({ ...p, latitude_deg: v })}
          />
          <Figures
            tiles={[
              { key: "hours", label: t("experiments.foucault.play.hours"), value: hours, digits: 1, unit: "h" },
              {
                key: "turned",
                label: t("experiments.foucault.play.turned"),
                value: -planeDeg(p, frame.time),
                digits: 1,
                unit: "°",
              },
              {
                key: "rate",
                label: t("experiments.foucault.play.rate"),
                value: degreesPerHour(p),
                digits: 1,
                unit: "°/h",
                held: !held?.shown,
              },
            ]}
          />
          {held && (
            <HeldAnswer held={held}>
              <p className="text-sm text-secondary">
                {fullTurnH(p) === null
                  ? t("experiments.foucault.play.never")
                  : t("experiments.foucault.play.full_turn", { hours: formatNumber(fullTurnH(p) ?? 0, 1, locale) })}
              </p>
            </HeldAnswer>
          )}
        </div>
      </div>
    </WidgetCard>
  );
}

function FoucaultBuild({ p, onChange }: { p: FoucaultPendulum; onChange: (next: FoucaultPendulum) => void }) {
  const { t } = useTranslation();
  return (
    <WidgetCard title={t("experiments.foucault.change.title")} hint={t("experiments.foucault.change.hint")}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SliderField
          label={t("experiments.foucault.change.length")}
          unit="m"
          value={p.length_m}
          min={2}
          max={70}
          step={1}
          digits={0}
          onChange={(v) => onChange({ ...p, length_m: v, amplitude_m: Math.min(p.amplitude_m, 0.1 * v) })}
        />
        <SliderField
          label={t("experiments.foucault.change.amplitude")}
          unit="cm"
          value={p.amplitude_m * 100}
          min={5}
          max={Math.round(p.length_m * 10)}
          step={1}
          digits={0}
          onChange={(v) => onChange({ ...p, amplitude_m: v / 100 })}
        />
      </div>
    </WidgetCard>
  );
}

function FoucaultModel() {
  const { t } = useTranslation();
  const s = (key: string) => t(`experiments.foucault.symbols.${key}`);
  return (
    <>
      <p>{t("experiments.foucault.model.intro")}</p>
      <Equation
        tex={String.raw`\ddot x = -\omega_0^2 x + 2\Omega_z \dot y, \qquad \ddot y = -\omega_0^2 y - 2\Omega_z \dot x`}
        reads={t("experiments.foucault.model.coriolis")}
        symbols={[
          { tex: "x, y", meaning: s("xy"), unit: "m" },
          { tex: String.raw`\omega_0 = \sqrt{g/L}`, meaning: s("omega0"), unit: "1/s" },
          { tex: String.raw`\Omega_z`, meaning: s("omega_z"), unit: "1/s" },
        ]}
      />
      <Equation
        tex={String.raw`\Omega_z = \Omega \sin\varphi`}
        reads={t("experiments.foucault.model.latitude")}
        symbols={[
          { tex: String.raw`\Omega`, meaning: s("omega"), unit: "1/s" },
          { tex: String.raw`\varphi`, meaning: s("phi"), unit: "°" },
        ]}
      />
    </>
  );
}

function FoucaultTrick({ p }: { p: FoucaultPendulum | null }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  const rows = useMemo(
    () => (p ? latitudeCurve(p).map((c) => ({ lat: c.latitude_deg, rate: c.degrees_per_hour })) : []),
    [p],
  );
  if (!p) return <LoadingState className="py-6" label={t("common.loading")} />;
  return (
    <>
      <p>
        {t("experiments.foucault.sweet.floor", {
          rate: formatNumber(degreesPerHour({ ...p, latitude_deg: WINTERTHUR_DEG }), 1, locale),
        })}
      </p>
      <SeriesChart
        rows={rows}
        series={[{ key: "rate", label: t("experiments.foucault.chart.rate"), color: hex[BOB_HUE % hex.length] }]}
        axes={[
          {
            id: "y",
            title: `${t("experiments.foucault.chart.rate")} (°/h)`,
            format: (v) => formatNumber(v, 0, locale),
          },
        ]}
        x={{
          key: "lat",
          title: `${t("experiments.foucault.chart.latitude")} (°)`,
          format: (v) => formatNumber(v, 0, locale),
        }}
        markers={[
          {
            x: p.latitude_deg,
            y: degreesPerHour(p),
            label: t("experiments.foucault.chart.here"),
            tone: "danger" as const,
          },
        ]}
      />
      <p>{t("experiments.foucault.sweet.period", { period: formatNumber(periodS(p), 1, locale) })}</p>
    </>
  );
}

function FoucaultComputed() {
  const { t } = useTranslation();
  const c = (key: string) => t(`experiments.foucault.computed.${key}`);
  return (
    <Equation
      tex={String.raw`\zeta(t) = A\, e^{-i\Omega_z t}\left(\cos\omega' t + i\,\frac{\Omega_z}{\omega'}\sin\omega' t\right)`}
      reads={c("system")}
      symbols={[
        { tex: String.raw`\zeta = x + i y`, meaning: c("zeta"), unit: "m" },
        { tex: "A", meaning: c("a"), unit: "m" },
        { tex: String.raw`\omega' = \sqrt{\omega_0^2 + \Omega_z^2}`, meaning: c("omega_p"), unit: "1/s" },
      ]}
    />
  );
}
