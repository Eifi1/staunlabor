import { useTranslation } from "react-i18next";

/** The site's three roles in the reader's language, as the kit's role chips and selects read them. */
export function useRoles() {
  const { t } = useTranslation();
  return {
    ADMIN: { label: t("account.roles.ADMIN"), tone: "brand" as const },
    MEMBER: { label: t("account.roles.MEMBER") },
    REVIEWER: { label: t("account.roles.REVIEWER") },
  };
}
