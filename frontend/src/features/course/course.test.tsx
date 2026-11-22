/**
 * The course against a mocked engine — whose answers are the real engine's
 * (`test-fixtures.json` is written from the engine through the wire models,
 * arrays thinned, by `scripts/write-course-fixtures.py`): every lesson renders
 * its question, its widgets and its insights; an exercise gates on an estimate
 * and checks an answer typed with a comma; the course's front page has a tile
 * per lesson here and nothing that leaves the site; and the small rules the
 * pages rest on hold.
 */
import type { ComponentType } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import en from "@/shared/i18n/locales/en.json";
import { api } from "@/shared/api/client";
import { STORAGE } from "@/shared/lib/storage-keys";
import { mockApi } from "@/test/api-mock";
import { renderWithProviders } from "@/test/render";
import type { Exercise } from "@/shared/types";
import { CheatSheetPage } from "./cheat-sheet";
import { parseEntry, withinTolerance } from "./exercise";
import { formatSig } from "@/shared/lib/format";
import { EigenvaluesLesson } from "./lesson-eigenvalues";
import { FirstOrderLesson } from "./lesson-first-order";
import { LaplaceLesson } from "./lesson-laplace";
import { NumericsLesson } from "./lesson-numerics";
import { SecondOrderLesson } from "./lesson-second-order";
import { TwoMassLesson } from "./lesson-two-mass";
import { BASICS_PATH, LESSONS, lessonEntry, neighbours } from "./lessons";
import { CourseOverviewPage } from "./overview-page";
import { SURPRISE_SHARE, useCourseProgress } from "./progress";
import { solutionTex } from "./solutions";
import fixtures from "./test-fixtures.json";

const C = en.course;

/** The engine's answers, at the routes the backend serves them on. */
const ROUTES = {
  "GET /course/defaults": fixtures.defaults,
  "POST /course/tank": fixtures.tank,
  "POST /course/first-order": fixtures.first_order,
  "POST /course/first-order/measurement": fixtures.measurement,
  "POST /course/second-order": fixtures.second_order,
  "POST /course/second-order/decay": fixtures.decay,
  "POST /course/eigen/scalar": fixtures.scalar,
  "POST /course/eigen/poles": fixtures.poles,
  "POST /course/eigen/matrix": fixtures.matrix,
  "POST /course/laplace": fixtures.laplace,
  "POST /course/laplace/chain": fixtures.chain,
  "POST /course/laplace/filter-loop": fixtures.filter_loop,
  "POST /course/numerics/sensor": fixtures.sensor,
  "POST /course/numerics/oscillator": fixtures.oscillator,
  "POST /course/numerics/stiff": fixtures.stiff,
  "POST /course/two-mass": fixtures.two_mass,
  "POST /course/two-mass/compensation": fixtures.compensation,
};

const posted = (path: string) =>
  (api.post as ReturnType<typeof vi.fn>).mock.calls.filter(([url]) => url === path).map(([, body]) => body);

beforeEach(() => {
  mockApi(ROUTES);
  localStorage.removeItem(STORAGE.courseProgress);
  useCourseProgress.getState().forget();
});
afterEach(() => vi.restoreAllMocks());

/** Each lesson, the question it opens on, and one thing only its widgets draw. */
const PAGES: [string, ComponentType, string, string][] = [
  ["first-order", FirstOrderLesson, C.first_order.question, C.first_order.measure.title],
  ["second-order", SecondOrderLesson, C.second_order.question, C.second_order.decay.title],
  ["eigenvalues", EigenvaluesLesson, C.eigenvalues.question, C.eigenvalues.matrix.kind.stable_focus],
  ["laplace", LaplaceLesson, C.laplace.question, C.laplace.filter.apparent],
  ["numerics", NumericsLesson, C.numerics.question, C.numerics.stiff.limit],
  ["two-mass", TwoMassLesson, C.two_mass.question, C.two_mass.compensation.noise_price],
];

