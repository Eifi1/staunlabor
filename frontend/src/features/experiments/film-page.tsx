import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button, Switch } from "@eifi1/ui-kit";
import { SeriesChart } from "@/shared/charts/series-chart";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber } from "@/shared/lib/format";
import { useChartHue } from "@/shared/state/palette-store";
import type { FilmRequest } from "@/shared/types";
import { SliderField } from "@/shared/ui/slider-field";
import { svgPoint } from "@/shared/ui/svg-point";
import { Figures, WidgetCard } from "@/shared/ui/widget";
import { Equation } from "./equation";
import { ExhibitFrame } from "./exhibit-frame";
import { BuildPending } from "./build-pending";
import { settingNumber, useCheckSetting } from "./check-setting";
import { HeldAnswer, useHeld } from "./held";
import { PreviewPending, type PreviewProps } from "./preview-mode";
import { useFrameLoop } from "./play";
import { EQUAL_RATIO, TANGENT_T, TEAR_RATIO, catenoids, discsM2, figures, radiusAt, tears } from "./simulate/film";
import { SIDE, STAGE, VIEW_FRAME } from "./stage";
import { useExperimentsDefaults } from "./use-experiments";

/** The drawing, in centimetres: the left ring at 0, the right one `h` from it,
 *  the axis across the middle, the stands' foot below. */
const VIEW = { left: -2.5, width: 17, top: -9, height: 19.5, foot: 9.6 } as const;
/** How round a ring is drawn: seen a little from the side, an ellipse this
 *  much narrower than it is tall. */
const TILT = 0.22;
/** The rings' distance, in cm: the slider's ends and an arrow key's steps. */
const DISTANCE = { min: 0.2, max: 12, step: 0.1, big: 1 } as const;
const RADIUS = { min: 3, max: 8, step: 0.5 } as const;
/** Cross-sections drawn across the film, to show it round. */
const SECTIONS = 7;
/** Points along each edge of the film. */
const EDGE_POINTS = 60;
/** The preview: the rings drawn apart to past the tear, then back, torn. */
const PREVIEW = { out_s: 6, back_s: 2, past: 1.12 } as const;
const FILM_HUE = 0;
const THIN_HUE = 4;
const DISCS_HUE = 2;
/** Points of the trick's chart, from the rings almost touching to the tear. */
const CHART_POINTS = 120;

const cm = (m: number) => m * 100;

/**
 * The soap film between two rings (`experiments.film`): the catenoid and its
 * tear from the browser port (`simulate/film.ts`, held to the engine by
 * `simulate.test.ts`). No route.
 */
export function FilmPage() {
  const { t } = useTranslation();
  const defaults = useExperimentsDefaults();
  const data = defaults.data?.film;
  return (
    <ExhibitFrame
      exhibit="film"
      atTheExhibit={
        <>
          <p>{t("experiments.film.at.rings")}</p>
          <p>{t("experiments.film.at.waist")}</p>
        </>
      }
      whatHappens={<FilmModel />}
      computed={<FilmComputed />}
      sweetSpot={<FilmTrick />}
    >
      {defaults.isPending || !data ? (
        <BuildPending pending={defaults.isPending} error={defaults.error} />
      ) : (
        <FilmPlay start={data} />
      )}
    </ExhibitFrame>
  );
}

/** The rings drawn apart until the film snaps, then back, again and again. */
export function FilmPreview({ paused }: PreviewProps) {
  const defaults = useExperimentsDefaults();
  const data = defaults.data?.film;
  const [time, setTime] = useState(0);
  useFrameLoop(!paused, (dt) => setTime((s) => s + dt));
  if (!data) return <PreviewPending />;
  const loop = PREVIEW.out_s + PREVIEW.back_s;
  const at = time % loop;
  const far = PREVIEW.past * TEAR_RATIO * data.radius_m;
  const near = data.distance_m;
  const distance =
    at < PREVIEW.out_s
      ? near + ((far - near) * at) / PREVIEW.out_s
      : far - ((far - near) * (at - PREVIEW.out_s)) / PREVIEW.back_s;
  // Torn once the way out has passed the tear, until the loop dips it anew.
  const tornAt = ((TEAR_RATIO * data.radius_m - near) / (far - near)) * PREVIEW.out_s;
  return <FilmView rings={{ radius_m: data.radius_m, distance_m: distance }} torn={at > tornAt} thin={false} />;
}

