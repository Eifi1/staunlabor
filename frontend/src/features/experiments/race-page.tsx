import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Flag, Pause, Play } from "lucide-react";
import { AlertBanner, Button, LoadingState, Switch, ToggleGroup } from "@eifi1/ui-kit";
import { apiErrorMessage } from "@/shared/api/client";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber } from "@/shared/lib/format";
import type { CurveKind, RaceAnalysis, RaceBall, RaceRequest } from "@/shared/types";
import { SliderField } from "@/shared/ui/slider-field";
import { Figures, WidgetCard } from "@/shared/ui/widget";
import { Equation } from "./equation";
import { ExhibitFrame } from "./exhibit-frame";
import { MotionTable, VectorPlane, niceSpan } from "./race-motion";
import { PreviewPending, type PreviewMode, type PreviewProps } from "./preview-mode";
import { RaceView, ValleyView, ballState, pitEntries, raceLayout, type BallState } from "./race-views";
import { G as PIT_G, run as runPit } from "./simulate/pit";
import { useExperimentsDefaults, useRace } from "./use-experiments";

/** How much slower than life the race may run: it is over in a second. */
const SPEEDS = [1, 0.25, 0.1] as const;
/** The auto mode's rest after the last ball arrives, before the next start. */
const REST_S = 1.5;
/** The race's allowed run, as a share of the drop: the engine's bounds
 *  (`race.SHORTEST_RUN`, `LONGEST_RUN`). Shorter, the hump throws a ball off
 *  and the circle curls back over its start. */
const RUN_PER_DROP = [1.1, 6] as const;
const BALLS: RaceBall[] = ["solid", "hollow", "sliding"];

/**
 * The race (`experiments.race`): six tracks from one start to one finish, a
 * ball let go on each at the same moment; and, below, the cycloid valley on
 * which balls let go from any height reach the bottom together. Every time,
 * position, velocity and acceleration on a track is the engine's: it answers
 * each track with its time table, and the page looks the running time up in
 * it. Past the flag the balls fly into the pit and heap up (`simulate/pit.ts`).
 */
export function RacePage() {
  const { t } = useTranslation();
  const defaults = useExperimentsDefaults();
  const [build, setBuild] = useState<RaceRequest | null>(null);
  const spec = build ?? defaults.data?.race ?? null;
  const analysis = useRace(spec);
  const data = analysis.data ?? null;

  return (
    <ExhibitFrame
      exhibit="race"
      atTheExhibit={
        <>
          <p>{t("experiments.race.at.tracks")}</p>
          <p>{t("experiments.race.at.which")}</p>
        </>
      }
      whatHappens={<RaceModel />}
      computed={<RaceComputed />}
      sweetSpot={<RaceTrick data={data} />}
    >
      {defaults.isPending || (spec && !data && analysis.isPending) ? (
        <LoadingState className="py-10" label={t("common.loading")} />
      ) : !spec || !data ? (
        <AlertBanner tone="danger">
          {apiErrorMessage(defaults.error ?? analysis.error, t("experiments.failed"))}
        </AlertBanner>
      ) : (
        <>
          <RacePlay spec={spec} data={data} />
          <RaceBuild spec={spec} onChange={setBuild} />
          <ValleyPlay data={data} />
        </>
      )}
    </ExhibitFrame>
  );
}

/** The running clock of a race or a valley, advanced each animation frame. */
function useClock(running: boolean, speed: number, onTick?: (t: number) => number | null) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000) * speed;
      last = now;
      setT((previous) => {
        const next = previous + dt;
        const reset = onTick?.(next);
        return reset ?? next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, speed, onTick]);
  return [t, setT] as const;
}

/** The exhibit's auto mode alone, for the overview's previews
 *  (`preview-mode.tsx`): the six balls let go, run into the pit, and let go
 *  again once they lie still. */
export function RacePreview({ paused }: PreviewProps) {
  const defaults = useExperimentsDefaults();
  const spec = defaults.data?.race ?? null;
  const analysis = useRace(spec);
  return spec && analysis.data ? (
    <RacePlay spec={spec} data={analysis.data} preview paused={paused} />
  ) : (
    <PreviewPending />
  );
}

