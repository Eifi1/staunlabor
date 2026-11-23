import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDown, Shuffle, SkipForward } from "lucide-react";
import { Button } from "@eifi1/ui-kit";
import { SeriesChart } from "@/shared/charts/series-chart";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber } from "@/shared/lib/format";
import { useChartHue } from "@/shared/state/palette-store";
import type { GaltonRequest } from "@/shared/types";
import { SliderField } from "@/shared/ui/slider-field";
import { Figures, WidgetCard } from "@/shared/ui/widget";
import { Equation } from "./equation";
import { ExhibitFrame } from "./exhibit-frame";
import { BuildPending } from "./build-pending";
import { settingNumber, useCheckSetting } from "./check-setting";
import { HeldAnswer, useHeld, type Held } from "./held";
import { useFrameLoop, useRunning } from "./play";
import { RestartButton, RunPauseButton, SpeedToggle } from "./play-controls";
import { PreviewPending, type PreviewMode, type PreviewProps } from "./preview-mode";
import { MOST_BALLS, MOST_ROWS, drop, figures, normal, paths, shares } from "./simulate/galton";
import { SIDE, VIEW_FRAME } from "./stage";
import { useExperimentsDefaults } from "./use-experiments";

/** Real time, and faster for a long run. */
const SPEEDS = [1, 5, 20] as const;
type Speed = (typeof SPEEDS)[number];

/** The balls' timing, drawn, not computed: a ball a twentieth of a second,
 *  from the funnel to the first pin, from pin to pin, and into its bin. */
const RATE_PER_S = 20;
const LEAD_S = 0.15;
const ROW_S = 0.06;
const FALL_S = 0.25;

/** The preview's runs, five times real time, and the full heap held a moment. */
const PREVIEW_SPEED = 5;
const PREVIEW_HOLD_S = 1.5;
/** Where the preview's first frame stands in its first run: a heap half
 *  grown and balls in flight, the still a reader without motion sees. */
const PREVIEW_START = 0.6;

/** The drawing: its width, the side margins, where the pins start, the bins' height. */
const VIEW = { width: 300, margin: 10, funnel: 24, pins: 34, bins: 110 } as const;
/** The tallest expected bin fills this share of the bins' height. */
const HEAP_FILL = 0.8;

const BALL_HUE = 2;
const EXPECT_HUE = 4;
const NORMAL_HUE = 6;

/** The tilt's slider: a share to the right from a twentieth to nineteen twentieths. */
const SHARE_MIN = 0.05;
const SHARE_MAX = 0.95;

/** The board the reader built: the defaults' without their seed, which the run keeps apart. */
type Build = Omit<GaltonRequest, "seed">;

/** When ball `i` has landed, at the run's time `t`: the balls landed by then. */
function landedBy(t: number, balls: number, flight: number): number {
  if (t < flight) return 0;
  return Math.min(balls, Math.floor((t - flight) * RATE_PER_S) + 1);
}

function flightOf(rows: number): number {
  return LEAD_S + rows * ROW_S + FALL_S;
}

/** The run's last landing. */
function endOf(rows: number, balls: number): number {
  return (balls - 1) / RATE_PER_S + flightOf(rows);
}

/**
 * The Galton board (`experiments.galton`): balls dropped one by one through
 * rows of pins, every turn drawn from the seeded generator of the browser port
 * (`simulate/galton.ts`, held to the engine by `simulate.test.ts`), the
 * binomial heap beside them. No route.
 */
