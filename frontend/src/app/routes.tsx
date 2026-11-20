import { Suspense, lazy, type ReactNode } from "react";
import { Route, Routes } from "react-router";
import { useTranslation } from "react-i18next";
import { LoadingState, NotFoundPage } from "@eifi1/ui-kit";
import { accountRouteElements, RequireSession } from "@eifi1/ui-kit/accounts";
import { AccountFrame } from "@/features/account/account-frame";
import { ExperimentsLayout } from "@/features/experiments/experiments-layout";
import { EXHIBIT_MODULES } from "@/features/experiments/exhibit-modules";
import { EXHIBITS } from "@/features/experiments/exhibits";
import { ExperimentsOverviewPage } from "@/features/experiments/overview-page";

/** The site's own pages and the account's, each its own chunk too. The front
 *  page is the overview, in the first wave. */
const ExhibitsPage = lazy(() =>
  import("@/features/experiments/exhibits-page").then((m) => ({ default: m.ExhibitsPage })),
);
const AboutPage = lazy(() => import("@/features/site/about-page").then((m) => ({ default: m.AboutPage })));
const ImprintPage = lazy(() => import("@/features/site/legal-pages").then((m) => ({ default: m.ImprintPage })));
const PrivacyPage = lazy(() => import("@/features/site/legal-pages").then((m) => ({ default: m.PrivacyPage })));
const SettingsPage = lazy(() => import("@/features/account/settings-page").then((m) => ({ default: m.SettingsPage })));
const AdminPage = lazy(() => import("@/features/admin/admin-page").then((m) => ({ default: m.AdminPage })));
const FeedbackInboxPage = lazy(() =>
  import("@/features/admin/feedback-pages").then((m) => ({ default: m.FeedbackInboxPage })),
);
const MyFeedbackPage = lazy(() =>
  import("@/features/admin/feedback-pages").then((m) => ({ default: m.MyFeedbackPage })),
);
const TranslationsPage = lazy(() =>
  import("@/features/admin/translations-page").then((m) => ({ default: m.TranslationsPage })),
);

/** The account's signed-out pages (sign-in, sign-up by invitation, the reset, the links),
 *  the kit's, in the site's frame. No terms page: the site has none. */
const ACCOUNT_PAGES = accountRouteElements({ frame: AccountFrame, legal: { privacyHref: "/privacy" } });

function Page({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return <Suspense fallback={<LoadingState className="py-16" label={t("common.loading")} />}>{children}</Suspense>;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<ExperimentsLayout />}>
        <Route index element={<ExperimentsOverviewPage />} />
        {/* Each exhibit at its path, its page its own chunk (`exhibit-modules.ts`). */}
        {EXHIBITS.flatMap(({ exhibit, path }) => {
          if (!path) return [];
          const ExhibitPage = EXHIBIT_MODULES[exhibit].Page;
          return [
            <Route
              key={exhibit}
              path={path.slice(1)}
              element={
                <Page>
                  <ExhibitPage />
                </Page>
              }
            />,
          ];
        })}
        <Route
          path="exhibits"
          element={
            <Page>
              <ExhibitsPage />
            </Page>
          }
        />
        <Route
          path="about"
          element={
            <Page>
              <AboutPage />
            </Page>
          }
        />
        <Route
          path="impressum"
          element={
            <Page>
              <ImprintPage />
            </Page>
          }
        />
        <Route
          path="privacy"
          element={
            <Page>
              <PrivacyPage />
            </Page>
          }
        />
        {ACCOUNT_PAGES}
        <Route
          path="settings"
          element={
            <RequireSession signInPath="/login">
              <Page>
                <SettingsPage />
              </Page>
            </RequireSession>
          }
        />
        {/* The server refuses both to anyone it grants nothing; the pages say so themselves. */}
        <Route
          path="admin"
          element={
            <RequireSession signInPath="/login">
              <Page>
                <AdminPage />
              </Page>
            </RequireSession>
          }
        />
        <Route
          path="feedback"
          element={
            <RequireSession signInPath="/login">
              <Page>
                <FeedbackInboxPage />
              </Page>
            </RequireSession>
          }
        />
        <Route
          path="my-feedback"
          element={
            <RequireSession signInPath="/login">
              <Page>
                <MyFeedbackPage />
              </Page>
            </RequireSession>
          }
        />
        <Route
          path="translations"
          element={
            <RequireSession signInPath="/login">
              <Page>
                <TranslationsPage />
              </Page>
            </RequireSession>
          }
        />
        <Route path="*" element={<NotFoundPage homeHref="/" />} />
      </Route>
    </Routes>
  );
}
