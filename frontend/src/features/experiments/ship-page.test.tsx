/**
 * The ship that rights itself, its page against a mocked engine whose answer
 * is the real engine's (`src/test/experiments.ts`): the hull upright, pushed
 * and rocking back, the weight raised until a push turns it keel up, the hand
 * on the arrow keys, the rebuilt hull's figures, and every equation explained.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { E, legends, mockExperiments, setSlider, sliderText } from "@/test/experiments";
import { renderWithProviders } from "@/test/render";
import { ShipPage } from "./ship-page";
import { useTried } from "./tried";

beforeEach(() => {
  useTried.getState().forget();
  mockExperiments();
});

afterEach(() => {
  vi.useRealTimers();
});

/** The frames on a fake clock, as the diver's: seconds of rolling in no real time. */
const fakeFrames = () => vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });
const seconds = (s: number) =>
  act(async () => {
    vi.advanceTimersByTime(s * 1000);
  });

describe("the ship that rights itself", () => {
  it("floats upright, rocks back after a push, and explains every equation", async () => {
    fakeFrames();
    renderWithProviders(<ShipPage />);
    expect(await screen.findByRole("group", { name: E.ship.view })).toBeInTheDocument();
    expect(screen.getByText(E.ship.play.motion.upright)).toBeInTheDocument();
    // GM with the weight on the deck: 5.3 cm.
    expect(screen.getAllByText("5.3").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: E.ship.play.push }));
    await seconds(0.2);
    expect(screen.getByText(E.ship.play.motion.rolling)).toBeInTheDocument();
    await seconds(10);
    expect(screen.getByText(E.ship.play.motion.upright)).toBeInTheDocument();
    // Five in the model, two in the roll, four check cases.
    expect(legends()).toHaveLength(11);
  });

  it("stands on a knife's edge with the weight high, and a push turns it keel up", async () => {
    fakeFrames();
    renderWithProviders(<ShipPage />);
    await screen.findByRole("group", { name: E.ship.view });
    setSlider(E.ship.play.weight, "35");
    expect(screen.getAllByText("−2.4").length).toBeGreaterThan(0);
    expect(screen.getByText(E.ship.play.motion.on_edge)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: E.ship.play.push }));
    await seconds(12);
    expect(screen.getByText(E.ship.play.motion.keel_up)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: E.ship.play.upright }));
    expect(screen.getByText(E.ship.play.motion.on_edge)).toBeInTheDocument();
  });

  it("is held over by the arrow keys and set free when they are let go", async () => {
    renderWithProviders(<ShipPage />);
    await screen.findByRole("group", { name: E.ship.view });
    const hand = screen.getByRole("slider", { name: E.ship.play.tilt });
    for (let i = 0; i < 4; i++) fireEvent.keyDown(hand, { key: "ArrowRight", shiftKey: true });
    expect(screen.getByText(E.ship.play.motion.held)).toBeInTheDocument();
    expect(hand.getAttribute("aria-valuenow")).toBe("20");
    fireEvent.keyUp(hand, { key: "ArrowRight" });
    expect(screen.queryByText(E.ship.play.motion.held)).not.toBeInTheDocument();
  });

  it("sets up the check cases: the weight in the keel on its side, and the undamped roll", async () => {
    fakeFrames();
    renderWithProviders(<ShipPage />);
    await screen.findByRole("group", { name: E.ship.view });
    const buttons = await screen.findAllByRole("button", { name: E.checks.set_up });
    expect(buttons).toHaveLength(4);
    fireEvent.click(buttons[2]);
    await waitFor(() => expect(sliderText(E.ship.play.weight)).toMatch(/^−15\b/));
    expect(screen.getByRole("slider", { name: E.ship.play.tilt }).getAttribute("aria-valuenow")).toBe("90");
    fireEvent.click(buttons[3]);
    await waitFor(() => expect(sliderText(E.ship.change.damping)).toMatch(/^0\b/));
    expect(sliderText(E.ship.play.weight)).toMatch(/^12\b/);
  });

  it("names the box's figures, and a wider beam raises the metacentre", async () => {
    renderWithProviders(<ShipPage />);
    await screen.findByRole("group", { name: E.ship.view });
    // Draft 3.0 cm, BM 11.1 cm, the weight's limit 27.8 cm, back from up to 75°.
    for (const shown of ["3.0", "11.1", "27.8", "75"]) expect(screen.getAllByText(shown).length).toBeGreaterThan(0);
    setSlider(E.ship.change.beam, "30");
    // BM = b²/(12·d): 30 cm wide, 2.0 cm deep, 37.4 cm.
    expect(await screen.findByText("37.4")).toBeInTheDocument();
  });
});
