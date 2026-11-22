import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertBanner, LoadingState, Switch, ToggleGroup } from "@eifi1/ui-kit";
import { SeriesChart } from "@/shared/charts/series-chart";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber } from "@/shared/lib/format";
import { useChartHue } from "@/shared/state/palette-store";
import { SliderField } from "@/shared/ui/slider-field";
import { Figures, WidgetCard } from "@/shared/ui/widget";
import { Equation } from "./equation";
import { ExhibitFrame } from "./exhibit-frame";
import { BuildPending } from "./build-pending";
import { settingNumber, useCheckSetting } from "./check-setting";
import { PreviewPending, type PreviewMode, type PreviewProps } from "./preview-mode";
import { css, onScreen, type Rgb } from "./simulate/colour";
import { LASER_NM, figures, intensity, laserColour, laserPattern, whitePattern, type Slits } from "./simulate/slits";
import { SIDE } from "./stage";
import { useExperimentsDefaults } from "./use-experiments";

/** The wall's picture: its pixels across and down. */
const WALL = { width: 640, height: 96 } as const;
/** The wall shown reaches a half again past one slit's middle band at the reddest light, so
 *  the band and its first side bands fit whatever the colour: `1.5·λ·L/a` at 700 nm. */
const SPAN_NM = 700;
const SPAN = 1.5;
/** The setup's drawing: the laser, the plate with its slits, the wall. */
const SETUP = { width: 400, height: 130, laser: 20, plate: 170, wall: 370, mid: 52, gap: 14, slit: 6 } as const;
/** The preview's laser runs through the colours and back in this long, s. */
const PREVIEW_CYCLE_S = 12;
const ROOM = "#0b0d12";
const INK = "#c9ced8";
const CHART_POINTS = 241;
const BOTH_HUE = 0;
const ONE_HUE = 4;

type Light = "laser" | "white";
const LIGHTS: readonly Light[] = ["laser", "white"];

const spanOf = (slits: Slits) => (SPAN * SPAN_NM * 1e-9 * slits.distance_m) / slits.width_m;

/** The wall's colours, one per column, across `±span`. */
function wallColours(slits: Slits, light: Light, nm: number, both: boolean): Rgb[] {
  const span = spanOf(slits);
  const ys = Array.from({ length: WALL.width }, (_, k) => span * ((2 * (k + 0.5)) / WALL.width - 1));
  return light === "laser" ? laserPattern(slits, nm, ys, both) : whitePattern(slits, ys, both);
}

/**
 * The double slit (`experiments.slits`): a laser or white light through two
 * slits, or one, onto a wall, from the browser port (`simulate/slits.ts`,
 * held to the engine by `simulate.test.ts`). No route.
 */
export function SlitsPage() {
  const { t } = useTranslation();
  const defaults = useExperimentsDefaults();
  const data = defaults.data?.slits;
  const [built, setSlits] = useState<Slits | null>(null);
  const [nm, setNm] = useState(LASER_NM);
  const slits = built ?? data ?? null;
  return (
    <ExhibitFrame
      exhibit="slits"
      atTheExhibit={
        <>
          <p>{t("experiments.slits.at.laser")}</p>
          <p>{t("experiments.slits.at.stripes")}</p>
          <p>{t("experiments.slits.at.cover")}</p>
        </>
      }
      whatHappens={<SlitsModel />}
      computed={<SlitsComputed />}
      sweetSpot={
        slits ? <SlitsTrick slits={slits} nm={nm} /> : <LoadingState className="py-6" label={t("common.loading")} />
      }
    >
      {defaults.isPending || !slits ? (
        <BuildPending pending={defaults.isPending} error={defaults.error} />
      ) : (
        <>
          <SlitsPlay slits={slits} nm={nm} onNm={setNm} onSlits={setSlits} />
          <SlitsBuild slits={slits} nm={nm} onChange={setSlits} />
        </>
      )}
    </ExhibitFrame>
  );
}

/** The laser running through the colours: the stripes widen with the wavelength. */
export function SlitsPreview({ paused }: PreviewProps) {
  const defaults = useExperimentsDefaults();
  const data = defaults.data?.slits;
  return data ? <SlitsPlay slits={data} nm={LASER_NM} preview paused={paused} /> : <PreviewPending />;
}

