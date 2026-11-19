import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import { ArrowDown, ArrowRight, CalendarDays, Check, HelpCircle, RotateCcw } from "lucide-react";
import {
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Chip,
  DialogFrame,
  ProgressBar,
  SectionLabel,
  TextLink,
  useDialogParam,
  usePageSeo,
} from "@eifi1/ui-kit";
import { useLocale } from "@/shared/i18n/use-locale";
import { PAGE_SHELL } from "@/shared/ui/page-shell";
import { ChecksSummary } from "./unchecked-notice";
import { dailyExhibit, dailyHistory, dayIn, type DailyPick } from "./daily";
import { EXHIBIT_MODULES } from "./exhibit-modules";
import { ExhibitPreview } from "./exhibit-preview";
import { FittedPreview } from "./fitted-preview";
import { lessonPath } from "./exhibit-frame";
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

/** Two weeks back, in the dialog: long enough to find the one a friend
 *  mentioned, and every exhibit at least once. */
const HISTORY_DAYS = 14;

/** A day, `YYYY-MM-DD`, as the reader's language writes a short date. Formatted
 *  in UTC because the string is a calendar day, not an instant: in any other
 *  zone midnight UTC can fall on the day before. */
function shortDay(day: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${day}T00:00:00Z`),
  );
}

/**
 * The site's front page, the overview of the exhibits:
 *
 * - **the experiment of the day**, playing by itself, with the question to
 *   guess at before opening it (`daily.ts` picks it: random, with a memory),
 *   and **the days before it** in a dialog, on request only: the page is the
 *   day's experiment's alone, as anyplot.ai shows its plot of the day alone,
 *   and an archive is a link away on APOD or Wikipedia's picture of the day;
 * - **every exhibit**, filtered by what it is about, ticked once tried on this
 *   device (`tried.ts`), and linked to the course's lessons its computation
 *   stands on.
 *
 * The museum is credited in one line, by name, with no logo and no photo:
 * every drawing on the site is its own (`docs/experiments.md`).
 */
export function ExperimentsOverviewPage() {
  const { t } = useTranslation();
  // The day the page was opened: a page left open past midnight keeps
  // yesterday's exhibit until it is loaded again, which is what a reader
  // looking at it would expect.
  const [today] = useState(() => dayIn());
  const daily = exhibitEntry(dailyExhibit(today));
  usePageSeo({
    canonicalPath: "/",
    title: `${t("app.name")} — ${t("app.tagline")}`,
    description: t("experiments.overview.lead"),
  });
  const { hash } = useLocation();
  // An exhibit's page links back to the list (`#all-exhibits`): a client-side
  // navigation lands at the top, so the page goes down to it itself.
  useEffect(() => {
    if (hash === `#${EXHIBITS_ANCHOR}`) document.getElementById(EXHIBITS_ANCHOR)?.scrollIntoView();
  }, [hash]);
  return (
    <div className={PAGE_SHELL}>
      <DailyHero entry={daily} today={today} />
      <ChecksSummary />
      <AllExhibits daily={daily.exhibit} />
      <p className="text-sm text-secondary">{t("experiments.overview.how")}</p>
      <p className="text-caption text-muted">{t("experiments.overview.credit")}</p>
    </div>
  );
}

/** The drawing's height: most of the screen beside the text, less on a phone,
 *  where it stands above the text and the title must still show. */
