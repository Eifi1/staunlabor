import type * as Course from "@/shared/types/course";
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

/** One widget of the course: its numbers posted, what the engine made of them
 *  answered. */
function computed<Body, Answer>(route: string) {
  return (body: Body) => api.post<Answer>(`/course/${route}`, body).then((r) => r.data);
}

/** The course on differential equations (lessons 0–6 and the cheat sheet,
 *  moved from Kurvenschmiede with the wire its `/dynamics` routes had). Public,
 *  as the whole site is: each widget has its own route because each answers in
 *  its own shape, and nothing in any of them is anybody's. */
export const courseApi = {
  defaults: () => api.get<Course.CourseDefaults>("/course/defaults").then((r) => r.data),
  tank: computed<Course.TankRequest, Course.TankRun>("tank"),
  firstOrder: computed<Course.FirstOrderRequest, Course.FirstOrderLesson>("first-order"),
  measurement: computed<Course.SeedRequest, Course.Measurement>("first-order/measurement"),
  secondOrder: computed<Course.SecondOrderRequest, Course.SecondOrderLesson>("second-order"),
  decay: computed<Course.SeedRequest, Course.DecayTest>("second-order/decay"),
  scalar: computed<Course.ScalarRequest, Course.ScalarGrowth>("eigen/scalar"),
  poles: computed<Course.PolesRequest, Course.PolePair>("eigen/poles"),
  matrix: computed<Course.MatrixRequest, Course.MatrixPortrait>("eigen/matrix"),
  laplace: computed<Course.LaplaceRequest, Course.LaplaceSteps>("laplace"),
  chain: computed<Course.BlockChainRequest, Course.ChainResponse>("laplace/chain"),
  filterLoop: computed<Course.FilterRequest, Course.FilterLoop>("laplace/filter-loop"),
  sensor: computed<Course.SensorRunRequest, Course.SensorMethods>("numerics/sensor"),
  oscillator: computed<Course.StepRequest, Course.OscillatorMethods>("numerics/oscillator"),
  stiff: computed<Course.StepRequest, Course.StiffPair>("numerics/stiff"),
  twoMass: computed<Course.TwoMassRunRequest, Course.TwoMass>("two-mass"),
  compensation: computed<Course.CompensationRunRequest, Course.Compensation>("two-mass/compensation"),
};

/** The query keys, one place, so a key and its invalidation cannot drift. */
export const queryKeys = {
  experimentsDefaults: ["experiments", "defaults"] as const,
  experimentsChair: ["experiments", "chair"] as const,
  experimentsChladni: ["experiments", "chladni"] as const,
  experimentsChecks: ["experiments", "checks"] as const,
  experiments: (exhibit: string, payload: unknown) => ["experiments", exhibit, payload] as const,
  courseDefaults: ["course", "defaults"] as const,
  /** One widget of the course and the numbers it was asked with. */
  course: (widget: string, payload: unknown) => ["course", widget, payload] as const,
};
