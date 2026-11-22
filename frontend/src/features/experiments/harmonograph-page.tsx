import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, FastForward } from "lucide-react";
import { Button, LoadingState, ToggleGroup } from "@eifi1/ui-kit";
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
import { useFrameLoop, useRunning } from "./play";
import { RestartButton, RunPauseButton, SpeedToggle } from "./play-controls";
import {
  advance,
  figures as harmonographFigures,
  penAt,
  startDrawing,
  type DrawingState,
  type Harmonograph,
} from "./simulate/harmonograph";
import { STAGE } from "./stage";
import { useExperimentsDefaults } from "./use-experiments";
import { MAX_DURATION_S, STEP_S } from "./simulate/numerics";

/** How much faster than real time the pen may draw. A real drawing takes some
 *  minutes; at twenty times it is done in a quarter of one. */
const SPEEDS = [1, 5, 20] as const;
type Speed = (typeof SPEEDS)[number];

/** The ratios offered, pen : board. */
const RATIOS: ReadonlyArray<readonly [number, number]> = [
  [1, 1],
  [1, 2],
  [2, 3],
  [3, 4],
];

/** The drawing's resolution: the canvas is drawn at this many pixels a side
 *  and scaled to its column, sharp on a phone's dense screen too. */
const CANVAS_PX = 1000;

/** The preview draws at ten times and starts again after a minute of drawing. */
const PREVIEW_SPEED = 10;
const PREVIEW_LOOP_S = 60;

/** The ink's hue: the palette's hue for what moves by itself, as the wave's bobs. */
const INK_HUE = 2;

/** How far the picture reaches from its middle, metres: the wider of the two
 *  swings, with a margin. */
function extentOf(h: Harmonograph): number {
  const reach = (p: Harmonograph["pen"]) => p.length_m * Math.sin((p.amplitude_deg * Math.PI) / 180);
  return Math.max(reach(h.pen), reach(h.board), 0.005) * 1.08;
}

/** The board pendulum's length for a ratio `p:q` and a detune: `f₂/f₁ = √(L₁/L₂)`. */
export function boardLength(penLengthM: number, ratio: readonly [number, number], detune: number): number {
  const [p, q] = ratio;
  return penLengthM * (p / (q * (1 + detune))) ** 2;
}

/**
 * The harmonograph (`experiments.harmonograph`): a pen on one pendulum, a board
 * on another, the picture drawn as both die away. Everything on the page is
 * the browser port's (`simulate/harmonograph.ts`, held to the engine by
 * `simulate.test.ts`): the pen's path, stepped a few hundred times a frame,
 * and the figures — the ratio, how long the picture takes to turn, how long
 * until it fades.
 */
export function HarmonographPage() {
  const { t } = useTranslation();
  const defaults = useExperimentsDefaults();
  const [build, setBuild] = useState<Harmonograph | null>(null);
  const h = build ?? defaults.data?.harmonograph ?? null;
  // A check case's "Set it up": every setting is the build's, the board's
  // length exact where the detune slider's steps would miss it; the drawing,
  // built anew for it, starts over. One damping for both, as the build card.
  useCheckSetting("harmonograph", (setting) => {
    if (!h) return false;
    const damping = settingNumber(setting, "damping_per_s", h.pen.damping_per_s);
    setBuild({
      pen: {
        ...h.pen,
        length_m: settingNumber(setting, "pen_length_m", h.pen.length_m),
        amplitude_deg: settingNumber(setting, "pen_amplitude_deg", h.pen.amplitude_deg),
        damping_per_s: damping,
      },
      board: {
        ...h.board,
        length_m: settingNumber(setting, "board_length_m", h.board.length_m),
        amplitude_deg: settingNumber(setting, "board_amplitude_deg", h.board.amplitude_deg),
        phase_deg: settingNumber(setting, "board_phase_deg", h.board.phase_deg),
        damping_per_s: damping,
      },
    });
    return true;
  });

  return (
    <ExhibitFrame
      exhibit="harmonograph"
      atTheExhibit={
        <>
          <p>{t("experiments.harmonograph.at.pen")}</p>
          <p>{t("experiments.harmonograph.at.picture")}</p>
        </>
      }
      whatHappens={<HarmonographModel />}
      computed={<HarmonographComputed />}
      sweetSpot={<HarmonographTrick h={h} />}
    >
      {defaults.isPending || !h ? (
        <BuildPending pending={defaults.isPending} error={defaults.error} />
      ) : (
        <>
          <HarmonographPlay key={JSON.stringify(h)} h={h} />
          <HarmonographBuild h={h} onChange={setBuild} />
        </>
      )}
    </ExhibitFrame>
  );
}

