import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { accounts } from "@/shared/api/accounts";
import { ISSUES_URL, SOURCE_URL } from "./operator";

/** The foot of every page: the site's own pages, the code and where to say
 *  what is wrong, the licences, and the version. */
export function SiteFooter() {
  const { t } = useTranslation();
  // The only way into the accounts while signed out: a modest link here, never in the
  // exhibits' way (plan, second stage: the open site first).
  const signedIn = accounts.useSession((session) => session.user !== null);
  const link = "underline-offset-2 hover:underline";
  return (
    <footer className="mt-auto border-t border-subtle px-3 py-4 text-caption text-muted md:px-6 print:hidden">
      <nav aria-label={t("site.footer.label")} className="flex flex-wrap gap-x-4 gap-y-1">
        <Link className={link} to="/about">
          {t("site.footer.about")}
        </Link>
        <Link className={link} to="/impressum">
          {t("site.footer.imprint")}
        </Link>
        <Link className={link} to="/privacy">
          {t("site.footer.privacy")}
        </Link>
        <a className={link} href={SOURCE_URL}>
          {t("site.footer.source")}
        </a>
        <a className={link} href={ISSUES_URL}>
          {t("site.footer.issues")}
        </a>
        <Link className={link} to={signedIn ? "/settings" : "/login"}>
          {signedIn ? t("site.footer.account") : t("site.footer.signIn")}
        </Link>
      </nav>
      <p className="mt-2">
        {t("site.footer.licence")} · {t("site.footer.version", { version: __APP_VERSION__ })}
      </p>
    </footer>
  );
}