/** The wall as one sees it: a column of colour for each place across it. */
function WallView({ colours, label }: { colours: readonly Rgb[]; label: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext?.("2d");
    if (!el || !ctx) return;
    colours.forEach((c, k) => {
      ctx.fillStyle = css(c);
      ctx.fillRect(k, 0, 1, WALL.height);
    });
  }, [colours]);
  return (
    <canvas
      ref={canvas}
      width={WALL.width}
      height={WALL.height}
      role="img"
      aria-label={label}
      className="h-20 w-full rounded-lg border border-subtle sm:h-24"
      style={{ background: ROOM }}
    />
  );
}

/** The wall's scale under it: its ends and its middle, in millimetres. */
function WallScale({ slits }: { slits: Slits }) {
  const locale = useLocale();
  const mm = spanOf(slits) * 1000;
  return (
    <div className="flex justify-between text-caption text-muted" aria-hidden>
      <span>{`−${formatNumber(mm, 0, locale)} mm`}</span>
      <span>0</span>
      <span>{`${formatNumber(mm, 0, locale)} mm`}</span>
    </div>
  );
}

/** The laser, its beam, the plate with two slits (one covered, or not) and the light fanning out to the wall. */
function SetupView({ colour, both }: { colour: string; both: boolean }) {
  const { t } = useTranslation();
  const { laser, plate, wall, mid, gap, slit } = SETUP;
  const slits = [mid - gap / 2, mid + gap / 2];
  return (
    <svg
      viewBox={`0 0 ${SETUP.width} ${SETUP.height}`}
      role="img"
      aria-label={t("experiments.slits.setup_view")}
      className="w-full rounded-lg border border-subtle"
      style={{ background: ROOM }}
    >
      <rect x={laser - 12} y={mid - 7} width={34} height={14} rx={3} fill="#444b57" />
      <line x1={laser + 22} y1={mid} x2={plate} y2={mid} stroke={colour} strokeWidth={4} />
      <rect x={plate - 3} y={6} width={6} height={SETUP.height - 30} fill={INK} />
      {slits.map((y, k) => (
        <rect
          key={y}
          x={plate - 3}
          y={y - slit / 2}
          width={6}
          height={slit}
          fill={k === 1 && !both ? "#e0a030" : ROOM}
        />
      ))}
      {slits
        .filter((_, k) => k === 0 || both)
        .flatMap((y) =>
          [-40, -20, 0, 20, 40].map((dy) => (
            <line
              key={`${y}-${dy}`}
              x1={plate + 3}
              y1={y}
              x2={wall}
              y2={mid + dy}
              stroke={colour}
              strokeOpacity={0.35}
              strokeWidth={1}
            />
          )),
        )}
      <rect x={wall} y={6} width={6} height={SETUP.height - 30} fill={INK} fillOpacity={0.6} />
      <text x={plate} y={SETUP.height - 6} fontSize={12} fill={INK} textAnchor="middle">
        {t("experiments.slits.play.plate")}
      </text>
      <text x={wall} y={SETUP.height - 6} fontSize={12} fill={INK} textAnchor="end">
        {t("experiments.slits.play.wall")}
      </text>
    </svg>
  );
}