/** The default drawing, drawn quickly and over again, for the overview. */
export function HarmonographPreview({ paused }: PreviewProps) {
  const defaults = useExperimentsDefaults();
  const h = defaults.data?.harmonograph;
  return h ? <HarmonographPlay h={h} preview paused={paused} /> : <PreviewPending />;
}

/** The pen's place on the canvas, in its pixels. */
function toCanvas(extent: number, [x, y]: [number, number]): [number, number] {
  return [((x + extent) / (2 * extent)) * CANVAS_PX, ((extent - y) / (2 * extent)) * CANVAS_PX];
}

function HarmonographPlay({ h, preview = false, paused = false }: { h: Harmonograph } & PreviewMode) {
  const { t } = useTranslation();
  const hue = useChartHue();
  const ink = hue(INK_HUE);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef<DrawingState>(startDrawing(h));
  const { running, setRunning } = useRunning({ preview, paused });
  const [speedHere, setSpeed] = useState<Speed>(5);
  const [time, setTime] = useState(0);
  const [pen, setPen] = useState<[number, number]>(() => penAt(h, startDrawing(h)));
  const speed = preview ? PREVIEW_SPEED : speedHere;
  const extent = extentOf(h);
  const maxSteps = Math.round(MAX_DURATION_S / STEP_S);

  /** Draws `steps` more steps onto the canvas, one segment a step. */
  const drawOn = (steps: number) => {
    const state = drawing.current;
    const left = Math.max(0, Math.min(steps, maxSteps - state.i));
    const context = canvas.current?.getContext("2d") ?? null;
    if (context) {
      context.strokeStyle = ink;
      context.lineWidth = 1.4;
      context.lineJoin = "round";
      context.beginPath();
      context.moveTo(...toCanvas(extent, penAt(h, state)));
    }
    advance(h, state, left, STEP_S, (s) => context?.lineTo(...toCanvas(extent, penAt(h, s))));
    context?.stroke();
    setTime(state.i * STEP_S);
    setPen(penAt(h, state));
  };

  const restart = () => {
    drawing.current = startDrawing(h);
    canvas.current?.getContext("2d")?.clearRect(0, 0, CANVAS_PX, CANVAS_PX);
    setTime(0);
    setPen(penAt(h, drawing.current));
  };

  // The steps owed to the clock: a frame at five times real speed is not a
  // whole number of steps, and the rest carries to the next frame.
  const owed = useRef(0);
  useFrameLoop(running, (dt) => {
    owed.current += (dt * speed) / STEP_S;
    const steps = Math.floor(owed.current);
    owed.current -= steps;
    if (preview && drawing.current.i * STEP_S >= PREVIEW_LOOP_S) {
      drawing.current = startDrawing(h);
      canvas.current?.getContext("2d")?.clearRect(0, 0, CANVAS_PX, CANVAS_PX);
    }
    drawOn(steps);
  });

  /** The picture as a PNG, on the page's own background, made in the browser. */
  const save = () => {
    const source = canvas.current;
    if (!source) return;
    const out = document.createElement("canvas");
    out.width = CANVAS_PX;
    out.height = CANVAS_PX;
    const context = out.getContext("2d");
    if (!context) return;
    context.fillStyle = getComputedStyle(source).backgroundColor || "#ffffff";
    context.fillRect(0, 0, CANVAS_PX, CANVAS_PX);
    context.drawImage(source, 0, 0);
    const link = document.createElement("a");
    link.download = "harmonograph.png";
    link.href = out.toDataURL("image/png");
    link.click();
  };

  const [px, py] = toCanvas(extent, pen);
  const picture = (
    <div className="relative">
      <canvas
        ref={canvas}
        width={CANVAS_PX}
        height={CANVAS_PX}
        role="img"
        aria-label={t("experiments.harmonograph.views.drawing")}
        className="aspect-square w-full rounded-lg border border-subtle bg-surface-2"
      />
      {/* The pen, where it is now: on top of the ink, not in it, so the saved
          picture is the drawing alone. */}
      <svg
        viewBox={`0 0 ${CANVAS_PX} ${CANVAS_PX}`}
        className="pointer-events-none absolute inset-0 size-full"
        aria-hidden
      >
        <circle cx={px} cy={py} r={9} className="fill-current text-primary" opacity={0.85} />
      </svg>
    </div>
  );
  if (preview) return picture;

  const done = time >= MAX_DURATION_S - STEP_S / 2;
  return (
    <WidgetCard
      title={t("experiments.harmonograph.play.title")}
      hint={t("experiments.harmonograph.play.hint")}
      actions={
        <>
          <RunPauseButton running={running} disabled={done} onToggle={() => setRunning(!running)} />
          <Button variant="secondary" size="sm" disabled={done} onClick={() => drawOn(maxSteps)}>
            <FastForward className="size-4" aria-hidden />
            {t("experiments.harmonograph.play.finish")}
          </Button>
          <RestartButton onClick={restart} label={t("experiments.harmonograph.play.restart")} />
          <Button variant="secondary" size="sm" onClick={save}>
            <Download className="size-4" aria-hidden />
            {t("experiments.harmonograph.play.save")}
          </Button>
        </>
      }
    >
      <div className={`grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_18rem] ${STAGE.withSide}`}>
        <figure className="space-y-1">
          {picture}
          <figcaption className="text-center text-caption text-muted">
            {t("experiments.harmonograph.views.caption")}
          </figcaption>
        </figure>
        <div className="space-y-4">
          <SpeedToggle speeds={SPEEDS} value={speedHere} onChange={setSpeed} />
          <Figures
            tiles={[{ key: "time", label: t("experiments.harmonograph.play.time"), value: time, digits: 0, unit: "s" }]}
          />
          <HarmonographFigures h={h} />
        </div>
      </div>
    </WidgetCard>
  );
}

