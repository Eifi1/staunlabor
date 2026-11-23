/**
 * Kapitza's pendulum's page against a mocked engine whose answer is the real
 * engine's (`src/test/experiments.ts`): what it draws, the motor, the hand that
 * stands the rod up, nudges it and holds it out, the port's figures it shows
 * and holds back, and how many equations it explains.
 */
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { E, legends, mockExperiments, setSlider, showAnswer, sliderText } from "@/test/experiments";
import { renderWithProviders } from "@/test/render";
import { KapitzaPage, KapitzaPreview } from "./kapitza-page";
import { useTried } from "./tried";
import fixtures from "./test-fixtures.json";
import { kapitzaFrequencyHz, leastFrequencyHz, stable, type KapitzaPendulum } from "./simulate/kapitza";

const K = fixtures.defaults.kapitza as KapitzaPendulum;

beforeEach(() => {
  useTried.getState().forget();
  mockExperiments();
});

describe("Kapitza's pendulum", () => {
  it("shows the rod, the motor, the hand's buttons and the presets", async () => {
    renderWithProviders(<KapitzaPage />);
    expect(await screen.findByRole("img", { name: E.kapitza.view })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: E.kapitza.play.motor })).not.toBeChecked();
    expect(screen.getByRole("button", { name: E.kapitza.play.upright })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: E.kapitza.play.nudge })).toBeInTheDocument();
    for (const name of ["fast", "slow", "swing"] as const) {
      expect(screen.getByRole("button", { name: E.kapitza.play.presets[name] })).toBeInTheDocument();
    }
    // Three in what happens, one in how it is computed, four in the check cases.
    expect(legends()).toHaveLength(8);
  });

  it("holds back the least drive until asked, then says the motor's drive holds the top", async () => {
    renderWithProviders(<KapitzaPage />);
    await screen.findByRole("img", { name: E.kapitza.view });
    expect(screen.queryByText(E.kapitza.play.off)).not.toBeInTheDocument();
    showAnswer();
    expect(await screen.findByText(E.kapitza.play.off)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch", { name: E.kapitza.play.motor }));
    expect(await screen.findByText(E.kapitza.play.holds)).toBeInTheDocument();
    // The page's figures: 31.5 Hz by Kapitza, a little more by Floquet.
    expect(kapitzaFrequencyHz(K)!).toBeCloseTo(31.52, 2);
    expect(leastFrequencyHz(K)!).toBeCloseTo(31.54, 2);
    expect(screen.getAllByText(E.kapitza.figures.least).length).toBeGreaterThan(0);
  });

  it("says the top falls at too slow a drive", async () => {
    renderWithProviders(<KapitzaPage />);
    await screen.findByRole("img", { name: E.kapitza.view });
    showAnswer();
    fireEvent.click(screen.getByRole("switch", { name: E.kapitza.play.motor }));
    setSlider(E.kapitza.play.frequency, "25");
    await waitFor(() => expect(sliderText(E.kapitza.play.frequency)).toMatch(/^25\b/));
    expect(stable({ ...K, frequency_hz: 25 }, "top")).toBe(false);
    expect(await screen.findByText(E.kapitza.play.falls)).toBeInTheDocument();
  });

  it("swings the hanging rod up at twice its own frequency", async () => {
    renderWithProviders(<KapitzaPage />);
    await screen.findByRole("img", { name: E.kapitza.view });
    showAnswer();
    fireEvent.click(screen.getByRole("button", { name: E.kapitza.play.presets.swing }));
    expect(await screen.findByText(E.kapitza.play.swings)).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: E.kapitza.play.motor })).toBeChecked();
  });

  it("stands the rod up, nudges it, and lets a hand hold the weight", async () => {
    renderWithProviders(<KapitzaPage />);
    const view = await screen.findByRole("img", { name: E.kapitza.view });
    fireEvent.click(screen.getByRole("button", { name: E.kapitza.play.upright }));
    fireEvent.click(screen.getByRole("button", { name: E.kapitza.play.nudge }));
    const hold = view.querySelector("circle[fill='transparent']");
    expect(hold).not.toBeNull();
    fireEvent.pointerDown(hold!, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(view, { clientX: 20, clientY: 20, pointerId: 1 });
    fireEvent.pointerUp(view, { pointerId: 1 });
    expect(screen.getByRole("button", { name: E.play.pause })).toBeInTheDocument();
  });

  it("draws the averaged potential and the band in the trick", async () => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "requestAnimationFrame", "cancelAnimationFrame", "performance"],
      shouldClearNativeTimers: true,
    });
    try {
      renderWithProviders(<KapitzaPage />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400);
      });
      expect(screen.getByText(E.kapitza.sweet.potential)).toBeInTheDocument();
      expect(screen.getByText(/between 2\.14 and 2\.34 Hz, it swings itself up/)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  }, 15000);

  it("draws the rod alone in its preview", async () => {
    renderWithProviders(<KapitzaPreview paused />);
    expect(await screen.findByRole("img", { name: E.kapitza.view })).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
