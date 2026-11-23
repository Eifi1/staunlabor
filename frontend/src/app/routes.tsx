import { Suspense, lazy, type ComponentType, type LazyExoticComponent, type ReactNode } from "react";
import { Route, Routes } from "react-router";
import { useTranslation } from "react-i18next";
import { LoadingState, NotFoundPage } from "@eifi1/ui-kit";
import { accountRouteElements, RequireSession } from "@eifi1/ui-kit/accounts";
import { AccountFrame } from "@/features/account/account-frame";
import { SiteLayout } from "@/features/site/site-layout";
import { EXHIBIT_MODULES } from "@/features/experiments/exhibit-modules";
import { EXHIBITS, EXHIBITS_PATH } from "@/features/experiments/exhibits";
import { ExperimentsOverviewPage } from "@/features/experiments/overview-page";
import { LESSONS } from "@/features/course/lessons";
import { ACCOUNT_PATHS, SITE_PATHS, type AccountPage } from "@/shared/lib/site-paths";
import type { Lesson } from "@/shared/types";

type LazyPage = LazyExoticComponent<ComponentType>;

/** A module's named page as a component of its own chunk, fetched when its
 *  route is first shown (as `exhibitModule` does for the exhibits). */
function lazyNamed<K extends string, M extends Record<K, ComponentType>>(load: () => Promise<M>, name: K): LazyPage {
  return lazy(() => load().then((m) => ({ default: m[name] })));
}

/** The course's pages: lesson 0 (the recipe, the course's front page), the six
 *  lessons and the cheat sheet, at the paths `LESSONS` gives them. A record
 *  over the lessons, so a lesson without a page does not compile. */
const COURSE_PAGES: Record<Lesson, LazyPage> = {
  recipe: lazyNamed(() => import("@/features/course/overview-page"), "CourseOverviewPage"),
  first_order: lazyNamed(() => import("@/features/course/lesson-first-order"), "FirstOrderLesson"),
  second_order: lazyNamed(() => import("@/features/course/lesson-second-order"), "SecondOrderLesson"),
  eigenvalues: lazyNamed(() => import("@/features/course/lesson-eigenvalues"), "EigenvaluesLesson"),
  laplace: lazyNamed(() => import("@/features/course/lesson-laplace"), "LaplaceLesson"),
  numerics: lazyNamed(() => import("@/features/course/lesson-numerics"), "NumericsLesson"),
  two_mass: lazyNamed(() => import("@/features/course/lesson-two-mass"), "TwoMassLesson"),
  cheat_sheet: lazyNamed(() => import("@/features/course/cheat-sheet"), "CheatSheetPage"),
};

/** Every page open to every visitor but the front page, each its own chunk:
 *  the list of exhibits, each exhibit (`exhibit-modules.ts`), the course and
 *  the site's own pages. The front page is the overview, in the first wave. */
const OPEN_PAGES: readonly { path: string; Page: LazyPage }[] = [
  { path: EXHIBITS_PATH, Page: lazyNamed(() => import("@/features/experiments/exhibits-page"), "ExhibitsPage") },
  ...EXHIBITS.map(({ exhibit, path }) => ({ path, Page: EXHIBIT_MODULES[exhibit].Page })),
  ...LESSONS.map(({ lesson, path }) => ({ path, Page: COURSE_PAGES[lesson] })),
  { path: SITE_PATHS.about, Page: lazyNamed(() => import("@/features/site/about-page"), "AboutPage") },
  { path: SITE_PATHS.imprint, Page: lazyNamed(() => import("@/features/site/legal-pages"), "ImprintPage") },
  { path: SITE_PATHS.privacy, Page: lazyNamed(() => import("@/features/site/legal-pages"), "PrivacyPage") },
];

/** The account's pages, each behind the sign-in. A record over
 *  `ACCOUNT_PATHS`, the list the accounts client sends to the sign-in from, so
 *  a private page cannot be routed without being on it. The server refuses the
 *  admin's and the reviewer's to anyone it grants nothing; the pages say so
 *  themselves. */
const PRIVATE_PAGES: Record<AccountPage, LazyPage> = {
  settings: lazyNamed(() => import("@/features/account/settings-page"), "SettingsPage"),
  admin: lazyNamed(() => import("@/features/admin/admin-page"), "AdminPage"),
  feedback: lazyNamed(() => import("@/features/admin/feedback-pages"), "FeedbackInboxPage"),
  myFeedback: lazyNamed(() => import("@/features/admin/feedback-pages"), "MyFeedbackPage"),
  translations: lazyNamed(() => import("@/features/admin/translations-page"), "TranslationsPage"),
};

/** The account's signed-out pages (sign-in, sign-up by invitation, the reset, the links),
 *  the kit's, in the site's frame. No terms page: the site has none. */
const SIGNED_OUT_PAGES = accountRouteElements({ frame: AccountFrame, legal: { privacyHref: SITE_PATHS.privacy } });

function Page({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return <Suspense fallback={<LoadingState className="py-16" label={t("common.loading")} />}>{children}</Suspense>;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<ExperimentsOverviewPage />} />
        {OPEN_PAGES.map(({ path, Page: Shown }) => (
          <Route
            key={path}
            path={path.slice(1)}
            element={
              <Page>
                <Shown />
              </Page>
            }
          />
        ))}
        {SIGNED_OUT_PAGES}
        {(Object.keys(PRIVATE_PAGES) as AccountPage[]).map((page) => {
          const Shown = PRIVATE_PAGES[page];
          return (
            <Route
              key={page}
              path={ACCOUNT_PATHS[page].slice(1)}
              element={
                <RequireSession>
                  <Page>
                    <Shown />
                  </Page>
                </RequireSession>
              }
            />
          );
        })}
        <Route path="*" element={<NotFoundPage homeHref="/" />} />
      </Route>
    </Routes>
  );
}
