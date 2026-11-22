/**
 * The course's front page and its lesson 0: the recipe every technical
 * differential equation is written by, one balance worked through, and the way
 * into the six lessons and the cheat sheet.
 *
 * The balance is a tank, because nothing about it needs a formula to believe —
 * water in at a rate somebody sets, out the faster the higher it stands — and
 * writing that down *is* a first-order lag (`domain/course/first_order.tank`).
 * Every number on the page is the engine's; the tiles' progress is this
 * device's (`progress.ts`).
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RotateCcw } from "lucide-react";
import {
  ActionCard,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
  ProgressBar,
} from "@eifi1/ui-kit";
import { courseApi } from "@/shared/api/endpoints";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber } from "@/shared/lib/format";
import { useChartHex } from "@/shared/state/palette-store";
import { PAGE_SHELL } from "@/shared/ui/page-shell";
import { PLOT_ROWS, SeriesChart } from "@/shared/charts/series-chart";
import type { Lesson, TankRequest } from "@/shared/types";
import { HUE, REFERENCE_GREY } from "./colours";
import { formatSig } from "@/shared/lib/format";
import { LESSONS } from "./lessons";
import { LessonNavigation, useLesson } from "./lesson-frame";
import { Failed, Figures, Param, WidgetBody, WidgetCard } from "./parts";
import { useCourseProgress } from "./progress";
import { Tex, texNumber } from "@/shared/ui/tex";
import { useComputed, useCourseDefaults } from "./use-dynamics";

/** The recipe's eight steps, in order. */
const RECIPE = ["question", "boundary", "coordinate", "balance", "normalise", "solve", "check", "interpret"] as const;

const TANK: TankRequest = { inflow_lps: 5, area_m2: 0.5, outflow_lps_per_m: 10, level0_m: 0 };

export function CourseOverviewPage() {
  const { t } = useTranslation();
  useLesson("recipe", { title: t("course.title"), description: t("course.tagline") });
  return (
    <div className={PAGE_SHELL}>
      <PageHeader size="sm" title={t("course.title")} description={t("course.tagline")} />
      <Card padding="md" density="compact" className="space-y-2">
        <p className="text-sm text-secondary">{t("course.overview.why")}</p>
        <p className="text-sm text-secondary">{t("course.overview.how")}</p>
      </Card>
      <Recipe />
      <TankWidget />
      <LessonTiles />
      <Surprises />
      <LessonNavigation lesson="recipe" />
    </div>
  );
}

