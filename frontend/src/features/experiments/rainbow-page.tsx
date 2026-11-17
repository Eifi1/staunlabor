import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Crosshair } from "lucide-react";
import { Button, Switch, ToggleGroup } from "@eifi1/ui-kit";
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
import { css, linearRgb, matching, onScreen, type Rgb } from "./simulate/colour";
import {
  PROFILE_BINS,
  PROFILE_STEP_DEG,
  RED_NM,
  SODIUM_NM,
  VIOLET_NM,
  degrees,
  exitAngle,
  figures,
  indexAt,
  rainbowAngle,
  rainbowImpact,
  ring,
  trace,
  type Bead,
} from "./simulate/rainbow";
import { SIDE } from "./stage";
import { useExperimentsDefaults } from "./use-experiments";

/** The rays of the fan, evenly across the bead's face from its centre to near its rim. */
const FAN = 19;
/** The wavelengths "split the colours" draws the ray in, nm. */
const SPLIT_NM = [400, 450, 500, 550, 600, 650, 700];
/** The bead's drawing: the bead's centre and radius, how far a ray is drawn out, the angle's arc. */
const VIEW = { width: 400, height: 300, cx: 290, cy: 120, r: 100, out: 460, arc: 70 } as const;
/** The wall: its pixels, the angle from the head's shadow its edge is at (past every ring the
 *  slider makes, so the ring visibly shrinks and grows), and the head's shadow's radius. */
const WALL = { size: 480, reachDeg: 50, headDeg: 3.2 } as const;
/** Within this of the rainbow ray's impact, the ray is said to be it. */
const NEAR_IMPACT = 0.015;
/** The preview's ray sweeps the bead's face and back in this long, s. */
const PREVIEW_SWEEP_S = 10;
/** The dark of the room the light exhibits are drawn in, both themes alike. */
const ROOM = "#0b0d12";
const INK = "#c9ced8";
const CHART_POINTS = 121;
/** The trick's chart: the index from water's neighbourhood almost to 2. */
const TRICK = { from: 1.3, to: 1.99 } as const;
const VIOLET_HUE = 1;
const RED_HUE = 4;
const ANGLE_HUE = 0;

type Kind = "water" | "glass";
const KINDS: readonly Kind[] = ["water", "glass"];

/** A ray of one wavelength as a screen can show it: its colour at full strength. */
function spectral(nm: number): string {
  const rgb = linearRgb(matching(nm));
  const top = Math.max(...rgb);
  return css(onScreen(rgb.map((c) => c / top)));
}

/**
 * The glass-bead rainbow (`experiments.rainbow`): a ray through one bead,
 * moved by the reader, and the wall of beads with its ring round the shadow of
 * one's head, from the browser port (`simulate/rainbow.ts`, held to the engine
 * by `simulate.test.ts`). No route.
 */
export function RainbowPage() {
  const { t } = useTranslation();
  const defaults = useExperimentsDefaults();
  const data = defaults.data?.rainbow;
  const [built, setBead] = useState<Bead | null>(null);
  const bead = built ?? data?.glass ?? null;
  return (
    <ExhibitFrame
      exhibit="rainbow"
      atTheExhibit={
        <>
          <p>{t("experiments.rainbow.at.wall")}</p>
          <p>{t("experiments.rainbow.at.ring")}</p>
          <p>{t("experiments.rainbow.at.smaller")}</p>
        </>
      }
      whatHappens={<RainbowModel />}
      computed={<RainbowComputed />}
      sweetSpot={<RainbowTrick />}
    >
      {defaults.isPending || !bead || !data ? (
        <BuildPending pending={defaults.isPending} error={defaults.error} />
      ) : (
        <>
          <RainbowPlay bead={bead} />
          <RainbowBuild bead={bead} presets={data} onChange={setBead} />
        </>
      )}
    </ExhibitFrame>
  );
}

/** A ray sweeping a glass bead's face, the fan of rays behind it bunching at the rainbow angle. */
export function RainbowPreview({ paused }: PreviewProps) {
  const defaults = useExperimentsDefaults();
  const data = defaults.data?.rainbow;
  return data ? <RainbowPlay bead={data.glass} preview paused={paused} /> : <PreviewPending />;
}