function SlitsPlay({
  slits,
  nm,
  onNm,
  preview = false,
  paused = false,
  onSlits,
}: { slits: Slits; nm: number; onNm?: (nm: number) => void; onSlits?: (slits: Slits) => void } & PreviewMode) {
  const { t } = useTranslation();
  const locale = useLocale();
  const [light, setLight] = useState<Light>("laser");
  const [both, setBoth] = useState(true);
  // A check case's "Set it up" takes the whole case here: the light and the
  // covered slit are this card's, the build and the wavelength the page's. One
  // taker, because a second would find the request already marked done.
  useCheckSetting("slits", (setting) => {
    if (preview) return false;
    if (setting.light === "laser" || setting.light === "white") setLight(setting.light);
    if (setting.slits === "both" || setting.slits === "one") setBoth(setting.slits === "both");
    onNm?.(settingNumber(setting, "nm", nm));
    onSlits?.({
      ...slits,
      spacing_m: settingNumber(setting, "spacing_m", slits.spacing_m),
      width_m: settingNumber(setting, "width_m", slits.width_m),
      distance_m: settingNumber(setting, "distance_m", slits.distance_m),
    });
    return true;
  });
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
  const shownNm = preview ? 550 - 140 * Math.cos((2 * Math.PI * time) / PREVIEW_CYCLE_S) : nm;
  const colours = useMemo(() => wallColours(slits, light, shownNm, both), [slits, light, shownNm, both]);
  const wall = <WallView colours={colours} label={t("experiments.slits.wall_view")} />;
  if (preview) return wall;

  const beam = light === "laser" ? css(onScreen(laserColour(nm))) : "#ffffff";
  const shown = figures(slits, nm);
  return (
    <WidgetCard title={t("experiments.slits.play.title")} hint={t("experiments.slits.play.hint")}>
      <div className={`${SIDE.grid} ${SIDE.cap["3xl"]}`}>
        <div className={`${SIDE.top} space-y-4`}>
          <ToggleGroup
            label={t("experiments.slits.play.light")}
            labelPlacement="above"
            size="sm"
            overflow="wrap"
            value={light}
            onChange={(v: string) => setLight(v as Light)}
            options={LIGHTS.map((l) => ({ value: l, label: t(`experiments.slits.play.lights.${l}`) }))}
          />
          {light === "laser" && (
            <SliderField
              label={t("experiments.slits.play.wavelength")}
              unit="nm"
              value={nm}
              min={400}
              max={700}
              step={1}
              digits={0}
              hint={t("experiments.slits.play.wavelength_hint")}
              onChange={(v) => onNm?.(v)}
            />
          )}
          <Switch
            label={t("experiments.slits.play.cover")}
            description={t("experiments.slits.play.cover_hint")}
            checked={!both}
            onCheckedChange={(covered: boolean) => setBoth(!covered)}
          />
        </div>
        <div className={`${SIDE.views} mx-auto w-full max-w-3xl`}>
          <figure className="space-y-2">
            <div className="mx-auto w-full max-w-lg">
              <SetupView colour={beam} both={both} />
            </div>
            {wall}
            <WallScale slits={slits} />
            <figcaption className="text-center text-caption text-muted">
              {t("experiments.slits.play.caption")}
            </figcaption>
          </figure>
        </div>
        <div className={SIDE.column}>
          <p className="text-sm font-medium text-primary" role="status">
            {both
              ? t("experiments.slits.play.status_both", { spacing: formatNumber(shown.spacing_m * 1000, 1, locale) })
              : t("experiments.slits.play.status_one")}
          </p>
          {slits.distance_m < shown.near_m && (
            <AlertBanner tone="info">
              {t("experiments.slits.play.near", { near: formatNumber(shown.near_m, 1, locale) })}
            </AlertBanner>
          )}
          <Figures
            tiles={[
              {
                key: "spacing",
                label: t("experiments.slits.figures.spacing"),
                value: shown.spacing_m * 1000,
                digits: 1,
                unit: "mm",
              },
              {
                key: "dark",
                label: t("experiments.slits.figures.first_dark"),
                value: shown.first_dark_m * 1000,
                digits: 1,
                unit: "mm",
              },
              { key: "stripes", label: t("experiments.slits.figures.stripes"), value: shown.stripes, digits: 0 },
              {
                key: "one",
                label: t("experiments.slits.figures.one_slit_there"),
                value: shown.one_slit_there * 100,
                digits: 0,
                unit: "%",
              },
            ]}
          />
        </div>
      </div>
    </WidgetCard>
  );
}

