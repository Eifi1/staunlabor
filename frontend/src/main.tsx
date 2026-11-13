import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { applyPersistedTheme, ErrorBoundary, Toaster, UiKitProvider } from "@eifi1/ui-kit";
import { initI18n } from "@/shared/i18n/index";
import { kitLabels } from "@/shared/i18n/kit-labels";
import { useLanguage, useLocale } from "@/shared/i18n/use-locale";
import { STORAGE } from "@/shared/lib/storage-keys";
import { queryClient } from "@/shared/state/query-client";
import { useApplyTheme, useTheme } from "@/shared/state/theme-store";
import { AppRoutes } from "@/app/routes";
import { routerLink } from "@/app/router-link";
import "./app.css";

// Before the first paint, so a dark-mode reader never sees a white flash.
applyPersistedTheme(STORAGE.theme);

function Root() {
  useApplyTheme();
  const mode = useTheme((s) => s.mode);
  const language = useLanguage();
  const locale = useLocale();
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <UiKitProvider
          labels={kitLabels(language)}
          locale={locale}
          linkComponent={routerLink}
          tableStorageKeyPrefix={STORAGE.tables}
          appName="Staunlabor"
        >
          <ErrorBoundary placement="app" appVersion={__APP_VERSION__}>
            <AppRoutes />
          </ErrorBoundary>
        </UiKitProvider>
        <Toaster theme={mode} closeButton />
      </QueryClientProvider>
    </BrowserRouter>
  );
}

void initI18n().then(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <Root />
    </React.StrictMode>,
  );
});
