/**
 * The metronomes' page against a mocked engine whose answer is the real
 * engine's (`src/test/experiments.ts`): what it draws, the hand that starts and
 * stops each metronome and frees or holds the board, the port's figures it
 * shows and holds back, the trick's two runs, and how many equations it
 * explains.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { E, legends, mockExperiments, setSlider, showAnswer, sliderText } from "@/test/experiments";
import { renderWithProviders } from "@/test/render";
import { MetronomesPage } from "./metronomes-page";
import { useTried } from "./tried";
import fixtures from "./test-fixtures.json";
import { coupling, inStepS, run, type Metronomes } from "./simulate/metronomes";

const M = fixtures.defaults.metronomes as Metronomes;
const name = (template: string, n: number) => template.replace("{{n}}", String(n));

beforeEach(() => {
  useTried.getState().forget();
  mockExperiments();
});

describe("the metronomes", () => {
  it("shows the board, five metronomes to start and stop, and the trick's two runs", async () => {
    renderWithProviders(<MetronomesPage />);
    expect(await screen.findByRole("img", { name: E.metronomes.view })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: E.metronomes.play.random })).toBeInTheDocument();
    const each = screen.getByRole("group", { name: E.metronomes.play.each });
    for (let n = 1; n <= 5; n++) {
      expect(within(each).getByRole("button", { name: name(E.metronomes.play.stop_one, n) })).toBeInTheDocument();
    }
    // The page's five on his board: in step after 53 s on the cans.
    expect(inStepS(run(M, "scattered", 120))).toBeCloseTo(53.28, 2);
    expect(screen.getByText(/they are in step on the cans after 53 s/)).toBeInTheDocument();
    // Four in what happens, one in how it is computed, and the five checks' formulas.
    expect(legends()).toHaveLength(10);
  });

  it("stops a metronome by hand and starts it again", async () => {
    renderWithProviders(<MetronomesPage />);
    const each = await screen.findByRole("group", { name: E.metronomes.play.each });
    fireEvent.click(within(each).getByRole("button", { name: name(E.metronomes.play.stop_one, 2) }));
    const again = within(each).getByRole("button", { name: name(E.metronomes.play.start_one, 2) });
    expect(again).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(again);
    expect(within(each).getByRole("button", { name: name(E.metronomes.play.stop_one, 2) })).toBeInTheDocument();
  });

  it("stops them all, and starts them all again at random", async () => {
    renderWithProviders(<MetronomesPage />);
    const each = await screen.findByRole("group", { name: E.metronomes.play.each });
    fireEvent.click(screen.getByRole("button", { name: E.metronomes.play.stop_all }));
    expect(within(each).getAllByRole("button", { pressed: false })).toHaveLength(5);
    fireEvent.click(screen.getByRole("button", { name: E.metronomes.play.random }));
    expect(within(each).getAllByRole("button", { pressed: true })).toHaveLength(5);
  });

  it("couples nothing with the board on the table", async () => {
    renderWithProviders(<MetronomesPage />);
    await screen.findByRole("img", { name: E.metronomes.view });
    expect(screen.getByText(new RegExp(coupling(M).toFixed(4).replace(".", "\\.")))).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: E.metronomes.play.held }));
    await waitFor(() => expect(screen.getByText("0.0000")).toBeInTheDocument());
  });

  it("holds back the answer until asked", async () => {
    renderWithProviders(<MetronomesPage />);
    await screen.findByRole("img", { name: E.metronomes.view });
    expect(screen.queryByText(E.metronomes.play.answer)).not.toBeInTheDocument();
    showAnswer();
    expect(screen.getByText(E.metronomes.play.answer)).toBeInTheDocument();
  });

  it("puts as many metronomes on the board as the slider says", async () => {
    renderWithProviders(<MetronomesPage />);
    await screen.findByRole("img", { name: E.metronomes.view });
    setSlider(E.metronomes.change.count, "3");
    await waitFor(() => expect(sliderText(E.metronomes.change.count)).toMatch(/^3\b/));
    const each = await screen.findByRole("group", { name: E.metronomes.play.each });
    await waitFor(() => expect(within(each).getAllByRole("button")).toHaveLength(3));
  });
});