/** The rings from the side, the film between them, or the two discs it leaves. */
function FilmView({
  rings,
  torn,
  thin,
  onMove,
}: {
  rings: FilmRequest;
  torn: boolean;
  thin: boolean;
  onMove?: (distance_m: number) => void;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hue = useChartHue();
  const svg = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const r = cm(rings.radius_m);
  const h = cm(rings.distance_m);
  const both = torn ? null : catenoids(rings);
  const edge = (neck: number, side: 1 | -1) =>
    Array.from({ length: EDGE_POINTS + 1 }, (_, k) => {
      const x = (h * k) / EDGE_POINTS;
      return `${x},${side * radiusAt(neck, x - h / 2)}`;
    });
  const outline = (neck: number) => `M${edge(neck, -1).join(" L")} L${edge(neck, 1).reverse().join(" L")} Z`;

  const toDistance = (clientX: number, clientY: number) => {
    const p = svg.current ? svgPoint(svg.current, clientX, clientY) : null;
    return p ? p[0] : null;
  };
  const move = (x: number | null) => {
    if (x === null || !onMove) return;
    onMove(Math.max(DISTANCE.min, Math.min(DISTANCE.max, x)) / 100);
  };
  const down = (event: PointerEvent<SVGRectElement>) => {
    if (!onMove) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragging.current = true;
  };
  const drag = (event: PointerEvent<SVGRectElement>) => {
    if (dragging.current) move(toDistance(event.clientX, event.clientY));
  };
  const up = () => {
    dragging.current = false;
  };
  const key = (event: KeyboardEvent<SVGGElement>) => {
    const step = event.shiftKey ? DISTANCE.big : DISTANCE.step;
    if (event.key === "ArrowRight") move(h + step);
    else if (event.key === "ArrowLeft") move(h - step);
    else return;
    event.preventDefault();
  };

  const ring = (x: number) => (
    <ellipse
      cx={x}
      cy={0}
      rx={TILT * r}
      ry={r}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      className="text-primary"
      vectorEffect="non-scaling-stroke"
    />
  );
  const stand = (x: number) => (
    <line
      x1={x}
      y1={r}
      x2={x}
      y2={VIEW.foot}
      stroke="currentColor"
      strokeWidth={2}
      className="text-primary"
      vectorEffect="non-scaling-stroke"
    />
  );

  return (
    <svg
      ref={svg}
      viewBox={`${VIEW.left} ${VIEW.top} ${VIEW.width} ${VIEW.height}`}
      role="group"
      aria-label={t("experiments.film.view")}
      className={`select-none ${VIEW_FRAME} ${STAGE.wide}`}
    >
      <line
        x1={VIEW.left}
        y1={VIEW.foot}
        x2={VIEW.left + VIEW.width}
        y2={VIEW.foot}
        stroke="currentColor"
        strokeWidth={3}
        vectorEffect="non-scaling-stroke"
      />
      {stand(0)}
      {stand(h)}
      {both && (
        <g>
          <path d={outline(both[0].neck_m * 100)} fill={hue(FILM_HUE)} fillOpacity={0.22} stroke="none" />
          {Array.from({ length: SECTIONS }, (_, k) => {
            const x = (h * (k + 1)) / (SECTIONS + 1);
            const rz = radiusAt(both[0].neck_m * 100, x - h / 2);
            return (
              <ellipse
                key={k}
                cx={x}
                cy={0}
                rx={TILT * rz}
                ry={rz}
                fill="none"
                stroke={hue(FILM_HUE)}
                strokeOpacity={0.35}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
          {[-1, 1].map((side) => (
            <polyline
              key={side}
              points={edge(both[0].neck_m * 100, side as 1 | -1).join(" ")}
              fill="none"
              stroke={hue(FILM_HUE)}
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {/* The waist, across the film's narrowest place. */}
          <line
            x1={h / 2}
            y1={-both[0].neck_m * 100}
            x2={h / 2}
            y2={both[0].neck_m * 100}
            stroke="currentColor"
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
          {thin &&
            [-1, 1].map((side) => (
              <polyline
                key={`thin${side}`}
                points={edge(both[1].neck_m * 100, side as 1 | -1).join(" ")}
                fill="none"
                stroke={hue(THIN_HUE)}
                strokeWidth={2}
                strokeDasharray="5 4"
                vectorEffect="non-scaling-stroke"
              />
            ))}
        </g>
      )}
      {(torn || !both) &&
        [0, h].map((x) => (
          <ellipse key={x} cx={x} cy={0} rx={TILT * r} ry={r} fill={hue(DISCS_HUE)} fillOpacity={0.35} stroke="none" />
        ))}
      {ring(0)}
      <g
        tabIndex={onMove ? 0 : undefined}
        role={onMove ? "slider" : undefined}
        aria-label={onMove ? t("experiments.film.play.ring") : undefined}
        aria-valuemin={onMove ? DISTANCE.min : undefined}
        aria-valuemax={onMove ? DISTANCE.max : undefined}
        aria-valuenow={onMove ? Math.round(h * 10) / 10 : undefined}
        aria-valuetext={onMove ? `${formatNumber(h, 1, locale)} cm` : undefined}
        onKeyDown={onMove ? key : undefined}
        className="outline-none focus-visible:[&>ellipse]:stroke-[4]"
      >
        {ring(h)}
        {onMove && (
          <rect
            x={h - 1.5}
            y={-r - 0.5}
            width={3}
            height={2 * r + 1}
            fill="transparent"
            style={{ cursor: "ew-resize", touchAction: "none" }}
            onPointerDown={down}
            onPointerMove={drag}
            onPointerUp={up}
            onPointerCancel={up}
          />
        )}
      </g>
    </svg>
  );
}

function FilmPlay({ start }: { start: FilmRequest }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const [rings, setRings] = useState<FilmRequest>(start);
  const [torn, setTorn] = useState(false);
  const [thin, setThin] = useState(false);
  // The distance it tears at is the question: held until the reader has torn
  // a film, or asks.
  const held = useHeld();
  const f = figures(rings);
  const set = (next: FilmRequest) => {
    setRings(next);
    if (!torn && tears(next)) {
      setTorn(true);
      held.show();
    }
  };
  const dip = () => {
    setRings({ ...rings, distance_m: start.distance_m });
    setTorn(false);
  };
  // A check case's "Set it up": the rings' size and distance, dipped anew.
  useCheckSetting("film", (setting) => {
    const next = {
      radius_m: settingNumber(setting, "radius_m", rings.radius_m),
      distance_m: settingNumber(setting, "distance_m", rings.distance_m),
    };
    setRings(next);
    setTorn(tears(next));
    return true;
  });
  const area = (m2: number) => formatNumber(m2 * 1e4, 1, locale);
  const status = torn
    ? { text: t("experiments.film.play.torn"), tone: "text-danger" }
    : f.least
      ? {
          text: t("experiments.film.play.least", { area: area(f.area_m2 ?? 0), discs: area(f.discs_m2) }),
          tone: "text-primary",
        }
      : {
          text: t("experiments.film.play.held", { area: area(f.area_m2 ?? 0), discs: area(f.discs_m2) }),
          tone: "text-warning",
        };
  return (
    <WidgetCard
      title={t("experiments.film.play.title")}
      hint={t("experiments.film.play.hint")}
      actions={
        <Button variant="secondary" size="sm" onClick={dip}>
          {t("experiments.film.play.dip")}
        </Button>
      }
    >
      <div className={`${SIDE.grid} ${SIDE.cap["2xl"]}`}>
        <div className={SIDE.top}>
          <SliderField
            label={t("experiments.film.play.distance")}
            unit="cm"
            value={cm(rings.distance_m)}
            min={DISTANCE.min}
            max={DISTANCE.max}
            step={DISTANCE.step}
            digits={1}
            hint={t("experiments.film.play.distance_hint")}
            onChange={(v) => set({ ...rings, distance_m: v / 100 })}
          />
        </div>
        <div className={`${SIDE.views} mx-auto w-full max-w-2xl`}>
          <figure className="space-y-1">
            <FilmView rings={rings} torn={torn} thin={thin} onMove={(d) => set({ ...rings, distance_m: d })} />
            <figcaption className="text-center text-caption text-muted">
              {t("experiments.film.play.caption", { diameter: formatNumber(cm(2 * rings.radius_m), 0, locale) })}
            </figcaption>
          </figure>
          <p className={`text-sm font-medium ${status.tone}`} role="status">
            {status.text}
          </p>
        </div>
        <div className={SIDE.column}>
          <SliderField
            label={t("experiments.film.play.radius")}
            unit="cm"
            value={cm(rings.radius_m)}
            min={RADIUS.min}
            max={RADIUS.max}
            step={RADIUS.step}
            digits={1}
            hint={t("experiments.film.play.radius_hint")}
            onChange={(v) => set({ ...rings, radius_m: v / 100 })}
          />
          <Switch
            label={t("experiments.film.play.thin")}
            description={t("experiments.film.play.thin_hint")}
            checked={thin}
            onCheckedChange={setThin}
          />
          <Figures
            tiles={[
              {
                key: "neck",
                label: t("experiments.film.figures.neck"),
                value: torn || f.neck_m === null ? null : cm(f.neck_m),
                digits: 2,
                unit: "cm",
              },
              {
                key: "area",
                label: t("experiments.film.figures.area"),
                value: torn || f.area_m2 === null ? null : f.area_m2 * 1e4,
                digits: 1,
                unit: "cm²",
              },
              {
                key: "discs",
                label: t("experiments.film.figures.discs"),
                value: f.discs_m2 * 1e4,
                digits: 1,
                unit: "cm²",
              },
              {
                key: "tear",
                label: t("experiments.film.figures.tear"),
                value: cm(f.tear_m),
                digits: 2,
                unit: "cm",
                held: !held.shown,
              },
            ]}
          />
          <HeldAnswer held={held}>{null}</HeldAnswer>
        </div>
      </div>
    </WidgetCard>
  );
}

function FilmModel() {
  const { t } = useTranslation();
  const s = (key: string) => t(`experiments.film.symbols.${key}`);
  return (
    <>
      <p>{t("experiments.film.model.intro")}</p>
      <Equation
        tex={String.raw`r(z) = c\,\cosh\frac{z}{c}`}
        reads={t("experiments.film.model.catenoid")}
        symbols={[
          { tex: "r", meaning: s("r"), unit: "m" },
          { tex: "z", meaning: s("z"), unit: "m" },
          { tex: "c", meaning: s("c"), unit: "m" },
        ]}
      />
      <Equation
        tex={String.raw`R = c\,\cosh\frac{h}{2c}`}
        reads={t("experiments.film.model.rings")}
        symbols={[
          { tex: "R", meaning: s("R"), unit: "m" },
          { tex: "h", meaning: s("h"), unit: "m" },
        ]}
      />
      <Equation
        tex={String.raw`\frac{h}{R} = \frac{2t}{\cosh t}, \qquad t = \frac{h}{2c}`}
        reads={t("experiments.film.model.ratio")}
        symbols={[{ tex: "t", meaning: s("t"), unit: "1" }]}
      />
      <Equation
        tex={String.raw`t \tanh t = 1, \qquad h_\text{max} = \frac{2t}{\cosh t}\,R`}
        reads={t("experiments.film.model.peak")}
        symbols={[{ tex: String.raw`h_\text{max}`, meaning: s("hmax"), unit: "m" }]}
      />
      <Equation
        tex={String.raw`A = \pi c\left(h + c\,\sinh\frac{h}{c}\right), \qquad A_\text{disc} = 2\pi R^2`}
        reads={t("experiments.film.model.area")}
        symbols={[
          { tex: "A", meaning: s("A"), unit: "m²" },
          { tex: String.raw`A_\text{disc}`, meaning: s("discs"), unit: "m²" },
        ]}
      />
      <p>{t("experiments.film.model.two")}</p>
    </>
  );
}

function FilmTrick() {
  const { t } = useTranslation();
  const locale = useLocale();
  const hue = useChartHue();
  const rows = useMemo(
    () =>
      Array.from({ length: CHART_POINTS + 1 }, (_, k) => {
        // From a sixtieth of a radius apart to the tear itself, a hair short.
        const ratio = (TEAR_RATIO * (1 - 1e-12) * (k + 1)) / (CHART_POINTS + 1);
        const both = catenoids({ radius_m: 1, distance_m: ratio });
        const discs = discsM2(1);
        return {
          ratio,
          wide: both ? both[0].area_m2 / discs : null,
          thin: both ? both[1].area_m2 / discs : null,
          discs: 1,
        };
      }),
    [],
  );
  return (
    <>
      <p>{t("experiments.film.sweet.least")}</p>
      <p>{t("experiments.film.sweet.tear")}</p>
      <Figures
        tiles={[
          { key: "equal", label: t("experiments.film.sweet.equal_tile"), value: EQUAL_RATIO, digits: 3 },
          { key: "tear", label: t("experiments.film.sweet.tear_tile"), value: TEAR_RATIO, digits: 4 },
          { key: "t", label: t("experiments.film.sweet.t_tile"), value: TANGENT_T, digits: 4 },
        ]}
      />
      <p className="text-sm text-secondary">{t("experiments.film.chart.hint")}</p>
      <SeriesChart
        rows={rows}
        series={[
          { key: "wide", label: t("experiments.film.chart.wide"), color: hue(FILM_HUE) },
          { key: "thin", label: t("experiments.film.chart.thin"), color: hue(THIN_HUE), dashed: true },
          { key: "discs", label: t("experiments.film.chart.discs"), color: hue(DISCS_HUE) },
        ]}
        axes={[
          {
            id: "y",
            title: t("experiments.film.chart.area"),
            format: (v) => formatNumber(v, 1, locale),
            includeZero: true,
          },
        ]}
        x={{ key: "ratio", title: t("experiments.film.chart.distance"), format: (v) => formatNumber(v, 2, locale) }}
      />
      <p>{t("experiments.film.sweet.seen")}</p>
    </>
  );
}

function FilmComputed() {
  const { t } = useTranslation();
  return (
    <>
      <p>{t("experiments.film.computed.system")}</p>
      <p>{t("experiments.film.computed.left_out")}</p>
    </>
  );
}