function RacePlay({
  spec,
  data,
  preview = false,
  paused = false,
}: { spec: RaceRequest; data: RaceAnalysis } & PreviewMode) {
  const { t } = useTranslation();
  const [runningHere, setRunning] = useState(false);
  const running = preview ? !paused : runningHere;
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(0.25);
  const [auto, setAuto] = useState(preview);
  const tracks = data.race.tracks;
  // The pit, run once per build by the engine's port: a time loop of some
  // thirty thousand steps, a few tens of milliseconds, that the API's budget
  // has no room for.
  const pit = useMemo(
    () => runPit(data.race.basin, data.race.ball_radius_m, data.race.inertia, pitEntries(tracks)),
    [data.race, tracks],
  );
  // Stable between renders, so the clock's frame loop is not torn down every
  // frame: with the auto mode on, the race starts again once the balls have
  // lain still a moment in the pit.
  const restart = useCallback((next: number) => (next > pit.settled_s + REST_S ? 0 : null), [pit.settled_s]);
  const [time, setTime] = useClock(running, speed, auto ? restart : undefined);
  const ranked = [...data.race.tracks].sort((a, b) => a.time_s - b.time_s);
  const layout = useMemo(
    () => raceLayout(spec.drop_m, spec.run_m, data.race, pit),
    [spec.drop_m, spec.run_m, data.race, pit],
  );
  const states = Object.fromEntries(
    tracks.map((tr, i) => [tr.kind, ballState(tr, time, pit.balls[i], pit.sample_s)]),
  ) as Record<CurveKind, BallState>;
  // The arrows' scale is the build's, held for the whole race: the fastest any
  // ball goes, on its track or in the pit, and the hardest any is pushed on its
  // track or pulled by g in the air. A knock in the pit is far harder, a
  // jolt: its arrows run off the scale, drawn dashed, and the table gives
  // their size.
  const spans = useMemo(() => {
    const fastest = Math.max(
      ...tracks.map((tr) => tr.top_speed_m_s),
      ...pit.balls.flatMap((b) => b.vx_m_s.map((vx, j) => Math.hypot(vx, b.vy_m_s[j]))),
    );
    const pushed = Math.max(
      ...tracks.flatMap((tr) => tr.motion.ax_m_s2.map((ax, j) => Math.hypot(ax, tr.motion.ay_m_s2[j]))),
    );
    return { v: niceSpan(fastest), a: niceSpan(Math.max(pushed, PIT_G)) };
  }, [tracks, pit]);

  const start = () => {
    setTime(0);
    setRunning(true);
  };

  if (preview) {
    return (
      <RaceView
        tracks={tracks}
        drop={spec.drop_m}
        run={spec.run_m}
        layout={layout}
        states={states}
        label={t("experiments.race.play.view")}
      />
    );
  }
  return (
    <WidgetCard
      title={t("experiments.race.play.title")}
      hint={t("experiments.race.play.hint")}
      actions={
        <>
          <Button variant="accent" size="sm" onClick={start}>
            <Flag className="size-4" aria-hidden />
            {t("experiments.race.play.start")}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setRunning(!running)}>
            {running ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
            {running ? t("experiments.race.play.pause") : t("experiments.race.play.run")}
          </Button>
        </>
      }
    >
      <RaceView
        tracks={tracks}
        drop={spec.drop_m}
        run={spec.run_m}
        layout={layout}
        states={states}
        label={t("experiments.race.play.view")}
      />
      {/* Each ball's velocity and acceleration, as arrows from one point and as
          numbers beside, so that which balls brake harder is obvious. */}
      <div className="space-y-2">
        <p className="text-sm text-secondary">{t("experiments.race.motion.hint")}</p>
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[auto_minmax(0,1fr)]">
          <div className="grid grid-cols-2 gap-2 sm:gap-4">
            <figure className="space-y-1">
              <VectorPlane
                symbol="v"
                unit="m/s"
                span={spans.v}
                vectors={ranked.map((tr) => ({ kind: tr.kind, value: states[tr.kind].v }))}
                label={t("experiments.race.motion.velocity_label")}
              />
              <figcaption className="text-center text-sm text-secondary">
                {t("experiments.race.motion.velocity")}
              </figcaption>
            </figure>
            <figure className="space-y-1">
              <VectorPlane
                symbol="a"
                unit="m/s²"
                span={spans.a}
                vectors={ranked.map((tr) => ({ kind: tr.kind, value: states[tr.kind].a }))}
                label={t("experiments.race.motion.acceleration_label")}
              />
              <figcaption className="text-center text-sm text-secondary">
                {t("experiments.race.motion.acceleration")}
              </figcaption>
            </figure>
          </div>
          <MotionTable ranked={ranked} states={states} time={time} />
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <Switch
          label={t("experiments.race.play.auto")}
          description={t("experiments.race.play.auto_hint")}
          checked={auto}
          onCheckedChange={(on) => {
            setAuto(on);
            if (on) start();
          }}
        />
        <ToggleGroup
          label={t("experiments.race.play.speed")}
          labelPlacement="above"
          size="sm"
          value={String(speed)}
          onChange={(v: string) => setSpeed(Number(v) as (typeof SPEEDS)[number])}
          options={SPEEDS.map((s) => ({
            value: String(s),
            label: t(`experiments.race.play.speeds.${String(s).replace(".", "_")}`),
          }))}
        />
      </div>
    </WidgetCard>
  );
}

