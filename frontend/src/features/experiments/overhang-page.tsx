import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@eifi1/ui-kit";
import { SeriesChart } from "@/shared/charts/series-chart";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber } from "@/shared/lib/format";
import { useChartHue } from "@/shared/state/palette-store";
import type { OverhangRequest } from "@/shared/types";
import { SliderField } from "@/shared/ui/slider-field";
import { svgPoint } from "@/shared/ui/svg-point";
import { Figures, WidgetCard } from "@/shared/ui/widget";
import { Equation } from "./equation";
import { ExhibitFrame } from "./exhibit-frame";
import { BuildPending } from "./build-pending";
import { settingNumber, useCheckSetting } from "./check-setting";
import { PreviewPending, type PreviewProps } from "./preview-mode";
import { useFrameLoop } from "./play";
import { MOST_BLOCKS, blocksFor, even, harmonic, holds, layers, overhang } from "./simulate/overhang";
import { SIDE, VIEW_FRAME } from "./stage";
import { useExperimentsDefaults } from "./use-experiments";
import { HeldAnswer, useHeld } from "./held";

/** The drawing: a block length in its units, the edge's place, the margins. */
const VIEW = { width: 300, scale: 80, edge: 130, top: 22, bottom: 18, table: 12 } as const;
/** How far an arrow key moves a block, in lengths: a millimetre of a 20 cm block, or a centimetre with Shift. */
const KEY_STEP = 0.005;
const KEY_STEP_BIG = 0.05;
/** How far the part of a stack that tips is drawn turned, in degrees: enough to see, not a fall. */
const TIP_DEG = 9;
/** The preview's build: from flush to the furthest and back, smoothly. */
const PREVIEW_LOOP_S = 8;
const HOLD_HUE = 0;
const TIP_HUE = 4;
const HARMONIC_HUE = 2;
const EVEN_HUE = 3;
/** The reaches the trick names, in lengths. */
const REACHES = [1, 2, 3, 4];

const flush = (n: number) => Array.from({ length: n }, () => -1);

/**
 * The overhang (`experiments.overhang`): identical blocks dragged over a
 * table's edge, whether each layer holds from the browser port
 * (`simulate/overhang.ts`, held to the engine by `simulate.test.ts`). No route.
 */
export function OverhangPage() {
  const { t } = useTranslation();
  const defaults = useExperimentsDefaults();
  const data = defaults.data?.overhang;
  return (
    <ExhibitFrame
      exhibit="overhang"
      atTheExhibit={
        <>
          <p>{t("experiments.overhang.at.blocks")}</p>
          <p>{t("experiments.overhang.at.most")}</p>
          <p>{t("experiments.overhang.at.further")}</p>
        </>
      }
      whatHappens={<OverhangModel />}
      computed={<OverhangComputed />}
      sweetSpot={<OverhangTrick />}
    >
      {defaults.isPending || !data ? (
        <BuildPending pending={defaults.isPending} error={defaults.error} />
      ) : (
        <OverhangPlay blocks={data} />
      )}
    </ExhibitFrame>
  );
}

/** The exhibit's nine pushed out to the furthest and back, again and again. */
export function OverhangPreview({ paused }: PreviewProps) {
  const defaults = useExperimentsDefaults();
  const data = defaults.data?.overhang;
  const [time, setTime] = useState(0);
  useFrameLoop(!paused, (dt) => setTime((s) => s + dt));
  if (!data) return <PreviewPending />;
  // Both ends hold, and every stack between: each condition is linear along the way.
  const phase = (time % PREVIEW_LOOP_S) / PREVIEW_LOOP_S;
  const s = 0.5 - 0.5 * Math.cos(2 * Math.PI * phase);
  const furthest = harmonic(data.blocks);
  return <StackView blocks={data} lefts={furthest.map((h) => -1 + s * (h + 1))} />;
}

