import { useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  Armchair,
  CalendarDays,
  Check,
  ChevronsUp,
  HelpCircle,
  Magnet,
  Orbit,
  RotateCcw,
  RotateCw,
  Timer,
  Torus,
  Wind,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Chip,
  DialogFrame,
  PageHeader,
  ProgressBar,
  SectionLabel,
  TextLink,
  useDialogParam,
  usePageSeo,
} from "@eifi1/ui-kit";
import { useLocale } from "@/shared/i18n/use-locale";
import { PAGE_SHELL } from "@/shared/ui/page-shell";
import { dailyExhibit, dailyHistory, dayIn, type DailyPick } from "./daily";
import { ExhibitPreview } from "./exhibit-preview";
import { lessonPath } from "./exhibit-frame";
import { EXHIBITS, TOPICS, exhibitEntry, type Exhibit, type ExhibitEntry, type Topic } from "./exhibits";
import { useTried } from "./tried";

const ICON: Record<Exhibit, LucideIcon> = {
  chair: Armchair,
  coil: Magnet,
  sphere: Orbit,
  platform: RotateCw,
  race: Timer,
  elephant: Wind,
  smoke: Torus,
  cannon: ChevronsUp,
};

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
  return (
    <div className={PAGE_SHELL}>
      <PageHeader size="sm" title={t("app.name")} description={t("experiments.overview.lead")} />
      <DailyCard entry={daily} today={today} />
      <AllExhibits daily={daily.exhibit} />
      <p className="text-sm text-secondary">{t("experiments.overview.how")}</p>
      <p className="text-caption text-muted">{t("experiments.overview.credit")}</p>
    </div>
  );
}

function DailyCard({ entry, today }: { entry: ExhibitEntry; today: string }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const tried = useTried((s) => s.tried.includes(entry.exhibit));
  // In the address (`?dialog=history`), so a phone's Back closes it.
  const [historyOpen, setHistoryOpen] = useDialogParam({ key: "dialog", value: "history" });
  const history = dailyHistory(today, HISTORY_DAYS);
  return (
    <Card padding="md" density="compact" className="border-l-4 border-l-brand">
      <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-2">
        <div className="mx-auto w-full max-w-md">
          <ExhibitPreview exhibit={entry.exhibit} />
        </div>
        <div className="min-w-0 space-y-3">
          <SectionLabel as="p">
            {t("experiments.overview.daily.eyebrow")} · {shortDay(today, locale)}
          </SectionLabel>
          <CardTitle as="h2">{t(`experiments.exhibits.${entry.exhibit}.title`)}</CardTitle>
          <p className="text-sm text-secondary">{t(`experiments.exhibits.${entry.exhibit}.summary`)}</p>
          <p className="flex gap-2 text-sm text-primary">
            <HelpCircle className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
            {t(`experiments.exhibits.${entry.exhibit}.question`)}
          </p>
          <TopicTags entry={entry} tried={tried} />
          <div className="flex flex-wrap gap-2">
            {entry.path && (
              <Button variant="accent" size="sm" href={entry.path}>
                {t("experiments.overview.daily.open")}
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            )}
            {history.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(true)}>
                <CalendarDays className="size-4" aria-hidden />
                {t("experiments.overview.history.open")}
              </Button>
            )}
          </div>
        </div>
      </div>
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
    </Card>
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
    <section aria-labelledby="all-exhibits" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionLabel as="h2" id="all-exhibits">
          {t("experiments.overview.all")}
        </SectionLabel>
        {tried.length > 0 && (
          <Button variant="ghost" size="sm" onClick={forget}>
            <RotateCcw className="size-4" aria-hidden />
            {t("experiments.overview.tried.forget")}
          </Button>
        )}
      </div>
      <ProgressBar
        label={t("experiments.overview.tried.label")}
        value={tried.length}
        max={built.length}
        showValue
        formatValue={(v, max) => t("experiments.overview.tried.count", { tried: v, total: max })}
        tone="success"
      />
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

function ExhibitCard({ entry, today, tried }: { entry: ExhibitEntry; today: boolean; tried: boolean }) {
  const { t } = useTranslation();
  const Icon = ICON[entry.exhibit];
  return (
    <Card padding="md" density="compact" className="flex flex-col gap-3">
      <CardHeader>
        <div className="flex items-start gap-2">
          <Icon className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
          <div className="min-w-0 space-y-1">
            <CardTitle as="h3">{t(`experiments.exhibits.${entry.exhibit}.title`)}</CardTitle>
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
              <TextLink href={lessonPath(lesson)}>{t(`experiments.computed.links.${lesson}`)}</TextLink>
            </span>
          ))}
        </p>
      )}
      <div className="mt-auto">
        {entry.path ? (
          <Button variant="accent" size="sm" href={entry.path}>
            {t("experiments.overview.open")}
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        ) : (
          <Chip tone="neutral">{t("experiments.overview.coming")}</Chip>
        )}
      </div>
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
