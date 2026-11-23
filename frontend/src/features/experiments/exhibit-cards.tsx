import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle, Chip, TextLink } from "@eifi1/ui-kit";
// From the course's list, not from `exhibit-frame.tsx`: the overview is in the
// first wave, and the frame would bring the checks' formulas and KaTeX into it.
import { lessonEntry } from "@/features/course/lessons";
import { EXHIBIT_MODULES } from "./exhibit-modules";
import { FittedPreview } from "./fitted-preview";
import type { Exhibit, ExhibitEntry } from "./exhibits";
import { useTried } from "./tried";

/** How many cards a long list shows at first, and adds each time its end
 *  comes near. */
export const BATCH = 9;

/** How far each long list had grown in this tab, by its filter: a reader who
 *  went down to the twentieth card, opened it and came back finds the list as
 *  long as they left it, so the way back lands where it was. */
const grown = new Map<string, number>();

/**
 * Exhibits as cards in a grid: one, two or three columns as the width allows.
 *
 * A long list (`progressive`, the page of all exhibits) shows the first
 * `BATCH` and adds the next as the reader scrolls near its end, each new card
 * rising into place (Marcel, 2026-11-20: "beim Scrollen mit Transition unten
 * anheften", unless the reader's system asks for less motion); and a card far
 * off screen is skipped by the browser's layout and painting
 * (`content-visibility`), while its drawing is not even mounted until it
 * comes near (`ExhibitPreview`). So the list costs what is on the screen,
 * whether it holds thirty-five exhibits or three hundred. Without an
 * IntersectionObserver every card is shown at once.
 */
export function ExhibitGrid({
  entries,
  current,
  progressive = false,
  memory = "",
}: {
  entries: readonly ExhibitEntry[];
  current: Exhibit;
  progressive?: boolean;
  /** The list's filter, under which its length is remembered. */
  memory?: string;
}) {
  const tried = useTried((s) => s.tried);
  const observable = typeof IntersectionObserver === "function";
  const growing = progressive && observable;
  const [count, setCount] = useState(() =>
    growing ? Math.min(entries.length, Math.max(BATCH, grown.get(memory) ?? 0)) : entries.length,
  );
  // The cards shown at first come in with the page; only the ones added
  // later rise into place.
  const [first] = useState(count);
  const [end, setEnd] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!growing || !end || count >= entries.length) return;
    // Made again for every new length: an end still in reach after a batch
    // asks for the next at once, rather than waiting to leave and come back.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        const next = Math.min(entries.length, count + BATCH);
        grown.set(memory, next);
        setCount(next);
      },
      { rootMargin: "0px 0px 480px 0px" },
    );
    observer.observe(end);
    return () => observer.disconnect();
  }, [growing, end, count, entries.length, memory]);
  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {entries.slice(0, count).map((entry, i) => (
          <div
            key={entry.exhibit}
            className={`flex [contain-intrinsic-size:auto_26rem] [content-visibility:auto] ${i >= first ? "motion-safe:animate-[card-in_420ms_ease-out_both]" : ""}`}
            style={i >= first ? { animationDelay: `${((i - first) % BATCH) * 45}ms` } : undefined}
          >
            <ExhibitCard entry={entry} current={entry.exhibit === current} tried={tried.includes(entry.exhibit)} />
          </div>
        ))}
      </div>
      {growing && count < entries.length && <div ref={setEnd} aria-hidden className="h-px" />}
    </>
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
      className="relative flex w-full flex-col gap-3 transition-colors hover:border-brand has-[a[data-card]:focus-visible]:ring-2 has-[a[data-card]:focus-visible]:ring-brand"
      onPointerEnter={() => setLive(true)}
      onPointerLeave={() => setLive(false)}
      onFocus={() => setLive(true)}
      onBlur={() => setLive(false)}
    >
      <FittedPreview
        exhibit={entry.exhibit}
        still={!live}
        height={CARD_PREVIEW_HEIGHT}
        plain
        box="rounded-lg bg-surface-2"
        frame="p-3"
      />
      <CardHeader>
        <div className="flex items-start gap-2">
          <Icon className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
          <div className="min-w-0 space-y-1">
            <CardTitle as="h3">
              {/* Stretched over the card, so the whole card opens the exhibit
                  and one primary button stays the front page's own. */}
              <Link to={entry.path} data-card className="outline-none after:absolute after:inset-0 after:content-['']">
                {t(`experiments.exhibits.${entry.exhibit}.title`)}
              </Link>
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
                <TextLink href={lessonEntry(lesson).path} tone="muted" className="relative z-10">
                  {t(`experiments.computed.links.${lesson}`)}
                </TextLink>
              </span>
            ))}
          </p>
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
