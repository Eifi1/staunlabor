/**
 * An exhibit's try-it part until its build is there: the twin's card in
 * outline while the server's answer is on its way, and the failure if it
 * never came. Every page gates its twin on its default build
 * (`useExperimentsDefaults`), the chair on its boxes and the Chladni plate on
 * its modes too; each page spelt both states out for itself.
 *
 *     {defaults.isPending || !build ? (
 *       <BuildPending pending={defaults.isPending} error={defaults.error} />
 *     ) : ( …the twin… )}
 *
 * The page keeps the condition, so its build is narrowed in the branch that
 * draws it.
 */

import { useTranslation } from "react-i18next";
import { AlertBanner, Card, CardHeader, Skeleton } from "@eifi1/ui-kit";
import { apiErrorMessage } from "@/shared/api/client";
import { SIDE } from "./stage";

export function BuildPending({ pending, error }: { pending: boolean; error: unknown }) {
  const { t } = useTranslation();
  return pending ? (
    <TwinOutline label={t("common.loading")} />
  ) : (
    <AlertBanner tone="danger">{apiErrorMessage(error, t("experiments.failed"))}</AlertBanner>
  );
}

/**
 * The twin's card (`WidgetCard` in the side-by-side layout, `SIDE`) as the
 * kit's skeletons: its title and hint, a button, the drawing and a column of
 * sliders. On a cold start the server takes some ten seconds to wake, and a
 * spinner alone said nothing of what was coming (Marcel, 2026-11-17). It
 * pulses as every kit placeholder does and holds still under reduced motion;
 * "loading" is said once, by the title's placeholder.
 */
function TwinOutline({ label }: { label: string }) {
  return (
    <div aria-busy="true">
      <Card padding="md" density="compact" className="space-y-4">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton label={label} className="h-5 w-48 max-w-full" />
              <Skeleton className="w-3/4" />
            </div>
            <Skeleton className="h-8 w-24" />
          </div>
        </CardHeader>
        <div className={SIDE.grid}>
          <div className={SIDE.views}>
            <Skeleton shape="block" className="mx-auto aspect-[4/3] h-auto w-full max-w-xl" />
          </div>
          <div className={SIDE.column}>
            <Skeleton lines={2} />
            <Skeleton lines={2} />
            <Skeleton lines={2} />
          </div>
        </div>
      </Card>
    </div>
  );
}
