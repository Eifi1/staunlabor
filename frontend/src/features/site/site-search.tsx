import { useTranslation } from "react-i18next";
import { GlobalSearch, type SearchEntry } from "@eifi1/ui-kit";
import { Info } from "lucide-react";
import { EXHIBIT_MODULES } from "@/features/experiments/exhibit-modules";
import { EXHIBITS } from "@/features/experiments/exhibits";
import { SITE_PATHS } from "@/shared/lib/site-paths";

/** How many of the newest exhibits the empty search suggests: the list's
 *  first, which are the newest. */
const SUGGESTED = 5;

/**
 * The header's search, Ctrl K or ⌘K anywhere (Marcel's spec of 2026-11-20):
 * the kit's `GlobalSearch`, as UI-Kit advised, over every exhibit, found
 * by its name, its question, its topics or what its summary says, in the
 * reader's language; and the page about the site. Nothing is sent anywhere:
 * the index is these entries, ranked in the browser.
 */
export function SiteSearch() {
  const { t } = useTranslation();
  const exhibits: SearchEntry[] = EXHIBITS.map((entry) => {
    const Icon = EXHIBIT_MODULES[entry.exhibit].icon;
    return {
      id: entry.exhibit,
      title: t(`experiments.exhibits.${entry.exhibit}.title`),
      keywords: [
        t(`experiments.exhibits.${entry.exhibit}.question`),
        ...entry.topics.map((topic) => t(`experiments.topics.${topic}`)),
      ],
      description: t(`experiments.exhibits.${entry.exhibit}.summary`),
      group: t("site.nav.exhibits"),
      href: entry.path,
      icon: <Icon className="size-4" aria-hidden />,
    };
  });
  const pages: SearchEntry[] = [
    {
      id: "about",
      title: t("site.about.title"),
      group: t("site.footer.label"),
      href: SITE_PATHS.about,
      icon: <Info className="size-4" aria-hidden />,
    },
  ];
  return (
    <GlobalSearch
      entries={[...exhibits, ...pages]}
      suggestions={exhibits.slice(0, SUGGESTED).map((entry) => entry.id)}
      groupOrder={[t("site.nav.exhibits")]}
      triggerName="withShortcut"
      triggerIconSize={20}
      labels={{
        trigger: t("site.search.trigger"),
        placeholder: t("site.search.placeholder"),
        // The kit's default names the button "Search (Ctrl K)"; this one says
        // what it searches, and the keys as the kit writes them.
        shortcut: (keys) => `${t("site.search.trigger")} (${keys})`,
      }}
    />
  );
}
