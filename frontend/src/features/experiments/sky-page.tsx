import { useEffect, useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Switch } from "@eifi1/ui-kit";
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
import { WAVELENGTHS_NM, css, lamp, onScreen, seen } from "./simulate/colour";
import {
  BLUE_NM,
  LAMP_K,
  RED_NM,
  SUN_K,
  airMass,
  brightness,
  endLight,
  figures,
  hue,
  ozoneLight,
  sideAt,
  sideLight,
  skyLight,
  sunLight,
  type Tube,
} from "./simulate/sky";
import { SIDE } from "./stage";
import { useExperimentsDefaults } from "./use-experiments";

/**
 * The tube's drawing: the lamp, the tube from `left` to `right`, the window at
 * its end (centre `eyeX`, radius `eyeR`), and the line its two captions stand
 * on, above it (`caption`).
 */
const TUBE = {
  width: 400,
  height: 150,
  left: 62,
  right: 318,
  top: 44,
  bottom: 82,
  lampX: 30,
  eyeX: 362,
  eyeR: 24,
  caption: 30,
} as const;
/** The tube's colour is computed at this many places along it, a gradient between them. */
const SLICES = 64;
/** The sky's drawing: the horizon, and the arc the sun moves along. */
const SKY = { width: 400, height: 220, horizon: 178, cx: 200, arc: 150, sun: 13 } as const;
/** The cloudiness the slider spans, per metre at 550 nm. */
const CLOUDINESS = { min: 0.1, max: 4 } as const;
/** The preview's tube clouds over and clears again in this long, s. */
const PREVIEW_CYCLE_S = 12;
/** The sun's height the sky starts at, degrees. */
const START_HEIGHT_DEG = 30;
const GREEN_NM = 550;
/** Ozone's band is strongest here (its Chappuis band). */
const ORANGE_NM = 600;
const ROOM = "#0b0d12";
const INK = "#c9ced8";
const CHART_POINTS = 121;
const BLUE_HUE = 2;
const GREEN_HUE = 0;
const RED_HUE = 4;

const sunSpectrum = lamp(SUN_K);
const lampSpectrum = lamp(LAMP_K);
/**
 * The sky is drawn as bright as it is against the sky with the sun overhead (with
 * ozone), whose brightest channel is full: one exposure with ozone and without.
 */
const NOON_SKY = Math.max(...seen(sunSpectrum, skyLight(90)));
/** A spectrum's share at one of the engine's wavelengths. */
const at = (spectrum: readonly number[], nm: number) => spectrum[WAVELENGTHS_NM.indexOf(nm)];

/**
 * Why the sky is blue (`experiments.sky`): white light through a cloudy tube,
 * blue from the side and orange at the end, and the sun's light through the
 * air, from the browser port (`simulate/sky.ts`, held to the engine by
 * `simulate.test.ts`). No route.
 */
export function SkyPage() {
  const { t } = useTranslation();
  const defaults = useExperimentsDefaults();
  const data = defaults.data?.sky;
  const [built, setTube] = useState<Tube | null>(null);
  const tube = built ?? data ?? null;
  return (
    <ExhibitFrame
      exhibit="sky"
      atTheExhibit={
        <>
          <p>{t("experiments.sky.at.tube")}</p>
          <p>{t("experiments.sky.at.side")}</p>
          <p>{t("experiments.sky.at.end")}</p>
        </>
      }
      whatHappens={<SkyModel />}
      computed={<SkyComputed />}
      sweetSpot={<SkyTrick />}
    >
      {defaults.isPending || !tube ? (
        <BuildPending pending={defaults.isPending} error={defaults.error} />
      ) : (
        <>
          <TubePlay tube={tube} onChange={setTube} />
          <TubeBuild tube={tube} onChange={setTube} />
          <SunPlay />
        </>
      )}
    </ExhibitFrame>
  );
}

/** The tube clouding over and clearing again: blue creeping back towards the lamp, the end reddening. */
export function SkyPreview({ paused }: PreviewProps) {
  const defaults = useExperimentsDefaults();
  const data = defaults.data?.sky;
  return data ? <TubePlay tube={data} preview paused={paused} /> : <PreviewPending />;
}

