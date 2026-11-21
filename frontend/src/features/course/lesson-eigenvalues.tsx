/**
 * Lesson 3: eigenvalues as a decay rate and a frequency, eigenvectors as the
 * ways a system moves without turning.
 *
 * Three steps up: one eigenvalue (`ẋ = a·x`), a pair (a second-order system,
 * whose poles the reader may drag — the engine answers with the ω₀ and D the
 * dragged pole means, `eigen.pole_from`), and a general 2×2 matrix with its
 * phase portrait, where a trajectory started on an eigenvector stays on it.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Chip } from "@eifi1/ui-kit";
import { courseApi } from "@/shared/api/endpoints";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber } from "@/shared/lib/format";
import { useChartHex } from "@/shared/state/palette-store";
import { PLOT_ROWS, SeriesChart } from "@/shared/charts/series-chart";
import { NumberField } from "@/shared/ui/number-field";
import type { Complex, MatrixRequest, PolesRequest } from "@/shared/types";
import { HUE } from "./colours";
import { LessonFrame } from "./lesson-frame";
import { Failed, Figures, Param, WidgetBody, WidgetCard } from "./parts";
import { PhasePortrait } from "./phase-portrait";
import { PolePlane } from "./pole-plane";
import { Tex } from "@/shared/ui/tex";
import { useComputed } from "./use-dynamics";

/** The matrices the spec offers as starting points. */
const PRESETS: { key: string; matrix: MatrixRequest }[] = [
  { key: "spring", matrix: { a11: 0, a12: 1, a21: -4, a22: -1 } },
  { key: "saddle", matrix: { a11: 1, a12: 0, a21: 0, a22: -1 } },
  { key: "centre", matrix: { a11: 0, a12: 1, a21: -1, a22: 0 } },
  { key: "spiral", matrix: { a11: 0.3, a12: 1, a21: -1, a22: 0.3 } },
];

export function EigenvaluesLesson() {
  const { t } = useTranslation();
  return (
    <LessonFrame
      lesson="eigenvalues"
      question={t("course.eigenvalues.question")}
      model={
        <>
          <p>{t("course.eigenvalues.model")}</p>
          <Tex
            block
            tex="\dot{\mathbf x} = A\,\mathbf x,\qquad \det(A - \lambda I) = 0,\qquad \mathbf x(t) = \sum_k c_k\,\mathbf v_k\,e^{\lambda_k t}"
          />
          <p>{t("course.eigenvalues.model_pair")}</p>
          <Tex
            block
            tex="A = \begin{pmatrix} 0 & 1 \\ -c/m & -d/m \end{pmatrix} \;\Rightarrow\; \lambda_{1,2} = \omega_0\left(-D \pm \sqrt{D^2 - 1}\right) = \sigma \pm j\,\omega_d"
          />
        </>
      }
      assumptions={[t("course.eigenvalues.assumptions.linear"), t("course.eigenvalues.assumptions.minimal")]}
      insights={[
        t("course.eigenvalues.insights.parts"),
        t("course.eigenvalues.insights.same"),
        t("course.eigenvalues.insights.vectors"),
      ]}
    >
      <ScalarWidget />
      <PolesWidget />
      <MatrixWidget />
    </LessonFrame>
  );
}

