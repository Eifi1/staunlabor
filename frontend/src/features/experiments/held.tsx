/**
 * An answer held back until the reader has tried the exhibit.
 *
 * Nine play cards showed the answer to their page's own question before
 * anything was tried: a verdict beside the drawing, a figure, the race's table
 * in finishing order (the sweep of 2026-11-19). The question is the reader's to
 * guess at first. Each page says what "tried" means for it: the cone has
 * rolled, the ball has fallen, an hour has passed under the pendulum. And the
 * reader can always ask for the answer at once.
 *
 * Per visit, and kept when the settings change: once seen, hiding it again on
 * every slider would only get in the way. The state lives in the page, above a
 * play card that is remounted for every new build.
 */

import { useCallback, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Eye } from "lucide-react";
import { Button } from "@eifi1/ui-kit";

export interface Held {
  /** Whether the answer is out. */
  shown: boolean;
  /** Lets it out: the page's own moment, or the reader asking. */
  show: () => void;
}

export function useHeld(): Held {
  const [shown, setShown] = useState(false);
  const show = useCallback(() => setShown(true), []);
  return { shown, show };
}

/** The answer once it is out; until then, where it will stand and the way to
 *  it at once. */
export function HeldAnswer({ held, children }: { held: Held; children: ReactNode }) {
  const { t } = useTranslation();
  if (held.shown) return <>{children}</>;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-secondary">
      <span>{t("experiments.frame.held")}</span>
      <Button variant="ghost" size="sm" onClick={held.show}>
        <Eye className="size-4" aria-hidden />
        {t("experiments.frame.show")}
      </Button>
    </div>
  );
}