function useHeroHeight(): number {
  const measure = () => {
    if (typeof window === "undefined") return 420;
    const wide = window.matchMedia?.("(min-width: 768px)").matches ?? true;
    return Math.round(Math.min(720, Math.max(240, window.innerHeight * (wide ? 0.72 : 0.42))));
  };
  const [height, setHeight] = useState(measure);
  useEffect(() => {
    const resize = () => setHeight(measure());
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  return height;
}

/**
 * The experiment of the day, filling the first screen (Marcel, 2026-11-19):
 * its title, what it is about and what stands at the exhibit, the question to
 * guess at, and its drawing, playing, to the right; on a phone the drawing
 * stands above. The first paragraph of the page's "At the exhibit" is the
 * longer text: it says what is there without giving the trick away.
 */
function DailyHero({ entry, today }: { entry: ExhibitEntry; today: string }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const tried = useTried((s) => s.tried.includes(entry.exhibit));
  const height = useHeroHeight();
  // In the address (`?dialog=history`), so a phone's Back closes it.
  const [historyOpen, setHistoryOpen] = useDialogParam({ key: "dialog", value: "history" });
  const history = dailyHistory(today, HISTORY_DAYS);
  const at = t(`experiments.${entry.exhibit}.at`, { returnObjects: true }) as Record<string, string> | string;
  const atTheExhibit = typeof at === "object" ? Object.values(at)[0] : null;
  return (
    <section
      aria-labelledby="daily"
      className="grid min-h-[calc(100dvh-4.5rem)] grid-cols-1 content-center items-center gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] md:gap-10"
    >
      <div className="order-last min-w-0 space-y-4 md:order-first">
        {/* What the site is, in one line: the first five seconds' question. */}
        <p className="max-w-[60ch] text-sm text-secondary md:text-base">{t("experiments.overview.lead")}</p>
        <div className="space-y-2">
          <SectionLabel as="p">
            {t("experiments.overview.daily.eyebrow")} · {shortDay(today, locale)}
          </SectionLabel>
          <p className="text-base font-semibold text-brand md:text-lg">
            {t(`experiments.exhibits.${entry.exhibit}.title`)}
          </p>
          {/* The hook is the biggest thing on the screen: the question to guess at. */}
          <h1 id="daily" className="flex gap-3 text-2xl font-semibold text-primary md:text-4xl">
            <HelpCircle className="mt-1 size-6 shrink-0 text-brand md:mt-1.5 md:size-8" aria-hidden />
            {t(`experiments.exhibits.${entry.exhibit}.question`)}
          </h1>
        </div>
        <p className="max-w-[65ch] text-base text-primary">{t(`experiments.exhibits.${entry.exhibit}.summary`)}</p>
        {atTheExhibit && <p className="max-w-[65ch] text-sm text-secondary md:text-base">{atTheExhibit}</p>}
        <TopicTags entry={entry} tried={tried} />
        <div className="flex flex-wrap gap-2">
          {entry.path && (
            <Button variant="accent" href={entry.path}>
              {t("experiments.overview.daily.open")}
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          )}
          {history.length > 0 && (
            <Button variant="ghost" onClick={() => setHistoryOpen(true)}>
              <CalendarDays className="size-4" aria-hidden />
              {t("experiments.overview.history.open")}
            </Button>
          )}
          <Button variant="ghost" href={`#${EXHIBITS_ANCHOR}`}>
            <ArrowDown className="size-4" aria-hidden />
            {t("experiments.overview.all")}
          </Button>
        </div>
      </div>
      <FittedPreview exhibit={entry.exhibit} height={height} shrink box="order-first w-full md:order-last" />
      <DialogFrame
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        size="xl"
        title={t("experiments.overview.history.title")}
        closeButton
        closeLabel={t("common.close")}
      >
        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {history.map((pick) => (
            <li key={pick.day}>
              <HistoryCard pick={pick} />
            </li>
          ))}
        </ol>
      </DialogFrame>
    </section>
  );
}

/** One day's exhibit: a still, which plays while it is pointed at or focused. */
function HistoryCard({ pick }: { pick: DailyPick }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const [live, setLive] = useState(false);
  const tried = useTried((s) => s.tried.includes(pick.exhibit));
  const entry = exhibitEntry(pick.exhibit);
  const title = t(`experiments.exhibits.${pick.exhibit}.short`);
  const body = (
    <>
      <span className="flex items-center justify-between gap-1 text-caption text-muted">
        {shortDay(pick.day, locale)}
        {tried && <Check className="size-4 text-success" aria-label={t("experiments.overview.tried.mark")} />}
      </span>
      <ExhibitPreview exhibit={pick.exhibit} still={!live} />
      <span className="mt-auto block truncate text-sm font-medium text-primary">{title}</span>
    </>
  );
  // As tall as the row's tallest, the name at the foot: the drawings differ
  // in shape — a wide track, a tall drop — and ragged cards read as broken.
  const look = "flex h-full flex-col gap-2 rounded-lg border border-subtle bg-surface-1 p-2";
  return entry.path ? (
    <Link
      to={entry.path}
      className={`${look} transition-colors hover:border-brand`}
      onPointerEnter={() => setLive(true)}
      onPointerLeave={() => setLive(false)}
      onFocus={() => setLive(true)}
      onBlur={() => setLive(false)}
    >
      {body}
    </Link>
  ) : (
    <div className={look}>{body}</div>
  );
}

function AllExhibits({ daily }: { daily: Exhibit }) {
  const { t } = useTranslation();
  const tried = useTried((s) => s.tried);
  const forget = useTried((s) => s.forget);
  const [topic, setTopic] = useState<Topic | null>(null);
  const built = EXHIBITS.filter((entry) => entry.path);
  const shown = EXHIBITS.filter((entry) => topic === null || entry.topics.includes(topic));
  // Only the topics some exhibit has: a chip that filters to nothing is a
  // promise the page cannot keep.
  const topics = TOPICS.filter((tp) => EXHIBITS.some((entry) => entry.topics.includes(tp)));
  return (
    <section aria-labelledby={EXHIBITS_ANCHOR} className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionLabel as="h2" id={EXHIBITS_ANCHOR}>
          {t("experiments.overview.all")}
        </SectionLabel>
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
          max={built.length}
          showValue
          formatValue={(v, max) => t("experiments.overview.tried.count", { tried: v, total: max })}
          tone="success"
        />
      )}
      <div role="group" aria-label={t("experiments.overview.topics_label")} className="flex flex-wrap gap-2">
        <Chip onClick={() => setTopic(null)} selected={topic === null}>
          {t("experiments.overview.all_topics")}
        </Chip>
        {topics.map((tp) => (
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
            today={entry.exhibit === daily}
            tried={tried.includes(entry.exhibit)}
          />
        ))}
      </div>
    </section>
  );
}

/** How tall a card's drawing is: one height for the row, the upright ones
 *  (the elephant, the diver) scaled down to it rather than making their card
 *  the longest in the grid. */
const CARD_PREVIEW_HEIGHT = 200;

/** An exhibit in the list: its drawing, held still and playing while the card
 *  is pointed at or something in it has the focus, as the history's cards do;
 *  then what it is and the way in. A preview mounts only once it scrolls near
 *  (`ExhibitPreview`), so the list costs nothing below the fold. */
function ExhibitCard({ entry, today, tried }: { entry: ExhibitEntry; today: boolean; tried: boolean }) {
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
          box="rounded-lg bg-surface-2"
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
            {today && (
              <Chip size="xs" tone="brand">
                {t("experiments.overview.daily.today")}
              </Chip>
            )}
            <CardDescription>{t(`experiments.exhibits.${entry.exhibit}.summary`)}</CardDescription>
          </div>
        </div>
      </CardHeader>
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