/** A point of the bead's drawing: the engine's bead has radius 1 and its y upward. */
function at(p: readonly [number, number]): [number, number] {
  return [VIEW.cx + VIEW.r * p[0], VIEW.cy - VIEW.r * p[1]];
}

/** The way a ray of index `n` takes through the bead, `b` off its centre, and out. */
function rayPoints(n: number, b: number): string {
  const path = trace(n, b);
  const [ex, ey] = at(path.exit);
  const far: [number, number] = [ex + VIEW.out * path.out[0], ey - VIEW.out * path.out[1]];
  return [[0, at(path.entry)[1]], at(path.entry), at(path.back), [ex, ey], far].map((p) => p.join(",")).join(" ");
}

/** One bead, the lamp's light from the left, a fan of rays through it, the
 *  chosen ray bright (or split into its colours) and the angle it leaves at. */
function BeadView({ bead, impact, split }: { bead: Bead; impact: number; split: boolean }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  const n = indexAt(bead, SODIUM_NM);
  const fan = Array.from({ length: FAN }, (_, k) => (k + 0.5) / FAN);
  const path = trace(n, impact);
  const [ex, ey] = at(path.exit);
  const leaves = exitAngle(n, impact);
  const bow = rainbowImpact(n);
  // The arc from the way back (straight left) to the way out, below it when the ray leaves downward.
  const arcEnd: [number, number] = [ex - VIEW.arc * Math.cos(leaves), ey + VIEW.arc * Math.sin(leaves)];
  return (
    <svg
      viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
      role="img"
      aria-label={t("experiments.rainbow.bead_view")}
      className="w-full rounded-lg border border-subtle"
      style={{ background: ROOM }}
    >
      <defs>
        <clipPath id="rainbow-room">
          <rect width={VIEW.width} height={VIEW.height} />
        </clipPath>
      </defs>
      <g clipPath="url(#rainbow-room)" fill="none" strokeLinejoin="round">
        {fan.map((b) => (
          <polyline key={b} points={rayPoints(n, b)} stroke={INK} strokeOpacity={0.22} strokeWidth={1} />
        ))}
        <polyline
          points={rayPoints(n, bow)}
          stroke={hex[ANGLE_HUE % hex.length]}
          strokeOpacity={0.9}
          strokeWidth={1.2}
          strokeDasharray="5 4"
        />
        <circle
          cx={VIEW.cx}
          cy={VIEW.cy}
          r={VIEW.r}
          fill="#9fc3e6"
          fillOpacity={0.12}
          stroke={INK}
          strokeOpacity={0.7}
          strokeWidth={1.5}
        />
        {split ? (
          SPLIT_NM.map((nm) => (
            <polyline key={nm} points={rayPoints(indexAt(bead, nm), impact)} stroke={spectral(nm)} strokeWidth={1.4} />
          ))
        ) : (
          <polyline points={rayPoints(n, impact)} stroke="#fff4cf" strokeWidth={2} />
        )}
        {/* The way straight back to the lamp, and the angle the ray leaves at from it. */}
        <line x1={ex} y1={ey} x2={ex - VIEW.arc * 1.6} y2={ey} stroke={INK} strokeDasharray="3 3" strokeWidth={1} />
        {Math.abs(leaves) > 0.02 && (
          <path
            d={`M ${ex - VIEW.arc} ${ey} A ${VIEW.arc} ${VIEW.arc} 0 0 ${leaves > 0 ? 0 : 1} ${arcEnd[0]} ${arcEnd[1]}`}
            stroke={INK}
            strokeWidth={1}
          />
        )}
      </g>
      <text x={8} y={16} fontSize={13} fill={INK}>
        {t("experiments.rainbow.play.lamp")}
      </text>
      <text x={ex - VIEW.arc - 6} y={ey + (leaves >= 0 ? 16 : -6)} fontSize={13} fill={INK} textAnchor="end">
        {`θ = ${formatNumber(degrees(leaves), 1, locale)}°`}
      </text>
    </svg>
  );
}

/** The wall of beads as one sees it: each angle from the shadow of one's head
 *  in the colour the beads there send back, the head's shadow in the middle. */
