/**
 * The shape every lesson has, in the order the course was written to be read:
 * a question from practice, the model that answers it (and what that model
 * leaves out), the experiments, what they showed, and exercises to try it on.
 *
 * The frame owns the parts every lesson shares — the header with the lesson's
 * number, the insights, the exercises drawn from the engine's list, the way to
 * the lessons either side — so a lesson module is only its own model and its
 * own widgets. Opening a lesson marks it visited on this device.
 *
 * Each page stands in the site's column (`PAGE_SHELL`) under the site's
 * header; Kurvenschmiede's strip of every lesson did not come along, so the
 * way through is the previous and next links under each page.
 */

import { useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, CircleHelp, Sparkles } from "lucide-react";
import { Button, Card, CardHeader, CardTitle, LoadingState, PageHeader, SectionLabel, usePageSeo } from "@eifi1/ui-kit";
import { PAGE_SHELL } from "@/shared/ui/page-shell";
import type { Lesson } from "@/shared/types";
import { ExerciseCard } from "./exercise";
import { lessonEntry, neighbours } from "./lessons";
import { Assumptions } from "./parts";
import { useCourseProgress } from "./progress";
import { useCourseDefaults } from "./use-dynamics";

export function LessonFrame({
  lesson,
  question,
  model,
  assumptions,
  insights,
  children,
}: {
  lesson: Lesson;
  question: string;
  model: ReactNode;
  assumptions: string[];
  insights: string[];
  /** The experiments. */
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const entry = lessonEntry(lesson);
  const defaults = useCourseDefaults();
  useLesson(lesson);
  const exercises = defaults.data?.exercises.filter((e) => e.lesson === lesson) ?? [];

  return (
    <div className={PAGE_SHELL}>
      <PageHeader
        size="sm"
        eyebrow={t("course.lesson_n", { n: entry.number })}
        title={t(`course.lessons.${lesson}.title`)}
        description={t(`course.lessons.${lesson}.summary`)}
      />

      <Card padding="md" density="compact" className="border-l-4 border-l-brand">
        <div className="flex gap-3">
          <CircleHelp className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
          <div>
            <SectionLabel as="h2">{t("course.frame.question")}</SectionLabel>
            <p className="mt-1 text-sm text-primary">{question}</p>
          </div>
        </div>
      </Card>

      <Card padding="md" density="compact" className="space-y-3">
        <CardHeader>
          <CardTitle as="h2">{t("course.frame.model")}</CardTitle>
        </CardHeader>
        <div className="space-y-3 text-sm text-secondary">{model}</div>
        <Assumptions items={assumptions} />
      </Card>

      <section className="space-y-4" aria-labelledby="experiments">
        <SectionLabel as="h2" id="experiments">
          {t("course.frame.experiments")}
        </SectionLabel>
        {children}
      </section>

      <Card padding="md" density="compact" className="space-y-2">
        <CardHeader>
          <CardTitle as="h2">{t("course.frame.insights")}</CardTitle>
        </CardHeader>
        <ul className="space-y-2">
          {insights.map((insight) => (
            <li key={insight} className="flex gap-2 text-sm text-secondary">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              <span>{insight}</span>
            </li>
          ))}
        </ul>
      </Card>

      {(exercises.length > 0 || defaults.isPending) && (
        <section className="space-y-3" aria-labelledby="exercises">
          <SectionLabel as="h2" id="exercises">
            {t("course.frame.exercises")}
          </SectionLabel>
          {defaults.isPending ? (
            <LoadingState className="py-6" label={t("common.loading")} />
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {exercises.map((exercise) => (
                <ExerciseCard key={exercise.key} exercise={exercise} />
              ))}
            </div>
          )}
        </section>
      )}

      <LessonNavigation lesson={lesson} />
    </div>
  );
}

/**
 * What every page of the course does on opening: names itself to the browser
 * and to a search engine (its address, its title, its summary — or, for the
 * course's front page, the course's), and notes the lesson as opened on this
 * device.
 */
export function useLesson(lesson: Lesson, seo?: { title: string; description: string }) {
  const { t } = useTranslation();
  const entry = lessonEntry(lesson);
  usePageSeo({
    canonicalPath: entry.path,
    title: `${seo?.title ?? t(`course.lessons.${lesson}.title`)} — ${t("app.name")}`,
    description: seo?.description ?? t(`course.lessons.${lesson}.summary`),
  });
  const visit = useCourseProgress((s) => s.visit);
  // Storage is a system outside React: noting the visit is exactly what an
  // effect is for, and it runs once per lesson opened.
  useEffect(() => visit(lesson), [lesson, visit]);
}

export function LessonNavigation({ lesson }: { lesson: Lesson }) {
  const { t } = useTranslation();
  const { previous, next } = neighbours(lesson);
  return (
    <nav aria-label={t("course.frame.lesson_navigation")} className="flex flex-wrap justify-between gap-2 pt-2">
      {previous ? (
        <Button variant="secondary" href={previous.path}>
          <ArrowLeft className="size-4" aria-hidden />
          {t(`course.lessons.${previous.lesson}.title`)}
        </Button>
      ) : (
        <span />
      )}
      {next && (
        <Button variant="accent" href={next.path}>
          {t(`course.lessons.${next.lesson}.title`)}
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      )}
    </nav>
  );
}
