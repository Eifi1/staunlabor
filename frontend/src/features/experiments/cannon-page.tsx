import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDownUp, ArrowDown, Pause, Play, RotateCcw } from "lucide-react";
import {
  AlertBanner,
  Button,
  LoadingState,
  SectionLabel,
  StaticLegend,
  Switch,
  ToggleGroup,
  seriesLegendEntries,
} from "@eifi1/ui-kit";
import { apiErrorMessage } from "@/shared/api/client";
import { SeriesChart } from "@/shared/charts/series-chart";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber } from "@/shared/lib/format";
import { useChartHex } from "@/shared/state/palette-store";
import type { BallStackRequest, CannonContact, CannonFigures, CannonImpact } from "@/shared/types";
import { SliderField } from "@/shared/ui/slider-field";
import { Figures, WidgetCard } from "@/shared/ui/widget";
import { CannonView } from "./cannon-view";
import { Equation } from "./equation";
import { ExhibitFrame } from "./exhibit-frame";
import {
  CONTACT_STEP_S,
  G,
  IMPACT_EVERY,
  IMPACT_WINDOW_S,
  MAX_S,
  SAMPLES_PER_S,
  drop,
  launch,
  start,
  type BallStack,
  type Drop,
  type Launch,
} from "./simulate/cannon";
import { PreviewPending, type PreviewMode, type PreviewProps } from "./preview-mode";
import { STAGE } from "./stage";
import { useCannonFigures, useExperimentsDefaults } from "./use-experiments";

/** Between the auto mode's drops, seconds. */
const AUTO_GAP_S = 1.2;
/** Slow motion slows the impact this much: its 30 ms then take 3 s. */
const SLOW = 0.01;
/** How long before the impact the slow motion starts, seconds. */
const SLOW_LEAD_S = 0.01;

/**
 * The ball cannon (`experiments.cannon`): three
 * elastomer balls threaded on a wire, dropped stacked, and the small one on
 * top shot up far higher than it fell. The drop is the engine's, run in the
 * browser when the reader lets go (`simulate/cannon.ts`, held by
 * `simulate.test.ts`): every ball by Newton's second law, every contact a
 * Hertz spring with damping, so the page can show the forces the balls press
 * on each other with. How high one, two and three balls send the top one, and
 * what the textbook would say, is the server's.
 */
export function CannonPage() {
  const { t } = useTranslation();
  const defaults = useExperimentsDefaults();
  const [build, setBuild] = useState<BallStackRequest | null>(null);
  const stack = build ?? defaults.data?.cannon ?? null;
  const figures = useCannonFigures(stack);

  return (
    <ExhibitFrame
      exhibit="cannon"
      atTheExhibit={
        <>
          <p>{t("experiments.cannon.at.balls")}</p>
          <p>{t("experiments.cannon.at.drop")}</p>
        </>
      }
      whatHappens={<CannonModel />}
      computed={<CannonComputed />}
      sweetSpot={<CannonTrick figures={figures.data ?? null} stack={stack} />}
    >
      {defaults.isPending ? (
        <LoadingState className="py-10" label={t("common.loading")} />
      ) : !stack ? (
        <AlertBanner tone="danger">{apiErrorMessage(defaults.error, t("experiments.failed"))}</AlertBanner>
      ) : (
        <>
          <CannonPlay stack={stack} onDropHeight={(h) => setBuild({ ...stack, drop_m: h })} />
          <CannonBuild stack={stack} onChange={setBuild} />
        </>
      )}
    </ExhibitFrame>
  );
}

/** The stack cut to its bottom `k` balls. */
const cut = (stack: BallStackRequest, k: number): BallStack => ({ ...stack, balls: stack.balls.slice(0, k) });

/** Each contact's first closing in a drop: the impact's, floor first. */
function firstContacts(contacts: readonly CannonContact[]): CannonContact[] {
  const first = new Map<number, CannonContact>();
  for (const contact of contacts) if (!first.has(contact.contact)) first.set(contact.contact, contact);
  return [...first.values()].sort((a, b) => a.contact - b.contact);
}

