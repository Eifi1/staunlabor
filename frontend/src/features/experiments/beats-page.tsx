import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Hammer } from "lucide-react";
import { Button, LoadingState, Switch } from "@eifi1/ui-kit";
import { SeriesChart } from "@/shared/charts/series-chart";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber } from "@/shared/lib/format";
import { useTones } from "@/shared/lib/use-tones";
import { useChartHex } from "@/shared/state/palette-store";
import { SliderField } from "@/shared/ui/slider-field";
import { Figures, WidgetCard } from "@/shared/ui/widget";
import { Equation } from "./equation";
import { ExhibitFrame } from "./exhibit-frame";
import { BuildPending } from "./build-pending";
import { PreviewPending, type PreviewMode, type PreviewProps } from "./preview-mode";
import { figures, frequencyHz, loudness, sound, type Fork, type Rider } from "./simulate/beats";
import { SIDE } from "./stage";
import { useExperimentsDefaults } from "./use-experiments";

/** The forks' drawing: their stems' feet, the prongs' length and gap, the slow-motion strip under them. */
const FORKS = { width: 400, height: 250, base: 156, prong: 100, gap: 22, left: 110, right: 290, strip: 204 } as const;
/** The slow-motion strip shows this much of the sound around now, s: a few of the fork's swings. */
const SLOW_S = 0.012;
/** The loudness's drawing spans this long after the strike, s. */
const SPAN_S = 10;
const LOUD = { width: 400, height: 110, left: 30, right: 390, top: 10, bottom: 90 } as const;
/** Below this the forks are said to be silent and the clock stops. */
const SILENT = 1e-3;
/** The preview strikes again after this long, s. */
const PREVIEW_STRIKE_S = 9;
const SUM_HUE = 0;
const ONE_HUE = 2;
const RIDER_HUE = 3;
const TRICK_GRAMS = [0.5, 1, 2];
const TRICK_HUES = [2, 0, 4];
const CHART_POINTS = 201;

/**
 * Beats (`experiments.beats`): two tuning forks, one detuned by a rider on
 * its prongs, struck together; their sum swells and fades, heard if the
 * reader turns the sound on. From the browser port (`simulate/beats.ts`, held
 * to the engine by `simulate.test.ts`). No route.
 */
export function BeatsPage() {
  const { t } = useTranslation();
  const defaults = useExperimentsDefaults();
  const data = defaults.data?.beats;
  const [built, setRider] = useState<Rider | null>(null);
  const fork = data?.fork ?? null;
  const rider = built ?? data?.rider ?? null;
  return (
    <ExhibitFrame
      exhibit="beats"
      atTheExhibit={
        <>
          <p>{t("experiments.beats.at.forks")}</p>
          <p>{t("experiments.beats.at.swell")}</p>
          <p>{t("experiments.beats.at.rider")}</p>
        </>
      }
      whatHappens={<BeatsModel />}
      computed={<BeatsComputed />}
      sweetSpot={fork ? <BeatsTrick fork={fork} /> : <LoadingState className="py-6" label={t("common.loading")} />}
    >
      {defaults.isPending || !fork || !rider ? (
        <BuildPending pending={defaults.isPending} error={defaults.error} />
      ) : (
        <>
          <BeatsPlay fork={fork} rider={rider} />
          <BeatsBuild fork={fork} rider={rider} onChange={setRider} />
        </>
      )}
    </ExhibitFrame>
  );
}

/** The forks struck again and again, the loudness swelling and fading. */
export function BeatsPreview({ paused }: PreviewProps) {
  const defaults = useExperimentsDefaults();
  const data = defaults.data?.beats;
  return data ? <BeatsPlay fork={data.fork} rider={data.rider} preview paused={paused} /> : <PreviewPending />;
}

