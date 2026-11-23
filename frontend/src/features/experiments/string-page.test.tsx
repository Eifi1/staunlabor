/**
 * The standing string's page against a mocked engine whose answer is the real
 * engine's (`src/test/experiments.ts`): what it draws, what it holds back
 * until the cord stands in loops, the build card's figures from the port, and
 * how many equations it explains.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { E, legends, mockExperiments, setSlider, showAnswer, sliderText } from "@/test/experiments";
import { renderWithProviders } from "@/test/render";
import { StringPage, StringPreview } from "./string-page";
import { useTried } from "./tried";
import fixtures from "./test-fixtures.json";
import { halfWaves, modeHz, pullN, VIBRATOR_HZ, widestM, type Cord } from "./simulate/string";

const S = fixtures.defaults.string as Cord;

beforeEach(() => {
  useTried.getState().forget();
  mockExperiments();
});

describe("the standing string", () => {
  it("draws the cord from the vibrator to the peg, with the wave equation and the modes explained", async () => {
    renderWithProviders(<StringPage />);
    expect(await screen.findByRole("img", { name: E.string.view })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: E.string.play.pull })).toBeInTheDocument();
    expect(sliderText(E.string.play.tone)).toMatch(/^100\b/);
    // Four in what happens, one in how it is computed, one for each of the six check cases.
    expect(legends()).toHaveLength(11);
    expect(screen.getByText(E.string.sweet.numbers)).toBeInTheDocument();
  });

  it("starts between two and three loops, and the port's pulls are the trick's", () => {
    expect(VIBRATOR_HZ).toBe(100);
    expect(halfWaves(S, VIBRATOR_HZ)).toBeCloseTo(2.58, 2);
    expect([1, 2, 3].map((n) => Math.round(pullN(S, VIBRATOR_HZ, n) * 100) / 100)).toEqual([20, 5, 2.22]);
    // Between two loop counts the cord swings nowhere wider than the vibrator.
    expect(widestM({ ...S, tension_n: pullN(S, VIBRATOR_HZ, 2.5) }, VIBRATOR_HZ) * 1000).toBeCloseTo(2.0, 3);
    expect(widestM({ ...S, tension_n: pullN(S, VIBRATOR_HZ, 3) }, VIBRATOR_HZ) * 1000).toBeCloseTo(22.26, 2);
  });

  it("holds back the half-waves and their chart until asked", async () => {
    renderWithProviders(<StringPage />);
    await screen.findByRole("img", { name: E.string.view });
    expect(screen.queryByText(E.string.play.half_waves)).not.toBeInTheDocument();
    showAnswer();
    expect(screen.getByText(E.string.play.half_waves)).toBeInTheDocument();
    expect(screen.getByText(E.string.chart.caption)).toBeInTheDocument();
  });

  it("lowers the cord's tones when it is made longer", async () => {
    renderWithProviders(<StringPage />);
    await screen.findByRole("img", { name: E.string.view });
    setSlider(E.string.change.length, "2");
    await waitFor(() => expect(sliderText(E.string.change.length)).toMatch(/^2\.00\b/));
    expect(modeHz({ ...S, length_m: 2 }, 1)).toBeCloseTo(19.36, 2);
    expect(screen.getByText("19.4")).toBeInTheDocument();
  });

  it("previews the cord pulled for three loops", async () => {
    renderWithProviders(<StringPreview paused />);
    expect(await screen.findByRole("img", { name: E.string.view })).toBeInTheDocument();
    expect(screen.getByText("2.22 N")).toBeInTheDocument();
  });
});
