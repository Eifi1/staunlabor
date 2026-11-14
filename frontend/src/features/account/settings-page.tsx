import { useTranslation } from "react-i18next";
import {
  AccountDeletionSection,
  AccountEmailSection,
  AccountExportSection,
  AccountInvitationsSection,
  AccountPasskeysSection,
  AccountPasswordSection,
  AccountProfileSection,
  AccountSessionsSection,
  useCurrentUser,
} from "@eifi1/ui-kit/accounts";
import { LANGUAGE_CODES } from "@/shared/i18n/languages";

/** The account's settings: the kit's sections, wired to server-kit's routes. The
 *  invitations only for an admin: the server refuses everybody else anyway. */
export function SettingsPage() {
  const { t } = useTranslation();
  const me = useCurrentUser();
  const roles = {
    ADMIN: { label: t("account.roles.ADMIN") },
    MEMBER: { label: t("account.roles.MEMBER") },
    REVIEWER: { label: t("account.roles.REVIEWER") },
  };
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">{t("account.settings")}</h1>
      <AccountProfileSection
        roleLabel={(role) => (role && role in roles ? roles[role as keyof typeof roles].label : null)}
      />
      <AccountEmailSection />
      <AccountPasswordSection />
      <AccountPasskeysSection />
      <AccountSessionsSection />
      {me.data?.role === "ADMIN" ? (
        <AccountInvitationsSection roles={roles} invitableRoles={["MEMBER", "REVIEWER"]} languages={LANGUAGE_CODES} />
      ) : null}
      <AccountExportSection />
      <AccountDeletionSection />
    </div>
  );
}
