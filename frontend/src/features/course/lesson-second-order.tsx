/**
 * Lesson 2: second-order systems — natural frequency and damping, read off a
 * step, a resonance and a decay.
 *
 * One system for the whole lesson, the torque measuring shaft of the
 * specification (J = 0.05 kg·m², c = 500 N·m/rad, d = 0.5 N·m·s/rad): set by
 * its parts or by its two numbers, and drawn as its step response and as the
 * magnification a measuring chain built on it reads with. The decay test is
 * separate and has its own system, drawn at random, whose damping the reader
 * measures by clicking two successive maxima — the pairs' answers come with
 * the curve (`second_order.decay_test`), so a click only chooses one.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Dices, Eye } from "lucide-react";
import { Button, Chip, ToggleGroup } from "@eifi1/ui-kit";
import { courseApi } from "@/shared/api/endpoints";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber } from "@/shared/lib/format";
import { useChartHex } from "@/shared/state/palette-store";
import { PLOT_ROWS, SeriesChart } from "@/shared/charts/series-chart";
import type { Magnification, Regime, SecondOrderRequest, SecondOrderStep } from "@/shared/types";
import { HUE, REFERENCE_GREY } from "./colours";
import { LessonFrame } from "./lesson-frame";
import { log10, logAxis, logX } from "@/shared/charts/log-axis";
import { Failed, Figures, Param, WidgetBody, WidgetCard } from "./parts";
import { Tex } from "@/shared/ui/tex";
import { useComputed } from "./use-course";

interface Parts {
  inertia: number;
  stiffness: number;
  damping: number;
}
interface Numbers {
  f0: number;
  ratio: number;
}
/** How the reader describes the system: by its parts, or by its two numbers. */
type Mode = "parts" | "numbers";

const PARTS: Parts = { inertia: 0.05, stiffness: 500, damping: 0.5 };
const NUMBERS: Numbers = { f0: 15.92, ratio: 0.05 };
const TORQUE = 10;

const REGIME_TONE: Record<Regime, "info" | "success" | "warning"> = {
  underdamped: "info",
  critical: "success",
  overdamped: "warning",
};

export function SecondOrderLesson() {
  const { t } = useTranslation();
  return (
    <LessonFrame
      lesson="second_order"
      question={t("course.second_order.question")}
      model={
        <>
          <p>{t("course.second_order.model")}</p>
          <Tex
            block
            tex="J\,\ddot\varphi + d\,\dot\varphi + c\,\varphi = M \qquad \omega_0 = \sqrt{\frac{c}{J}} \qquad D = \frac{d}{2\sqrt{c\,J}}"
          />
          <p>{t("course.second_order.model_magnification")}</p>
          <Tex
            block
            tex="V(\eta) = \frac{1}{\sqrt{(1-\eta^2)^2 + (2D\eta)^2}},\quad \eta = \frac{f}{f_0} \qquad \Lambda = \ln\frac{x_n}{x_{n+1}},\quad D = \frac{\Lambda}{\sqrt{4\pi^2 + \Lambda^2}}"
          />
        </>
      }
      assumptions={[
        t("course.second_order.assumptions.lumped"),
        t("course.second_order.assumptions.viscous"),
        t("course.second_order.assumptions.linear"),
      ]}
      insights={[
        t("course.second_order.insights.peak"),
        t("course.second_order.insights.chain"),
        t("course.second_order.insights.mass"),
      ]}
    >
      <SystemWidgets />
      <DecayWidget />
    </LessonFrame>
  );
}

/**
 * The lesson's one system, drawn twice: its step response, with every control
 * of the system, and the magnification a measuring chain built on it reads
 * with, under the excitation's slider. One engine question answers both
 * cards, so they always show the same system.
 */
function SystemWidgets() {
  const [mode, setMode] = useState<Mode>("parts");
  const [parts, setParts] = useState(PARTS);
  const [numbers, setNumbers] = useState(NUMBERS);
  const [excitation, setExcitation] = useState(3);
  const body: SecondOrderRequest =
    mode === "parts"
      ? {
          inertia: parts.inertia,
          stiffness: parts.stiffness,
          damping_coefficient: parts.damping,
          torque: TORQUE,
          excitation_hz: excitation,
        }
      : {
          inertia: parts.inertia,
          f0_hz: numbers.f0,
          damping_ratio: numbers.ratio,
          torque: TORQUE,
          excitation_hz: excitation,
        };
  const run = useComputed("second-order", body, courseApi.secondOrder);
  const step = run.data?.step;

  // Switching description carries the system over: the answer says both.
  const switchMode = (next: Mode) => {
    if (step) {
      setParts({
        inertia: step.system.inertia,
        stiffness: step.system.stiffness,
        damping: step.system.damping_coefficient,
      });
      setNumbers({ f0: step.system.f0_hz, ratio: step.system.damping_ratio });
    }
    setMode(next);
  };
  const reset = () => {
    setParts(PARTS);
    setNumbers(NUMBERS);
    setExcitation(3);
  };
  return (
    <>
      <StepCard
        mode={mode}
        onMode={switchMode}
        parts={parts}
        onParts={setParts}
        numbers={numbers}
        onNumbers={setNumbers}
        onReset={reset}
        error={run.error}
        step={step}
      />
      <MagnificationCard excitation={excitation} onExcitation={setExcitation} mag={run.data?.magnification} />
    </>
  );
}