/** The lamp, the tube coloured slice by slice as its side looks, and the lamp seen through its end. */
function TubeView({ tube }: { tube: Tube }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const gradient = useId();
  const span = TUBE.right - TUBE.left;
  const stops = Array.from({ length: SLICES + 1 }, (_, k) =>
    css(hue(lampSpectrum, sideLight(tube, (tube.length_m * k) / SLICES))),
  );
  const shown = figures(tube);
  const mark = (m: number) => TUBE.left + (span * m) / tube.length_m;
  const cy = (TUBE.top + TUBE.bottom) / 2;
  return (
    <svg
      viewBox={`0 0 ${TUBE.width} ${TUBE.height}`}
      role="img"
      aria-label={t("experiments.sky.tube_view")}
      className="w-full rounded-lg border border-subtle"
      style={{ background: ROOM }}
    >
      {/* The lamp and its light going in. */}
      <circle cx={TUBE.lampX} cy={cy} r={13} fill="#fff1c9" />
      {[-1, 0, 1].map((k) => (
        <line key={k} x1={TUBE.lampX + 16} y1={cy + 9 * k} x2={TUBE.left - 4} y2={cy + 9 * k} stroke="#fff1c9" />
      ))}
      <defs>
        <linearGradient id={gradient}>
          {stops.map((colour, k) => (
            <stop key={k} offset={k / SLICES} stopColor={colour} />
          ))}
        </linearGradient>
      </defs>
      <rect x={TUBE.left} y={TUBE.top} width={span} height={TUBE.bottom - TUBE.top} rx={6} fill={`url(#${gradient})`} />
      <rect
        x={TUBE.left}
        y={TUBE.top}
        width={span}
        height={TUBE.bottom - TUBE.top}
        rx={6}
        fill="none"
        stroke={INK}
        strokeWidth={1.5}
      />
      {/* The far end, looked into: the lamp's light that came through. */}
      <circle cx={TUBE.eyeX} cy={cy} r={TUBE.eyeR} fill={css(hue(lampSpectrum, endLight(tube)))} stroke={INK} />
      {/* The captions above, where nothing else is drawn: the side's flush with
          the tube's left end, the end's with the window's right edge, so a long
          one grows to the left, over the tube. Centred under the window, the
          end's ran past the drawing's edge and was cut (Spanish, French,
          Hungarian; the German touched it), and below, the marks' labels pass. */}
      <text x={TUBE.left} y={TUBE.caption} fontSize={13} fill={INK}>
        {t("experiments.sky.play.side")}
      </text>
      <text x={TUBE.eyeX + TUBE.eyeR} y={TUBE.caption} fontSize={13} fill={INK} textAnchor="end">
        {t("experiments.sky.play.end")}
      </text>
      {[
        { m: shown.blue_half_m, label: t("experiments.sky.play.half_mark") },
        { m: shown.red_wins_m, label: t("experiments.sky.play.red_mark") },
      ]
        .filter(({ m }) => m <= tube.length_m)
        .map(({ m, label }, k) => (
          <g key={label}>
            <line x1={mark(m)} y1={TUBE.bottom} x2={mark(m)} y2={TUBE.bottom + 10 + 16 * k} stroke={INK} />
            <text x={mark(m)} y={TUBE.bottom + 22 + 16 * k} fontSize={12} fill={INK} textAnchor="middle">
              {label}
            </text>
          </g>
        ))}
      <text x={TUBE.left} y={TUBE.height - 8} fontSize={12} fill={INK}>
        0 m
      </text>
      <text x={TUBE.right} y={TUBE.height - 8} fontSize={12} fill={INK} textAnchor="end">
        {`${formatNumber(tube.length_m, 2, locale)} m`}
      </text>
    </svg>
  );
}

