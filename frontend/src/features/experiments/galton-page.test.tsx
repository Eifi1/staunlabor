/**
 * The Galton board's page against a mocked engine whose answer is the real
 * engine's (`src/test/experiments.ts`): the board waiting with its balls in
 * the funnel, a whole run poured at once onto the heap the engine's seed
 * gives, the expected heap held back until then, a new run and a new board.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { E, legends, mockExperiments, setSlider, showAnswer } from "@/test/experiments";
import { renderWithProviders } from "@/test/render";
import { GaltonPage } from "./galton-page";
import { useTried } from "./tried";

beforeEach(() => {
  useTried.getState().forget();
  mockExperiments();
});

const caption = (rows: number, run: number, balls = 500) =>
  E.galton.play.caption
    .replace("{{rows}}", String(rows))
    .replace("{{bins}}", String(rows + 1))
    .replace("{{run}}", String(run))
    .replace("{{balls}}", String(balls));

describe("the Galton board", () => {
  it("waits with its balls in the funnel, the expected heap held back, every equation explained", async () => {
    renderWithProviders(<GaltonPage />);
    expect(await screen.findByRole("img", { name: E.galton.view })).toBeInTheDocument();
    expect(screen.getByText(E.galton.play.waiting)).toBeInTheDocument();
    expect(screen.getByText(caption(12, 1))).toBeInTheDocument();
    expect(screen.queryByText(E.galton.figures.expected_mean)).not.toBeInTheDocument();
    // Four in the model, the row rule in how it is computed, six check cases.
    expect(legends()).toHaveLength(11);
    showAnswer();
    expect(screen.getByText(E.galton.figures.expected_mean)).toBeInTheDocument();
  });

  it("pours the whole run at once onto the engine's heap, its middle at 5.88, and shows what was expected", async () => {
    renderWithProviders(<GaltonPage />);
    await screen.findByRole("img", { name: E.galton.view });
    fireEvent.click(screen.getByRole("button", { name: E.galton.play.all }));
    expect(
      screen.getByText(E.galton.play.done.replace("{{balls}}", "500").replace("{{mean}}", "5.88")),
    ).toBeInTheDocument();
    expect(screen.getByText(E.galton.figures.expected_mean)).toBeInTheDocument();
    expect(screen.getByText(E.galton.play.expected)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: E.galton.play.all })).not.toBeInTheDocument();
  });

  it("starts the next run from the next seed, and a new board waits in the funnel", async () => {
    renderWithProviders(<GaltonPage />);
    await screen.findByRole("img", { name: E.galton.view });
    fireEvent.click(screen.getByRole("button", { name: E.galton.play.new }));
    expect(screen.getByText(caption(12, 2))).toBeInTheDocument();
    expect(screen.getByText(E.galton.play.falling)).toBeInTheDocument();
    setSlider(E.galton.change.rows, "8");
    expect(await screen.findByText(caption(8, 2))).toBeInTheDocument();
    expect(screen.getByText(E.galton.play.waiting)).toBeInTheDocument();
    expect(
      screen.getByText(
        E.galton.change.status.replace("{{rows}}", "8").replace("{{bins}}", "9").replace("{{paths}}", "256"),
      ),
    ).toBeInTheDocument();
  });
});
