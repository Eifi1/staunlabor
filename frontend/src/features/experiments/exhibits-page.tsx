import { useState } from "react";
import { useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { RotateCcw } from "lucide-react";
import { Button, Chip, ProgressBar, usePageSeo } from "@eifi1/ui-kit";
import { PAGE_SHELL } from "@/shared/ui/page-shell";
import { ExhibitGrid } from "./exhibit-cards";
import { EXHIBITS, EXHIBITS_PATH, TOPICS_SHOWN, type Topic } from "./exhibits";
import { useTried } from "./tried";
import { dayIn, weekOf, weeklyExhibit } from "./weekly";

/**
 * Every exhibit, on a page of its own (Marcel, 2026-11-20: the front page
 * shows a few, "es soll doch weiterhin eine separate Seite mit allen
 * Exponaten geben"): filtered by what they are about, ticked once tried on
 * this device (`tried.ts`), and growing as the reader scrolls
 * (`ExhibitGrid`).
 *
 * The filter is in the address (`?topic=flow`), so the browser's back button
 * from an exhibit returns to the list as it was, filter and depth.
 */
export function ExhibitsPage() {
  const { t } = useTranslation();
  usePageSeo({
    canonicalPath: EXHIBITS_PATH,
    title: `${t("experiments.overview.all")} — ${t("app.name")}`,
    description: t("experiments.list.lead"),
  });
  const [week] = useState(() => weekOf(dayIn()));
  const current = weeklyExhibit(week);
  const tried = useTried((s) => s.tried);
  const forget = useTried((s) => s.forget);
  const [params, setParams] = useSearchParams();
  const asked = params.get("topic");
  const topic = TOPICS_SHOWN.find((tp) => tp === asked) ?? null;
  const choose = (next: Topic | null) => setParams(next ? { topic: next } : {}, { replace: true });
  const shown = EXHIBITS.filter((entry) => topic === null || entry.topics.includes(topic));
  return (
    <div className={PAGE_SHELL}>
      <div className="flex flex-wrap items-end justify-between gap-3 pt-2">
        <div className="space-y-1">
          <div className="flex items-baseline gap-3">
            <h1 className="font-serif text-3xl font-semibold text-primary md:text-4xl">
              {t("experiments.overview.all")}
            </h1>
            <span className="font-mono text-sm text-muted">{EXHIBITS.length}</span>
          </div>
          <p className="max-w-[65ch] text-sm text-secondary md:text-base">{t("experiments.list.lead")}</p>
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
          max={EXHIBITS.length}
          showValue
          formatValue={(v, max) => t("experiments.overview.tried.count", { tried: v, total: max })}
          tone="success"
        />
      )}
      <div role="group" aria-label={t("experiments.overview.topics_label")} className="flex flex-wrap gap-2">
        <Chip onClick={() => choose(null)} selected={topic === null}>
          {t("experiments.overview.all_topics")}
        </Chip>
        {TOPICS_SHOWN.map((tp) => (
          <Chip key={tp} onClick={() => choose(topic === tp ? null : tp)} selected={topic === tp}>
            {t(`experiments.topics.${tp}`)}
          </Chip>
        ))}
      </div>
      {/* A list of its own per filter: it starts short again, and keeps its
          own length for the way back. */}
      <ExhibitGrid key={topic ?? ""} entries={shown} current={current} progressive memory={topic ?? ""} />
      <p className="text-caption text-muted">{t("experiments.overview.credit")}</p>
    </div>
  );
}
