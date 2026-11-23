/**
 * The picture a shared link shows (WhatsApp, Signal, Mastodon …), 1200 × 630:
 * an exhibit's own preview, held still, beside its title, its question, its
 * summary and its address; for the overview, the site's name and line beside
 * four of them. `scripts/write-clips.mjs` films the same card moving.
 *
 * One layout for every exhibit (Marcel, 2026-11-20: "eine feste Grösse für die
 * Vorschaubilder … und dann annähernd gleich viel Text pro Exponat"): the
 * picture is one box of one size, the drawing fitted into it with its own
 * frame and ground taken off, so a wide track no longer sits as a small framed
 * strip in an empty frame; and the text is the title, the question and the
 * summary, 177 to 325 characters in German (median 245), where title and
 * question alone left most of the column empty.
 *
 * Never part of the site: `preview-card.html` mounts it in the dev server
 * (`src/preview-card.tsx`), `scripts/write-previews.mjs` photographs it, and
 * the pictures go to `public/previews/`, which the built pages name in their
 * `og:image` (`link-pages.ts`).
 *
 * The still is the overview's (`ExhibitPreview`, fitted to the card's height
 * by `FittedPreview`): the page's own preview mode, the motion the page
 * computes, played for a moment and held. A drawing made for the card would
 * drift from the exhibit it announces.
 */

import { HelpCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { exhibitEntry, type Exhibit } from "./exhibits";
import { FittedPreview } from "./fitted-preview";

/** The overview card's four: one swinging, one drawing, one ringing, one of
 *  light, so the site does not look like pendulums alone. */
const OVERVIEW_STILLS: readonly Exhibit[] = ["wave", "harmonograph", "chladni", "rainbow"];

export type Card = Exhibit | "overview";

/** The frame round a still: round the whole cell, the exhibit's picture box
 *  and each of the overview's four, which are not all of one shape and would
 *  otherwise show frames of different sizes. */
const FRAME = "overflow-hidden rounded-xl border border-subtle bg-surface";

/** The exhibit's picture box: as tall as the card allows, and as wide. */
const PICTURE = { width: 600, height: 534 };

function Brand({ large = false }: { large?: boolean }) {
  const { t } = useTranslation();
  return (
    <p className={`flex items-center gap-3 font-semibold text-primary ${large ? "text-5xl" : "text-2xl"}`}>
      <img src="/favicon.svg" alt="" className={large ? "size-14" : "size-9"} />
      {t("app.name")}
    </p>
  );
}

function ExhibitCard({ exhibit, held }: { exhibit: Exhibit; held: boolean }) {
  const { t } = useTranslation();
  const { path } = exhibitEntry(exhibit);
  return (
    <div className="flex size-full items-center gap-12 px-12">
      <div className="shrink-0" style={{ width: PICTURE.width }}>
        <FittedPreview exhibit={exhibit} still={held} height={PICTURE.height} box={FRAME} frame="p-6" plain />
      </div>
      <div className="flex min-w-0 flex-col justify-between" style={{ height: PICTURE.height }}>
        <Brand />
        <div className="space-y-5">
          <h1 className="text-[2.6rem] leading-tight font-semibold text-primary">
            {t(`experiments.exhibits.${exhibit}.title`)}
          </h1>
          <p className="flex gap-3 text-2xl leading-snug text-primary">
            <HelpCircle className="mt-1 size-7 shrink-0 text-brand" aria-hidden />
            {t(`experiments.exhibits.${exhibit}.question`)}
          </p>
          <p className="text-xl leading-relaxed text-secondary">{t(`experiments.exhibits.${exhibit}.summary`)}</p>
        </div>
        <p className="text-xl text-muted">staunlabor.app{path}</p>
      </div>
    </div>
  );
}

function OverviewCard({ held }: { held: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="flex size-full items-center gap-12 px-12">
      <div className="flex h-full w-[440px] shrink-0 flex-col justify-between py-14">
        <Brand large />
        <p className="text-4xl leading-tight font-semibold text-primary">{t("app.tagline")}</p>
        <p className="text-xl text-muted">staunlabor.app</p>
      </div>
      <div className="grid flex-1 grid-cols-2 gap-4">
        {OVERVIEW_STILLS.map((exhibit) => (
          <FittedPreview key={exhibit} exhibit={exhibit} still={held} height={262} box={FRAME} frame="p-3" plain />
        ))}
      </div>
    </div>
  );
}

/** One card, `held` once the photographer says so. */
export function PreviewCard({ card, held }: { card: Card; held: boolean }) {
  return (
    <div data-card={card} className="h-[630px] w-[1200px] overflow-hidden bg-surface-2">
      {card === "overview" ? <OverviewCard held={held} /> : <ExhibitCard exhibit={card} held={held} />}
    </div>
  );
}
