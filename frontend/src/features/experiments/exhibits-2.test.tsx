/**
 * Each exhibit's page, the rest of the list (the floating top to the beats),
 * against a mocked engine whose answer is the real engine's
 * (`src/test/experiments.ts`): what it draws, what its controls do, the
 * numbers it shows and holds back, and how many equations it explains (one
 * legend each, counted exactly, so a lost legend fails).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, within } from "@testing-library/react";
import { E, legends, mockExperiments, setSlider, showAnswer, sliderText } from "@/test/experiments";
import { renderWithProviders } from "@/test/render";
import { LevitationPage } from "./levitation-page";
import { CircuitPage } from "./circuit-page";
import { PlatesPage } from "./plates-page";
import { BouncePage } from "./bounce-page";
import { OverhangPage } from "./overhang-page";
import { DiverPage } from "./diver-page";
import { RainbowPage } from "./rainbow-page";
import { SkyPage } from "./sky-page";
import { SlitsPage } from "./slits-page";
import { BeatsPage } from "./beats-page";
import { useTried } from "./tried";

beforeEach(() => {
  useTried.getState().forget();
  mockExperiments();
});

describe("the floating top", () => {
  it("shows the tuned top floating in its window, with the field's equations", async () => {
    renderWithProviders(<LevitationPage />);
    expect(await screen.findByRole("img", { name: E.levitation.view })).toBeInTheDocument();
    expect(await screen.findByText(E.levitation.play.hovers)).toBeInTheDocument();
    expect(legends()).toHaveLength(11);
  });

  it("lands too heavy, slides off too light, and lands again when the room warms", async () => {
    renderWithProviders(<LevitationPage />);
    await screen.findByRole("img", { name: E.levitation.view });
    const mass = screen.getByRole("slider", { name: E.levitation.play.mass });
    fireEvent.change(mass, { target: { value: "24" } });
    expect(await screen.findByText(E.levitation.play.lands)).toBeInTheDocument();
    fireEvent.change(mass, { target: { value: "23" } });
    expect(await screen.findByText(E.levitation.play.slides)).toBeInTheDocument();
    fireEvent.change(mass, { target: { value: "23.5" } });
    expect(await screen.findByText(E.levitation.play.hovers)).toBeInTheDocument();
    setSlider(E.levitation.play.warming, "3.5");
    expect(await screen.findByText(E.levitation.play.lands)).toBeInTheDocument();
  });
});

describe("the slow LC circuit", () => {
  it("waits charged on the battery, then swings once the switch is thrown, and charges again", async () => {
    renderWithProviders(<CircuitPage />);
    expect(await screen.findByRole("img", { name: E.circuit.view })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: E.circuit.twin })).toBeInTheDocument();
    expect(screen.getByText(E.circuit.play.charged.replace("{{voltage}}", "10"))).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: E.circuit.play.throw }));
    expect(screen.queryByText(E.circuit.play.charged.replace("{{voltage}}", "10"))).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: E.play.pause })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: E.play.pause }));
    expect(screen.getByRole("button", { name: E.play.run })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: E.circuit.play.recharge }));
    expect(screen.getByRole("button", { name: E.circuit.play.throw })).toBeInTheDocument();
    expect(legends()).toHaveLength(11);
  });

  it("says when too much resistance stops it swinging, and the energy is all in the capacitor before the switch", async () => {
    renderWithProviders(<CircuitPage />);
    await screen.findByRole("img", { name: E.circuit.view });
    expect(screen.getByText(E.circuit.change.swings)).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: new RegExp(`^${E.circuit.play.energy}: ${E.circuit.play.capacitor} 100 %`) }),
    ).toBeInTheDocument();
    setSlider(E.circuit.change.resistance, "3000");
    expect(await screen.findByText(E.circuit.change.creeps)).toBeInTheDocument();
  });
});

describe("the falling plates", () => {
  it("holds the plates at the top, lets them fall, and brings them back", async () => {
    renderWithProviders(<PlatesPage />);
    expect(await screen.findByRole("img", { name: E.plates.view })).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: E.plates.closeup.replace("{{plate}}", E.plates.short.copper) }),
    ).toBeInTheDocument();
    expect(screen.getByText(E.plates.play.waiting)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: E.plates.play.drop }));
    expect(screen.queryByText(E.plates.play.waiting)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: E.play.pause }));
    expect(screen.getByRole("button", { name: E.play.run })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: E.plates.play.top }));
    expect(screen.getByRole("button", { name: E.plates.play.drop })).toBeInTheDocument();
    const look = screen.getByRole("radiogroup", { name: E.plates.play.look });
    fireEvent.click(within(look).getByRole("radio", { name: E.plates.short.plastic }));
    expect(screen.getByText(E.plates.play.none)).toBeInTheDocument();
    expect(legends()).toHaveLength(12);
  });

  it("times the reader's own plate, and a plastic one falls freely", async () => {
    renderWithProviders(<PlatesPage />);
    await screen.findByRole("img", { name: E.plates.view });
    // The build starts as the exhibit's aluminium: 12.3 s through the column.
    expect(
      screen.getByText(new RegExp(`^${E.plates.change.status.split("{{time}}")[0]}12[.,]3 s`)),
    ).toBeInTheDocument();
    const material = screen.getByRole("radiogroup", { name: E.plates.change.material });
    fireEvent.click(within(material).getByRole("radio", { name: E.plates.materials.brass }));
    fireEvent.click(within(material).getByRole("radio", { name: E.plates.materials.plastic }));
    expect(await screen.findByText(E.plates.change.free.replace("{{time}}", "0.43"))).toBeInTheDocument();
    expect(screen.getByText(E.plates.chart.plastic)).toBeInTheDocument();
  });
});

describe("the bouncing ball", () => {
  it("holds the balls up, lets them bounce, and lifts them again, silent until asked", async () => {
    renderWithProviders(<BouncePage />);
    expect(await screen.findByRole("img", { name: E.bounce.view })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: E.bounce.strip })).toBeInTheDocument();
    expect(screen.getByText(E.bounce.play.waiting)).toBeInTheDocument();
    // No Web Audio in the test runner: the switch says so and stays off.
    expect(screen.getByText(E.play.no_sound)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: E.bounce.play.drop }));
    expect(screen.queryByText(E.bounce.play.waiting)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: E.play.pause }));
    expect(screen.getByRole("button", { name: E.play.run })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: E.bounce.play.top }));
    expect(screen.getByRole("button", { name: E.bounce.play.drop })).toBeInTheDocument();
    expect(legends()).toHaveLength(9);
  });

  it("times the reader's own ball: the steel one still after 9.6 s, the table-tennis one sooner", async () => {
    renderWithProviders(<BouncePage />);
    await screen.findByRole("img", { name: E.bounce.view });
    const status = (time: string, count: number) =>
      E.bounce.change.status.replace("{{time}}", time).replace("{{count}}", String(count));
    expect(screen.getByText(status("9.6", 75))).toBeInTheDocument();
    const kind = screen.getByRole("radiogroup", { name: E.bounce.change.kind });
    fireEvent.click(within(kind).getByRole("radio", { name: E.bounce.short.tennis }));
    expect(await screen.findByText(status("5.2", 44))).toBeInTheDocument();
  });
});

describe("the overhang", () => {
  it("starts flush, and the furthest stack of nine reaches 28.3 cm where even steps reach 18", async () => {
    renderWithProviders(<OverhangPage />);
    expect(await screen.findByRole("group", { name: E.overhang.view })).toBeInTheDocument();
    // A goal in the drawing, a whole block past the edge, that does not give the furthest away.
    expect(within(screen.getByRole("group", { name: E.overhang.view })).getByText(E.overhang.goal)).toBeInTheDocument();
    const holds = (cm: string, lengths: string) =>
      E.overhang.play.holds.replace("{{cm}}", cm).replace("{{lengths}}", lengths);
    expect(screen.getByText(holds("0.0", "0.00"))).toBeInTheDocument();
    // The furthest stack is the question: its button waits for a stack the
    // reader has tipped, or for the reader asking.
    expect(screen.queryByRole("button", { name: E.overhang.play.furthest })).not.toBeInTheDocument();
    showAnswer();
    fireEvent.click(screen.getByRole("button", { name: E.overhang.play.furthest }));
    expect(screen.getByText(holds("28.3", "1.41"))).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: E.overhang.play.even }));
    expect(screen.getByText(holds("18.0", "0.90"))).toBeInTheDocument();
    expect(legends()).toHaveLength(8);
  });

  it("moves a block with the arrow keys and says when the stack tips", async () => {
    renderWithProviders(<OverhangPage />);
    const top = await screen.findByRole("slider", { name: E.overhang.play.block.replace("{{n}}", "1") });
    for (let i = 0; i < 9; i++) fireEvent.keyDown(top, { key: "ArrowRight", shiftKey: true });
    expect(screen.getByText(new RegExp(`^${E.overhang.play.holds.split("{{cm}}")[0]}9[.,]0 cm`))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: E.overhang.play.furthest })).not.toBeInTheDocument();
    fireEvent.keyDown(top, { key: "ArrowRight", shiftKey: true });
    fireEvent.keyDown(top, { key: "ArrowRight", shiftKey: true });
    expect(screen.getByText(E.overhang.play.tips_one)).toBeInTheDocument();
    // Tipped, the reader has found an edge of their own: now the furthest.
    expect(screen.getByRole("button", { name: E.overhang.play.furthest })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: E.frame.show })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: E.overhang.play.flush }));
    expect(screen.queryByText(E.overhang.play.tips_one)).not.toBeInTheDocument();
  });
});

describe("the Cartesian diver", () => {
  it("floats until squeezed, then sinks, pauses and goes back to the surface", async () => {
    // The frames on a fake clock, as the smoke ring's press: two seconds of
    // sinking in no real time, and no frames running behind the test under the
    // pre-push check's load. "Sinks" itself follows from the squeeze at once
    // (no lift at the surface); after the two seconds it is still sinking.
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });
    try {
      renderWithProviders(<DiverPage />);
      expect(await screen.findByRole("img", { name: E.diver.view })).toBeInTheDocument();
      expect(screen.getByText(E.diver.play.motion.floats)).toBeInTheDocument();
      setSlider(E.diver.play.squeeze, "20");
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });
      expect(screen.getByText(E.diver.play.motion.sinks)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: E.play.pause }));
      expect(screen.getByRole("button", { name: E.play.run })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: E.diver.play.surface }));
      expect(legends()).toHaveLength(8);
    } finally {
      vi.useRealTimers();
    }
  });

  it("names the squeeze that sinks it, 10.9 kPa, and more with more air", async () => {
    renderWithProviders(<DiverPage />);
    await screen.findByRole("img", { name: E.diver.view });
    expect(screen.getByText("10.9")).toBeInTheDocument();
    setSlider(E.diver.change.air, "2.2");
    expect(await screen.findByText("22.1")).toBeInTheDocument();
  });
});

describe("the glass-bead rainbow", () => {
  it("sends a ray through the bead, to the rainbow ray, across the way back and in colours", async () => {
    renderWithProviders(<RainbowPage />);
    expect(await screen.findByRole("img", { name: E.rainbow.bead_view })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: E.rainbow.wall_view })).toBeInTheDocument();
    // Halfway out on a glass bead the ray leaves at 4r - 2i = 16.8°, inside the ring at 21.1°.
    expect(
      screen.getByText(E.rainbow.play.inside.replace("{{angle}}", "16.8").replace("{{bow}}", "21.1")),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: E.rainbow.play.to_bow }));
    expect(screen.getByText(E.rainbow.play.at_bow)).toBeInTheDocument();
    setSlider(E.rainbow.play.impact, "99");
    expect(screen.getByText(new RegExp(`${E.rainbow.play.across.split("{{angle}}")[1]}$`))).toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch", { name: E.rainbow.play.split }));
    expect(screen.getByRole("switch", { name: E.rainbow.play.split })).toBeChecked();
    expect(legends()).toHaveLength(8);
  });

  it("says a crossing ray lands outside the ring once a dense bead's ring has shrunk inside it", async () => {
    renderWithProviders(<RainbowPage />);
    await screen.findByRole("img", { name: E.rainbow.bead_view });
    // At n = 1.9 the ring stands at 1.5°, and a ray 99 % out comes back across the way at some 20°.
    setSlider(E.rainbow.change.index, "1.9");
    setSlider(E.rainbow.play.impact, "99");
    const [, between, after] = E.rainbow.play.across_outside.split(/\{\{(?:angle|bow)\}\}/);
    expect(screen.getByText(new RegExp(`${between}[\\d.]+${after}$`))).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(`${E.rainbow.play.across.split("{{angle}}")[1]}$`))).not.toBeInTheDocument();
  });

  it("rings at 21.1° for glass and 42.1° for a water drop", async () => {
    renderWithProviders(<RainbowPage />);
    await screen.findByRole("img", { name: E.rainbow.bead_view });
    expect(screen.getAllByText("21.1").length).toBeGreaterThanOrEqual(2);
    const kind = screen.getByRole("radiogroup", { name: E.rainbow.change.kind });
    fireEvent.click(within(kind).getByRole("radio", { name: E.rainbow.change.kinds.water }));
    expect((await screen.findAllByText("42.1")).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("1.90")).toBeInTheDocument();
  });
});

describe("why the sky is blue", () => {
  it("shows the cloudy tube, its figures, and the sun through the air", async () => {
    renderWithProviders(<SkyPage />);
    expect(await screen.findByRole("img", { name: E.sky.tube_view })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: E.sky.sky_view })).toBeInTheDocument();
    // Blue scatters 4.4 times as strongly as red; half of it is gone after 21 cm, past 54 cm red wins.
    expect(screen.getByText("4.4")).toBeInTheDocument();
    expect(screen.getByText("21")).toBeInTheDocument();
    expect(screen.getByText("54")).toBeInTheDocument();
    setSlider(E.sky.air.height, "0");
    expect(await screen.findByText("37.9")).toBeInTheDocument();
    expect(legends()).toHaveLength(11);
  });

  it("marks where red wins only inside the tube, and cloudier water moves it towards the lamp", async () => {
    renderWithProviders(<SkyPage />);
    await screen.findByRole("img", { name: E.sky.tube_view });
    expect(screen.getByText(E.sky.play.red_mark)).toBeInTheDocument();
    // In a 40 cm tube the red never wins: it would, past 54 cm.
    setSlider(E.sky.change.length, "0.4");
    expect(screen.queryByText(E.sky.play.red_mark)).not.toBeInTheDocument();
    // At 3 per metre half the blue is gone after 10 cm, and red wins after 25 cm.
    setSlider(E.sky.play.cloudiness, "3");
    expect(await screen.findByText("10")).toBeInTheDocument();
    expect(screen.getByText(E.sky.play.red_mark)).toBeInTheDocument();
  });

  it("has the ozone take 39 % of the orange with the sun on the horizon, and nothing once it is off", async () => {
    renderWithProviders(<SkyPage />);
    await screen.findByRole("img", { name: E.sky.sky_view });
    setSlider(E.sky.air.height, "0");
    expect(await screen.findByText(E.sky.air.ozone_takes)).toBeInTheDocument();
    expect(screen.getByText("39")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch", { name: E.sky.air.ozone }));
    expect(screen.queryByText(E.sky.air.ozone_takes)).not.toBeInTheDocument();
    expect(screen.queryByText("39")).not.toBeInTheDocument();
  });

  it("moves the sun along its arc by mouse or finger, from the horizon to overhead", async () => {
    renderWithProviders(<SkyPage />);
    const sky = await screen.findByRole("img", { name: E.sky.sky_view });
    // The drawing's own units, 400 by 220, a pixel each.
    vi.spyOn(sky, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 400,
      height: 220,
      right: 400,
      bottom: 220,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    const sun = sky.querySelector("circle.cursor-grab")!;
    const height = () => sliderText(E.sky.air.height);
    fireEvent.pointerDown(sun, { pointerId: 1, clientX: 125, clientY: 48 });
    // 30° up from the horizon (y 178), seen from the arc's centre (x 200).
    fireEvent.pointerMove(sky, { pointerId: 1, clientX: 200 - 100, clientY: 178 - 100 * Math.tan(Math.PI / 6) });
    expect(height()).toMatch(/^30\b/);
    // Past the top it stays overhead.
    fireEvent.pointerMove(sky, { pointerId: 1, clientX: 260, clientY: 40 });
    expect(height()).toMatch(/^90\b/);
    fireEvent.pointerUp(sky, { pointerId: 1 });
  });
});

describe("the double slit", () => {
  it("lights the wall in stripes 5.2 mm apart, and covers a slit to leave a broad patch", async () => {
    renderWithProviders(<SlitsPage />);
    expect(await screen.findByRole("img", { name: E.slits.wall_view })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: E.slits.setup_view })).toBeInTheDocument();
    expect(screen.getByText(E.slits.play.status_both.replace("{{spacing}}", "5.2"))).toBeInTheDocument();
    expect(screen.getByText("97")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch", { name: E.slits.play.cover }));
    expect(screen.getByText(E.slits.play.status_one)).toBeInTheDocument();
    const light = screen.getByRole("radiogroup", { name: E.slits.play.light });
    fireEvent.click(within(light).getByRole("radio", { name: E.slits.play.lights.white }));
    expect(screen.queryByRole("slider", { name: E.slits.play.wavelength })).not.toBeInTheDocument();
    expect(legends()).toHaveLength(8);
  });

  it("widens the stripes with green light gone red and closes them with the slits further apart", async () => {
    renderWithProviders(<SlitsPage />);
    await screen.findByRole("img", { name: E.slits.wall_view });
    setSlider(E.slits.play.wavelength, "532");
    expect(await screen.findByText(E.slits.play.status_both.replace("{{spacing}}", "4.3"))).toBeInTheDocument();
    setSlider(E.slits.change.spacing, "0.5");
    expect(await screen.findByText(E.slits.play.status_both.replace("{{spacing}}", "2.1"))).toBeInTheDocument();
  });

  it("says when the wall is nearer than the far-field formula allows for slits this wide", async () => {
    renderWithProviders(<SlitsPage />);
    await screen.findByRole("img", { name: E.slits.wall_view });
    expect(screen.queryByText(/nearer than the formula allows/)).toBeNull();
    // The slider's widest, 0.2 mm, in red light: 35·a²/λ = 2.2 m, past the wall's 2 m.
    setSlider(E.slits.change.width, "0.2");
    expect(await screen.findByText(E.slits.play.near.replace("{{near}}", "2.2"))).toBeInTheDocument();
  });
});

describe("the beats", () => {
  it("waits, rings when struck, and has its sound muted with no Web Audio here", async () => {
    renderWithProviders(<BeatsPage />);
    expect(await screen.findByRole("img", { name: E.beats.view })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: E.beats.loudness_view })).toBeInTheDocument();
    expect(screen.getByText(E.beats.play.waiting)).toBeInTheDocument();
    expect(screen.getByText(E.play.no_sound)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: E.beats.play.strike }));
    expect(screen.queryByText(E.beats.play.waiting)).not.toBeInTheDocument();
    expect(legends()).toHaveLength(6);
  });

  it("beats 0.82 times a second with a gram a third up, and stops with the rider at the stem", async () => {
    renderWithProviders(<BeatsPage />);
    await screen.findByRole("img", { name: E.beats.view });
    expect(screen.getAllByText("0.82").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("1.22").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("23")).toBeInTheDocument();
    setSlider(E.beats.change.position, "0");
    expect((await screen.findAllByText("0.00")).length).toBeGreaterThanOrEqual(2);
  });
});
