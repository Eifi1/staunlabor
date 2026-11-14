import type { ReactElement } from "react";
import { vi } from "vitest";
import { AccountsProvider, createAccountsClient, type AccountsHttp } from "@eifi1/ui-kit/accounts";
import { renderWithProviders } from "./render";

/** A request as the account client sends it. */
interface Sent {
  method: string;
  url: string;
  params?: unknown;
  data?: unknown;
}

/**
 * A page on the kit's account layer, signed in as `user`: its own account client on a fake
 * `http` — the kit's parts call `http.request`, which `mockApi` does not stub — with the
 * session already in storage, inside the providers every page has. Routes are `"<method>
 * <path>"` → body; an unmatched one rejects loudly, as `mockApi`'s do. `GET /auth/me` answers
 * `user` unless a route says otherwise.
 */
export function renderSignedIn(
  ui: ReactElement,
  {
    user,
    routes = {},
    initialEntries,
  }: { user: Record<string, unknown>; routes?: Record<string, unknown>; initialEntries?: string[] },
) {
  localStorage.setItem("test.session", JSON.stringify({ token: "t1", refreshToken: "r1", user }));
  const sent: Sent[] = [];
  const answers: Record<string, unknown> = { "get /auth/me": user, ...routes };
  const http: AccountsHttp = {
    interceptors: {
      request: { use: () => 0, eject: () => undefined },
      response: { use: () => 0, eject: () => undefined },
    },
    defaults: { baseURL: "/api/v1" },
    request: async (config) => {
      const { method = "get", url = "", params, data } = config as Sent;
      sent.push({ method, url, params, data });
      const key = `${method} ${url}`;
      if (!(key in answers)) throw new Error(`No mock for ${key}`);
      return { data: answers[key] };
    },
  };
  const client = createAccountsClient({
    http,
    storagePrefix: "test.",
    privatePaths: ["/admin", "/feedback", "/my-feedback", "/translations"],
    fetch: vi.fn(async () => new Response(null, { status: 401 })),
    navigate: vi.fn(),
  });
  const utils = renderWithProviders(<AccountsProvider client={client}>{ui}</AccountsProvider>, { initialEntries });
  return { ...utils, sent, client };
}
