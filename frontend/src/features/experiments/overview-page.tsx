import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Trans, useTranslation } from "react-i18next";
import { ArrowRight, LayoutGrid } from "lucide-react";
import { ActionCard, Button, SectionLabel, StatTile, StatTileGrid, usePageSeo } from "@eifi1/ui-kit";
import { LESSONS, BASICS_PATH } from "@/features/course/lessons";
import { LANGUAGES } from "@/shared/i18n/languages";
import { useLocale } from "@/shared/i18n/use-locale";
import { CONTAINER } from "@/shared/ui/page-shell";
import { useChecks } from "./checks";
import { dayIn, weekOf, weeklyExhibit } from "./weekly";
import { ExhibitGrid } from "./exhibit-cards";
import { EQUATION_COUNT } from "./facts";
import { FittedPreview } from "./fitted-preview";
import {
  BUILT,
  EXHIBITS_ANCHOR,
  EXHIBITS_PATH,
  TOPICS_SHOWN,
  exhibitEntry,
  type Exhibit,
  type ExhibitEntry,
} from "./exhibits";

/** A week, by its Monday (`YYYY-MM-DD`), as the reader's language writes the
 *  days from Monday to Sunday ("23.–29. Nov.", "Nov 23 – 29"). Formatted in
 *  UTC because the strings are calendar days, not instants: in any other zone
 *  midnight UTC can fall on the day before. */
function weekSpan(monday: string, locale: string): string {
  const start = new Date(`${monday}T00:00:00Z`);
  const end = new Date(start.getTime() + 6 * 86_400_000);
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }).formatRange(start, end);
}

/**
 * The site's front page (Marcel chose the "stage" of three drafts on
 * 2026-11-20, with the week's exhibit whole on the first screen):
 *
 * - **what the site is**, the page's headline across its width: "First play,
 *   then compute", and one line under it;
 * - **the experiment of the week** on a stage under it, playing by itself,
 *   with the question to guess at and the two ways on (`weekly.ts` picks it:
 *   random, with a memory). The weeks before it are not listed: the way on is
 *   the list of every exhibit (Marcel, 2026-11-20: "gehe stattdessen gleich
 *   auf die Seite mit den Experimenten anstelle des Dialogs");
 * - **the site in figures**, a band across the window: exhibits, topics,
 *   equations, checked, languages, and what the site does not do;
 * - **the exhibits** as a part of their own: the newest few, each moving
 *   once pointed at, and the way to the page of all of them (`exhibits-page.tsx`;
 *   Marcel, 2026-11-20: "nicht alle Exponate gleich sofort … sondern nur eine
 *   Auswahl, … weiterhin eine separate Seite mit allen Exponaten");
 * - **the basics** under them, likewise: the lessons most exhibits build on,
 *   and the way to the course (`features/course`), which moved here from
 *   Kurvenschmiede (Marcel, 2026-11-20: "Genauso wie die Grundlagen unten
 *   drunter").
 *
 * The museum is credited in one line, by name, with no logo and no photo:
 * every drawing on the site is its own (`docs/experiments.md`).
 */
export function ExperimentsOverviewPage() {
  const { t } = useTranslation();
  // The week of the day the page was opened: a page left open past Sunday
  // midnight keeps last week's exhibit until it is loaded again, which is what
  // a reader looking at it would expect.
  const [week] = useState(() => weekOf(dayIn()));
  const current = exhibitEntry(weeklyExhibit(week));
  usePageSeo({
    canonicalPath: "/",
    title: `${t("app.name")} — ${t("app.tagline")}`,
    description: t("experiments.overview.lead"),
  });
  const { hash } = useLocation();
  const navigate = useNavigate();
  // The list was this page's lower half until 2026-11-20, at `/#all-exhibits`:
  // a link to it, kept somewhere, goes on to its page.
  useEffect(() => {
    if (hash === `#${EXHIBITS_ANCHOR}`) void navigate(EXHIBITS_PATH, { replace: true });
  }, [hash, navigate]);
  return (
    <>
      <div className={`${CONTAINER} flex flex-col items-center pt-6 md:pt-9`}>
        <Welcome />
        <WeekStage entry={current} week={week} />
      </div>
      <Figures />
      <div className={`${CONTAINER} flex flex-col gap-4 pt-10 pb-6 md:pt-14`}>
        <Selection current={current.exhibit} />
        <Basics />
        <p className="text-sm text-secondary">{t("experiments.overview.how")}</p>
        <p className="text-caption text-muted">{t("experiments.overview.credit")}</p>
      </div>
    </>
  );
}

