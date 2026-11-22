import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { Crosshair, Pause, Play, Send } from "lucide-react";
import { Button, ToggleGroup } from "@eifi1/ui-kit";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber } from "@/shared/lib/format";
import { useChartHue } from "@/shared/state/palette-store";
import { holdTouch } from "@/shared/ui/grab";
import { SliderField } from "@/shared/ui/slider-field";
import { Figures, WidgetCard } from "@/shared/ui/widget";
import { Equation } from "./equation";
import { ExhibitFrame } from "./exhibit-frame";
import { BuildPending } from "./build-pending";
import { PreviewPending, type PreviewMode, type PreviewProps } from "./preview-mode";
import { startsRunning } from "./play";
import { settingNumber, useCheckSetting } from "./check-setting";
import { HeldAnswer, useHeld } from "./held";
import { leadDeg, path, rateOf, type Body, type Carousel, type Throw } from "./simulate/coriolis";
import { SIDE, VIEW_FRAME } from "./stage";
import { useExperimentsDefaults } from "./use-experiments";

type Frame = "outside" | "riding";
const BODIES: readonly Body[] = ["puck", "ball"];

const BALL_HUE = 2;
const SEAT_HUE = 6;

/** A throw is replayed at real time, and rests this long at its end. */
const REST_S = 1;

/**
 * The Coriolis carousel (`experiments.coriolis`): a throw from the platform's
 * edge drawn from outside or riding along, from the browser port
 * (`simulate/coriolis.ts`, held to the engine by `simulate.test.ts`) — closed
 * forms, so the whole path is there the moment the aim moves. No route.
 */
export function CoriolisPage() {
  const { t } = useTranslation();
  const defaults = useExperimentsDefaults();
  const [build, setBuild] = useState<Carousel | null>(null);
  const c = build ?? defaults.data?.coriolis ?? null;
  return (
    <ExhibitFrame
      exhibit="coriolis"
      atTheExhibit={
        <>
          <p>{t("experiments.coriolis.at.seats")}</p>
          <p>{t("experiments.coriolis.at.misses")}</p>
        </>
      }
      whatHappens={<CoriolisModel />}
      computed={<CoriolisComputed />}
      sweetSpot={<CoriolisTrick />}
    >
      {defaults.isPending || !c ? (
        <BuildPending pending={defaults.isPending} error={defaults.error} />
      ) : (
        <CoriolisPlay c={c} onChange={setBuild} />
      )}
    </ExhibitFrame>
  );
}

/** A straight throw, seen riding along, over and over, for the overview. */
export function CoriolisPreview({ paused }: PreviewProps) {
  const defaults = useExperimentsDefaults();
  const c = defaults.data?.coriolis;
  return c ? <CoriolisPlay c={c} preview paused={paused} /> : <PreviewPending />;
}

/** A pull of this many of the platform's radii throws at the slider's 8 m/s. */
const FULL_PULL = 0.9;
/** A turn of the rim smaller than this is a touch, not a push. */
const LEAST_TURN = (5 * Math.PI) / 180;

/** What the pointer does with the carousel, given `onThrow` and `onSpin`. */
interface Hands {
  /** The throw as the band is pulled, and when it is let go. */
  onAim: (next: Pick<Throw, "aim_deg" | "speed_m_s">) => void;
  onThrow: (next: Pick<Throw, "aim_deg" | "speed_m_s">) => void;
  /** The platform turned by hand, and how fast it was going when let go. */
  onTurn: (radians: number) => void;
  onSpin: (rpm: number) => void;
}

/**
 * The carousel from above. Given `hands`, the thrower's seat is a sling (Marcel,
 * 2026-11-20: the exhibits "ähnlich interaktiv"): pulled back, the throw points
 * the other way, as far as the pull is long, up to the slider's 8 m/s, and goes
 * when let go. And the rim can be taken and pushed round: as fast as it turns
 * when let go, within the slider's ±20 rpm, the platform turns on.
 */
