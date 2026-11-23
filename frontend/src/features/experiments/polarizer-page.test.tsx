/**
 * The third polarising filter's page against a mocked engine whose answer is
 * the real engine's (`src/test/experiments.ts`): the crossed pair dark, the
 * middle filter slid in and turned, real sheets, more filters between, and the
 * check cases' "Set it up".
 */
import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { E, legends, mockExperiments, setSlider, sliderText } from "@/test/experiments";
import { renderWithProviders } from "@/test/render";
import { PolarizerPage } from "./polarizer-page";
import { useTried } from "./tried";

beforeEach(() => {
  useTried.getState().forget();
  mockExperiments();
});

const through = (share: string) => E.polarizer.play.status_light.replace("{{share}}", share);

describe("the third polarising filter", () => {
  it("starts with the pair crossed and dark, every equation explained", async () => {
    renderWithProviders(<PolarizerPage />);
    expect(await screen.findByRole("img", { name: E.polarizer.stack_view })).toBeInTheDocument();
    expect(screen.getByText(E.polarizer.play.status_dark)).toBeInTheDocument();
    // Four in the model, eight check cases.
    expect(legends()).toHaveLength(12);
  });

  it("brings an eighth back with the middle filter at 45°, less at 30°, and a twentieth with real sheets", async () => {
    renderWithProviders(<PolarizerPage />);
    await screen.findByRole("img", { name: E.polarizer.stack_view });
    fireEvent.click(screen.getByRole("switch", { name: E.polarizer.play.middle }));
    expect(await screen.findByText(through("12.5"))).toBeInTheDocument();
    setSlider(E.polarizer.play.middle_deg, "30");
    expect(await screen.findByText(through("9.4"))).toBeInTheDocument();
    setSlider(E.polarizer.play.middle_deg, "45");
    fireEvent.click(screen.getByRole("switch", { name: E.polarizer.play.real }));
    expect(await screen.findByText(through("5.0"))).toBeInTheDocument();
  });

  it("lights the pair again as the back filter turns away from crossed", async () => {
    renderWithProviders(<PolarizerPage />);
    await screen.findByRole("img", { name: E.polarizer.stack_view });
    setSlider(E.polarizer.play.last_deg, "0");
    expect(await screen.findByText(through("50.0"))).toBeInTheDocument();
  });

  it("sets up the third filter's case, Polaroid's single sheet, and ten filters between", async () => {
    renderWithProviders(<PolarizerPage />);
    await screen.findByRole("img", { name: E.polarizer.stack_view });
    const setUp = async (index: number) => {
      const buttons = await screen.findAllByRole("button", { name: E.checks.set_up });
      expect(buttons).toHaveLength(8);
      fireEvent.click(buttons[index]);
    };
    await setUp(3);
    await waitFor(() => expect(screen.getByRole("switch", { name: E.polarizer.play.middle })).toBeChecked());
    expect(await screen.findByText(through("12.5"))).toBeInTheDocument();
    await setUp(6);
    await waitFor(() => expect(screen.getByRole("switch", { name: E.polarizer.play.real })).toBeChecked());
    expect(screen.getByRole("switch", { name: E.polarizer.play.middle })).not.toBeChecked();
    // Behind the front sheet 38.1 %, and through the back one, parallel, 28.9 %.
    expect((await screen.findAllByText(/^38\.1/)).length).toBeGreaterThan(0);
    expect(screen.getByText(through("28.9"))).toBeInTheDocument();
    await setUp(5);
    await waitFor(() => expect(sliderText(E.polarizer.change.between)).toMatch(/^10\b/));
  });
});