/** The stack over the table, its centres of mass marked, the part that tips drawn turning. */
function StackView({
  blocks,
  lefts,
  onMove,
}: {
  blocks: OverhangRequest;
  lefts: number[];
  onMove?: (index: number, left: number) => void;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hue = useChartHue();
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ index: number; startX: number; startLeft: number } | null>(null);
  const n = lefts.length;
  const h = (VIEW.scale * blocks.height_m) / blocks.length_m;
  const height = VIEW.top + n * h + VIEW.bottom;
  const tableY = VIEW.top + n * h;
  const stack = layers(lefts);
  const tipping = stack.findIndex((layer) => layer.margin < -1e-12);
  const x = (lengths: number) => VIEW.edge + lengths * VIEW.scale;
  const y = (i: number) => tableY - (i + 1) * h;
  // The part from the lowest failing layer up turns about the end of its footing it has passed.
  const pivot =
    tipping >= 0
      ? {
          x: x(stack[tipping].centre > stack[tipping].right ? stack[tipping].right : stack[tipping].left),
          y: tableY - tipping * h,
          deg: stack[tipping].centre > stack[tipping].right ? TIP_DEG : -TIP_DEG,
        }
      : null;
  const reach = overhang(lefts);

  // The pointer along the table, in block lengths; only differences are used,
  // so where the drawing cannot be mapped the screen's pixels stand in.
  const toLengths = (clientX: number, clientY: number) => {
    const p = svg.current ? svgPoint(svg.current, clientX, clientY) : null;
    return (p ? p[0] : clientX) / VIEW.scale;
  };
  const down = (index: number) => (event: PointerEvent<SVGRectElement>) => {
    if (!onMove) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drag.current = { index, startX: toLengths(event.clientX, event.clientY), startLeft: lefts[index] };
  };
  const move = (event: PointerEvent<SVGRectElement>) => {
    const d = drag.current;
    if (!d || !onMove) return;
    onMove(d.index, d.startLeft + toLengths(event.clientX, event.clientY) - d.startX);
  };
  const up = () => {
    drag.current = null;
  };
  const key = (index: number) => (event: KeyboardEvent<SVGGElement>) => {
    if (!onMove) return;
    const step = event.shiftKey ? KEY_STEP_BIG : KEY_STEP;
    if (event.key === "ArrowRight") onMove(index, lefts[index] + step);
    else if (event.key === "ArrowLeft") onMove(index, lefts[index] - step);
    else return;
    event.preventDefault();
  };

  const block = (left: number, i: number) => {
    const reachCm = (left + 1) * blocks.length_m * 100;
    return (
      <g
        key={i}
        tabIndex={onMove ? 0 : undefined}
        role={onMove ? "slider" : undefined}
        aria-label={onMove ? t("experiments.overhang.play.block", { n: n - i }) : undefined}
        aria-valuemin={onMove ? -200 : undefined}
        aria-valuemax={onMove ? 200 : undefined}
        aria-valuenow={onMove ? Math.round(reachCm * 10) / 10 : undefined}
        aria-valuetext={onMove ? `${formatNumber(reachCm, 1, locale)} cm` : undefined}
        onKeyDown={key(i)}
        className="outline-none focus-visible:[&>rect]:stroke-[3]"
      >
        <rect
          x={x(left)}
          y={y(i)}
          width={VIEW.scale}
          height={h}
          rx={1}
          className="fill-current text-primary"
          fillOpacity={0.18}
          stroke="currentColor"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          style={{ cursor: onMove ? "ew-resize" : undefined, touchAction: "none" }}
          onPointerDown={down(i)}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        />
      </g>
    );
  };

  const dot = (layer: (typeof stack)[number], i: number) => (
    <circle
      key={`c${i}`}
      cx={x(layer.centre)}
      cy={tableY - i * h}
      r={2.2}
      fill={hue(layer.margin >= -1e-12 ? HOLD_HUE : TIP_HUE)}
    />
  );

  return (
    <svg
      ref={svg}
      viewBox={`0 0 ${VIEW.width} ${height}`}
      role="group"
      aria-label={t("experiments.overhang.view")}
      className={`select-none ${VIEW_FRAME}`}
    >
      <rect x={0} y={tableY} width={VIEW.edge} height={VIEW.table} className="fill-current" fillOpacity={0.45} />
      <line
        x1={VIEW.edge}
        y1={8}
        x2={VIEW.edge}
        y2={height}
        stroke="currentColor"
        strokeDasharray="3 3"
        vectorEffect="non-scaling-stroke"
      />
      {/* Each layer's centre of mass, on the footing it must lie over; the part that tips turns with its dots. */}
      {lefts.map((left, i) => (tipping >= 0 && i >= tipping ? null : block(left, i)))}
      {stack.map((layer, i) => (tipping >= 0 && i >= tipping ? null : dot(layer, i)))}
      {pivot && (
        <g transform={`rotate(${pivot.deg} ${pivot.x} ${pivot.y})`}>
          {lefts.map((left, i) => (i >= tipping ? block(left, i) : null))}
          {stack.map((layer, i) => (i >= tipping ? dot(layer, i) : null))}
        </g>
      )}
      {/* A whole block past the edge: a goal to try for that does not give the
          furthest away (nine reach 1.41 lengths; four are the fewest for one). */}
      <line
        x1={x(1)}
        y1={14}
        x2={x(1)}
        y2={tableY}
        stroke="currentColor"
        strokeDasharray="2 3"
        className="text-brand"
        vectorEffect="non-scaling-stroke"
      />
      {/* To the right of the line, where no stack of nine reaches above the
          blocks; on the left it ran through the edge's line. */}
      <text x={x(1) + 2} y={19} fontSize={6} className="fill-current text-secondary">
        {t("experiments.overhang.goal")}
      </text>
      {reach > 0 && (
        <g fill="currentColor" fontSize={7}>
          <line x1={VIEW.edge} y1={12} x2={x(reach)} y2={12} stroke="currentColor" vectorEffect="non-scaling-stroke" />
          <text x={(VIEW.edge + x(reach)) / 2} y={9} textAnchor="middle">
            {formatNumber(reach * blocks.length_m * 100, 1, locale)} cm
          </text>
        </g>
      )}
    </svg>
  );
}

