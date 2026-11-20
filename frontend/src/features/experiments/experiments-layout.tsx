import type { MouseEvent } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import { ExternalLink } from "lucide-react";
import { LanguageMenu, ThemeToggle } from "@eifi1/ui-kit";
import { changeLanguage } from "@/shared/i18n/index";
import { LANGUAGES } from "@/shared/i18n/languages";
import { useLanguage } from "@/shared/i18n/use-locale";
import { useTheme } from "@/shared/state/theme-store";
import { CONTAINER } from "@/shared/ui/page-shell";
import { SiteFooter } from "@/features/site/site-footer";
import { SiteSearch } from "@/features/site/site-search";
import { COURSE } from "./exhibit-frame";
import { EXHIBITS_ANCHOR, OVERVIEW_PATH } from "./exhibits";
import { scrollToList } from "./list-anchor";

/** A link in the header's row: quiet until pointed at, and plain text once
 *  it is the page shown. */
const NAV_LINK =
  "inline-flex min-h-11 items-center gap-1 rounded-md px-1 text-sm font-medium text-secondary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand aria-[current=page]:text-primary";

/**
 * The site's frame: a header that stays at the top, the page, and the footer
 * (Marcel's spec of 2026-11-20). The header holds the name, the three ways
 * in (the exhibits, the basics they stand on, the page about the site), the
 * search, the language and the light or dark theme; the account stays in the
 * footer. On a phone the three links give way to the search: the footer
 * names the about page too, and the front page is the list.
 *
 * The links are a plain row in the header until the kit's `TopBarNav` (0.66,
 * proposed by UI-Kit on 2026-11-19) takes them.
 */
export function ExperimentsLayout() {
  const { t } = useTranslation();
  const language = useLanguage();
  const mode = useTheme((s) => s.mode);
  const setPreference = useTheme((s) => s.setPreference);
  const { pathname } = useLocation();
  // On the front page the list is a scroll away, not a navigation.
  const toList = (event: MouseEvent) => {
    if (pathname === OVERVIEW_PATH && scrollToList()) event.preventDefault();
  };
  return (
    <div className="flex min-h-dvh w-full flex-col bg-page">
      <header className="sticky top-0 z-30 shrink-0 border-b border-subtle bg-page print:hidden">
        <div className={`${CONTAINER} flex min-h-14 items-center gap-6`}>
          <Link to={OVERVIEW_PATH} className="flex items-center gap-2 text-base font-semibold text-primary">
            <img src="/favicon.svg" alt="" className="size-6" />
            {t("app.name")}
          </Link>
          <nav aria-label={t("site.nav.label")} className="hidden items-center gap-5 md:flex">
            <Link to={{ pathname: OVERVIEW_PATH, hash: EXHIBITS_ANCHOR }} onClick={toList} className={NAV_LINK}>
              {t("site.nav.exhibits")}
            </Link>
            <a href={COURSE} className={NAV_LINK}>
              {t("site.nav.basics")}
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
            <NavLink to="/about" className={NAV_LINK}>
              {t("site.nav.about")}
            </NavLink>
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <SiteSearch />
            <LanguageMenu
              options={[...LANGUAGES]}
              current={language}
              onChange={(code) => void changeLanguage(code, { remember: true })}
            />
            <ThemeToggle
              mode={mode}
              onChange={setPreference}
              aria-label={t("common.theme_toggle")}
              title={t("common.theme_toggle")}
            />
          </div>
        </div>
      </header>
      <main className="flex w-full flex-1 flex-col">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
