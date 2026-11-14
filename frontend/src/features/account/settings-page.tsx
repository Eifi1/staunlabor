import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import {
  AccountDeletionSection,
  AccountEmailSection,
  AccountExportSection,
  AccountPasskeysSection,
  AccountPasswordSection,
  AccountProfileSection,
  AccountSessionsSection,
  useCurrentUser,
} from "@eifi1/ui-kit/accounts";
import { useRoles } from "./roles";

/** The account's settings: the kit's sections, wired to server-kit's routes. An admin is
 *  pointed to the admin page, an admin or a reviewer to the translation review: the server
 *  refuses both to everybody else anyway. */
export function SettingsPage() {
  const { t } = useTranslation();
  const me = useCurrentUser();
  const roles = useRoles();
  const role = me.data?.role;
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">{t("account.settings")}</h1>
      {role === "ADMIN" || role === "REVIEWER" ? (
        <nav aria-label={t("account.more")} className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {role === "ADMIN" ? (
            <Link className="underline underline-offset-2" to="/admin">
              {t("account.admin")}
            </Link>
          ) : null}
          <Link className="underline underline-offset-2" to="/translations">
            {t("account.reviewTranslations")}
          </Link>
        </nav>
      ) : null}
      <AccountProfileSection
        roleLabel={(role) => (role && role in roles ? roles[role as keyof typeof roles].label : null)}
      />
      <AccountEmailSection />
      <AccountPasswordSection />
      <AccountPasskeysSection />
      <AccountSessionsSection />
      <AccountExportSection />
      <AccountDeletionSection />
    </div>
  );
}
