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
 * The still is the overview's (`ExhibitPreview`): the page's own preview mode,
 * the motion the page computes, played for a moment and held. A drawing made
 * for the card would drift from the exhibit it announces.
 */

import { useLayoutEffect, useState } from "react";
import { HelpCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ExhibitPreview } from "./exhibit-preview";
import { EXHIBITS, type Exhibit } from "./exhibits";

/** The overview card's four: one swinging, one drawing, one ringing, one of
 *  light, so the site does not look like pendulums alone. */
const OVERVIEW_STILLS: readonly Exhibit[] = ["wave", "harmonograph", "chladni", "rainbow"];

export type Card = Exhibit | "overview";

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

/** A preview in its frame, scaled down when it is taller than `limit` (px):
 *  the elephant, the diver and the rods are drawn upright, and at the card's
 *  width they would run off its edges. A transform and not a narrower box, so
 *  the preview lays itself out at the width it was drawn for. `data-still` is
 *  what the photographer waits on. `boxed` puts the frame round the whole
 *  box rather than the preview: the overview's grid, whose four are not all
 *  of one shape, then shows four equal cells. */
function Still({
  exhibit,
  held,
  limit,
  boxed = false,
}: {
  exhibit: Exhibit;
  held: boolean;
  limit: number;
  boxed?: boolean;
}) {
  const [scale, setScale] = useState(1);
  const [frame, setFrame] = useState<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    if (!frame || typeof ResizeObserver !== "function") return;
    const fit = () => setScale(frame.offsetHeight > limit ? limit / frame.offsetHeight : 1);
    const observer = new ResizeObserver(fit);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [frame, limit]);
  return (
    <div className={`flex items-center justify-center ${boxed ? FRAME : ""}`} style={{ height: limit }}>
      <div
        ref={setFrame}
        data-still={exhibit}
        className={`w-full shrink-0 ${boxed ? "" : FRAME}`}
        style={scale < 1 ? { transform: `scale(${scale})` } : undefined}
      >
        <ExhibitPreview exhibit={exhibit} still={held} />
      </div>
    </div>
  );
}

function ExhibitCard({ exhibit, held }: { exhibit: Exhibit; held: boolean }) {
  const { t } = useTranslation();
  const path = EXHIBITS.find((entry) => entry.exhibit === exhibit)?.path ?? "";
  return (
    <div className="flex size-full items-center gap-12 px-12">
      <div className="w-[600px] shrink-0">
        <Still exhibit={exhibit} held={held} limit={534} />
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
          <Still key={exhibit} exhibit={exhibit} held={held} limit={262} boxed />
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
