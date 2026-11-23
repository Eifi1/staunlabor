import { useDebounce } from "@eifi1/ui-kit";
import { keepPreviousData, useQuery, type QueryKey } from "@tanstack/react-query";

/** How long a slider holds still before a page asks again, until the server
 *  has said: the same 0.15 s it serves (the backend's one `PAGE_SETTLE_S`, in
 *  both the exhibits' and the course's defaults). */
const FALLBACK_SETTLE_S = 0.15;

/**
 * The engine's answer to a page's numbers, once they have held still.
 *
 * Every number on the site comes from the engine; the browser holds the
 * inputs and draws. So a page is a request per pause rather than per slider
 * step, at the server's `settle_s`. The last answer stays on screen while the
 * next is in flight, so a reader drags a slider against the curve it is
 * changing. A `null` body asks for nothing. The exhibits' hooks
 * (`use-experiments.ts`) and the course's `useComputed` (`use-course.ts`) are
 * this over their own defaults and query keys.
 *
 * No `staleTime`: the app's client holds every answer for good
 * (`query-client.ts`), since an answer is a pure function of its key.
 */
export function useSettledQuery<Body, Answer>({
  settleS,
  queryKey,
  ask,
  body,
}: {
  /** The server's settle, in seconds; `undefined` until its defaults are in. */
  settleS: number | undefined;
  /** The key of the answer to a body. */
  queryKey: (body: Body | null) => QueryKey;
  ask: (body: Body) => Promise<Answer>;
  body: Body | null;
}) {
  const settled = useDebounce(body, (settleS ?? FALLBACK_SETTLE_S) * 1000, { key: JSON.stringify(body) });
  return useQuery({
    queryKey: queryKey(settled),
    queryFn: () => ask(settled as Body),
    enabled: settled !== null,
    placeholderData: keepPreviousData,
  });
}