function ScalarWidget() {
  const { t } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  const [rate, setRate] = useState(-1);
  const run = useComputed("scalar", { rate }, courseApi.scalar);
  const data = run.data;
  const rows = data ? data.time_s.map((x, i) => ({ x, value: data.value[i] })) : [];
  return (
    <WidgetCard title={t("course.eigenvalues.scalar.title")} hint={t("course.eigenvalues.scalar.hint")}>
      <WidgetBody
        controls={
          <Param label="a" unit="1/s" value={rate} min={-5} max={2} step={0.05} digits={2} onChange={setRate} />
        }
      >
        <Failed error={run.error} />
        {data && (
          <>
            <Chip tone={data.stable ? "success" : data.rate === 0 ? "neutral" : "danger"}>
              {t(
                data.stable
                  ? "course.eigenvalues.stable"
                  : data.rate === 0
                    ? "course.eigenvalues.marginal"
                    : "course.eigenvalues.unstable",
              )}
            </Chip>
            <SeriesChart
              rows={rows}
              series={[
                { key: "value", label: "x(t) = e^{at}", color: data.stable ? hex[HUE.measuring] : hex[HUE.pole] },
              ]}
              axes={[{ id: "y", title: "x (–)", format: (v) => formatNumber(v, 1, locale) }]}
              x={{ key: "x", title: `${t("course.axis.time")} (s)`, format: (v) => formatNumber(v, 1, locale) }}
              height="min(14rem, 40dvh)"
              valueFormat={(v) => formatNumber(v, 3, locale)}
              maxRows={PLOT_ROWS}
            />
            <Figures
              tiles={[
                {
                  key: "tau",
                  label: t("course.figure.time_constant"),
                  value: data.time_constant_s,
                  digits: 2,
                  unit: "s",
                },
                {
                  key: "double",
                  label: t("course.eigenvalues.doubling"),
                  value: data.doubling_time_s,
                  digits: 2,
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

function PolesWidget() {
  const { t } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  const [body, setBody] = useState<PolesRequest>({ f0_hz: 10, damping: 0.2 });
  const run = useComputed("poles", body, courseApi.poles);
  const data = run.data;
  const rows = data
    ? data.time_s.map((x, i) => ({
        x: x * 1000,
        value: data.value[i],
        upper: data.envelope_upper[i],
        lower: data.envelope_lower[i],
      }))
    : [];
  // While a pole is being dragged the sliders show what the engine made of it.
  const f0 = data?.f0_hz ?? body.f0_hz ?? 10;
  const damping = data?.damping ?? body.damping ?? 0.2;
  const pole = (p: Complex) =>
    `${formatNumber(p.re, 1, locale)} ${p.im < 0 ? "−" : "+"} j·${formatNumber(Math.abs(p.im), 1, locale)}`;
  return (
    <WidgetCard title={t("course.eigenvalues.poles.title")} hint={t("course.eigenvalues.poles.hint")}>
      <WidgetBody
        controls={
          <>
            <Param
              label="f₀"
              unit="Hz"
              value={f0}
              min={3}
              max={30}
              step={0.1}
              digits={1}
              onChange={(v) => setBody({ f0_hz: v, damping })}
            />
            <Param
              label={t("course.second_order.ratio")}
              unit=""
              value={damping}
              min={0}
              max={1.5}
              step={0.01}
              digits={2}
              onChange={(v) => setBody({ f0_hz: f0, damping: v })}
            />
            {data && (
              <PolePlane
                poles={data.poles}
                omega0={2 * Math.PI * data.f0_hz}
                onDrag={(re, im) => setBody({ real: re, imag: im })}
                label={t("course.eigenvalues.poles.plane", { poles: data.poles.map(pole).join(", ") })}
              />
            )}
          </>
        }
      >
        <Failed error={run.error} />
        {data && (
          <>
            <Chip tone={data.stable ? "success" : "danger"}>
              {t(data.stable ? "course.eigenvalues.stable" : "course.eigenvalues.unstable")} ·{" "}
              {t(`course.regime.${data.regime}`)}
            </Chip>
            <SeriesChart
              rows={rows}
              series={[
                { key: "value", label: t("course.eigenvalues.poles.response"), color: hex[HUE.measuring] },
                { key: "upper", label: "e^{σt}", color: hex[HUE.envelope], dash: 1, strokeWidth: 1 },
                { key: "lower", label: "e^{σt}", color: hex[HUE.envelope], dash: 1, strokeWidth: 1 },
              ]}
              axes={[{ id: "y", title: "y (–)", format: (v) => formatNumber(v, 1, locale) }]}
              x={{ key: "x", title: `${t("course.axis.time")} (ms)`, format: (v) => formatNumber(v, 0, locale) }}
              height="min(18rem, 50dvh)"
              valueFormat={(v) => formatNumber(v, 3, locale)}
              maxRows={PLOT_ROWS}
            />
            <Figures
              tiles={[
                { key: "re", label: "σ = Re λ", value: data.real_part, digits: 2, unit: "1/s" },
                { key: "im", label: "Im λ / 2π", value: data.imag_hz, digits: 2, unit: "Hz" },
                { key: "f0", label: "f₀ = |λ|/2π", value: data.f0_hz, digits: 2, unit: "Hz" },
                { key: "d", label: "D = −σ/|λ|", value: data.damping, digits: 3 },
                {
                  key: "overshoot",
                  label: t("course.figure.overshoot"),
                  value: data.overshoot === null ? null : data.overshoot * 100,
                  digits: 1,
                  unit: "%",
                },
              ]}
            />
            <p className="text-xs text-muted">λ₁,₂ = {data.poles.map(pole).join(", ")} 1/s</p>
          </>
        )}
      </WidgetBody>
    </WidgetCard>
  );
}

function MatrixWidget() {
  const { t } = useTranslation();
  const locale = useLocale();
  const [matrix, setMatrix] = useState<MatrixRequest>(PRESETS[0].matrix);
  const run = useComputed("matrix", matrix, courseApi.matrix);
  const data = run.data;
  const SUB: Record<keyof MatrixRequest, string> = { a11: "a₁₁", a12: "a₁₂", a21: "a₂₁", a22: "a₂₂" };
  const cell = (key: keyof MatrixRequest) => (
    <NumberField
      label={SUB[key]}
      unit=""
      value={matrix[key]}
      digits={2}
      className="w-28"
      onCommit={(v) => setMatrix({ ...matrix, [key]: Math.max(-100, Math.min(100, v)) })}
    />
  );
  const lam = (z: Complex) =>
    Math.abs(z.im) < 1e-9
      ? formatNumber(z.re, 3, locale)
      : `${formatNumber(z.re, 3, locale)} ${z.im < 0 ? "−" : "+"} j·${formatNumber(Math.abs(z.im), 3, locale)}`;
  return (
    <WidgetCard title={t("course.eigenvalues.matrix.title")} hint={t("course.eigenvalues.matrix.hint")}>
      <WidgetBody
        controls={
          <>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <Button key={preset.key} size="sm" variant="secondary" onClick={() => setMatrix(preset.matrix)}>
                  {t(`course.eigenvalues.matrix.presets.${preset.key}`)}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl text-muted">A =</span>
              <div className="grid grid-cols-2 gap-2">
                {cell("a11")}
                {cell("a12")}
                {cell("a21")}
                {cell("a22")}
              </div>
            </div>
          </>
        }
      >
        <Failed error={run.error} />
        {data && (
          <>
            <Chip tone="brand">{t(`course.eigenvalues.matrix.kind.${data.kind}`)}</Chip>
            <PhasePortrait
              trajectories={data.trajectories}
              eigenvectors={data.eigenvectors}
              label={t("course.eigenvalues.matrix.portrait", {
                kind: t(`course.eigenvalues.matrix.kind.${data.kind}`),
              })}
            />
            <Figures
              tiles={[
                { key: "trace", label: t("course.eigenvalues.matrix.trace"), value: data.trace, digits: 3 },
                { key: "det", label: t("course.eigenvalues.matrix.det"), value: data.determinant, digits: 3 },
              ]}
            />
            <p className="text-sm text-secondary">
              λ₁ = {lam(data.eigenvalues[0])}, λ₂ = {lam(data.eigenvalues[1])}
              {data.eigenvectors.length > 0 &&
                ` · ${t("course.eigenvalues.matrix.vectors")}: ${data.eigenvectors
                  .map((v) => `(${formatNumber(v.x1, 3, locale)}, ${formatNumber(v.x2, 3, locale)})`)
                  .join(", ")}`}
            </p>
          </>
        )}
      </WidgetBody>
    </WidgetCard>
  );
}
