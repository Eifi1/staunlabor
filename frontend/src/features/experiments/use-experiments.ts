import { useQuery } from "@tanstack/react-query";
import { experimentsApi, queryKeys } from "@/shared/api/endpoints";
import { useSettledQuery } from "@/shared/api/settled-query";
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
  });
}

/** The three boxes of the chair: the same for everybody, so asked for once. */
export function useChair() {
  return useQuery({
    queryKey: queryKeys.experimentsChair,
    queryFn: experimentsApi.chair,
  });
}

/** The Chladni plate's driven modes: the same for every plate, so asked for
 *  once. */
export function useChladniModes() {
  return useQuery({
    queryKey: queryKeys.experimentsChladni,
    queryFn: experimentsApi.chladni,
  });
}

/** An exhibit's answer to its build, once the build's sliders have held still
 *  for the page's settle (`useSettledQuery`). Every routed exhibit's hook below
 *  is this with its name and its route. */
function useExhibitQuery<Build, Answer>(exhibit: string, ask: (build: Build) => Promise<Answer>, build: Build | null) {
  const defaults = useExperimentsDefaults();
  return useSettledQuery({
    settleS: defaults.data?.settle_s,
    queryKey: (settled) => queryKeys.experiments(exhibit, settled),
    ask,
    body: build,
  });
}

/** A coil build's figures and curves, once its sliders have held still. */
export function useCoilAnalysis(build: CoilExhibitRequest | null) {
  return useExhibitQuery("coil", experimentsApi.coil, build);
}

/** A sphere's orbits and swing, once its sliders have held still. */
export function useSphereFigures(build: SphereRequest | null) {
  return useExhibitQuery("sphere", experimentsApi.sphere, build);
}

/** A platform's spins and curves, once its sliders have held still. */
export function usePlatformFigures(build: PlatformExhibitRequest | null) {
  return useExhibitQuery("platform", experimentsApi.platform, build);
}

/** A race's six tracks and its valley, once its sliders have held still. */
export function useRace(build: RaceRequest | null) {
  return useExhibitQuery("race", experimentsApi.race, build);
}

/** An elephant build's float height, curves and tilt limit, once its sliders
 *  have held still. */
export function useElephantFigures(build: ElephantRequest | null) {
  return useExhibitQuery("elephant", experimentsApi.elephant, build);
}

/** A drum's window, its curve of presses and its best ring, once its sliders
 *  have held still. */
export function useSmokeFigures(build: SmokeExhibitRequest | null) {
  return useExhibitQuery("smoke", experimentsApi.smoke, build);
}

/** How high one, two and three balls of a stack send the top one, once its
 *  sliders have held still. */
export function useCannonFigures(build: BallStackRequest | null) {
  return useExhibitQuery("cannon", experimentsApi.cannon, build);
}

/** A pendulum wave's lengths and how far apart it comes back, once its sliders
 *  have held still. */
export function useWaveFigures(build: WaveRequest | null) {
  return useExhibitQuery("wave", experimentsApi.wave, build);
}
