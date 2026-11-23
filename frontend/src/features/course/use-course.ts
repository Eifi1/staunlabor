import { useQuery } from "@tanstack/react-query";
import { courseApi, queryKeys } from "@/shared/api/endpoints";
import { useSettledQuery } from "@/shared/api/settled-query";

/** The two-mass rig's reference, the exercises and the settle: asked for once
 *  per visit, because nothing in them changes while the page is open. */
export function useCourseDefaults() {
  return useQuery({ queryKey: queryKeys.courseDefaults, queryFn: courseApi.defaults });
}

/**
 * What the engine makes of a widget's numbers, once they have held still
 * (`useSettledQuery`, at the course's settle). Every number on these pages
 * comes from the engine, as on an exhibit's page. A `null` body asks for
 * nothing.
 */
export function useComputed<Body, Answer>(widget: string, body: Body | null, compute: (body: Body) => Promise<Answer>) {
  const defaults = useCourseDefaults();
  return useSettledQuery({
    settleS: defaults.data?.settle_s,
    queryKey: (settled) => queryKeys.course(widget, settled),
    ask: compute,
    body,
  });
}
