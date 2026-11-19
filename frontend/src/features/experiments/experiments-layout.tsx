import { Link, Outlet } from "react-router";
import { useTranslation } from "react-i18next";
import { LanguageMenu, ThemeToggle } from "@eifi1/ui-kit";
import { changeLanguage } from "@/shared/i18n/index";
import { LANGUAGES } from "@/shared/i18n/languages";
import { useLanguage } from "@/shared/i18n/use-locale";
import { useTheme } from "@/shared/state/theme-store";
import { SiteFooter } from "@/features/site/site-footer";

/**
 * The site's frame: the name on the left, the language and the light or dark
 * theme on the right, the page, and the footer. Nothing else in the header
 * (Marcel, 2026-11-19): the first thing a reader sees is the experiment of the
 * day, and a strip of thirty-five exhibits beside it was too much. The
 * exhibits are listed under the day's one on the front page, and every
 * exhibit's page links back to that list.
 */
export function ExperimentsLayout() {
  const { t } = useTranslation();
  const language = useLanguage();
  const mode = useTheme((s) => s.mode);
  const setPreference = useTheme((s) => s.setPreference);
  return (
    <div className="flex min-h-dvh w-full flex-col bg-page">
      <header className="flex shrink-0 items-center gap-3 border-b border-subtle px-3 py-2 md:px-6 print:hidden">
        <Link to="/" className="flex items-center gap-2 text-base font-semibold text-primary">
          <img src="/favicon.svg" alt="" className="size-6" />
          {t("app.name")}
        </Link>
        <div className="ml-auto flex shrink-0 items-center gap-1">
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
      </header>
      <main className="flex w-full flex-1 flex-col">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