function OverhangPlay({ blocks }: { blocks: OverhangRequest }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const [lefts, setLefts] = useState<number[]>(() => flush(blocks.blocks));
  // The furthest a stack can reach, and the button that builds it, once the
  // reader has pushed a stack past what holds: they have found an edge of
  // their own to set it against.
  const held = useHeld();
  const n = lefts.length;
  const stack = layers(lefts);
  const standing = holds(lefts);
  const reach = overhang(lefts);
  const tipping = stack.findIndex((layer) => layer.margin < -1e-12);
  const best = overhang(harmonic(n));
  const cm = (lengths: number) => formatNumber(lengths * blocks.length_m * 100, 1, locale);
  // A check case's "Set it up": the number of blocks in equal steps. The
  // furthest stack is the held answer above, so its cases set nothing.
  useCheckSetting("overhang", (setting) => {
    const count = Math.round(settingNumber(setting, "blocks", n));
    setLefts(setting.stack === "even" ? even(count) : flush(count));
    return true;
  });
  const move = (index: number, left: number) => {
    const next = lefts.map((l, i) => (i === index ? Math.max(-2, Math.min(2, left)) : l));
    setLefts(next);
    if (!holds(next)) held.show();
  };
  return (
    <WidgetCard
      title={t("experiments.overhang.play.title")}
      hint={t("experiments.overhang.play.hint")}
      actions={
        <>
          <Button variant="secondary" size="sm" onClick={() => setLefts(flush(n))}>
            {t("experiments.overhang.play.flush")}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setLefts(even(n))}>
            {t("experiments.overhang.play.even")}
          </Button>
          {held.shown && (
            <Button variant="secondary" size="sm" onClick={() => setLefts(harmonic(n))}>
              {t("experiments.overhang.play.furthest")}
            </Button>
          )}
        </>
      }
    >
      <div className={`${SIDE.grid} ${SIDE.cap["2xl"]}`}>
        <div className={SIDE.top}>
          <SliderField
            label={t("experiments.overhang.play.count")}
            unit=""
            value={n}
            min={1}
            max={MOST_BLOCKS}
            step={1}
            digits={0}
            hint={t("experiments.overhang.play.count_hint")}
            onChange={(v) => setLefts(flush(Math.round(v)))}
          />
        </div>
        <div className={`${SIDE.views} mx-auto w-full max-w-2xl`}>
          <figure className="space-y-1">
            <StackView blocks={blocks} lefts={lefts} onMove={move} />
            <figcaption className="text-center text-caption text-muted">
              {t("experiments.overhang.play.caption", {
                length: formatNumber(blocks.length_m * 100, 0, locale),
                height: formatNumber(blocks.height_m * 100, 0, locale),
              })}
            </figcaption>
          </figure>
          <p className={`text-sm font-medium ${standing ? "text-primary" : "text-danger"}`} role="status">
            {standing
              ? t("experiments.overhang.play.holds", { cm: cm(reach), lengths: formatNumber(reach, 2, locale) })
              : t("experiments.overhang.play.tips", { count: n - tipping })}
          </p>
        </div>
        <div className={SIDE.column}>
          <Figures
            tiles={[
              {
                key: "reach",
                label: t("experiments.overhang.figures.reach"),
                value: reach * blocks.length_m * 100,
                digits: 1,
                unit: "cm",
              },
              {
                key: "best",
                label: t("experiments.overhang.figures.best"),
                value: best * blocks.length_m * 100,
                digits: 1,
                unit: "cm",
                held: !held.shown,
              },
              {
                key: "even",
                label: t("experiments.overhang.figures.even"),
                value: overhang(even(n)) * blocks.length_m * 100,
                digits: 1,
                unit: "cm",
              },
            ]}
          />
          <HeldAnswer held={held}>{null}</HeldAnswer>
        </div>
      </div>
    </WidgetCard>
  );
}

