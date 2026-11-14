import { useEffect, useRef, useState, type PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { Hand, Pause, Play } from "lucide-react";
import { AlertBanner, Button, LoadingState, ToggleGroup } from "@eifi1/ui-kit";
import { apiErrorMessage } from "@/shared/api/client";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber } from "@/shared/lib/format";
import { useChartHex } from "@/shared/state/palette-store";
import { SliderField } from "@/shared/ui/slider-field";
import { Figures, WidgetCard } from "@/shared/ui/widget";
import { Equation } from "./equation";
import { ExhibitFrame } from "./exhibit-frame";
import { PreviewPending, type PreviewMode, type PreviewProps } from "./preview-mode";
import {
  outcome,
  position,
  refusal,
  slackHeightM,
  smallRadiusM,
  start,
  startHeightM,
  step,
  type PegPendulum,
  type PegState,
} from "./simulate/peg";
import { STEP_S } from "./simulate/pendulum";
import { SIDE } from "./stage";
import { useExperimentsDefaults } from "./use-experiments";

const SPEEDS = [1, 0.25] as const;
type Speed = (typeof SPEEDS)[number];

/** The trail: this many seconds of where the bob has been. */
const TRAIL_S = 2.5;
const TRAIL_EVERY = 10;

/** The three cases, as builds of the default string: let go from the
 *  horizontal, the peg high (the same height), lower (slack) and lowest (over). */
const CASES: Record<"same_height" | "slack" | "over_the_top", { depth: number; start_deg: number }> = {
  same_height: { depth: 0.5, start_deg: 30 },
  slack: { depth: 0.55, start_deg: 90 },
  over_the_top: { depth: 0.65, start_deg: 90 },
};

/** The bob's hue, the palette's hue for what moves by itself. */
const BOB_HUE = 2;

/**
 * Galileo's interrupted pendulum (`experiments.peg`): the bob stepped by the
 * browser port (`simulate/peg.ts`, held to the engine by `simulate.test.ts`),
 * every switch of its string found within its step; the peg moved with a
 * finger or a slider. No route.
 */
export function PegPage() {
  const { t } = useTranslation();
  const defaults = useExperimentsDefaults();
  const [build, setBuild] = useState<PegPendulum | null>(null);
  const p = build ?? defaults.data?.peg ?? null;
  return (
    <ExhibitFrame
      exhibit="peg"
      atTheExhibit={
        <>
          <p>{t("experiments.peg.at.peg")}</p>
          <p>{t("experiments.peg.at.height")}</p>
        </>
      }
      whatHappens={<PegModel />}
      computed={<PegComputed />}
      sweetSpot={
        <PegTrick
          p={p && !refusal(p) ? p : null}
          onCase={(c) =>
            p && setBuild({ ...p, peg_depth_m: CASES[c].depth * p.length_m, start_deg: CASES[c].start_deg })
          }
        />
      }
    >
      {defaults.isPending ? (
        <LoadingState className="py-10" label={t("common.loading")} />
      ) : !p ? (
        <AlertBanner tone="danger">{apiErrorMessage(defaults.error, t("experiments.failed"))}</AlertBanner>
      ) : (
        <>
          <PegPlay key={JSON.stringify(p)} p={p} onChange={setBuild} />
          <PegBuild p={p} onChange={setBuild} />
        </>
      )}
    </ExhibitFrame>
  );
}

/** The default swing, caught and released, for the overview. */
export function PegPreview({ paused }: PreviewProps) {
  const defaults = useExperimentsDefaults();
  const p = defaults.data?.peg;
  return p ? <PegPlay p={p} preview paused={paused} /> : <PreviewPending />;
}

