import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { queryKeys } from "@/shared/api/endpoints";
import type { Exhibit } from "./exhibits";
import CHECKS from "./checks.json";

/**
 * The exhibits' checks as a page shows them: limiting cases worked out by hand
 * from a published source, beside what the page computes. The cases' runs take
 * seconds, so they are computed once into `checks.json`
 * (`scripts/write-checks.py`, held to the engine by `test_checks_file.py`); the
 * server answers only which exhibits an admin has checked, on the code now
 * deployed (`staunlabor/exhibit_checks.py`).
 */

export interface CheckSource {
  cite: string;
  url: string;
  /** As the source has it, untranslated. */
  quote: string;
}

export interface CheckCase {
  key: string;
  unit: string;
  expected: number;
  measured: number;
  /** Relative, or absolute where the expected value is zero. */
  deviation: number;
  tolerance: number;
  /** No source states the formula as used: the case's words give the step. */
  derived: boolean;
  setting: Record<string, number | string>;
  sources: CheckSource[];
}

// The file's types are inferred per case; the shape is the one written above.
const CASES = CHECKS as unknown as Record<string, CheckCase[] | undefined>;

export function checkCases(exhibit: Exhibit): CheckCase[] {
  return CASES[exhibit] ?? [];
}

export interface ChecksAnswer {
  with_cases: string[];
  checked: { exhibit: string; checked_on: string }[];
}

/** Which exhibits an admin has checked. A page that cannot reach the server
 *  says "not yet checked": the safe answer. */
export function useChecks() {
  return useQuery({
    queryKey: queryKeys.experimentsChecks,
    queryFn: async () => (await api.get<ChecksAnswer>("/experiments/checks")).data,
    staleTime: 60_000,
    retry: false,
  });
}

/** The day `exhibit` was checked, `YYYY-MM-DD`, or null. */
export function checkedOn(answer: ChecksAnswer | undefined, exhibit: Exhibit): string | null {
  return answer?.checked.find((c) => c.exhibit === exhibit)?.checked_on ?? null;
}

/** An admin's verdict, given or taken back; the list is what the server answers. */
export function useCheckVerdict(exhibit: Exhibit) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (checked: boolean) => {
      const path = `/admin/experiments/checks/${exhibit}`;
      const answer = checked ? await api.put<ChecksAnswer>(path) : await api.delete<ChecksAnswer>(path);
      return answer.data;
    },
    onSuccess: (answer) => client.setQueryData(queryKeys.experimentsChecks, answer),
  });
}
