import { createAccountsClient } from "@eifi1/ui-kit/accounts";
import { STORAGE } from "@/shared/lib/storage-keys";
import { api } from "./client";

/**
 * The account's session on the site's own client: the bearer, the refresh, the sign-out in
 * the kit's order (server-kit's account routes under `/api/v1`). Every path but the account's
 * own pages stays open to every visitor, the exhibits above all (plan, second stage: the open
 * site first), so a session that ends there leaves the reader where they are; on
 * `/settings`, `/admin`, `/feedback` or `/translations` it goes to the sign-in.
 */
export const accounts = createAccountsClient({
  http: api,
  storagePrefix: STORAGE.accounts,
  publicPaths: [/^\/(?!(?:settings|admin|feedback|translations)(?:\/|$))/],
  signInPath: "/login",
  homePath: "/",
});
