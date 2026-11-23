/**
 * The Wilberforce spring's page against a mocked engine whose answer is the
 * real engine's (`src/test/experiments.ts`): what it draws, the ways to let go,
 * the hand that pulls and twists the weight, the port's figures it shows and
 * holds back, and how many equations it explains.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { E, legends, mockExperiments, setSlider, showAnswer, sliderText } from "@/test/experiments";
import { renderWithProviders } from "@/test/render";
import { SpringPage } from "./spring-page";
import { useTried } from "./tried";
import fixtures from "./test-fixtures.json";
import { beatS, exchangeShare, tunedRadiusM, type WilberforceSpring } from "./simulate/spring";

const S = fixtures.defaults.spring as WilberforceSpring;

beforeEach(() => {
  useTried.getState().forget();
  mockExperiments();
});

describe("the Wilberforce spring", () => {
  it("shows the weight, the four ways to let go and the port's beat", async () => {
    renderWithProviders(<SpringPage />);
    expect(await screen.findByRole("img", { name: E.spring.view })).toBeInTheDocument();
    for (const how of ["down", "twisted", "fast", "slow"] as const) {
      expect(screen.getByRole("button", { name: E.spring.play.starts[how] })).toBeInTheDocument();
    }
    // The page's spring: over and back in 27.3 s, all of it into the twist, tuned at 20.0 mm.
    expect(beatS(S)).toBeCloseTo(27.28, 2);
    expect(tunedRadiusM(S)! * 1000).toBeCloseTo(19.98, 2);
    expect(
      screen.getByText(/goes once into twisting and back in 27\.3 s, and about 100 % of it arrives/),
    ).toBeInTheDocument();
    expect(screen.getByText(/All of it goes over with the nuts at 20\.0 mm/)).toBeInTheDocument();
    // Four in what happens and one in the trick (how it is computed has no
    // symbols of its own to explain), and one for each of the five checks.
    expect(legends()).toHaveLength(10);
  });

  it("holds back the beat and the share until asked", async () => {
    renderWithProviders(<SpringPage />);
    await screen.findByRole("img", { name: E.spring.view });
    expect(screen.queryByText(E.spring.figures.beat)).not.toBeInTheDocument();
    expect(screen.getByText(E.spring.figures.tuned)).toBeInTheDocument();
    showAnswer();
    expect(screen.getByText(E.spring.figures.beat)).toBeInTheDocument();
    expect(screen.getByText(E.spring.figures.share)).toBeInTheDocument();
  });

  it("hands over only part of it with the nuts moved out", async () => {
    renderWithProviders(<SpringPage />);
    await screen.findByRole("img", { name: E.spring.view });
    setSlider(E.spring.change.nuts, "35");
    await waitFor(() => expect(sliderText(E.spring.change.nuts)).toMatch(/^35\b/));
    expect(Math.round(exchangeShare({ ...S, nut_radius_m: 0.035 }) * 100)).toBe(48);
    expect(
      await screen.findByText(
        /With the nuts at 35\.0 mm the energy goes once into twisting and back in 19\.9 s, and about 48 %/,
      ),
    ).toBeInTheDocument();
  });

  it("lets a hand pull the weight down, shows it all in the bobbing, and lets go", async () => {
    renderWithProviders(<SpringPage />);
    const view = await screen.findByRole("img", { name: E.spring.view });
    // The drawing's millimetres a pixel each, its top left at the box's.
    const [x0, y0, w, h] = view.getAttribute("viewBox")!.split(" ").map(Number);
    const box = { left: 0, top: 0, width: w, height: h, right: w, bottom: h, x: 0, y: 0 };
    vi.spyOn(view, "getBoundingClientRect").mockReturnValue({ ...box, toJSON: () => ({}) });
    const px = (x: number, y: number) => ({ clientX: x - x0, clientY: y - y0 });
    // Paused first, so the weight stands where the hand leaves it.
    const pause = screen.queryByRole("button", { name: E.play.pause });
    if (pause) fireEvent.click(pause);
    const hold = view.querySelector("rect.cursor-grab")!;
    fireEvent.pointerDown(hold, { pointerId: 1, ...px(0, 210) });
    fireEvent.pointerMove(view, { pointerId: 1, ...px(0, 230) });
    const bars = screen.getByRole("group", { name: E.spring.play.energy });
    expect(within(bars).getByText("100 %")).toBeInTheDocument();
    expect(within(bars).getByText("0 %")).toBeInTheDocument();
    fireEvent.pointerUp(view, { pointerId: 1 });
    expect(await screen.findByRole("button", { name: E.play.pause })).toBeInTheDocument();
  });

  it("lets go in a mode from its button", async () => {
    renderWithProviders(<SpringPage />);
    await screen.findByRole("img", { name: E.spring.view });
    fireEvent.click(screen.getByRole("button", { name: E.spring.play.starts.fast }));
    expect(screen.getByRole("button", { name: E.play.pause })).toBeInTheDocument();
  });
});
