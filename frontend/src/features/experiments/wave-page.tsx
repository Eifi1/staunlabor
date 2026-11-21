import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pause, Play, RotateCcw } from "lucide-react";
import { AlertBanner, Button, LoadingState, ToggleGroup } from "@eifi1/ui-kit";
import { SeriesChart } from "@/shared/charts/series-chart";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber, formatPowerOfTen } from "@/shared/lib/format";
import { useChartHex } from "@/shared/state/palette-store";
import type { WaveFigures, WaveRequest } from "@/shared/types";
import { SliderField } from "@/shared/ui/slider-field";
import { Figures, WidgetCard } from "@/shared/ui/widget";
import { Equation } from "./equation";
import { ExhibitFrame } from "./exhibit-frame";
import { BuildPending } from "./build-pending";
import { PreviewPending, type PreviewMode, type PreviewProps } from "./preview-mode";
import { startsRunning } from "./play";
import { settingNumber, useCheckRequest, useCheckSetting, type CheckSetting } from "./check-setting";
import { angleDeg, swing } from "./simulate/pendulum";
import { fits, lengthsM, spreadDeg } from "./simulate/wave";
import { SIDE } from "./stage";
import { useExperimentsDefaults, useWaveFigures } from "./use-experiments";
import { WaveSideView, WaveTopView } from "./wave-views";

/** How much faster than real time the row may run: a minute's cycle in twelve
 *  seconds at the fastest, which is still slow enough to follow one bob. */
const SPEEDS = [1, 2, 5] as const;
type Speed = (typeof SPEEDS)[number];

/** The moments the reader can jump to: a half, a third, a quarter of the cycle,
 *  and the whole of it. */
const JUMPS = [2, 3, 4, 1] as const;

/** The preview runs at twice real time: a cycle of a minute shows its waves
 *  and its groups within the half minute anybody looks at the overview. */
const PREVIEW_SPEED: Speed = 2;

/**
 * The pendulum wave (`experiments.wave`): a row let go together, each pendulum
 * the exact one (`simulate/pendulum.ts`, Jacobi's functions, held to the engine
 * by `simulate.test.ts`), so the clock can run, stop or jump to any moment of
 * the cycle and the row is where the physics puts it. The lengths are tuned in
 * the browser as the engine tunes them (`simulate/wave.ts`), and the figures
 * and the skew curve are the server's.
 */
export function WavePage() {
  const { t } = useTranslation();
  const defaults = useExperimentsDefaults();
  const [build, setBuild] = useState<WaveRequest | null>(null);
  const wave = build ?? defaults.data?.wave ?? null;
  // A check case's "Set it up": the row's build here; the play, built anew for
  // it or already on it, sets the swing and the clock.
  const request = useCheckRequest("wave");
  const [seen, setSeen] = useState<number | null>(null);
  if (request && !request.done && request.nonce !== seen && wave) {
    setSeen(request.nonce);
    const next = waveOf(wave, request.setting);
    if (JSON.stringify(next) !== JSON.stringify(wave)) setBuild(next);
  }
  const fine = wave ? fits(wave) : false;
  const figures = useWaveFigures(fine ? wave : null);

  return (
    <ExhibitFrame
      exhibit="wave"
      atTheExhibit={
        <>
          <p>{t("experiments.wave.at.row")}</p>
          <p>{t("experiments.wave.at.pattern")}</p>
        </>
      }
      whatHappens={<WaveModel />}
      computed={<WaveComputed wave={wave} />}
      sweetSpot={<WaveTrick figures={fine ? (figures.data ?? null) : null} wave={wave} refused={!!wave && !fine} />}
    >
      {defaults.isPending || !wave ? (
        <BuildPending pending={defaults.isPending} error={defaults.error} />
      ) : (
        <>
          {fine ? (
            <WavePlay key={JSON.stringify({ ...wave, amplitude_deg: 0 })} wave={wave} onChange={setBuild} />
          ) : (
            <AlertBanner tone="warning">{t("experiments.wave.refused")}</AlertBanner>
          )}
          <WaveBuild wave={wave} figures={fine ? (figures.data ?? null) : null} onChange={setBuild} />
        </>
      )}
    </ExhibitFrame>
  );
}

/** The build a case names, the rest as it is. */
function waveOf(wave: WaveRequest, setting: CheckSetting): WaveRequest {
  return {
    ...wave,
    count: settingNumber(setting, "count", wave.count),
    cycle_s: settingNumber(setting, "cycle_s", wave.cycle_s),
    longest_swings: settingNumber(setting, "longest_swings", wave.longest_swings),
    tuned_deg: settingNumber(setting, "tuned_deg", wave.tuned_deg),
    amplitude_deg: settingNumber(setting, "amplitude_deg", wave.amplitude_deg),
  };
}

