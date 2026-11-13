import { Suspense, lazy, type ReactNode } from "react";
import { Route, Routes } from "react-router";
import { useTranslation } from "react-i18next";
import { LoadingState, NotFoundPage } from "@eifi1/ui-kit";
import { ExperimentsLayout } from "@/features/experiments/experiments-layout";
import { ExperimentsOverviewPage } from "@/features/experiments/overview-page";

/** Each exhibit's page is its own chunk: its simulation, its drawings and its
 *  formulas load when it is opened, or when the overview's preview needs it
 *  (the same module, so one fetch). The front page is the overview, in the
 *  first wave. */
const ChairPage = lazy(() => import("@/features/experiments/chair-page").then((m) => ({ default: m.ChairPage })));
const CoilPage = lazy(() => import("@/features/experiments/coil-page").then((m) => ({ default: m.CoilPage })));
const SpherePage = lazy(() => import("@/features/experiments/sphere-page").then((m) => ({ default: m.SpherePage })));
const PlatformPage = lazy(() =>
  import("@/features/experiments/platform-page").then((m) => ({ default: m.PlatformPage })),
);
const RacePage = lazy(() => import("@/features/experiments/race-page").then((m) => ({ default: m.RacePage })));
const ElephantPage = lazy(() =>
  import("@/features/experiments/elephant-page").then((m) => ({ default: m.ElephantPage })),
);
const SmokePage = lazy(() => import("@/features/experiments/smoke-page").then((m) => ({ default: m.SmokePage })));
const CannonPage = lazy(() => import("@/features/experiments/cannon-page").then((m) => ({ default: m.CannonPage })));
const AboutPage = lazy(() => import("@/features/site/about-page").then((m) => ({ default: m.AboutPage })));
const ImprintPage = lazy(() => import("@/features/site/legal-pages").then((m) => ({ default: m.ImprintPage })));
const PrivacyPage = lazy(() => import("@/features/site/legal-pages").then((m) => ({ default: m.PrivacyPage })));

function Page({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return <Suspense fallback={<LoadingState className="py-16" label={t("common.loading")} />}>{children}</Suspense>;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<ExperimentsLayout />}>
        <Route index element={<ExperimentsOverviewPage />} />
        <Route
          path="chair"
          element={
            <Page>
              <ChairPage />
            </Page>
          }
        />
        <Route
          path="coil"
          element={
            <Page>
              <CoilPage />
            </Page>
          }
        />
        <Route
          path="sphere"
          element={
            <Page>
              <SpherePage />
            </Page>
          }
        />
        <Route
          path="platform"
          element={
            <Page>
              <PlatformPage />
            </Page>
          }
        />
        <Route
          path="race"
          element={
            <Page>
              <RacePage />
            </Page>
          }
        />
        <Route
          path="elephant"
          element={
            <Page>
              <ElephantPage />
            </Page>
          }
        />
        <Route
          path="smoke"
          element={
            <Page>
              <SmokePage />
            </Page>
          }
        />
        <Route
          path="cannon"
          element={
            <Page>
              <CannonPage />
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
        <Route path="*" element={<NotFoundPage homeHref="/" />} />
      </Route>
    </Routes>
  );
}