/** When the stack first touches the floor, if it has. */
const impactAt = (d: Drop) => d.contacts.find((c) => c.contact === 0)?.start_s ?? null;

/** Each ball's height `age` seconds into a drop: from the impact's fine record
 *  while it lasts, so the squash shows, and between two samples otherwise. */
function heightsAt(d: Drop, age: number): number[] {
  const first = impactAt(d);
  const fine = CONTACT_STEP_S * IMPACT_EVERY;
  if (first !== null && age >= first && age <= first + IMPACT_WINDOW_S && d.impact.t_ms.length > 1) {
    const at = Math.min((age - first) / fine, d.impact.t_ms.length - 1);
    const i = Math.floor(at);
    const f = at - i;
    return d.impact.y_m.map((column) => (i + 1 < column.length ? column[i] * (1 - f) + column[i + 1] * f : column[i]));
  }
  const at = Math.min(age * SAMPLES_PER_S, d.t.length - 1);
  const i = Math.floor(at);
  const f = at - i;
  return d.y_m.map((column) => (i + 1 < column.length ? column[i] * (1 - f) + column[i + 1] * f : column[i]));
}

interface Playing {
  stack: BallStack;
  drop: Drop;
  age: number;
  until: number;
  impact: number | null;
  /** When the top ball is highest: what the drop did is told from then on,
   *  not before the ball has done it. */
  apexAt: number;
}

/** The exhibit's auto mode alone, for the overview's previews
 *  (`preview-mode.tsx`): one ball, two, three, dropped over and over. */
export function CannonPreview({ paused }: PreviewProps) {
  const defaults = useExperimentsDefaults();
  const stack = defaults.data?.cannon;
  return stack ? <CannonPlay stack={stack} preview paused={paused} /> : <PreviewPending />;
}

