import { useDeferredValue, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { LoadingState } from "@eifi1/ui-kit";
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
import { useFrameLoop } from "./play";
import { PreviewPending, type PreviewMode, type PreviewProps } from "./preview-mode";
import { css, linearRgb, matching, onScreen } from "./simulate/colour";
import {
  BINS,
  MAX_TILT_DEG,
  axisNormal,
  axisY,
  beam,
  figuresOf,
  landingM,
  reflectance,
  type Beam,
  type Jet,
  type Ray,
} from "./simulate/jet";
import { SIDE } from "./stage";
import { useExperimentsDefaults } from "./use-experiments";

/** The dark of the room the light exhibits are drawn in, both themes alike. */
const ROOM = "#0b0d12";
const INK = "#c9ced8";
const WATER = "#7fb4e6";
/** The laser: a green one, 532 nm, as bright as the screen shows its colour. */
const LASER_NM = 532;
/** The whole exhibit's drawing, its width in the picture's units; the tank's
 *  width, its bottom below the hole, and the basin's depth, all in metres. */
const SCENE = { width: 400, tank: 0.25, below: 0.2, basin: 0.08, past: 0.12 } as const;
/** The close-up of the hole: as wide as this many hole widths, 3:5. */
const CLOSE = { width: 400, height: 240, holes: 24, before: 0.12 } as const;
/** How far a ray's light leaving the jet is drawn, in the close-up's width. */
const OUT_LENGTH = 0.18;
/** The preview's laser tilts from straight up past its limit and back in this long, s. */
const PREVIEW_CYCLE_S = 12;
const PREVIEW_TILT_DEG = 48;
/** The level slider's top, and the hole slider's ends, m. */
const LEVEL_MAX = 0.5;
const LEVEL_MIN = 0.005;
const HOLE = { min: 0.002, max: 0.01 } as const;
const CHART_POINTS = 91;
const LIGHT_HUE = 2;
const SHARE_HUE = 0;

function spectral(nm: number): string {
  const rgb = linearRgb(matching(nm));
  const top = Math.max(...rgb);
  return css(onScreen(rgb.map((c) => c / top)));
}
const LASER = spectral(LASER_NM);

/** The light still in the jet at the start of each bin of its way, and at its end. */
function stillIn(b: Beam): number[] {
  const out = [1];
  let inside = 1;
  for (const left of b.left) {
    inside -= left;
    out.push(Math.max(0, inside));
  }
  return out;
}

/**
 * The light in the water jet (`experiments.jet`): a laser through a tank into
 * the hole its water leaves by, the jet arcing into a basin, and the beam
 * traced through it, from the browser port (`simulate/jet.ts`, held to the
 * engine by `simulate.test.ts`). No route.
 */
export function JetPage() {
  const { t } = useTranslation();
  const defaults = useExperimentsDefaults();
  const data = defaults.data?.jet;
  const [built, setJet] = useState<Jet | null>(null);
  const [tilt, setTilt] = useState(0);
  const jet = built ?? data ?? null;
  // The beam is traced again with each step of a slider: a moment's work, but
  // deferred, so a slider never waits for it. Once, for the twin and the build.
  const tracedJet = useDeferredValue(jet);
  const tracedTilt = useDeferredValue(tilt);
  const light = useMemo(() => (tracedJet ? beam(tracedJet, tracedTilt) : null), [tracedJet, tracedTilt]);
  return (
    <ExhibitFrame
      exhibit="jet"
      atTheExhibit={
        <>
          <p>{t("experiments.jet.at.tank")}</p>
          <p>{t("experiments.jet.at.follows")}</p>
          <p>{t("experiments.jet.at.colladon")}</p>
        </>
      }
      whatHappens={<JetModel />}
      computed={<JetComputed />}
      sweetSpot={jet ? <JetTrick jet={jet} /> : <LoadingState className="py-6" label={t("common.loading")} />}
    >
      {defaults.isPending || !jet || !tracedJet || !light ? (
        <BuildPending pending={defaults.isPending} error={defaults.error} />
      ) : (
        <>
          <JetPlay
            jet={jet}
            tilt={tilt}
            traced={{ jet: tracedJet, tilt: tracedTilt, light }}
            onTilt={setTilt}
            onJet={setJet}
          />
          <JetBuild jet={jet} traced={{ jet: tracedJet, tilt: tracedTilt, light }} onChange={setJet} />
        </>
      )}
    </ExhibitFrame>
  );
}

/** The laser tilting up past its limit and back: the jet glows, then the light leaves at the hole. */
export function JetPreview({ paused }: PreviewProps) {
  const defaults = useExperimentsDefaults();
  const data = defaults.data?.jet;
  return data ? <JetPlay jet={data} tilt={0} preview paused={paused} /> : <PreviewPending />;
}

/** The whole exhibit: the tank and its laser, the jet glowing as far as its
 *  light goes, the light leaving it on the way, and the basin lit by the rest. */
function SceneView({ jet, tilt, light }: { jet: Jet; tilt: number; light: Beam }) {
  const { t } = useTranslation();
  // The scale is the build's, not the level's: the drawing stays put while the level moves.
  const reach = landingM({ ...jet, level_m: LEVEL_MAX }) + SCENE.past;
  const scale = SCENE.width / (SCENE.tank + 0.07 + reach);
  const top = LEVEL_MAX + 0.05;
  const height = scale * (top + jet.drop_m + SCENE.basin + 0.02);
  const at = (x: number, y: number): [number, number] => [scale * (x + SCENE.tank + 0.07), scale * (top - y)];
  const land = landingM(jet);
  const inside = stillIn(light);
  const steps = 8;
  const segments = Array.from({ length: BINS }, (_, j) => {
    const points = Array.from({ length: steps + 1 }, (_, i) => {
      const x = (land * (j + i / steps)) / BINS;
      return at(x, axisY(jet, x)).join(",");
    });
    return { j, points: points.join(" "), light: inside[j] };
  });
  const jetWidth = Math.max(3, scale * jet.hole_m);
  const [hx, hy] = at(0, 0);
  const [tx0, ty0] = at(-SCENE.tank, top - 0.05);
  const [tx1, ty1] = at(0, -SCENE.below);
  const [, level] = at(0, jet.level_m);
  const [bx0, by0] = at(0.05, -jet.drop_m);
  const [bx1, by1] = at(reach, -jet.drop_m - SCENE.basin);
  const [lx, ly] = at(land, -jet.drop_m);
  const rad = (tilt * Math.PI) / 180;
  const beamFrom = at(-0.17 * Math.cos(rad), -0.17 * Math.sin(rad));
  return (
    <svg
      viewBox={`0 0 ${SCENE.width} ${height}`}
      role="img"
      aria-label={t("experiments.jet.scene_view")}
      className="w-full rounded-lg border border-subtle"
      style={{ background: ROOM }}
    >
      <defs>
        <radialGradient id="jet-basin-glow">
          <stop offset="0%" stopColor={LASER} stopOpacity={0.9} />
          <stop offset="100%" stopColor={LASER} stopOpacity={0} />
        </radialGradient>
      </defs>
      {/* The tank, its water up to the level, and the laser behind the hole. */}
      <rect x={tx0} y={level} width={tx1 - tx0} height={ty1 - level} fill={WATER} fillOpacity={0.25} />
      <rect
        x={tx0}
        y={ty0}
        width={tx1 - tx0}
        height={ty1 - ty0}
        fill="none"
        stroke={INK}
        strokeOpacity={0.7}
        strokeWidth={1.5}
      />
      <line x1={beamFrom[0]} y1={beamFrom[1]} x2={hx} y2={hy} stroke={LASER} strokeWidth={2} strokeOpacity={0.9} />
      <circle cx={beamFrom[0]} cy={beamFrom[1]} r={5} fill="#444b57" stroke={INK} strokeWidth={1} />
      {/* The basin and its water, lit by the light the jet brings. */}
      <rect x={bx0} y={by0} width={bx1 - bx0} height={by1 - by0} fill={WATER} fillOpacity={0.2} />
      <polyline
        points={`${bx0},${by0 - 6} ${bx0},${by1} ${bx1},${by1} ${bx1},${by0 - 6}`}
        fill="none"
        stroke={INK}
        strokeOpacity={0.7}
        strokeWidth={1.5}
      />
      {light.arrives > 0 && (
        <ellipse
          cx={lx}
          cy={ly + 4}
          rx={40}
          ry={14}
          fill="url(#jet-basin-glow)"
          opacity={Math.min(1, 0.15 + light.arrives)}
        />
      )}
      {/* The jet: water, and the laser's light in it as far as it goes. */}
      {segments.map((s) => (
        <polyline
          key={`w${s.j}`}
          points={s.points}
          fill="none"
          stroke={WATER}
          strokeOpacity={0.45}
          strokeWidth={jetWidth}
        />
      ))}
      {segments.map((s) => (
        <polyline
          key={`l${s.j}`}
          points={s.points}
          fill="none"
          stroke={LASER}
          strokeOpacity={0.9 * s.light}
          strokeWidth={Math.max(1.5, jetWidth * 0.6)}
        />
      ))}
      {light.left.map((left, j) => {
        if (left < 1e-3) return null;
        const x = (land * (j + 0.5)) / BINS;
        const [cx, cy] = at(x, axisY(jet, x));
        return (
          <circle
            key={`o${j}`}
            cx={cx}
            cy={cy}
            r={4 + 14 * Math.sqrt(left)}
            fill={LASER}
            fillOpacity={0.15 + 0.6 * Math.sqrt(left)}
          />
        );
      })}
    </svg>
  );
}

/** The light along a ray between its hits: its share before each hit, less what left at it. */
function rayLight(jet: Jet, ray: Ray): number[] {
  const out: number[] = [];
  let light = 1;
  for (let i = 0; i < ray.xs.length - 1; i++) {
    out.push(light);
    if (i < ray.hits_cos.length) {
      const r = reflectance(jet.index, ray.hits_cos[i]);
      if (r < 1) light *= r;
    }
  }
  return out;
}

/** The hole, much enlarged: the tank's wall, the jet's edges as it bends away,
 *  the beam's rays reflected inside it and the light that gets out. */
function CloseView({ jet, tilt, light }: { jet: Jet; tilt: number; light: Beam }) {
  const { t } = useTranslation();
  const a = jet.hole_m / 2;
  const span = CLOSE.holes * jet.hole_m;
  const scale = CLOSE.width / span;
  const at = (x: number, y: number): [number, number] => [scale * (x + CLOSE.before * span), scale * (0.18 * span - y)];
  const land = landingM(jet);
  const edgeTo = Math.min(land, span);
  const edges = [1, -1].map((side) =>
    Array.from({ length: 121 }, (_, i) => {
      const u = (edgeTo * i) / 120;
      const [nx, ny] = axisNormal(jet, u);
      return at(u + side * a * nx, axisY(jet, u) + side * a * ny);
    }),
  );
  const water = [...edges[0], ...[...edges[1]].reverse()].map((p) => p.join(",")).join(" ");
  const [wx, wy] = at(0, a);
  const [, wb] = at(0, -a);
  const wall = scale * 0.02 * span;
  const rad = (tilt * Math.PI) / 180;
  const back = CLOSE.before * span * 1.2;
  return (
    <svg
      viewBox={`0 0 ${CLOSE.width} ${CLOSE.height}`}
      role="img"
      aria-label={t("experiments.jet.close_view")}
      className="w-full rounded-lg border border-subtle"
      style={{ background: ROOM }}
    >
      <defs>
        <clipPath id="jet-close-room">
          <rect width={CLOSE.width} height={CLOSE.height} />
        </clipPath>
      </defs>
      <g clipPath="url(#jet-close-room)" fill="none" strokeLinejoin="round">
        <rect x={0} y={0} width={wx} height={CLOSE.height} fill={WATER} fillOpacity={0.18} />
        <polygon points={water} fill={WATER} fillOpacity={0.22} />
        {edges.map((edge, k) => (
          <polyline
            key={k}
            points={edge.map((p) => p.join(",")).join(" ")}
            stroke={INK}
            strokeOpacity={0.6}
            strokeWidth={1}
          />
        ))}
        {/* The tank's front wall, the hole in it. */}
        <rect x={wx - wall} y={0} width={wall} height={wy} fill={INK} fillOpacity={0.5} />
        <rect x={wx - wall} y={wb} width={wall} height={CLOSE.height - wb} fill={INK} fillOpacity={0.5} />
        {light.rays.map((ray) => {
          const shares = rayLight(jet, ray);
          const [sx, sy] = at(ray.xs[0], ray.ys[0]);
          const [fx, fy] = at(ray.xs[0] - back * Math.cos(rad), ray.ys[0] - back * Math.sin(rad));
          return (
            <g key={ray.start}>
              <line x1={fx} y1={fy} x2={sx} y2={sy} stroke={LASER} strokeOpacity={0.5} strokeWidth={1} />
              {shares.map((share, i) => {
                const [x1, y1] = at(ray.xs[i], ray.ys[i]);
                const [x2, y2] = at(ray.xs[i + 1], ray.ys[i + 1]);
                return (
                  <line
                    key={i}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={LASER}
                    strokeOpacity={0.15 + 0.7 * share}
                    strokeWidth={1}
                  />
                );
              })}
              {ray.escapes.map((e, i) => {
                const [x1, y1] = at(e.x, e.y);
                const [x2, y2] = at(e.x + OUT_LENGTH * span * e.out[0], e.y + OUT_LENGTH * span * e.out[1]);
                return (
                  <line
                    key={`e${i}`}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={LASER}
                    strokeOpacity={Math.min(1, 0.2 + e.light)}
                    strokeWidth={1.5}
                    strokeDasharray="3 2"
                  />
                );
              })}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

/** A beam as traced, with the build and the tilt it was traced for. */
interface Traced {
  jet: Jet;
  tilt: number;
  light: Beam;
}

function JetPlay({
  jet,
  tilt,
  traced: given,
  onTilt,
  onJet,
  preview = false,
  paused = false,
}: {
  jet: Jet;
  tilt: number;
  /** The page's beam; a preview traces its own, frame by frame. */
  traced?: Traced;
  onTilt?: (deg: number) => void;
  onJet?: (next: Jet) => void;
} & PreviewMode) {
  const { t } = useTranslation();
  const locale = useLocale();
  // A check case's "Set it up" takes the whole case here: the laser's tilt and the build.
  useCheckSetting("jet", (setting) => {
    if (preview) return false;
    onTilt?.(settingNumber(setting, "tilt_deg", tilt));
    onJet?.({
      ...jet,
      level_m: settingNumber(setting, "level_m", jet.level_m),
      hole_m: settingNumber(setting, "hole_m", jet.hole_m),
      drop_m: settingNumber(setting, "drop_m", jet.drop_m),
      index: settingNumber(setting, "index", jet.index),
    });
    return true;
  });
  const [time, setTime] = useState(0);
  // Only a preview runs a clock, for its auto mode; on the page the reader moves it.
  useFrameLoop(preview && !paused, (dt) => setTime((s) => s + dt));
  const shownTilt = preview ? 0.5 * PREVIEW_TILT_DEG * (1 - Math.cos((2 * Math.PI * time) / PREVIEW_CYCLE_S)) : tilt;
  const own = useMemo(
    () => (given ? null : { jet, tilt: shownTilt, light: beam(jet, shownTilt) }),
    [given, jet, shownTilt],
  );
  // `own` is traced exactly when no beam is given: the fallback never runs.
  const traced = given ?? own ?? { jet, tilt: shownTilt, light: beam(jet, shownTilt) };
  const light = traced.light;
  const scene = <SceneView jet={traced.jet} tilt={traced.tilt} light={light} />;
  if (preview) return scene;

  const shown = figuresOf(traced.jet, light);
  const pct = (share: number) => formatNumber(share * 100, 1, locale);
  const status =
    shown.arrives === 1
      ? t("experiments.jet.play.all_in", {
          steepest: formatNumber(shown.steepest_deg ?? 90, 1, locale),
          critical: formatNumber(shown.critical_deg, 1, locale),
        })
      : shown.arrives === 0
        ? t("experiments.jet.play.all_out", { critical: formatNumber(shown.critical_deg, 1, locale) })
        : t("experiments.jet.play.some_out", { out: pct(1 - shown.arrives), arrives: pct(shown.arrives) });
  return (
    <WidgetCard title={t("experiments.jet.play.title")} hint={t("experiments.jet.play.hint")}>
      <div className={`${SIDE.grid} ${SIDE.cap["3xl"]}`}>
        <div className={`${SIDE.top} space-y-4`}>
          <SliderField
            label={t("experiments.jet.play.level")}
            unit="cm"
            value={jet.level_m * 100}
            min={LEVEL_MIN * 100}
            max={LEVEL_MAX * 100}
            step={0.1}
            digits={1}
            hint={t("experiments.jet.play.level_hint")}
            onChange={(v) => onJet?.({ ...jet, level_m: v / 100 })}
          />
          <SliderField
            label={t("experiments.jet.play.tilt")}
            unit="°"
            value={tilt}
            min={-MAX_TILT_DEG}
            max={MAX_TILT_DEG}
            step={0.5}
            digits={1}
            hint={t("experiments.jet.play.tilt_hint")}
            onChange={(v) => onTilt?.(v)}
          />
        </div>
        <div className={`${SIDE.views} mx-auto w-full max-w-3xl`}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <figure className="space-y-1">
              {scene}
              <figcaption className="text-center text-caption text-muted">
                {t("experiments.jet.play.scene_caption")}
              </figcaption>
            </figure>
            <figure className="space-y-1">
              <CloseView jet={traced.jet} tilt={traced.tilt} light={light} />
              <figcaption className="text-center text-caption text-muted">
                {t("experiments.jet.play.close_caption")}
              </figcaption>
            </figure>
          </div>
        </div>
        <div className={SIDE.column}>
          <p className="text-sm font-medium text-primary" role="status">
            {status}
          </p>
          <Figures
            tiles={[
              {
                key: "speed",
                label: t("experiments.jet.figures.speed"),
                value: shown.speed_m_s,
                digits: 2,
                unit: "m/s",
              },
              {
                key: "bend",
                label: t("experiments.jet.figures.bend"),
                value: shown.bend_radius_m * 100,
                digits: 1,
                unit: "cm",
              },
              {
                key: "critical",
                label: t("experiments.jet.figures.critical"),
                value: shown.critical_deg,
                digits: 1,
                unit: "°",
              },
              {
                key: "steepest",
                label: t("experiments.jet.figures.steepest"),
                value: shown.steepest_deg,
                digits: 1,
                unit: "°",
              },
              {
                key: "arrives",
                label: t("experiments.jet.figures.arrives"),
                value: shown.arrives * 100,
                digits: 1,
                unit: "%",
              },
              {
                key: "first_out",
                label: t("experiments.jet.figures.first_out"),
                value: shown.first_out_m === null ? null : shown.first_out_m * 100,
                digits: 1,
                unit: "cm",
              },
            ]}
          />
        </div>
      </div>
    </WidgetCard>
  );
}

function JetBuild({ jet, traced, onChange }: { jet: Jet; traced: Traced; onChange: (next: Jet) => void }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hue = useChartHue();
  const { light } = traced;
  const shown = figuresOf(traced.jet, light);
  const rows = useMemo(() => {
    const land = landingM(traced.jet);
    return stillIn(light).map((share, j) => ({ cm: (land * 100 * j) / BINS, share: share * 100 }));
  }, [light, traced]);
  return (
    <WidgetCard title={t("experiments.jet.change.title")} hint={t("experiments.jet.change.hint")}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SliderField
          label={t("experiments.jet.change.hole")}
          unit="mm"
          value={jet.hole_m * 1000}
          min={HOLE.min * 1000}
          max={HOLE.max * 1000}
          step={0.1}
          digits={1}
          hint={t("experiments.jet.change.hole_hint")}
          onChange={(v) => onChange({ ...jet, hole_m: v / 1000 })}
        />
        <SliderField
          label={t("experiments.jet.change.drop")}
          unit="cm"
          value={jet.drop_m * 100}
          min={10}
          max={100}
          step={1}
          digits={0}
          hint={t("experiments.jet.change.drop_hint")}
          onChange={(v) => onChange({ ...jet, drop_m: v / 100 })}
        />
        <SliderField
          label={t("experiments.jet.change.index")}
          unit=""
          value={jet.index}
          min={1.2}
          max={1.6}
          step={0.001}
          digits={3}
          hint={t("experiments.jet.change.index_hint")}
          onChange={(v) => onChange({ ...jet, index: v })}
        />
      </div>
      <Figures
        tiles={[
          {
            key: "landing",
            label: t("experiments.jet.figures.landing"),
            value: shown.landing_m * 100,
            digits: 1,
            unit: "cm",
          },
          { key: "hits", label: t("experiments.jet.figures.hits"), value: shown.middle_hits, digits: 0 },
        ]}
      />
      <p className="text-sm text-secondary">{t("experiments.jet.chart.inside_hint")}</p>
      <SeriesChart
        rows={rows}
        series={[{ key: "share", label: t("experiments.jet.chart.inside"), color: hue(LIGHT_HUE) }]}
        axes={[
          {
            id: "y",
            title: `${t("experiments.jet.chart.inside")} (%)`,
            format: (v) => formatNumber(v, 0, locale),
            includeZero: true,
          },
        ]}
        x={{
          key: "cm",
          title: `${t("experiments.jet.chart.along")} (cm)`,
          format: (v) => formatNumber(v, 0, locale),
        }}
      />
    </WidgetCard>
  );
}

function JetModel() {
  const { t } = useTranslation();
  const s = (key: string) => t(`experiments.jet.symbols.${key}`);
  return (
    <>
      <p>{t("experiments.jet.model.intro")}</p>
      <Equation
        tex={String.raw`v = \sqrt{2 g h}`}
        reads={t("experiments.jet.model.torricelli")}
        symbols={[
          { tex: "v", meaning: s("v"), unit: "m/s" },
          { tex: "g", meaning: s("g"), unit: "m/s²" },
          { tex: "h", meaning: s("h"), unit: "m" },
        ]}
      />
      <Equation
        tex={String.raw`y = -\frac{g\,x^2}{2 v^2} = -\frac{x^2}{4h}, \qquad R = \frac{v^2}{g} = 2h`}
        reads={t("experiments.jet.model.parabola")}
        symbols={[
          { tex: "x", meaning: s("x"), unit: "m" },
          { tex: "y", meaning: s("y"), unit: "m" },
          { tex: "R", meaning: s("r"), unit: "m" },
        ]}
      />
      <Equation
        tex={String.raw`n \sin\theta = \sin\theta_t`}
        reads={t("experiments.jet.model.snell")}
        symbols={[
          { tex: "n", meaning: s("n"), unit: "1" },
          { tex: String.raw`\theta`, meaning: s("theta"), unit: "°" },
          { tex: String.raw`\theta_t`, meaning: s("theta_t"), unit: "°" },
        ]}
      />
      <Equation
        tex={String.raw`\sin\theta_c = \frac{1}{n}`}
        reads={t("experiments.jet.model.critical")}
        symbols={[{ tex: String.raw`\theta_c`, meaning: s("theta_c"), unit: "°" }]}
      />
      <Equation
        tex={String.raw`R_F = \tfrac12\left[\left(\frac{n\cos\theta - \cos\theta_t}{n\cos\theta + \cos\theta_t}\right)^2 + \left(\frac{n\cos\theta_t - \cos\theta}{n\cos\theta_t + \cos\theta}\right)^2\right]`}
        reads={t("experiments.jet.model.fresnel")}
        symbols={[{ tex: "R_F", meaning: s("r_f"), unit: "1" }]}
      />
    </>
  );
}

/** The share a water surface reflects from inside, over the angle a ray meets it at: the jump to all of it. */
function JetTrick({ jet }: { jet: Jet }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hue = useChartHue();
  const rows = useMemo(
    () =>
      Array.from({ length: CHART_POINTS }, (_, k) => {
        const deg = k;
        return { deg, share: 100 * reflectance(jet.index, Math.cos((deg * Math.PI) / 180)) };
      }),
    [jet.index],
  );
  return (
    <>
      <p>{t("experiments.jet.sweet.grazing")}</p>
      <p>{t("experiments.jet.sweet.bend")}</p>
      <p className="text-sm text-secondary">
        {t("experiments.jet.chart.reflected_hint", { index: formatNumber(jet.index, 3, locale) })}
      </p>
      <SeriesChart
        rows={rows}
        series={[{ key: "share", label: t("experiments.jet.chart.reflected"), color: hue(SHARE_HUE) }]}
        axes={[
          {
            id: "y",
            title: `${t("experiments.jet.chart.reflected")} (%)`,
            format: (v) => formatNumber(v, 0, locale),
            includeZero: true,
          },
        ]}
        x={{
          key: "deg",
          title: `${t("experiments.jet.chart.incidence")} (°)`,
          format: (v) => formatNumber(v, 0, locale),
        }}
      />
    </>
  );
}

function JetComputed() {
  const { t } = useTranslation();
  const c = (key: string) => t(`experiments.jet.computed.${key}`);
  return (
    <>
      <p>{c("system")}</p>
      <p>{c("check")}</p>
      <p>{c("left_out")}</p>
    </>
  );
}