/** The page's headline, across the page under the header (Marcel,
 *  2026-11-20: the line about the whole site was "zu lang und nicht relevant
 *  für das Experiment", and belongs above everything instead). */
function Welcome() {
  const { t } = useTranslation();
  return (
    <div className="space-y-2 text-center md:space-y-2.5">
      <h1 className="font-serif text-[2.125rem] leading-[1.06] font-semibold tracking-tight text-primary md:text-[3.5rem]">
        <Trans i18nKey="experiments.overview.claim" components={{ em: <em className="font-medium text-brand" /> }} />
      </h1>
      <p className="mx-auto max-w-[40rem] text-base text-secondary md:text-lg">{t("experiments.overview.lead")}</p>
    </div>
  );
}

/** The stage's picture: never lower than this, however low the window. */
const STAGE_MIN = 180;
/** Nor higher than this, however high: under a stage 52 rem wide, a picture
 *  about twice as wide as high. */
const STAGE_MAX = 400;
/** Window left under the stage, where the band of figures begins. */
const STAGE_GAP = 16;

/**
 * How high the stage's picture may be for the whole stage to fit the first
 * screen (Marcel, 2026-11-20: "so, dass das Experiment der Woche ganz zu sehen
 * ist"): the window's height less what stands above the stage and its
 * caption below the picture, and no higher than the stage's width allows
 * (2 : 1 when wide, 16 : 10 on a phone). Measured again when the window, the
 * stage or the caption changes size, and once the fonts are in, which moves
 * the stage down a line's worth.
 */
