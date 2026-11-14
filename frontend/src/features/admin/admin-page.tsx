import { useTranslation } from "react-i18next";
import {
  AccountAdminLogSection,
  AccountAdminOverviewSection,
  AccountInvitationsSection,
  AccountMailTestSection,
  AccountUserRosterSection,
} from "@eifi1/ui-kit/accounts";
import { LANGUAGE_CODES } from "@/shared/i18n/languages";
import { useRoles } from "@/features/account/roles";

/**
 * The admin's page: the kit's admin sections on server-kit's `user_admin_router`, one under the
 * other — the counts, the accounts with what an admin may do to each, the invitations, the
 * log, and the test mail. One page, since the site has few accounts and one admin; the
 * overview's tiles link to the sections on it.
 *
 * The reviewer's scope is on (the seven languages, the areas `experiments` and `legal`, the
 * server's `REVIEW_AREAS`), and so is "Erase now": an account that asked to be deleted is
 * deactivated at once and erased by the admin (`DeletionMode.OPERATOR` in `accounts.py`). The
 * server refuses all of it to anyone but an admin.
 */
export function AdminPage() {
  const { t } = useTranslation();
  const roles = useRoles();
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8">
      <h1 className="text-2xl font-semibold">{t("account.admin")}</h1>
      <AccountAdminOverviewSection
        hrefs={{
          users_total: "#users",
          invitations_pending: "#invitations",
          deletion_requests: "?state=deletion_requested#users",
        }}
      />
      <AccountUserRosterSection
        roles={roles}
        erase
        reviewer={{
          languages: LANGUAGE_CODES,
          areas: [
            { value: "experiments", label: t("account.areas.experiments") },
            { value: "legal", label: t("account.areas.legal") },
          ],
        }}
      />
      <section id="invitations">
        <AccountInvitationsSection roles={roles} invitableRoles={["MEMBER", "REVIEWER"]} languages={LANGUAGE_CODES} />
      </section>
      <AccountAdminLogSection roleLabel={(role) => (role in roles ? roles[role as keyof typeof roles].label : role)} />
      <AccountMailTestSection />
    </div>
  );
}
