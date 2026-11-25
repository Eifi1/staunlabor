/**
 * The shape every exhibit's page has, in the order a visit goes: what stands
 * at the exhibit, the exhibit's twin to play with, what happens (the
 * computation), the one insight that explains the trick, and where to go on.
 * `docs/experiments.md` ("The page") is the plan this follows.
 *
 * The frame owns the header and the order; an exhibit's page is only its own
 * drawing, model and insight.
 */

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, Cpu, FlaskConical, Lightbulb } from "lucide-react";
import { useMemo } from "react";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  PAGE_CONTENTS_BAR_TARGET,
  PageContents,
  PageHeader,
  SectionLabel,
  TextLink,
  useScrollSpy,
  type PageContentsItem,
} from "@eifi1/ui-kit";
import { PAGE_SHELL } from "@/shared/ui/page-shell";
import { lessonEntry } from "@/features/course/lessons";
import { EXHIBITS, EXHIBITS_PATH, exhibitEntry, type Exhibit } from "./exhibits";
import { useTried } from "./tried";
import { CHECKS_ANCHOR, CheckSection } from "./check-section";
import { checkCases } from "./checks";
import { CheckStatus } from "./check-status";

/** Prose at a reading measure: a paragraph across a wide screen ran to some
 *  250 characters a line, where 60 to 80 read well. Paragraphs only — the
 *  figures, charts and equations beside them keep the full width. */
const PROSE = "[&_p]:max-w-[75ch]";

/** The anchors of the page's parts, which the bar under the header links to;
 *  the checks' is `CHECKS_ANCHOR`, which the check status links to as well. */
const PARTS = {
  tryIt: "try-it",
  whatHappens: "what-happens",
  computed: "computed",
  sweetSpot: "sweet-spot",
} as const;

/** The exhibit after `exhibit` in the list, the first after the last. */
function nextExhibit(exhibit: Exhibit) {
  const at = EXHIBITS.findIndex((entry) => entry.exhibit === exhibit);
  return EXHIBITS[(at + 1) % EXHIBITS.length];
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
  const next = nextExhibit(exhibit);
  // The bar names the parts this page has: the chair, which does not move,
  // has no "How it is computed", and an exhibit without cases no checks.
  const parts: PageContentsItem[] = [
    { id: PARTS.tryIt, label: t("experiments.frame.try_it") },
    { id: PARTS.whatHappens, label: t("experiments.frame.what_happens") },
    ...(computed ? [{ id: PARTS.computed, label: t("experiments.frame.computed") }] : []),
    { id: PARTS.sweetSpot, label: t("experiments.frame.sweet_spot") },
    ...(checkCases(exhibit).length > 0 ? [{ id: CHECKS_ANCHOR, label: t("experiments.checks.title") }] : []),
  ];
  // Keyed by the ids' text: `parts` is built anew on every render, and a new
  // array each time would set the spy up again each time.
  const key = parts.map((part) => part.id).join(" ");
  const ids = useMemo(() => key.split(" "), [key]);
  // The reading line a fifth down the window: below the two bars on a phone
  // (some 100 px of some 640), so a part counts as read once its heading has
  // gone under them.
  const active = useScrollSpy(ids, { line: 0.2 });
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

      {/* The parts as a bar held under the site's header while the page
          scrolls (Marcel, 2026-11-24): every page has the same parts, so a
          reader can jump to the trick or the checks of any exhibit and sees
          where in the page they are. The kit's (0.66), built from this site's
          first one; a jump adds no history entry, and the mark is worked out
          in the browser alone. Out to the column's edges, as the header. */}
      <PageContents
        variant="bar"
        items={parts}
        activeId={active}
        labels={{ title: t("experiments.frame.parts") }}
        className="top-14 -mx-3 px-3 md:-mx-6 md:px-6"
      />

      <Card padding="md" density="compact" className="border-l-4 border-l-brand">
        <div className="flex gap-3">
          <FlaskConical className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
          <div className="min-w-0 space-y-2">
            <SectionLabel as="h2">{t("experiments.frame.at_the_exhibit")}</SectionLabel>
            {/* All of it, unfolded: every exhibit's text here is two or three
                short paragraphs (at most some 600 characters), so a fold saved
                a few lines and cost a click (Marcel, 2026-11-23). */}
            <div className={`space-y-2 text-sm text-primary ${PROSE}`}>{atTheExhibit}</div>
          </div>
        </div>
      </Card>

      {/* Anything the reader does in here is trying the exhibit: the
          overview ticks it from then on (`tried.ts`). Captured, so a control
          that stops its event still counts. */}
      <section
        className="space-y-4"
        aria-labelledby={PARTS.tryIt}
        onPointerDownCapture={tried}
        onKeyDownCapture={tried}
      >
        <SectionLabel as="h2" id={PARTS.tryIt} className={PAGE_CONTENTS_BAR_TARGET}>
          {t("experiments.frame.try_it")}
        </SectionLabel>
        {children}
      </section>

      <Card padding="md" density="compact" className="space-y-3">
        <CardHeader>
          <CardTitle as="h2" id={PARTS.whatHappens} className={PAGE_CONTENTS_BAR_TARGET}>
            {t("experiments.frame.what_happens")}
          </CardTitle>
        </CardHeader>
        <div className={`space-y-3 text-sm text-secondary ${PROSE}`}>{whatHappens}</div>
      </Card>

      {computed && (
        <Card padding="md" density="compact" className="space-y-3">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Cpu className="size-5 shrink-0 text-brand" aria-hidden />
              <CardTitle as="h2" id={PARTS.computed} className={PAGE_CONTENTS_BAR_TARGET}>
                {t("experiments.frame.computed")}
              </CardTitle>
            </div>
          </CardHeader>
          <div className={`space-y-3 text-sm text-secondary ${PROSE}`}>{computed}</div>
          {lessons.length > 0 && (
            <nav aria-label={t("experiments.computed.course")} className="space-y-2">
              <p className="text-sm text-secondary">{t("experiments.computed.course")}</p>
              <div className="flex flex-wrap gap-2">
                {lessons.map((lesson) => (
                  <Button key={lesson} variant="secondary" size="sm" href={lessonEntry(lesson).path}>
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
            <CardTitle as="h2" id={PARTS.sweetSpot} className={PAGE_CONTENTS_BAR_TARGET}>
              {t("experiments.frame.sweet_spot")}
            </CardTitle>
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
        {next.exhibit !== exhibit && (
          <Button variant="secondary" size="sm" href={next.path}>
            {t("experiments.frame.next", { name: t(`experiments.exhibits.${next.exhibit}.short`) })}
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        )}
      </nav>
    </div>
  );
}