function WallView({ colours, angleDeg }: { colours: readonly Rgb[]; angleDeg: number }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext?.("2d");
    if (!el || !ctx) return;
    const { size, reachDeg, headDeg } = WALL;
    const half = size / 2;
    const degPerPx = reachDeg / half;
    const bytes = colours.map((c) => c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255)));
    const image = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const bin = Math.floor((Math.hypot(x + 0.5 - half, y + 0.5 - half) * degPerPx) / PROFILE_STEP_DEG);
        const c = bin < PROFILE_BINS ? bytes[bin] : [0, 0, 0];
        const k = 4 * (y * size + x);
        image.data[k] = c[0];
        image.data[k + 1] = c[1];
        image.data[k + 2] = c[2];
        image.data[k + 3] = 255;
      }
    ctx.putImageData(image, 0, 0);
    // The shadow of one's head and shoulders, the head's middle where the lamp's light points.
    const head = headDeg / degPerPx;
    ctx.fillStyle = ROOM;
    ctx.beginPath();
    ctx.arc(half, half, head, 0, 2 * Math.PI);
    ctx.fill();
    // The neck and the shoulders, rounded at the top, down to the picture's edge.
    ctx.fillRect(half - 0.55 * head, half, 1.1 * head, 2.4 * head);
    ctx.beginPath();
    ctx.roundRect(half - 4.6 * head, half + 2.0 * head, 9.2 * head, size, [2.4 * head, 2.4 * head, 0, 0]);
    ctx.fill();
    // The ring's radius, along a line up and to the right.
    const r = angleDeg / degPerPx;
    const [dx, dy] = [Math.SQRT1_2, -Math.SQRT1_2];
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(half, half);
    ctx.lineTo(half + r * dx, half + r * dy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#ffffff";
    ctx.font = "600 20px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`${formatNumber(angleDeg, 1, locale)}°`, half + r * dx + 8, half + r * dy - 4);
  }, [colours, angleDeg, locale]);
  return (
    <canvas
      ref={canvas}
      width={WALL.size}
      height={WALL.size}
      role="img"
      aria-label={t("experiments.rainbow.wall_view")}
      className="aspect-square w-full rounded-lg border border-subtle"
      style={{ background: ROOM }}
    />
  );
}

function RainbowPlay({ bead, preview = false, paused = false }: { bead: Bead } & PreviewMode) {
  const { t } = useTranslation();
  const locale = useLocale();
  const n = indexAt(bead, SODIUM_NM);
  const bow = rainbowImpact(n);
  const [chosen, setImpact] = useState(0.5);
  const [split, setSplit] = useState(false);
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
  // The ring is recoloured from 81 wavelengths: a moment's work, so the slider never waits for it.
  const shownBead = useDeferredValue(bead);
  const colours = useMemo(() => (preview ? [] : ring(shownBead)), [shownBead, preview]);

  const impact = preview ? 0.49 - 0.49 * Math.cos((2 * Math.PI * time) / PREVIEW_SWEEP_S) : chosen;
  const view = <BeadView bead={bead} impact={impact} split={split} />;
  if (preview) return view;

  const angle = degrees(rainbowAngle(n));
  const leaves = degrees(exitAngle(n, impact));
  const near = Math.abs(impact - bow) < NEAR_IMPACT;
  return (
    <WidgetCard
      title={t("experiments.rainbow.play.title")}
      hint={t("experiments.rainbow.play.hint")}
      actions={
        <Button variant="secondary" size="sm" onClick={() => setImpact(Math.round(bow * 1000) / 1000)}>
          <Crosshair className="size-4" aria-hidden />
          {t("experiments.rainbow.play.to_bow")}
        </Button>
      }
    >
      <div className={SIDE.grid}>
        <div className={SIDE.top}>
          <SliderField
            label={t("experiments.rainbow.play.impact")}
            unit="%"
            value={impact * 100}
            min={0}
            max={99}
            step={0.1}
            digits={1}
            hint={t("experiments.rainbow.play.impact_hint")}
            onChange={(v) => setImpact(v / 100)}
          />
        </div>
        <div className={SIDE.views}>
          {/* The bead is 4:3 and the wall square: 4:3 of the width keeps them one height. */}
          <div className="mx-auto grid w-full max-w-[calc(140dvh_+_1rem)] grid-cols-1 gap-4 md:grid-cols-[minmax(0,4fr)_minmax(0,3fr)]">
            <figure className="space-y-1">
              {view}
              <figcaption className="text-center text-caption text-muted">
                {t("experiments.rainbow.play.bead_caption")}
              </figcaption>
            </figure>
            <figure className="space-y-1">
              <WallView colours={colours} angleDeg={degrees(rainbowAngle(indexAt(shownBead, SODIUM_NM)))} />
              <figcaption className="text-center text-caption text-muted">
                {t("experiments.rainbow.play.wall_caption")}
              </figcaption>
            </figure>
          </div>
        </div>
        <div className={SIDE.column}>
          <p className={`text-sm font-medium ${near ? "text-primary" : "text-secondary"}`} role="status">
            {near
              ? t("experiments.rainbow.play.at_bow")
              : t(`experiments.rainbow.play.${leaves >= 0 ? "inside" : "across"}`, {
                  angle: formatNumber(Math.abs(leaves), 1, locale),
                  bow: formatNumber(angle, 1, locale),
                })}
          </p>
          <Switch
            label={t("experiments.rainbow.play.split")}
            description={t("experiments.rainbow.play.split_hint")}
            checked={split}
            onCheckedChange={setSplit}
          />
          <Figures
            tiles={[
              {
                key: "incidence",
                label: t("experiments.rainbow.play.incidence"),
                value: degrees(Math.asin(impact)),
                digits: 1,
                unit: "°",
              },
              {
                key: "refraction",
                label: t("experiments.rainbow.play.refraction"),
                value: degrees(Math.asin(impact / n)),
                digits: 1,
                unit: "°",
              },
              { key: "leaves", label: t("experiments.rainbow.play.leaves"), value: leaves, digits: 1, unit: "°" },
              { key: "bow", label: t("experiments.rainbow.play.bow"), value: angle, digits: 1, unit: "°" },
            ]}
          />
        </div>
      </div>
    </WidgetCard>
  );
}

