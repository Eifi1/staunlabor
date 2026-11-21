/**
 * Lesson 5: what an integrator does to the equation it solves.
 *
 * The sensor of lesson 1 stepped by Euler, Heun and RK4 (with every RK4 step's
 * four slopes laid open, and the step pushed past 2τ where Euler runs away);
 * the measuring shaft of lesson 2 integrated for a second by four methods and
 * read for the damping each one reports; and a stiff pair, where an explicit
 * method pays ten thousand steps for a part that died out in five milliseconds.
 * The points drawn are the methods' own (`domain/course/numerics.py`).
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Chip, Disclosure, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@eifi1/ui-kit";
import { courseApi } from "@/shared/api/endpoints";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber } from "@/shared/lib/format";
import { useChartHex } from "@/shared/state/palette-store";
import { PLOT_ROWS, SeriesChart } from "@/shared/charts/series-chart";
import type { EulerRegime, OscillatorMethod, SensorMethods } from "@/shared/types";
import { HUE, REFERENCE_GREY } from "./colours";
import { LessonFrame } from "./lesson-frame";
import { Failed, Figures, Param, WidgetBody, WidgetCard, log10, logAxis } from "./parts";
import { Tex } from "@/shared/ui/tex";
import { useComputed } from "./use-dynamics";

const REGIME_TONE: Record<EulerRegime, "success" | "info" | "warning" | "danger"> = {
  monotone: "success",
  one_step: "info",
  alternating: "warning",
  neutral: "warning",
  diverging: "danger",
};

const METHODS: OscillatorMethod[] = ["exact", "euler", "symplectic", "rk4"];

export function NumericsLesson() {
  const { t } = useTranslation();
  return (
    <LessonFrame
      lesson="numerics"
      question={t("course.numerics.question")}
      model={
        <>
          <p>{t("course.numerics.model")}</p>
          <Tex
            block
            tex="\text{Euler: } y_{k+1} = y_k + h\,f(t_k, y_k) \qquad \text{RK4: } y_{k+1} = y_k + \tfrac{h}{6}\,(k_1 + 2k_2 + 2k_3 + k_4)"
          />
          <p>{t("course.numerics.model_stability")}</p>
          <Tex
            block
            tex="\dot y = \lambda y:\quad y_{k+1} = (1 + h\lambda)\,y_k \qquad |1 + h\lambda| \le 1 \qquad \text{PT1: } h < 2\tau \qquad \text{PT2: } h\,\omega_0 < 2D"
          />
        </>
      }
      assumptions={[t("course.numerics.assumptions.fixed"), t("course.numerics.assumptions.rounding")]}
      insights={[
        t("course.numerics.insights.order"),
        t("course.numerics.insights.energy"),
        t("course.numerics.insights.rule"),
        t("course.numerics.insights.stiff"),
      ]}
    >
      <SensorWidget />
      <OscillatorWidget />
      <StiffWidget />
    </LessonFrame>
  );
}

function SensorWidget() {
  const { t } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  const [step, setStep] = useState(1);
  const [steps, setSteps] = useState(8);
  const run = useComputed("sensor", { step_s: step, steps }, courseApi.sensor);
  const data = run.data;
  const rows = data
    ? [
        ...data.exact_time_s.map((x, i) => ({ x, exact: data.exact[i] })),
        ...data.rows.map((r) => ({ x: r.time_s, euler: r.euler, heun: r.heun, rk4: r.rk4 })),
      ].sort((a, b) => a.x - b.x)
    : [];
  return (
    <WidgetCard title={t("course.numerics.sensor.title")} hint={t("course.numerics.sensor.hint")}>
      <WidgetBody
        controls={
          <>
            <Param
              label={t("course.numerics.step")}
              unit="s"
              value={step}
              min={0.1}
              max={12}
              digits={2}
              log
              onChange={setStep}
            />
            <Param
              label={t("course.numerics.steps")}
              unit=""
              value={steps}
              min={1}
              max={40}
              step={1}
              digits={0}
              onChange={(v) => setSteps(Math.round(v))}
            />
            {data && (
              <>
                <Chip tone={REGIME_TONE[data.regime]}>{t(`course.numerics.regime.${data.regime}`)}</Chip>
                <Figures
                  tiles={[
                    { key: "ratio", label: "h/τ", value: data.step_s / data.time_constant_s, digits: 3 },
                    { key: "euler", label: t("course.numerics.euler_factor"), value: data.euler_factor, digits: 4 },
                    { key: "rk4", label: t("course.numerics.rk4_factor"), value: data.rk4_factor, digits: 4 },
                  ]}
                />
              </>
            )}
          </>
        }
      >
        <Failed error={run.error} />
        {data && (
          <>
            <SeriesChart
              rows={rows}
              series={[
                { key: "exact", label: t("course.numerics.method.exact"), color: REFERENCE_GREY, dash: 1 },
                {
                  key: "euler",
                  label: t("course.numerics.method.euler"),
                  color: hex[HUE.pole],
                  curve: "linear",
                  dot: true,
                },
                {
                  key: "heun",
                  label: t("course.numerics.method.heun"),
                  color: hex[HUE.second],
                  curve: "linear",
                  dot: true,
                  strokeWidth: 1,
                },
                {
                  key: "rk4",
                  label: t("course.numerics.method.rk4"),
                  color: hex[HUE.measuring],
                  curve: "linear",
                  dot: true,
                },
              ]}
              axes={[
                {
                  id: "y",
                  title: `${t("course.first_order.analogy.thermal.quantity")} (°C)`,
                  format: (v) => formatNumber(v, 0, locale),
                },
              ]}
              x={{ key: "x", title: `${t("course.axis.time")} (s)`, format: (v) => formatNumber(v, 1, locale) }}
              connectNulls
              height="min(20rem, 55dvh)"
              valueFormat={(v) => `${formatNumber(v, 3, locale)} °C`}
              maxRows={PLOT_ROWS}
            />
            <ErrorTable data={data} />
            <StepTable data={data} />
          </>
        )}
      </WidgetBody>
    </WidgetCard>
  );
}

function ErrorTable({ data }: { data: SensorMethods }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const n = (v: number) => formatNumber(v, 3, locale);
  return (
    <Disclosure title={t("course.numerics.errors.title")} hint={t("course.numerics.errors.hint")}>
      <Table density="compact" stack="phone">
        <TableHead>
          <TableRow>
            <TableHeaderCell>t (s)</TableHeaderCell>
            <TableHeaderCell>{t("course.numerics.method.exact")}</TableHeaderCell>
            <TableHeaderCell>{t("course.numerics.method.euler")}</TableHeaderCell>
            <TableHeaderCell>{t("course.numerics.method.heun")}</TableHeaderCell>
            <TableHeaderCell>{t("course.numerics.method.rk4")}</TableHeaderCell>
            <TableHeaderCell>{t("course.numerics.errors.euler")}</TableHeaderCell>
            <TableHeaderCell>{t("course.numerics.errors.rk4")}</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.rows.map((r) => (
            <TableRow key={r.time_s}>
              <TableCell className="tabular-nums">{formatNumber(r.time_s, 2, locale)}</TableCell>
              <TableCell className="tabular-nums">{n(r.exact)}</TableCell>
              <TableCell className="tabular-nums">{n(r.euler)}</TableCell>
              <TableCell className="tabular-nums">{n(r.heun)}</TableCell>
              <TableCell className="tabular-nums">{n(r.rk4)}</TableCell>
              <TableCell className="tabular-nums">{n(r.euler - r.exact)}</TableCell>
              <TableCell className="tabular-nums">{formatNumber(r.rk4 - r.exact, 5, locale)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Disclosure>
  );
}

/** RK4 step by step: where each of the four slopes is evaluated and what it is. */
function StepTable({ data }: { data: SensorMethods }) {
  const { t } = useTranslation();
  const locale = useLocale();
  return (
    <Disclosure title={t("course.numerics.rk4_table.title")} hint={t("course.numerics.rk4_table.hint")}>
      <div className="space-y-3">
        {data.rk4_steps.map((st, k) => (
          <Table key={st.t} density="compact">
            <TableHead>
              <TableRow>
                <TableHeaderCell>{t("course.numerics.rk4_table.step", { n: k + 1 })}</TableHeaderCell>
                <TableHeaderCell>t (s)</TableHeaderCell>
                <TableHeaderCell>y (°C)</TableHeaderCell>
                <TableHeaderCell>{t("course.numerics.rk4_table.slope")}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {st.stages.map((stage, i) => (
                <TableRow key={i}>
                  <TableCell>k{i + 1}</TableCell>
                  <TableCell className="tabular-nums">{formatNumber(stage.t, 3, locale)}</TableCell>
                  <TableCell className="tabular-nums">{formatNumber(stage.y[0], 4, locale)}</TableCell>
                  <TableCell className="tabular-nums">{formatNumber(stage.slope[0], 4, locale)}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell className="font-medium">y₊</TableCell>
                <TableCell className="tabular-nums">{formatNumber(st.t + st.h, 3, locale)}</TableCell>
                <TableCell className="tabular-nums font-medium">{formatNumber(st.y_next[0], 4, locale)}</TableCell>
                <TableCell className="text-muted">y + h/6·(k1 + 2k2 + 2k3 + k4)</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        ))}
      </div>
    </Disclosure>
  );
}

function OscillatorWidget() {
  const { t } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  const [step, setStep] = useState(1e-3);
  const run = useComputed("oscillator", { step_s: step }, courseApi.oscillator);
  const data = run.data;
  const colour: Record<OscillatorMethod, string> = {
    exact: REFERENCE_GREY,
    euler: hex[HUE.pole],
    symplectic: hex[HUE.second],
    rk4: hex[HUE.measuring],
  };
  // Each method on its own time grid: rows in path order, one method at a time.
  const angleRows = data ? data.runs.flatMap((r) => r.time_s.map((x, i) => ({ x, [r.method]: r.angle_deg[i] }))) : [];
  const ampRows = data
    ? data.runs.flatMap((r) => r.time_s.map((x, i) => ({ x, [r.method]: log10(r.amplitude_deg[i]) })))
    : [];
  const series = METHODS.map((m) => ({
    key: m,
    label: t(`course.numerics.method.${m}`),
    color: colour[m],
    dash: m === "exact" ? 1 : undefined,
    strokeWidth: m === "exact" ? 1.5 : 1.25,
  }));
  return (
    <WidgetCard title={t("course.numerics.oscillator.title")} hint={t("course.numerics.oscillator.hint")}>
      <WidgetBody
        controls={
          <>
            <Param
              label={t("course.numerics.step")}
              unit="ms"
              value={step * 1000}
              min={0.1}
              max={5}
              digits={2}
              log
              onChange={(v) => setStep(v / 1000)}
            />
            {data && (
              <Figures
                tiles={[
                  { key: "ratio", label: "h·ω₀", value: data.step_ratio, digits: 3 },
                  {
                    key: "gain",
                    label: t("course.numerics.oscillator.gain"),
                    value: data.euler_gain,
                    digits: 5,
                    tone: data.euler_gain > 1 + 1e-9 ? "danger" : "neutral",
                  },
                  {
                    key: "neutral",
                    label: t("course.numerics.oscillator.neutral"),
                    value: data.euler_neutral_step_s * 1000,
                    digits: 2,
                    unit: "ms",
                  },
                ]}
              />
            )}
          </>
        }
      >
        <Failed error={run.error} />
        {data && (
          <>
            <SeriesChart
              rows={ampRows}
              series={series}
              axes={[logAxis("y", `${t("course.numerics.oscillator.amplitude")} (°)`, locale)]}
              x={{ key: "x", title: `${t("course.axis.time")} (s)`, format: (v) => formatNumber(v, 1, locale) }}
              height="min(16rem, 45dvh)"
              valueFormat={(v) => `${formatNumber(10 ** v, 4, locale)}°`}
              maxRows={PLOT_ROWS}
            />
            <SeriesChart
              rows={angleRows}
              series={series}
              axes={[
                {
                  id: "y",
                  title: `${t("course.axis.angle")} (°)`,
                  format: (v) => formatNumber(v, 2, locale),
                  domain: [-1.5, 1.5],
                },
              ]}
              x={{ key: "x", title: `${t("course.axis.time")} (s)`, format: (v) => formatNumber(v, 1, locale) }}
              height="min(14rem, 40dvh)"
              valueFormat={(v) => `${formatNumber(v, 4, locale)}°`}
              maxRows={PLOT_ROWS}
            />
            <Figures
              tiles={data.runs.flatMap((r) => [
                {
                  key: `${r.method}-a`,
                  label: t("course.numerics.oscillator.final", { method: t(`course.numerics.method.${r.method}`) }),
                  value: r.final_amplitude_deg,
                  digits: 4,
                  unit: "°",
                },
                {
                  key: `${r.method}-d`,
                  label: t("course.numerics.oscillator.damping", {
                    method: t(`course.numerics.method.${r.method}`),
                  }),
                  value: r.damping,
                  digits: 4,
                  tone: r.damping !== null && r.damping < 0 ? ("danger" as const) : ("neutral" as const),
                },
              ])}
            />
          </>
        )}
      </WidgetBody>
    </WidgetCard>
  );
}

function StiffWidget() {
  const { t } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  const [step, setStep] = useState(0.002);
  const run = useComputed("stiff", { step_s: step }, courseApi.stiff);
  const data = run.data;
  const rows = data
    ? [
        ...data.exact_time_s.map((x, i) => ({ x, exact: data.exact_slow[i] })),
        ...data.rk4.time_s.map((x, i) => ({ x, rk4: data.rk4.slow[i] })),
        ...data.implicit.time_s.map((x, i) => ({ x, implicit: data.implicit.slow[i] })),
      ]
    : [];
  return (
    <WidgetCard title={t("course.numerics.stiff.title")} hint={t("course.numerics.stiff.hint")}>
      <WidgetBody
        controls={
          <>
            <Param
              label={t("course.numerics.step")}
              unit="s"
              value={step}
              min={0.001}
              max={3}
              digits={4}
              log
              onChange={setStep}
            />
            {data && (
              <Figures
                tiles={[
                  {
                    key: "limit",
                    label: t("course.numerics.stiff.limit"),
                    value: data.rk4_max_step_s * 1000,
                    digits: 3,
                    unit: "ms",
                  },
                  { key: "min", label: t("course.numerics.stiff.min_steps"), value: data.rk4_min_steps, digits: 0 },
                  {
                    key: "rk4",
                    label: t("course.numerics.stiff.rk4_steps"),
                    value: data.rk4.steps,
                    digits: 0,
                    tone: data.rk4.stable ? "success" : "danger",
                    note: data.rk4.stable ? undefined : t("course.numerics.stiff.diverged"),
                  },
                  {
                    key: "implicit",
                    label: t("course.numerics.stiff.implicit_steps"),
                    value: data.implicit.steps,
                    digits: 0,
                    tone: "success",
                  },
                ]}
              />
            )}
          </>
        }
      >
        <Failed error={run.error} />
        {data && (
          <SeriesChart
            rows={rows}
            series={[
              { key: "exact", label: t("course.numerics.stiff.exact"), color: REFERENCE_GREY, dash: 1 },
              {
                key: "implicit",
                label: t("course.numerics.method.implicit"),
                color: hex[HUE.envelope],
                curve: "linear",
              },
              { key: "rk4", label: t("course.numerics.method.rk4"), color: hex[HUE.measuring], curve: "linear" },
            ]}
            axes={[
              {
                id: "y",
                title: `${t("course.numerics.stiff.slow")} (–)`,
                format: (v) => formatNumber(v, 2, locale),
                domain: [-0.5, 1.5],
              },
            ]}
            x={{ key: "x", title: `${t("course.axis.time")} (s)`, format: (v) => formatNumber(v, 0, locale) }}
            height="min(18rem, 50dvh)"
            valueFormat={(v) => formatNumber(v, 4, locale)}
            maxRows={PLOT_ROWS}
          />
        )}
      </WidgetBody>
    </WidgetCard>
  );
}
