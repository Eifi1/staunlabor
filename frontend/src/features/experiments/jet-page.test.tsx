/**
 * The light in the water jet's page against a mocked engine whose answer is
 * the real engine's (`src/test/experiments.ts`): the light kept in the jet,
 * lost when the laser tilts past its limit or the jet bends too sharply, and
 * the check cases' "Set it up".
 */
import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { E, legends, mockExperiments, setSlider, sliderText } from "@/test/experiments";
import { renderWithProviders } from "@/test/render";
import { JetPage } from "./jet-page";
import { useTried } from "./tried";

beforeEach(() => {
  useTried.getState().forget();
  mockExperiments();
});

const allIn = (steepest: string) => E.jet.play.all_in.replace("{{steepest}}", steepest).replace("{{critical}}", "48.6");
const allOut = E.jet.play.all_out.replace("{{critical}}", "48.6");

describe("the light in the water jet", () => {
  it("keeps all the light in the jet with the laser straight, every equation explained", async () => {
    renderWithProviders(<JetPage />);
    expect(await screen.findByRole("img", { name: E.jet.scene_view })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: E.jet.close_view })).toBeInTheDocument();
    // Straight in, the rays meet the surface at 79° from the normal or flatter.
    expect(await screen.findByText(allIn("79.1"))).toBeInTheDocument();
    // Five in the model, four check cases.
    expect(legends()).toHaveLength(9);
  });

  it("still holds the light at a 40° tilt and lets it all out at 45°", async () => {
    renderWithProviders(<JetPage />);
    await screen.findByRole("img", { name: E.jet.scene_view });
    setSlider(E.jet.play.tilt, "40");
    expect(await screen.findByText(allIn("48.7"))).toBeInTheDocument();
    setSlider(E.jet.play.tilt, "45");
    expect(await screen.findByText(allOut)).toBeInTheDocument();
  });

  it("lets a sixth of the light out of a jet bent too sharply below a 6 mm level", async () => {
    renderWithProviders(<JetPage />);
    await screen.findByRole("img", { name: E.jet.scene_view });
    setSlider(E.jet.play.level, "0.5");
    const some = E.jet.play.some_out.replace("{{out}}", "16.9").replace("{{arrives}}", "83.1");
    expect(await screen.findByText(some)).toBeInTheDocument();
  });

  it("sets up the tilted laser of the Snell case", async () => {
    renderWithProviders(<JetPage />);
    await screen.findByRole("img", { name: E.jet.scene_view });
    const buttons = await screen.findAllByRole("button", { name: E.checks.set_up });
    expect(buttons).toHaveLength(4);
    fireEvent.click(buttons[1]);
    await waitFor(() => expect(sliderText(E.jet.play.tilt)).toContain("45"));
    expect(await screen.findByText(allOut)).toBeInTheDocument();
  });
});