function PegView({
  p,
  s,
  trail,
  onPeg,
}: {
  p: PegPendulum;
  s: PegState;
  trail: Array<[number, number]>;
  onPeg?: (depth: number) => void;
}) {
  const { t } = useTranslation();
  const hex = useChartHex();
  const colour = hex[BOB_HUE % hex.length];
  const svg = useRef<SVGSVGElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const length = p.length_m;
  const bob = length * 0.04;
  const margin = length * 0.15;
  const [x, y] = position(p, s);
  const h = startHeightM(p);
  const slack = slackHeightM(p);
  // SVG's y runs down: heights are drawn as −y.
  const string =
    s.mode === "big"
      ? `M 0 0 L ${x} ${-y}`
      : s.mode === "small"
        ? `M 0 0 L 0 ${p.peg_depth_m} L ${x} ${-y}`
        : // Slack: from the peg to the bob, sagging.
          `M 0 0 L 0 ${p.peg_depth_m} Q ${x / 2} ${(p.peg_depth_m - y) / 2 + length * 0.1} ${x} ${-y}`;
  // Where the pointer is, in the drawing's metres: the depth below the pivot.
  const depthAt = (event: PointerEvent<SVGSVGElement>) => {
    const el = svg.current;
    const matrix = el?.getScreenCTM?.();
    if (!el || !matrix) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return Math.min(0.95 * length, Math.max(0.05 * length, point.y));
  };
  return (
    <svg
      ref={svg}
      viewBox={`${-(length + margin)} ${-margin} ${2 * (length + margin)} ${length + 2 * margin}`}
      role="img"
      aria-label={t("experiments.peg.view")}
      className="max-h-[60dvh] w-full touch-none rounded-lg border border-subtle bg-surface-2 text-muted"
      onPointerMove={(e) => {
        if (!dragging) return;
        const depth = depthAt(e);
        if (depth !== null) onPeg?.(depth);
      }}
      onPointerUp={() => setDragging(false)}
      onPointerLeave={() => setDragging(false)}
    >
      {/* The height it was let go from, on both sides. */}
      <line
        x1={-(length + margin)}
        y1={length - h}
        x2={length + margin}
        y2={length - h}
        stroke="currentColor"
        strokeDasharray="5 4"
        opacity={0.7}
        vectorEffect="non-scaling-stroke"
      />
      {slack !== null && (
        <line
          x1={-(length + margin)}
          y1={length - slack}
          x2={length + margin}
          y2={length - slack}
          stroke={colour}
          strokeDasharray="2 4"
          opacity={0.6}
          vectorEffect="non-scaling-stroke"
        />
      )}
      <polyline
        points={trail.map(([tx, ty]) => `${tx},${-ty}`).join(" ")}
        fill="none"
        stroke={colour}
        opacity={0.35}
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={string}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeDasharray={s.mode === "free" ? "3 3" : undefined}
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1={-length * 0.2}
        y1={0}
        x2={length * 0.2}
        y2={0}
        stroke="currentColor"
        strokeWidth={4}
        vectorEffect="non-scaling-stroke"
      />
      {/* The peg, which a finger can move up and down. */}
      <circle
        cx={0}
        cy={p.peg_depth_m}
        r={bob * 0.8}
        className={`fill-current text-primary ${onPeg ? "cursor-ns-resize" : ""}`}
        onPointerDown={(e) => {
          if (!onPeg) return;
          e.currentTarget.ownerSVGElement?.setPointerCapture?.(e.pointerId);
          setDragging(true);
        }}
      />
      <circle cx={x} cy={-y} r={bob} fill={colour} />
    </svg>
  );
}

