import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Pause, Play, RotateCcw } from "lucide-react";
import { AlertBanner, Button, LoadingState, Switch, ToggleGroup } from "@eifi1/ui-kit";
import { apiErrorMessage } from "@/shared/api/client";
import { SeriesChart } from "@/shared/charts/series-chart";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber } from "@/shared/lib/format";
import { useChartHex } from "@/shared/state/palette-store";
import type { CoilExhibitRequest } from "@/shared/types";
import { SliderField } from "@/shared/ui/slider-field";
import { Figures, WidgetCard } from "@/shared/ui/widget";
import { BUTTON_HUE, CoilTrack, Meter } from "./coil-track";
import { PreviewPending, type PreviewMode, type PreviewProps } from "./preview-mode";
import { Equation } from "./equation";
import { ExhibitFrame } from "./exhibit-frame";
import {
  RESISTANCE_FADE_M_S,
  STEP_S,
  frame,
  pressOf,
  start,
  timingCurve,
  topHeight,
  type CoilExhibit,
  type CoilSim,
  type Press,
  type PressRule,
} from "./simulate/coil";
import { useCoilAnalysis, useExperimentsDefaults } from "./use-experiments";

/** The auto mode's rule: perfect timing. Plus from the foot of one ramp to
 *  the middle, minus from the middle to the foot of the other — switched
 *  exactly as the car passes the middle, which the timing curve shows is best,
 *  and over the whole flat, because a pull that starts further out gains more
 *  (the engine: 13.0 mJ a pass against 11.4 for a window of 6 cm). */
function perfectRule(ex: CoilExhibit): PressRule {
  return { kind: "rule", window_m: ex.track.flat_length_m / 2, late_s: 0, reversed: false };
}
/** The second meter's range: the default build draws about 0.1 A, and a
 *  build the sliders allow up to a few times that. */
const BUTTON_METER_RANGE_A = 1;

/** The keys that work as the two buttons. */
const PLUS_KEYS = new Set(["+", "ArrowLeft"]);
const MINUS_KEYS = new Set(["-", "−", "ArrowRight"]);

/** How much slower than life the reader may run it: the car takes about fifty
 *  milliseconds between the two moments to press, which is the game at full
 *  speed and a lesson at a tenth. */
const SPEEDS = [1, 0.25, 0.1] as const;
/** The default build's turns and resistance: the turns slider keeps the wire,
 *  so the resistance grows with them. */
const OHMS_PER_TURN = 94 / 1600;
/** The lateness the timing chart is drawn over, seconds. */
const LATES = Array.from({ length: 25 }, (_, j) => -0.05 + j * 0.005);

/** What the page draws from the running simulation, a frame at a time. */
interface View {
  t: number;
  x: number;
  i: number;
  press: Press;
  lastPeak: number | null;
  tops: number;
}

function viewOf(sim: CoilSim, press: Press): View {
  return {
    t: sim.n * STEP_S,
    x: sim.y[0],
    i: sim.y[2],
    press,
    lastPeak: sim.peaks.length > 0 ? sim.peaks[sim.peaks.length - 1] : null,
    tops: sim.tops,
  };
}

/**
 * The magnet car and the coil (`experiments.coil`): two buttons, a meter, and
 * a car to pump up two ramps. The run is the engine's loop ported to the
 * browser (`simulate/coil.ts`, held to the engine by `simulate.test.ts`),
 * stepped as many times per animation frame as the time that passed asks —
 * at the engine's own step, so what the reader plays is what the engine
 * computes. The figures and the curves are the server's, for the build the
 * sliders describe.
 */
export function CoilPage() {
  const { t } = useTranslation();
  const defaults = useExperimentsDefaults();
  const [build, setBuild] = useState<CoilExhibitRequest | null>(null);
  const exhibit = build ?? defaults.data?.coil ?? null;
  const analysis = useCoilAnalysis(exhibit);

  return (
    <ExhibitFrame
      exhibit="coil"
      atTheExhibit={
        <>
          <p>{t("experiments.coil.at.track")}</p>
          <p>{t("experiments.coil.at.buttons")}</p>
        </>
      }
      whatHappens={<CoilModel exhibit={exhibit} analysis={analysis.data ?? null} />}
      computed={<CoilComputed />}
      sweetSpot={<CoilTrick exhibit={exhibit} analysis={analysis.data ?? null} />}
    >
      {defaults.isPending ? (
        <LoadingState className="py-10" label={t("common.loading")} />
      ) : !exhibit ? (
        <AlertBanner tone="danger">{apiErrorMessage(defaults.error, t("experiments.failed"))}</AlertBanner>
      ) : (
        <>
          {/* A changed build starts the car again: keyed on the build. */}
          <CoilPlay key={JSON.stringify(exhibit)} exhibit={exhibit} meterRangeA={defaults.data?.meter_range_a ?? 0.1} />
          <CoilBuild exhibit={exhibit} onChange={setBuild} />
        </>
      )}
    </ExhibitFrame>
  );
}