/** The build's figures, the port's: its ratio, how far off it, how long a turn and a fade take. */
function HarmonographFigures({ h }: { h: Harmonograph }) {
  const { t } = useTranslation();
  const f = harmonographFigures(h);
  return (
    <>
      <p className="text-sm text-secondary">
        {t("experiments.harmonograph.play.ratio", { p: f.ratio[0], q: f.ratio[1] })}
      </p>
      <Figures
        tiles={[
          {
            key: "detune",
            label: t("experiments.harmonograph.play.detune"),
            value: f.detune * 100,
            digits: 2,
            unit: "%",
          },
          ...(f.turn_s === null
            ? []
            : [{ key: "turn", label: t("experiments.harmonograph.play.turn"), value: f.turn_s, digits: 0, unit: "s" }]),
          ...(f.pen_fades_s === null
            ? []
            : [
                {
                  key: "fades",
                  label: t("experiments.harmonograph.play.fades"),
                  value: Math.max(f.pen_fades_s, f.board_fades_s ?? 0),
                  digits: 0,
                  unit: "s",
                },
              ]),
        ]}
      />
    </>
  );
}

function HarmonographBuild({ h, onChange }: { h: Harmonograph; onChange: (next: Harmonograph) => void }) {
  const { t } = useTranslation();
  const f = harmonographFigures(h);
  const ratio = RATIOS.find(([p, q]) => p === f.ratio[0] && q === f.ratio[1]);
  const withBoard = (patch: Partial<Harmonograph["board"]>) => onChange({ ...h, board: { ...h.board, ...patch } });
  const withPen = (patch: Partial<Harmonograph["pen"]>) => onChange({ ...h, pen: { ...h.pen, ...patch } });
  return (
    <WidgetCard title={t("experiments.harmonograph.change.title")} hint={t("experiments.harmonograph.change.hint")}>
      <ToggleGroup
        label={t("experiments.harmonograph.change.ratio")}
        labelPlacement="above"
        size="sm"
        overflow="wrap"
        value={ratio ? `${ratio[0]}:${ratio[1]}` : ""}
        onChange={(v: string) => {
          const [p, q] = v.split(":").map(Number);
          withBoard({ length_m: boardLength(h.pen.length_m, [p, q], f.detune) });
        }}
        options={RATIOS.map(([p, q]) => ({ value: `${p}:${q}`, label: `${p} : ${q}` }))}
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SliderField
          label={t("experiments.harmonograph.change.detune")}
          unit="%"
          value={f.detune * 100}
          min={-3}
          max={3}
          step={0.05}
          digits={2}
          hint={t("experiments.harmonograph.change.detune_hint")}
          onChange={(v) => withBoard({ length_m: boardLength(h.pen.length_m, f.ratio, v / 100) })}
        />
        <SliderField
          label={t("experiments.harmonograph.change.phase")}
          unit="°"
          value={h.board.phase_deg}
          min={0}
          max={180}
          step={5}
          digits={0}
          hint={t("experiments.harmonograph.change.phase_hint")}
          onChange={(v) => withBoard({ phase_deg: v })}
        />
        <SliderField
          label={t("experiments.harmonograph.change.pen_amplitude")}
          unit="°"
          value={h.pen.amplitude_deg}
          min={2}
          max={30}
          step={1}
          digits={0}
          onChange={(v) => withPen({ amplitude_deg: v })}
        />
        <SliderField
          label={t("experiments.harmonograph.change.board_amplitude")}
          unit="°"
          value={h.board.amplitude_deg}
          min={2}
          max={30}
          step={1}
          digits={0}
          onChange={(v) => withBoard({ amplitude_deg: v })}
        />
        <SliderField
          label={t("experiments.harmonograph.change.damping")}
          unit="1/s"
          value={h.pen.damping_per_s}
          min={0}
          max={0.1}
          step={0.005}
          digits={3}
          hint={t("experiments.harmonograph.change.damping_hint")}
          onChange={(v) => onChange({ pen: { ...h.pen, damping_per_s: v }, board: { ...h.board, damping_per_s: v } })}
        />
        <SliderField
          label={t("experiments.harmonograph.change.length")}
          unit="cm"
          value={h.pen.length_m * 100}
          min={30}
          max={150}
          step={5}
          digits={0}
          hint={t("experiments.harmonograph.change.length_hint")}
          onChange={(v) =>
            onChange({
              pen: { ...h.pen, length_m: v / 100 },
              board: { ...h.board, length_m: boardLength(v / 100, f.ratio, f.detune) },
            })
          }
        />
      </div>
    </WidgetCard>
  );
}

