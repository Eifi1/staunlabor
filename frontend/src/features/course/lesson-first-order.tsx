/**
 * Lesson 1: first-order systems — the time constant, read off a curve and
 * recognised in four domains at once.
 *
 * Three widgets: the step response with its marks at 1, 2, 3 and 5 τ and the
 * starting tangent (and a switch to the logarithmic view, where the
 * exponential becomes a straight line); the same curve relabelled as a
 * thermometer, an RC network, a spring with a damper and an evacuated chamber;
 * and a noisy measurement whose τ the reader finds by placing a marker on the
 * 63 % line. Every number is the engine's (`domain/course/first_order.py`).
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Dices, Eye } from "lucide-react";
import { Button, ToggleGroup } from "@eifi1/ui-kit";
import { courseApi } from "@/shared/api/endpoints";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber } from "@/shared/lib/format";
import { useChartHex } from "@/shared/state/palette-store";
import { PLOT_ROWS, SeriesChart } from "@/shared/charts/series-chart";
import type { AnalogyKind, FirstOrderRequest } from "@/shared/types";
import { HUE, REFERENCE_GREY } from "./colours";
import { LessonFrame } from "./lesson-frame";
import { Failed, Figures, Param, WidgetBody, WidgetCard, log10, logAxis } from "./parts";
import { Tex, texNumber } from "@/shared/ui/tex";
import { useComputed } from "./use-dynamics";

const STEP: FirstOrderRequest = { time_constant_s: 4, start: 20, final: 80, at_s: 8 };

/** What each analogy calls the response, its two parts and its time constant —
 *  the curve itself does not change. */
const ANALOGY_TEX: Record<AnalogyKind, (s: string, r: string, tau: string) => string> = {
  thermal: (s, r, tau) =>
    `C_\\text{th}\\,\\dot T + k\\,T = k\\,T_\\text{u},\\quad \\tau = \\frac{C_\\text{th}}{k} = \\frac{${s}\\,\\text{J/K}}{${r}\\,\\text{W/K}} = ${tau}\\,\\text{s}`,
  electrical: (s, r, tau) =>
    `R\\,C\\,\\dot u_C + u_C = u_0,\\quad \\tau = R\\,C = ${r}\\,\\Omega\\cdot ${s}\\,\\text{F} = ${tau}\\,\\text{s}`,
  mechanical: (s, r, tau) =>
    `d\\,\\dot x + c\\,x = F,\\quad \\tau = \\frac{d}{c} = \\frac{${s}\\,\\text{N·s/m}}{${r}\\,\\text{N/m}} = ${tau}\\,\\text{s}`,
  vacuum: (s, r, tau) =>
    `V\\,\\dot p + S\\,p = Q,\\quad \\tau = \\frac{V}{S} = \\frac{${s}\\,\\text{L}}{${r}\\,\\text{L/s}} = ${tau}\\,\\text{s}`,
};
const ANALOGIES: AnalogyKind[] = ["thermal", "electrical", "mechanical", "vacuum"];

export function FirstOrderLesson() {
  const { t } = useTranslation();
  return (
    <LessonFrame
      lesson="first_order"
      question={t("course.first_order.question")}
      model={
        <>
          <p>{t("course.first_order.model")}</p>
          <Tex block tex="\tau\,\dot y + y = K\,u \qquad y(t) = y_\infty + (y_0 - y_\infty)\,e^{-t/\tau}" />
          <p>{t("course.first_order.model_tau")}</p>
        </>
      }
      assumptions={[
        t("course.first_order.assumptions.one_store"),
        t("course.first_order.assumptions.linear"),
        t("course.first_order.assumptions.constant"),
      ]}
      insights={[
        t("course.first_order.insights.settled"),
        t("course.first_order.insights.read"),
        t("course.first_order.insights.log"),
      ]}
    >
      <StepWidget />
      <MeasurementWidget />
    </LessonFrame>
  );
}

