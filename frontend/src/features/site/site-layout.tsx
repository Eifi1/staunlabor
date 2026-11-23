import { Link, NavLink, Outlet, useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import { LanguageMenu, ThemeToggle } from "@eifi1/ui-kit";
import { changeLanguage } from "@/shared/i18n/index";
import { LANGUAGES } from "@/shared/i18n/languages";
import { useLanguage } from "@/shared/i18n/use-locale";
import { useTheme } from "@/shared/state/theme-store";
import { CONTAINER } from "@/shared/ui/page-shell";
import { SITE_PATHS } from "@/shared/lib/site-paths";
import { BASICS_PATH } from "@/features/course/lessons";
import { EXHIBITS_PATH, OVERVIEW_PATH } from "@/features/experiments/exhibits";
import { SiteFooter } from "./site-footer";
import { SiteSearch } from "./site-search";
import { useScrollMemory } from "./scroll-memory";

/** A link in the header's row: quiet until pointed at, and plain text once
 *  it is the page shown. */
const NAV_LINK =
  "inline-flex min-h-11 items-center gap-1 rounded-md px-1 text-sm font-medium text-secondary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand aria-[current=page]:text-primary";

/**
 * The site's frame around every page, the exhibits', the course's, the site's
 * own and the account's: a header that stays at the top, the page, and the
 * footer (Marcel's spec of 2026-11-20). The header holds the name, the three ways
 * in (the exhibits, the basics they stand on, the page about the site), the
 * search, the language and the light or dark theme; the account stays in the
 * footer. On a phone the three links give way to the search: the footer
 * names the about page too, and the front page leads to the others.
 *
 * Each way in is a page of its own, so the browser's back button returns to
 * where the reader clicked (`useScrollMemory`); a new page fades in, unless
 * the reader's system asks for less motion.
 *
 * The links are a plain row in the header until the kit's `TopBarNav` (0.66,
 * proposed by UI-Kit on 2026-11-19) takes them.
 */
export function SiteLayout() {
  const { t } = useTranslation();
  const language = useLanguage();
  const mode = useTheme((s) => s.mode);
  const setPreference = useTheme((s) => s.setPreference);
  const { pathname } = useLocation();
  useScrollMemory();
  return (
    <div className="flex min-h-dvh w-full flex-col bg-page">
      <header className="sticky top-0 z-30 shrink-0 border-b border-subtle bg-page print:hidden">
        <div className={`${CONTAINER} flex min-h-14 items-center gap-6`}>
          <Link to={OVERVIEW_PATH} className="flex items-center gap-2 text-base font-semibold text-primary">
            <img src="/favicon.svg" alt="" className="size-6" />
            {t("app.name")}
          </Link>
          <nav aria-label={t("site.nav.label")} className="hidden items-center gap-5 md:flex">
            <NavLink to={EXHIBITS_PATH} className={NAV_LINK}>
              {t("site.nav.exhibits")}
            </NavLink>
            <NavLink to={BASICS_PATH} className={NAV_LINK}>
              {t("site.nav.basics")}
            </NavLink>
            <NavLink to={SITE_PATHS.about} className={NAV_LINK}>
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
        {/* Keyed by the page, so each new one comes in with the fade. */}
        <div key={pathname} className="flex flex-1 flex-col motion-safe:animate-[page-in_240ms_ease-out]">
          <Outlet />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