function RaceBuild({ spec, onChange }: { spec: RaceRequest; onChange: (next: RaceRequest) => void }) {
  const { t } = useTranslation();
  const clampRun = (run: number, drop: number) =>
    Math.min(Math.max(run, RUN_PER_DROP[0] * drop), RUN_PER_DROP[1] * drop);
  return (
    <WidgetCard title={t("experiments.race.change.title")} hint={t("experiments.race.change.hint")}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SliderField
          label={t("experiments.race.change.drop")}
          unit="cm"
          value={spec.drop_m * 100}
          min={20}
          max={100}
          step={1}
          digits={0}
          onChange={(v) => onChange({ ...spec, drop_m: v / 100, run_m: clampRun(spec.run_m, v / 100) })}
        />
        <SliderField
          label={t("experiments.race.change.run")}
          unit="cm"
          value={spec.run_m * 100}
          min={20}
          max={250}
          step={1}
          digits={0}
          hint={t("experiments.race.change.run_hint")}
          onChange={(v) => onChange({ ...spec, run_m: clampRun(v / 100, spec.drop_m) })}
        />
        <ToggleGroup
          label={t("experiments.race.change.ball")}
          labelPlacement="above"
          size="sm"
          overflow="wrap"
          value={spec.ball}
          onChange={(v: RaceBall) => onChange({ ...spec, ball: v })}
          options={BALLS.map((b) => ({ value: b, label: t(`experiments.race.balls.${b}`) }))}
        />
      </div>
    </WidgetCard>
  );
}