export function GaltonPage() {
  const { t } = useTranslation();
  const defaults = useExperimentsDefaults();
  const data = defaults.data?.galton;
  const [build, setBuild] = useState<Build | null>(null);
  const [seedHere, setSeed] = useState<number | null>(null);
  // A new run from "New balls" starts at once; a new build waits for its drop.
  const [go, setGo] = useState(false);
  const held = useHeld();
  const shown: Build | null = build ?? (data ? { rows: data.rows, p: data.p, balls: data.balls } : null);
  const seed = seedHere ?? data?.seed ?? 0;
  // A check case's "Set it up": the rows, the tilt and, for the exhibit's run,
  // its balls and seed.
  useCheckSetting("galton", (setting) => {
    if (!data || !shown) return false;
    setBuild({
      rows: Math.round(settingNumber(setting, "rows", shown.rows)),
      p: settingNumber(setting, "p", shown.p),
      balls: Math.round(settingNumber(setting, "balls", shown.balls)),
    });
    setSeed(Math.round(settingNumber(setting, "seed", seed)));
    setGo(false);
    return true;
  });
  return (
    <ExhibitFrame
      exhibit="galton"
      atTheExhibit={
        <>
          <p>{t("experiments.galton.at.funnel")}</p>
          <p>{t("experiments.galton.at.heap")}</p>
          <p>{t("experiments.galton.at.tilt")}</p>
        </>
      }
      whatHappens={<GaltonModel />}
      computed={<GaltonComputed />}
      sweetSpot={<GaltonTrick build={shown ?? { rows: 12, p: 0.5, balls: 500 }} />}
    >
      {defaults.isPending || !data || !shown ? (
        <BuildPending pending={defaults.isPending} error={defaults.error} />
      ) : (
        <>
          {/* A new board or a new seed is a new run: the balls back in the funnel. */}
          <GaltonPlay
            key={`${shown.rows} ${shown.p} ${shown.balls} ${seed}`}
            build={shown}
            seed={seed}
            first={data.seed}
            held={held}
            startNow={go}
            onNewBalls={() => {
              setSeed((seed + 1) >>> 0);
              setGo(true);
            }}
          />
          <GaltonBuild
            build={shown}
            onChange={(next) => {
              setBuild(next);
              setGo(false);
            }}
          />
        </>
      )}
    </ExhibitFrame>
  );
}

/** Run after run poured into the bins, each from the next seed. */
export function GaltonPreview({ paused }: PreviewProps) {
  const defaults = useExperimentsDefaults();
  const data = defaults.data?.galton;
  return data ? (
    <GaltonPlay
      build={{ rows: data.rows, p: data.p, balls: data.balls }}
      seed={data.seed}
      first={data.seed}
      preview
      paused={paused}
    />
  ) : (
    <PreviewPending />
  );
}

/** The board: the funnel, the pins, the bins with the landed balls as heaps,
 *  the balls in flight, and, once out, the heap the binomial distribution expects. */
