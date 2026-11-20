import { useDebounce } from "@eifi1/ui-kit";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { courseApi, queryKeys } from "@/shared/api/endpoints";

/** The two-mass rig's reference, the exercises and the settle: asked for once
 *  per visit, because nothing in them changes while the page is open. */
export function useCourseDefaults() {
  return useQuery({
    queryKey: queryKeys.courseDefaults,
    queryFn: courseApi.defaults,
    staleTime: Infinity,
  });
}

/** How long a slider holds still before a widget asks again, until the server
 *  has said: the same 0.15 s it serves, as the exhibits have it. */
const FALLBACK_SETTLE_S = 0.15;

/**
 * What the engine makes of a widget's numbers, once they have held still.
 *
 * Every number on these pages comes from the engine, as on an exhibit's page;
 * the browser holds the inputs and draws. So a widget is a request per pause
 * rather than per slider step, at the server's `settle_s`. The last answer
 * stays on screen while the next is in flight, so a reader drags a slider
 * against the curve it is changing. A `null` body asks for nothing.
 *
 * The exhibits' `useSettledQuery` (`features/experiments/use-experiments.ts`)
 * is the same loop over their defaults; this one waits on the course's.
 */
export function useComputed<Body, Answer>(widget: string, body: Body | null, compute: (body: Body) => Promise<Answer>) {
  const defaults = useCourseDefaults();
  const settleS = defaults.data?.settle_s ?? FALLBACK_SETTLE_S;
  const settled = useDebounce(body, settleS * 1000, { key: JSON.stringify(body) });
  return useQuery({
    queryKey: queryKeys.course(widget, settled),
    queryFn: () => compute(settled as Body),
    enabled: settled !== null,
    placeholderData: keepPreviousData,
    staleTime: Infinity,
  });
}