function Recipe() {
  const { t } = useTranslation();
  return (
    <Card padding="md" density="compact" className="space-y-3">
      <CardHeader>
        <CardTitle as="h2">{t("course.recipe.title")}</CardTitle>
        <CardDescription>{t("course.recipe.hint")}</CardDescription>
      </CardHeader>
      <ol className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {RECIPE.map((step, i) => (
          <li key={step} className="flex gap-3 rounded-md border border-subtle p-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand">
              {i + 1}
            </span>
            <span className="text-sm">
              <span className="font-medium text-primary">{t(`course.recipe.steps.${step}.title`)}</span>
              <span className="block text-secondary">{t(`course.recipe.steps.${step}.body`)}</span>
            </span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function TankWidget() {
  const { t } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  const [tank, setTank] = useState(TANK);
  const run = useComputed("tank", tank, courseApi.tank);
  const data = run.data;
  const rows = data
    ? data.time_s.map((x, i) => ({ x, level: data.level_m[i], outflow: data.outflow_lps[i], inflow: data.inflow_lps }))
    : [];
  const n = (v: number, d: number) => texNumber(v, d, locale);
  return (
    <WidgetCard
      title={t("course.recipe.tank.title")}
      hint={t("course.recipe.tank.hint")}
      actions={
        <Button variant="ghost" size="sm" onClick={() => setTank(TANK)}>
          <RotateCcw className="size-4" aria-hidden />
          {t("course.reset")}
        </Button>
      }
    >
      <WidgetBody
        controls={
          <>
            <Param
              label={t("course.recipe.tank.inflow")}
              unit="L/s"
              value={tank.inflow_lps}
              min={0}
              max={20}
              step={0.5}
              digits={1}
              onChange={(v) => setTank({ ...tank, inflow_lps: v })}
            />
            <Param
              label={t("course.recipe.tank.area")}
              unit="m²"
              value={tank.area_m2}
              min={0.1}
              max={2}
              step={0.05}
              digits={2}
              onChange={(v) => setTank({ ...tank, area_m2: v })}
            />
            <Param
              label={t("course.recipe.tank.outflow")}
              unit="L/(s·m)"
              value={tank.outflow_lps_per_m}
              min={2}
              max={50}
              step={0.5}
              digits={1}
              onChange={(v) => setTank({ ...tank, outflow_lps_per_m: v })}
            />
            <Param
              label={t("course.recipe.tank.level0")}
              unit="m"
              value={tank.level0_m ?? 0}
              min={0}
              max={4}
              step={0.05}
              digits={2}
              onChange={(v) => setTank({ ...tank, level0_m: v })}
            />
          </>
        }
      >
        <Failed error={run.error} />
        {data && (
          <>
            <Tex
              block
              tex={`A\\,\\dot h = q_\\text{in} - k\\,h \\;\\Rightarrow\\; \\underbrace{\\frac{A}{k}}_{\\tau}\\,\\dot h + h = \\frac{q_\\text{in}}{k},\\qquad \\tau = ${n(data.time_constant_s, 1)}\\,\\text{s},\\; h_\\infty = ${n(data.level_final_m, 3)}\\,\\text{m}`}
            />
            <SeriesChart
              rows={rows}
              series={[
                { key: "level", label: t("course.recipe.tank.level"), color: hex[HUE.measuring], axis: "h" },
                { key: "outflow", label: t("course.recipe.tank.outflow_series"), color: hex[HUE.object], axis: "q" },
                {
                  key: "inflow",
                  label: t("course.recipe.tank.inflow_series"),
                  color: REFERENCE_GREY,
                  axis: "q",
                  dash: 1,
                },
              ]}
              axes={[
                { id: "h", title: `${t("course.recipe.tank.level")} (m)`, format: (v) => formatNumber(v, 2, locale) },
                {
                  id: "q",
                  orientation: "right",
                  title: `${t("course.recipe.tank.flow")} (L/s)`,
                  format: (v) => formatNumber(v, 1, locale),
                },
              ]}
              x={{ key: "x", title: `${t("course.axis.time")} (s)`, format: (v) => formatNumber(v, 0, locale) }}
              references={[{ axis: "x", value: data.time_constant_s, label: "τ", tone: "muted" }]}
              height="min(18rem, 50dvh)"
              valueFormat={(v) => formatNumber(v, 3, locale)}
              maxRows={PLOT_ROWS}
            />
            <Figures
              tiles={[
                {
                  key: "tau",
                  label: t("course.figure.time_constant"),
                  value: data.time_constant_s,
                  digits: 1,
                  unit: "s",
                },
                {
                  key: "final",
                  label: t("course.recipe.tank.final"),
                  value: data.level_final_m,
                  digits: 3,
                  unit: "m",
                },
              ]}
            />
            <p className="text-sm text-secondary">{t("course.recipe.tank.insight")}</p>
          </>
        )}
      </WidgetBody>
    </WidgetCard>
  );
}

function LessonTiles() {
  const { t } = useTranslation();
  const locale = useLocale();
  const defaults = useCourseDefaults();
  const visited = useCourseProgress((s) => s.visited);
  const records = useCourseProgress((s) => s.exercises);
  const forget = useCourseProgress((s) => s.forget);
  const exercises = defaults.data?.exercises ?? [];
  const solved = exercises.filter((e) => records[e.key]?.solved).length;
  const per = (lesson: Lesson) => exercises.filter((e) => e.lesson === lesson);
  return (
    <Card padding="md" density="compact" className="space-y-4">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle as="h2">{t("course.overview.lessons")}</CardTitle>
            <CardDescription>{t("course.overview.lessons_hint")}</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={forget}>
            <RotateCcw className="size-4" aria-hidden />
            {t("course.overview.forget")}
          </Button>
        </div>
      </CardHeader>
      {exercises.length > 0 && (
        <ProgressBar
          label={t("course.overview.progress")}
          value={solved}
          max={exercises.length}
          showValue
          formatValue={(v, max) =>
            t("course.overview.solved", { solved: formatSig(v, locale), total: formatSig(max, locale) })
          }
          tone="success"
        />
      )}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {LESSONS.filter((entry) => entry.lesson !== "recipe").map((entry) => {
          const own = per(entry.lesson);
          const done = own.filter((e) => records[e.key]?.solved).length;
          const meta = [
            visited.includes(entry.lesson) ? t("course.overview.visited") : null,
            own.length ? t("course.overview.exercises_done", { done, total: own.length }) : null,
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <ActionCard
              key={entry.path}
              href={entry.path}
              title={
                entry.number === null
                  ? t(`course.lessons.${entry.lesson}.title`)
                  : `${entry.number} · ${t(`course.lessons.${entry.lesson}.title`)}`
              }
              description={t(`course.lessons.${entry.lesson}.summary`)}
              meta={meta || undefined}
              metaTone={own.length && done === own.length ? "success" : "muted"}
            />
          );
        })}
      </div>
    </Card>
  );
}

function Surprises() {
  const { t } = useTranslation();
  const locale = useLocale();
  const surprises = useCourseProgress((s) => s.surprises);
  return (
    <Card padding="md" density="compact" className="space-y-2">
      <CardHeader>
        <CardTitle as="h2">{t("course.overview.surprises")}</CardTitle>
        <CardDescription>{t("course.overview.surprises_hint")}</CardDescription>
      </CardHeader>
      {surprises.length === 0 ? (
        <p className="text-sm text-muted">{t("course.overview.no_surprises")}</p>
      ) : (
        <ul className="space-y-1 text-sm text-secondary">
          {surprises.map((s) => (
            <li key={s.exercise}>
              <span className="font-medium text-primary">{t(`course.exercises.${s.exercise}.title`)}</span>
              {" — "}
              {t("course.overview.surprise_entry", {
                estimate: formatSig(s.estimate, locale),
                answer: formatSig(s.answer, locale),
                unit: s.unit,
              })}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
