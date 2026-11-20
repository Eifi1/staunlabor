/**
 * Every control of every page of the course, worked: each slider moved, each
 * toggle and select tried, each number typed, each button pressed — and the
 * page still standing afterwards, with the engine asked again for the new
 * numbers.
 *
 * A widget's whole behaviour is "the reader changes a number, the engine is
 * asked for it"; a handler that throws, or that builds a body the page then
 * cannot draw, is the defect this catches. The answers come from the same
 * engine-written fixtures as `course.test.tsx`, whatever is asked.
 */
import type { ComponentType } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import en from "@/shared/i18n/locales/en.json";
import { api } from "@/shared/api/client";
import { STORAGE } from "@/shared/lib/storage-keys";
import { mockApi } from "@/test/api-mock";
import { renderWithProviders } from "@/test/render";
import { CheatSheetPage } from "./cheat-sheet";
import { EigenvaluesLesson } from "./lesson-eigenvalues";
import { FirstOrderLesson } from "./lesson-first-order";
import { LaplaceLesson } from "./lesson-laplace";
import { NumericsLesson } from "./lesson-numerics";
import { SecondOrderLesson } from "./lesson-second-order";
import { TwoMassLesson } from "./lesson-two-mass";
import { CourseOverviewPage } from "./overview-page";
import { useCourseProgress } from "./progress";
import fixtures from "./test-fixtures.json";

const C = en.course;

beforeEach(() => {
  mockApi({
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
  });
  localStorage.removeItem(STORAGE.courseProgress);
  useCourseProgress.getState().forget();
});
afterEach(() => vi.restoreAllMocks());

/** What the page asked of the engine. */
const posts = () => (api.post as ReturnType<typeof vi.fn>).mock.calls.length;

/** Buttons that open the print dialog, which a test has no use for. */
const LEAVE = new Set([C.cheat.print]);
/** Buttons that put the numbers back: pressed last, on their own, because a
 *  widget that settles on its starting numbers rightly asks nothing new. */
const BACK = new Set([C.reset, C.overview.forget]);

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 700));
  });
}

/** Work every control on the page once, in place. */
async function workEverything() {
  for (const slider of screen.queryAllByRole("slider")) {
    const min = Number(slider.getAttribute("min") ?? slider.getAttribute("aria-valuemin") ?? 0);
    const max = Number(slider.getAttribute("max") ?? slider.getAttribute("aria-valuemax") ?? 1);
    fireEvent.change(slider, { target: { value: String(min + (max - min) * 0.7) } });
  }
  for (const radio of screen.queryAllByRole("radio")) fireEvent.click(radio);
  for (const select of screen.queryAllByRole("combobox")) {
    const options = Array.from(select.querySelectorAll("option"));
    const last = options[options.length - 1];
    if (last) fireEvent.change(select, { target: { value: last.getAttribute("value") } });
  }
  for (const box of screen.queryAllByRole("textbox")) {
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: "2" } });
    fireEvent.blur(box);
  }
  for (const toggle of screen.queryAllByRole("switch")) fireEvent.click(toggle);
  for (const button of screen.queryAllByRole("button")) {
    const name = button.getAttribute("aria-label") ?? button.textContent ?? "";
    if (LEAVE.has(name.trim()) || BACK.has(name.trim()) || button.hasAttribute("disabled")) continue;
    fireEvent.click(button);
  }
  // Let the debounced requests go out.
  await settle();
}

async function putBack() {
  for (const button of screen.queryAllByRole("button")) {
    if (BACK.has((button.textContent ?? "").trim())) fireEvent.click(button);
  }
  await settle();
}

const PAGES: [string, ComponentType][] = [
  ["the course's front page", CourseOverviewPage],
  ["first order", FirstOrderLesson],
  ["second order", SecondOrderLesson],
  ["eigenvalues", EigenvaluesLesson],
  ["Laplace", LaplaceLesson],
  ["numerics", NumericsLesson],
  ["two masses", TwoMassLesson],
  ["the cheat sheet", CheatSheetPage],
];

describe("every control", () => {
  it.each(PAGES)("on %s can be worked, and the engine is asked again", async (_name, Page) => {
    renderWithProviders(<Page />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });
    const before = posts();
    await workEverything();
    // Twice, so a control that appeared only after the first round (a mode's
    // sliders, a revealed answer field, an added block) is worked too.
    await workEverything();
    if (Page !== CheatSheetPage) {
      await waitFor(() => expect(posts()).toBeGreaterThan(before));
    }
    await putBack();
    expect(screen.getAllByRole("heading").length).toBeGreaterThan(0);
  });
});

describe("the pole plane", () => {
  it("turns a dragged pole into a request for the pair it means", async () => {
    renderWithProviders(<EigenvaluesLesson />);
    const plane = await screen.findByRole("img", { name: /The pole plane/ });
    vi.spyOn(plane, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 360,
      height: 300,
      right: 360,
      bottom: 300,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    const handle = plane.querySelector("g.cursor-grab");
    expect(handle).not.toBeNull();
    fireEvent.pointerDown(handle!, { pointerId: 1 });
    fireEvent.pointerMove(plane, { clientX: 120, clientY: 80 });
    fireEvent.pointerUp(plane);
    await waitFor(() => {
      const bodies = (api.post as ReturnType<typeof vi.fn>).mock.calls
        .filter(([url]) => url === "/course/eigen/poles")
        .map(([, body]) => body);
      expect(bodies.some((body) => "real" in body && "imag" in body)).toBe(true);
    });
  });
});
