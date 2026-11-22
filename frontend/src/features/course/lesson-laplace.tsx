/**
 * Lesson 4: Laplace as a tool, Bode as a sum, and a hysteresis a filter
 * invents.
 *
 * The PT1 step solved the Laplace way with every line's numbers; a chain of up
 * to four blocks whose Bode plot is drawn as the sum it is, each block dashed
 * under the total; and a test object with no hysteresis at all whose torque,
 * filtered on its own, draws a loop. Frequencies are on logarithmic axes drawn
 * as `log₁₀` (the kit's charts are linear; `parts.logX`).
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import {
  Button,
  IconButton,
  Select,
  SharedXZoom,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  ToggleGroup,
} from "@eifi1/ui-kit";
import { courseApi } from "@/shared/api/endpoints";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber } from "@/shared/lib/format";
import { useChartHex } from "@/shared/state/palette-store";
import { PLOT_ROWS, SeriesChart } from "@/shared/charts/series-chart";
import { NumberField } from "@/shared/ui/number-field";
import type { Block, BlockKind, FilterMode, FilterRequest, LaplaceRequest } from "@/shared/types";
import { HUE, REFERENCE_GREY } from "./colours";
import { LessonFrame } from "./lesson-frame";
import { logX } from "@/shared/charts/log-axis";
import { Failed, Figures, Param, WidgetBody, WidgetCard } from "./parts";
import { PolePlane } from "./pole-plane";
import { Tex, texNumber } from "@/shared/ui/tex";
import { useComputed } from "./use-course";

const LAPLACE: LaplaceRequest = { time_constant_s: 2, gain: 1, step: 3, start: 0 };
const KINDS: BlockKind[] = ["proportional", "integrator", "first_order", "second_order", "dead_time"];

function block(kind: BlockKind): Block {
  return { kind, gain: 1, time_constant_s: 0.1, f0_hz: 15.92, damping: 0.05, dead_time_s: 0.01 };
}

/** The shaft of lesson 2 behind a 5 Hz filter — the specification's G4. */
const CHAIN: Block[] = [
  { ...block("second_order") },
  { ...block("first_order"), time_constant_s: 1 / (2 * Math.PI * 5) },
];

export function LaplaceLesson() {
  const { t } = useTranslation();
  return (
    <LessonFrame
      lesson="laplace"
      question={t("course.laplace.question")}
      model={
        <>
          <p>{t("course.laplace.model")}</p>
          <Tex
            block
            tex="\mathcal{L}\{\dot y\} = s\,Y(s) - y(0) \qquad G(s) = \frac{Y(s)}{U(s)} \qquad G_\text{chain} = G_1\cdot G_2\cdots \qquad |G|_\text{dB} = \sum_k |G_k|_\text{dB}"
          />
          <p>{t("course.laplace.model_delay")}</p>
          <Tex
            block
            tex="\Delta t = \frac{-\varphi}{360^\circ}\cdot T = \frac{-\varphi}{360^\circ\,f} \qquad G_\text{PT1}(j\omega) = \frac{K}{1 + j\omega\tau},\quad \varphi = -\arctan\omega\tau"
          />
        </>
      }
      assumptions={[
        t("course.laplace.assumptions.lti"),
        t("course.laplace.assumptions.steady"),
        t("course.laplace.assumptions.dead_time"),
      ]}
      insights={[
        t("course.laplace.insights.product"),
        t("course.laplace.insights.final"),
        t("course.laplace.insights.lag"),
        t("course.laplace.insights.filter"),
      ]}
    >
      <StepsWidget />
      <ChainWidget />
      <FilterWidget />
    </LessonFrame>
  );
}

