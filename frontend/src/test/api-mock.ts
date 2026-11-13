import { vi } from "vitest";
import { api } from "@/shared/api/client";

/** A route that answers with headers as well as a body.
 *
 *  A marked class rather than a `{ data, headers }` shape, because a real
 *  payload is free to have keys called `data` and `headers` and a harness that
 *  guessed would misread it. */
export class MockResponse {
  constructor(
    readonly data: unknown,
    readonly headers: Record<string, string> = {},
  ) {}
}

/**
 * A route table for the axios instance the whole app shares.
 *
 * Stubbing `api.get/post/put/patch/delete` rather than the endpoint module, so a
 * test still exercises the real endpoint functions — the paths they build and
 * the shapes they unwrap. A page test that mocked `experimentsApi` would pass
 * happily with a typo in a URL.
 *
 * Keys are `"<METHOD> <path>"`, matched exactly first and then as a prefix that
 * ends where a path segment does — the longest such key wins — so a route mocked
 * at `/things/1` answers what is beneath it as well. The boundary is the
 * point: a bare `startsWith` would let `/things/1` answer `/things/12` with
 * id 1's body, which is a page under test showing the wrong answer and passing. A route whose value is an Error is rejected with
 * it — which is how a test says "this one endpoint fails" without stubbing the
 * others. Anything unmatched rejects loudly: a page quietly rendering an empty
 * state because a request it needed was never mocked is a test that proves
 * nothing.
 */
export function mockApi(routes: Record<string, unknown>) {
  const lookup = (method: string, url: string) => {
    const key = `${method} ${url}`;
    if (key in routes) return routes[key];
    // A query string is a boundary too, though every endpoint passes its query
    // as axios `params` today and none is in a URL a test sees.
    const prefix = Object.keys(routes)
      .filter((candidate) => key.startsWith(`${candidate}/`) || key.startsWith(`${candidate}?`))
      .sort((a, b) => b.length - a.length)[0];
    return prefix === undefined ? undefined : routes[prefix];
  };

  const handler = (method: string) => async (url: string) => {
    const body = lookup(method, url);
    if (body === undefined) throw new Error(`No mock for ${method} ${url}`);
    if (body instanceof Error) throw body;
    if (body instanceof MockResponse) return { data: body.data, headers: body.headers };
    // Headers are always present, even when empty: axios callers read them, and
    // an undefined `response.headers` throws somewhere far from the cause.
    return { data: body, headers: {} };
  };

  vi.spyOn(api, "get").mockImplementation(handler("GET") as typeof api.get);
  vi.spyOn(api, "post").mockImplementation(handler("POST") as typeof api.post);
  vi.spyOn(api, "put").mockImplementation(handler("PUT") as typeof api.put);
  vi.spyOn(api, "patch").mockImplementation(handler("PATCH") as typeof api.patch);
  vi.spyOn(api, "delete").mockImplementation(handler("DELETE") as typeof api.delete);
}