function StepWidget() {
  const { t } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  const [body, setBody] = useState(STEP);
  const [log, setLog] = useState(false);
  const [analogy, setAnalogy] = useState<AnalogyKind>("thermal");
  const run = useComputed("first-order", body, courseApi.firstOrder);
  const data = run.data;
  const step = data?.step;
  const pair = data?.analogies.find((a) => a.kind === analogy);
  const unit = t(`course.first_order.analogy.${analogy}.unit`);
  const quantity = t(`course.first_order.analogy.${analogy}.quantity`);
  // The tangent from the start reaches the final value at τ: two extra rows.
  const rows = step
    ? [
        ...step.time_s.map((x, i) => ({
          x,
          value: step.value[i],
          remaining: log10(step.remaining[i]),
          tangent: x === 0 ? body.start : undefined,
        })),
        { x: step.tangent_end_s, tangent: body.final },
      ].sort((a, b) => a.x - b.x)
    : [];
  const markers = step
    ? step.marks.map((mark) => ({
        x: mark.time_s,
        y: log ? (log10(Math.abs(mark.value - body.final)) ?? 0) : mark.value,
        axis: "y",
        label: `${mark.multiple}τ · ${formatNumber(mark.fraction * 100, 1, locale)} %`,
        tone: "brand" as const,
      }))
    : [];
  const tex = pair
    ? ANALOGY_TEX[analogy](
        texNumber(pair.storage, analogy === "electrical" ? 6 : 1, locale),
        texNumber(pair.resistance, 0, locale),
        texNumber(pair.time_constant_s, 2, locale),
      )
    : "";
  return (
    <WidgetCard title={t("course.first_order.step.title")} hint={t("course.first_order.step.hint")}>
      <WidgetBody
        controls={
          <>
            <Param
              label={t("course.first_order.tau")}
              unit="s"
              value={body.time_constant_s}
              min={0.5}
              max={20}
              step={0.1}
              digits={1}
              onChange={(v) => setBody({ ...body, time_constant_s: v })}
            />
            <Param
              label={t("course.first_order.start")}
              unit={unit}
              value={body.start}
              min={0}
              max={100}
              step={1}
              digits={0}
              onChange={(v) => setBody({ ...body, start: v })}
            />
            <Param
              label={t("course.first_order.final")}
              unit={unit}
              value={body.final}
              min={0}
              max={150}
              step={1}
              digits={0}
              onChange={(v) => setBody({ ...body, final: v })}
            />
            <Param
              label={t("course.first_order.at")}
              unit="s"
              value={body.at_s}
              min={0}
              max={60}
              step={0.5}
              digits={1}
              onChange={(v) => setBody({ ...body, at_s: v })}
            />
            <ToggleGroup
              label={t("course.first_order.analogy_label")}
              labelPlacement="above"
              size="sm"
              overflow="wrap"
              value={analogy}
              onChange={setAnalogy}
              options={ANALOGIES.map((kind) => ({
                value: kind,
                label: t(`course.first_order.analogy.${kind}.name`),
              }))}
            />
            <ToggleGroup
              label={t("course.first_order.view")}
              labelPlacement="above"
              size="sm"
              value={log ? "log" : "linear"}
              onChange={(v) => setLog(v === "log")}
              options={[
                { value: "linear", label: t("course.first_order.view_linear") },
                { value: "log", label: t("course.first_order.view_log") },
              ]}
            />
          </>
        }
      >
        <Failed error={run.error} />
        {step && (
          <>
            <Tex block tex={tex} />
            <SeriesChart
              rows={rows}
              series={
                log
                  ? [{ key: "remaining", label: t("course.first_order.remaining"), color: hex[HUE.measuring] }]
                  : [
                      { key: "value", label: quantity, color: hex[HUE.measuring] },
                      {
                        key: "tangent",
                        label: t("course.first_order.tangent"),
                        color: REFERENCE_GREY,
                        dash: 1,
                        curve: "linear",
                      },
                    ]
              }
              axes={[
                log
                  ? logAxis("y", `|${quantity} − ${t("course.first_order.final_short")}| (${unit})`, locale)
                  : { id: "y", title: `${quantity} (${unit})`, format: (v) => formatNumber(v, 0, locale) },
              ]}
              x={{ key: "x", title: `${t("course.axis.time")} (s)`, format: (v) => formatNumber(v, 0, locale) }}
              markers={markers}
              references={[
                ...(log
                  ? []
                  : [
                      {
                        axis: "y",
                        value: body.final,
                        label: t("course.first_order.final_short"),
                        tone: "muted" as const,
                        dash: 1,
                      },
                    ]),
                { axis: "x", value: body.at_s, label: "t", tone: "info" as const },
              ]}
              connectNulls
              height="min(20rem, 55dvh)"
              valueFormat={(v) => formatNumber(log ? 10 ** v : v, 2, locale)}
              maxRows={PLOT_ROWS}
            />
            <Figures
              tiles={[
                {
                  key: "tau",
                  label: t("course.figure.time_constant"),
                  value: body.time_constant_s,
                  digits: 1,
                  unit: "s",
                },
                {
                  key: "at",
                  label: t("course.first_order.value_at", { t: formatNumber(body.at_s, 1, locale) }),
                  value: step.at_value,
                  digits: 2,
                  unit,
                },
                {
                  key: "fraction",
                  label: t("course.first_order.fraction_at"),
                  value: step.at_fraction * 100,
                  digits: 1,
                  unit: "%",
                },
                {
                  key: "settled",
                  label: t("course.first_order.settled"),
                  value: step.marks.find((mark) => mark.multiple === 5)?.time_s,
                  digits: 1,
                  unit: "s",
                },
              ]}
            />
          </>
        )}
      </WidgetBody>
    </WidgetCard>
  );
}