describe("every lesson", () => {
  it.each(PAGES)(
    "%s opens on its question, draws its widgets and says what they showed",
    async (_slug, Page, question, widget) => {
      renderWithProviders(<Page />);
      expect(screen.getByText(question)).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: C.frame.insights })).toBeInTheDocument();
      expect((await screen.findAllByText(widget)).length).toBeGreaterThan(0);
    },
  );

  it("asks the engine for the second-order lesson by the shaft's parts", async () => {
    renderWithProviders(<SecondOrderLesson />);
    await waitFor(() => expect(posted("/course/second-order").length).toBeGreaterThan(0));
    expect(posted("/course/second-order")[0]).toMatchObject({
      inertia: 0.05,
      stiffness: 500,
      damping_coefficient: 0.5,
    });
  });

  it("notes the lesson as opened on this device", async () => {
    renderWithProviders(<FirstOrderLesson />);
    await waitFor(() => expect(useCourseProgress.getState().visited).toContain("first_order"));
    expect(JSON.parse(localStorage.getItem(STORAGE.courseProgress) ?? "{}").visited).toContain("first_order");
  });

  it("names itself to the browser by its title and the site's name", async () => {
    renderWithProviders(<LaplaceLesson />);
    await waitFor(() => expect(document.title).toBe(`${C.lessons.laplace.title} — ${en.app.name}`));
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toMatch(/\/basics\/laplace$/);
  });

  it("leads to the lessons either side of it, and nowhere else", async () => {
    renderWithProviders(<TwoMassLesson />);
    const nav = screen.getByRole("navigation", { name: C.frame.lesson_navigation });
    const links = within(nav)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));
    expect(links).toEqual([lessonEntry("numerics").path, lessonEntry("cheat_sheet").path]);
    expect((await screen.findAllByText(C.two_mass.compensation.noise_price)).length).toBeGreaterThan(0);
  });
});

describe("the course's front page", () => {
  it("has the recipe, the tank and a tile per lesson here, and no link off the site", async () => {
    renderWithProviders(<CourseOverviewPage />);
    expect(screen.getByText(C.recipe.steps.balance.title)).toBeInTheDocument();
    expect(await screen.findByText(C.recipe.tank.final)).toBeInTheDocument();
    const links = screen.getAllByRole("link").map((link) => link.getAttribute("href") ?? "");
    for (const entry of LESSONS.filter((e) => e.lesson !== "recipe")) expect(links).toContain(entry.path);
    expect(links.every((href) => href.startsWith(`${BASICS_PATH}/`))).toBe(true);
    expect(screen.getByText(C.overview.no_surprises)).toBeInTheDocument();
  });

  it("lists a surprise once an estimate was more than half off", async () => {
    useCourseProgress.getState().estimate("pt1_reading", 10, 71.88, "°C");
    renderWithProviders(<CourseOverviewPage />);
    expect(await screen.findByText(C.exercises.pt1_reading.title)).toBeInTheDocument();
  });
});

describe("an exercise", () => {
  it("asks for an estimate first, then checks an answer typed with a decimal comma", async () => {
    renderWithProviders(<FirstOrderLesson />);
    const card = (await screen.findByRole("heading", { name: C.exercises.pt1_reading.title })).closest(
      "div.space-y-3",
    ) as HTMLElement;
    const scope = within(card ?? document.body);
    expect(scope.queryByRole("button", { name: C.exercise.check })).not.toBeInTheDocument();
    fireEvent.change(scope.getByLabelText(/Your estimate/), { target: { value: "60" } });
    fireEvent.click(scope.getByRole("button", { name: C.exercise.estimate_submit }));
    const answer = await scope.findByLabelText(/Your answer/);
    fireEvent.click(scope.getByRole("button", { name: C.exercise.check }));
    expect(scope.getByText(C.exercise.empty)).toBeInTheDocument();
    fireEvent.change(answer, { target: { value: "60" } });
    fireEvent.click(scope.getByRole("button", { name: C.exercise.check }));
    expect(await scope.findByText(C.exercise.wrong)).toBeInTheDocument();
    fireEvent.change(answer, { target: { value: "71,88" } });
    fireEvent.click(scope.getByRole("button", { name: C.exercise.check }));
    expect(await scope.findByText(C.exercise.right)).toBeInTheDocument();
    const record = useCourseProgress.getState().exercises.pt1_reading;
    expect(record).toMatchObject({ solved: true, attempts: 2, estimate: 60 });
    // Sixty against 71.9 is a sixth off: noted, but not a surprise.
    expect(useCourseProgress.getState().surprises).toEqual([]);
  });

  it("shows its worked solution as a formula with the engine's numbers", async () => {
    renderWithProviders(<SecondOrderLesson />);
    const heading = await screen.findByRole("heading", { name: C.exercises.decrement.title });
    const card = within(heading.closest("div.space-y-3") as HTMLElement);
    fireEvent.click(card.getByRole("button", { name: C.exercise.show_solution }));
    expect(card.getByText(C.exercise.solution)).toBeInTheDocument();
    expect(card.getByText(/D = Λ\/√\(4π² \+ Λ²\) = 0\.05/)).toBeInTheDocument();
  });
});

