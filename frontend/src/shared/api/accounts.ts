import { createAccountsClient } from "@eifi1/ui-kit/accounts";
import { PRIVATE_PATHS } from "@/shared/lib/site-paths";
import { STORAGE } from "@/shared/lib/storage-keys";
import { api } from "./client";

/**
 * The account's session on the site's own client: the bearer, the refresh, the sign-out in
 * the kit's order (server-kit's account routes under `/api/v1`). Every path but the account's
 * own pages (`PRIVATE_PATHS`) stays open to every visitor, so a session that ends there leaves
 * the reader where they are; on an account's page it goes to the kit's sign-in, `/login`.
 */
export const accounts = createAccountsClient({
  http: api,
  storagePrefix: STORAGE.accounts,
  privatePaths: PRIVATE_PATHS,
  homePath: "/",
});