function MeasurementWidget() {
  const { t } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  const [seed, setSeed] = useState(1);
  const [marker, setMarker] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const run = useComputed("measurement", { seed }, courseApi.measurement);
  const data = run.data;
  const rows = data ? data.time_s.map((x, i) => ({ x, value: data.value[i] })) : [];
  const deviation = data && marker !== null ? ((marker - data.time_constant_s) / data.time_constant_s) * 100 : null;
  const another = () => {
    setSeed(seed + 1);
    setMarker(null);
    setRevealed(false);
  };
  return (
    <WidgetCard
      title={t("course.first_order.measure.title")}
      hint={t("course.first_order.measure.hint")}
      actions={
        <Button variant="secondary" size="sm" onClick={another}>
          <Dices className="size-4" aria-hidden />
          {t("course.first_order.measure.another")}
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
                label: t("course.first_order.measure.series"),
                color: hex[HUE.measuring],
                strokeWidth: 1.5,
              },
            ]}
            axes={[
              {
                id: "y",
                title: `${t("course.first_order.analogy.thermal.quantity")} (°C)`,
                format: (v) => formatNumber(v, 0, locale),
              },
            ]}
            x={{ key: "x", title: `${t("course.axis.time")} (s)`, format: (v) => formatNumber(v, 0, locale) }}
            references={[
              { axis: "y", value: data.level_63, label: "63 %", tone: "brand", dash: 1 },
              ...(marker !== null
                ? [{ axis: "x", value: marker, label: t("course.first_order.measure.yours"), tone: "info" as const }]
                : []),
              ...(revealed ? [{ axis: "x", value: data.time_constant_s, label: "τ", tone: "success" as const }] : []),
            ]}
            onPointClick={(hit) => setMarker(typeof hit.x === "number" ? hit.x : Number(hit.x))}
            height="min(18rem, 50dvh)"
            valueFormat={(v) => formatNumber(v, 1, locale)}
            maxRows={PLOT_ROWS}
          />
          <Param
            label={t("course.first_order.measure.marker")}
            unit="s"
            value={marker ?? 0}
            min={0}
            max={20}
            step={0.1}
            digits={1}
            hint={t("course.first_order.measure.marker_hint")}
            onChange={setMarker}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="accent" size="sm" disabled={marker === null} onClick={() => setRevealed(true)}>
              <Eye className="size-4" aria-hidden />
              {t("course.first_order.measure.compare")}
            </Button>
            {revealed && deviation !== null && (
              <span className="text-sm text-secondary">
                {t("course.first_order.measure.result", {
                  yours: formatNumber(marker ?? 0, 2, locale),
                  truth: formatNumber(data.time_constant_s, 2, locale),
                  off: formatNumber(deviation, 1, locale),
                })}
              </span>
            )}
          </div>
        </>
      )}
    </WidgetCard>
  );
}
