import { Link, Outlet, useLocation, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { LanguageMenu, NavPills, Select, ThemeToggle, usePhoneLayout, type NavPillItem } from "@eifi1/ui-kit";
import { changeLanguage } from "@/shared/i18n/index";
import { LANGUAGES } from "@/shared/i18n/languages";
import { useLanguage } from "@/shared/i18n/use-locale";
import { useTheme } from "@/shared/state/theme-store";
import { SiteFooter } from "@/features/site/site-footer";
import { EXHIBITS, OVERVIEW_PATH, exhibitAt } from "./exhibits";

/**
 * The site's frame: the name, a strip to move between the overview and the
 * exhibits, the language and the light or dark theme, and the footer.
 *
 * On a phone the strip is a select naming the page the reader is on; from `md`
 * up it is the names in a row.
 */
export function ExperimentsLayout() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const phone = usePhoneLayout();
  const language = useLanguage();
  const mode = useTheme((s) => s.mode);
  const setPreference = useTheme((s) => s.setPreference);
  const here = pathname.replace(/\/+$/, "") || "/";
  const current = here === OVERVIEW_PATH ? OVERVIEW_PATH : (exhibitAt(pathname)?.path ?? null);
  const items: NavPillItem<string>[] = [
    { value: OVERVIEW_PATH, label: t("experiments.overview.short"), href: OVERVIEW_PATH },
    ...EXHIBITS.flatMap((entry) =>
      entry.path
        ? [{ value: entry.path, label: t(`experiments.exhibits.${entry.exhibit}.short`), href: entry.path }]
        : [],
    ),
  ];
  return (
    <div className="flex min-h-dvh w-full flex-col bg-page">
      <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-subtle px-3 pt-3 pb-2 md:px-6 print:hidden">
        <Link to="/" className="flex items-center gap-2 text-base font-semibold text-primary">
          <img src="/favicon.svg" alt="" className="size-6" />
          {t("app.name")}
        </Link>
        {phone ? (
          <Select
            aria-label={t("experiments.area")}
            size="sm"
            value={current ?? ""}
            onChange={(e) => navigate(e.target.value)}
            className="min-w-0 flex-1"
          >
            {current === null && <option value="">{t("experiments.overview.short")}</option>}
            {items.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label as string}
              </option>
            ))}
          </Select>
        ) : (
          <NavPills aria-label={t("experiments.area")} size="sm" items={items} current={current} />
        )}
        <div className="ml-auto flex items-center gap-1">
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