/** The row let go and left to run, for the overview's previews. */
export function WavePreview({ paused }: PreviewProps) {
  const defaults = useExperimentsDefaults();
  const wave = defaults.data?.wave;
  return wave ? <WavePlay wave={wave} preview paused={paused} /> : <PreviewPending />;
}

function WavePlay({
  wave,
  onChange,
  preview = false,
  paused = false,
}: { wave: WaveRequest; onChange?: (next: WaveRequest) => void } & PreviewMode) {
  const { t } = useTranslation();
  const locale = useLocale();
  const clock = useRef(0);
  const [time, setTime] = useState(0);
  const [runningHere, setRunning] = useState(startsRunning);
  const [speedHere, setSpeed] = useState<Speed>(1);
  const running = preview ? !paused : runningHere;
  const speed = preview ? PREVIEW_SPEED : speedHere;
  const lengths = useMemo(() => lengthsM(wave), [wave]);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      // A frame's timestamp can lie a little before the effect started: never a
      // step back in time.
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      clock.current += dt * speed;
      setTime(clock.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, speed]);

  const jump = (to: number) => {
    clock.current = to;
    setTime(to);
  };
  // A case's swing and clock: once the play's row is the case's (a new row
  // builds a new play), the swing as it says, and the clock where its tiles
  // are read, or the start.
  useCheckSetting("wave", (setting) => {
    if (preview) return false;
    const want = waveOf(wave, setting);
    const same = (["count", "cycle_s", "longest_swings", "tuned_deg"] as const).every((k) => want[k] === wave[k]);
    if (!same) return false;
    if (want.amplitude_deg !== wave.amplitude_deg) onChange?.(want);
    const at = settingNumber(setting, "time_s", 0);
    jump(at);
    setRunning(at === 0);
    return true;
  });
  // The swing as the reader pulls the row aside, before it is let go.
  const [draft, setDraft] = useState<number | null>(null);
  const amplitude = draft ?? wave.amplitude_deg;

  const angles = lengths.map((length) => angleDeg(length, amplitude, time));
  const reach = Math.max(amplitude, 15);
  const top = <WaveTopView lengthsM={lengths} anglesDeg={angles} spacingM={wave.spacing_m} reachDeg={reach} />;
  if (preview) return top;

  const cycles = time / wave.cycle_s;
  return (
    <WidgetCard
      title={t("experiments.wave.play.title")}
      hint={t("experiments.wave.play.hint")}
      actions={
        <>
          <Button variant="secondary" size="sm" onClick={() => setRunning(!running)}>
            {running ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
            {running ? t("experiments.wave.play.pause") : t("experiments.wave.play.run")}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => jump(0)}>
            <RotateCcw className="size-4" aria-hidden />
            {t("experiments.wave.play.restart")}
          </Button>
        </>
      }
    >
      <div className={SIDE.grid}>
        <div className={SIDE.top}>
          <ToggleGroup
            label={t("experiments.wave.play.speed")}
            labelPlacement="above"
            size="sm"
            overflow="wrap"
            value={String(speed)}
            onChange={(v: string) => setSpeed(Number(v) as Speed)}
            options={SPEEDS.map((s) => ({ value: String(s), label: t(`experiments.wave.play.speeds.${s}`) }))}
          />
        </div>
        <div className={SIDE.views}>
          <figure className="space-y-1">
            {top}
            <figcaption className="text-center text-caption text-muted">
              {t("experiments.wave.views.top_caption")}
            </figcaption>
          </figure>
          <figure className="mx-auto max-w-sm space-y-1">
            <WaveSideView
              lengthsM={lengths}
              anglesDeg={angles}
              reachDeg={reach}
              onPull={(deg) => {
                setRunning(false);
                jump(0);
                setDraft(deg);
              }}
              onLetGo={(deg) => {
                setDraft(null);
                onChange?.({ ...wave, amplitude_deg: deg });
                jump(0);
                setRunning(true);
              }}
            />
            <figcaption className="text-center text-caption text-muted">
              {t("experiments.wave.views.side_caption")}
            </figcaption>
            <p className="text-sm text-secondary">{t("experiments.wave.play.pull_hint")}</p>
          </figure>
        </div>
        <div className={SIDE.column}>
          <div className="space-y-2">
            <p className="text-sm text-secondary">{t("experiments.wave.play.jump")}</p>
            <div className="flex flex-wrap gap-2">
              {JUMPS.map((k) => (
                <Button
                  key={k}
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setRunning(false);
                    jump(wave.cycle_s / k);
                  }}
                >
                  {t(`experiments.wave.play.jumps.${k}`)}
                </Button>
              ))}
            </div>
          </div>
          <SliderField
            label={t("experiments.wave.play.amplitude")}
            unit="°"
            value={amplitude}
            min={1}
            max={45}
            step={1}
            digits={0}
            hint={t("experiments.wave.play.amplitude_hint", {
              tuned: formatNumber(wave.tuned_deg, 0, locale),
            })}
            onChange={(v) => onChange?.({ ...wave, amplitude_deg: v })}
          />
          <Figures
            tiles={[
              { key: "time", label: t("experiments.wave.play.time"), value: time, digits: 1, unit: "s" },
              {
                key: "cycles",
                label: t("experiments.wave.play.cycles"),
                value: cycles,
                digits: 2,
                unit: "Γ",
              },
              {
                key: "spread",
                label: t("experiments.wave.play.spread"),
                value: spreadDeg(wave),
                digits: 0,
                unit: "°",
              },
            ]}
          />
        </div>
      </div>
    </WidgetCard>
  );
}

