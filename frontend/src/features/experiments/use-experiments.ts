import { useDebounce } from "@eifi1/ui-kit";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { experimentsApi, queryKeys } from "@/shared/api/endpoints";
import type {
  CoilExhibitRequest,
  ElephantRequest,
  PlatformExhibitRequest,
  RaceRequest,
  SmokeExhibitRequest,
  BallStackRequest,
  SphereRequest,
  WaveRequest,
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

/** The Chladni plate's driven modes: the same for every plate, so asked for
 *  once. */
export function useChladniModes() {
  return useQuery({
    queryKey: queryKeys.experimentsChladni,
    queryFn: experimentsApi.chladni,
    staleTime: Infinity,
  });
}

/** How long a slider holds still before a page asks again, until the server
 *  has said: the same 0.15 s it serves. */
const FALLBACK_SETTLE_S = 0.15;

/** An exhibit's answer to its build, once the build's sliders have held still
 *  for the page's settle; the last answer stays on screen while the next is in
 *  flight. `null` asks for nothing. Every routed exhibit's hook below is this
 *  with its name and its route. */
function useSettledQuery<Build, Answer>(exhibit: string, ask: (build: Build) => Promise<Answer>, build: Build | null) {
  const defaults = useExperimentsDefaults();
  const settleS = defaults.data?.settle_s ?? FALLBACK_SETTLE_S;
  const settled = useDebounce(build, settleS * 1000, { key: JSON.stringify(build) });
  return useQuery({
    queryKey: queryKeys.experiments(exhibit, settled),
    queryFn: () => ask(settled as Build),
    enabled: settled !== null,
    placeholderData: keepPreviousData,
    staleTime: Infinity,
  });
}

/** A coil build's figures and curves, once its sliders have held still. */
export function useCoilAnalysis(build: CoilExhibitRequest | null) {
  return useSettledQuery("coil", experimentsApi.coil, build);
}

/** A sphere's orbits and swing, once its sliders have held still. */
export function useSphereFigures(build: SphereRequest | null) {
  return useSettledQuery("sphere", experimentsApi.sphere, build);
}

/** A platform's spins and curves, once its sliders have held still. */
export function usePlatformFigures(build: PlatformExhibitRequest | null) {
  return useSettledQuery("platform", experimentsApi.platform, build);
}

/** A race's six tracks and its valley, once its sliders have held still. */
export function useRace(build: RaceRequest | null) {
  return useSettledQuery("race", experimentsApi.race, build);
}

/** An elephant build's float height, curves and tilt limit, once its sliders
 *  have held still. */
export function useElephantFigures(build: ElephantRequest | null) {
  return useSettledQuery("elephant", experimentsApi.elephant, build);
}

/** A drum's window, its curve of presses and its best ring, once its sliders
 *  have held still. */
export function useSmokeFigures(build: SmokeExhibitRequest | null) {
  return useSettledQuery("smoke", experimentsApi.smoke, build);
}

/** How high one, two and three balls of a stack send the top one, once its
 *  sliders have held still. */
export function useCannonFigures(build: BallStackRequest | null) {
  return useSettledQuery("cannon", experimentsApi.cannon, build);
}

/** A pendulum wave's lengths and how far apart it comes back, once its sliders
 *  have held still. */
export function useWaveFigures(build: WaveRequest | null) {
  return useSettledQuery("wave", experimentsApi.wave, build);
}