function OverhangModel() {
  const { t } = useTranslation();
  const s = (key: string) => t(`experiments.overhang.symbols.${key}`);
  return (
    <>
      <p>{t("experiments.overhang.model.intro")}</p>
      <Equation
        tex={String.raw`\ell_k \le \bar x_k \le r_k, \qquad \bar x_k = \frac{1}{n-k}\sum_{j \ge k} x_j`}
        reads={t("experiments.overhang.model.holds")}
        symbols={[
          { tex: String.raw`\bar x_k`, meaning: s("centre"), unit: "L" },
          { tex: String.raw`\ell_k, r_k`, meaning: s("footing"), unit: "L" },
          { tex: "x_j", meaning: s("x"), unit: "L" },
          { tex: "n", meaning: s("n"), unit: "1" },
        ]}
      />
      <Equation
        tex={String.raw`d_k = \frac{1}{2k}`}
        reads={t("experiments.overhang.model.step")}
        symbols={[
          { tex: "d_k", meaning: s("d"), unit: "L" },
          { tex: "k", meaning: s("k"), unit: "1" },
        ]}
      />
      <Equation
        tex={String.raw`D_n = \frac12\left(1 + \frac12 + \frac13 + \dots + \frac1n\right) = \frac{H_n}{2}`}
        reads={t("experiments.overhang.model.harmonic")}
        symbols={[
          { tex: "D_n", meaning: s("reach"), unit: "L" },
          { tex: "H_n", meaning: s("h"), unit: "1" },
        ]}
      />
      <Equation
        tex={String.raw`D_n^\text{even} = \frac{n}{n+1} < 1`}
        reads={t("experiments.overhang.model.even")}
        symbols={[{ tex: String.raw`D_n^\text{even}`, meaning: s("even"), unit: "L" }]}
      />
    </>
  );
}

function OverhangTrick() {
  const { t } = useTranslation();
  const locale = useLocale();
  const hue = useChartHue();
  const rows = useMemo(
    () =>
      Array.from({ length: MOST_BLOCKS }, (_, k) => ({
        n: k + 1,
        furthest: overhang(harmonic(k + 1)),
        even: overhang(even(k + 1)),
      })),
    [],
  );
  return (
    <>
      <p>{t("experiments.overhang.sweet.steps")}</p>
      <p>{t("experiments.overhang.sweet.endless")}</p>
      <Figures
        tiles={REACHES.map((r) => ({
          key: String(r),
          label: t("experiments.overhang.sweet.reach", { count: r }),
          value: blocksFor(r),
          digits: 0,
        }))}
      />
      <p>{t("experiments.overhang.sweet.knife")}</p>
      <p className="text-sm text-secondary">{t("experiments.overhang.chart.hint")}</p>
      <SeriesChart
        rows={rows}
        series={[
          { key: "furthest", label: t("experiments.overhang.chart.furthest"), color: hue(HARMONIC_HUE) },
          { key: "even", label: t("experiments.overhang.chart.even"), color: hue(EVEN_HUE), dashed: true },
        ]}
        axes={[
          {
            id: "y",
            title: `${t("experiments.overhang.chart.reach")} (${t("experiments.overhang.chart.lengths")})`,
            format: (v) => formatNumber(v, 1, locale),
            includeZero: true,
          },
        ]}
        x={{ key: "n", title: t("experiments.overhang.chart.blocks"), format: (v) => formatNumber(v, 0, locale) }}
      />
    </>
  );
}

function OverhangComputed() {
  const { t } = useTranslation();
  const c = (key: string) => t(`experiments.overhang.computed.${key}`);
  return (
    <>
      <p>{c("system")}</p>
      <p>{c("check")}</p>
      <p>{c("left_out")}</p>
    </>
  );
}
