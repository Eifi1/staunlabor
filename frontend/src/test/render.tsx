import type { ReactElement, ReactNode } from "react";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { createInstance } from "i18next";
import { MemoryRouter } from "react-router";
import { ConfirmProvider, UiKitProvider } from "@eifi1/ui-kit";
import en from "@/shared/i18n/locales/en.json";
import { routerLink } from "@/app/router-link";
import { STORAGE } from "@/shared/lib/storage-keys";

/** A test i18n instance carrying the REAL English bundle.
 *
 * The real strings rather than a key-echoing stub, so an assertion reads the way
 * the screen does — and so a key that is missing from the bundle fails here
 * instead of shipping as raw dotted text. */
function testI18n() {
  const instance = createInstance();
  void instance.use(initReactI18next).init({
    lng: "en",
    fallbackLng: "en",
    resources: { en: { translation: en } },
    interpolation: { escapeValue: false },
  });
  return instance;
}

export function renderWithProviders(
  ui: ReactElement,
  /** The router's starting URL — for a page that reads a route param or a search
   *  param. Defaults to "/", which is what every other test wants. */
  { initialEntries = ["/"] }: { initialEntries?: string[] } = {},
) {
  // retry: false — a failing request in a test should surface as the error state
  // immediately, not after the production retry has run the clock out.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <I18nextProvider i18n={testI18n()}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={initialEntries}>
            {/* As in main.tsx, inside the router: a kit link is a router link
                here too, so following one moves this router rather than asking
                jsdom for another document; and a table keeps its view under
                this app's prefix, as it does in the app. Only those two — the
                kit's own English and the runtime's locale are what a test
                without the provider was already reading, and what its
                expectations say. */}
            <UiKitProvider linkComponent={routerLink} tableStorageKeyPrefix={STORAGE.tables}>
              {/* As in main.tsx: `useConfirm()` throws without it. */}
              <ConfirmProvider>{children}</ConfirmProvider>
            </UiKitProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </I18nextProvider>
    );
  }
  return render(ui, { wrapper: Wrapper });
}
