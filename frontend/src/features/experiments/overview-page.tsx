import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { Trans, useTranslation } from "react-i18next";
import { ArrowDown, ArrowRight, Check, RotateCcw } from "lucide-react";
import {
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Chip,
  ProgressBar,
  SectionLabel,
  StatTile,
  StatTileGrid,
  TextLink,
  usePageSeo,
} from "@eifi1/ui-kit";
import { LANGUAGES } from "@/shared/i18n/languages";
import { useLocale } from "@/shared/i18n/use-locale";
import { CONTAINER } from "@/shared/ui/page-shell";
import { useChecks } from "./checks";
import { dayIn, weekOf, weeklyExhibit } from "./weekly";
import { EXHIBIT_MODULES } from "./exhibit-modules";
import { EQUATION_COUNT } from "./facts";
import { FittedPreview } from "./fitted-preview";
import { lessonPath } from "./exhibit-frame";
import { scrollToList } from "./list-anchor";
import {
  EXHIBITS,
  EXHIBITS_ANCHOR,
  TOPICS,
  exhibitEntry,
  type Exhibit,
  type ExhibitEntry,
  type Topic,
} from "./exhibits";
import { useTried } from "./tried";

/** A week, by its Monday (`YYYY-MM-DD`), as the reader's language writes the
 *  days from Monday to Sunday ("23.–29. Nov.", "Nov 23 – 29"). Formatted in
 *  UTC because the strings are calendar days, not instants: in any other zone
 *  midnight UTC can fall on the day before. */
function weekSpan(monday: string, locale: string): string {
  const start = new Date(`${monday}T00:00:00Z`);
  const end = new Date(start.getTime() + 6 * 86_400_000);
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }).formatRange(start, end);
}

/** The topics some exhibit has: a chip, or a figure, for a topic with none
 *  would promise what the page cannot show. */
const TOPICS_SHOWN = TOPICS.filter((topic) => EXHIBITS.some((entry) => entry.topics.includes(topic)));

