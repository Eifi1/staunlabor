import type * as Exp from "@/shared/types/experiments";
import { api } from "./client";

/** The experiments: hands-on exhibits computed. Public, as the whole site is:
 *  an exhibit's build goes in, its figures and curves come out. The time
 *  simulations run in the browser (`features/experiments/simulate/`), so none
 *  of them has a route. */
export const experimentsApi = {
  defaults: () => api.get<Exp.ExperimentsDefaults>("/experiments/defaults").then((r) => r.data),
  sphere: (body: Exp.SphereRequest) => api.post<Exp.SphereFigures>("/experiments/sphere", body).then((r) => r.data),
  coil: (body: Exp.CoilExhibitRequest) => api.post<Exp.CoilAnalysis>("/experiments/coil", body).then((r) => r.data),
  chair: () => api.get<Exp.ChairAnalysis>("/experiments/chair").then((r) => r.data),
  platform: (body: Exp.PlatformExhibitRequest) =>
    api.post<Exp.PlatformFigures>("/experiments/platform", body).then((r) => r.data),
  race: (body: Exp.RaceRequest) => api.post<Exp.RaceAnalysis>("/experiments/race", body).then((r) => r.data),
  elephant: (body: Exp.ElephantRequest) =>
    api.post<Exp.ElephantFigures>("/experiments/elephant", body).then((r) => r.data),
  smoke: (body: Exp.SmokeExhibitRequest) => api.post<Exp.SmokeFigures>("/experiments/smoke", body).then((r) => r.data),
  cannon: (body: Exp.BallStackRequest) => api.post<Exp.CannonFigures>("/experiments/cannon", body).then((r) => r.data),
};

/** The query keys, one place, so a key and its invalidation cannot drift. */
export const queryKeys = {
  experimentsDefaults: ["experiments", "defaults"] as const,
  experimentsChair: ["experiments", "chair"] as const,
  experiments: (exhibit: string, payload: unknown) => ["experiments", exhibit, payload] as const,
};