function PegPlay({
  p,
  onChange,
  preview = false,
  paused = false,
}: { p: PegPendulum; onChange?: (next: PegPendulum) => void } & PreviewMode) {
  const { t } = useTranslation();
  const sim = useRef({ s: start(p), clock: 0, owed: 0, trail: [] as Array<[number, number]>, i: 0 });
  const [runningHere, setRunning] = useState(true);
  const [speedHere, setSpeed] = useState<Speed>(1);
  const [frame, setFrame] = useState(() => ({ s: start(p), trail: [] as Array<[number, number]> }));
  const [said, setSaid] = useState<string | null>(null);
  const running = preview ? !paused : runningHere;
  const speed = preview ? 1 : speedHere;

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const keep = Math.round(TRAIL_S / (STEP_S * TRAIL_EVERY));
    const tick = (now: number) => {
      // A frame's timestamp can lie a little before the effect started: never a
      // step back in time.
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      const m = sim.current;
      m.owed += (dt * speed) / STEP_S;
      const steps = Math.floor(m.owed);
      m.owed -= steps;
      for (let k = 0; k < steps; k++) {
        const [next, happened] = step(p, m.s, m.clock, STEP_S);
        m.s = next;
        m.clock += STEP_S;
        m.i += 1;
        if (happened.length) setSaid(happened[happened.length - 1][1]);
        if (m.i % TRAIL_EVERY === 0) {
          m.trail.push(position(p, m.s));
          if (m.trail.length > keep) m.trail.shift();
        }
      }
      setFrame({ s: m.s, trail: [...m.trail] });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, speed, p]);

  const letGo = () => {
    sim.current = { s: start(p), clock: 0, owed: 0, trail: [], i: 0 };
    setFrame({ s: sim.current.s, trail: [] });
    setSaid(null);
    setRunning(true);
  };

  if (preview) return <PegView p={p} s={frame.s} trail={frame.trail} />;
  const refused = refusal(p);
  return (
    <WidgetCard
      title={t("experiments.peg.play.title")}
      hint={t("experiments.peg.play.hint")}
      actions={
        <>
          <Button variant="accent" size="sm" onClick={letGo}>
            <Hand className="size-4" aria-hidden />
            {t("experiments.peg.play.let_go")}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setRunning(!running)}>
            {running ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
            {running ? t("experiments.peg.play.pause") : t("experiments.peg.play.run")}
          </Button>
        </>
      }
    >
      {refused ? (
        <AlertBanner tone="warning">{t("experiments.peg.refused")}</AlertBanner>
      ) : (
        <div className={SIDE.grid}>
          <div className={SIDE.top}>
            <ToggleGroup
              label={t("experiments.peg.play.speed")}
              labelPlacement="above"
              size="sm"
              value={String(speed)}
              onChange={(v: string) => setSpeed(Number(v) as Speed)}
              options={SPEEDS.map((v) => ({ value: String(v), label: t(`experiments.peg.play.speeds.${v * 100}`) }))}
            />
          </div>
          <div className={`${SIDE.views} mx-auto w-full max-w-xl`}>
            <PegView
              p={p}
              s={frame.s}
              trail={frame.trail}
              onPeg={(depth) => onChange?.({ ...p, peg_depth_m: Math.round(depth * 100) / 100 })}
            />
          </div>
          <div className={SIDE.column}>
            <p className="text-sm font-medium text-primary">{t(`experiments.peg.play.outcome_${outcome(p)}`)}</p>
            {said && <p className="text-sm text-secondary">{t(`experiments.peg.play.events.${said}`)}</p>}
            <PegFigures p={p} />
          </div>
        </div>
      )}
    </WidgetCard>
  );
}

function PegFigures({ p }: { p: PegPendulum }) {
  const { t } = useTranslation();
  const slack = slackHeightM(p);
  return (
    <Figures
      tiles={[
        {
          key: "height",
          label: t("experiments.peg.figures.height"),
          value: startHeightM(p) * 100,
          digits: 1,
          unit: "cm",
        },
        {
          key: "radius",
          label: t("experiments.peg.figures.radius"),
          value: smallRadiusM(p) * 100,
          digits: 1,
          unit: "cm",
        },
        {
          key: "loop",
          label: t("experiments.peg.figures.loop"),
          value: 2.5 * smallRadiusM(p) * 100,
          digits: 1,
          unit: "cm",
        },
        ...(slack === null
          ? []
          : [{ key: "slack", label: t("experiments.peg.figures.slack"), value: slack * 100, digits: 1, unit: "cm" }]),
      ]}
    />
  );
}