function useStageHeight(figure: HTMLElement | null, caption: HTMLElement | null): number {
  const [height, setHeight] = useState(() =>
    typeof window === "undefined"
      ? 320
      : Math.round(Math.min(STAGE_MAX, Math.max(STAGE_MIN, window.innerHeight - 440))),
  );
  useEffect(() => {
    if (!figure || !caption) return;
    const measure = () => {
      const top = figure.getBoundingClientRect().top + window.scrollY;
      const room = window.innerHeight - top - caption.offsetHeight - STAGE_GAP;
      const wide = window.matchMedia?.("(min-width: 768px)").matches ?? true;
      const byWidth = figure.clientWidth * (wide ? 0.5 : 0.625);
      setHeight(Math.round(Math.min(STAGE_MAX, Math.max(STAGE_MIN, Math.min(room, byWidth)))));
    };
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    observer?.observe(figure);
    observer?.observe(caption);
    window.addEventListener("resize", measure);
    void document.fonts?.ready.then(measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [figure, caption]);
  return height;
}

/**
 * The experiment of the week on a stage, as an exhibit stands in a museum
 * with its label under it: the drawing, playing, in a box no wider than 52
 * rem whatever the window (Marcel, 2026-11-20: the picture should stop
 * growing with the screen); under it the week, the exhibit's name, the
 * question to guess at, and the two ways on, beside the words when wide and
 * under them on a phone, where the drawing stands above the question (Marcel,
 * 2026-11-20: "Bild über Frage beim Handy"). The drawing's own frame is taken
 * off: the stage is its frame.
 */
function WeekStage({ entry, week }: { entry: ExhibitEntry; week: string }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const [figure, setFigure] = useState<HTMLElement | null>(null);
  const [caption, setCaption] = useState<HTMLElement | null>(null);
  const height = useStageHeight(figure, caption);
  return (
    <section aria-labelledby="week" className="mt-5 w-full max-w-[52rem] md:mt-7">
      <figure ref={setFigure} className="m-0 overflow-hidden rounded-2xl border border-subtle bg-surface">
        <FittedPreview exhibit={entry.exhibit} height={height} plain box="w-full" frame="px-3 pt-3 md:px-6 md:pt-4" />
        <figcaption
          ref={setCaption}
          className="flex flex-col gap-3 border-t border-subtle px-4 pt-3.5 pb-4 md:flex-row md:items-center md:justify-between md:gap-8 md:px-7 md:py-5"
        >
          <div className="min-w-0 space-y-1.5">
            <SectionLabel as="p">
              {t("experiments.overview.week.eyebrow")} · {weekSpan(week, locale)}
            </SectionLabel>
            <h2 id="week" className="text-base font-semibold text-brand">
              {t(`experiments.exhibits.${entry.exhibit}.title`)}
            </h2>
            <p className="font-serif text-xl leading-snug font-semibold text-primary md:text-2xl">
              {t(`experiments.exhibits.${entry.exhibit}.question`)}
            </p>
          </div>
          <div className="flex gap-2 md:shrink-0 md:flex-col">
            {entry.path && (
              <Button variant="accent" href={entry.path} className="flex-1 md:flex-none">
                {t("experiments.overview.week.open")}
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            )}
            {/* A page of its own: the way back is the browser's (Marcel,
                2026-11-20: back with the mouse's side button). */}
            <Button variant="secondary" href={EXHIBITS_PATH} className="flex-1 md:flex-none">
              <LayoutGrid className="size-4" aria-hidden />
              {t("experiments.overview.all")}
            </Button>
          </div>
        </figcaption>
      </figure>
    </section>
  );
}

/**
 * The site in five figures, a band across the window under the stage
 * (Marcel, 2026-11-20: "Wo ist die bottom line mit den key facts zur
 * Seite?"), each counted where it is kept: the built exhibits and their
 * topics, the equations the pages write out (`facts.ts`), the exhibits an
 * admin has checked, from the server, and the languages. Under them, in one
 * quiet line, what the site does not do. The kit's tiles, as UI-Kit advised;
 * its `StatStrip`, proposed for 0.66, would draw them as one strip.
 */
function Figures() {
  const { t } = useTranslation();
  const locale = useLocale();
  const checks = useChecks();
  const checked = checks.data?.checked.filter((check) => BUILT.some((entry) => entry.exhibit === check.exhibit)).length;
  return (
    <section
      aria-label={t("experiments.overview.facts.label")}
      className="mt-8 border-y border-subtle bg-surface md:mt-10"
    >
      <div className={`${CONTAINER} py-6 md:py-8`}>
        <StatTileGrid minTileWidth="9rem" lang={locale}>
          <StatTile label={t("experiments.overview.facts.exhibits")} value={BUILT.length} locale={locale} />
          <StatTile label={t("experiments.overview.facts.topics")} value={TOPICS_SHOWN.length} locale={locale} />
          <StatTile label={t("experiments.overview.facts.equations")} value={EQUATION_COUNT} locale={locale} />
          <StatTile
            label={t("experiments.overview.facts.checked")}
            value={checks.isError ? null : checked}
            loading={checks.isPending}
            locale={locale}
          />
          <StatTile label={t("experiments.overview.facts.languages")} value={LANGUAGES.length} locale={locale} />
        </StatTileGrid>
        <p className="mt-4 text-center text-sm text-muted">{t("experiments.overview.facts.promise")}</p>
      </div>
    </section>
  );
}

/** How many exhibits the front page shows: two rows of three. */
const SELECTION = 6;

/**
 * The exhibits as a part of the front page: a heading to be seen from afar,
 * the newest few as cards, each moving once pointed at, and the way to all of
 * them on a page of their own.
 */
function Selection({ current }: { current: Exhibit }) {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="exhibits" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="space-y-1">
          <h2 id="exhibits" className="font-serif text-3xl font-semibold text-primary md:text-4xl">
            {t("experiments.overview.selection.title")}
          </h2>
          <p className="text-sm text-secondary md:text-base">
            {t("experiments.overview.selection.lead", { count: SELECTION })}
          </p>
        </div>
        <Button variant="ghost" href={EXHIBITS_PATH}>
          {t("experiments.overview.selection.all", { count: BUILT.length })}
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>
      <ExhibitGrid entries={BUILT.slice(0, SELECTION)} current={current} />
    </section>
  );
}

/** The lessons the front page shows: the three the most exhibits build on,
 *  in the course's order. */
const LESSONS_SHOWN = LESSONS.filter((entry) =>
  [...new Set(BUILT.flatMap((exhibit) => exhibit.lessons))]
    .sort(
      (a, b) =>
        BUILT.filter((exhibit) => exhibit.lessons.includes(b)).length -
        BUILT.filter((exhibit) => exhibit.lessons.includes(a)).length,
    )
    .slice(0, 3)
    .some((lesson) => lesson === entry.lesson),
);

/**
 * The basics as a part of the front page, under the exhibits: the lessons
 * most exhibits stand on, each with what it teaches, and the way to the
 * course.
 */
function Basics() {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="basics" className="space-y-4 pt-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="space-y-1">
          <h2 id="basics" className="font-serif text-3xl font-semibold text-primary md:text-4xl">
            {t("experiments.overview.basics.title")}
          </h2>
          <p className="text-sm text-secondary md:text-base">{t("experiments.overview.basics.lead")}</p>
        </div>
        <Button variant="ghost" href={BASICS_PATH}>
          {t("experiments.overview.basics.all")}
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {LESSONS_SHOWN.map((entry) => (
          <ActionCard
            key={entry.path}
            href={entry.path}
            title={`${entry.number} · ${t(`course.lessons.${entry.lesson}.title`)}`}
            description={t(`course.lessons.${entry.lesson}.summary`)}
          />
        ))}
      </div>
    </section>
  );
}
