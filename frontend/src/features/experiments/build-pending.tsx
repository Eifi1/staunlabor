/**
 * An exhibit's try-it part until its build is there: loading while the
 * server's answer is on its way, and the failure if it never came. Every page
 * gates its twin on its default build (`useExperimentsDefaults`), the chair
 * on its boxes and the Chladni plate on its modes too; each page spelt both
 * states out for itself.
 *
 *     {defaults.isPending || !build ? (
 *       <BuildPending pending={defaults.isPending} error={defaults.error} />
 *     ) : ( …the twin… )}
 *
 * The page keeps the condition, so its build is narrowed in the branch that
 * draws it.
 */

import { useTranslation } from "react-i18next";
import { AlertBanner, LoadingState } from "@eifi1/ui-kit";
import { apiErrorMessage } from "@/shared/api/client";

export function BuildPending({ pending, error }: { pending: boolean; error: unknown }) {
  const { t } = useTranslation();
  return pending ? (
    <LoadingState className="py-10" label={t("common.loading")} />
  ) : (
    <AlertBanner tone="danger">{apiErrorMessage(error, t("experiments.failed"))}</AlertBanner>
  );
}