function StepsWidget() {
  const { t } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  const [body, setBody] = useState(LAPLACE);
  const run = useComputed("laplace", body, courseApi.laplace);
  const data = run.data;
  const n = (v: number, d = 2) => texNumber(v, d, locale);
  const rows = data ? data.time_s.map((x, i) => ({ x, value: data.value[i] })) : [];
  return (
    <WidgetCard title={t("course.laplace.steps.title")} hint={t("course.laplace.steps.hint")}>
      <WidgetBody
        controls={
          <>
            <Param
              label="τ"
              unit="s"
              value={body.time_constant_s}
              min={0.1}
              max={10}
              step={0.1}
              digits={1}
              onChange={(v) => setBody({ ...body, time_constant_s: v })}
            />
            <Param
              label="K"
              unit=""
              value={body.gain}
              min={0.1}
              max={5}
              step={0.1}
              digits={1}
              onChange={(v) => setBody({ ...body, gain: v })}
            />
            <Param
              label="u₀"
              unit=""
              value={body.step}
              min={-5}
              max={5}
              step={0.5}
              digits={1}
              onChange={(v) => setBody({ ...body, step: v })}
            />
            <Param
              label="y₀"
              unit=""
              value={body.start ?? 0}
              min={-5}
              max={5}
              step={0.5}
              digits={1}
              onChange={(v) => setBody({ ...body, start: v })}
            />
          </>
        }
      >
        <Failed error={run.error} />
        {data && (
          <>
            <ol className="space-y-2 text-sm text-secondary">
              <li>
                <span className="font-medium text-primary">{t("course.laplace.steps.transform")}</span>
                <Tex
                  block
                  tex={`\\tau\\,(s\\,Y - y_0) + Y = \\frac{K\\,u_0}{s} \\;\\Rightarrow\\; ${n(data.time_constant_s, 1)}\\,(s\\,Y - ${n(data.start, 1)}) + Y = \\frac{${n(data.gain * data.step, 2)}}{s}`}
                />
              </li>
              <li>
                <span className="font-medium text-primary">{t("course.laplace.steps.solve")}</span>
                <Tex
                  block
                  tex={`Y(s) = \\frac{\\tau\\,y_0}{\\tau s + 1} + \\frac{K\\,u_0}{s\\,(\\tau s + 1)} = \\frac{${n(data.time_constant_s * data.start, 2)}}{${n(data.time_constant_s, 1)}\\,s + 1} + \\frac{${n(data.gain * data.step, 2)}}{s\\,(${n(data.time_constant_s, 1)}\\,s + 1)}`}
                />
              </li>
              <li>
                <span className="font-medium text-primary">{t("course.laplace.steps.split")}</span>
                <Tex
                  block
                  tex={`Y(s) = \\frac{A}{s} + \\frac{B}{s + 1/\\tau} = \\frac{${n(data.residue_zero)}}{s} ${data.residue_pole < 0 ? "-" : "+"} \\frac{${n(Math.abs(data.residue_pole))}}{s ${data.pole < 0 ? "+" : "-"} ${n(Math.abs(data.pole), 3)}}`}
                />
              </li>
              <li>
                <span className="font-medium text-primary">{t("course.laplace.steps.back")}</span>
                <Tex
                  block
                  tex={`y(t) = A + B\\,e^{-t/\\tau} = ${n(data.residue_zero)} ${data.residue_pole < 0 ? "-" : "+"} ${n(Math.abs(data.residue_pole))}\\,e^{-t/${n(data.time_constant_s, 1)}}`}
                />
              </li>
            </ol>
            <SeriesChart
              rows={rows}
              series={[{ key: "value", label: "y(t)", color: hex[HUE.measuring] }]}
              axes={[{ id: "y", title: "y (–)", format: (v) => formatNumber(v, 1, locale) }]}
              x={{ key: "x", title: `${t("course.axis.time")} (s)`, format: (v) => formatNumber(v, 0, locale) }}
              references={[{ axis: "y", value: data.final_value, label: "G(0)·u₀", tone: "muted", dash: 1 }]}
              height="min(14rem, 40dvh)"
              valueFormat={(v) => formatNumber(v, 3, locale)}
              maxRows={PLOT_ROWS}
            />
            <CorrespondenceTable />
          </>
        )}
      </WidgetBody>
    </WidgetCard>
  );
}