/** The step response as chart rows, in milliseconds and milliradians. */
function stepRows(step: SecondOrderStep) {
  return step.time_s.map((x, i) => ({
    x: x * 1000,
    value: step.value[i] * 1000,
    upper: step.envelope_upper.length ? step.envelope_upper[i] * 1000 : undefined,
    lower: step.envelope_lower.length ? step.envelope_lower[i] * 1000 : undefined,
  }));
}

/** The magnification curves as chart rows over `log₁₀ η`, one column per
 *  damping. */
function magRows(mag: Magnification) {
  return mag.ratio.map((eta, i) => {
    const row: Record<string, number | undefined> = { x: Math.log10(eta) };
    mag.curves.forEach((curve, k) => (row[`d${k}`] = log10(curve.value[i])));
    return row;
  });
}

/** The system, set by its parts or by its two numbers, and its step response. */
function StepCard({
  mode,
  onMode,
  parts,
  onParts: setParts,
  numbers,
  onNumbers: setNumbers,
  onReset,
  error,
  step,
}: {
  mode: Mode;
  onMode: (mode: Mode) => void;
  parts: Parts;
  onParts: (parts: Parts) => void;
  numbers: Numbers;
  onNumbers: (numbers: Numbers) => void;
  onReset: () => void;
  error: unknown;
  step: SecondOrderStep | undefined;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  const fig = step?.figures;
  return (
    <WidgetCard
      title={t("course.second_order.system.title")}
      hint={t("course.second_order.system.hint")}
      actions={
        <Button variant="ghost" size="sm" onClick={onReset}>
          {t("course.reset")}
        </Button>
      }
    >
      <WidgetBody
        controls={
          <>
            <ToggleGroup
              label={t("course.second_order.describe")}
              labelPlacement="above"
              size="sm"
              value={mode}
              onChange={onMode}
              options={[
                { value: "parts", label: t("course.second_order.describe_parts") },
                { value: "numbers", label: t("course.second_order.describe_numbers") },
              ]}
            />
            <Param
              label={t("course.second_order.inertia")}
              unit="kg·m²"
              value={parts.inertia}
              min={0.005}
              max={0.5}
              digits={3}
              log
              onChange={(v) => setParts({ ...parts, inertia: v })}
            />
            {mode === "parts" ? (
              <>
                <Param
                  label={t("course.second_order.stiffness")}
                  unit="N·m/rad"
                  value={parts.stiffness}
                  min={50}
                  max={5000}
                  digits={0}
                  log
                  onChange={(v) => setParts({ ...parts, stiffness: v })}
                />
                <Param
                  label={t("course.second_order.damping")}
                  unit="N·m·s/rad"
                  value={parts.damping}
                  min={0}
                  max={50}
                  step={0.05}
                  digits={2}
                  onChange={(v) => setParts({ ...parts, damping: v })}
                />
              </>
            ) : (
              <>
                <Param
                  label={t("course.second_order.f0")}
                  unit="Hz"
                  value={numbers.f0}
                  min={1}
                  max={100}
                  digits={2}
                  log
                  onChange={(v) => setNumbers({ ...numbers, f0: v })}
                />
                <Param
                  label={t("course.second_order.ratio")}
                  unit=""
                  value={numbers.ratio}
                  min={0}
                  max={2}
                  step={0.005}
                  digits={3}
                  onChange={(v) => setNumbers({ ...numbers, ratio: v })}
                />
              </>
            )}
            <p className="text-xs text-muted">{t("course.second_order.torque_note", { torque: TORQUE })}</p>
          </>
        }
      >
        <Failed error={error} />
        {step && fig && (
          <>
            <div className="flex items-center gap-2">
              <Chip tone={REGIME_TONE[fig.regime]}>{t(`course.regime.${fig.regime}`)}</Chip>
            </div>
            <SeriesChart
              rows={stepRows(step)}
              series={[
                { key: "value", label: t("course.second_order.angle"), color: hex[HUE.measuring] },
                {
                  key: "upper",
                  label: t("course.second_order.envelope"),
                  color: hex[HUE.envelope],
                  dash: 1,
                  strokeWidth: 1,
                },
                {
                  key: "lower",
                  label: t("course.second_order.envelope"),
                  color: hex[HUE.envelope],
                  dash: 1,
                  strokeWidth: 1,
                },
              ]}
              axes={[
                {
                  id: "y",
                  title: `${t("course.second_order.angle")} (mrad)`,
                  format: (v) => formatNumber(v, 1, locale),
                },
              ]}
              x={{ key: "x", title: `${t("course.axis.time")} (ms)`, format: (v) => formatNumber(v, 0, locale) }}
              references={[
                {
                  axis: "y",
                  value: step.final_value * 1000,
                  label: t("course.second_order.final"),
                  tone: "muted",
                  dash: 1,
                },
                ...(fig.peak_time_s
                  ? [{ axis: "x", value: fig.peak_time_s * 1000, label: "π/ω_d", tone: "info" as const }]
                  : []),
              ]}
              height="min(18rem, 50dvh)"
              valueFormat={(v) => formatNumber(v, 3, locale)}
              maxRows={PLOT_ROWS}
            />
            <Figures
              tiles={[
                { key: "w0", label: "ω₀", value: fig.w0, digits: 1, unit: "rad/s" },
                { key: "f0", label: "f₀", value: fig.f0_hz, digits: 2, unit: "Hz" },
                { key: "d", label: t("course.second_order.ratio"), value: fig.damping, digits: 3 },
                { key: "wd", label: "ω_d", value: fig.damped_w, digits: 1, unit: "rad/s" },
                {
                  key: "overshoot",
                  label: t("course.figure.overshoot"),
                  value: fig.overshoot === null ? null : fig.overshoot * 100,
                  digits: 1,
                  unit: "%",
                },
                {
                  key: "peak",
                  label: t("course.figure.peak_time"),
                  value: fig.peak_time_s === null ? null : fig.peak_time_s * 1000,
                  digits: 1,
                  unit: "ms",
                },
                {
                  key: "settle",
                  label: t("course.figure.settling"),
                  value: fig.settling_time_s === null ? null : fig.settling_time_s * 1000,
                  digits: 0,
                  unit: "ms",
                },
                {
                  key: "final",
                  label: t("course.second_order.final"),
                  value: step.final_value * 1000,
                  digits: 2,
                  unit: "mrad",
                },
              ]}
            />
          </>
        )}
      </WidgetBody>
    </WidgetCard>
  );
}

/** The magnification a measuring chain built on the system reads with, at
 *  the excitation the reader sets. */
function MagnificationCard({
  excitation,
  onExcitation,
  mag,
}: {
  excitation: number;
  onExcitation: (hz: number) => void;
  mag: Magnification | undefined;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  return (
    <WidgetCard title={t("course.second_order.magnification.title")} hint={t("course.second_order.magnification.hint")}>
      <WidgetBody
        controls={
          <Param
            label={t("course.second_order.excitation")}
            unit="Hz"
            value={excitation}
            min={0.1}
            max={200}
            digits={2}
            log
            onChange={onExcitation}
          />
        }
      >
        {mag && (
          <>
            <SeriesChart
              rows={magRows(mag)}
              series={mag.curves.map((curve, k) => ({
                key: `d${k}`,
                label: `D = ${formatNumber(curve.damping, 3, locale)}`,
                color: k === 0 ? hex[HUE.measuring] : REFERENCE_GREY,
                strokeWidth: k === 0 ? 2.5 : 1,
                dash: k === 0 ? undefined : 1,
              }))}
              axes={[logAxis("y", `${t("course.second_order.magnification.v")} (–)`, locale)]}
              x={logX(`${t("course.second_order.magnification.eta")} (–)`, locale)}
              references={[{ axis: "x", value: Math.log10(mag.excitation_ratio), label: "η", tone: "info" }]}
              height="min(18rem, 50dvh)"
              valueFormat={(v) => formatNumber(10 ** v, 3, locale)}
              maxRows={PLOT_ROWS}
            />
            <Figures
              tiles={[
                { key: "eta", label: "η = f/f₀", value: mag.excitation_ratio, digits: 3 },
                {
                  key: "v",
                  label: t("course.second_order.magnification.v"),
                  value: mag.excitation_value,
                  digits: 3,
                },
                {
                  key: "error",
                  label: t("course.second_order.magnification.error"),
                  value: mag.error_pct,
                  digits: 1,
                  unit: "%",
                  tone: mag.error_pct !== null && Math.abs(mag.error_pct) > 5 ? "warning" : "neutral",
                  note:
                    mag.error_pct !== null && Math.abs(mag.error_pct) > 5
                      ? t("course.second_order.magnification.error_note")
                      : undefined,
                },
                { key: "phase", label: t("course.figure.phase"), value: mag.phase_deg, digits: 1, unit: "°" },
                {
                  key: "peak",
                  label: t("course.second_order.magnification.peak"),
                  value: mag.peak_value,
                  digits: 2,
                },
              ]}
            />
          </>
        )}
      </WidgetBody>
    </WidgetCard>
  );
}

function DecayWidget() {
  const { t } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  const [seed, setSeed] = useState(1);
  const [picked, setPicked] = useState<number[]>([]);
  const [revealed, setRevealed] = useState(false);
  const run = useComputed("decay", { seed }, courseApi.decay);
  const data = run.data;
  const rows = data ? data.time_s.map((x, i) => ({ x: x * 1000, value: data.value[i] })) : [];
  const nearestPeak = (x: number) => {
    if (!data?.peaks.length) return null;
    let best = 0;
    data.peaks.forEach((p, i) => {
      if (Math.abs(p.time_s * 1000 - x) < Math.abs(data.peaks[best].time_s * 1000 - x)) best = i;
    });
    return best;
  };
  const pick = (x: number) => {
    const peak = nearestPeak(x);
    if (peak === null) return;
    setPicked(picked.length >= 2 ? [peak] : [...picked, peak].sort((a, b) => a - b));
  };
  const pair = data && picked.length === 2 && picked[1] === picked[0] + 1 ? data.pairs[picked[0]] : null;
  const another = () => {
    setSeed(seed + 1);
    setPicked([]);
    setRevealed(false);
  };
  return (
    <WidgetCard
      title={t("course.second_order.decay.title")}
      hint={t("course.second_order.decay.hint")}
      actions={
        <Button variant="secondary" size="sm" onClick={another}>
          <Dices className="size-4" aria-hidden />
          {t("course.second_order.decay.another")}
        </Button>
      }
    >
      <Failed error={run.error} />
      {data && (
        <>
          <SeriesChart
            rows={rows}
            series={[
              {
                key: "value",
                label: t("course.second_order.decay.series"),
                color: hex[HUE.measuring],
                strokeWidth: 1.5,
              },
            ]}
            axes={[{ id: "y", title: `${t("course.axis.torque")} (N·m)`, format: (v) => formatNumber(v, 0, locale) }]}
            x={{ key: "x", title: `${t("course.axis.time")} (ms)`, format: (v) => formatNumber(v, 0, locale) }}
            markers={data.peaks.map((p, i) => ({
              x: p.time_s * 1000,
              y: p.value,
              r: picked.includes(i) ? 6 : 3,
              tone: picked.includes(i) ? ("brand" as const) : ("muted" as const),
              label: picked.includes(i) ? `x${picked.indexOf(i) === 0 ? "ₙ" : "ₙ₊₁"}` : undefined,
            }))}
            onPointClick={(hit) => pick(typeof hit.x === "number" ? hit.x : Number(hit.x))}
            height="min(18rem, 50dvh)"
            valueFormat={(v) => formatNumber(v, 2, locale)}
            maxRows={PLOT_ROWS}
          />
          {picked.length === 2 && !pair && (
            <p className="text-sm text-warning">{t("course.second_order.decay.not_successive")}</p>
          )}
          {pair && data && (
            <Figures
              tiles={[
                { key: "xn", label: "xₙ", value: data.peaks[pair.first].value, digits: 3, unit: "N·m" },
                { key: "xn1", label: "xₙ₊₁", value: data.peaks[pair.first + 1].value, digits: 3, unit: "N·m" },
                { key: "lambda", label: "Λ", value: pair.decrement, digits: 4 },
                { key: "d", label: t("course.second_order.decay.damping"), value: pair.damping, digits: 4 },
              ]}
            />
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="accent" size="sm" disabled={!pair} onClick={() => setRevealed(true)}>
              <Eye className="size-4" aria-hidden />
              {t("course.second_order.decay.compare")}
            </Button>
            {revealed && pair && (
              <span className="text-sm text-secondary">
                {t("course.second_order.decay.result", {
                  yours: formatNumber(pair.damping, 4, locale),
                  truth: formatNumber(data.true_damping, 3, locale),
                  overall: data.overall_damping === null ? "–" : formatNumber(data.overall_damping, 4, locale),
                  n: data.peaks.length - 1,
                })}
              </span>
            )}
          </div>
        </>
      )}
    </WidgetCard>
  );
}
