/**
 * The kit's providers as this site sets them up, one tree for every entry: the
 * app (`main.tsx`), the link-preview cards (`src/preview-card.tsx`) and the
 * tests (`test/render.tsx`). Each entry once built its own and they drifted:
 * the tests had a `ConfirmProvider` the app lacked, so the kit's feedback
 * thread, whose delete button asks `useConfirm()`, threw on a reader's own
 * comment in the app while every test passed.
 *
 * Inside the router, so a kit link is a router link (`routerLink`). The labels
 * and the locale are the caller's: the reader's language in the app, German on
 * a card; a test leaves them out and reads the kit's own English.
 */

import type { ReactNode } from "react";
import { ConfirmProvider, UiKitProvider, type UiKitProviderProps } from "@eifi1/ui-kit";
import { STORAGE } from "@/shared/lib/storage-keys";
import { routerLink } from "./router-link";

export function KitProviders({
  children,
  ...options
}: Omit<UiKitProviderProps, "children" | "linkComponent" | "tableStorageKeyPrefix"> & { children: ReactNode }) {
  return (
    <UiKitProvider linkComponent={routerLink} tableStorageKeyPrefix={STORAGE.tables} {...options}>
      {/* One confirm dialog for the site, answering `useConfirm()`. */}
      <ConfirmProvider>{children}</ConfirmProvider>
    </UiKitProvider>
  );
}