function WaveBuild({
  wave,
  figures,
  onChange,
}: {
  wave: WaveRequest;
  figures: WaveFigures | null;
  onChange: (next: WaveRequest) => void;
}) {
  const { t } = useTranslation();
  const lengths = lengthsM(wave);
  return (
    <WidgetCard title={t("experiments.wave.change.title")} hint={t("experiments.wave.change.hint")}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SliderField
          label={t("experiments.wave.change.count")}
          unit=""
          value={wave.count}
          min={5}
          max={24}
          step={1}
          digits={0}
          onChange={(v) => onChange({ ...wave, count: v })}
        />
        <SliderField
          label={t("experiments.wave.change.cycle")}
          unit="s"
          value={wave.cycle_s}
          min={30}
          max={120}
          step={5}
          digits={0}
          hint={t("experiments.wave.change.cycle_hint")}
          onChange={(v) => onChange({ ...wave, cycle_s: v })}
        />
        <SliderField
          label={t("experiments.wave.change.swings")}
          unit=""
          value={wave.longest_swings}
          min={20}
          max={80}
          step={1}
          digits={0}
          hint={t("experiments.wave.change.swings_hint")}
          onChange={(v) => onChange({ ...wave, longest_swings: v })}
        />
        <SliderField
          label={t("experiments.wave.change.tuned")}
          unit="°"
          value={wave.tuned_deg}
          min={0}
          max={40}
          step={1}
          digits={0}
          hint={t("experiments.wave.change.tuned_hint")}
          onChange={(v) => onChange({ ...wave, tuned_deg: v })}
        />
      </div>
      <Figures
        tiles={[
          {
            key: "longest",
            label: t("experiments.wave.figures.longest"),
            value: (figures?.longest_m ?? lengths[0]) * 100,
            digits: 1,
            unit: "cm",
          },
          {
            key: "shortest",
            label: t("experiments.wave.figures.shortest"),
            value: (figures?.shortest_m ?? lengths[lengths.length - 1]) * 100,
            digits: 1,
            unit: "cm",
          },
          {
            key: "period",
            label: t("experiments.wave.figures.period"),
            value: wave.cycle_s / wave.longest_swings,
            digits: 3,
            unit: "s",
          },
        ]}
      />
    </WidgetCard>
  );
}

function WaveModel() {
  const { t } = useTranslation();
  const s = (key: string) => t(`experiments.wave.symbols.${key}`);
  return (
    <>
      <p>{t("experiments.wave.model.intro")}</p>
      <Equation
        tex={String.raw`T_0 = 2\pi\,\sqrt{\frac{L}{g}}`}
        reads={t("experiments.wave.model.period")}
        symbols={[
          { tex: "T_0", meaning: s("t0"), unit: "s" },
          { tex: "L", meaning: s("length"), unit: "m" },
          { tex: "g", meaning: s("g"), unit: "m/s²" },
        ]}
      />
      <Equation
        tex={String.raw`T_n = \frac{\Gamma}{N + n}`}
        reads={t("experiments.wave.model.tuning")}
        symbols={[
          { tex: "T_n", meaning: s("tn"), unit: "s" },
          { tex: String.raw`\Gamma`, meaning: s("cycle"), unit: "s" },
          { tex: "N", meaning: s("swings") },
          { tex: "n", meaning: s("index") },
        ]}
      />
      <Equation
        tex={String.raw`t = \frac{\Gamma}{k}: \quad \frac{N + n}{k}\ \text{swings}`}
        reads={t("experiments.wave.model.groups")}
        symbols={[{ tex: "k", meaning: s("k") }]}
      />
      <Equation
        tex={String.raw`T = T_0\cdot\frac{2\,K\!\left(\sin^2\frac{\theta_0}{2}\right)}{\pi} \approx T_0\left(1 + \frac{\theta_0^2}{16}\right)`}
        reads={t("experiments.wave.model.wider")}
        symbols={[
          { tex: String.raw`\theta_0`, meaning: s("theta0"), unit: "rad" },
          { tex: "K", meaning: s("k_integral") },
        ]}
      />
    </>
  );
}

