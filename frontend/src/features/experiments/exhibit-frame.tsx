/**
 * The shape every exhibit's page has, in the order a visit goes: what stands
 * at the exhibit, the exhibit's twin to play with, what happens (the
 * computation), the one insight that explains the trick, and where to go on.
 * `docs/experiments.md` ("The page") is the plan this follows.
 *
 * The frame owns the header and the order; an exhibit's page is only its own
 * drawing, model and insight.
 */

import { Children, Fragment, isValidElement, type ReactElement, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, ChevronRight, Cpu, FlaskConical, Lightbulb } from "lucide-react";
import { Button, Card, CardHeader, CardTitle, PageHeader, SectionLabel, TextLink } from "@eifi1/ui-kit";
import { PAGE_SHELL } from "@/shared/ui/page-shell";
import { lessonEntry } from "@/features/course/lessons";
import { EXHIBITS, EXHIBITS_PATH, exhibitEntry, type CourseLesson, type Exhibit } from "./exhibits";
import { useTried } from "./tried";
import { CheckSection } from "./check-section";
import { CheckStatus } from "./unchecked-notice";

/** The course lesson a computation stands on, on this site since its lessons
 *  0–6 moved in from Kurvenschmiede (Marcel, 2026-11-20: "Grundlagen sollte
 *  keine Weiterleitung auf Kurvenschmiede haben"). */
export function lessonPath(lesson: CourseLesson): string {
  return lessonEntry(lesson).path;
}

/** Prose at a reading measure: a paragraph across a wide screen ran to some
 *  250 characters a line, where 60 to 80 read well. Paragraphs only — the
 *  figures, charts and equations beside them keep the full width. */
const PROSE = "[&_p]:max-w-[75ch]";

/** The parts of a node given as one fragment or as several elements. */
function parts(node: ReactNode): ReactNode[] {
  if (isValidElement(node) && node.type === Fragment) {
    return Children.toArray((node as ReactElement<{ children?: ReactNode }>).props.children);
  }
  return Children.toArray(node);
}

/** The built exhibit after `exhibit` in the list, the first after the last. */
function nextExhibit(exhibit: Exhibit) {
  const built = EXHIBITS.filter((entry) => entry.path);
  const at = built.findIndex((entry) => entry.exhibit === exhibit);
  return built[(at + 1) % built.length];
}

export function ExhibitFrame({
  exhibit,
  atTheExhibit,
  whatHappens,
  computed,
  sweetSpot,
  children,
}: {
  exhibit: Exhibit;
  /** What a visitor sees and does. */
  atTheExhibit: ReactNode;
  /** The model, step by step. */
  whatHappens: ReactNode;
  /** How the engine computes it in time: the differential equations as one
   *  system and how they are solved — for the exhibits that move. */
  computed?: ReactNode;
  /** The one insight that explains the trick. */
  sweetSpot: ReactNode;
  /** The exhibit's twin. */
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const { lessons } = exhibitEntry(exhibit);
  const mark = useTried((state) => state.mark);
  const tried = () => mark(exhibit);
  const [first, ...rest] = parts(atTheExhibit);
  const next = nextExhibit(exhibit);
  return (
    <div className={PAGE_SHELL}>
      {/* The way back to the list, now that the header names no exhibit. */}
      <TextLink href={EXHIBITS_PATH} className="inline-flex w-fit items-center gap-1 text-sm">
        <ArrowLeft className="size-4" aria-hidden />
        {t("experiments.overview.all")}
      </TextLink>
      <PageHeader
        size="sm"
        eyebrow={t("experiments.frame.eyebrow")}
        title={t(`experiments.exhibits.${exhibit}.title`)}
        description={t(`experiments.exhibits.${exhibit}.summary`)}
      />

      <CheckStatus exhibit={exhibit} />

      <Card padding="md" density="compact" className="border-l-4 border-l-brand">
        <div className="flex gap-3">
          <FlaskConical className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
          <div className="min-w-0 space-y-2">
            <SectionLabel as="h2">{t("experiments.frame.at_the_exhibit")}</SectionLabel>
            {/* Its first paragraph, and the rest on request: the exhibit's
                twin is what the page is for, and it should not wait below
                two long paragraphs. */}
            <div className={`space-y-2 text-sm text-primary ${PROSE}`}>
              {first}
              {rest.length > 0 && (
                <details className="group">
                  <summary className="flex w-fit cursor-pointer list-none items-center gap-1 text-sm font-medium text-brand [&::-webkit-details-marker]:hidden">
                    <ChevronRight className="size-4 transition-transform group-open:rotate-90" aria-hidden />
                    {t("experiments.frame.more_at")}
                  </summary>
                  <div className="mt-2 space-y-2">{rest}</div>
                </details>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Anything the reader does in here is trying the exhibit: the
          overview ticks it from then on (`tried.ts`). Captured, so a control
          that stops its event still counts. */}
      <section className="space-y-4" aria-labelledby="try-it" onPointerDownCapture={tried} onKeyDownCapture={tried}>
        <SectionLabel as="h2" id="try-it">
          {t("experiments.frame.try_it")}
        </SectionLabel>
        {children}
      </section>

      <Card padding="md" density="compact" className="space-y-3">
        <CardHeader>
          <CardTitle as="h2">{t("experiments.frame.what_happens")}</CardTitle>
        </CardHeader>
        <div className={`space-y-3 text-sm text-secondary ${PROSE}`}>{whatHappens}</div>
      </Card>

      {computed && (
        <Card padding="md" density="compact" className="space-y-3">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Cpu className="size-5 shrink-0 text-brand" aria-hidden />
              <CardTitle as="h2">{t("experiments.frame.computed")}</CardTitle>
            </div>
          </CardHeader>
          <div className={`space-y-3 text-sm text-secondary ${PROSE}`}>{computed}</div>
          {lessons.length > 0 && (
            <nav aria-label={t("experiments.computed.course")} className="space-y-2">
              <p className="text-sm text-secondary">{t("experiments.computed.course")}</p>
              <div className="flex flex-wrap gap-2">
                {lessons.map((lesson) => (
                  <Button key={lesson} variant="secondary" size="sm" href={lessonPath(lesson)}>
                    {t(`experiments.computed.links.${lesson}`)}
                    <ArrowRight className="size-4" aria-hidden />
                  </Button>
                ))}
              </div>
            </nav>
          )}
        </Card>
      )}

      <Card padding="md" density="compact" className="space-y-3">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lightbulb className="size-5 shrink-0 text-success" aria-hidden />
            <CardTitle as="h2">{t("experiments.frame.sweet_spot")}</CardTitle>
          </div>
        </CardHeader>
        <div className={`space-y-3 text-sm text-secondary ${PROSE}`}>{sweetSpot}</div>
      </Card>

      <CheckSection exhibit={exhibit} />

      {/* Where to go on: back to the list, or on to the next exhibit. */}
      <nav aria-label={t("experiments.frame.onward")} className="flex flex-wrap items-center justify-between gap-3">
        <TextLink href={EXHIBITS_PATH} className="inline-flex items-center gap-1 text-sm">
          <ArrowLeft className="size-4" aria-hidden />
          {t("experiments.overview.all")}
        </TextLink>
        {next.path && next.exhibit !== exhibit && (
          <Button variant="secondary" size="sm" href={next.path}>
            {t("experiments.frame.next", { name: t(`experiments.exhibits.${next.exhibit}.short`) })}
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        )}
      </nav>
    </div>
  );
}