/** The handful of correspondences the lesson uses, as a reference beside it. */
function CorrespondenceTable() {
  const { t } = useTranslation();
  const rows: [string, string][] = [
    ["\\delta(t)", "1"],
    ["1 \\;(t \\ge 0)", "\\frac{1}{s}"],
    ["t", "\\frac{1}{s^2}"],
    ["e^{-t/\\tau}", "\\frac{\\tau}{\\tau s + 1}"],
    ["\\dot y(t)", "s\\,Y(s) - y(0)"],
    ["y(t - T_t)", "e^{-s T_t}\\,Y(s)"],
  ];
  return (
    <Table density="compact">
      <TableHead>
        <TableRow>
          <TableHeaderCell>{t("course.laplace.time_domain")}</TableHeaderCell>
          <TableHeaderCell>{t("course.laplace.image_domain")}</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map(([time, image]) => (
          <TableRow key={time}>
            <TableCell>
              <Tex tex={time} />
            </TableCell>
            <TableCell>
              <Tex tex={image} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ChainWidget() {
  const { t } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  const [blocks, setBlocks] = useState<Block[]>(CHAIN);
  const [cursor, setCursor] = useState(16);
  const run = useComputed("chain", { blocks, cursor_hz: cursor, f_min_hz: 0.1, f_max_hz: 1000 }, courseApi.chain);
  const data = run.data;
  const set = (i: number, patch: Partial<Block>) => setBlocks(blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const bodeRows = data
    ? data.frequency_hz.map((f, i) => {
        const row: Record<string, number> = { x: Math.log10(f), mag: data.magnitude_db[i], phase: data.phase_deg[i] };
        data.blocks.forEach((b, k) => {
          row[`b${k}`] = b.magnitude_db[i];
          row[`p${k}`] = b.phase_deg[i];
        });
        return row;
      })
    : [];
  const stepRows = data ? data.time_s.map((x, i) => ({ x, value: data.step[i] })) : [];
  const blockSeries = (prefix: string) =>
    (data?.blocks ?? []).map((_, k) => ({
      key: `${prefix}${k}`,
      label: `${k + 1} · ${t(`course.laplace.kind.${blocks[k]?.kind ?? "proportional"}`)}`,
      color: REFERENCE_GREY,
      dash: k + 1,
      strokeWidth: 1,
    }));
  return (
    <WidgetCard title={t("course.laplace.chain.title")} hint={t("course.laplace.chain.hint")}>
      <WidgetBody
        controls={
          <>
            {blocks.map((b, i) => (
              <div key={i} className="space-y-2 rounded-md border border-subtle p-3">
                <div className="flex items-end gap-2">
                  <Select
                    label={t("course.laplace.chain.block", { n: i + 1 })}
                    size="sm"
                    value={b.kind}
                    onChange={(e) => set(i, { kind: e.target.value as BlockKind })}
                    className="flex-1"
                  >
                    {KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {t(`course.laplace.kind.${kind}`)}
                      </option>
                    ))}
                  </Select>
                  <IconButton
                    label={t("course.laplace.chain.remove")}
                    disabled={blocks.length === 1}
                    onClick={() => setBlocks(blocks.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </IconButton>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {b.kind !== "dead_time" && (
                    <NumberField
                      label="K"
                      unit={b.kind === "integrator" ? "1/s" : ""}
                      value={b.gain}
                      digits={2}
                      onCommit={(v) => set(i, { gain: v })}
                    />
                  )}
                  {b.kind === "first_order" && (
                    <NumberField
                      label="τ"
                      unit="s"
                      value={b.time_constant_s}
                      digits={4}
                      onCommit={(v) => set(i, { time_constant_s: Math.max(v, 1e-4) })}
                    />
                  )}
                  {b.kind === "second_order" && (
                    <>
                      <NumberField
                        label="f₀"
                        unit="Hz"
                        value={b.f0_hz}
                        digits={2}
                        onCommit={(v) => set(i, { f0_hz: Math.max(v, 0.01) })}
                      />
                      <NumberField
                        label="D"
                        unit=""
                        value={b.damping}
                        digits={3}
                        onCommit={(v) => set(i, { damping: Math.max(v, 0) })}
                      />
                    </>
                  )}
                  {b.kind === "dead_time" && (
                    <NumberField
                      label="T_t"
                      unit="s"
                      value={b.dead_time_s}
                      digits={4}
                      onCommit={(v) => set(i, { dead_time_s: Math.max(v, 0) })}
                    />
                  )}
                </div>
              </div>
            ))}
            {blocks.length < 4 && (
              <Button size="sm" variant="secondary" onClick={() => setBlocks([...blocks, block("first_order")])}>
                <Plus className="size-4" aria-hidden />
                {t("course.laplace.chain.add")}
              </Button>
            )}
            <Param
              label={t("course.laplace.chain.cursor")}
              unit="Hz"
              value={cursor}
              min={0.1}
              max={1000}
              digits={2}
              log
              onChange={setCursor}
            />
          </>
        }
      >
        <Failed error={run.error} />
        {data && (
          <>
            <SharedXZoom>
              <div className="space-y-1">
                <SeriesChart
                  rows={bodeRows}
                  series={[
                    {
                      key: "mag",
                      label: t("course.laplace.chain.total"),
                      color: hex[HUE.measuring],
                      strokeWidth: 2.5,
                    },
                    ...blockSeries("b"),
                  ]}
                  axes={[
                    {
                      id: "y",
                      title: `${t("course.laplace.magnitude")} (dB)`,
                      format: (v) => formatNumber(v, 0, locale),
                    },
                  ]}
                  // The stack says its abscissa once, on the lower chart.
                  x={{ ...logX(`${t("course.axis.frequency")} (Hz)`, locale), title: undefined, ticks: false }}
                  references={[{ axis: "x", value: Math.log10(cursor), label: "f", tone: "info" }]}
                  height="min(16rem, 45dvh)"
                  valueFormat={(v) => `${formatNumber(v, 2, locale)} dB`}
                  maxRows={PLOT_ROWS}
                />
                <SeriesChart
                  rows={bodeRows}
                  series={[
                    {
                      key: "phase",
                      label: t("course.laplace.chain.total"),
                      color: hex[HUE.object],
                      strokeWidth: 2.5,
                    },
                    ...blockSeries("p"),
                  ]}
                  axes={[
                    { id: "y", title: `${t("course.figure.phase")} (°)`, format: (v) => formatNumber(v, 0, locale) },
                  ]}
                  x={logX(`${t("course.axis.frequency")} (Hz)`, locale)}
                  references={[{ axis: "x", value: Math.log10(cursor), label: "f", tone: "info" }]}
                  height="min(14rem, 40dvh)"
                  valueFormat={(v) => `${formatNumber(v, 1, locale)}°`}
                  maxRows={PLOT_ROWS}
                />
              </div>
            </SharedXZoom>
            <Figures
              tiles={[
                { key: "gain", label: t("course.laplace.chain.gain"), value: data.cursor.magnitude, digits: 3 },
                {
                  key: "db",
                  label: t("course.laplace.magnitude"),
                  value: data.cursor.magnitude_db,
                  digits: 2,
                  unit: "dB",
                },
                { key: "phase", label: t("course.figure.phase"), value: data.cursor.phase_deg, digits: 2, unit: "°" },
                {
                  key: "delay",
                  label: t("course.laplace.chain.delay"),
                  value: data.cursor.delay_s * 1000,
                  digits: 2,
                  unit: "ms",
                },
                { key: "static", label: "G(0)", value: data.static_gain, digits: 3 },
              ]}
            />
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div>
                <p className="mb-1 text-xs text-muted">{t("course.laplace.chain.poles")}</p>
                <PolePlane poles={data.poles} label={t("course.laplace.chain.poles")} />
              </div>
              <SeriesChart
                rows={stepRows}
                series={[{ key: "value", label: t("course.laplace.chain.step"), color: hex[HUE.measuring] }]}
                axes={[{ id: "y", title: "y (–)", format: (v) => formatNumber(v, 2, locale) }]}
                x={{ key: "x", title: `${t("course.axis.time")} (s)`, format: (v) => formatNumber(v, 2, locale) }}
                height="min(14rem, 40dvh)"
                valueFormat={(v) => formatNumber(v, 3, locale)}
                maxRows={PLOT_ROWS}
              />
            </div>
          </>
        )}
      </WidgetBody>
    </WidgetCard>
  );
}

function FilterWidget() {
  const { t } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  const [body, setBody] = useState<FilterRequest>({
    frequency_hz: 3,
    corner_hz: 5,
    mode: "torque_only",
    friction_nm: 0,
  });
  const run = useComputed("filter-loop", body, courseApi.filterLoop);
  const data = run.data;
  // Path order, not sorted: a loop doubles back on its abscissa.
  const rows = data
    ? [
        ...data.angle_deg.map((x, i) => ({ x, truth: data.torque[i] })),
        ...data.measured_angle_deg.map((x, i) => ({ x, measured: data.measured_torque[i] })),
      ]
    : [];
  return (
    <WidgetCard title={t("course.laplace.filter.title")} hint={t("course.laplace.filter.hint")}>
      <WidgetBody
        controls={
          <>
            <Param
              label={t("course.laplace.filter.frequency")}
              unit="Hz"
              value={body.frequency_hz}
              min={0.5}
              max={10}
              step={0.1}
              digits={1}
              onChange={(v) => setBody({ ...body, frequency_hz: v })}
            />
            <Param
              label={t("course.laplace.filter.corner")}
              unit="Hz"
              value={body.corner_hz}
              min={0.5}
              max={200}
              digits={1}
              log
              onChange={(v) => setBody({ ...body, corner_hz: v })}
            />
            <Param
              label={t("course.laplace.filter.friction")}
              unit="N·m"
              value={body.friction_nm ?? 0}
              min={0}
              max={5}
              step={0.1}
              digits={1}
              onChange={(v) => setBody({ ...body, friction_nm: v })}
            />
            <ToggleGroup
              label={t("course.laplace.filter.mode")}
              labelPlacement="above"
              size="sm"
              overflow="wrap"
              value={body.mode}
              onChange={(mode: FilterMode) => setBody({ ...body, mode })}
              options={(["torque_only", "both", "zero_phase"] as FilterMode[]).map((mode) => ({
                value: mode,
                label: t(`course.laplace.filter.modes.${mode}`),
              }))}
            />
          </>
        }
      >
        <Failed error={run.error} />
        {data && (
          <>
            <SeriesChart
              rows={rows}
              series={[
                { key: "truth", label: t("course.laplace.filter.truth"), color: REFERENCE_GREY, dash: 1 },
                { key: "measured", label: t("course.laplace.filter.measured"), color: hex[HUE.object] },
              ]}
              axes={[{ id: "y", title: `${t("course.axis.torque")} (N·m)`, format: (v) => formatNumber(v, 0, locale) }]}
              x={{ key: "x", title: `${t("course.axis.angle")} (°)`, format: (v) => formatNumber(v, 0, locale) }}
              height="min(20rem, 55dvh)"
              valueFormat={(v) => formatNumber(v, 2, locale)}
            />
            <Figures
              tiles={[
                {
                  key: "apparent",
                  label: t("course.laplace.filter.apparent"),
                  value: data.apparent_hysteresis,
                  digits: 2,
                  unit: "N·m",
                  tone: data.apparent_hysteresis > data.true_hysteresis + 0.05 ? "warning" : "success",
                },
                {
                  key: "true",
                  label: t("course.laplace.filter.true"),
                  value: data.true_hysteresis,
                  digits: 2,
                  unit: "N·m",
                },
                { key: "lag", label: t("course.figure.phase"), value: data.phase_lag_deg, digits: 1, unit: "°" },
                {
                  key: "delay",
                  label: t("course.laplace.chain.delay"),
                  value: data.delay_s * 1000,
                  digits: 1,
                  unit: "ms",
                },
              ]}
            />
          </>
        )}
      </WidgetBody>
    </WidgetCard>
  );
}
