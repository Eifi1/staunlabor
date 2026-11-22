import { useTranslation } from "react-i18next";
import { CircleAlert, CircleCheck } from "lucide-react";
import { Button, TextLink, formatDate } from "@eifi1/ui-kit";
import { useCurrentUser } from "@eifi1/ui-kit/accounts";
import { accounts } from "@/shared/api/accounts";
import { useLocale } from "@/shared/i18n/use-locale";
import { CHECKS_ANCHOR } from "./check-section";
import { checkCases, checkedOn, useCheckVerdict, useChecks } from "./checks";
import type { Exhibit } from "./exhibits";

/** An admin's "checked" and "take it back", for an exhibit with cases. Only
 *  for a signed-in reader, and shown only when the account is an admin's; the
 *  server refuses everybody else anyway. */
function AdminVerdict({ exhibit, checked }: { exhibit: Exhibit; checked: boolean }) {
  const { t } = useTranslation();
  const me = useCurrentUser();
  const verdict = useCheckVerdict(exhibit);
  if (me.data?.role !== "ADMIN") return null;
  return (
    <span className="inline-flex items-center gap-2">
      <Button
        variant={checked ? "ghost" : "secondary"}
        size="sm"
        pending={verdict.isPending}
        onClick={() => verdict.mutate(!checked)}
      >
        {t(checked ? "experiments.checks.admin.uncheck" : "experiments.checks.admin.check")}
      </Button>
      {verdict.isError && <span className="text-sm text-danger">{t("experiments.checks.admin.failed")}</span>}
    </span>
  );
}

/**
 * Whether this exhibit's calculations are checked, in one line under its
 * title: "not yet checked" with the way to its cases, or the day an admin
 * checked them. In place of the warning every page carried from 2026-11-15:
 * the reviews of 2026-11-19 found that a warning in second place costs more
 * trust than it earns, and asked for it where the calculation is. A page that
 * cannot reach the server says "not yet checked", the safe answer. The day is
 * a bare `YYYY-MM-DD`, which the kit's `formatDate` reads as the calendar day
 * it names in every time zone.
 */
export function CheckStatus({ exhibit }: { exhibit: Exhibit }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const checks = useChecks();
  const signedIn = accounts.useSession((session) => session.user !== null);
  const day = checkedOn(checks.data, exhibit);
  const hasCases = checkCases(exhibit).length > 0;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
      {day ? (
        <span className="inline-flex items-center gap-1.5 text-success">
          <CircleCheck className="size-4" aria-hidden />
          {t("experiments.checks.status.checked", { date: formatDate(day, "long", { locale }) })}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-secondary">
          <CircleAlert className="size-4 text-warning" aria-hidden />
          {t("experiments.checks.status.unchecked")}
        </span>
      )}
      {hasCases && <TextLink href={`#${CHECKS_ANCHOR}`}>{t("experiments.checks.status.to_cases")}</TextLink>}
      {hasCases && signedIn && <AdminVerdict exhibit={exhibit} checked={day !== null} />}
    </div>
  );
}
