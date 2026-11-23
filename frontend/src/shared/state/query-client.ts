import { QueryClient } from "@tanstack/react-query";

/** What every query does unless it says otherwise; the tests' client
 *  (`test/render.tsx`) takes them too, so a hook behaves there as here. */
export const QUERY_DEFAULTS = {
  retry: 1,
  refetchOnWindowFocus: false,
  // An answer is a pure function of its query key (an exhibit's build, a
  // widget's numbers, the defaults of one deploy): a cached answer can only be
  // replaced, never stale. A query that can change says so (`checks.ts`).
  staleTime: Infinity,
};

export const queryClient = new QueryClient({ defaultOptions: { queries: QUERY_DEFAULTS } });
