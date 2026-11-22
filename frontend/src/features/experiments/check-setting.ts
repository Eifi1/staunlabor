import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { create } from "zustand";

/**
 * "Set it up": a check case's button sets the exhibit above it to the case
 * (Marcel, 2026-11-19: the cases should be tried, not only read, so the
 * sliders reach every case). The case's setting is in the page's own inputs
 * (`checks.json`, written from `backend/staunlabor/domain/checks/`): the build's
 * fields and how the twin starts.
 *
 * The section and the twin are far apart in the tree, and a twin is built
 * again when its build changes, so the request waits here until a part of the
 * page takes it: the page, which sets the build, and the twin, which starts
 * itself once the build is the case's. Each answers whether it took the
 * request; once one did, no one else applies it again.
 */

export type CheckSetting = Record<string, number | string>;

interface CheckRequest {
  exhibit: string;
  setting: CheckSetting;
  nonce: number;
  /** Whether the twin has set itself to it. */
  done: boolean;
}

const useRequests = create<{ request: CheckRequest | null }>(() => ({ request: null }));
let asked = 0;

/** A case's button: set the exhibit to `setting`, and go up to it. */
export function askCheckSetting(exhibit: string, setting: CheckSetting): void {
  asked += 1;
  useRequests.setState({ request: { exhibit, setting, nonce: asked, done: false } });
  document.getElementById("try-it")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
}

/**
 * Take the latest request for `exhibit`: when this part mounts (a twin built
 * anew for the case's build) and whenever one arrives. `apply` answers true
 * once it has set the twin; the page, which only sets the build, answers
 * false and leaves the rest to the twin it builds.
 */
export function useCheckSetting(exhibit: string, apply: (setting: CheckSetting) => boolean): void {
  // The latest `apply`, which sees this render's build: kept in a ref after
  // each commit (an effect event read a stale one from a subscription).
  const latest = useRef(apply);
  useLayoutEffect(() => {
    latest.current = apply;
  });
  useEffect(() => {
    const take = (request: CheckRequest | null) => {
      if (!request || request.done || request.exhibit !== exhibit) return;
      if (latest.current(request.setting)) request.done = true;
    };
    take(useRequests.getState().request);
    return useRequests.subscribe((state) => take(state.request));
  }, [exhibit]);
}

/** The latest request for `exhibit`, for `useTakeCheckRequest`. */
function useCheckRequest(exhibit: string): Readonly<CheckRequest> | null {
  return useRequests((state) => (state.request?.exhibit === exhibit ? state.request : null));
}

/**
 * The page's side of a request: `take(setting, build)` once per request for
 * `exhibit`, while the page renders, as soon as the page has its `build` (the
 * defaults come from the server). The hook remembers the request it last took,
 * so a re-render does not take it again; setting the build from `take` is
 * React's "adjusting state when a prop changes", allowed in a render, and a
 * custom hook's caller's setters may be called from it. What `take` does with
 * the case is the page's: most apply it to the build as the reader left it and
 * set it only when it differs (`sameBuild`), so a case the build already is
 * does not build the twin anew.
 */
export function useTakeCheckRequest<T>(
  exhibit: string,
  build: T | null | undefined,
  take: (setting: CheckSetting, build: T) => void,
): void {
  const request = useCheckRequest(exhibit);
  const [seen, setSeen] = useState<number | null>(null);
  if (request && !request.done && request.nonce !== seen && build != null) {
    setSeen(request.nonce);
    take(request.setting, build);
  }
}

/** Whether two builds are the same build: the same fields with the same
 *  values, in the same order, which builds spread from one another have. */
export function sameBuild(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** A setting's number, or `fallback` when the case leaves it as it is. */
export function settingNumber(setting: CheckSetting, key: string, fallback: number): number {
  const value = setting[key];
  return typeof value === "number" ? value : fallback;
}