function CannonPlay({
  stack,
  onDropHeight = () => {},
  preview = false,
  paused = false,
}: {
  stack: BallStackRequest;
  onDropHeight?: (heightM: number) => void;
} & PreviewMode) {
  const { t } = useTranslation();
  const locale = useLocale();
  const [runningHere, setRunning] = useState(true);
  const running = preview ? !paused : runningHere;
  const [slow, setSlow] = useState(false);
  const [auto, setAuto] = useState(preview);
  const [last, setLast] = useState<{ stack: BallStack; drop: Drop; launch: Launch } | null>(null);
  const [reached, setReached] = useState(false);
  const [struck, setStruck] = useState(false);
  /** In slow motion, the close-up comes down to the stack while it squashes:
   *  ten millimetres are a few pixels at the height the drop starts from. */
  const [zoomed, setZoomed] = useState(false);
  const playing = useRef<Playing | null>(null);
  const autoState = useRef({ next: 0, at: 0 });
  /** What the drawing shows: the balls of the drop being played (the auto mode
   *  drops one, two and three of them), and where each is. */
  const [frame, setFrame] = useState<{ balls: BallStack["balls"]; y: number[] }>(() => ({
    balls: stack.balls,
    y: start(stack),
  }));
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement | null>(null);
  const grab = useRef<{ offset: number } | null>(null);

  const latest = useRef({ stack, slow, auto });
  useEffect(() => {
    latest.current = { stack, slow, auto };
  });

  // Idle, the stack sits where it will be let go from.
  const shownHeight = dragHeight ?? stack.drop_m;
  useEffect(() => {
    if (!playing.current) setFrame({ balls: stack.balls, y: start({ ...stack, drop_m: shownHeight }) });
  }, [stack, shownHeight]);

  const letGo = (what: BallStack) => {
    // The launch first, which is cheap: it says how long the drop is worth
    // watching — the fall, the top ball's climb and its fall back, and a
    // second more; the small bounces after that go on for seconds.
    const up = launch(what);
    const climb = Math.max(up.apex_m - up.launch_height_m, 0);
    const watch = Math.sqrt((2 * what.drop_m) / G) + 2 * Math.sqrt((2 * climb) / G) + 1;
    const d = drop(what, Math.min(watch, MAX_S));
    const ys = d.y_m[what.balls.length - 1];
    playing.current = {
      stack: what,
      drop: d,
      age: 0,
      until: d.t[d.t.length - 1],
      impact: impactAt(d),
      apexAt: d.t[ys.indexOf(Math.max(...ys))],
    };
    setLast({ stack: what, drop: d, launch: up });
    setReached(false);
    setStruck(false);
  };

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let previous = performance.now() / 1000;
    const tick = (ms: number) => {
      const now = ms / 1000;
      const dt = Math.min(0.05, now - previous);
      previous = now;
      const { stack: current, slow: slowly, auto: autoOn } = latest.current;
      const p = playing.current;
      if (p) {
        const inImpact = p.impact !== null && p.age >= p.impact - SLOW_LEAD_S && p.age <= p.impact + IMPACT_WINDOW_S;
        p.age += dt * (slowly && inImpact ? SLOW : 1);
        setZoomed(slowly && inImpact);
        setFrame({ balls: p.stack.balls, y: heightsAt(p.drop, p.age) });
        if (p.impact !== null && p.age > p.impact + IMPACT_WINDOW_S) setStruck(true);
        if (p.age >= p.apexAt) setReached(true);
        if (p.age >= p.until) {
          playing.current = null;
          setZoomed(false);
          setStruck(true);
          setReached(true);
          autoState.current.at = now + AUTO_GAP_S;
          if (!autoOn) setFrame({ balls: current.balls, y: start(current) });
        }
      } else if (autoOn && now >= autoState.current.at) {
        // One ball, two, three — the same height, so the climb is what changes.
        const k = (autoState.current.next % current.balls.length) + 1;
        autoState.current.next += 1;
        letGo(cut(current, k));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  /** The pointer's height in the close-up, metres. */
  const pointerY = (event: ReactPointerEvent<SVGSVGElement>): number | null => {
    const matrix = svg.current?.getScreenCTM?.();
    if (!matrix) return null;
    return -new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()).y;
  };
  const clampDrop = (h: number) => Math.min(3, Math.max(0.05, h));
  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    const y = pointerY(event);
    if (y === null) return;
    setAuto(false);
    playing.current = null;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    grab.current = { offset: y - stack.drop_m };
    setDragHeight(stack.drop_m);
  };
  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!grab.current) return;
    const y = pointerY(event);
    if (y !== null) setDragHeight(clampDrop(y - grab.current.offset));
  };
  const onPointerUp = () => {
    if (!grab.current) return;
    grab.current = null;
    const height = dragHeight ?? stack.drop_m;
    setDragHeight(null);
    onDropHeight(height);
    letGo({ ...stack, drop_m: height });
  };

  const stackTop = shownHeight + stack.balls.reduce((sum, b) => sum + b.diameter_m + stack.gap_m, 0);
  const up = last && reached ? last.launch : null;
  const impact = last && struck ? last : null;
  const climbTop = Math.max(stackTop, last?.launch.apex_m ?? 2) * 1.15;
  const n = (value: number, digits: number) => formatNumber(value, digits, locale);
  if (preview) {
    return (
      <CannonView
        balls={frame.balls}
        y={frame.y}
        closeTopM={Math.max(0.6, stackTop + 0.25)}
        climbTopM={climbTop}
        apexM={up?.apex_m ?? null}
      />
    );
  }
  return (
    <WidgetCard
      title={t("experiments.cannon.play.title")}
      hint={t(auto ? "experiments.cannon.play.hint_auto" : "experiments.cannon.play.hint")}
      actions={
        <>
          <Button variant="secondary" size="sm" onClick={() => setRunning(!running)}>
            {running ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
            {running ? t("experiments.cannon.play.pause") : t("experiments.cannon.play.run")}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              playing.current = null;
              setLast(null);
              setReached(false);
              setStruck(false);
              setFrame({ balls: stack.balls, y: start(stack) });
            }}
          >
            <RotateCcw className="size-4" aria-hidden />
            {t("experiments.cannon.play.restart")}
          </Button>
        </>
      }
    >
      <div className={`grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_18rem] ${STAGE.withSide}`}>
        <CannonView
          balls={frame.balls}
          y={frame.y}
          closeTopM={
            zoomed ? frame.balls.reduce((sum, b) => sum + b.diameter_m, 0) * 1.2 : Math.max(0.6, stackTop + 0.25)
          }
          climbTopM={climbTop}
          apexM={up?.apex_m ?? null}
          svgRef={svg}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        />
        <div className="space-y-4">
          <SliderField
            label={t("experiments.cannon.play.height")}
            unit="cm"
            value={shownHeight * 100}
            min={5}
            max={300}
            step={5}
            digits={0}
            onChange={(v) => onDropHeight(v / 100)}
          />
          <Button
            variant="accent"
            size="sm"
            onClick={() => {
              setAuto(false);
              letGo(stack);
            }}
          >
            <ArrowDown className="size-4" aria-hidden />
            {t("experiments.cannon.play.drop")}
          </Button>
          <p className="text-caption text-muted">{t("experiments.cannon.play.drag")}</p>
          <Switch
            label={t("experiments.cannon.play.slow")}
            description={t("experiments.cannon.play.slow_hint")}
            checked={slow}
            onCheckedChange={setSlow}
          />
          <Switch
            label={t("experiments.cannon.play.auto")}
            description={t("experiments.cannon.play.auto_hint")}
            checked={auto}
            onCheckedChange={(on) => {
              setAuto(on);
              autoState.current = { next: 0, at: 0 };
            }}
          />
          <Figures
            tiles={[
              {
                key: "launch",
                label: t("experiments.cannon.play.launch"),
                value: up?.launch_m_s ?? null,
                digits: 2,
                unit: "m/s",
              },
              {
                key: "apex",
                label: t("experiments.cannon.play.apex"),
                value: up?.apex_m ?? null,
                digits: 2,
                unit: "m",
              },
              {
                key: "times",
                label: t("experiments.cannon.play.times"),
                value: up?.times_drop ?? null,
                digits: 1,
                unit: "×",
              },
            ]}
          />
          {last && (
            <p className="text-caption text-muted">
              {t("experiments.cannon.play.of", { count: last.stack.balls.length, height: n(last.stack.drop_m, 2) })}
            </p>
          )}
        </div>
      </div>
      {impact && (
        <div className="mt-4 space-y-3">
          <SectionLabel as="h4">{t("experiments.cannon.forces.title")}</SectionLabel>
          <ContactTable stack={impact.stack} contacts={firstContacts(impact.drop.contacts)} />
          <ForceChart stack={impact.stack} impact={impact.drop.impact} />
        </div>
      )}
    </WidgetCard>
  );
}

