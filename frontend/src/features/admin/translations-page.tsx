import { useTranslation } from "react-i18next";
import { AccountTranslationReview } from "@eifi1/ui-kit/accounts";
import { kitLabels } from "@/shared/i18n/kit-labels";
// The module path in full: ts-prune does not resolve `@/shared/i18n` through the folder and
// would report `loadBundle` as unused.
import { loadBundle } from "@/shared/i18n/index";
import { OPERATOR } from "@/features/site/operator";

/**
 * `/translations`: a native reader reviews the site's words and the kit's, in the languages
 * an admin granted (the kit's review page on server-kit's `translation_review_router`).
 *
 * The strings are what the site ships — its seven catalogues and the kit's — so the list
 * cannot drift from what readers see; German is the language the site is written in, and
 * every other one is read against it (English against German too). The areas are the
 * server's `REVIEW_AREAS`: the exhibits, which want a physics teacher as much as a native
 * reader, and the legal pages. Corrections are exported for a developer; the catalogues are
 * source code. Nothing is kept in the browser.
 *
 * Under the kit's own lead, one sentence of the site's (Marcel, 2026-11-15, in place of
 * terms of use): a suggestion is sent under CC BY 4.0, the licence of every text here, so
 * it may be taken into the catalogues.
 */
export function TranslationsPage() {
  const { t, i18n } = useTranslation();
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col px-4 py-8">
      <AccountTranslationReview
        loadStrings={loadBundle}
        kitWords={{ operator: OPERATOR }}
        referenceOf={(code) => (code === "de-CH" ? "en" : "de-CH")}
        reviewAreas={["experiments", "legal"]}
        areaLabels={{ experiments: t("account.areas.experiments"), legal: t("account.areas.legal") }}
        exportName="staunlabor"
        description={
          <>
            {kitLabels(i18n.language).accountTranslations.description} {t("account.contributions.translations")}
          </>
        }
      />
    </div>
  );
}