/** The exhibit's auto mode alone, for the overview's previews
 *  (`preview-mode.tsx`): the rule pressing at the right moments, the car
 *  climbing higher with every pass. */
export function CoilPreview({ paused }: PreviewProps) {
  const defaults = useExperimentsDefaults();
  const exhibit = defaults.data?.coil;
  return exhibit ? (
    <CoilPlay exhibit={exhibit} meterRangeA={defaults.data?.meter_range_a ?? 0.1} preview paused={paused} />
  ) : (
    <PreviewPending />
  );
}

function CoilPlay({
  exhibit,
  meterRangeA,
  preview = false,
  paused = false,
}: { exhibit: CoilExhibitRequest; meterRangeA: number } & PreviewMode) {
  const { t } = useTranslation();
  const locale = useLocale();
  const ex = exhibit as CoilExhibit;
  const sim = useRef<CoilSim | null>(null);
  if (sim.current === null) sim.current = start(ex);
  const held = useRef<Press>(0);
  const [view, setView] = useState<View>(() => viewOf(start(ex), 0));
  const [runningHere, setRunning] = useState(true);
  const running = preview ? !paused : runningHere;
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [autopilot, setAutopilot] = useState(preview);
  const [pressed, setPressed] = useState<Press>(0);

  // The loop: as many engine steps per animation frame as the time that
  // passed asks for, at the chosen speed, each with the button as it is held
  // (or as the rule would press). A frame that took long — a background tab —
  // counts as at most a twentieth of a second, so the car never jumps.
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const rule = perfectRule(ex);
    const tick = (now: number) => {
      const current = sim.current;
      if (!current) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const steps = Math.round((dt * speed) / STEP_S);
      let press: Press = 0;
      for (let k = 0; k < steps; k++) {
        press = autopilot
          ? pressOf(rule, current.n * STEP_S, current.y[0], current.y[1], current.crossedAt)
          : held.current;
        frame(ex, current, press);
      }
      setView(viewOf(current, press));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, speed, autopilot, ex]);

  const hold = (press: Press) => {
    held.current = press;
    setPressed(press);
  };

  // The keyboard as the two buttons, for a desktop where a mouse cannot jump
  // between them in fifty milliseconds: + or ← for plus (the left button), −
  // or → for minus (the right one), held as long as the key is — and not
  // while typing into a field, nor while the rule presses, nor in a preview,
  // where the keys belong to the page the preview stands on.
  useEffect(() => {
    if (autopilot || preview) return;
    const typing = (e: globalThis.KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
    };
    const pressFor = (key: string): Press => (PLUS_KEYS.has(key) ? 1 : MINUS_KEYS.has(key) ? -1 : 0);
    const down = (e: globalThis.KeyboardEvent) => {
      const press = pressFor(e.key);
      if (press === 0 || typing(e)) return;
      e.preventDefault();
      if (e.repeat) return;
      held.current = press;
      setPressed(press);
    };
    const up = (e: globalThis.KeyboardEvent) => {
      const press = pressFor(e.key);
      if (press !== 0 && held.current === press) {
        held.current = 0;
        setPressed(0);
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [autopilot, preview]);
  const restart = () => {
    sim.current = start(ex);
    hold(0);
    setView(viewOf(sim.current, 0));
  };
  const top = topHeight(ex.track);
  const shownPress = autopilot ? view.press : pressed;

  if (preview) return <CoilTrack exhibit={exhibit} x={view.x} press={shownPress} />;
  return (
    <WidgetCard
      title={t("experiments.coil.play.title")}
      hint={t("experiments.coil.play.hint")}
      actions={
        <>
          <Button variant="secondary" size="sm" onClick={() => setRunning(!running)}>
            {running ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
            {running ? t("experiments.coil.play.pause") : t("experiments.coil.play.run")}
          </Button>
          <Button variant="secondary" size="sm" onClick={restart}>
            <RotateCcw className="size-4" aria-hidden />
            {t("experiments.coil.play.restart")}
          </Button>
        </>
      }
    >
      {/* Who presses comes first, above the track, as on the sphere's page:
          under the readings it went unnoticed, and with it the perfect timing
          the auto mode offers. */}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <Switch
          label={t("experiments.coil.play.autopilot")}
          description={t("experiments.coil.play.autopilot_hint", {
            window: formatNumber((ex.track.flat_length_m / 2) * 100, 0, locale),
          })}
          checked={autopilot}
          onCheckedChange={(on) => {
            setAutopilot(on);
            hold(0);
          }}
        />
        <ToggleGroup
          label={t("experiments.coil.play.speed")}
          labelPlacement="above"
          size="sm"
          value={String(speed)}
          onChange={(v: string) => setSpeed(Number(v) as (typeof SPEEDS)[number])}
          options={SPEEDS.map((s) => ({
            value: String(s),
            label: t(`experiments.coil.play.speeds.${String(s).replace(".", "_")}`),
          }))}
        />
      </div>
      <CoilTrack exhibit={exhibit} x={view.x} press={shownPress} />
      {/* Left and right at every width, as at the exhibit: one hand, one button. */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
        <ExhibitButton
          sign={1}
          active={shownPress === 1}
          disabled={autopilot}
          label={t("experiments.coil.play.plus")}
          caption={t("experiments.coil.play.plus_caption")}
          onHold={hold}
        />
        <div className="flex flex-col items-center gap-1">
          {/* What the car induces only: a button switches the coil from the
              meter to the battery, so the meter reads zero while one is held
              (at the exhibit, too, nothing shows while a button is pressed). */}
          <Meter currentA={view.press === 0 ? view.i : 0} rangeA={meterRangeA} />
          <span className="text-caption text-muted">{t("experiments.coil.meter.caption")}</span>
          {/* The page's second meter, which the exhibit does not have: the
              current the buttons drive, while one is held — so one meter
              shows what the car induces and the other what the pushing does. */}
          <Meter
            currentA={view.press === 0 ? 0 : view.i}
            rangeA={BUTTON_METER_RANGE_A}
            label={t("experiments.coil.meter.buttons_label")}
          />
          <span className="text-caption text-muted">{t("experiments.coil.meter.buttons_caption")}</span>
        </div>
        <ExhibitButton
          sign={-1}
          active={shownPress === -1}
          disabled={autopilot}
          label={t("experiments.coil.play.minus")}
          caption={t("experiments.coil.play.minus_caption")}
          onHold={hold}
        />
      </div>
      {!autopilot && <p className="text-center text-caption text-muted">{t("experiments.coil.play.keys")}</p>}
      <Figures
        tiles={[
          {
            key: "peak",
            label: t("experiments.coil.play.last_peak"),
            value: view.lastPeak === null ? null : view.lastPeak * 1000,
            digits: 0,
            unit: "mm",
          },
          { key: "top", label: t("experiments.coil.play.goal"), value: top * 1000, digits: 0, unit: "mm" },
          {
            key: "tops",
            label: t("experiments.coil.play.tops"),
            value: view.tops,
            digits: 0,
            tone: view.tops > 0 ? "success" : "neutral",
          },
          { key: "time", label: t("experiments.coil.play.time"), value: view.t, digits: 1, unit: "s" },
        ]}
      />
    </WidgetCard>
  );
}

/** One of the exhibit's two buttons: held, not clicked — pressed while the
 *  pointer or the key is down. */
function ExhibitButton({
  sign,
  active,
  disabled,
  label,
  caption,
  onHold,
}: {
  sign: 1 | -1;
  active: boolean;
  disabled: boolean;
  label: string;
  caption: string;
  onHold: (press: Press) => void;
}) {
  const hex = useChartHex();
  const colour = hex[BUTTON_HUE[sign] % hex.length];
  return (
    <div className="flex flex-col items-center gap-1">
      <Button
        variant="secondary"
        disabled={disabled}
        aria-label={label}
        aria-pressed={active}
        className="h-20 w-full max-w-48 touch-none text-4xl font-semibold select-none"
        style={{ borderColor: colour, color: colour, backgroundColor: active ? `${colour}33` : undefined }}
        onPointerDown={(e) => {
          // Kept while held, even if the finger slides off. Not every
          // pointer has capture (jsdom has none), so only where it exists.
          e.currentTarget.setPointerCapture?.(e.pointerId);
          onHold(sign);
        }}
        onPointerUp={() => onHold(0)}
        onPointerCancel={() => onHold(0)}
        onContextMenu={(e) => e.preventDefault()}
        // Held from a keyboard too: down on Space or Enter, up on release.
        onKeyDown={(e: KeyboardEvent) => {
          if ((e.key === " " || e.key === "Enter") && !e.repeat) {
            e.preventDefault();
            onHold(sign);
          }
        }}
        onKeyUp={(e: KeyboardEvent) => {
          if (e.key === " " || e.key === "Enter") onHold(0);
        }}
      >
        {sign === 1 ? "+" : "−"}
      </Button>
      <span className="text-caption text-muted">{caption}</span>
    </div>
  );
}

/** The sliders: a few of the exhibit's numbers, the rest as built. */
function CoilBuild({
  exhibit,
  onChange,
}: {
  exhibit: CoilExhibitRequest;
  onChange: (next: CoilExhibitRequest) => void;
}) {
  const { t } = useTranslation();
  return (
    <WidgetCard title={t("experiments.coil.change.title")} hint={t("experiments.coil.change.hint")}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SliderField
          label={t("experiments.coil.change.supply")}
          unit="V"
          value={exhibit.supply_v}
          min={1.5}
          max={12}
          step={0.5}
          digits={1}
          onChange={(v) => onChange({ ...exhibit, supply_v: v })}
        />
        <SliderField
          label={t("experiments.coil.change.turns")}
          unit=""
          value={exhibit.coil.turns}
          min={200}
          max={3200}
          step={100}
          digits={0}
          hint={t("experiments.coil.change.turns_hint")}
          onChange={(v) =>
            onChange({
              ...exhibit,
              coil: { ...exhibit.coil, turns: Math.round(v), resistance_ohm: Math.round(v) * OHMS_PER_TURN },
            })
          }
        />
        <SliderField
          label={t("experiments.coil.change.mass")}
          unit="g"
          value={exhibit.track.car_mass_kg * 1000}
          min={50}
          max={500}
          step={10}
          digits={0}
          onChange={(v) => onChange({ ...exhibit, track: { ...exhibit.track, car_mass_kg: v / 1000 } })}
        />
        <SliderField
          label={t("experiments.coil.change.radius")}
          unit="m"
          value={exhibit.track.ramp_radius_m}
          min={0.4}
          max={2}
          step={0.05}
          digits={2}
          hint={t("experiments.coil.change.radius_hint")}
          onChange={(v) => onChange({ ...exhibit, track: { ...exhibit.track, ramp_radius_m: v } })}
        />
        <SliderField
          label={t("experiments.coil.change.rolling")}
          unit=""
          value={exhibit.track.rolling_resistance}
          min={0}
          max={0.03}
          step={0.001}
          digits={3}
          onChange={(v) => onChange({ ...exhibit, track: { ...exhibit.track, rolling_resistance: v } })}
        />
        <Switch
          label={t("experiments.coil.change.closed")}
          description={t("experiments.coil.change.closed_hint")}
          checked={exhibit.idle === "closed"}
          onCheckedChange={(on) => onChange({ ...exhibit, idle: on ? "closed" : "open" })}
        />
      </div>
    </WidgetCard>
  );
}

type Analysis = NonNullable<ReturnType<typeof useCoilAnalysis>["data"]>;

/** What happens, equation by equation, each with its words and its symbols. */
function CoilModel({ exhibit, analysis }: { exhibit: CoilExhibitRequest | null; analysis: Analysis | null }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  const s = (key: string) => t(`experiments.coil.symbols.${key}`);
  const rows = useMemo(
    () =>
      analysis
        ? analysis.curve.x_m.map((x, j) => ({
            x: x * 1000,
            psi: analysis.curve.flux_wb[j] * 1000,
            k: analysis.curve.coupling_v_s_per_m[j],
          }))
        : [],
    [analysis],
  );
  return (
    <>
      <p>{t("experiments.coil.model.flux_intro")}</p>
      <Equation
        tex={String.raw`\Psi(x) = \frac{\mu_0\, m\, N}{2\,l}\left[\frac{x + l/2}{\sqrt{a^2 + (x + l/2)^2}} - \frac{x - l/2}{\sqrt{a^2 + (x - l/2)^2}}\right]`}
        reads={t("experiments.coil.model.flux")}
        symbols={[
          { tex: String.raw`\Psi`, meaning: s("psi"), unit: "Wb = V·s" },
          { tex: "x", meaning: s("x"), unit: "m" },
          { tex: String.raw`\mu_0`, meaning: s("mu0"), unit: "V·s/(A·m)" },
          { tex: "m", meaning: s("moment"), unit: "A·m²" },
          { tex: "N", meaning: s("turns") },
          { tex: "l", meaning: s("length"), unit: "m" },
          { tex: "a", meaning: s("radius"), unit: "m" },
        ]}
      />
      <Equation
        tex={String.raw`k(x) = \frac{d\Psi}{dx}`}
        reads={t("experiments.coil.model.coupling")}
        symbols={[{ tex: "k", meaning: s("k"), unit: "V·s/m = N/A" }]}
      />
      {analysis && exhibit && (
        <SeriesChart
          rows={rows}
          series={[
            { key: "psi", label: s("psi"), color: hex[2 % hex.length], axis: "psi" },
            { key: "k", label: s("k"), color: hex[3 % hex.length], axis: "k" },
          ]}
          axes={[
            { id: "psi", title: `Ψ (mWb)`, orientation: "left", format: (v) => formatNumber(v, 0, locale) },
            { id: "k", title: `k (V·s/m)`, orientation: "right", format: (v) => formatNumber(v, 1, locale) },
          ]}
          x={{ key: "x", title: `${s("x")} (mm)`, format: (v) => formatNumber(v, 0, locale) }}
          references={[{ axis: "k", value: 0, tone: "muted" as const, dash: 1 }]}
        />
      )}
      <Equation
        tex={String.raw`e = k(x)\, v`}
        reads={t("experiments.coil.model.induced")}
        symbols={[
          { tex: "e", meaning: s("e"), unit: "V" },
          { tex: "v", meaning: s("v"), unit: "m/s" },
        ]}
      />
      <Equation
        tex={String.raw`F = k(x)\, i`}
        reads={t("experiments.coil.model.force")}
        symbols={[
          { tex: "F", meaning: s("force"), unit: "N" },
          { tex: "i", meaning: s("i"), unit: "A" },
        ]}
      />
      <Equation
        tex={String.raw`L\,\frac{di}{dt} = u - R\, i - k(x)\, v`}
        reads={t("experiments.coil.model.circuit")}
        symbols={[
          { tex: "L", meaning: s("inductance"), unit: "H = V·s/A" },
          { tex: "u", meaning: s("u"), unit: "V" },
          { tex: "R", meaning: s("resistance"), unit: "Ω" },
        ]}
      />
      <Equation
        tex={String.raw`m_c\,\frac{dv}{dt} = k(x)\, i - m_c\, g \sin\alpha - c_r\, m_c \left(g \cos\alpha + \frac{v^2}{R_r}\right), \qquad \alpha = \frac{s}{R_r}`}
        reads={t("experiments.coil.model.motion")}
        symbols={[
          { tex: "m_c", meaning: s("mass"), unit: "kg" },
          { tex: "g", meaning: s("g"), unit: "m/s²" },
          { tex: String.raw`\alpha`, meaning: s("alpha"), unit: "rad" },
          { tex: "s", meaning: s("arc"), unit: "m" },
          { tex: "R_r", meaning: s("ramp_radius"), unit: "m" },
          { tex: "c_r", meaning: s("rolling") },
        ]}
      />
      <p>{t("experiments.coil.model.energy")}</p>
    </>
  );
}

/** The trick: the coil is fast and the hand is slow — the timing curve the
 *  port computes for this build, and the figures that bound the game. */
function CoilTrick({ exhibit, analysis }: { exhibit: CoilExhibitRequest | null; analysis: Analysis | null }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  const s = (key: string) => t(`experiments.coil.symbols.${key}`);
  const fig = analysis?.figures ?? null;
  const speed = fig?.speed_for_top_m_s ?? null;
  const timing = useMemo(() => {
    if (!exhibit || speed === null) return [];
    return timingCurve(exhibit as CoilExhibit, speed, LATES).map((p) => ({
      late: p.late_s * 1000,
      gain: p.gain_j * 1000,
    }));
  }, [exhibit, speed]);
  if (!fig) return <LoadingState className="py-6" label={t("common.loading")} />;
  const ms = (seconds: number, digits: number) => formatNumber(seconds * 1000, digits, locale);
  return (
    <>
      <p>
        {t("experiments.coil.sweet.timing", { tau: ms(fig.time_constant_s, 1), between: ms(fig.between_peaks_s, 0) })}
      </p>
      <Equation
        tex={String.raw`\tau = \frac{L}{R}`}
        reads={t("experiments.coil.sweet.tau")}
        symbols={[{ tex: String.raw`\tau`, meaning: s("tau"), unit: "s" }]}
      />
      {timing.length > 0 && (
        <SeriesChart
          rows={timing}
          series={[{ key: "gain", label: t("experiments.coil.sweet.gain"), color: hex[2 % hex.length] }]}
          axes={[
            {
              id: "y",
              title: `${t("experiments.coil.sweet.gain")} (mJ)`,
              format: (v) => formatNumber(v, 0, locale),
            },
          ]}
          x={{
            key: "late",
            title: `${t("experiments.coil.sweet.late")} (ms)`,
            format: (v) => formatNumber(v, 0, locale),
          }}
          references={[
            { axis: "y", value: 0, tone: "muted" as const, dash: 1 },
            { axis: "x", value: 0, tone: "muted" as const, dash: 1 },
          ]}
        />
      )}
      <p>{t("experiments.coil.sweet.reading")}</p>
      <Equation
        tex={String.raw`\Delta E_{\max} = 2\, I\, \Psi(0), \qquad I = \frac{U}{R}`}
        reads={t("experiments.coil.sweet.gain_bound")}
        symbols={[
          { tex: String.raw`\Delta E_{\max}`, meaning: s("gain"), unit: "J" },
          { tex: "I", meaning: s("full_current"), unit: "A" },
          { tex: "U", meaning: s("supply"), unit: "V" },
        ]}
      />
      <Equation
        tex={String.raw`v_{\max} = \frac{U}{k_{\max}}`}
        reads={t("experiments.coil.sweet.top_speed")}
        symbols={[{ tex: String.raw`v_{\max}`, meaning: s("top_speed"), unit: "m/s" }]}
      />
      <Figures
        tiles={[
          {
            key: "tau",
            label: t("experiments.coil.figures.tau"),
            value: fig.time_constant_s * 1000,
            digits: 1,
            unit: "ms",
          },
          {
            key: "between",
            label: t("experiments.coil.figures.between"),
            value: fig.between_peaks_s * 1000,
            digits: 0,
            unit: "ms",
          },
          {
            key: "current",
            label: t("experiments.coil.figures.current"),
            value: fig.full_current_a * 1000,
            digits: 0,
            unit: "mA",
          },
          {
            key: "coasting",
            label: t("experiments.coil.figures.coasting"),
            value: fig.coasting_current_a * 1000,
            digits: 0,
            unit: "mA",
          },
          {
            key: "gain",
            label: t("experiments.coil.figures.gain"),
            value: fig.ideal_gain_per_pass_j * 1000,
            digits: 0,
            unit: "mJ",
          },
          {
            key: "speed",
            label: t("experiments.coil.figures.speed"),
            value: fig.speed_for_top_m_s,
            digits: 2,
            unit: "m/s",
          },
          { key: "vmax", label: t("experiments.coil.figures.vmax"), value: fig.top_speed_m_s, digits: 1, unit: "m/s" },
        ]}
      />
    </>
  );
}

/** How the engine computes the car: the three equations as one system, and
 *  the steps that solve it — the same steps the page runs. */
function CoilComputed() {
  const { t } = useTranslation();
  const locale = useLocale();
  const c = (key: string, values?: Record<string, string>) => t(`experiments.coil.computed.${key}`, values);
  return (
    <>
      <Equation
        tex={String.raw`\begin{aligned} \dot x &= v \\ m_c\,\dot v &= k(x)\,i - m_c\,g\sin\alpha(x) - c_r\,m_c\left(g\cos\alpha(x) + \kappa(x)\,v^2\right)\frac{v}{\sqrt{v^2 + v_s^2}} \\ L\,\frac{di}{dt} &= u - R\,i - k(x)\,v \end{aligned}`}
        reads={c("system", {
          step: formatNumber(STEP_S * 1000, 1, locale),
          steps: formatNumber(1 / STEP_S, 0, locale),
        })}
        symbols={[
          { tex: String.raw`\dot x,\ \dot v`, meaning: c("dot") },
          { tex: String.raw`\alpha(x)`, meaning: c("alpha") },
          { tex: String.raw`\kappa(x)`, meaning: c("kappa"), unit: "1/m" },
          {
            tex: "v_s",
            meaning: c("fade", { fade: formatNumber(RESISTANCE_FADE_M_S * 1000, 0, locale) }),
            unit: "m/s",
          },
        ]}
      />
      <p>{c("circuit")}</p>
    </>
  );
}