function ValleyPlay({ data }: { data: RaceAnalysis }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const [running, setRunning] = useState(true);
  const [time, setTime] = useClock(running, 0.5);
  const v = data.valley;
  return (
    <WidgetCard
      title={t("experiments.race.valley.title")}
      hint={t("experiments.race.valley.hint")}
      actions={
        <>
          <Button
            variant="accent"
            size="sm"
            onClick={() => {
              setTime(0);
              setRunning(true);
            }}
          >
            <Flag className="size-4" aria-hidden />
            {t("experiments.race.valley.let_go")}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setRunning(!running)}>
            {running ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
            {running ? t("experiments.race.play.pause") : t("experiments.race.play.run")}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <figure className="space-y-1">
          <ValleyView
            kind="cycloid"
            starts={v.starts}
            radius={v.radius_m}
            bowl={v.bowl_radius_m}
            t={time}
            label={t("experiments.race.valley.cycloid")}
          />
          <figcaption className="text-center text-sm text-secondary">{t("experiments.race.valley.cycloid")}</figcaption>
        </figure>
        <figure className="space-y-1">
          <ValleyView
            kind="circle"
            starts={v.starts}
            radius={v.radius_m}
            bowl={v.bowl_radius_m}
            t={time}
            label={t("experiments.race.valley.circle")}
          />
          <figcaption className="text-center text-sm text-secondary">{t("experiments.race.valley.circle")}</figcaption>
        </figure>
      </div>
      <Figures
        tiles={[
          {
            key: "tauto",
            label: t("experiments.race.valley.to_bottom"),
            value: v.tautochrone_s,
            digits: 3,
            unit: "s",
          },
          ...v.starts.map((s, i) => ({
            key: `bowl-${i}`,
            label: t("experiments.race.valley.bowl_from", { height: formatNumber(s.height_m * 100, 0, locale) }),
            value: s.circle_time_s,
            digits: 3,
            unit: "s",
          })),
        ]}
      />
    </WidgetCard>
  );
}

function RaceModel() {
  const { t } = useTranslation();
  const s = (key: string) => t(`experiments.race.symbols.${key}`);
  return (
    <>
      <p>{t("experiments.race.model.intro")}</p>
      <Equation
        tex={String.raw`v = \sqrt{2\,g'\,h}, \qquad g' = \frac{g}{1 + k}`}
        reads={t("experiments.race.model.speed")}
        symbols={[
          { tex: "v", meaning: s("v"), unit: "m/s" },
          { tex: "h", meaning: s("h"), unit: "m" },
          { tex: "g'", meaning: s("g_share"), unit: "m/s²" },
          { tex: "k", meaning: s("k") },
        ]}
      />
      <Equation
        tex={String.raw`T = \int_A^B \frac{ds}{v}`}
        reads={t("experiments.race.model.time")}
        symbols={[
          { tex: "T", meaning: s("time"), unit: "s" },
          { tex: "ds", meaning: s("ds"), unit: "m" },
        ]}
      />
      <Equation
        tex={String.raw`x = r\,(\theta - \sin\theta), \quad y = -r\,(1 - \cos\theta), \qquad T_{\text{cycloid}} = \theta_B \sqrt{\frac{r}{g'}}`}
        reads={t("experiments.race.model.cycloid")}
        symbols={[
          { tex: "r", meaning: s("r"), unit: "m" },
          { tex: String.raw`\theta`, meaning: s("theta"), unit: "rad" },
          { tex: String.raw`\theta_B`, meaning: s("theta_b"), unit: "rad" },
        ]}
      />
      <Equation
        tex={String.raw`T_{\text{line}} = \sqrt{\frac{2\,(D^2 + H^2)}{g'\,H}}`}
        reads={t("experiments.race.model.line")}
        symbols={[
          { tex: "D", meaning: s("run"), unit: "m" },
          { tex: "H", meaning: s("drop"), unit: "m" },
        ]}
      />
      <Equation
        tex={String.raw`T_{\text{bottom}} = \pi \sqrt{\frac{r}{g'}} \quad\text{vs.}\quad T_{\text{bowl}} = \sqrt{\frac{R}{g'}}\; K\!\left(\sin\frac{\varphi_0}{2}\right)`}
        reads={t("experiments.race.model.valley")}
        symbols={[
          { tex: "R", meaning: s("bowl"), unit: "m" },
          { tex: String.raw`\varphi_0`, meaning: s("phi0"), unit: "rad" },
          { tex: "K", meaning: s("elliptic") },
        ]}
      />
    </>
  );
}

function RaceComputed() {
  const { t } = useTranslation();
  return (
    <Equation
      tex={String.raw`T = \int_0^1 \frac{|\mathbf r'(p)|}{\sqrt{2\,g'\,(y_A - y(p))}}\,dp \;\overset{p\,=\,u^2}{=}\; \int_0^1 \frac{2u\,|\mathbf r'(u^2)|}{\sqrt{2\,g'\,(y_A - y(u^2))}}\,du`}
      reads={t("experiments.race.computed.system")}
      symbols={[
        { tex: "p", meaning: t("experiments.race.computed.p") },
        { tex: String.raw`\mathbf r(p)`, meaning: t("experiments.race.computed.r"), unit: "m" },
        { tex: "u", meaning: t("experiments.race.computed.u") },
      ]}
    />
  );
}

function RaceTrick({ data }: { data: RaceAnalysis | null }) {
  const { t } = useTranslation();
  const locale = useLocale();
  if (!data) return <LoadingState className="py-6" label={t("common.loading")} />;
  const by = Object.fromEntries(data.race.tracks.map((tr) => [tr.kind, tr]));
  const ranked = [...data.race.tracks].sort((a, b) => a.time_s - b.time_s);
  return (
    <>
      <p>
        {t("experiments.race.sweet.shortest", {
          line: formatNumber(by.line.time_s, 3, locale),
          cycloid: formatNumber(by.cycloid.time_s, 3, locale),
        })}
      </p>
      <p>
        {data.race.cycloid_dips
          ? t("experiments.race.sweet.dips", {
              below: formatNumber((data.race.cycloid_lowest_m - by.line.lowest_m) * 100, 1, locale),
            })
          : t("experiments.race.sweet.no_dip")}
      </p>
      <p>{t("experiments.race.sweet.galileo", { circle: formatNumber(by.circle.time_s, 3, locale) })}</p>
      <p>{t("experiments.race.sweet.same_speed", { speed: formatNumber(data.race.finish_speed_m_s, 2, locale) })}</p>
      {/* Which way the cycloid's ball is thrown is the build's: upwards only
          where it dips below the finish and climbs back to it. */}
      <p>{data.race.cycloid_dips ? t("experiments.race.sweet.throw_up") : t("experiments.race.sweet.throw_down")}</p>
      <p>{t("experiments.race.sweet.rolling", { factor: formatNumber(data.race.rolling_factor, 3, locale) })}</p>
      <Figures
        tiles={ranked.map((track) => ({
          key: track.kind,
          label: t(`experiments.race.curves.${track.kind}`),
          value: track.time_s,
          digits: 3,
          unit: "s",
        }))}
      />
    </>
  );
}
