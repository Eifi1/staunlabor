/**
 * The draining vessel's page against a mocked engine whose answer is the real
 * engine's (`src/test/experiments.ts`): the tube full and plugged, a plug
 * pulled and put back, a refill, every equation explained, the build's
 * figures and the dry holes.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { E, legends, mockExperiments, setSlider } from "@/test/experiments";
import { renderWithProviders } from "@/test/render";
import { VesselPage } from "./vessel-page";
import { useTried } from "./tried";

beforeEach(() => {
  useTried.getState().forget();
  mockExperiments();
});

const hole = (cm: number) => E.vessel.play.hole.replace("{{height}}", String(cm));
const full = E.vessel.play.full.replace("{{fill}}", "90");

describe("the draining vessel", () => {
  it("stands full with every plug in, every equation explained", async () => {
    renderWithProviders(<VesselPage />);
    expect(await screen.findByRole("img", { name: E.vessel.view })).toBeInTheDocument();
    expect(screen.getByText(full)).toBeInTheDocument();
    for (const cm of [5, 35, 65])
      expect(screen.getByRole("button", { name: hole(cm) })).toHaveAttribute("aria-pressed", "false");
    // Four in the model, one exact solution, the half time, four check cases.
    expect(legends()).toHaveLength(10);
  });

  it("opens a hole with its plug, closes it again and fills the tube anew", async () => {
    renderWithProviders(<VesselPage />);
    await screen.findByRole("img", { name: E.vessel.view });
    fireEvent.click(screen.getByRole("button", { name: hole(5) }));
    expect(screen.getByRole("button", { name: hole(5) })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText(full)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: E.play.pause })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: hole(5) }));
    expect(screen.getByRole("button", { name: hole(5) })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: hole(35) }));
    fireEvent.click(screen.getByRole("button", { name: E.vessel.play.refill }));
    expect(screen.getByText(full)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: hole(35) })).toHaveAttribute("aria-pressed", "false");
  });

  it("gives the bottom hole's 68 s and says when a hole stands dry above the water", async () => {
    renderWithProviders(<VesselPage />);
    await screen.findByRole("img", { name: E.vessel.view });
    expect(screen.getByText("68.3")).toBeInTheDocument();
    expect(screen.queryByText(E.vessel.change.dry)).not.toBeInTheDocument();
    setSlider(E.vessel.change.fill, "50");
    expect(await screen.findByText(E.vessel.change.dry)).toBeInTheDocument();
  });
});