function CarouselView({
  c,
  throwOf,
  frame,
  time,
  turned = 0,
  hands,
}: {
  c: Carousel;
  throwOf: Throw;
  frame: Frame;
  time: number;
  turned?: number;
  hands?: Hands;
}) {
  const { t } = useTranslation();
  const hue = useChartHue();
  // What the pointer holds: a ref for the handlers, which a move can reach
  // before React has drawn the hold; the state for the band and the cursor.
  const [held, setHeld] = useState<"sling" | "rim" | null>(null);
  const holding = useRef<"sling" | "rim" | null>(null);
  const [band, setBand] = useState<[number, number] | null>(null);
  const lastThrow = useRef<Pick<Throw, "aim_deg" | "speed_m_s"> | null>(null);
  // The rim's angle by time, for its speed when let go.
  const rim = useRef<{ start: number; trail: Array<[number, number]> }>({ start: 0, trail: [] });
  const route = useMemo(() => path(c, throwOf), [c, throwOf]);
  const R = c.radius_m;
  const reach = R * 1.15;
  // Outside, the platform has turned by Ω·t; riding along, it stands still.
  const platform = (frame === "outside" ? rateOf(c) * Math.min(time, route.leaves_s) : 0) + turned;
  const xs = frame === "outside" ? route.outside_x : route.turning_x;
  const ys = frame === "outside" ? route.outside_y : route.turning_y;
  const shown = route.t.findIndex((s) => s > time);
  const upto = shown === -1 ? route.t.length : shown;
  const seat = (angle: number): [number, number] => [R * Math.cos(angle + platform), R * Math.sin(angle + platform)];
  const [tx, ty] = seat(0);
  const [cx, cy] = seat(Math.PI);
  const aim = (throwOf.aim_deg * Math.PI) / 180 + platform + Math.PI;
  const last = upto - 1;
  // The pointer in the drawing's metres, y up as the platform's.
  const at = (svg: SVGSVGElement, clientX: number, clientY: number): [number, number] | null => {
    const matrix = svg.getScreenCTM?.();
    if (matrix) {
      const p = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
      return [p.x, -p.y];
    }
    const box = svg.getBoundingClientRect();
    if (!box.width || !box.height) return null;
    return [
      -reach + ((clientX - box.left) / box.width) * 2 * reach,
      reach - ((clientY - box.top) / box.height) * 2 * reach,
    ];
  };
  const pullTo = (p: [number, number]) => {
    // The throw points from the pull back through the seat.
    const dx = tx - p[0];
    const dy = ty - p[1];
    let deg = (Math.atan2(dy, dx) - platform - Math.PI) * (180 / Math.PI);
    deg = ((((deg + 180) % 360) + 360) % 360) - 180;
    const next = {
      aim_deg: Math.round(Math.min(85, Math.max(-85, deg)) * 2) / 2,
      speed_m_s: Math.round(Math.min(8, Math.max(0.5, (Math.hypot(dx, dy) / (FULL_PULL * R)) * 8)) * 10) / 10,
    };
    lastThrow.current = next;
    setBand(p);
    hands?.onAim(next);
  };
  const turnTo = (p: [number, number]) => {
    const trail = rim.current.trail;
    const previous = trail[trail.length - 1][1];
    // Unwrapped, so a turn past ±180° keeps counting: the step from the last
    // angle, the short way round.
    const step = Math.atan2(p[1], p[0]) - previous;
    const angle = previous + Math.atan2(Math.sin(step), Math.cos(step));
    const now = performance.now();
    trail.push([now, angle]);
    while (trail.length > 2 && now - trail[0][0] > 150) trail.shift();
    hands?.onTurn(angle - rim.current.start);
  };
  const move = (svg: SVGSVGElement, clientX: number, clientY: number) => {
    const p = at(svg, clientX, clientY);
    if (!p) return;
    if (holding.current === "sling") pullTo(p);
    else if (holding.current === "rim") turnTo(p);
  };
  const release = () => {
    const was = holding.current;
    if (was === null) return;
    holding.current = null;
    setHeld(null);
    setBand(null);
    if (was === "sling" && lastThrow.current) hands?.onThrow(lastThrow.current);
    if (was === "rim") {
      const trail = rim.current.trail;
      const total = trail.length ? trail[trail.length - 1][1] - rim.current.start : 0;
      if (Math.abs(total) < LEAST_TURN || trail.length < 2) {
        hands?.onTurn(0);
        return;
      }
      const [t0, a0] = trail[0];
      const [t1, a1] = trail[trail.length - 1];
      const omega = t1 > t0 ? (a1 - a0) / ((t1 - t0) / 1000) : 0;
      hands?.onSpin(Math.round(Math.min(20, Math.max(-20, (omega * 60) / (2 * Math.PI))) * 2) / 2);
    }
  };
  const take = (which: "sling" | "rim", e: PointerEvent<SVGElement>) => {
    const svg = e.currentTarget.ownerSVGElement;
    if (!hands || !svg) return;
    svg.setPointerCapture?.(e.pointerId);
    holding.current = which;
    setHeld(which);
    const p = at(svg, e.clientX, e.clientY);
    if (!p) return;
    if (which === "rim") {
      const angle = Math.atan2(p[1], p[0]);
      rim.current = { start: angle, trail: [[performance.now(), angle]] };
    } else pullTo(p);
  };
  const reachOfAim = R * 0.1 * throwOf.speed_m_s;
  // SVG's y runs down: anticlockwise is drawn anticlockwise by flipping y.
  return (
    <svg
      viewBox={`${-reach} ${-reach} ${2 * reach} ${2 * reach}`}
      role="img"
      aria-label={t("experiments.coriolis.view")}
      className={`aspect-square ${VIEW_FRAME} ${hands ? "select-none" : ""} ${held ? "cursor-grabbing" : ""}`}
      onPointerMove={(e: PointerEvent<SVGSVGElement>) => move(e.currentTarget, e.clientX, e.clientY)}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <circle r={R} fill="currentColor" opacity={0.08} />
      <circle r={R} fill="none" stroke="currentColor" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      {[0, 1, 2, 3, 4, 5].map((k) => {
        const a = (k * Math.PI) / 3 + platform;
        return (
          <line
            key={k}
            x1={0}
            y1={0}
            x2={R * Math.cos(a)}
            y2={-R * Math.sin(a)}
            stroke="currentColor"
            opacity={0.25}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
      <line
        x1={tx}
        y1={-ty}
        x2={tx + reachOfAim * Math.cos(aim)}
        y2={-(ty + reachOfAim * Math.sin(aim))}
        stroke={hue(BALL_HUE)}
        strokeWidth={2}
        strokeDasharray="3 3"
        vectorEffect="non-scaling-stroke"
      />
      <polyline
        points={xs
          .slice(0, upto)
          .map((x, i) => `${x},${-ys[i]}`)
          .join(" ")}
        fill="none"
        stroke={hue(BALL_HUE)}
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
      {[
        [tx, ty],
        [cx, cy],
      ].map(([x, y], k) => (
        <circle key={k} cx={x} cy={-y} r={R * 0.06} fill={hue(SEAT_HUE)} />
      ))}
      {/* The other seat, ringed and named: what the throw is for. */}
      <circle
        cx={cx}
        cy={-cy}
        r={R * 0.11}
        fill="none"
        stroke={hue(SEAT_HUE)}
        strokeDasharray="3 2"
        vectorEffect="non-scaling-stroke"
      />
      <text
        x={cx * 0.72}
        y={-cy * 0.72}
        fontSize={R * 0.08}
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-current text-secondary"
      >
        {t("experiments.coriolis.target")}
      </text>
      {last >= 0 && <circle cx={xs[last]} cy={-ys[last]} r={R * 0.04} fill={hue(BALL_HUE)} />}
      {hands && (
        <>
          {/* The rim, to push the platform round: a band along it, unseen. */}
          <circle
            r={R}
            fill="none"
            stroke="transparent"
            strokeWidth={R * 0.16}
            pointerEvents="stroke"
            className={held ? undefined : "cursor-grab"}
            ref={holdTouch}
            onPointerDown={(e) => take("rim", e)}
          />
          {/* The sling: the band from the seat to the hand, and the seat to take. */}
          {band && (
            <line
              x1={tx}
              y1={-ty}
              x2={band[0]}
              y2={-band[1]}
              stroke="currentColor"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          )}
          <circle
            cx={tx}
            cy={-ty}
            r={R * 0.12}
            fill="transparent"
            className={held ? undefined : "cursor-grab"}
            ref={holdTouch}
            onPointerDown={(e) => take("sling", e)}
          />
        </>
      )}
    </svg>
  );
}

function CoriolisPlay({
  c,
  onChange,
  preview = false,
  paused = false,
}: { c: Carousel; onChange?: (next: Carousel) => void } & PreviewMode) {
  const { t } = useTranslation();
  const locale = useLocale();
  const [throwOf, setThrow] = useState<Throw>({ speed_m_s: 3, aim_deg: 0, body: "puck" });
  const [frameHere, setFrame] = useState<Frame>("riding");
  const [time, setTime] = useState(0);
  const [runningHere, setRunning] = useState(startsRunning);
  const clock = useRef(0);
  // The aim that hits, and the button that sets it, once the reader has thrown
  // with an aim of their own: before, the twin throws straight at the other seat.
  const held = useHeld();
  const frame = preview ? "riding" : frameHere;
  const route = useMemo(() => path(c, throwOf), [c, throwOf]);
  const lead = useMemo(() => leadDeg(c, throwOf.speed_m_s, throwOf.body), [c, throwOf.speed_m_s, throwOf.body]);
  const running = preview ? !paused : runningHere;

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      clock.current += dt;
      // Replayed over and over: the throw, a moment at its end, again.
      if (clock.current > route.leaves_s + REST_S) clock.current = 0;
      setTime(clock.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, route.leaves_s]);

  // A throw is thrown to be watched: it sets the carousel going.
  const throwAgain = (aimDeg = throwOf.aim_deg) => {
    clock.current = 0;
    setTime(0);
    setRunning(true);
    if (aimDeg !== 0) held.show();
  };
  // A check case's "Set it up": the platform's turn, the throw and the view,
  // and the throw thrown from its start.
  useCheckSetting("coriolis", (setting) => {
    if (preview) return false;
    const rpm = settingNumber(setting, "rpm", c.rpm);
    if (rpm !== c.rpm) onChange?.({ ...c, rpm });
    const body = setting.body === "ball" || setting.body === "puck" ? setting.body : throwOf.body;
    setThrow({
      speed_m_s: settingNumber(setting, "speed_m_s", throwOf.speed_m_s),
      aim_deg: settingNumber(setting, "aim_deg", throwOf.aim_deg),
      body,
    });
    if (setting.frame === "riding" || setting.frame === "outside") setFrame(setting.frame);
    clock.current = 0;
    setTime(0);
    setRunning(true);
    return true;
  });
  // The platform as the reader's hand turns it, before it is let go.
  const [turned, setTurned] = useState(0);
  const hands: Hands = {
    onAim: (next) => {
      setRunning(false);
      clock.current = 0;
      setTime(0);
      setThrow({ ...throwOf, ...next });
    },
    onThrow: (next) => {
      setThrow({ ...throwOf, ...next });
      throwAgain(next.aim_deg);
    },
    onTurn: (radians) => {
      setRunning(false);
      setTurned(radians);
    },
    onSpin: (rpm) => {
      setTurned(0);
      onChange?.({ ...c, rpm });
      throwAgain();
    },
  };
  const view = preview ? (
    <CarouselView c={c} throwOf={throwOf} frame={frame} time={time} />
  ) : (
    <CarouselView c={c} throwOf={throwOf} frame={frame} time={time} turned={turned} hands={hands} />
  );
  if (preview) return view;
  return (
    <WidgetCard
      title={t("experiments.coriolis.play.title")}
      hint={t("experiments.coriolis.play.hint")}
      actions={
        <>
          <Button variant="accent" size="sm" onClick={() => throwAgain()}>
            <Send className="size-4" aria-hidden />
            {t("experiments.coriolis.play.throw")}
          </Button>
          {held.shown && (
            <Button
              variant="secondary"
              size="sm"
              disabled={lead === null}
              onClick={() => {
                if (lead !== null) setThrow({ ...throwOf, aim_deg: Math.round(lead * 10) / 10 });
                throwAgain();
              }}
            >
              <Crosshair className="size-4" aria-hidden />
              {t("experiments.coriolis.play.aim_lead")}
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => setRunning(!running)}>
            {running ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
            {running ? t("experiments.play.pause") : t("experiments.play.run")}
          </Button>
        </>
      }
    >
      <div className={`${SIDE.grid} ${SIDE.cap.xl}`}>
        <div className={`${SIDE.top} flex flex-wrap gap-4`}>
          <ToggleGroup
            label={t("experiments.coriolis.play.frame")}
            labelPlacement="above"
            size="sm"
            value={frame}
            onChange={(f: Frame) => setFrame(f)}
            options={(["riding", "outside"] as const).map((f) => ({
              value: f,
              label: t(`experiments.coriolis.play.frames.${f}`),
            }))}
          />
          <ToggleGroup
            label={t("experiments.coriolis.play.body")}
            labelPlacement="above"
            size="sm"
            value={throwOf.body}
            onChange={(b: Body) => setThrow({ ...throwOf, body: b })}
            options={BODIES.map((b) => ({ value: b, label: t(`experiments.coriolis.play.bodies.${b}`) }))}
          />
        </div>
        <div className={`${SIDE.views} mx-auto w-full max-w-xl space-y-2`}>
          {view}
          <p className="text-sm text-secondary">{t("experiments.coriolis.play.sling_hint")}</p>
        </div>
        <div className={SIDE.column}>
          <SliderField
            label={t("experiments.coriolis.play.aim")}
            unit="°"
            value={throwOf.aim_deg}
            min={-85}
            max={85}
            step={0.5}
            digits={1}
            hint={t("experiments.coriolis.play.aim_hint")}
            onChange={(v) => setThrow({ ...throwOf, aim_deg: v })}
          />
          <SliderField
            label={t("experiments.coriolis.play.speed")}
            unit="m/s"
            value={throwOf.speed_m_s}
            min={0.5}
            max={8}
            step={0.1}
            digits={1}
            onChange={(v) => setThrow({ ...throwOf, speed_m_s: v })}
          />
          <SliderField
            label={t("experiments.coriolis.play.rpm")}
            unit={t("experiments.coriolis.play.rpm_unit")}
            value={c.rpm}
            min={-20}
            max={20}
            step={0.5}
            digits={1}
            hint={t("experiments.coriolis.play.rpm_hint")}
            onChange={(v) => onChange?.({ ...c, rpm: v })}
          />
          <Figures
            tiles={[
              {
                key: "miss",
                label: t("experiments.coriolis.play.miss"),
                value: route.miss_deg,
                digits: 1,
                unit: "°",
              },
              {
                key: "time",
                label: t("experiments.coriolis.play.flight"),
                value: route.leaves_s,
                digits: 2,
                unit: "s",
              },
            ]}
          />
          <HeldAnswer held={held}>
            <p className="text-sm text-secondary">
              {lead === null
                ? t("experiments.coriolis.play.no_lead")
                : t("experiments.coriolis.play.lead", { lead: formatNumber(lead, 1, locale) })}
            </p>
          </HeldAnswer>
        </div>
      </div>
    </WidgetCard>
  );
}

function CoriolisModel() {
  const { t } = useTranslation();
  const s = (key: string) => t(`experiments.coriolis.symbols.${key}`);
  return (
    <>
      <p>{t("experiments.coriolis.model.intro")}</p>
      <Equation
        tex={String.raw`\vec r(t) = \vec r_0 + \left(\vec u + \vec\Omega \times \vec r_0\right) t`}
        reads={t("experiments.coriolis.model.puck")}
        symbols={[
          { tex: String.raw`\vec r_0`, meaning: s("r0"), unit: "m" },
          { tex: String.raw`\vec u`, meaning: s("u"), unit: "m/s" },
          { tex: String.raw`\vec\Omega`, meaning: s("omega"), unit: "1/s" },
        ]}
      />
      <Equation
        tex={String.raw`\vec a' = -2\,\vec\Omega \times \vec v' - \vec\Omega \times (\vec\Omega \times \vec r')`}
        reads={t("experiments.coriolis.model.riding")}
        symbols={[{ tex: String.raw`\vec a', \vec v', \vec r'`, meaning: s("primed") }]}
      />
      <Equation
        tex={String.raw`\frac{d\vec v}{dt} = \frac{k}{1 + k}\,\vec\Omega \times \vec v = \frac{2}{7}\,\vec\Omega \times \vec v`}
        reads={t("experiments.coriolis.model.ball")}
        symbols={[{ tex: String.raw`k = \frac{I}{m a^2}`, meaning: s("k") }]}
      />
    </>
  );
}

function CoriolisTrick() {
  const { t } = useTranslation();
  return (
    <>
      <p>{t("experiments.coriolis.sweet.nobody")}</p>
      <p>{t("experiments.coriolis.sweet.ball")}</p>
    </>
  );
}

function CoriolisComputed() {
  const { t } = useTranslation();
  return <p>{t("experiments.coriolis.computed.system")}</p>;
}