function TubePlay({
  tube,
  onChange,
  preview = false,
  paused = false,
}: { tube: Tube; onChange?: (next: Tube) => void } & PreviewMode) {
  const { t } = useTranslation();
  const [time, setTime] = useState(0);
  useEffect(() => {
    if (!preview || paused) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      setTime((s) => s + Math.max(0, Math.min(0.05, (now - last) / 1000)));
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [preview, paused]);
  const shownTube = preview
    ? { ...tube, cloudiness_per_m: 0.3 + 1.35 * (1 - Math.cos((2 * Math.PI * time) / PREVIEW_CYCLE_S)) }
    : tube;
  const view = <TubeView tube={shownTube} />;
  if (preview) return view;
  return (
    <WidgetCard title={t("experiments.sky.play.title")} hint={t("experiments.sky.play.hint")}>
      <div className={`${SIDE.grid} ${SIDE.cap.xl}`}>
        <div className={SIDE.top}>
          <SliderField
            label={t("experiments.sky.play.cloudiness")}
            unit="1/m"
            value={tube.cloudiness_per_m}
            min={CLOUDINESS.min}
            max={CLOUDINESS.max}
            step={0.05}
            digits={2}
            hint={t("experiments.sky.play.cloudiness_hint")}
            onChange={(v) => onChange?.({ ...tube, cloudiness_per_m: v })}
          />
        </div>
        <div className={`${SIDE.views} mx-auto w-full max-w-xl`}>
          <figure className="space-y-1">
            {view}
            <figcaption className="text-center text-caption text-muted">{t("experiments.sky.play.caption")}</figcaption>
          </figure>
        </div>
        <div className={SIDE.column}>
          <TubeFigures tube={tube} />
        </div>
      </div>
    </WidgetCard>
  );
}

function TubeFigures({ tube }: { tube: Tube }) {
  const { t } = useTranslation();
  const shown = useMemo(() => figures(tube), [tube]);
  return (
    <Figures
      tiles={[
        {
          key: "ratio",
          label: t("experiments.sky.figures.blue_over_red"),
          value: shown.blue_over_red,
          digits: 1,
          unit: "×",
        },
        {
          key: "half",
          label: t("experiments.sky.figures.blue_half"),
          value: shown.blue_half_m * 100,
          digits: 0,
          unit: "cm",
        },
        {
          key: "red",
          label: t("experiments.sky.figures.red_wins"),
          value: shown.red_wins_m <= tube.length_m ? shown.red_wins_m * 100 : null,
          digits: 0,
          unit: "cm",
        },
        {
          key: "end",
          label: t("experiments.sky.figures.end_brightness"),
          value: shown.end_brightness * 100,
          digits: 0,
          unit: "%",
        },
        {
          key: "end_blue",
          label: t("experiments.sky.figures.end_blue"),
          value: shown.end_blue * 100,
          digits: 1,
          unit: "%",
        },
        {
          key: "end_red",
          label: t("experiments.sky.figures.end_red"),
          value: shown.end_red * 100,
          digits: 0,
          unit: "%",
        },
      ]}
    />
  );
}

function TubeBuild({ tube, onChange }: { tube: Tube; onChange: (next: Tube) => void }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  const rows = useMemo(
    () =>
      Array.from({ length: CHART_POINTS }, (_, k) => {
        const x = (tube.length_m * k) / (CHART_POINTS - 1);
        return {
          cm: x * 100,
          blue: sideAt(tube, x, BLUE_NM),
          green: sideAt(tube, x, GREEN_NM),
          red: sideAt(tube, x, RED_NM),
        };
      }),
    [tube],
  );
  return (
    <WidgetCard title={t("experiments.sky.change.title")} hint={t("experiments.sky.change.hint")}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SliderField
          label={t("experiments.sky.change.length")}
          unit="m"
          value={tube.length_m}
          min={0.2}
          max={3}
          step={0.05}
          digits={2}
          hint={t("experiments.sky.change.length_hint")}
          onChange={(v) => onChange({ ...tube, length_m: v })}
        />
      </div>
      <p className="text-sm text-secondary">{t("experiments.sky.chart.side_hint")}</p>
      <SeriesChart
        rows={rows}
        series={[
          { key: "blue", label: t("experiments.sky.chart.blue"), color: hex[BLUE_HUE % hex.length] },
          { key: "green", label: t("experiments.sky.chart.green"), color: hex[GREEN_HUE % hex.length] },
          { key: "red", label: t("experiments.sky.chart.red"), color: hex[RED_HUE % hex.length] },
        ]}
        axes={[
          {
            id: "y",
            title: t("experiments.sky.chart.side"),
            format: (v) => formatNumber(v, 1, locale),
            includeZero: true,
          },
        ]}
        x={{
          key: "cm",
          title: `${t("experiments.sky.chart.along")} (cm)`,
          format: (v) => formatNumber(v, 0, locale),
        }}
      />
    </WidgetCard>
  );
}

/** The sky overhead in its colour, the ground, and the sun at its height in its own. */
function SkyView({ heightDeg, ozone }: { heightDeg: number; ozone: boolean }) {
  const { t } = useTranslation();
  const rad = (heightDeg * Math.PI) / 180;
  const sunX = SKY.cx - SKY.arc * Math.cos(rad);
  const sunY = SKY.horizon - SKY.arc * Math.sin(rad);
  const sunFill = css(hue(sunSpectrum, sunLight(heightDeg, ozone)));
  return (
    <svg
      viewBox={`0 0 ${SKY.width} ${SKY.height}`}
      role="img"
      aria-label={t("experiments.sky.sky_view")}
      className="w-full rounded-lg border border-subtle"
      style={{ background: ROOM }}
    >
      <rect
        width={SKY.width}
        height={SKY.horizon}
        fill={css(onScreen(seen(sunSpectrum, skyLight(heightDeg, ozone)).map((c) => c / NOON_SKY)))}
      />
      <circle cx={sunX} cy={sunY} r={SKY.sun * 1.9} fill={sunFill} fillOpacity={0.3} />
      <circle cx={sunX} cy={sunY} r={SKY.sun} fill={sunFill} />
      <rect y={SKY.horizon} width={SKY.width} height={SKY.height - SKY.horizon} fill="#1d2a1f" />
    </svg>
  );
}

function SunPlay() {
  const { t } = useTranslation();
  const [height, setHeight] = useState(START_HEIGHT_DEG);
  const [ozone, setOzone] = useState(true);
  const sun = sunLight(height, ozone);
  return (
    <WidgetCard title={t("experiments.sky.air.title")} hint={t("experiments.sky.air.hint")}>
      <div className={`${SIDE.grid} ${SIDE.cap.xl}`}>
        <div className={SIDE.top}>
          <SliderField
            label={t("experiments.sky.air.height")}
            unit="°"
            value={height}
            min={0}
            max={90}
            step={0.5}
            digits={1}
            hint={t("experiments.sky.air.height_hint")}
            onChange={setHeight}
          />
          <Switch
            label={t("experiments.sky.air.ozone")}
            description={t("experiments.sky.air.ozone_hint")}
            checked={ozone}
            onCheckedChange={setOzone}
          />
        </div>
        <div className={`${SIDE.views} mx-auto w-full max-w-xl`}>
          <figure className="space-y-1">
            <SkyView heightDeg={height} ozone={ozone} />
            <figcaption className="text-center text-caption text-muted">{t("experiments.sky.air.caption")}</figcaption>
          </figure>
        </div>
        <div className={SIDE.column}>
          <Figures
            tiles={[
              { key: "mass", label: t("experiments.sky.air.air_mass"), value: airMass(height), digits: 1 },
              {
                key: "light",
                label: t("experiments.sky.air.brightness"),
                value: brightness(sunSpectrum, sun) * 100,
                digits: 0,
                unit: "%",
              },
              {
                key: "blue",
                label: t("experiments.sky.air.blue"),
                value: at(sun, BLUE_NM) * 100,
                digits: 0,
                unit: "%",
              },
              { key: "red", label: t("experiments.sky.air.red"), value: at(sun, RED_NM) * 100, digits: 0, unit: "%" },
              ...(ozone
                ? [
                    {
                      key: "ozone",
                      label: t("experiments.sky.air.ozone_takes"),
                      value: (1 - at(ozoneLight(height), ORANGE_NM)) * 100,
                      digits: 0,
                      unit: "%",
                    },
                  ]
                : []),
            ]}
          />
        </div>
      </div>
    </WidgetCard>
  );
}

function SkyModel() {
  const { t } = useTranslation();
  const s = (key: string) => t(`experiments.sky.symbols.${key}`);
  return (
    <>
      <p>{t("experiments.sky.model.intro")}</p>
      <Equation
        tex={String.raw`\beta(\lambda) = \beta_{550}\left(\frac{550\,\mathrm{nm}}{\lambda}\right)^4`}
        reads={t("experiments.sky.model.rayleigh")}
        symbols={[
          { tex: String.raw`\beta`, meaning: s("beta"), unit: "1/m" },
          { tex: String.raw`\beta_{550}`, meaning: s("beta0"), unit: "1/m" },
          { tex: String.raw`\lambda`, meaning: s("lambda"), unit: "nm" },
        ]}
      />
      <Equation
        tex={String.raw`I(x, \lambda) = S(\lambda)\,e^{-\beta(\lambda)\,x}`}
        reads={t("experiments.sky.model.beer")}
        symbols={[
          { tex: "I", meaning: s("i"), unit: "1" },
          { tex: "S", meaning: s("s"), unit: "1" },
          { tex: "x", meaning: s("x"), unit: "m" },
        ]}
      />
      <Equation
        tex={String.raw`I_{\text{side}} \propto \beta(\lambda)\,S(\lambda)\,e^{-\beta(\lambda)\,(x + a)}`}
        reads={t("experiments.sky.model.side")}
        symbols={[{ tex: "a", meaning: s("a"), unit: "m" }]}
      />
      <Equation
        tex={String.raw`I_{\text{sky}} \propto \frac{1 + \sin^2 h}{2}\, S(\lambda)\,\frac{e^{-\tau(\lambda)} - e^{-m\,\tau(\lambda)}}{m - 1}`}
        reads={t("experiments.sky.model.sky")}
        symbols={[
          { tex: String.raw`\tau`, meaning: s("tau"), unit: "1" },
          { tex: "m", meaning: s("m"), unit: "1" },
          { tex: "h", meaning: s("h"), unit: "°" },
        ]}
      />
      <Equation
        tex={String.raw`T_3(\lambda) = e^{-m_3\,\sigma(\lambda)\,N}`}
        reads={t("experiments.sky.model.ozone")}
        symbols={[
          { tex: "T_3", meaning: s("t3"), unit: "1" },
          { tex: String.raw`\sigma`, meaning: s("sigma"), unit: "cm²" },
          { tex: "N", meaning: s("n"), unit: "1/cm²" },
        ]}
      />
      <Equation
        tex={String.raw`m_3 = \frac{1}{\sqrt{1 - \left(\frac{R}{R + H}\right)^2 \cos^2 h}}`}
        reads={t("experiments.sky.model.ozone_mass")}
        symbols={[
          { tex: "m_3", meaning: s("m3"), unit: "1" },
          { tex: "R", meaning: s("r"), unit: "km" },
          { tex: "H", meaning: s("hh"), unit: "km" },
          { tex: "h", meaning: s("h"), unit: "°" },
        ]}
      />
    </>
  );
}

function SkyTrick() {
  const { t } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  const rows = useMemo(
    () =>
      Array.from({ length: CHART_POINTS }, (_, k) => {
        const h = (90 * k) / (CHART_POINTS - 1);
        const sun = sunLight(h);
        return { h, blue: at(sun, BLUE_NM) * 100, red: at(sun, RED_NM) * 100 };
      }),
    [],
  );
  return (
    <>
      <p>{t("experiments.sky.sweet.same")}</p>
      <p>{t("experiments.sky.sweet.sunset")}</p>
      <p>{t("experiments.sky.sweet.not_violet")}</p>
      <p>{t("experiments.sky.sweet.ozone")}</p>
      <p className="text-sm text-secondary">{t("experiments.sky.chart.sun_hint")}</p>
      <SeriesChart
        rows={rows}
        series={[
          { key: "blue", label: t("experiments.sky.chart.blue"), color: hex[BLUE_HUE % hex.length] },
          { key: "red", label: t("experiments.sky.chart.red"), color: hex[RED_HUE % hex.length] },
        ]}
        axes={[
          {
            id: "y",
            title: `${t("experiments.sky.chart.sun")} (%)`,
            format: (v) => formatNumber(v, 0, locale),
            includeZero: true,
          },
        ]}
        x={{
          key: "h",
          title: `${t("experiments.sky.chart.height")} (°)`,
          format: (v) => formatNumber(v, 0, locale),
        }}
      />
    </>
  );
}

function SkyComputed() {
  const { t } = useTranslation();
  const c = (key: string) => t(`experiments.sky.computed.${key}`);
  return (
    <>
      <p>{c("system")}</p>
      <p>{c("colours")}</p>
      <p>{c("check")}</p>
      <p>{c("left_out")}</p>
    </>
  );
}