function HarmonographModel() {
  const { t } = useTranslation();
  const s = (key: string) => t(`experiments.harmonograph.symbols.${key}`);
  return (
    <>
      <p>{t("experiments.harmonograph.model.intro")}</p>
      <Equation
        tex={String.raw`x = L_1 \sin\theta_1, \qquad y = L_2 \sin\theta_2`}
        reads={t("experiments.harmonograph.model.place")}
        symbols={[
          { tex: "x, y", meaning: s("xy"), unit: "m" },
          { tex: "L_1, L_2", meaning: s("lengths"), unit: "m" },
          { tex: String.raw`\theta_1, \theta_2`, meaning: s("theta"), unit: "rad" },
        ]}
      />
      <Equation
        tex={String.raw`\theta(t) \approx \theta_0\, e^{-c\,t/2} \cos\!\left(2\pi f\, t + \varphi\right)`}
        reads={t("experiments.harmonograph.model.small")}
        symbols={[
          { tex: String.raw`\theta_0`, meaning: s("theta0"), unit: "rad" },
          { tex: "c", meaning: s("c"), unit: "1/s" },
          { tex: String.raw`f = \tfrac{1}{2\pi}\sqrt{g/L}`, meaning: s("f"), unit: "Hz" },
          { tex: String.raw`\varphi`, meaning: s("phi"), unit: "rad" },
          { tex: "g", meaning: s("g"), unit: "m/s²" },
        ]}
      />
      <Equation
        tex={String.raw`\frac{f_2}{f_1} = \sqrt{\frac{L_1}{L_2}}`}
        reads={t("experiments.harmonograph.model.ratio")}
        symbols={[{ tex: String.raw`f_1, f_2`, meaning: s("f12"), unit: "Hz" }]}
      />
    </>
  );
}

function HarmonographTrick({ h }: { h: Harmonograph | null }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const s = (key: string) => t(`experiments.harmonograph.symbols.${key}`);
  const f = useMemo(() => (h ? harmonographFigures(h) : null), [h]);
  if (!f) return <LoadingState className="py-6" label={t("common.loading")} />;
  return (
    <>
      <Equation
        tex={String.raw`T_{\text{turn}} = \frac{1}{\left|\,q f_1 - p f_2\,\right|}`}
        reads={t("experiments.harmonograph.sweet.near")}
        symbols={[
          { tex: String.raw`T_{\text{turn}}`, meaning: s("turn"), unit: "s" },
          { tex: "p : q", meaning: s("pq") },
        ]}
      />
      <p>
        {f.turn_s === null
          ? t("experiments.harmonograph.sweet.closed", { p: f.ratio[0], q: f.ratio[1] })
          : t("experiments.harmonograph.sweet.turns", {
              p: f.ratio[0],
              q: f.ratio[1],
              detune: formatNumber(f.detune * 100, 2, locale),
              turn: formatNumber(f.turn_s, 0, locale),
            })}
      </p>
      <p>{t("experiments.harmonograph.sweet.widths")}</p>
    </>
  );
}

/** How the engine computes the drawing: two pendulums, stepped together. */
function HarmonographComputed() {
  const { t } = useTranslation();
  const c = (key: string) => t(`experiments.harmonograph.computed.${key}`);
  return (
    <Equation
      tex={String.raw`\ddot\theta_i = -\frac{g}{L_i}\,\sin\theta_i - c_i\,\dot\theta_i, \qquad i = 1, 2`}
      reads={c("system")}
      symbols={[
        { tex: String.raw`\ddot\theta_i`, meaning: c("theta_dd"), unit: "rad/s²" },
        { tex: String.raw`\dot\theta_i`, meaning: c("theta_d"), unit: "rad/s" },
      ]}
    />
  );
}
