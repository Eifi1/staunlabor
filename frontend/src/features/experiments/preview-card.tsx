/**
 * The picture a shared link shows (WhatsApp, Signal, Mastodon …), 1200 × 630:
 * an exhibit's own preview, held still, beside its title, its question and its
 * address; for the overview, the site's name and line beside four of them.
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
import { EXHIBITS, type Exhibit } from "./exhibits";
import { FittedPreview } from "./fitted-preview";

/** The overview card's four: one swinging, one drawing, one ringing, one of
 *  light, so the site does not look like pendulums alone. */
const OVERVIEW_STILLS: readonly Exhibit[] = ["wave", "harmonograph", "chladni", "rainbow"];

export type Card = Exhibit | "overview";

/** The frame round a still: round the preview on an exhibit's card, round
 *  the whole cell in the overview's grid, whose four are not all of one shape
 *  and would otherwise show four frames of four sizes. */
const FRAME = "overflow-hidden rounded-xl border border-subtle bg-surface";

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
  const path = EXHIBITS.find((entry) => entry.exhibit === exhibit)?.path ?? "";
  return (
    <div className="flex size-full items-center gap-12 px-12">
      <div className="w-[600px] shrink-0">
        <FittedPreview exhibit={exhibit} still={held} height={534} frame={FRAME} />
      </div>
      <div className="flex h-full min-w-0 flex-col justify-between py-14">
        <Brand />
        <div className="space-y-6">
          <h1 className="text-5xl leading-tight font-semibold text-primary">
            {t(`experiments.exhibits.${exhibit}.title`)}
          </h1>
          <p className="flex gap-3 text-2xl leading-snug text-secondary">
            <HelpCircle className="mt-1 size-7 shrink-0 text-brand" aria-hidden />
            {t(`experiments.exhibits.${exhibit}.question`)}
          </p>
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
          <FittedPreview key={exhibit} exhibit={exhibit} still={held} height={262} box={FRAME} />
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
