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
const WavePage = lazy(() => import("@/features/experiments/wave-page").then((m) => ({ default: m.WavePage })));
const ConePage = lazy(() => import("@/features/experiments/cone-page").then((m) => ({ default: m.ConePage })));
const ParabolaPage = lazy(() =>
  import("@/features/experiments/parabola-page").then((m) => ({ default: m.ParabolaPage })),
);
const CoupledPage = lazy(() => import("@/features/experiments/coupled-page").then((m) => ({ default: m.CoupledPage })));
const PegPage = lazy(() => import("@/features/experiments/peg-page").then((m) => ({ default: m.PegPage })));
const MaxwellPage = lazy(() => import("@/features/experiments/maxwell-page").then((m) => ({ default: m.MaxwellPage })));
const ChaosPage = lazy(() => import("@/features/experiments/chaos-page").then((m) => ({ default: m.ChaosPage })));
const WaterwheelPage = lazy(() =>
  import("@/features/experiments/waterwheel-page").then((m) => ({ default: m.WaterwheelPage })),
);
const FoucaultPage = lazy(() =>
  import("@/features/experiments/foucault-page").then((m) => ({ default: m.FoucaultPage })),
);
const CoriolisPage = lazy(() =>
  import("@/features/experiments/coriolis-page").then((m) => ({ default: m.CoriolisPage })),
);
const CradlePage = lazy(() => import("@/features/experiments/cradle-page").then((m) => ({ default: m.CradlePage })));
const WellPage = lazy(() => import("@/features/experiments/well-page").then((m) => ({ default: m.WellPage })));
const ResonancePage = lazy(() =>
  import("@/features/experiments/resonance-page").then((m) => ({ default: m.ResonancePage })),
);
const HarmonographPage = lazy(() =>
  import("@/features/experiments/harmonograph-page").then((m) => ({ default: m.HarmonographPage })),
);
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
          path="wave"
          element={
            <Page>
              <WavePage />
            </Page>
          }
        />
        <Route
          path="harmonograph"
          element={
            <Page>
              <HarmonographPage />
            </Page>
          }
        />
        <Route
          path="cone"
          element={
            <Page>
              <ConePage />
            </Page>
          }
        />
        <Route
          path="parabola"
          element={
            <Page>
              <ParabolaPage />
            </Page>
          }
        />
        <Route
          path="coupled"
          element={
            <Page>
              <CoupledPage />
            </Page>
          }
        />
        <Route
          path="peg"
          element={
            <Page>
              <PegPage />
            </Page>
          }
        />
        <Route
          path="maxwell"
          element={
            <Page>
              <MaxwellPage />
            </Page>
          }
        />
        <Route
          path="chaos"
          element={
            <Page>
              <ChaosPage />
            </Page>
          }
        />
        <Route
          path="waterwheel"
          element={
            <Page>
              <WaterwheelPage />
            </Page>
          }
        />
        <Route
          path="foucault"
          element={
            <Page>
              <FoucaultPage />
            </Page>
          }
        />
        <Route
          path="coriolis"
          element={
            <Page>
              <CoriolisPage />
            </Page>
          }
        />
        <Route
          path="cradle"
          element={
            <Page>
              <CradlePage />
            </Page>
          }
        />
        <Route
          path="well"
          element={
            <Page>
              <WellPage />
            </Page>
          }
        />
        <Route
          path="resonance"
          element={
            <Page>
              <ResonancePage />
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
