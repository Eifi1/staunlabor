import { useDebounce } from "@eifi1/ui-kit";
import { useQuery } from "@tanstack/react-query";
import { experimentsApi, queryKeys } from "@/shared/api/endpoints";
import type {
  CoilExhibitRequest,
  ElephantRequest,
  PlatformExhibitRequest,
  RaceRequest,
  SmokeExhibitRequest,
  BallStackRequest,
  SphereRequest,
} from "@/shared/types";

/** Each exhibit's default build and the page's settle: asked for once per
 *  visit, because nothing in them changes while the page is open. */
export function useExperimentsDefaults() {
  return useQuery({
    queryKey: queryKeys.experimentsDefaults,
    queryFn: experimentsApi.defaults,
    staleTime: Infinity,
  });
}

/** The three boxes of the chair: the same for everybody, so asked for once. */
export function useChair() {
  return useQuery({
    queryKey: queryKeys.experimentsChair,
    queryFn: experimentsApi.chair,
    staleTime: Infinity,
  });
}

/** How long a slider holds still before a page asks again, until the server
 *  has said: the same 0.15 s it serves. */
const FALLBACK_SETTLE_S = 0.15;

/** A coil build's figures and curves, once its sliders have held still; the
 *  last answer stays on screen while the next is in flight. `null` asks for
 *  nothing. */
export function useCoilAnalysis(build: CoilExhibitRequest | null) {
  const defaults = useExperimentsDefaults();
  const settleS = defaults.data?.settle_s ?? FALLBACK_SETTLE_S;
  const settled = useDebounce(build, settleS * 1000, { key: JSON.stringify(build) });
  return useQuery({
    queryKey: queryKeys.experiments("coil", settled),
    queryFn: () => experimentsApi.coil(settled as CoilExhibitRequest),
    enabled: settled !== null,
    placeholderData: (previous) => previous,
    staleTime: Infinity,
  });
}

/** A sphere's orbits and swing, once its sliders have held still. */
export function useSphereFigures(build: SphereRequest | null) {
  const defaults = useExperimentsDefaults();
  const settleS = defaults.data?.settle_s ?? FALLBACK_SETTLE_S;
  const settled = useDebounce(build, settleS * 1000, { key: JSON.stringify(build) });
  return useQuery({
    queryKey: queryKeys.experiments("sphere", settled),
    queryFn: () => experimentsApi.sphere(settled as SphereRequest),
    enabled: settled !== null,
    placeholderData: (previous) => previous,
    staleTime: Infinity,
  });
}

/** A platform's spins and curves, once its sliders have held still. */
export function usePlatformFigures(build: PlatformExhibitRequest | null) {
  const defaults = useExperimentsDefaults();
  const settleS = defaults.data?.settle_s ?? FALLBACK_SETTLE_S;
  const settled = useDebounce(build, settleS * 1000, { key: JSON.stringify(build) });
  return useQuery({
    queryKey: queryKeys.experiments("platform", settled),
    queryFn: () => experimentsApi.platform(settled as PlatformExhibitRequest),
    enabled: settled !== null,
    placeholderData: (previous) => previous,
    staleTime: Infinity,
  });
}

/** A race's six tracks and its valley, once its sliders have held still. */
export function useRace(build: RaceRequest | null) {
  const defaults = useExperimentsDefaults();
  const settleS = defaults.data?.settle_s ?? FALLBACK_SETTLE_S;
  const settled = useDebounce(build, settleS * 1000, { key: JSON.stringify(build) });
  return useQuery({
    queryKey: queryKeys.experiments("race", settled),
    queryFn: () => experimentsApi.race(settled as RaceRequest),
    enabled: settled !== null,
    placeholderData: (previous) => previous,
    staleTime: Infinity,
  });
}

/** An elephant build's float height, curves and tilt limit, once its sliders
 *  have held still. */
export function useElephantFigures(build: ElephantRequest | null) {
  const defaults = useExperimentsDefaults();
  const settleS = defaults.data?.settle_s ?? FALLBACK_SETTLE_S;
  const settled = useDebounce(build, settleS * 1000, { key: JSON.stringify(build) });
  return useQuery({
    queryKey: queryKeys.experiments("elephant", settled),
    queryFn: () => experimentsApi.elephant(settled as ElephantRequest),
    enabled: settled !== null,
    placeholderData: (previous) => previous,
    staleTime: Infinity,
  });
}

/** A drum's window, its curve of presses and its best ring, once its sliders
 *  have held still. */
export function useSmokeFigures(build: SmokeExhibitRequest | null) {
  const defaults = useExperimentsDefaults();
  const settleS = defaults.data?.settle_s ?? FALLBACK_SETTLE_S;
  const settled = useDebounce(build, settleS * 1000, { key: JSON.stringify(build) });
  return useQuery({
    queryKey: queryKeys.experiments("smoke", settled),
    queryFn: () => experimentsApi.smoke(settled as SmokeExhibitRequest),
    enabled: settled !== null,
    placeholderData: (previous) => previous,
    staleTime: Infinity,
  });
}

/** How high one, two and three balls of a stack send the top one, once its
 *  sliders have held still. */
export function useCannonFigures(build: BallStackRequest | null) {
  const defaults = useExperimentsDefaults();
  const settleS = defaults.data?.settle_s ?? FALLBACK_SETTLE_S;
  const settled = useDebounce(build, settleS * 1000, { key: JSON.stringify(build) });
  return useQuery({
    queryKey: queryKeys.experiments("cannon", settled),
    queryFn: () => experimentsApi.cannon(settled as BallStackRequest),
    enabled: settled !== null,
    placeholderData: (previous) => previous,
    staleTime: Infinity,
  });
}