/** What each contact is called: the floor and the balls by their sizes. */
function useContactNames(stack: Pick<BallStack, "balls">): string[] {
  const { t } = useTranslation();
  const locale = useLocale();
  const cm = (i: number) => `${formatNumber(stack.balls[i].diameter_m * 100, 0, locale)} cm`;
  return stack.balls.map((_, c) =>
    c === 0
      ? t("experiments.cannon.forces.floor_contact", { ball: cm(0) })
      : t("experiments.cannon.forces.ball_contact", { lower: cm(c - 1), upper: cm(c) }),
  );
}

/** Each contact of the impact: how hard, how deep, how long, how much momentum. */
function ContactTable({ stack, contacts }: { stack: Pick<BallStack, "balls">; contacts: CannonContact[] }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const names = useContactNames(stack);
  const n = (value: number, digits: number) => formatNumber(value, digits, locale);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm tabular-nums">
        <thead className="text-left text-caption text-muted">
          <tr>
            <th className="py-1 pr-3 font-normal">{t("experiments.cannon.forces.contact")}</th>
            <th className="py-1 pr-3 font-normal">{t("experiments.cannon.forces.peak")}</th>
            <th className="py-1 pr-3 font-normal">{t("experiments.cannon.forces.squash")}</th>
            <th className="py-1 pr-3 font-normal">{t("experiments.cannon.forces.duration")}</th>
            <th className="py-1 font-normal">{t("experiments.cannon.forces.impulse")}</th>
          </tr>
        </thead>
        <tbody>
          {contacts.map((c) => (
            <tr key={c.contact} className="border-t border-subtle">
              <td className="py-1 pr-3">{names[c.contact]}</td>
              <td className="py-1 pr-3">{n(c.peak_force_n, 0)} N</td>
              <td className="py-1 pr-3">{n(c.peak_overlap_m * 1000, 1)} mm</td>
              <td className="py-1 pr-3">{c.end_s === null ? "—" : `${n((c.end_s - c.start_s) * 1000, 1)} ms`}</td>
              <td className="py-1">{n(c.impulse_n_s, 2)} N·s</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The forces over the impact, one curve per contact. */
function ForceChart({ stack, impact }: { stack: Pick<BallStack, "balls">; impact: CannonImpact }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  const names = useContactNames(stack);
  const rows = useMemo(
    () =>
      impact.t_ms.map((ms, j) => {
        const row: Record<string, number> = { ms };
        impact.force_n.forEach((column, c) => (row[`f${c}`] = column[j]));
        return row;
      }),
    [impact],
  );
  const series = names.map((label, c) => ({ key: `f${c}`, label, color: hex[(2 * c) % hex.length] }));
  return (
    <>
      <SeriesChart
        rows={rows}
        series={series}
        axes={[
          {
            id: "y",
            title: `${t("experiments.cannon.forces.force")} (N)`,
            format: (v) => formatNumber(v, 0, locale),
            includeZero: true,
          },
        ]}
        x={{
          key: "ms",
          title: `${t("experiments.cannon.forces.time")} (ms)`,
          format: (v) => formatNumber(v, 0, locale),
        }}
      />
      <StaticLegend entries={seriesLegendEntries(series)} />
    </>
  );
}

function CannonBuild({ stack, onChange }: { stack: BallStackRequest; onChange: (next: BallStackRequest) => void }) {
  const { t } = useTranslation();
  /** The exhibit's three, in its order, so a ball added back is the one that was there. */
  const exhibit = [0.1, 0.07, 0.05];
  const count = stack.balls.length;
  const setCount = (k: number) => {
    const balls = Array.from(
      { length: k },
      (_, i) => stack.balls[i] ?? { diameter_m: exhibit[i], density_kg_m3: 1100 },
    );
    onChange({ ...stack, balls });
  };
  const setDiameter = (i: number, cm: number) =>
    onChange({ ...stack, balls: stack.balls.map((ball, j) => (j === i ? { ...ball, diameter_m: cm / 100 } : ball)) });
  return (
    <WidgetCard title={t("experiments.cannon.change.title")} hint={t("experiments.cannon.change.hint")}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <ToggleGroup
            className="w-auto"
            value={String(count)}
            onChange={(v) => setCount(Number(v))}
            aria-label={t("experiments.cannon.change.count")}
            options={[1, 2, 3].map((k) => ({
              value: String(k),
              label: t("experiments.cannon.change.balls", { count: k }),
            }))}
          />
          <Button
            variant="secondary"
            size="sm"
            disabled={count < 2}
            onClick={() => onChange({ ...stack, balls: [...stack.balls].reverse() })}
          >
            <ArrowDownUp className="size-4" aria-hidden />
            {t("experiments.cannon.change.flip")}
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {stack.balls.map((ball, i) => (
            <SliderField
              key={i}
              label={t(`experiments.cannon.change.ball_${i}`)}
              unit="cm"
              value={ball.diameter_m * 100}
              min={2}
              max={20}
              step={0.5}
              digits={1}
              onChange={(v) => setDiameter(i, v)}
            />
          ))}
          <SliderField
            label={t("experiments.cannon.change.gap")}
            unit="mm"
            value={stack.gap_m * 1000}
            min={0}
            max={50}
            step={1}
            digits={0}
            hint={t("experiments.cannon.change.gap_hint")}
            onChange={(v) => onChange({ ...stack, gap_m: v / 1000 })}
          />
          <SliderField
            label={t("experiments.cannon.change.youngs")}
            unit="MPa"
            value={stack.youngs_mpa}
            min={0.5}
            max={200}
            step={0.5}
            digits={1}
            log
            hint={t("experiments.cannon.change.youngs_hint")}
            onChange={(v) => onChange({ ...stack, youngs_mpa: v })}
          />
          <SliderField
            label={t("experiments.cannon.change.floor_e")}
            unit=""
            value={stack.floor_restitution}
            min={0.3}
            max={1}
            step={0.01}
            digits={2}
            hint={t("experiments.cannon.change.e_hint")}
            onChange={(v) => onChange({ ...stack, floor_restitution: v })}
          />
          <SliderField
            label={t("experiments.cannon.change.ball_e")}
            unit=""
            value={stack.ball_restitution}
            min={0.3}
            max={1}
            step={0.01}
            digits={2}
            onChange={(v) => onChange({ ...stack, ball_restitution: v })}
          />
        </div>
      </div>
    </WidgetCard>
  );
}

function CannonModel() {
  const { t } = useTranslation();
  const s = (key: string) => t(`experiments.cannon.symbols.${key}`);
  return (
    <>
      <p>{t("experiments.cannon.model.intro")}</p>
      <Equation
        tex={String.raw`m_i\,\ddot y_i = -m_i\,g - \tfrac{1}{2}\,\rho\,C_d\,A_i\,\dot y_i\,|\dot y_i| + F_i - F_{i+1}`}
        reads={t("experiments.cannon.model.motion")}
        symbols={[
          { tex: "y_i", meaning: s("y"), unit: "m" },
          { tex: "m_i", meaning: s("m"), unit: "kg" },
          { tex: "g", meaning: s("g"), unit: "m/s²" },
          { tex: String.raw`\rho`, meaning: s("rho"), unit: "kg/m³" },
          { tex: "C_d", meaning: s("cd") },
          { tex: "A_i", meaning: s("a"), unit: "m²" },
          { tex: "F_i", meaning: s("f"), unit: "N" },
        ]}
      />
      <Equation
        tex={String.raw`F = K\,\delta^{3/2}\left(1 + \frac{8\,(1 - e)}{5\,e}\,\frac{\dot\delta}{\dot\delta_0}\right)`}
        reads={t("experiments.cannon.model.hertz")}
        symbols={[
          { tex: String.raw`\delta`, meaning: s("delta"), unit: "m" },
          { tex: String.raw`\dot\delta,\ \dot\delta_0`, meaning: s("ddelta"), unit: "m/s" },
          { tex: "e", meaning: s("e") },
        ]}
      />
      <Equation
        tex={String.raw`K = \tfrac{4}{3}\,E^*\sqrt{R^*}, \qquad R^* = \frac{R_1 R_2}{R_1 + R_2}, \qquad E^* = \frac{E}{1 - \nu^2}\ \text{(floor)},\ \frac{E}{2\,(1 - \nu^2)}\ \text{(two balls)}`}
        reads={t("experiments.cannon.model.stiffness")}
        symbols={[
          { tex: "K", meaning: s("k"), unit: "N/m^{3/2}" },
          { tex: "E", meaning: s("young"), unit: "Pa" },
          { tex: String.raw`\nu`, meaning: s("nu") },
          { tex: String.raw`R_1,\ R_2`, meaning: s("r"), unit: "m" },
        ]}
      />
      <Equation
        tex={String.raw`u_{k} = \frac{2\,m_{k-1}\,u_{k-1} + (m_{k-1} - m_k)\,v}{m_{k-1} + m_k} \;\to\; (2^n - 1)\,v, \qquad H \to (2^n - 1)^2\,h`}
        reads={t("experiments.cannon.model.textbook")}
        symbols={[
          { tex: "v", meaning: s("v"), unit: "m/s" },
          { tex: "u_k", meaning: s("uk"), unit: "m/s" },
          { tex: "n", meaning: s("n") },
          { tex: "H,\\ h", meaning: s("hh"), unit: "m" },
        ]}
      />
      <p>{t("experiments.cannon.model.real")}</p>
    </>
  );
}

/** How the engine computes the drop: the system of equations, stepped. */
function CannonComputed() {
  const { t } = useTranslation();
  const s = (key: string) => t(`experiments.cannon.symbols.${key}`);
  return (
    <Equation
      tex={String.raw`\frac{d}{dt}\begin{pmatrix} y_i \\ u_i \end{pmatrix} = \begin{pmatrix} u_i \\ \bigl(F_i - F_{i+1}\bigr)/m_i - g - k_i\,u_i\,|u_i| \end{pmatrix}, \qquad \Delta t = 0.5\ \text{ms} \ \text{or}\ 10\ \mu\text{s}`}
      reads={t("experiments.cannon.computed.system")}
      symbols={[
        { tex: "u_i", meaning: s("u"), unit: "m/s" },
        { tex: "k_i", meaning: s("kdrag"), unit: "1/m" },
        { tex: String.raw`\Delta t`, meaning: s("dt"), unit: "s" },
      ]}
    />
  );
}

function CannonTrick({ figures, stack }: { figures: CannonFigures | null; stack: BallStackRequest | null }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const tiles = useMemo(
    () =>
      (figures?.launches ?? []).map((launch) => ({
        key: `l${launch.balls}`,
        label: t("experiments.cannon.sweet.level", { count: launch.balls }),
        value: launch.times_drop,
        digits: 1,
        unit: "×",
      })),
    [figures, t],
  );
  if (!figures || !stack) return <LoadingState className="py-6" label={t("common.loading")} />;
  const n = (value: number, digits: number) => formatNumber(value, digits, locale);
  const top = figures.launches[figures.launches.length - 1];
  const masses = figures.masses_kg.map((m) => n(m * 1000, 0)).join(" : ");
  const contacts = firstContacts(figures.contacts);
  const floor = contacts[0];
  return (
    <>
      <p>
        {t("experiments.cannon.sweet.climb", {
          count: top.balls,
          times: n(top.times_drop, 1),
          apex: n(top.apex_m, 1),
          height: n(stack.drop_m, 2),
        })}
      </p>
      <Figures tiles={tiles} />
      <p>
        {t("experiments.cannon.sweet.speeds", {
          impact: n(figures.impact_m_s, 1),
          launch: n(top.launch_m_s, 1),
          sequential: n(top.sequential_launch_m_s, 1),
          ideal: n(top.ideal_launch_m_s, 1),
          textbook: n(top.textbook_launch_m_s, 1),
        })}
      </p>
      <p>{t("experiments.cannon.sweet.overlap")}</p>
      {floor && (
        <p>
          {t("experiments.cannon.sweet.forces", {
            force: n(floor.peak_force_n / 1000, 1),
            weight: n(floor.peak_force_n / (figures.masses_kg[0] * G), 0),
            squash: n(floor.peak_overlap_m * 1000, 0),
            duration: n(((floor.end_s ?? floor.start_s) - floor.start_s) * 1000, 0),
          })}
        </p>
      )}
      <ContactTable stack={stack} contacts={contacts} />
      <ForceChart stack={stack} impact={figures.impact} />
      <p>{t("experiments.cannon.sweet.gap")}</p>
      <p>{t("experiments.cannon.sweet.masses", { masses })}</p>
      <p>{t("experiments.cannon.sweet.energy", { share: n(figures.energy_share * 100, 0) })}</p>
      <p>{t("experiments.cannon.sweet.flip")}</p>
      <p>{t("experiments.cannon.sweet.name")}</p>
      <p className="text-caption text-muted">{t("experiments.cannon.sweet.assumed")}</p>
    </>
  );
}
