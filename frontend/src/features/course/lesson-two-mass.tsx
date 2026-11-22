/**
 * Lesson 6: two inertias on two springs — modes, the absorber point, and the
 * misreading of a torque shaft with a heavy adapter behind it.
 *
 * The rig of the specification: motor J₁, measuring shaft c₁/d₁, column J₂,
 * torsion bar c₂/d₂ to ground, driven by 1 N·m of motor torque. One request
 * answers the whole widget (`two_mass.two_mass`): both modes with their shapes,
 * the hand estimate, the two antiresonances, the frequency response the Bode
 * chart draws, and the phasors at the excitation the animation turns. The
 * presets jump to the engine's own frequencies, so "mode 1" is the mode of
 * the rig as set, not of the defaults.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Chip, Disclosure, ToggleGroup } from "@eifi1/ui-kit";
import { courseApi } from "@/shared/api/endpoints";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber } from "@/shared/lib/format";
import { useChartHex } from "@/shared/state/palette-store";
import { PLOT_ROWS, SeriesChart } from "@/shared/charts/series-chart";
import type { Differentiator, TwoMassParameters } from "@/shared/types";
import { ChainAnimation } from "./chain-animation";
import { HUE, REFERENCE_GREY } from "./colours";
import { LessonFrame } from "./lesson-frame";
import { log10, logAxis, logX } from "@/shared/charts/log-axis";
import { Failed, Figures, Param, WidgetBody, WidgetCard } from "./parts";
import { Tex } from "@/shared/ui/tex";
import { useComputed, useCourseDefaults } from "./use-dynamics";

const FALLBACK: TwoMassParameters = {
  motor_inertia: 0.01,
  adapter_inertia: 0.05,
  shaft_stiffness: 500,
  bar_stiffness: 115,
  shaft_damping: 0.2,
  bar_damping: 0.3,
};

export function TwoMassLesson() {
  const { t } = useTranslation();
  const defaults = useCourseDefaults();
  const reference = defaults.data?.two_mass ?? FALLBACK;
  return (
    <LessonFrame
      lesson="two_mass"
      question={t("course.two_mass.question")}
      model={
        <>
          <p>{t("course.two_mass.model")}</p>
          <Tex
            block
            tex="\begin{pmatrix} J_1 & 0 \\ 0 & J_2 \end{pmatrix}\ddot{\boldsymbol\varphi} + \begin{pmatrix} d_1 & -d_1 \\ -d_1 & d_1 + d_2 \end{pmatrix}\dot{\boldsymbol\varphi} + \begin{pmatrix} c_1 & -c_1 \\ -c_1 & c_1 + c_2 \end{pmatrix}\boldsymbol\varphi = \begin{pmatrix} M \\ 0 \end{pmatrix}"
          />
          <p>{t("course.two_mass.model_reading")}</p>
          <Tex
            block
            tex="M_W = (c_1 + j\omega d_1)(\varphi_1 - \varphi_2),\quad M_T = (c_2 + j\omega d_2)\,\varphi_2,\quad \frac{M_W}{M_T} \approx 1 - \left(\frac{f}{f_a}\right)^2,\quad f_a = \frac{1}{2\pi}\sqrt{\frac{c_2}{J_2}}"
          />
        </>
      }
      assumptions={[
        t("course.two_mass.assumptions.lumped"),
        t("course.two_mass.assumptions.torque"),
        t("course.two_mass.assumptions.linear"),
      ]}
      insights={[
        t("course.two_mass.insights.count"),
        t("course.two_mass.insights.soft"),
        t("course.two_mass.insights.error"),
      ]}
    >
      <RigWidget reference={reference} />
      <CompensationWidget reference={reference} />
    </LessonFrame>
  );
}

function RigWidget({ reference }: { reference: TwoMassParameters }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  const [p, setP] = useState<TwoMassParameters | null>(null);
  const params = p ?? reference;
  const [excitation, setExcitation] = useState(3);
  const run = useComputed("two-mass", { parameters: params, excitation_hz: excitation }, courseApi.twoMass);
  const data = run.data;
  const set = (patch: Partial<TwoMassParameters>) => setP({ ...params, ...patch });
  const rows = data
    ? data.frequency_hz.map((f, i) => ({
        x: Math.log10(f),
        shaft: log10(data.shaft_magnitude[i]),
        bar: log10(data.bar_magnitude[i]),
      }))
    : [];
  const pt = data?.point;
  const presets = data
    ? [
        { key: "three", hz: 3 },
        ...(data.modes[0] ? [{ key: "mode1", hz: data.modes[0].frequency_hz }] : []),
        { key: "absorber", hz: data.absorber_hz },
        { key: "motor_still", hz: data.motor_still_hz },
        ...(data.modes[1] ? [{ key: "mode2", hz: data.modes[1].frequency_hz }] : []),
      ]
    : [];
  return (
    <WidgetCard
      title={t("course.two_mass.rig.title")}
      hint={t("course.two_mass.rig.hint")}
      actions={
        <Button variant="ghost" size="sm" onClick={() => setP(null)}>
          {t("course.reset")}
        </Button>
      }
    >
      <WidgetBody
        controls={
          <>
            <Param
              label={t("course.two_mass.excitation")}
              unit="Hz"
              value={excitation}
              min={1}
              max={60}
              digits={2}
              log
              onChange={setExcitation}
            />
            <div className="flex flex-wrap gap-2">
              {presets.map((preset) => (
                <Button
                  key={preset.key}
                  size="sm"
                  variant="secondary"
                  onClick={() => setExcitation(Math.min(60, Math.max(1, preset.hz)))}
                >
                  {preset.key === "three"
                    ? t(`course.two_mass.presets.${preset.key}`)
                    : `${t(`course.two_mass.presets.${preset.key}`)} · ${formatNumber(preset.hz, 2, locale)} Hz`}
                </Button>
              ))}
            </div>
            <Disclosure title={t("course.two_mass.parameters")} hint={t("course.two_mass.parameters_hint")}>
              <div className="space-y-3">
                <Param
                  label={t("course.two_mass.j1")}
                  unit="kg·m²"
                  value={params.motor_inertia}
                  min={0.001}
                  max={0.1}
                  digits={4}
                  log
                  onChange={(v) => set({ motor_inertia: v })}
                />
                <Param
                  label={t("course.two_mass.j2")}
                  unit="kg·m²"
                  value={params.adapter_inertia}
                  min={0.005}
                  max={0.2}
                  digits={4}
                  log
                  onChange={(v) => set({ adapter_inertia: v })}
                />
                <Param
                  label={t("course.two_mass.c1")}
                  unit="N·m/rad"
                  value={params.shaft_stiffness}
                  min={50}
                  max={5000}
                  digits={0}
                  log
                  onChange={(v) => set({ shaft_stiffness: v })}
                />
                <Param
                  label={t("course.two_mass.c2")}
                  unit="N·m/rad"
                  value={params.bar_stiffness}
                  min={20}
                  max={1000}
                  digits={0}
                  log
                  onChange={(v) => set({ bar_stiffness: v })}
                />
                <Param
                  label={t("course.two_mass.d1")}
                  unit="N·m·s/rad"
                  value={params.shaft_damping}
                  min={0}
                  max={5}
                  step={0.01}
                  digits={2}
                  onChange={(v) => set({ shaft_damping: v })}
                />
                <Param
                  label={t("course.two_mass.d2")}
                  unit="N·m·s/rad"
                  value={params.bar_damping}
                  min={0}
                  max={5}
                  step={0.01}
                  digits={2}
                  onChange={(v) => set({ bar_damping: v })}
                />
              </div>
            </Disclosure>
          </>
        }
      >
        <Failed error={run.error} />
        {data && pt && (
          <>
            <ChainAnimation
              phasors={[pt.motor, pt.adapter]}
              names={[t("course.two_mass.motor"), t("course.two_mass.adapter")]}
              groundRight
              label={t("course.two_mass.animation_label", { f: formatNumber(excitation, 2, locale) })}
            />
            <div className="flex flex-wrap gap-2">
              <Chip tone={pt.in_phase ? "info" : "warning"}>
                {t(pt.in_phase ? "course.two_mass.in_phase" : "course.two_mass.anti_phase")}
              </Chip>
            </div>
            <Figures
              tiles={[
                { key: "ratio", label: "|φ₂/φ₁|", value: pt.ratio.magnitude, digits: 3 },
                { key: "mw", label: "|M_W|", value: pt.shaft_torque.magnitude, digits: 3, unit: "N·m" },
                { key: "mt", label: "|M_T|", value: pt.bar_torque.magnitude, digits: 3, unit: "N·m" },
                { key: "reading", label: "|M_W/M_T|", value: pt.reading_ratio, digits: 3 },
                {
                  key: "error",
                  label: t("course.two_mass.error"),
                  value: pt.error_pct,
                  digits: 1,
                  unit: "%",
                  tone: pt.error_pct !== null && Math.abs(pt.error_pct) > 5 ? "warning" : "neutral",
                },
              ]}
            />
            <SeriesChart
              rows={rows}
              series={[
                { key: "shaft", label: t("course.two_mass.shaft_reads"), color: hex[HUE.measuring] },
                { key: "bar", label: t("course.two_mass.object_carries"), color: hex[HUE.object] },
              ]}
              axes={[logAxis("y", `${t("course.two_mass.per_motor_torque")} (–)`, locale)]}
              x={logX(`${t("course.axis.frequency")} (Hz)`, locale)}
              references={[
                { axis: "x", value: Math.log10(excitation), label: "f", tone: "info" },
                { axis: "x", value: Math.log10(data.absorber_hz), label: "f_a", tone: "muted", dash: 1 },
              ]}
              height="min(18rem, 50dvh)"
              valueFormat={(v) => formatNumber(10 ** v, 3, locale)}
              maxRows={PLOT_ROWS}
            />
            <Figures
              title={t("course.two_mass.modes")}
              tiles={[
                ...data.modes.flatMap((m, k) => [
                  {
                    key: `f${k}`,
                    label: t("course.two_mass.mode_f", { n: k + 1 }),
                    value: m.frequency_hz,
                    digits: 2,
                    unit: "Hz",
                  },
                  { key: `d${k}`, label: t("course.two_mass.mode_d", { n: k + 1 }), value: m.damping, digits: 3 },
                  {
                    key: `s${k}`,
                    label: t("course.two_mass.mode_shape", { n: k + 1 }),
                    value: m.shape[1],
                    digits: 3,
                  },
                ]),
                {
                  key: "hand",
                  label: t("course.two_mass.hand"),
                  value: data.hand_estimate_hz,
                  digits: 2,
                  unit: "Hz",
                },
                {
                  key: "hand_dev",
                  label: t("course.two_mass.hand_deviation"),
                  value: data.hand_deviation_pct,
                  digits: 1,
                  unit: "%",
                },
              ]}
            />
          </>
        )}
      </WidgetBody>
    </WidgetCard>
  );
}

function CompensationWidget({ reference }: { reference: TwoMassParameters }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  const [excitation, setExcitation] = useState(5);
  const [noise, setNoise] = useState(2e-5);
  const [rate, setRate] = useState(1000);
  const [differentiator, setDifferentiator] = useState<Differentiator>("zero_phase");
  const [corner, setCorner] = useState(30);
  const run = useComputed(
    "compensation",
    {
      parameters: reference,
      excitation_hz: excitation,
      noise_rad: noise,
      sample_rate_hz: rate,
      differentiator,
      corner_hz: corner,
    },
    courseApi.compensation,
  );
  const data = run.data;
  const rows = data
    ? data.time_s.map((x, i) => ({
        x: x * 1000,
        bar: data.bar_torque[i],
        shaft: data.shaft_torque[i],
        comp: data.compensated[i],
      }))
    : [];
  return (
    <WidgetCard title={t("course.two_mass.compensation.title")} hint={t("course.two_mass.compensation.hint")}>
      <WidgetBody
        controls={
          <>
            <Param
              label={t("course.two_mass.excitation")}
              unit="Hz"
              value={excitation}
              min={1}
              max={20}
              step={0.5}
              digits={1}
              onChange={setExcitation}
            />
            <Param
              label={t("course.two_mass.compensation.noise")}
              unit="µrad"
              value={noise * 1e6}
              min={0.1}
              max={1000}
              digits={1}
              log
              onChange={(v) => setNoise(v / 1e6)}
            />
            <Param
              label={t("course.two_mass.compensation.rate")}
              unit="Hz"
              value={rate}
              min={400}
              max={10000}
              digits={0}
              log
              onChange={setRate}
            />
            <ToggleGroup
              label={t("course.two_mass.compensation.filter")}
              labelPlacement="above"
              size="sm"
              overflow="wrap"
              value={differentiator}
              onChange={setDifferentiator}
              options={(["none", "lowpass", "zero_phase"] as Differentiator[]).map((d) => ({
                value: d,
                label: t(`course.two_mass.compensation.filters.${d}`),
              }))}
            />
            {differentiator !== "none" && (
              <Param
                label={t("course.laplace.filter.corner")}
                unit="Hz"
                value={corner}
                min={5}
                max={500}
                digits={0}
                log
                onChange={setCorner}
              />
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
                {
                  key: "bar",
                  label: t("course.two_mass.object_carries"),
                  color: REFERENCE_GREY,
                  dash: 1,
                  strokeWidth: 2,
                },
                { key: "shaft", label: t("course.two_mass.shaft_reads"), color: hex[HUE.measuring] },
                {
                  key: "comp",
                  label: t("course.two_mass.compensation.corrected"),
                  color: hex[HUE.object],
                  strokeWidth: 1.25,
                },
              ]}
              axes={[{ id: "y", title: `${t("course.axis.torque")} (N·m)`, format: (v) => formatNumber(v, 2, locale) }]}
              x={{ key: "x", title: `${t("course.axis.time")} (ms)`, format: (v) => formatNumber(v, 0, locale) }}
              height="min(18rem, 50dvh)"
              valueFormat={(v) => `${formatNumber(v, 3, locale)} N·m`}
              maxRows={PLOT_ROWS}
            />
            <Figures
              tiles={[
                {
                  key: "raw",
                  label: t("course.two_mass.compensation.raw_error"),
                  value: data.uncompensated_error,
                  digits: 4,
                  unit: "N·m",
                },
                {
                  key: "comp",
                  label: t("course.two_mass.compensation.comp_error"),
                  value: data.compensated_error,
                  digits: 4,
                  unit: "N·m",
                  tone: data.compensated_error < data.uncompensated_error ? "success" : "danger",
                },
                {
                  key: "noise",
                  label: t("course.two_mass.compensation.noise_price"),
                  value: data.noise_torque,
                  digits: 4,
                  unit: "N·m",
                },
              ]}
            />
          </>
        )}
      </WidgetBody>
    </WidgetCard>
  );
}