function PegBuild({ p, onChange }: { p: PegPendulum; onChange: (next: PegPendulum) => void }) {
  const { t } = useTranslation();
  return (
    <WidgetCard title={t("experiments.peg.change.title")} hint={t("experiments.peg.change.hint")}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SliderField
          label={t("experiments.peg.change.start")}
          unit="°"
          value={p.start_deg}
          min={5}
          max={90}
          step={1}
          digits={0}
          onChange={(v) => onChange({ ...p, start_deg: v })}
        />
        <SliderField
          label={t("experiments.peg.change.peg")}
          unit="cm"
          value={p.peg_depth_m * 100}
          min={Math.round(p.length_m * 5)}
          max={Math.round(p.length_m * 95)}
          step={1}
          digits={0}
          hint={t("experiments.peg.change.peg_hint")}
          onChange={(v) => onChange({ ...p, peg_depth_m: v / 100 })}
        />
        <SliderField
          label={t("experiments.peg.change.length")}
          unit="cm"
          value={p.length_m * 100}
          min={30}
          max={200}
          step={5}
          digits={0}
          onChange={(v) => onChange({ ...p, length_m: v / 100, peg_depth_m: (p.peg_depth_m / p.length_m) * (v / 100) })}
        />
      </div>
    </WidgetCard>
  );
}

function PegModel() {
  const { t } = useTranslation();
  const s = (key: string) => t(`experiments.peg.symbols.${key}`);
  return (
    <>
      <p>{t("experiments.peg.model.intro")}</p>
      <Equation
        tex={String.raw`\tfrac12 v^2 + g\,z = g\,h`}
        reads={t("experiments.peg.model.energy")}
        symbols={[
          { tex: "v", meaning: s("v"), unit: "m/s" },
          { tex: "z", meaning: s("z"), unit: "m" },
          { tex: "h", meaning: s("h"), unit: "m" },
          { tex: "g", meaning: s("g"), unit: "m/s²" },
        ]}
      />
      <Equation
        tex={String.raw`\frac{F}{m} = \frac{v^2}{r} + g\cos\varphi \;\ge\; 0`}
        reads={t("experiments.peg.model.pull")}
        symbols={[
          { tex: "F", meaning: s("f"), unit: "N" },
          { tex: "r = L - d", meaning: s("r"), unit: "m" },
          { tex: String.raw`\varphi`, meaning: s("phi"), unit: "rad" },
        ]}
      />
    </>
  );
}

function PegTrick({ p, onCase }: { p: PegPendulum | null; onCase: (c: keyof typeof CASES) => void }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const s = (key: string) => t(`experiments.peg.symbols.${key}`);
  return (
    <>
      <p>{t("experiments.peg.sweet.height")}</p>
      <Equation
        tex={String.raw`h \ge \tfrac52\,r`}
        reads={t("experiments.peg.sweet.loop")}
        symbols={[{ tex: "r", meaning: s("r"), unit: "m" }]}
      />
      <Equation
        tex={String.raw`z_{\text{slack}} = \frac{r + 2h}{3}`}
        reads={t("experiments.peg.sweet.slack")}
        symbols={[{ tex: String.raw`z_{\text{slack}}`, meaning: s("z_slack"), unit: "m" }]}
      />
      {p && (
        <p>
          {t("experiments.peg.sweet.now", {
            h: formatNumber(startHeightM(p) * 100, 1, locale),
            loop: formatNumber(2.5 * smallRadiusM(p) * 100, 1, locale),
          })}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(CASES) as Array<keyof typeof CASES>).map((c) => (
          <Button key={c} variant="secondary" size="sm" onClick={() => onCase(c)}>
            {t(`experiments.peg.sweet.cases.${c}`)}
          </Button>
        ))}
      </div>
    </>
  );
}

function PegComputed() {
  const { t } = useTranslation();
  const c = (key: string) => t(`experiments.peg.computed.${key}`);
  return (
    <Equation
      tex={String.raw`\ddot\theta = -\frac{g}{L}\sin\theta \;\to\; \ddot\varphi = -\frac{g}{r}\sin\varphi \;\to\; \ddot{\vec x} = \vec g`}
      reads={c("system")}
      symbols={[{ tex: String.raw`\vec g`, meaning: c("gravity"), unit: "m/s²" }]}
    />
  );
}
