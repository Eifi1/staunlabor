import { useMemo, useRef, useState, type PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { Hand } from "lucide-react";
import { AlertBanner, Button } from "@eifi1/ui-kit";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber } from "@/shared/lib/format";
import { useChartHue } from "@/shared/state/palette-store";
import { holdTouch } from "@/shared/ui/grab";
import { svgPoint } from "@/shared/ui/svg-point";
import { SliderField } from "@/shared/ui/slider-field";
import { Figures, WidgetCard } from "@/shared/ui/widget";
import { Equation } from "./equation";
import { ExhibitFrame } from "./exhibit-frame";
import { BuildPending } from "./build-pending";
import { PreviewPending, type PreviewMode, type PreviewProps } from "./preview-mode";
import { useFrameLoop, useRunning } from "./play";
import { RunPauseButton, SpeedToggle } from "./play-controls";
import { settingNumber, useTakeCheckRequest } from "./check-setting";
import { HeldAnswer, useHeld, type Held } from "./held";
import {
  outcome,
  position,
  refusal,
  run,
  slackHeightM,
  smallRadiusM,
  start,
  startHeightM,
  step,
  type PegPendulum,
  type PegState,
} from "./simulate/peg";
import { STEP_S } from "./simulate/pendulum";
import { SIDE, STAGE, VIEW_FRAME } from "./stage";
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
  const held = useHeld();
  // The peg or the bob as the reader drags them, before they are let go: the
  // play is built anew for each build, so a drag that changed the build at
  // every step lost its hold after the first (seen 2026-11-20).
  const [draft, setDraft] = useState<Partial<PegPendulum> | null>(null);
  const shown = p && draft ? { ...p, ...draft } : p;
  const commit = (next: PegPendulum) => {
    setDraft(null);
    setBuild(next);
  };
  // A check case's "Set it up": the whole build at once, and the play, built
  // anew for it, lets the bob go.
  useTakeCheckRequest("peg", p, (setting, current) => {
    setBuild({
      ...current,
      length_m: settingNumber(setting, "length_m", current.length_m),
      peg_depth_m: settingNumber(setting, "peg_depth_m", current.peg_depth_m),
      start_deg: settingNumber(setting, "start_deg", current.start_deg),
    });
  });
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
      {defaults.isPending || !p ? (
        <BuildPending pending={defaults.isPending} error={defaults.error} />
      ) : (
        <>
          <PegPlay key={JSON.stringify(p)} p={p} draft={draft} onDraft={setDraft} onChange={commit} held={held} />
          <PegBuild p={shown ?? p} onChange={setBuild} />
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
  onPegDone,
  onPull,
  onLetGo,
  hideSlack = false,
}: {
  p: PegPendulum;
  s: PegState;
  trail: Array<[number, number]>;
  onPeg?: (depth: number) => void;
  onPegDone?: (depth: number) => void;
  /** The bob pulled out by mouse or finger (Marcel, 2026-11-20: "ähnlich
   *  interaktiv"), in whole degrees within the slider's 5–90°, and let go. */
  onPull?: (deg: number) => void;
  onLetGo?: (deg: number) => void;
  /** The height the string goes slack at is drawn only for a swing that does
   *  so: before the reader has seen it, it would say what happens. */
  hideSlack?: boolean;
}) {
  const { t } = useTranslation();
  const hue = useChartHue();
  const colour = hue(BOB_HUE);
  const svg = useRef<SVGSVGElement | null>(null);
  // What the pointer holds: a ref for the handlers, which a move can reach
  // before React has drawn the hold; the state for the cursor.
  const [dragging, setDragging] = useState<"peg" | "bob" | null>(null);
  const holding = useRef<"peg" | "bob" | null>(null);
  const last = useRef<number | null>(null);
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
  // Where the pointer is, in the drawing's metres, y down from the pivot.
  const pointAt = (clientX: number, clientY: number): [number, number] | null =>
    svg.current ? svgPoint(svg.current, clientX, clientY) : null;
  const follow = (clientX: number, clientY: number) => {
    const point = pointAt(clientX, clientY);
    if (!point) return;
    if (holding.current === "peg") {
      last.current = Math.min(0.95 * length, Math.max(0.05 * length, point[1]));
      onPeg?.(last.current);
    } else if (holding.current === "bob") {
      const deg = Math.atan2(point[0], Math.max(point[1], bob)) * (180 / Math.PI);
      last.current = Math.round(Math.min(90, Math.max(5, deg)));
      onPull?.(last.current);
    }
  };
  const release = () => {
    const was = holding.current;
    holding.current = null;
    setDragging(null);
    if (last.current === null) return;
    if (was === "peg") onPegDone?.(last.current);
    if (was === "bob") onLetGo?.(last.current);
    last.current = null;
  };
  const take = (which: "peg" | "bob", e: PointerEvent<SVGCircleElement>) => {
    e.currentTarget.ownerSVGElement?.setPointerCapture?.(e.pointerId);
    holding.current = which;
    last.current = null;
    setDragging(which);
    follow(e.clientX, e.clientY);
  };
  return (
    <svg
      ref={svg}
      viewBox={`${-(length + margin)} ${-margin} ${2 * (length + margin)} ${length + 2 * margin}`}
      role="img"
      aria-label={t("experiments.peg.view")}
      className={`${STAGE.wide} ${VIEW_FRAME} ${onPeg || onPull ? "select-none" : ""}`}
      onPointerMove={(e) => {
        if (holding.current) follow(e.clientX, e.clientY);
      }}
      onPointerUp={release}
      onPointerCancel={release}
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
      {slack !== null && !hideSlack && (
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
        ref={onPeg ? holdTouch : undefined}
        onPointerDown={(e) => {
          if (onPeg) take("peg", e);
        }}
      />
      <circle cx={x} cy={-y} r={bob} fill={colour} />
      {onPull && (
        // A swinging bob is hard to catch: the hold is three of its radii round
        // it, unseen.
        <circle
          cx={x}
          cy={-y}
          r={bob * 3}
          fill="transparent"
          className={dragging ? "cursor-grabbing" : "cursor-grab"}
          ref={holdTouch}
          onPointerDown={(e) => take("bob", e)}
        />
      )}
    </svg>
  );
}

function PegPlay({
  p,
  onChange,
  held,
  draft = null,
  onDraft,
  preview = false,
  paused = false,
}: {
  p: PegPendulum;
  onChange?: (next: PegPendulum) => void;
  held?: Held;
  draft?: Partial<PegPendulum> | null;
  onDraft?: (next: Partial<PegPendulum>) => void;
} & PreviewMode) {
  const { t } = useTranslation();
  const sim = useRef({ s: start(p), clock: 0, owed: 0, trail: [] as Array<[number, number]>, i: 0 });
  const { running, setRunning } = useRunning({ preview, paused });
  const [speedHere, setSpeed] = useState<Speed>(1);
  const [frame, setFrame] = useState(() => ({ s: start(p), trail: [] as Array<[number, number]> }));
  const [said, setSaid] = useState<string | null>(null);
  const speed = preview ? 1 : speedHere;
  const show = held?.show;

  useFrameLoop(running, (dt) => {
    const keep = Math.round(TRAIL_S / (STEP_S * TRAIL_EVERY));
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
      // Whatever comes after the catch shows the outcome: it swings back
      // (released), goes slack, or goes over the top.
      if (happened.some(([, kind]) => kind !== "caught")) show?.();
      if (m.i % TRAIL_EVERY === 0) {
        m.trail.push(position(p, m.s));
        if (m.trail.length > keep) m.trail.shift();
      }
    }
    setFrame({ s: m.s, trail: [...m.trail] });
  });

  const letGo = () => {
    sim.current = { s: start(p), clock: 0, owed: 0, trail: [], i: 0 };
    setFrame({ s: sim.current.s, trail: [] });
    setSaid(null);
    setRunning(true);
  };

  if (preview) return <PegView p={p} s={frame.s} trail={frame.trail} />;
  // While the reader holds the bob out, it hangs there, at rest.
  const shownP = draft ? { ...p, ...draft } : p;
  const pulled = draft?.start_deg !== undefined;
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
          <RunPauseButton running={running} onToggle={() => setRunning(!running)} />
        </>
      }
    >
      {refused ? (
        <AlertBanner tone="warning">{t("experiments.peg.refused")}</AlertBanner>
      ) : (
        <div className={`${SIDE.grid} ${SIDE.cap.xl}`}>
          <div className={SIDE.top}>
            <SpeedToggle speeds={SPEEDS} value={speed} onChange={setSpeed} />
          </div>
          <div className={`${SIDE.views} mx-auto w-full max-w-xl`}>
            <PegView
              p={shownP}
              s={pulled ? start(shownP) : frame.s}
              trail={pulled ? [] : frame.trail}
              onPeg={(depth) => {
                setRunning(false);
                onDraft?.({ peg_depth_m: Math.round(depth * 100) / 100 });
              }}
              onPegDone={(depth) => onChange?.({ ...p, peg_depth_m: Math.round(depth * 100) / 100 })}
              onPull={(deg) => {
                setRunning(false);
                onDraft?.({ start_deg: deg });
              }}
              onLetGo={(deg) => onChange?.({ ...p, start_deg: deg })}
              hideSlack={!held?.shown}
            />
            <p className="mt-2 text-sm text-secondary">{t("experiments.peg.play.drag_hint")}</p>
          </div>
          <div className={SIDE.column}>
            {held && (
              <HeldAnswer held={held}>
                <p className="text-sm font-medium text-primary">{t(`experiments.peg.play.outcome_${outcome(p)}`)}</p>
              </HeldAnswer>
            )}
            {said && <p className="text-sm text-secondary">{t(`experiments.peg.play.events.${said}`)}</p>}
            <PegFigures p={p} held={!held?.shown} />
          </div>
        </div>
      )}
    </WidgetCard>
  );
}

/** `held`: the height a loop needs, set beside the start height, and the
 *  height it goes slack at, there only when it does, both say the outcome. */
function PegFigures({ p, held }: { p: PegPendulum; held: boolean }) {
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
          held,
        },
        ...(slack === null
          ? []
          : [
              {
                key: "slack",
                label: t("experiments.peg.figures.slack"),
                value: slack * 100,
                digits: 1,
                unit: "cm",
                held,
              },
            ]),
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
  // The highest the bob gets on the peg's side, measured on a run of a few
  // swings rather than taken from the energy: the sentence's check on itself.
  const reached = useMemo(() => (p ? run(p, 6).peg_side_top_m : null), [p]);
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
      {p && reached !== null && (
        <Figures
          tiles={[
            {
              key: "start",
              label: t("experiments.peg.figures.height"),
              value: startHeightM(p) * 100,
              digits: 2,
              unit: "cm",
            },
            {
              key: "reached",
              label: t("experiments.peg.figures.reached"),
              value: reached * 100,
              digits: 2,
              unit: "cm",
            },
          ]}
        />
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