function WaveTrick({
  figures,
  wave,
  refused = false,
}: {
  figures: WaveFigures | null;
  wave: WaveRequest | null;
  refused?: boolean;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  const rows = useMemo(
    () => (figures ? figures.spread_curve.map((p) => ({ amplitude: p.amplitude_deg, spread: p.spread_deg })) : []),
    [figures],
  );
  // A row the engine refuses has no figures to wait for: say so, not "Loading".
  if (refused) return <p className="text-secondary">{t("experiments.wave.refused")}</p>;
  if (!figures || !wave) return <LoadingState className="py-6" label={t("common.loading")} />;
  return (
    <>
      <p>{t("experiments.wave.sweet.alone")}</p>
      <p>
        {t("experiments.wave.sweet.tuned", {
          tuned: formatNumber(wave.tuned_deg, 0, locale),
          textbook: formatNumber(figures.textbook_spread_deg, 0, locale),
          amplitude: formatNumber(wave.amplitude_deg, 0, locale),
        })}
      </p>
      <SeriesChart
        rows={rows}
        series={[{ key: "spread", label: t("experiments.wave.chart.spread"), color: hex[2 % hex.length] }]}
        axes={[
          {
            id: "y",
            title: `${t("experiments.wave.chart.spread")} (°)`,
            format: (v) => formatNumber(v, 0, locale),
            includeZero: true,
          },
        ]}
        x={{
          key: "amplitude",
          title: `${t("experiments.wave.chart.amplitude")} (°)`,
          format: (v) => formatNumber(v, 0, locale),
        }}
        markers={
          wave.amplitude_deg <= 40
            ? [
                {
                  x: wave.amplitude_deg,
                  y: figures.spread_deg,
                  label: t("experiments.wave.chart.you"),
                  tone: "danger" as const,
                },
              ]
            : []
        }
      />
      <Figures
        tiles={[
          {
            key: "spread",
            label: t("experiments.wave.figures.spread"),
            value: figures.spread_deg,
            digits: 0,
            unit: "°",
          },
          {
            key: "textbook",
            label: t("experiments.wave.figures.textbook"),
            value: figures.textbook_spread_deg,
            digits: 0,
            unit: "°",
          },
        ]}
      />
    </>
  );
}

/** How the engine computes the row: one equation per pendulum, solved exactly —
 *  and, as a check the reader can see, the longest one stepped beside it. */
function WaveComputed({ wave }: { wave: WaveRequest | null }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const c = (key: string) => t(`experiments.wave.computed.${key}`);
  const apart = useMemo(() => {
    if (!wave) return null;
    const length = lengthsM(wave)[0];
    const stepped = swing(length, wave.amplitude_deg, 10);
    return Math.max(
      ...stepped.t.map((time, i) => Math.abs(stepped.angle_deg[i] - angleDeg(length, wave.amplitude_deg, time))),
    );
  }, [wave]);
  return (
    <>
      <Equation
        tex={String.raw`\ddot\theta = -\frac{g}{L}\,\sin\theta, \qquad \theta(0) = \theta_0,\ \dot\theta(0) = 0`}
        reads={c("system")}
        symbols={[
          { tex: String.raw`\theta`, meaning: c("theta"), unit: "rad" },
          { tex: String.raw`\ddot\theta`, meaning: c("theta_dd"), unit: "rad/s²" },
        ]}
      />
      <Equation
        tex={String.raw`\sin\frac{\theta}{2} = k\;\mathrm{cd}\!\left(\omega_0 t \,\middle|\, k^2\right)`}
        reads={c("exact")}
        symbols={[
          { tex: String.raw`\mathrm{cd}`, meaning: c("cd") },
          { tex: String.raw`k = \sin\frac{\theta_0}{2}`, meaning: c("k") },
          { tex: String.raw`\omega_0 = \sqrt{g/L}`, meaning: c("omega0"), unit: "1/s" },
          { tex: "t", meaning: c("t"), unit: "s" },
        ]}
      />
      {apart !== null && <p>{t("experiments.wave.computed.check", { apart: formatPowerOfTen(apart, locale) })}</p>}
    </>
  );
}
