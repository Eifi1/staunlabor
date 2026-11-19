import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Crosshair, Pause, Play, Send } from "lucide-react";
import { Button, ToggleGroup } from "@eifi1/ui-kit";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber } from "@/shared/lib/format";
import { useChartHex } from "@/shared/state/palette-store";
import { SliderField } from "@/shared/ui/slider-field";
import { Figures, WidgetCard } from "@/shared/ui/widget";
import { Equation } from "./equation";
import { ExhibitFrame } from "./exhibit-frame";
import { BuildPending } from "./build-pending";
import { PreviewPending, type PreviewMode, type PreviewProps } from "./preview-mode";
import { startsRunning } from "./play";
import { HeldAnswer, useHeld } from "./held";
import { leadDeg, path, rateOf, type Body, type Carousel, type Throw } from "./simulate/coriolis";
import { SIDE } from "./stage";
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

function CarouselView({ c, throwOf, frame, time }: { c: Carousel; throwOf: Throw; frame: Frame; time: number }) {
  const { t } = useTranslation();
  const hex = useChartHex();
  const route = useMemo(() => path(c, throwOf), [c, throwOf]);
  const R = c.radius_m;
  const reach = R * 1.15;
  // Outside, the platform has turned by Ω·t; riding along, it stands still.
  const platform = frame === "outside" ? rateOf(c) * Math.min(time, route.leaves_s) : 0;
  const xs = frame === "outside" ? route.outside_x : route.turning_x;
  const ys = frame === "outside" ? route.outside_y : route.turning_y;
  const shown = route.t.findIndex((s) => s > time);
  const upto = shown === -1 ? route.t.length : shown;
  const seat = (angle: number): [number, number] => [R * Math.cos(angle + platform), R * Math.sin(angle + platform)];
  const [tx, ty] = seat(0);
  const [cx, cy] = seat(Math.PI);
  const aim = (throwOf.aim_deg * Math.PI) / 180 + platform + Math.PI;
  const last = upto - 1;
  // SVG's y runs down: anticlockwise is drawn anticlockwise by flipping y.
  return (
    <svg
      viewBox={`${-reach} ${-reach} ${2 * reach} ${2 * reach}`}
      role="img"
      aria-label={t("experiments.coriolis.view")}
      className="aspect-square w-full rounded-lg border border-subtle bg-surface-2 text-muted"
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
        x2={tx + R * 0.3 * Math.cos(aim)}
        y2={-(ty + R * 0.3 * Math.sin(aim))}
        stroke={hex[BALL_HUE % hex.length]}
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
        stroke={hex[BALL_HUE % hex.length]}
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
      {[
        [tx, ty],
        [cx, cy],
      ].map(([x, y], k) => (
        <circle key={k} cx={x} cy={-y} r={R * 0.06} fill={hex[SEAT_HUE % hex.length]} />
      ))}
      {last >= 0 && <circle cx={xs[last]} cy={-ys[last]} r={R * 0.04} fill={hex[BALL_HUE % hex.length]} />}
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

  const view = <CarouselView c={c} throwOf={throwOf} frame={frame} time={time} />;
  if (preview) return view;
  // A throw is thrown to be watched: it sets the carousel going.
  const throwAgain = () => {
    clock.current = 0;
    setTime(0);
    setRunning(true);
    if (throwOf.aim_deg !== 0) held.show();
  };
  return (
    <WidgetCard
      title={t("experiments.coriolis.play.title")}
      hint={t("experiments.coriolis.play.hint")}
      actions={
        <>
          <Button variant="accent" size="sm" onClick={throwAgain}>
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
        <div className={`${SIDE.views} mx-auto w-full max-w-xl`}>{view}</div>
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