/** One fork: its stem, its two prongs (blurred as wide as they swing), and its rider if it has one. */
function ForkShape({ x, swing, rider, ink }: { x: number; swing: number; rider: Rider | null; ink: string }) {
  const tip = FORKS.base - FORKS.prong;
  const prongs = [-1, 1].map((side) => x + (side * FORKS.gap) / 2);
  return (
    <g>
      <line x1={x} y1={FORKS.base} x2={x} y2={FORKS.base + 18} stroke="currentColor" strokeWidth={6} />
      <path
        d={`M ${prongs[0]} ${tip} L ${prongs[0]} ${FORKS.base} Q ${x} ${FORKS.base + 12} ${prongs[1]} ${FORKS.base} L ${prongs[1]} ${tip}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={6}
        strokeLinecap="round"
      />
      {/* The prongs swing outward and in together: their blur, as wide as the swing at the tip. */}
      {swing > 0.05 &&
        prongs.map((px, k) => {
          const out = (k === 0 ? -1 : 1) * swing;
          return (
            <path
              key={px}
              d={`M ${px} ${FORKS.base} Q ${px} ${tip + FORKS.prong / 3} ${px + out} ${tip}`}
              fill="none"
              stroke="currentColor"
              strokeOpacity={0.35}
              strokeWidth={6}
              strokeLinecap="round"
            />
          );
        })}
      {rider &&
        rider.mass_kg > 0 &&
        prongs.map((px) => {
          const size = 6 + 3 * rider.mass_kg * 1000;
          const y = FORKS.base - FORKS.prong * rider.position;
          return <rect key={px} x={px - size / 2} y={y - size / 2} width={size} height={size} rx={1.5} fill={ink} />;
        })}
    </g>
  );
}

/** The two forks with their pitches, and under them the sound around now, slowed down. */
function ForksView({
  fork,
  rider,
  f2,
  t,
  ringing,
}: {
  fork: Fork;
  rider: Rider;
  f2: number;
  t: number;
  ringing: boolean;
}) {
  const { t: tr } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  const amplitude = ringing ? Math.exp(-t / fork.decay_s) : 0;
  const swing = 5 * amplitude;
  const points = Array.from({ length: 241 }, (_, k) => {
    const u = (SLOW_S * k) / 240;
    const y = ringing ? sound(fork.frequency_hz, f2, fork.decay_s, t + u) : 0;
    return `${20 + (360 * k) / 240},${FORKS.strip + 22 - 20 * y}`;
  }).join(" ");
  return (
    <svg
      viewBox={`0 0 ${FORKS.width} ${FORKS.height}`}
      role="img"
      aria-label={tr("experiments.beats.view")}
      className="w-full rounded-lg border border-subtle bg-surface-2 text-muted"
    >
      <ForkShape x={FORKS.left} swing={swing} rider={null} ink={hex[RIDER_HUE % hex.length]} />
      <ForkShape x={FORKS.right} swing={swing} rider={rider} ink={hex[RIDER_HUE % hex.length]} />
      <text x={FORKS.left} y={22} fontSize={13} fill="currentColor" textAnchor="middle">
        {`${formatNumber(fork.frequency_hz, 2, locale)} Hz`}
      </text>
      <text x={FORKS.right} y={22} fontSize={13} fill="currentColor" textAnchor="middle">
        {`${formatNumber(f2, 2, locale)} Hz`}
      </text>
      <line x1={20} y1={FORKS.strip + 22} x2={380} y2={FORKS.strip + 22} stroke="currentColor" strokeOpacity={0.3} />
      <polyline points={points} fill="none" stroke={hex[SUM_HUE % hex.length]} strokeWidth={1.5} />
      <text x={20} y={FORKS.strip - 8} fontSize={11} fill="currentColor">
        {tr("experiments.beats.play.slow", { ms: formatNumber(SLOW_S * 1000, 0, locale) })}
      </text>
    </svg>
  );
}

/** The loudness since the strike, both forks together and one alone, now marked. */
function LoudnessView({ fork, f2, t, ringing }: { fork: Fork; f2: number; t: number; ringing: boolean }) {
  const { t: tr } = useTranslation();
  const hex = useChartHex();
  const x = (s: number) => LOUD.left + ((LOUD.right - LOUD.left) * s) / SPAN_S;
  const y = (v: number) => LOUD.bottom - (LOUD.bottom - LOUD.top) * v;
  const line = (f: (s: number) => number) =>
    Array.from({ length: 401 }, (_, k) => {
      const s = (SPAN_S * k) / 400;
      return `${x(s)},${y(f(s))}`;
    }).join(" ");
  const sum = line((s) => loudness(fork.frequency_hz, f2, fork.decay_s, s));
  const one = line((s) => Math.exp(-s / fork.decay_s));
  return (
    <svg
      viewBox={`0 0 ${LOUD.width} ${LOUD.height}`}
      role="img"
      aria-label={tr("experiments.beats.loudness_view")}
      className="w-full rounded-lg border border-subtle bg-surface-2 text-muted"
    >
      <line
        x1={LOUD.left}
        y1={LOUD.bottom}
        x2={LOUD.right}
        y2={LOUD.bottom}
        stroke="currentColor"
        strokeOpacity={0.4}
      />
      <polyline points={one} fill="none" stroke={hex[ONE_HUE % hex.length]} strokeDasharray="4 3" strokeWidth={1.2} />
      <polyline points={sum} fill="none" stroke={hex[SUM_HUE % hex.length]} strokeWidth={1.6} />
      {ringing && t <= SPAN_S && (
        <line x1={x(t)} y1={LOUD.top} x2={x(t)} y2={LOUD.bottom} stroke="currentColor" strokeWidth={1.5} />
      )}
      <text x={LOUD.left} y={LOUD.height - 4} fontSize={11} fill="currentColor">
        0 s
      </text>
      <text x={LOUD.right} y={LOUD.height - 4} fontSize={11} fill="currentColor" textAnchor="end">
        {`${SPAN_S} s`}
      </text>
    </svg>
  );
}

function BeatsPlay({ fork, rider, preview = false, paused = false }: { fork: Fork; rider: Rider } & PreviewMode) {
  const { t } = useTranslation();
  const locale = useLocale();
  // Each strike starts the clock again from it: counted, so a second strike in the same frame still restarts.
  const [strikes, setStrikes] = useState(preview ? 1 : 0);
  const [time, setTime] = useState(0);
  const [soundOn, setSound] = useState(false);
  const clock = useRef(0);
  const struck = useRef(0);
  const f2 = frequencyHz(fork, rider);
  const ringing = strikes > 0;
  const silentAfter = fork.decay_s * Math.log(1 / SILENT);

  useEffect(() => {
    if (strikes === 0 || (preview && paused)) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      clock.current += Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      let s = clock.current - struck.current;
      if (preview && s > PREVIEW_STRIKE_S) {
        struck.current = clock.current;
        s = 0;
      }
      setTime(s);
      if (s < silentAfter || preview) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [strikes, preview, paused, silentAfter]);

  const level = ringing && time < silentAfter ? Math.exp(-time / fork.decay_s) : 0;
  const tones = useTones(soundOn && !preview, [fork.frequency_hz, f2], [level, level]);
  const view = <ForksView fork={fork} rider={rider} f2={f2} t={time} ringing={ringing} />;
  if (preview) return view;

  const shown = figures(fork, rider);
  const strike = () => {
    struck.current = clock.current;
    setTime(0);
    setStrikes((n) => n + 1);
  };
  const now = ringing ? loudness(fork.frequency_hz, f2, fork.decay_s, time) : 0;
  return (
    <WidgetCard
      title={t("experiments.beats.play.title")}
      hint={t("experiments.beats.play.hint")}
      actions={
        <Button variant="secondary" size="sm" onClick={strike}>
          <Hammer className="size-4" aria-hidden />
          {t("experiments.beats.play.strike")}
        </Button>
      }
    >
      <div className={SIDE.grid}>
        <div className={SIDE.top}>
          <Switch
            label={t("experiments.beats.play.sound")}
            description={
              tones.available ? t("experiments.beats.play.sound_hint") : t("experiments.beats.play.no_sound")
            }
            checked={soundOn}
            disabled={!tones.available}
            onCheckedChange={setSound}
          />
        </div>
        <div className={`${SIDE.views} mx-auto w-full max-w-xl`}>
          <figure className="space-y-2">
            {view}
            <LoudnessView fork={fork} f2={f2} t={time} ringing={ringing} />
            <figcaption className="text-center text-caption text-muted">
              {t("experiments.beats.play.caption")}
            </figcaption>
          </figure>
        </div>
        <div className={SIDE.column}>
          <p className="text-sm font-medium text-primary" role="status">
            {!ringing
              ? t("experiments.beats.play.waiting")
              : time >= silentAfter
                ? t("experiments.beats.play.silent")
                : t("experiments.beats.play.ringing", {
                    time: formatNumber(time, 1, locale),
                    loud: formatNumber(now * 100, 0, locale),
                  })}
          </p>
          <Figures
            tiles={[
              {
                key: "f1",
                label: t("experiments.beats.play.f1"),
                value: fork.frequency_hz,
                digits: 2,
                unit: "Hz",
              },
              { key: "f2", label: t("experiments.beats.play.f2"), value: f2, digits: 2, unit: "Hz" },
              { key: "beat", label: t("experiments.beats.figures.beat"), value: shown.beat_hz, digits: 2, unit: "Hz" },
              {
                key: "period",
                label: t("experiments.beats.figures.period"),
                value: shown.beat_s,
                digits: 2,
                unit: "s",
              },
            ]}
          />
        </div>
      </div>
    </WidgetCard>
  );
}

function BeatsBuild({ fork, rider, onChange }: { fork: Fork; rider: Rider; onChange: (next: Rider) => void }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  const shown = useMemo(() => figures(fork, rider), [fork, rider]);
  const rows = useMemo(() => {
    const f2 = frequencyHz(fork, rider);
    return Array.from({ length: CHART_POINTS }, (_, k) => {
      const s = (SPAN_S * k) / (CHART_POINTS - 1);
      return { s, sum: loudness(fork.frequency_hz, f2, fork.decay_s, s), one: Math.exp(-s / fork.decay_s) };
    });
  }, [fork, rider]);
  return (
    <WidgetCard title={t("experiments.beats.change.title")} hint={t("experiments.beats.change.hint")}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SliderField
          label={t("experiments.beats.change.mass")}
          unit="g"
          value={rider.mass_kg * 1000}
          min={0}
          max={2}
          step={0.05}
          digits={2}
          hint={t("experiments.beats.change.mass_hint")}
          onChange={(v) => onChange({ ...rider, mass_kg: v / 1000 })}
        />
        <SliderField
          label={t("experiments.beats.change.position")}
          unit="%"
          value={rider.position * 100}
          min={0}
          max={100}
          step={1}
          digits={0}
          hint={t("experiments.beats.change.position_hint")}
          onChange={(v) => onChange({ ...rider, position: v / 100 })}
        />
      </div>
      <Figures
        tiles={[
          {
            key: "detuned",
            label: t("experiments.beats.figures.detuned"),
            value: shown.detuned_hz,
            digits: 2,
            unit: "Hz",
          },
          { key: "beat", label: t("experiments.beats.figures.beat"), value: shown.beat_hz, digits: 2, unit: "Hz" },
          { key: "period", label: t("experiments.beats.figures.period"), value: shown.beat_s, digits: 2, unit: "s" },
          { key: "cents", label: t("experiments.beats.figures.cents"), value: shown.cents, digits: 1, unit: "ct" },
          { key: "heard", label: t("experiments.beats.figures.heard"), value: shown.beats_heard, digits: 0 },
        ]}
      />
      <p className="text-sm text-secondary">{t("experiments.beats.chart.loudness_hint")}</p>
      <SeriesChart
        rows={rows}
        series={[
          { key: "sum", label: t("experiments.beats.chart.sum"), color: hex[SUM_HUE % hex.length] },
          { key: "one", label: t("experiments.beats.chart.one"), color: hex[ONE_HUE % hex.length], dashed: true },
        ]}
        axes={[
          {
            id: "y",
            title: t("experiments.beats.chart.loudness"),
            format: (v) => formatNumber(v, 1, locale),
            includeZero: true,
          },
        ]}
        x={{ key: "s", title: `${t("experiments.beats.chart.time")} (s)`, format: (v) => formatNumber(v, 0, locale) }}
      />
    </WidgetCard>
  );
}

function BeatsModel() {
  const { t } = useTranslation();
  const s = (key: string) => t(`experiments.beats.symbols.${key}`);
  return (
    <>
      <p>{t("experiments.beats.model.intro")}</p>
      <Equation
        tex={String.raw`x = \tfrac12\,e^{-t/\tau}\left(\sin 2\pi f_1 t + \sin 2\pi f_2 t\right) = e^{-t/\tau}\cos\!\big(\pi (f_1 - f_2)\,t\big)\,\sin\!\big(\pi (f_1 + f_2)\,t\big)`}
        reads={t("experiments.beats.model.sum")}
        symbols={[
          { tex: "x", meaning: s("x"), unit: "1" },
          { tex: "f_1, f_2", meaning: s("f"), unit: "Hz" },
          { tex: "t", meaning: s("t"), unit: "s" },
          { tex: String.raw`\tau`, meaning: s("tau"), unit: "s" },
        ]}
      />
      <Equation
        tex={String.raw`f_b = |f_1 - f_2|`}
        reads={t("experiments.beats.model.beat")}
        symbols={[{ tex: "f_b", meaning: s("fb"), unit: "Hz" }]}
      />
      <Equation
        tex={String.raw`f_2 = \frac{f_1}{\sqrt{1 + m\,\varphi(s)^2 / (m_z/4)}}`}
        reads={t("experiments.beats.model.rider")}
        symbols={[
          { tex: "m", meaning: s("m"), unit: "kg" },
          { tex: String.raw`\varphi(s)`, meaning: s("phi"), unit: "1" },
          { tex: "s", meaning: s("s"), unit: "1" },
          { tex: "m_z", meaning: s("mz"), unit: "kg" },
        ]}
      />
    </>
  );
}

function BeatsTrick({ fork }: { fork: Fork }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  const rows = useMemo(
    () =>
      Array.from({ length: CHART_POINTS }, (_, k) => {
        const position = k / (CHART_POINTS - 1);
        const row: Record<string, number> = { pct: position * 100 };
        TRICK_GRAMS.forEach((g) => {
          row[`g${g}`] = fork.frequency_hz - frequencyHz(fork, { mass_kg: g / 1000, position });
        });
        return row;
      }),
    [fork],
  );
  return (
    <>
      <p>{t("experiments.beats.sweet.closer")}</p>
      <p>{t("experiments.beats.sweet.tuning")}</p>
      <p>{t("experiments.beats.sweet.rider")}</p>
      <p className="text-sm text-secondary">{t("experiments.beats.chart.rider_hint")}</p>
      <SeriesChart
        rows={rows}
        series={TRICK_GRAMS.map((g, i) => ({
          key: `g${g}`,
          label: `${formatNumber(g, 1, locale)} g`,
          color: hex[TRICK_HUES[i] % hex.length],
        }))}
        axes={[
          {
            id: "y",
            title: `${t("experiments.beats.chart.beat")} (Hz)`,
            format: (v) => formatNumber(v, 0, locale),
            includeZero: true,
          },
        ]}
        x={{
          key: "pct",
          title: `${t("experiments.beats.chart.position")} (%)`,
          format: (v) => formatNumber(v, 0, locale),
        }}
      />
    </>
  );
}

function BeatsComputed() {
  const { t } = useTranslation();
  const c = (key: string) => t(`experiments.beats.computed.${key}`);
  return (
    <>
      <p>{c("system")}</p>
      <p>{c("check")}</p>
      <p>{c("left_out")}</p>
    </>
  );
}
