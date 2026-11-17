import type * as Exp from "@/shared/types/experiments";
import { api } from "./client";

/** A route that answers the same for everybody: fetched. */
function fetched<Answer>(route: string) {
  return () => api.get<Answer>(`/experiments/${route}`).then((r) => r.data);
}

/** An exhibit's route: its build posted, its figures answered. */
function posted<Build, Answer>(route: string) {
  return (body: Build) => api.post<Answer>(`/experiments/${route}`, body).then((r) => r.data);
}

/** The experiments: hands-on exhibits computed. Public, as the whole site is:
 *  an exhibit's build goes in, its figures and curves come out. The time
 *  simulations run in the browser (`features/experiments/simulate/`), so none
 *  of them has a route; the chair's boxes and the Chladni plate's modes are
 *  the same for everybody and are fetched once. */
export const experimentsApi = {
  defaults: fetched<Exp.ExperimentsDefaults>("defaults"),
  chair: fetched<Exp.ChairAnalysis>("chair"),
  chladni: fetched<Exp.ChladniModes>("chladni"),
  sphere: posted<Exp.SphereRequest, Exp.SphereFigures>("sphere"),
  coil: posted<Exp.CoilExhibitRequest, Exp.CoilAnalysis>("coil"),
  platform: posted<Exp.PlatformExhibitRequest, Exp.PlatformFigures>("platform"),
  race: posted<Exp.RaceRequest, Exp.RaceAnalysis>("race"),
  elephant: posted<Exp.ElephantRequest, Exp.ElephantFigures>("elephant"),
  smoke: posted<Exp.SmokeExhibitRequest, Exp.SmokeFigures>("smoke"),
  cannon: posted<Exp.BallStackRequest, Exp.CannonFigures>("cannon"),
  wave: posted<Exp.WaveRequest, Exp.WaveFigures>("wave"),
};

/** The query keys, one place, so a key and its invalidation cannot drift. */
export const queryKeys = {
  experimentsDefaults: ["experiments", "defaults"] as const,
  experimentsChair: ["experiments", "chair"] as const,
  experimentsChladni: ["experiments", "chladni"] as const,
  experiments: (exhibit: string, payload: unknown) => ["experiments", exhibit, payload] as const,
};