function BoardView({
  rows,
  p,
  balls,
  turns,
  bins,
  time,
  expected,
}: {
  rows: number;
  p: number;
  balls: number;
  turns: boolean[][];
  bins: number[];
  time: number;
  expected: boolean;
}) {
  const { t } = useTranslation();
  const hue = useChartHue();
  const b = (VIEW.width - 2 * VIEW.margin) / (rows + 1);
  const dy = Math.min(b * 0.9, 18);
  const cx = VIEW.width / 2;
  const pinR = Math.min(2.2, b * 0.15);
  const ballR = Math.min(3.5, b * 0.28);
  const pinY = (j: number) => VIEW.pins + j * dy;
  const binsTop = pinY(rows);
  const binsBottom = binsTop + VIEW.bins;
  const height = binsBottom + 6;
  const share = shares(rows, p);
  const unit = (VIEW.bins * HEAP_FILL) / (balls * Math.max(...share));
  const flight = flightOf(rows);
  const landed = landedBy(time, balls, flight);
  const counts = Array.from({ length: rows + 1 }, () => 0);
  for (let i = 0; i < landed; i++) counts[bins[i]] += 1;
  const heap = (k: number) => Math.min(VIEW.bins, counts[k] * unit);
  const binX = (k: number) => cx + (k - rows / 2) * b;
  const top = (j: number) => pinY(j) - pinR - ballR;

  // Each ball in flight: on its way from the funnel to the first pin, hopping
  // from pin to pin to the side its turn says, and dropping into its bin.
  const flying: { i: number; x: number; y: number }[] = [];
  const released = Math.min(balls - 1, Math.floor(time * RATE_PER_S));
  for (let i = landed; i <= released; i++) {
    const age = time - i / RATE_PER_S;
    if (age < 0) continue;
    if (age < LEAD_S) {
      flying.push({ i, x: cx, y: VIEW.funnel + (top(0) - VIEW.funnel) * (age / LEAD_S) });
      continue;
    }
    const along = age - LEAD_S;
    const j = Math.floor(along / ROW_S);
    if (j < rows) {
      const f = along / ROW_S - j;
      let rights = 0;
      for (let r = 0; r < j; r++) if (turns[i][r]) rights += 1;
      const x = cx + (rights - j / 2) * b + (turns[i][j] ? 1 : -1) * (b / 2) * f;
      const y = top(j) + (top(j + 1) - top(j)) * f - dy * 0.35 * Math.sin(Math.PI * f);
      flying.push({ i, x, y });
      continue;
    }
    const f = Math.min(1, (along - rows * ROW_S) / FALL_S);
    const k = bins[i];
    const end = binsBottom - heap(k) - ballR;
    flying.push({ i, x: binX(k), y: top(rows) + (end - top(rows)) * f * f });
  }

  const outline = share
    .map((s, k) => {
      const y = binsBottom - Math.min(VIEW.bins, balls * s * unit);
      return `${k === 0 ? "M" : "L"}${binX(k) - b / 2},${y} L${binX(k) + b / 2},${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${VIEW.width} ${height}`}
      role="img"
      aria-label={t("experiments.galton.view")}
      className={`select-none ${VIEW_FRAME}`}
    >
      {/* The funnel. */}
      <path
        d={`M${cx - 26},4 L${cx - ballR - 1.5},${VIEW.funnel} M${cx + 26},4 L${cx + ballR + 1.5},${VIEW.funnel}`}
        stroke="currentColor"
        strokeWidth={1.5}
        fill="none"
        vectorEffect="non-scaling-stroke"
      />
      {Array.from({ length: rows }, (_, j) =>
        Array.from({ length: j + 1 }, (_, i) => (
          <circle key={`${j} ${i}`} cx={cx + (i - j / 2) * b} cy={pinY(j)} r={pinR} className="fill-current" />
        )),
      )}
      {/* The bins' walls and floor. */}
      {Array.from({ length: rows + 2 }, (_, k) => (
        <line
          key={`w${k}`}
          x1={VIEW.margin + k * b}
          y1={binsTop}
          x2={VIEW.margin + k * b}
          y2={binsBottom}
          stroke="currentColor"
          strokeOpacity={0.5}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <line
        x1={VIEW.margin}
        y1={binsBottom}
        x2={VIEW.width - VIEW.margin}
        y2={binsBottom}
        stroke="currentColor"
        vectorEffect="non-scaling-stroke"
      />
      {counts.map((count, k) =>
        count > 0 ? (
          <rect
            key={`h${k}`}
            x={binX(k) - b / 2 + 1}
            y={binsBottom - heap(k)}
            width={Math.max(0.5, b - 2)}
            height={heap(k)}
            fill={hue(BALL_HUE)}
            fillOpacity={0.55}
          />
        ) : null,
      )}
      {expected && (
        <path
          d={outline}
          fill="none"
          stroke={hue(EXPECT_HUE)}
          strokeWidth={1.5}
          strokeDasharray="4 2"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {flying.map((ball) => (
        <circle key={ball.i} cx={ball.x} cy={ball.y} r={ballR} fill={hue(BALL_HUE)} />
      ))}
    </svg>
  );
}

function GaltonPlay({
  build,
  seed,
  first,
  held,
  startNow = false,
  onNewBalls,
  preview = false,
  paused = false,
}: {
  build: Build;
  seed: number;
  /** The exhibit's first seed: the caption counts the runs from it. */
  first: number;
  held?: Held;
  startNow?: boolean;
  onNewBalls?: () => void;
} & PreviewMode) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { rows, p, balls } = build;
  const end = endOf(rows, balls);
  const loop = end + PREVIEW_HOLD_S;
  const start = preview ? PREVIEW_START * end : 0;
  const clock = useRef(start);
  const [time, setTime] = useState(start);
  const [dropped, setDropped] = useState(startNow);
  const { running: on, setRunning } = useRunning({ preview, paused, initially: startNow });
  const [speedHere, setSpeed] = useState<Speed>(1);
  const speed = preview ? PREVIEW_SPEED : speedHere;
  // The preview pours run after run, each from the next seed.
  const runIndex = preview ? Math.floor(time / loop) : 0;
  const runSeed = (seed + runIndex) >>> 0;
  const runTime = preview ? time - runIndex * loop : dropped ? time : -1;
  const run = useMemo(() => drop(rows, p, balls, runSeed), [rows, p, balls, runSeed]);
  const done = !preview && runTime >= end;
  const running = preview ? on : dropped && on && !done;

  useFrameLoop(running, (dt) => {
    clock.current += dt * speed;
    setTime(clock.current);
    if (!preview && clock.current >= end) held?.show();
  });

  const view = (
    <BoardView
      rows={rows}
      p={p}
      balls={balls}
      turns={run.turns}
      bins={run.bins}
      time={Math.max(0, runTime)}
      expected={!preview && (held?.shown ?? false)}
    />
  );
  if (preview) return view;

  const landed = landedBy(Math.max(0, runTime), balls, flightOf(rows));
  let sum = 0;
  for (let i = 0; i < landed; i++) sum += run.bins[i];
  const mean = landed > 0 ? sum / landed : null;
  let squares = 0;
  if (mean !== null) for (let i = 0; i < landed; i++) squares += (run.bins[i] - mean) ** 2;
  const spread = mean !== null ? Math.sqrt(squares / landed) : null;
  const expected = figures(rows, p);

  const restart = () => {
    clock.current = 0;
    setTime(0);
    setDropped(false);
    setRunning(false);
  };
  const all = () => {
    clock.current = end;
    setTime(end);
    setDropped(true);
    held?.show();
  };
  return (
    <WidgetCard
      title={t("experiments.galton.play.title")}
      hint={t("experiments.galton.play.hint")}
      actions={
        <>
          {dropped ? (
            <>
              {!done && <RunPauseButton running={on} onToggle={() => setRunning(!on)} />}
              <RestartButton onClick={restart} label={t("experiments.galton.play.again")} />
            </>
          ) : (
            <Button
              size="sm"
              onClick={() => {
                setDropped(true);
                setRunning(true);
              }}
            >
              <ArrowDown className="size-4" aria-hidden />
              {t("experiments.galton.play.drop")}
            </Button>
          )}
          {!done && (
            <Button variant="secondary" size="sm" onClick={all}>
              <SkipForward className="size-4" aria-hidden />
              {t("experiments.galton.play.all")}
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={onNewBalls}>
            <Shuffle className="size-4" aria-hidden />
            {t("experiments.galton.play.new")}
          </Button>
        </>
      }
    >
      <div className={`${SIDE.grid} ${SIDE.cap.md}`}>
        <div className={SIDE.top}>
          <SpeedToggle speeds={SPEEDS} value={speedHere} onChange={setSpeed} />
        </div>
        <div className={`${SIDE.views} mx-auto w-full max-w-md`}>
          <figure className="space-y-1">
            {view}
            <figcaption className="text-center text-caption text-muted">
              {t("experiments.galton.play.caption", {
                rows,
                bins: rows + 1,
                balls,
                run: (((seed - first) >>> 0) + 1).toLocaleString(locale),
              })}
            </figcaption>
          </figure>
          <p className="text-sm font-medium text-primary" role="status">
            {!dropped
              ? t("experiments.galton.play.waiting")
              : done
                ? t("experiments.galton.play.done", {
                    balls,
                    mean: formatNumber(run.mean, 2, locale),
                  })
                : t("experiments.galton.play.falling")}
          </p>
        </div>
        <div className={SIDE.column}>
          <Figures
            tiles={[
              { key: "landed", label: t("experiments.galton.figures.landed"), value: landed, digits: 0 },
              { key: "mean", label: t("experiments.galton.figures.mean"), value: mean, digits: 2 },
              { key: "spread", label: t("experiments.galton.figures.spread"), value: spread, digits: 2 },
              {
                key: "expected_mean",
                label: t("experiments.galton.figures.expected_mean"),
                value: expected.mean,
                digits: 2,
                held: !(held?.shown ?? true),
              },
              {
                key: "expected_spread",
                label: t("experiments.galton.figures.expected_spread"),
                value: expected.spread,
                digits: 2,
                held: !(held?.shown ?? true),
              },
            ]}
          />
          {held && (
            <HeldAnswer held={held}>
              <p className="text-sm text-secondary">{t("experiments.galton.play.expected")}</p>
            </HeldAnswer>
          )}
        </div>
      </div>
    </WidgetCard>
  );
}

function GaltonBuild({ build, onChange }: { build: Build; onChange: (next: Build) => void }) {
  const { t } = useTranslation();
  const locale = useLocale();
  return (
    <WidgetCard title={t("experiments.galton.change.title")} hint={t("experiments.galton.change.hint")}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SliderField
          label={t("experiments.galton.change.rows")}
          unit=""
          value={build.rows}
          min={1}
          max={MOST_ROWS}
          step={1}
          digits={0}
          hint={t("experiments.galton.change.rows_hint")}
          onChange={(v) => onChange({ ...build, rows: Math.round(v) })}
        />
        <SliderField
          label={t("experiments.galton.change.p")}
          unit=""
          value={build.p}
          min={SHARE_MIN}
          max={SHARE_MAX}
          step={0.01}
          digits={2}
          hint={t("experiments.galton.change.p_hint")}
          onChange={(v) => onChange({ ...build, p: v })}
        />
        <SliderField
          label={t("experiments.galton.change.balls")}
          unit=""
          value={build.balls}
          min={50}
          max={MOST_BALLS}
          step={50}
          digits={0}
          hint={t("experiments.galton.change.balls_hint")}
          onChange={(v) => onChange({ ...build, balls: Math.round(v) })}
        />
      </div>
      <p className="text-sm text-secondary">
        {t("experiments.galton.change.status", {
          rows: build.rows,
          bins: build.rows + 1,
          paths: formatNumber(2 ** build.rows, 0, locale),
        })}
      </p>
    </WidgetCard>
  );
}

function GaltonModel() {
  const { t } = useTranslation();
  const s = (key: string) => t(`experiments.galton.symbols.${key}`);
  return (
    <>
      <p>{t("experiments.galton.model.intro")}</p>
      <Equation
        tex={String.raw`\binom{n}{k} = \frac{n!}{k!\,(n-k)!}`}
        reads={t("experiments.galton.model.paths")}
        symbols={[
          { tex: String.raw`\binom{n}{k}`, meaning: s("paths"), unit: "1" },
          { tex: "n", meaning: s("n"), unit: "1" },
          { tex: "k", meaning: s("k"), unit: "1" },
        ]}
      />
      <Equation
        tex={String.raw`P(k) = \binom{n}{k}\,p^k\,(1-p)^{n-k}`}
        reads={t("experiments.galton.model.binomial")}
        symbols={[
          { tex: "P(k)", meaning: s("share"), unit: "1" },
          { tex: "p", meaning: s("p"), unit: "1" },
        ]}
      />
      <Equation
        tex={String.raw`\mu = n\,p, \qquad \sigma = \sqrt{n\,p\,(1-p)}`}
        reads={t("experiments.galton.model.moments")}
        symbols={[
          { tex: String.raw`\mu`, meaning: s("mu"), unit: "1" },
          { tex: String.raw`\sigma`, meaning: s("sigma"), unit: "1" },
        ]}
      />
      <Equation
        tex={String.raw`P(k) \approx \frac{1}{\sqrt{2\pi}\,\sigma}\,e^{-\frac{(k-\mu)^2}{2\sigma^2}}`}
        reads={t("experiments.galton.model.normal")}
        symbols={[{ tex: "e", meaning: s("e"), unit: "1" }]}
      />
    </>
  );
}

function GaltonComputed() {
  const { t } = useTranslation();
  const c = (key: string) => t(`experiments.galton.computed.${key}`);
  return (
    <>
      <p>{c("system")}</p>
      <Equation
        tex={String.raw`P_{j+1}(k) = p\,P_j(k-1) + (1-p)\,P_j(k), \qquad P_0(0) = 1`}
        reads={c("rows")}
        symbols={[
          { tex: String.raw`P_j(k)`, meaning: c("pj"), unit: "1" },
          { tex: "j", meaning: c("j"), unit: "1" },
        ]}
      />
      <p>{c("random")}</p>
      <p>{c("check")}</p>
      <p>{c("left_out")}</p>
    </>
  );
}

function GaltonTrick({ build }: { build: Build }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hue = useChartHue();
  const { rows, p } = build;
  const way = paths(rows);
  const peak = figures(rows, p).peak_bin;
  const chartRows = useMemo(() => {
    const s = shares(rows, p);
    const steps = (rows + 1) * 20;
    return Array.from({ length: steps + 1 }, (_, i) => {
      const x = -0.5 + (rows + 1) * (i / steps);
      const k = Math.min(rows, Math.max(0, Math.round(x)));
      return {
        x,
        binomial: s[k] * 100,
        // The page's tilt stays inside (0, 1), where the curve is defined.
        normal: normal(rows, p, x) * 100,
      };
    });
  }, [rows, p]);
  return (
    <>
      <p>{t("experiments.galton.sweet.paths")}</p>
      <p>{t("experiments.galton.sweet.middle")}</p>
      <Figures
        tiles={[
          { key: "all", label: t("experiments.galton.sweet.all", { rows }), value: 2 ** rows, digits: 0 },
          { key: "peak", label: t("experiments.galton.sweet.peak", { bin: peak }), value: way[peak], digits: 0 },
          { key: "edge", label: t("experiments.galton.sweet.edge"), value: way[0], digits: 0 },
        ]}
      />
      <p>{t("experiments.galton.sweet.normal")}</p>
      <p className="text-sm text-secondary">{t("experiments.galton.chart.hint")}</p>
      <SeriesChart
        rows={chartRows}
        series={[
          { key: "binomial", label: t("experiments.galton.chart.binomial"), color: hue(EXPECT_HUE) },
          { key: "normal", label: t("experiments.galton.chart.normal"), color: hue(NORMAL_HUE), dashed: true },
        ]}
        axes={[
          {
            id: "y",
            title: `${t("experiments.galton.chart.share")} (%)`,
            format: (v) => formatNumber(v, 0, locale),
            includeZero: true,
          },
        ]}
        x={{ key: "x", title: t("experiments.galton.chart.bin"), format: (v) => formatNumber(v, 0, locale) }}
      />
    </>
  );
}