function SlitsBuild({ slits, nm, onChange }: { slits: Slits; nm: number; onChange: (next: Slits) => void }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hue = useChartHue();
  const rows = useMemo(() => {
    const span = spanOf(slits);
    return Array.from({ length: CHART_POINTS }, (_, k) => {
      const y = span * ((2 * k) / (CHART_POINTS - 1) - 1);
      return { mm: y * 1000, both: intensity(slits, nm, y), one: intensity(slits, nm, y, false) };
    });
  }, [slits, nm]);
  // A slit is narrower than the spacing: each slider stops a hundredth of a millimetre short of the other.
  return (
    <WidgetCard title={t("experiments.slits.change.title")} hint={t("experiments.slits.change.hint")}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SliderField
          label={t("experiments.slits.change.spacing")}
          unit="mm"
          value={slits.spacing_m * 1000}
          min={Math.max(0.1, slits.width_m * 1000 + 0.01)}
          max={1}
          step={0.01}
          digits={2}
          hint={t("experiments.slits.change.spacing_hint")}
          onChange={(v) => onChange({ ...slits, spacing_m: v / 1000 })}
        />
        <SliderField
          label={t("experiments.slits.change.width")}
          unit="mm"
          value={slits.width_m * 1000}
          min={0.02}
          max={Math.min(0.2, slits.spacing_m * 1000 - 0.01)}
          step={0.01}
          digits={2}
          hint={t("experiments.slits.change.width_hint")}
          onChange={(v) => onChange({ ...slits, width_m: v / 1000 })}
        />
        <SliderField
          label={t("experiments.slits.change.distance")}
          unit="m"
          value={slits.distance_m}
          min={0.5}
          max={5}
          step={0.1}
          digits={1}
          hint={t("experiments.slits.change.distance_hint")}
          onChange={(v) => onChange({ ...slits, distance_m: v })}
        />
      </div>
      <p className="text-sm text-secondary">{t("experiments.slits.chart.hint", { nm: formatNumber(nm, 0, locale) })}</p>
      <SeriesChart
        rows={rows}
        series={[
          { key: "both", label: t("experiments.slits.chart.both"), color: hue(BOTH_HUE) },
          { key: "one", label: t("experiments.slits.chart.one"), color: hue(ONE_HUE) },
        ]}
        axes={[
          {
            id: "y",
            title: t("experiments.slits.chart.light"),
            format: (v) => formatNumber(v, 1, locale),
            includeZero: true,
          },
        ]}
        x={{
          key: "mm",
          title: `${t("experiments.slits.chart.along")} (mm)`,
          format: (v) => formatNumber(v, 0, locale),
        }}
      />
    </WidgetCard>
  );
}

function SlitsModel() {
  const { t } = useTranslation();
  const s = (key: string) => t(`experiments.slits.symbols.${key}`);
  return (
    <>
      <p>{t("experiments.slits.model.intro")}</p>
      <Equation
        tex={String.raw`\Delta s = d\,\sin\theta`}
        reads={t("experiments.slits.model.path")}
        symbols={[
          { tex: String.raw`\Delta s`, meaning: s("ds"), unit: "m" },
          { tex: "d", meaning: s("d"), unit: "m" },
          { tex: String.raw`\theta`, meaning: s("theta"), unit: "°" },
        ]}
      />
      <Equation
        tex={String.raw`I = I_0\,\left(\frac{\sin\beta}{\beta}\right)^2\cos^2\alpha,\quad \alpha = \frac{\pi d \sin\theta}{\lambda},\ \beta = \frac{\pi a \sin\theta}{\lambda}`}
        reads={t("experiments.slits.model.intensity")}
        symbols={[
          { tex: "I", meaning: s("i"), unit: "1" },
          { tex: "I_0", meaning: s("i0"), unit: "1" },
          { tex: "a", meaning: s("a"), unit: "m" },
          { tex: String.raw`\lambda`, meaning: s("lambda"), unit: "nm" },
        ]}
      />
      <Equation
        tex={String.raw`\Delta y \approx \frac{\lambda\,L}{d}`}
        reads={t("experiments.slits.model.stripes")}
        symbols={[
          { tex: String.raw`\Delta y`, meaning: s("dy"), unit: "m" },
          { tex: "L", meaning: s("l"), unit: "m" },
        ]}
      />
    </>
  );
}

/** One slit and two side by side, at the same brightness: where two make it dark, one lights the wall. */
function SlitsTrick({ slits, nm }: { slits: Slits; nm: number }) {
  const { t } = useTranslation();
  const one = useMemo(() => wallColours(slits, "laser", nm, false), [slits, nm]);
  const two = useMemo(() => wallColours(slits, "laser", nm, true), [slits, nm]);
  return (
    <>
      <p>{t("experiments.slits.sweet.dark")}</p>
      <p>{t("experiments.slits.sweet.colours")}</p>
      <figure className="space-y-2">
        <p className="text-caption text-muted">{t("experiments.slits.sweet.one_label")}</p>
        <WallView colours={one} label={t("experiments.slits.sweet.one_label")} />
        <p className="text-caption text-muted">{t("experiments.slits.sweet.two_label")}</p>
        <WallView colours={two} label={t("experiments.slits.sweet.two_label")} />
        <WallScale slits={slits} />
      </figure>
    </>
  );
}

function SlitsComputed() {
  const { t } = useTranslation();
  const c = (key: string) => t(`experiments.slits.computed.${key}`);
  return (
    <>
      <p>{c("system")}</p>
      <p>{c("colours")}</p>
      <p>{c("check")}</p>
      <p>{c("left_out")}</p>
    </>
  );
}