function RainbowBuild({
  bead,
  presets,
  onChange,
}: {
  bead: Bead;
  presets: { glass: Bead; water: Bead };
  onChange: (next: Bead) => void;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  const kind: Kind = bead.dispersion_nm2 === presets.water.dispersion_nm2 ? "water" : "glass";
  const shown = useMemo(() => figures(bead), [bead]);
  const rows = useMemo(() => {
    const violet = indexAt(bead, VIOLET_NM);
    const red = indexAt(bead, RED_NM);
    return Array.from({ length: CHART_POINTS }, (_, k) => {
      const b = (0.999 * k) / (CHART_POINTS - 1);
      return { b: b * 100, violet: degrees(exitAngle(violet, b)), red: degrees(exitAngle(red, b)) };
    });
  }, [bead]);
  return (
    <WidgetCard title={t("experiments.rainbow.change.title")} hint={t("experiments.rainbow.change.hint")}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ToggleGroup
          label={t("experiments.rainbow.change.kind")}
          labelPlacement="above"
          size="sm"
          overflow="wrap"
          value={kind}
          onChange={(v: string) => onChange({ ...presets[v as Kind] })}
          options={KINDS.map((k) => ({ value: k, label: t(`experiments.rainbow.change.kinds.${k}`) }))}
        />
        <SliderField
          label={t("experiments.rainbow.change.index")}
          unit=""
          value={bead.index}
          min={1.3}
          max={1.95}
          step={0.001}
          digits={3}
          hint={t("experiments.rainbow.change.index_hint")}
          onChange={(v) => onChange({ ...bead, index: v })}
        />
      </div>
      <Figures
        tiles={[
          { key: "angle", label: t("experiments.rainbow.figures.angle"), value: shown.angle_deg, digits: 1, unit: "°" },
          { key: "red", label: t("experiments.rainbow.figures.red"), value: shown.red_deg, digits: 1, unit: "°" },
          {
            key: "violet",
            label: t("experiments.rainbow.figures.violet"),
            value: shown.violet_deg,
            digits: 1,
            unit: "°",
          },
          { key: "width", label: t("experiments.rainbow.figures.width"), value: shown.width_deg, digits: 2, unit: "°" },
          {
            key: "impact",
            label: t("experiments.rainbow.figures.impact"),
            value: shown.impact * 100,
            digits: 0,
            unit: "%",
          },
          {
            key: "reflected",
            label: t("experiments.rainbow.figures.reflected"),
            value: shown.reflected * 100,
            digits: 1,
            unit: "%",
          },
          {
            key: "near",
            label: t("experiments.rainbow.figures.near"),
            value: shown.near * 100,
            digits: 0,
            unit: "%",
          },
        ]}
      />
      <p className="text-sm text-secondary">{t("experiments.rainbow.chart.exit_hint")}</p>
      <SeriesChart
        rows={rows}
        series={[
          { key: "violet", label: t("experiments.rainbow.chart.violet"), color: hex[VIOLET_HUE % hex.length] },
          { key: "red", label: t("experiments.rainbow.chart.red"), color: hex[RED_HUE % hex.length] },
        ]}
        axes={[
          {
            id: "y",
            title: `${t("experiments.rainbow.chart.leaves")} (°)`,
            format: (v) => formatNumber(v, 0, locale),
            includeZero: true,
          },
        ]}
        x={{
          key: "b",
          title: `${t("experiments.rainbow.chart.impact")} (%)`,
          format: (v) => formatNumber(v, 0, locale),
        }}
      />
    </WidgetCard>
  );
}

function RainbowModel() {
  const { t } = useTranslation();
  const s = (key: string) => t(`experiments.rainbow.symbols.${key}`);
  return (
    <>
      <p>{t("experiments.rainbow.model.intro")}</p>
      <Equation
        tex={String.raw`\sin i = n\,\sin r`}
        reads={t("experiments.rainbow.model.snell")}
        symbols={[
          { tex: "i", meaning: s("i"), unit: "°" },
          { tex: "r", meaning: s("r"), unit: "°" },
          { tex: "n", meaning: s("n"), unit: "1" },
        ]}
      />
      <Equation
        tex={String.raw`\theta = 4r - 2i`}
        reads={t("experiments.rainbow.model.leaves")}
        symbols={[{ tex: String.raw`\theta`, meaning: s("theta"), unit: "°" }]}
      />
      <Equation
        tex={String.raw`\cos^2 i_R = \frac{n^2 - 1}{3}`}
        reads={t("experiments.rainbow.model.bow")}
        symbols={[{ tex: "i_R", meaning: s("ir"), unit: "°" }]}
      />
      <Equation
        tex={String.raw`n(\lambda) = n_D + B\left(\frac{1}{\lambda^2} - \frac{1}{\lambda_D^2}\right)`}
        reads={t("experiments.rainbow.model.dispersion")}
        symbols={[
          { tex: String.raw`\lambda`, meaning: s("lambda"), unit: "nm" },
          { tex: "n_D", meaning: s("nd"), unit: "1" },
          { tex: "B", meaning: s("b"), unit: "nm²" },
          { tex: String.raw`\lambda_D`, meaning: s("lambda_d"), unit: "nm" },
        ]}
      />
    </>
  );
}

function RainbowTrick() {
  const { t } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  const rows = useMemo(
    () =>
      Array.from({ length: CHART_POINTS }, (_, k) => {
        const n = TRICK.from + ((TRICK.to - TRICK.from) * k) / (CHART_POINTS - 1);
        return { n, angle: degrees(rainbowAngle(n)) };
      }),
    [],
  );
  return (
    <>
      <p>{t("experiments.rainbow.sweet.index")}</p>
      <p>{t("experiments.rainbow.sweet.two")}</p>
      <p>{t("experiments.rainbow.sweet.own")}</p>
      <p className="text-sm text-secondary">{t("experiments.rainbow.chart.angle_hint")}</p>
      <SeriesChart
        rows={rows}
        series={[{ key: "angle", label: t("experiments.rainbow.chart.angle"), color: hex[ANGLE_HUE % hex.length] }]}
        axes={[
          {
            id: "y",
            title: `${t("experiments.rainbow.chart.angle")} (°)`,
            format: (v) => formatNumber(v, 0, locale),
            includeZero: true,
          },
        ]}
        x={{ key: "n", title: t("experiments.rainbow.chart.index"), format: (v) => formatNumber(v, 2, locale) }}
      />
    </>
  );
}

function RainbowComputed() {
  const { t } = useTranslation();
  const c = (key: string) => t(`experiments.rainbow.computed.${key}`);
  return (
    <>
      <p>{c("system")}</p>
      <p>{c("colours")}</p>
      <p>{c("check")}</p>
      <p>{c("left_out")}</p>
    </>
  );
}