describe("the cheat sheet", () => {
  it("prints only itself, and links each block to a lesson here", () => {
    renderWithProviders(<CheatSheetPage />);
    expect(document.querySelector("style")?.textContent).toContain("#cheat-sheet");
    expect(screen.getByRole("button", { name: C.cheat.print })).toBeInTheDocument();
    const sheet = document.getElementById("cheat-sheet") as HTMLElement;
    const blocks = within(sheet)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));
    const lessons = LESSONS.filter((e) => e.lesson !== "recipe" && e.lesson !== "cheat_sheet").map((e) => e.path);
    expect(blocks).toEqual(lessons);
  });
});

describe("the small rules", () => {
  it("reads an entry with a point, a comma, a thousands mark or a typographic minus, and nothing else", () => {
    expect(parseEntry("71.88")).toBe(71.88);
    expect(parseEntry("71,88")).toBe(71.88);
    expect(parseEntry("4'039")).toBe(4039);
    expect(parseEntry("−31")).toBe(-31);
    expect(parseEntry("2e-3")).toBe(0.002);
    expect(parseEntry("")).toBeNull();
    expect(parseEntry("abc")).toBeNull();
  });

  it("holds an entry to the answer's tolerance, absolute or relative", () => {
    expect(withinTolerance(71.9, { value: 71.88, unit: "°C", absolute: 0.2, relative: null })).toBe(true);
    expect(withinTolerance(72.2, { value: 71.88, unit: "°C", absolute: 0.2, relative: null })).toBe(false);
    expect(withinTolerance(6.4, { value: 6.28, unit: "Hz", absolute: null, relative: 0.02 })).toBe(true);
    expect(withinTolerance(6.5, { value: 6.28, unit: "Hz", absolute: null, relative: 0.02 })).toBe(false);
  });

  it("calls an estimate a surprise when it is more than half off", () => {
    expect(SURPRISE_SHARE).toBe(0.5);
    useCourseProgress.getState().estimate("pt1_reading", 20, 71.88, "°C");
    useCourseProgress.getState().estimate("decrement", 0.049, 0.05, "");
    expect(useCourseProgress.getState().surprises.map((s) => s.exercise)).toEqual(["pt1_reading"]);
  });

  it("keeps working when the browser refuses to store anything", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    useCourseProgress.getState().visit("laplace");
    expect(useCourseProgress.getState().visited).toContain("laplace");
    spy.mockRestore();
  });

  it("writes a worked solution for every exercise the engine serves", () => {
    for (const exercise of fixtures.defaults.exercises as unknown as Exercise[]) {
      expect(solutionTex(exercise, "en-GB"), exercise.key).toMatch(/=/);
      expect(C.exercises[exercise.key as keyof typeof C.exercises]).toBeDefined();
    }
  });

  it("numbers the lessons without a gap, and the cheat sheet, which is no lesson, not at all", () => {
    expect(LESSONS.map((entry) => entry.number)).toEqual([0, 1, 2, 3, 4, 5, 6, null]);
    expect(lessonEntry("recipe").path).toBe(BASICS_PATH);
    expect(neighbours("recipe").previous).toBeNull();
    expect(neighbours("cheat_sheet").next).toBeNull();
    expect(neighbours("laplace").next?.lesson).toBe("numerics");
    expect(neighbours("two_mass").next?.lesson).toBe("cheat_sheet");
    // The site's one minus (U+2212), read back as entered.
    expect(parseEntry(formatSig(-12.345, "en-GB"))).toBe(-12.35);
  });
});