const BUILT = EXHIBITS.filter((entry) => entry.path);

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
 * - **every exhibit**, filtered by what it is about, ticked once tried on this
 *   device (`tried.ts`), and linked to the course's lessons its computation
 *   stands on.
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
  // An exhibit's page links back to the list (`#all-exhibits`): a client-side
  // navigation lands at the top, so the page goes down to it itself, at once,
  // since the reader asked for the list rather than for this page.
  useEffect(() => {
    if (hash === `#${EXHIBITS_ANCHOR}`) scrollToList("auto");
  }, [hash]);
  return (
    <>
      <div className={`${CONTAINER} flex flex-col items-center pt-6 md:pt-9`}>
        <Welcome />
        <WeekStage entry={current} week={week} />
      </div>
      <Figures />
      <div className={`${CONTAINER} flex flex-col gap-4 pt-10 pb-6 md:pt-14`}>
        <AllExhibits current={current.exhibit} />
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
            <Button
              variant="secondary"
              href={`#${EXHIBITS_ANCHOR}`}
              onClick={(event) => {
                if (scrollToList()) event.preventDefault();
              }}
              className="flex-1 md:flex-none"
            >
              <ArrowDown className="size-4" aria-hidden />
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

function AllExhibits({ current }: { current: Exhibit }) {
  const { t } = useTranslation();
  const tried = useTried((s) => s.tried);
  const forget = useTried((s) => s.forget);
  const [topic, setTopic] = useState<Topic | null>(null);
  const shown = EXHIBITS.filter((entry) => topic === null || entry.topics.includes(topic));
  return (
    <section aria-labelledby={EXHIBITS_ANCHOR} className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        {/* A heading to be seen from afar, and the place the page scrolls to,
            clear of the header that stays at the top (Marcel, 2026-11-20). */}
        <div className="flex items-baseline gap-3">
          <h2
            id={EXHIBITS_ANCHOR}
            tabIndex={-1}
            className="scroll-mt-20 font-serif text-3xl font-semibold text-primary outline-none md:text-4xl"
          >
            {t("experiments.overview.all")}
          </h2>
          <span className="font-mono text-sm text-muted">{BUILT.length}</span>
        </div>
        {tried.length > 0 && (
          <Button variant="ghost" size="sm" onClick={forget}>
            <RotateCcw className="size-4" aria-hidden />
            {t("experiments.overview.tried.forget")}
          </Button>
        )}
      </div>
      {/* Only once the reader has tried one: "0 of 35" to a newcomer reads as homework. */}
      {tried.length > 0 && (
        <ProgressBar
          label={t("experiments.overview.tried.label")}
          value={tried.length}
          max={BUILT.length}
          showValue
          formatValue={(v, max) => t("experiments.overview.tried.count", { tried: v, total: max })}
          tone="success"
        />
      )}
      <div role="group" aria-label={t("experiments.overview.topics_label")} className="flex flex-wrap gap-2">
        <Chip onClick={() => setTopic(null)} selected={topic === null}>
          {t("experiments.overview.all_topics")}
        </Chip>
        {TOPICS_SHOWN.map((tp) => (
          <Chip key={tp} onClick={() => setTopic(topic === tp ? null : tp)} selected={topic === tp}>
            {t(`experiments.topics.${tp}`)}
          </Chip>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((entry) => (
          <ExhibitCard
            key={entry.exhibit}
            entry={entry}
            current={entry.exhibit === current}
            tried={tried.includes(entry.exhibit)}
          />
        ))}
      </div>
    </section>
  );
}

/** How tall a card's drawing is: one box of one size for every card, the
 *  upright ones (the elephant, the diver) scaled down to it rather than
 *  making their card the longest in the grid, and each drawing's own frame
 *  taken off, as in the week's box. */
const CARD_PREVIEW_HEIGHT = 200;

/** An exhibit in the list: its drawing, held still and playing while the card
 *  is pointed at or something in it has the focus; then what it is and the
 *  way in. A preview mounts only once it scrolls near
 *  (`ExhibitPreview`), so the list costs nothing below the fold. */
function ExhibitCard({ entry, current, tried }: { entry: ExhibitEntry; current: boolean; tried: boolean }) {
  const { t } = useTranslation();
  const Icon = EXHIBIT_MODULES[entry.exhibit].icon;
  const [live, setLive] = useState(false);
  return (
    <Card
      padding="md"
      density="compact"
      className={`relative flex flex-col gap-3 ${entry.path ? "transition-colors hover:border-brand has-[a[data-card]:focus-visible]:ring-2 has-[a[data-card]:focus-visible]:ring-brand" : ""}`}
      onPointerEnter={() => setLive(true)}
      onPointerLeave={() => setLive(false)}
      onFocus={() => setLive(true)}
      onBlur={() => setLive(false)}
    >
      {entry.path && (
        <FittedPreview
          exhibit={entry.exhibit}
          still={!live}
          height={CARD_PREVIEW_HEIGHT}
          plain
          box="rounded-lg bg-surface-2"
          frame="p-3"
        />
      )}
      <CardHeader>
        <div className="flex items-start gap-2">
          <Icon className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
          <div className="min-w-0 space-y-1">
            <CardTitle as="h3">
              {entry.path ? (
                // Stretched over the card, so the whole card opens the exhibit
                // and one primary button stays the front page's own.
                <Link
                  to={entry.path}
                  data-card
                  className="outline-none after:absolute after:inset-0 after:content-['']"
                >
                  {t(`experiments.exhibits.${entry.exhibit}.title`)}
                </Link>
              ) : (
                t(`experiments.exhibits.${entry.exhibit}.title`)
              )}
            </CardTitle>
            {current && (
              <Chip size="xs" tone="brand">
                {t("experiments.overview.week.current")}
              </Chip>
            )}
            {/* At least three lines, the most a summary takes at most widths, so
                the topics below start at one height along a row. */}
            <CardDescription className="min-h-[3lh]">
              {t(`experiments.exhibits.${entry.exhibit}.summary`)}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <div className="mt-auto space-y-3">
        <TopicTags entry={entry} tried={tried} />
        {entry.lessons.length > 0 && (
          <p className="text-caption text-muted">
            {t("experiments.overview.builds_on")}{" "}
            {entry.lessons.map((lesson, i) => (
              <span key={lesson}>
                {i > 0 && ", "}
                {/* Above the card's own link, and quiet: for the technically minded. */}
                <TextLink href={lessonPath(lesson)} tone="muted" className="relative z-10">
                  {t(`experiments.computed.links.${lesson}`)}
                </TextLink>
              </span>
            ))}
          </p>
        )}
      </div>
      {!entry.path && (
        <div className="mt-auto">
          <Chip tone="neutral">{t("experiments.overview.coming")}</Chip>
        </div>
      )}
    </Card>
  );
}

/** What an exhibit is about, and whether it was tried here. */
function TopicTags({ entry, tried }: { entry: ExhibitEntry; tried: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap gap-1.5">
      {entry.topics.map((tp) => (
        <Chip key={tp} size="xs" tone="neutral">
          {t(`experiments.topics.${tp}`)}
        </Chip>
      ))}
      {tried && (
        <Chip size="xs" tone="success" icon={Check}>
          {t("experiments.overview.tried.mark")}
        </Chip>
      )}
    </div>
  );
}
