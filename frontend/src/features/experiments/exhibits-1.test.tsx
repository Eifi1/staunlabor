/**
 * Each exhibit's page, the first part of the list (the chair to the Chladni
 * figures), against a mocked engine whose answer is the real engine's
 * (`src/test/experiments.ts`): what it draws, what its controls do, the
 * engine's numbers it shows and holds back, and how many equations it explains
 * (one legend each, counted exactly, so a lost legend fails). The chair's
 * projection keeps the one promise the exhibit makes, three objects, one
 * picture; the race's balls are where the engine's time tables put them.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import en from "@/shared/i18n/locales/en.json";
import { mockApi } from "@/test/api-mock";
import { E, legends, mockExperiments, setSlider, showAnswer, sliderText } from "@/test/experiments";
import { renderWithProviders } from "@/test/render";
import type { ChairAnalysis, ElephantFigures, RaceAnalysis, SmokeFigures } from "@/shared/types";
import { ChairPage, autoView } from "./chair-page";
import { CoilPage } from "./coil-page";
import { CoilTrack } from "./coil-track";
import { SpherePage, tempoFor } from "./sphere-page";
import { PlatformPage, autoPosture } from "./platform-page";
import { RacePage } from "./race-page";
import { ElephantPage } from "./elephant-page";
import { SmokePage } from "./smoke-page";
import { CannonPage } from "./cannon-page";
import { WavePage } from "./wave-page";
import { HarmonographPage, boardLength } from "./harmonograph-page";
import { ConePage, verdict } from "./cone-page";
import { ParabolaPage, wellFilled } from "./parabola-page";
import { CoupledPage, hangs } from "./coupled-page";
import { PegPage } from "./peg-page";
import { MaxwellPage } from "./maxwell-page";
import { ChaosPage } from "./chaos-page";
import { WaterwheelPage } from "./waterwheel-page";
import { FoucaultPage, knocked } from "./foucault-page";
import { CoriolisPage } from "./coriolis-page";
import { CradlePage } from "./cradle-page";
import { WellPage } from "./well-page";
import { ResonancePage } from "./resonance-page";
import { GyroscopePage } from "./gyroscope-page";
import { ArchPage } from "./arch-page";
import { ChladniPage } from "./chladni-page";
import { ballState, pitEntries, positionAt, raceLayout, swingAt } from "./race-views";
import { run as runPit } from "./simulate/pit";
import { HOLE, cameraAt, frameOf, project } from "./chair-views";
import { useTried } from "./tried";
import fixtures from "./test-fixtures.json";

const chair = fixtures.chair as unknown as ChairAnalysis;
const race = fixtures.race as unknown as RaceAnalysis;
const elephant = fixtures.elephant as unknown as ElephantFigures;
const smoke = fixtures.smoke as unknown as SmokeFigures;

beforeEach(() => {
  useTried.getState().forget();
  mockExperiments();
});

describe("the chair", () => {
  it("shows the three objects side by side, turned, and the engine's numbers", async () => {
    renderWithProviders(<ChairPage />);
    for (const kind of ["chair", "skewed", "scattered"] as const) {
      const name = E.chair.kinds[kind];
      expect(
        await screen.findByRole("img", { name: E.chair.views.view.replace("{{name}}", name) }),
      ).toBeInTheDocument();
    }
    // Turned at first, so three different things.
    expect(screen.getByText(E.chair.views.apart)).toBeInTheDocument();
    // The engine's tolerance, a fifth of a millimetre, and the second eye.
    expect(screen.getAllByText(/0\.16 mm/).length).toBeGreaterThan(0);
    // Also in the check of it, further down.
    expect(screen.getAllByText(/6\.6°/).length).toBeGreaterThan(0);
  });

  it("looks through the hole when asked, and the three are one chair", async () => {
    renderWithProviders(<ChairPage />);
    fireEvent.click(await screen.findByRole("button", { name: E.chair.views.align }));
    expect(screen.getByText(E.chair.views.aligned)).toBeInTheDocument();
  });

  it("turns once round in its auto mode, resting at the hole", () => {
    expect(autoView(1)).toEqual({ yaw: 0, pitch: 0 });
    expect(autoView(8).yaw).toBeCloseTo(180, 9);
    expect(autoView(8).pitch).toBeCloseTo(20, 9);
    expect(autoView(14)).toEqual({ yaw: 0, pitch: 0 });
  });
});

describe("the projection", () => {
  const ends = (kind: string) =>
    chair.boxes.find((b) => b.figure.kind === kind)!.figure.segments.flatMap((s) => [s.a, s.b]);

  it("puts the viewpoint in the hole at no turn and no tilt", () => {
    const at = cameraAt(0, 0).at;
    at.forEach((v, i) => expect(v).toBeCloseTo(HOLE[i], 12));
  });

  it("draws the three objects as one picture from the hole", () => {
    const camera = cameraAt(0, 0);
    const real = ends("chair").map((p) => project(p, camera)!);
    for (const kind of ["skewed", "scattered"]) {
      ends(kind).forEach((p, i) => {
        const [x, y] = project(p, camera)!;
        expect(x).toBeCloseTo(real[i][0], 12);
        expect(y).toBeCloseTo(real[i][1], 12);
      });
    }
  });

  it("parts them anywhere else", () => {
    const camera = cameraAt(30, 10);
    const real = ends("chair").map((p) => project(p, camera)!);
    const apart = (kind: string) =>
      Math.max(
        ...ends(kind).map((p, i) =>
          Math.hypot(project(p, camera)![0] - real[i][0], project(p, camera)![1] - real[i][1]),
        ),
      );
    expect(apart("scattered")).toBeGreaterThan(0.05);
    expect(apart("skewed")).toBeGreaterThan(0.05);
    expect(frameOf(chair.boxes[0])).toBeGreaterThan(0);
  });
});

describe("the coil", () => {
  it("shows the track, the meter, the two buttons and the engine's figures", async () => {
    renderWithProviders(<CoilPage />);
    expect(await screen.findByRole("img", { name: E.coil.track.label })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: E.coil.meter.label })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: E.coil.play.plus })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: E.coil.play.minus })).toBeInTheDocument();
    // The engine's time constant and the time between the buttons, 1.3 ms
    // against some 50: the coil is fast, the hand is slow.
    expect(await screen.findByText(/1\.3 ms/)).toBeInTheDocument();
    expect(screen.getAllByText(/\b5\d ms/).length).toBeGreaterThan(0);
  });

  it("says the aim above the track, and lights a flag the car has reached", async () => {
    renderWithProviders(<CoilPage />);
    expect(await screen.findByText(E.coil.play.aim)).toBeInTheDocument();
    // The auto mode's words no longer give the answer away.
    expect(E.coil.play.autopilot_hint).not.toMatch(/cm|centre|middle/);
    const { container } = renderWithProviders(
      <CoilTrack
        exhibit={fixtures.defaults.coil as never}
        x={0}
        press={0}
        reached={[true, false]}
        peak={{ height: 0.02, side: 1 }}
      />,
    );
    const flags = container.querySelectorAll("g.text-success, g.text-muted");
    expect([...flags].map((g) => g.getAttribute("class"))).toEqual(["text-success", "text-muted"]);
    // How high the car last came: a mark on the right ramp, 2 cm up.
    const mark = container.querySelector("g.text-brand circle");
    expect(Number(mark?.getAttribute("cx"))).toBeGreaterThan(0.1);
    expect(Number(mark?.getAttribute("cy"))).toBeCloseTo(-0.02, 9);
  });

  it("holds a button while it is pressed, and lets go", async () => {
    renderWithProviders(<CoilPage />);
    const plus = await screen.findByRole("button", { name: E.coil.play.plus });
    fireEvent.pointerDown(plus, { pointerId: 1 });
    expect(plus).toHaveAttribute("aria-pressed", "true");
    fireEvent.pointerUp(plus, { pointerId: 1 });
    expect(plus).toHaveAttribute("aria-pressed", "false");
    fireEvent.keyDown(plus, { key: " " });
    expect(plus).toHaveAttribute("aria-pressed", "true");
    fireEvent.keyUp(plus, { key: " " });
    expect(plus).toHaveAttribute("aria-pressed", "false");
  });

  it("hands the buttons to the rule when asked", async () => {
    renderWithProviders(<CoilPage />);
    // The auto mode is perfect timing, and says so.
    expect(E.coil.play.autopilot).toMatch(/perfect timing/);
    fireEvent.click(await screen.findByRole("switch", { name: E.coil.play.autopilot }));
    expect(screen.getByRole("button", { name: E.coil.play.plus })).toBeDisabled();
    expect(screen.getByRole("button", { name: E.coil.play.minus })).toBeDisabled();
  });

  it("explains every equation it shows", async () => {
    renderWithProviders(<CoilPage />);
    await screen.findByRole("img", { name: E.coil.track.label });
    // Six in what happens, three in the trick once its figures are in — each
    // with its symbols.
    await waitFor(() => expect(legends()).toHaveLength(14));
    expect(screen.getByText(E.coil.model.force)).toBeInTheDocument();
  });
});

describe("the sphere", () => {
  it("shows both views, who pushes, and the engine's orbits", async () => {
    renderWithProviders(<SpherePage />);
    expect(await screen.findByRole("img", { name: E.sphere.views.top })).toBeInTheDocument();
    // The side view names the equator as the goal: the question is how to get there.
    expect(
      within(screen.getByRole("img", { name: E.sphere.views.side })).getByText(E.sphere.views.goal),
    ).toBeInTheDocument();
    for (const mode of ["hand", "circle", "perfect"] as const) {
      expect(screen.getByRole("radio", { name: E.sphere.play.modes[mode] })).toBeInTheDocument();
    }
    // The lowest circle for the default sphere, the engine's 0.99 Hz.
    expect(screen.getAllByText(/0\.99/).length).toBeGreaterThan(0);
  });

  it("offers a tempo only to the steady circle, and explains every equation", async () => {
    renderWithProviders(<SpherePage />);
    await screen.findByRole("img", { name: E.sphere.views.top });
    expect(screen.queryByText(E.sphere.play.slowly)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: E.sphere.play.modes.circle }));
    expect(screen.getByText(E.sphere.play.slowly)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: E.sphere.play.modes.perfect }));
    expect(screen.getByText(E.sphere.play.hint_perfect)).toBeInTheDocument();
    expect(legends()).toHaveLength(15);
  });

  it("reads the tempo for a height off the engine's orbits", () => {
    const backbone = fixtures.sphere.backbone;
    expect(tempoFor(backbone, 0)).toBe(backbone[0].rate_hz);
    expect(tempoFor(backbone, 80)).toBeCloseTo(backbone[80].rate_hz, 12);
    const between = tempoFor(backbone, 80.5)!;
    expect(between).toBeGreaterThan(backbone[80].rate_hz);
    expect(between).toBeLessThan(backbone[81].rate_hz);
    expect(tempoFor(backbone, 89.5)).toBeNull();
  });
});

describe("the platform", () => {
  it("shows the visitor from above, the controls and the engine's spins", async () => {
    renderWithProviders(<PlatformPage />);
    expect(await screen.findByRole("img", { name: E.platform.view })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: E.platform.play.push })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: E.platform.play.auto })).toBeInTheDocument();
    // The engine's ratio for the default build: three times as fast upright.
    expect(await screen.findByText(/3\.2 times as fast/)).toBeInTheDocument();
    await waitFor(() => expect(legends()).toHaveLength(12));
  });

  it("leans out, stands up, holds and leans out again in its auto mode", () => {
    expect(autoPosture(1)).toEqual({ lean_m: 0.3 });
    expect(autoPosture(3.75).lean_m).toBeCloseTo(0.15, 12);
    expect(autoPosture(5)).toEqual({ lean_m: 0 });
    expect(autoPosture(7.5).lean_m).toBeCloseTo(0.15, 12);
    expect(autoPosture(9)).toEqual(autoPosture(1));
  });
});

describe("the race", () => {
  it("runs six tracks from one start, ranks the cycloid first and says by how much", async () => {
    renderWithProviders(<RacePage />);
    expect(await screen.findByRole("img", { name: E.race.play.view })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: E.race.play.start })).toBeInTheDocument();
    // Before a race, the table holds no place and no time: in finishing
    // order it would answer the page's question.
    const table = screen.getByRole("table", { name: E.race.motion.table });
    expect(table).not.toHaveTextContent("0.747");
    expect(within(table).getAllByRole("row")[1]).toHaveTextContent(E.race.curves.line);
    // Asked for, the ranking, in the order the balls arrive: the cycloid
    // first, the hump last.
    showAnswer();
    const ranked = within(table).getAllByRole("row").slice(1);
    expect(ranked).toHaveLength(6);
    expect(ranked[0]).toHaveTextContent(E.race.curves.cycloid);
    expect(ranked[0]).toHaveTextContent("0.747");
    expect(ranked[5]).toHaveTextContent(E.race.curves.hump);
    // The arrows, in their two coordinate systems.
    expect(screen.getByRole("img", { name: E.race.motion.velocity_label })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: E.race.motion.acceleration_label })).toBeInTheDocument();
    // The engine's times for the default build, and the cycloid's dip below
    // the finish.
    expect(screen.getByText(/takes 0\.982 s; the cycloid, longer, takes 0\.747 s/)).toBeInTheDocument();
    expect(screen.getByText(/5\.2 cm below the finish/)).toBeInTheDocument();
    expect(screen.getByText(/at 0\.803 s, but the cycloid beats it/)).toBeInTheDocument();
    // Every ball crosses the finish at the engine's one speed.
    expect(screen.getByText(/equally fast, 2\.65 m\/s/)).toBeInTheDocument();
    // The default build's cycloid dips, so its ball is thrown upwards.
    expect(screen.getByText(E.race.sweet.throw_up)).toBeInTheDocument();
    expect(screen.queryByText(E.race.sweet.throw_down)).not.toBeInTheDocument();
  });

  it("starts the race, beside the valley that is already swinging", async () => {
    renderWithProviders(<RacePage />);
    await screen.findByRole("img", { name: E.race.play.view });
    // The valley swings from the start; the race waits for its lever.
    expect(screen.getAllByRole("button", { name: E.play.pause })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: E.play.run })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: E.race.play.start }));
    expect(screen.getAllByRole("button", { name: E.play.pause })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: E.play.run })).not.toBeInTheDocument();
  });

  it("lets four balls go on the valley and the bowl, and names their times", async () => {
    renderWithProviders(<RacePage />);
    expect(await screen.findByRole("img", { name: E.race.valley.cycloid })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: E.race.valley.circle })).toBeInTheDocument();
    expect(screen.getByText(E.race.valley.to_bottom)).toBeInTheDocument();
    for (const start of race.valley.starts) {
      const height = String(Math.round(start.height_m * 100));
      expect(screen.getByText(E.race.valley.bowl_from.replace("{{height}}", height))).toBeInTheDocument();
    }
  });

  it("explains every equation it shows", async () => {
    renderWithProviders(<RacePage />);
    await screen.findByRole("img", { name: E.race.play.view });
    // Five in what happens, one in how it is computed.
    expect(legends()).toHaveLength(10);
    expect(screen.getByText(E.race.model.valley)).toBeInTheDocument();
  });

  it("puts a ball where its time table says, and at the finish once it has arrived", () => {
    const path = race.race.tracks.find((track) => track.kind === "cycloid")!.path;
    const last = path.t_s.length - 1;
    expect(positionAt(path, -1)).toEqual([path.x_m[0], path.y_m[0]]);
    expect(positionAt(path, path.t_s[80])).toEqual([path.x_m[80], path.y_m[80]]);
    const [x, y] = positionAt(path, (path.t_s[80] + path.t_s[81]) / 2);
    expect(x).toBeCloseTo((path.x_m[80] + path.x_m[81]) / 2, 12);
    expect(y).toBeCloseTo((path.y_m[80] + path.y_m[81]) / 2, 12);
    expect(positionAt(path, path.t_s[last] + 1)).toEqual([path.x_m[last], path.y_m[last]]);
  });

  it("throws each ball from the finish under g alone, into the pit, and reads it there off the pit's run", () => {
    const g = 9.80665;
    const pit = runPit(race.race.basin, race.race.ball_radius_m, race.race.inertia, pitEntries(race.race.tracks));
    // A ball that leaves its track between two of the pit's samples (the
    // first to arrive is sampled the moment it does).
    const k = race.race.tracks.findIndex((track, i) => pit.balls[i].start_s - track.time_s > 5e-4);
    const track = race.race.tracks[k];
    const inPit = pit.balls[k];
    const { motion, time_s: arrived } = track;
    const [vx, vy] = [motion.vx_m_s.at(-1)!, motion.vy_m_s.at(-1)!];
    // Off its track, before the pit's first sample: a throw, all of g down.
    const tau = (inPit.start_s - arrived) / 2;
    const flying = ballState(track, arrived + tau, inPit, pit.sample_s);
    expect(k).toBeGreaterThanOrEqual(0);
    expect(flying.at[0]).toBeCloseTo(1.2 + vx * tau, 12);
    expect(flying.at[1]).toBeCloseTo(-0.5 + vy * tau - (g * tau * tau) / 2, 12);
    expect(flying.a).toEqual([0, -g]);
    // On a sample, the sample; between two, between them.
    const at10 = ballState(track, inPit.start_s + 10 * pit.sample_s, inPit, pit.sample_s);
    expect(at10.at[0]).toBeCloseTo(inPit.x_m[10], 12);
    expect(at10.v[1]).toBeCloseTo(inPit.vy_m_s[10], 12);
    const half = ballState(track, inPit.start_s + 10.5 * pit.sample_s, inPit, pit.sample_s);
    expect(half.at[1]).toBeCloseTo((inPit.y_m[10] + inPit.y_m[11]) / 2, 12);
    // Once the pit's run is over, lying still where it ended.
    const end = inPit.x_m.length - 1;
    expect(ballState(track, pit.settled_s + 1, inPit, pit.sample_s)).toEqual({
      at: [inPit.x_m[end], inPit.y_m[end]],
      v: [0, 0],
      a: [0, 0],
    });
  });

  it("brings all six to rest together in the pit, below its rim, each touching another", () => {
    const { basin, ball_radius_m: r, inertia, tracks } = race.race;
    const pit = runPit(basin, r, inertia, pitEntries(tracks));
    expect(pit.still).toBe(true);
    const ends = pit.balls.map((b) => [b.x_m.at(-1)!, b.y_m.at(-1)!] as const);
    for (const [x, y] of ends) {
      expect(y).toBeLessThan(basin.rim_y_m);
      expect(x).toBeGreaterThan(basin.left_x_m);
      expect(x).toBeLessThan(basin.right_x_m);
      const nearest = Math.min(
        ...ends.filter(([ox, oy]) => ox !== x || oy !== y).map(([ox, oy]) => Math.hypot(ox - x, oy - y)),
      );
      expect(nearest).toBeLessThan(2.1 * r);
    }
  });

  it("reads each ball's velocity and acceleration on its track off the engine's table", () => {
    const cycloid = race.race.tracks.find((track) => track.kind === "cycloid")!;
    const { path, motion } = cycloid;
    const pit = runPit(race.race.basin, race.race.ball_radius_m, race.race.inertia, pitEntries(race.race.tracks));
    const inPit = pit.balls[race.race.tracks.indexOf(cycloid)];
    const state = ballState(cycloid, path.t_s[120], inPit, pit.sample_s);
    expect(state.v).toEqual([motion.vx_m_s[120], motion.vy_m_s[120]]);
    expect(state.a).toEqual([motion.ax_m_s2[120], motion.ay_m_s2[120]]);
    expect(state.at).toEqual(positionAt(path, path.t_s[120]));
    // Let go: no speed yet, and falling straight down the cycloid's cusp at g'.
    const start = ballState(cycloid, 0, inPit, pit.sample_s);
    expect(start.v).toEqual([0, 0]);
    expect(start.a[0]).toBeCloseTo(0, 12);
    expect(start.a[1]).toBeCloseTo(-9.80665 * race.race.gravity_share, 9);
  });

  it("draws the pit's walls as high as any ball rises in it", () => {
    const pit = runPit(race.race.basin, race.race.ball_radius_m, race.race.inertia, pitEntries(race.race.tracks));
    const layout = raceLayout(0.5, 1.2, race.race, pit);
    const highest = Math.max(...pit.balls.flatMap((b) => b.y_m));
    expect(layout.wallTop).toBeGreaterThanOrEqual(highest + race.race.ball_radius_m);
    expect(layout.wallTop).toBeGreaterThanOrEqual(race.race.basin.top_y_m);
    expect(layout.right).toBe(race.race.basin.right_x_m);
  });

  it("has every ball on the cycloid valley at the bottom together, and swinging on", () => {
    const { starts, tautochrone_s: to, radius_m: r } = race.valley;
    for (const start of starts) {
      const [x, y] = swingAt(start.cycloid, to);
      expect(x).toBeCloseTo(0, 6);
      expect(y).toBeCloseTo(-2 * r, 6);
      // Up the far side, as high as it began, then back where it was let go.
      const [far, high] = swingAt(start.cycloid, 2 * to);
      expect(far).toBeCloseTo(-start.cycloid.x_m[0], 6);
      expect(high).toBeCloseTo(start.cycloid.y_m[0], 6);
      expect(swingAt(start.cycloid, 4 * to)[0]).toBeCloseTo(start.cycloid.x_m[0], 6);
    }
    // On the bowl, the highest start is not yet at the bottom when the lowest
    // is: a wide swing is a slow one.
    const times = starts.map((start) => start.circle_time_s);
    expect(Math.max(...times) - Math.min(...times)).toBeGreaterThan(0.03);
  });
});

describe("the elephant", () => {
  it("shows the elephant, the air and the tilt, and the engine's float height, curves and tilt limit", async () => {
    renderWithProviders(<ElephantPage />);
    expect(await screen.findByRole("img", { name: E.elephant.view })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: E.elephant.play.auto })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: E.elephant.play.push_left })).toBeInTheDocument();
    // The engine's figures for the default build: 36 cm up, and a fall at 44°.
    expect(
      await screen.findByText(/floats where the push crosses its weight, 36 cm above the trunk/),
    ).toBeInTheDocument();
    expect(screen.getByText(/How far the trunk can tilt: up to 32°/)).toBeInTheDocument();
    expect(screen.getByText(/from 12\.1 m\/s on/)).toBeInTheDocument();
    // Every equation with a letter in it explains them: all but the balance, which reuses the others',
    // seven, and the three check cases'.
    await waitFor(() => expect(legends()).toHaveLength(10));
  });

  it("says a ball the air cannot lift does not float, and from what air speed it would", async () => {
    mockApi({
      "GET /experiments/defaults": fixtures.defaults,
      "POST /experiments/elephant": { ...elephant, float_height_m: null, tilt_limit_deg: null, lift_off_m_s: 16.4 },
    });
    renderWithProviders(<ElephantPage />);
    expect(await screen.findByText(/only from 16\.4 m\/s on/)).toBeInTheDocument();
    expect(screen.queryByText(/How far the trunk can tilt/)).toBeNull();
  });
});

describe("the smoke ring", () => {
  it("shows the drum, the press and the engine's window, best at about half a second", async () => {
    renderWithProviders(<SmokePage />);
    expect(await screen.findByRole("img", { name: E.smoke.view })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: E.smoke.play.press })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: E.smoke.play.auto })).toBeInTheDocument();
    expect(screen.getByText(E.smoke.play.verdict.none)).toBeInTheDocument();
    // The engine's window for a full press of the default drum: 0.21 to 1.3 s, best 0.5.
    expect(await screen.findByText(/between 0\.21 s and 1\.3 s, best at about 0\.5 s/)).toBeInTheDocument();
    // Every equation with a letter in it explains them: the page's eight and
    // its three check cases'.
    await waitFor(() => expect(legends()).toHaveLength(11));
  });

  it("makes the ring of a press on the drum it began on, though the stroke is lowered mid-press", async () => {
    // The page's frames on a fake clock: the half-second press ran on real
    // time, and under the pre-push check's load the verdict missed 3 s
    // (2026-11-19) and then 8 s (2026-11-21). Only the frames and their clock
    // are faked, so the queries run as ever.
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });
    try {
      renderWithProviders(<SmokePage />);
      fireEvent.click(await screen.findByRole("button", { name: E.smoke.play.press }));
      // Lowered under the depth already pressed: the ring is still the press's own.
      setSlider(E.smoke.change.stroke, "2");
      await act(async () => {
        vi.advanceTimersByTime(1500);
      });
      expect(screen.getByText(E.smoke.play.verdict.ring)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("says when no press can make a ring", async () => {
    mockApi({
      "GET /experiments/defaults": fixtures.defaults,
      "POST /experiments/smoke": { ...smoke, fastest_s: null, slowest_s: null, best_s: null, best: null },
    });
    renderWithProviders(<SmokePage />);
    expect(await screen.findByText(E.smoke.sweet.none)).toBeInTheDocument();
  });

  it("says that with a draught of a few cm/s every press slower than a jab makes a ring", async () => {
    // The engine's answer for a draught of 0.03 m/s: no slow end, the fast one at 0.21 s.
    mockApi({
      "GET /experiments/defaults": fixtures.defaults,
      "POST /experiments/smoke": { ...smoke, slowest_s: null, best_s: null, best: null, open_slow: true },
    });
    renderWithProviders(<SmokePage />);
    expect(await screen.findByText(/a full press makes a ring at any pace slower than 0\.21 s/)).toBeInTheDocument();
    expect(screen.queryByText(E.smoke.sweet.none)).toBeNull();
  });
});

describe("the ball cannon", () => {
  it("shows the stack on its wire, the drop and how high one, two and three balls send the top one", async () => {
    renderWithProviders(<CannonPage />);
    expect(await screen.findByRole("img", { name: E.cannon.view })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: E.cannon.climb_view })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: E.cannon.play.drop })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: E.cannon.play.auto })).toBeInTheDocument();
    // The engine's answer for the exhibit's stack from a metre: touching, the
    // top ball of three climbs 3.9 times that, to 4.0 m — instantaneous hits one
    // after another would send it off at 10.9 m/s instead of 8.9.
    expect(await screen.findByText(/top ball of 3 climbs 3\.9 times that, to 4\.0 m/)).toBeInTheDocument();
    expect(
      screen.getByText(/leaves at 8\.9 m\/s\. With instantaneous hits one after another it would leave at 10\.9 m\/s/),
    ).toBeInTheDocument();
    // The contacts of the impact, with the force the floor pushes back with.
    expect(screen.getByRole("cell", { name: "Floor – 10 cm" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "1,237 N" })).toBeInTheDocument();
    // The page's five equations and its four check cases'.
    await waitFor(() => expect(legends()).toHaveLength(9));
  });

  it("drops the stack in the browser when asked, and says what the top ball did", async () => {
    renderWithProviders(<CannonPage />);
    fireEvent.click(await screen.findByRole("button", { name: E.cannon.play.drop }));
    expect(await screen.findByText("Last drop: 3 balls from 1.00 m.")).toBeInTheDocument();
  });

  it("stacks fewer balls, and turns the stack over", async () => {
    renderWithProviders(<CannonPage />);
    fireEvent.click(await screen.findByRole("radio", { name: "2 balls" }));
    expect(screen.queryByText(E.cannon.change.ball_2)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: E.cannon.change.flip })).toBeEnabled();
    fireEvent.click(screen.getByRole("radio", { name: "1 ball" }));
    expect(screen.getByRole("button", { name: E.cannon.change.flip })).toBeDisabled();
  });
});

describe("the pendulum wave", () => {
  it("refuses a row that asks for pendulums shorter than 2 cm, in the play card and the trick", async () => {
    renderWithProviders(<WavePage />);
    await screen.findByRole("img", { name: E.wave.views.top });
    const set = (name: string, value: string) => setSlider(name, value);
    set(E.wave.change.count, "24");
    set(E.wave.change.cycle, "30");
    set(E.wave.change.swings, "80");
    set(E.wave.change.tuned, "40");
    expect(await screen.findAllByText(E.wave.refused)).toHaveLength(2);
    expect(screen.queryByText(en.common.loading)).not.toBeInTheDocument();
  });

  it("shows the row from above and from its end, the moments to jump to and the engine's lengths", async () => {
    renderWithProviders(<WavePage />);
    expect(await screen.findByRole("img", { name: E.wave.views.top })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: E.wave.views.side })).toBeInTheDocument();
    for (const k of ["2", "3", "4", "1"] as const) {
      expect(screen.getByRole("button", { name: E.wave.play.jumps[k] })).toBeInTheDocument();
    }
    // The default row's longest and shortest pendulum, the engine's 34 and 21 cm.
    expect(await screen.findByText("34.1")).toBeInTheDocument();
    expect(screen.getByText("21.0")).toBeInTheDocument();
    await waitFor(() => expect(legends()).toHaveLength(11));
  });

  it("stops the clock at half the cycle, where the row stands in two groups", async () => {
    renderWithProviders(<WavePage />);
    await screen.findByRole("img", { name: E.wave.views.top });
    fireEvent.click(screen.getByRole("button", { name: E.wave.play.jumps["2"] }));
    expect(screen.getByRole("button", { name: E.play.run })).toBeInTheDocument();
    // The row is at ±15°: the bobs' offsets from the bar take two values only,
    // one for the even swing counts and one for the odd.
    const offsets = new Set(
      [...screen.getByRole("img", { name: E.wave.views.top }).querySelectorAll("circle")].map((c) =>
        Math.sign(Number(c.getAttribute("cy"))),
      ),
    );
    expect(offsets).toEqual(new Set([1, -1]));
  });

  it("says how far a textbook row would come back skewed", async () => {
    renderWithProviders(<WavePage />);
    expect(await screen.findByText(/come back 22° skewed at 15°/)).toBeInTheDocument();
  });

  it("pulls the whole row aside by any ball, holding it there, and lets it go when let go", async () => {
    renderWithProviders(<WavePage />);
    const side = await screen.findByRole("img", { name: E.wave.views.side });
    const [x0, y0, w, h] = side.getAttribute("viewBox")!.split(" ").map(Number);
    // A pixel to the drawing's unit times a thousand, its top left at the box's.
    vi.spyOn(side, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: w * 1000,
      height: h * 1000,
      right: w * 1000,
      bottom: h * 1000,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    const bobs = side.querySelectorAll("circle.cursor-grab");
    expect(bobs.length).toBeGreaterThan(1);
    // 30° out from the bar, at a third of the drawing's depth.
    const depth = (h + y0) / 3;
    const across = depth * Math.tan(Math.PI / 6);
    fireEvent.pointerDown(bobs[bobs.length - 1], { pointerId: 1, clientX: -x0 * 1000, clientY: -y0 * 1000 });
    fireEvent.pointerMove(side, { pointerId: 1, clientX: (across - x0) * 1000, clientY: (depth - y0) * 1000 });
    const swing = () => sliderText(E.wave.play.amplitude);
    expect(swing()).toMatch(/^30\b/);
    expect(screen.getByRole("button", { name: E.play.run })).toBeInTheDocument();
    fireEvent.pointerUp(side, { pointerId: 1 });
    expect(await screen.findByRole("button", { name: E.play.pause })).toBeInTheDocument();
    expect(swing()).toMatch(/^30\b/);
  });
});

describe("the harmonograph", () => {
  it("shows the drawing, the pen's controls and the port's figures for the default build", async () => {
    renderWithProviders(<HarmonographPage />);
    expect(await screen.findByRole("img", { name: E.harmonograph.views.drawing })).toBeInTheDocument();
    for (const name of [E.harmonograph.play.finish, E.harmonograph.play.save, E.harmonograph.play.restart]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    // The default pair is 0.67 % off 2 : 3, and its figure turns once in 90 s.
    expect(screen.getByText("Near the ratio 2 : 3 (pen : board)")).toBeInTheDocument();
    expect(screen.getByText(/0\.67 % off 2 : 3: at first the figure turns once in 90 s/)).toBeInTheDocument();
    expect(legends()).toHaveLength(9);
  });

  it("draws to the end at once when asked, and says it is done", async () => {
    renderWithProviders(<HarmonographPage />);
    await screen.findByRole("img", { name: E.harmonograph.views.drawing });
    fireEvent.click(screen.getByRole("button", { name: E.harmonograph.play.finish }));
    expect(screen.getByRole("button", { name: E.harmonograph.play.finish })).toBeDisabled();
  });

  it("tunes the board's length to a ratio: a quarter of the length, twice the beat", () => {
    expect(boardLength(0.8, [1, 2], 0)).toBeCloseTo(0.2, 12);
    expect(boardLength(0.8, [1, 1], 0.01)).toBeCloseTo(0.8 / 1.01 ** 2, 12);
  });
});

describe("the double cone", () => {
  it("shows the cone from the side and the front, and says it rolls up these rails", async () => {
    renderWithProviders(<ConePage />);
    expect(await screen.findByRole("img", { name: E.cone.views.side })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: E.cone.views.front })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: E.cone.play.let_go })).toBeInTheDocument();
    // Which way it rolls is the question: the verdict waits for a roll, or
    // for the reader asking.
    expect(screen.queryByText(E.cone.play.verdict_up)).not.toBeInTheDocument();
    showAnswer();
    expect(screen.getByText(E.cone.play.verdict_up)).toBeInTheDocument();
    // The default rails rise 2.1 cm while the axis falls 1.9; up to 7.5° it rolls up.
    expect(screen.getByText(/rise by 2\.1 cm\. The cone's axis falls by 1\.9 cm/)).toBeInTheDocument();
    expect(screen.getByText(/Up to a slope of 7\.5° this cone rolls up/)).toBeInTheDocument();
    expect(legends()).toHaveLength(7);
  });

  it("turns round on steeper rails, and refuses rails the cone would fall through", async () => {
    renderWithProviders(<ConePage />);
    await screen.findByRole("img", { name: E.cone.views.side });
    const slope = screen.getByRole("slider", { name: E.cone.change.slope });
    fireEvent.change(slope, { target: { value: "10" } });
    await screen.findByRole("img", { name: E.cone.views.side });
    showAnswer();
    expect(await screen.findByText(E.cone.play.verdict_down)).toBeInTheDocument();
    const length = screen.getByRole("slider", { name: E.cone.change.length });
    fireEvent.change(length, { target: { value: "50" } });
    expect(await screen.findByText(E.cone.refused.fall_through)).toBeInTheDocument();
  });

  it("knows up from down from staying", () => {
    const ex = fixtures.defaults.cone;
    expect(verdict(ex)).toBe("up");
    expect(verdict({ ...ex, rails: { ...ex.rails, slope_deg: 10 } })).toBe("down");
    expect(verdict({ ...ex, rails: { ...ex.rails, slope_deg: 7.546280442894854 } })).toBe("stays");
  });
});

describe("the water parabola", () => {
  it("shows the vessel cut through and from above, the turntable and the port's rates", async () => {
    renderWithProviders(<ParabolaPage />);
    expect(await screen.findByRole("img", { name: E.parabola.views.side })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: E.parabola.views.top })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: E.parabola.play.frames.turning })).toBeInTheDocument();
    // The default vessel runs dry at 126 turns a minute and spills at 189.
    expect(screen.getByText("126")).toBeInTheDocument();
    expect(screen.getByText("189")).toBeInTheDocument();
    expect(screen.getByText(/the middle sinks by .* cm – and the rim rises by exactly as much/)).toBeInTheDocument();
    expect(legends()).toHaveLength(10);
  });

  it("refuses a vessel filled over its top", async () => {
    renderWithProviders(<ParabolaPage />);
    await screen.findByRole("img", { name: E.parabola.views.side });
    setSlider(E.parabola.change.fill, "35");
    // In the play card and in the trick, which has nothing to wait for.
    expect(await screen.findAllByText(E.parabola.refused)).toHaveLength(2);
    expect(screen.queryByText(en.common.loading)).not.toBeInTheDocument();
    expect(wellFilled({ radius_m: 0.15, height_m: 0.3, fill_m: 0.1 })).toBe(true);
  });
});

describe("the coupled pendulums", () => {
  it("shows the pair, the three ways to let go and the port's beat", async () => {
    renderWithProviders(<CoupledPage />);
    expect(await screen.findByRole("img", { name: E.coupled.view })).toBeInTheDocument();
    for (const how of ["one", "together", "against"] as const) {
      expect(screen.getByRole("button", { name: E.coupled.play.starts[how] })).toBeInTheDocument();
    }
    // The default pair: over and back in 22.9 s, all of it reaching the other.
    expect(screen.getByText(/wanders over and back once in 22\.9 s, and about 100 % of it/)).toBeInTheDocument();
    expect(legends()).toHaveLength(8);
  });

  it("refuses a spring fixed below the shorter bob", async () => {
    renderWithProviders(<CoupledPage />);
    await screen.findByRole("img", { name: E.coupled.view });
    setSlider(E.coupled.change.right_length, "30");
    setSlider(E.coupled.change.spring_at, "40");
    expect(await screen.findByText(E.coupled.refused)).toBeInTheDocument();
    expect(hangs(fixtures.defaults.coupled)).toBe(true);
  });
});

describe("Galileo's pendulum", () => {
  it("shows the pendulum and its peg, and says the bob rises as high as it fell from", async () => {
    renderWithProviders(<PegPage />);
    expect(await screen.findByRole("img", { name: E.peg.view })).toBeInTheDocument();
    expect(screen.queryByText(E.peg.play.outcome_same_height)).not.toBeInTheDocument();
    showAnswer();
    expect(screen.getByText(E.peg.play.outcome_same_height)).toBeInTheDocument();
    // Let go at 30° on a metre of string: 13.4 cm up; over the top would take 125 cm.
    expect(
      screen.getByText(/let go 13\.4 cm above the lowest point; going over would take 125\.0 cm/),
    ).toBeInTheDocument();
    expect(legends()).toHaveLength(9);
  });

  it("sets the three cases from the trick, and says what each does", async () => {
    renderWithProviders(<PegPage />);
    await screen.findByRole("img", { name: E.peg.view });
    // The answer shown at once: left to the swing, it comes out only after the
    // catch in real time, some 5 s a case, past findBy's 10 s under load
    // (the pre-push hook, 2026-11-21).
    showAnswer();
    fireEvent.click(screen.getByRole("button", { name: E.peg.sweet.cases.over_the_top }));
    expect(await screen.findByText(E.peg.play.outcome_over_the_top)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: E.peg.sweet.cases.slack }));
    expect(await screen.findByText(E.peg.play.outcome_slack)).toBeInTheDocument();
  });

  it("shows the answer by itself once the bob has swung back past the peg", async () => {
    // The swing on a fake clock, its frames and their time only: on real time
    // it took some 5 s, past findBy's 10 s under the pre-push check's load.
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });
    try {
      renderWithProviders(<PegPage />);
      await screen.findByRole("img", { name: E.peg.view });
      expect(screen.queryByText(E.peg.play.outcome_same_height)).not.toBeInTheDocument();
      await act(async () => {
        vi.advanceTimersByTime(6000);
      });
      expect(screen.getByText(E.peg.play.outcome_same_height)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("moves the peg and pulls the bob out by mouse or finger, keeping hold to the end of the drag", async () => {
    renderWithProviders(<PegPage />);
    const view = await screen.findByRole("img", { name: E.peg.view });
    // The drawing's metres a thousand pixels each, its top left at the box's.
    const [x0, y0, w, h] = view.getAttribute("viewBox")!.split(" ").map(Number);
    const box = { left: 0, top: 0, width: w * 1000, height: h * 1000, right: w * 1000, bottom: h * 1000, x: 0, y: 0 };
    vi.spyOn(view, "getBoundingClientRect").mockReturnValue({ ...box, toJSON: () => ({}) });
    const px = (x: number, y: number) => ({ clientX: (x - x0) * 1000, clientY: (y - y0) * 1000 });
    const depth = () => sliderText(E.peg.change.peg);
    // The peg, in several steps, from 50 cm to 70 cm: the hold lasts.
    const peg = view.querySelector("circle.cursor-ns-resize")!;
    fireEvent.pointerDown(peg, { pointerId: 1, ...px(0, 0.5) });
    for (const y of [0.55, 0.6, 0.65, 0.7]) fireEvent.pointerMove(view, { pointerId: 1, ...px(0, y) });
    fireEvent.pointerUp(view, { pointerId: 1 });
    await waitFor(() => expect(depth()).toMatch(/^70\b/));
    // The bob, out to 40°, then let go.
    const again = await screen.findByRole("img", { name: E.peg.view });
    vi.spyOn(again, "getBoundingClientRect").mockReturnValue({ ...box, toJSON: () => ({}) });
    const bob = again.querySelector("circle.cursor-grab")!;
    fireEvent.pointerDown(bob, { pointerId: 2, ...px(0.5, 0.87) });
    fireEvent.pointerMove(again, {
      pointerId: 2,
      ...px(Math.sin((40 * Math.PI) / 180), Math.cos((40 * Math.PI) / 180)),
    });
    fireEvent.pointerUp(again, { pointerId: 2 });
    await waitFor(() => expect(sliderText(E.peg.change.start)).toMatch(/^40\b/));
  });
});

describe("Maxwell's wheel", () => {
  it("shows the wheel on its strings, the pull and the port's bounce", async () => {
    renderWithProviders(<MaxwellPage />);
    expect(await screen.findByRole("img", { name: E.maxwell.view })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: E.maxwell.play.let_go })).toBeInTheDocument();
    // The default disc: 98.8 % in the spin, a 22 ms jerk at 6.3 times the weight.
    expect(screen.getByText(/98\.8 % here/)).toBeInTheDocument();
    expect(screen.getByText(/For 22 ms their pull rises to 30\.7 N, 6\.3 times the weight/)).toBeInTheDocument();
    expect(legends()).toHaveLength(9);
  });

  it("puts even more of the energy into the spin of a wheel with its mass in the rim", async () => {
    renderWithProviders(<MaxwellPage />);
    await screen.findByRole("img", { name: E.maxwell.view });
    fireEvent.click(screen.getByRole("radio", { name: E.maxwell.change.shapes.ring }));
    expect(await screen.findByText(/99\.4 % here/)).toBeInTheDocument();
  });
});

describe("the chaotic pendulum", () => {
  it("shows the pendulum and its twin, the starts and the measured exponent", async () => {
    renderWithProviders(<ChaosPage />);
    expect(await screen.findByRole("img", { name: E.chaos.view })).toBeInTheDocument();
    for (const name of ["gentle", "wild", "headstand"] as const) {
      expect(screen.getByRole("button", { name: E.chaos.play.presets[name] })).toBeInTheDocument();
    }
    // Wild, the exponent is measured and the gap doubles in a fraction of a second.
    // The measure waits for a 300 ms pause (useDebounce): on a fake clock, as
    // the gentle start's below. Away to gentle and back clears the load's own
    // wait, armed on the real clock, and arms the wild one on the fake.
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "requestAnimationFrame", "cancelAnimationFrame", "performance"],
      shouldClearNativeTimers: true,
    });
    try {
      fireEvent.click(screen.getByRole("button", { name: E.chaos.play.presets.gentle }));
      fireEvent.click(screen.getByRole("button", { name: E.chaos.play.presets.wild }));
      await act(async () => {
        vi.advanceTimersByTime(300);
      });
      expect(
        screen.getByText(
          /Measured for this start over half a minute: λ ≈ \d\.\d a second – a single stretch of path, so a few tenths more or less\. A difference thus doubles about every \d\.\d\d s/,
        ),
      ).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
    expect(legends()).toHaveLength(7);
  }, 15000);

  it("calls a gentle start predictable", async () => {
    renderWithProviders(<ChaosPage />);
    await screen.findByRole("img", { name: E.chaos.view });
    // The measure waits for a 300 ms pause in the start (useDebounce) and then
    // runs at once: on a fake clock from here, with the frames, so neither the
    // wait nor the swing behind it takes real time under the pre-push check's
    // load. The load's own debounce, armed on the real clock, is cleared by the
    // click (`shouldClearNativeTimers`) rather than landing outside act().
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "requestAnimationFrame", "cancelAnimationFrame", "performance"],
      shouldClearNativeTimers: true,
    });
    try {
      fireEvent.click(screen.getByRole("button", { name: E.chaos.play.presets.gentle }));
      await act(async () => {
        vi.advanceTimersByTime(300);
      });
      expect(screen.getByText(/practically zero/)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  }, 15000);
});

describe("the chaotic waterwheel", () => {
  it("shows the wheel and the butterfly, the tap and the wheel's reversals", async () => {
    renderWithProviders(<WaterwheelPage />);
    expect(await screen.findByRole("img", { name: E.waterwheel.views.wheel })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: E.waterwheel.views.butterfly })).toBeInTheDocument();
    expect(screen.getByText(E.waterwheel.play.regime_chaotic)).toBeInTheDocument();
    expect(await screen.findByText(/In 200 seconds the wheel here turns back \d+ times/)).toBeInTheDocument();
    expect(legends()).toHaveLength(8);
  });

  it("stands still with too little water, and turns steadily with some more", async () => {
    renderWithProviders(<WaterwheelPage />);
    await screen.findByRole("img", { name: E.waterwheel.views.wheel });
    setSlider(E.waterwheel.play.tap, "0.5");
    expect(await screen.findByText(E.waterwheel.play.regime_still)).toBeInTheDocument();
    setSlider(E.waterwheel.play.tap, "10");
    expect(await screen.findByText(E.waterwheel.play.regime_steady)).toBeInTheDocument();
  });

  it("opens the tap by its lever and brakes by the knob on the axle, the wheel starting anew when let go", async () => {
    renderWithProviders(<WaterwheelPage />);
    // The wheel is drawn anew for each new tap and brake: a hundred pixels to
    // the drawing's unit, its top left at the box's, each time.
    const drawing = async () => {
      const view = await screen.findByRole("img", { name: E.waterwheel.views.wheel });
      vi.spyOn(view, "getBoundingClientRect").mockReturnValue({
        left: 0,
        top: 0,
        width: 290,
        height: 300,
        right: 290,
        bottom: 300,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });
      const [knob, lever] = view.querySelectorAll("circle.cursor-grab");
      return { view, knob, lever };
    };
    const tap = () => screen.getByRole("slider", { name: E.waterwheel.play.tap });
    const brake = () => screen.getByRole("slider", { name: E.waterwheel.play.brake });
    // The lever straight across, level with its pivot at (0.14, −1.49): the tap full open.
    let { view, knob } = await drawing();
    const { lever } = await drawing();
    fireEvent.pointerDown(lever, { pointerId: 1, clientX: 159, clientY: 30 });
    fireEvent.pointerMove(view, { pointerId: 1, clientX: 189, clientY: 6 });
    expect(tap().getAttribute("aria-valuetext")).toMatch(/^40\b/);
    fireEvent.pointerUp(view, { pointerId: 1 });
    await waitFor(() => expect(tap().getAttribute("aria-valuetext")).toMatch(/^40\b/));
    // The knob straight below the axle, at (0, 0.3): halfway, σ = 12.
    ({ view, knob } = await drawing());
    fireEvent.pointerDown(knob, { pointerId: 2, clientX: 170, clientY: 185 });
    fireEvent.pointerMove(view, { pointerId: 2, clientX: 145, clientY: 185 });
    fireEvent.pointerUp(view, { pointerId: 2 });
    await waitFor(() => expect(brake().getAttribute("aria-valuetext")).toMatch(/^12\b/));
  });
});

describe("Foucault's pendulum", () => {
  it("shows the pendulum from above, the places and Winterthur's turn", async () => {
    renderWithProviders(<FoucaultPage />);
    expect(await screen.findByRole("img", { name: E.foucault.view })).toBeInTheDocument();
    for (const place of ["winterthur", "pole", "equator", "sydney"] as const) {
      expect(screen.getByRole("button", { name: E.foucault.play.places[place] })).toBeInTheDocument();
    }
    // The full turn is the question: it waits for an hour under the pendulum,
    // or for the reader asking.
    expect(screen.queryByText("Turning right round takes 32.5 hours here.")).not.toBeInTheDocument();
    showAnswer();
    expect(screen.getByText("Turning right round takes 32.5 hours here.")).toBeInTheDocument();
    expect(legends()).toHaveLength(7);
  });

  it("does not turn at the equator", async () => {
    renderWithProviders(<FoucaultPage />);
    await screen.findByRole("img", { name: E.foucault.view });
    fireEvent.click(screen.getByRole("button", { name: E.foucault.play.places.equator }));
    await screen.findByRole("img", { name: E.foucault.view });
    showAnswer();
    expect(await screen.findByText(E.foucault.play.never)).toBeInTheDocument();
  });

  it("knocks a pin over once either end of the plane reaches it", () => {
    // Clockwise in the north: the plane's angle falls.
    expect(knocked(350, -5)).toBe(false);
    expect(knocked(350, -12)).toBe(true);
    expect(knocked(170, -12)).toBe(true);
    expect(knocked(10, -12)).toBe(false);
    expect(knocked(10, 12)).toBe(true);
  });
});

describe("the Coriolis carousel", () => {
  it("shows the carousel, both views and the lead a throw needs", async () => {
    renderWithProviders(<CoriolisPage />);
    expect(await screen.findByRole("img", { name: E.coriolis.view })).toBeInTheDocument();
    // The other seat is ringed and named in the drawing: what the throw is for.
    expect(within(screen.getByRole("img", { name: E.coriolis.view })).getByText(E.coriolis.target)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: E.coriolis.play.frames.outside })).toBeInTheDocument();
    // The aim that hits, and the button that sets it, wait for a throw with
    // an aim of the reader's own.
    expect(screen.queryByText("Aiming 50.4° ahead hits it.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: E.coriolis.play.aim_lead })).not.toBeInTheDocument();
    setSlider(E.coriolis.play.aim, "20");
    fireEvent.click(screen.getByRole("button", { name: E.coriolis.play.throw }));
    expect(screen.getByText("Aiming 50.4° ahead hits it.")).toBeInTheDocument();
    expect(legends()).toHaveLength(7);
  });

  it("aims ahead when asked, and then misses by nothing", async () => {
    renderWithProviders(<CoriolisPage />);
    await screen.findByRole("img", { name: E.coriolis.view });
    showAnswer();
    fireEvent.click(screen.getByRole("button", { name: E.coriolis.play.aim_lead }));
    expect((await screen.findAllByDisplayValue("50.4")).length).toBeGreaterThan(0);
  });

  // The carousel's drawing at a hundred pixels to the metre: 4.6 m across,
  // the platform's centre at (230, 230), y up as the platform's.
  const carousel = async () => {
    const view = await screen.findByRole("img", { name: E.coriolis.view });
    vi.spyOn(view, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 460,
      height: 460,
      right: 460,
      bottom: 460,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    return view;
  };
  const px = (x: number, y: number) => ({ clientX: 230 + 100 * x, clientY: 230 - 100 * y });

  it("throws like a sling: pulled back from the seat, the other way, as fast as the pull is long", async () => {
    renderWithProviders(<CoriolisPage />);
    const view = await carousel();
    const seat = [...view.querySelectorAll("circle.cursor-grab")].at(-1)!;
    // From the seat at (2, 0) back to (2.9, −0.5): 29° to the right of straight
    // across, a pull of 1.03 m, 4.6 m/s of the 8 at 1.8 m.
    fireEvent.pointerDown(seat, { pointerId: 1, ...px(2, 0) });
    fireEvent.pointerMove(view, { pointerId: 1, ...px(2.9, -0.5) });
    expect(sliderText(E.coriolis.play.aim)).toMatch(/^−?-?29/);
    expect(sliderText(E.coriolis.play.speed)).toMatch(/^4\.6/);
    fireEvent.pointerUp(view, { pointerId: 1 });
    expect(await screen.findByRole("button", { name: E.coriolis.play.aim_lead })).toBeInTheDocument();
  });

  it("turns on as fast as its rim was pushed round when let go", async () => {
    renderWithProviders(<CoriolisPage />);
    const view = await carousel();
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const rim = view.querySelector('circle[stroke="transparent"]')!;
    const at = (deg: number) => px(2 * Math.cos((deg * Math.PI) / 180), 2 * Math.sin((deg * Math.PI) / 180));
    fireEvent.pointerDown(rim, { pointerId: 1, ...at(90) });
    // Two degrees every 50 ms, anticlockwise: 40°/s, 6.7 rpm.
    for (let k = 1; k <= 10; k++) {
      now = 50 * k;
      fireEvent.pointerMove(view, { pointerId: 1, ...at(90 + 2 * k) });
    }
    fireEvent.pointerUp(view, { pointerId: 1 });
    await waitFor(() => expect(sliderText(E.coriolis.play.rpm)).toMatch(/^6\.5/));
  });
});

describe("Newton's cradle", () => {
  it("shows the row, the balls one may lift and where the first collision sends the energy", async () => {
    renderWithProviders(<CradlePage />);
    expect(await screen.findByRole("img", { name: E.cradle.view })).toBeInTheDocument();
    for (const n of ["1", "2", "3", "4"]) expect(screen.getByRole("radio", { name: n })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "5" })).not.toBeInTheDocument();
    // What leaves the other end waits for the balls to be let go, or for the
    // reader asking.
    expect(screen.queryByText(/0\.09 · 0\.59 m\/s$/)).not.toBeInTheDocument();
    showAnswer();
    expect(await screen.findByText(/0\.09 · 0\.59 m\/s$/)).toBeInTheDocument();
    expect(legends()).toHaveLength(8);
  });

  it("with a hair's gap sends the last ball off with nearly all of it", async () => {
    renderWithProviders(<CradlePage />);
    await screen.findByRole("img", { name: E.cradle.view });
    fireEvent.click(screen.getByRole("radio", { name: E.cradle.play.spacings.gap }));
    showAnswer();
    expect(await screen.findByText(/0\.01 · 0\.01 · 0\.01 · 0\.01 · 0\.59 m\/s$/)).toBeInTheDocument();
  });

  it("lifts the left balls by mouse or finger, and lets them go when let go", async () => {
    renderWithProviders(<CradlePage />);
    const view = await screen.findByRole("img", { name: E.cradle.view });
    // A millimetre of the drawing a pixel, its top left at the box's.
    const [x0, y0, w, h] = view.getAttribute("viewBox")!.split(" ").map(Number);
    vi.spyOn(view, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: w,
      height: h,
      right: w,
      bottom: h,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    // The second ball taken lifts two; pulled to the far left, high up, they
    // stop at the slider's 60°.
    fireEvent.pointerDown(view.querySelectorAll("circle")[1], { pointerId: 1, clientX: w / 2, clientY: h / 2 });
    fireEvent.pointerMove(view, { pointerId: 1, clientX: 0, clientY: 40 - y0 });
    expect(screen.getByRole("radio", { name: "2" })).toBeChecked();
    expect(sliderText(E.cradle.play.angle)).toMatch(/^60\b/);
    expect(screen.queryByRole("button", { name: E.play.pause })).toBeNull();
    fireEvent.pointerUp(view, { pointerId: 1 });
    expect(await screen.findByRole("button", { name: E.play.pause })).toBeInTheDocument();
    expect(x0).toBeLessThan(0);
  });

  it("lets go when asked, and can be paused", async () => {
    renderWithProviders(<CradlePage />);
    await screen.findByRole("img", { name: E.cradle.view });
    fireEvent.click(screen.getByRole("button", { name: E.cradle.play.let_go }));
    expect(await screen.findByRole("button", { name: E.play.pause })).toBeInTheDocument();
  });
});

describe("the gravity well", () => {
  it("shows the funnel from above and from the side, ready on the circle", async () => {
    renderWithProviders(<WellPage />);
    expect(await screen.findByRole("img", { name: E.well.view_top })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: E.well.view_side })).toBeInTheDocument();
    // The circle at the start: the speed that keeps it there without friction.
    expect((await screen.findAllByDisplayValue("0.44")).length).toBeGreaterThan(0);
    expect(legends()).toHaveLength(8);
  });

  it("pushes off when asked, and can be paused", async () => {
    renderWithProviders(<WellPage />);
    await screen.findByRole("img", { name: E.well.view_top });
    fireEvent.click(screen.getByRole("button", { name: E.well.play.launch }));
    expect(await screen.findByRole("button", { name: E.play.pause })).toBeInTheDocument();
  });
});

describe("the resonance rods", () => {
  it("starts the beat low, and holds the rods' frequencies back until the answer is asked for", async () => {
    renderWithProviders(<ResonancePage />);
    expect(await screen.findByRole("img", { name: E.resonance.view })).toBeInTheDocument();
    // Off every rod's beat: in step with one, "Find the beat" would be found already.
    expect((await screen.findAllByDisplayValue("1")).length).toBeGreaterThan(0);
    expect(screen.queryByText("2.09 Hz")).toBeNull();
    showAnswer();
    for (const hz of ["1.27 Hz", "2.09 Hz", "5.58 Hz"]) expect(screen.getByText(hz)).toBeInTheDocument();
    // No Web Audio in the test runner: the switch is off, and says why it cannot turn on.
    expect(screen.getByRole("switch", { name: E.play.sound })).not.toBeChecked();
    expect(screen.getByText(E.play.no_sound)).toBeInTheDocument();
    expect(legends()).toHaveLength(8);
  });

  it("shakes when asked, and sweeps from 1 Hz with the frequencies out", async () => {
    renderWithProviders(<ResonancePage />);
    await screen.findByRole("img", { name: E.resonance.view });
    fireEvent.click(screen.getByRole("button", { name: E.resonance.play.shake }));
    expect(await screen.findByRole("button", { name: E.resonance.play.stop })).toBeInTheDocument();
    setSlider(E.resonance.play.beat, "3");
    expect(screen.queryByText("2.09 Hz")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: E.resonance.play.sweep }));
    // The beat drops to the sweep's start and climbs from there; the sweep is
    // a search, so the frequencies and the curves are out.
    expect((await screen.findAllByDisplayValue(/^1\.0\d$/)).length).toBeGreaterThan(0);
    expect(screen.getByText("2.09 Hz")).toBeInTheDocument();
  });
});

describe("the gyroscope wheel", () => {
  it("shows the wheel on its string, its round in 8.1 s and the suitcase's 5.9 N·m", async () => {
    renderWithProviders(<GyroscopePage />);
    expect(await screen.findByRole("img", { name: E.gyroscope.view })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: E.gyroscope.trace })).toBeInTheDocument();
    expect(screen.getByText("8.1")).toBeInTheDocument();
    expect(screen.getByText("5.9")).toBeInTheDocument();
    expect(legends()).toHaveLength(8);
  });

  it("lets go when asked, and can be paused", async () => {
    renderWithProviders(<GyroscopePage />);
    await screen.findByRole("img", { name: E.gyroscope.view });
    fireEvent.click(screen.getByRole("button", { name: E.gyroscope.play.let_go }));
    expect(await screen.findByRole("button", { name: E.play.pause })).toBeInTheDocument();
  });

  it("lets a wheel too slow to circle at its tilt go from rest, and says so, where it once broke the site", async () => {
    renderWithProviders(<GyroscopePage />);
    await screen.findByRole("img", { name: E.gyroscope.view });
    fireEvent.click(screen.getByRole("radio", { name: E.gyroscope.play.starts.steady }));
    setSlider(E.gyroscope.play.rpm, "20");
    setSlider(E.gyroscope.play.tilt, "70");
    expect(await screen.findByText(E.gyroscope.play.no_steady)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: E.gyroscope.play.let_go }));
    expect(await screen.findByRole("button", { name: E.play.pause })).toBeInTheDocument();
    setSlider(E.gyroscope.play.rpm, "200");
    expect(screen.queryByText(E.gyroscope.play.no_steady)).not.toBeInTheDocument();
  });
});

describe("the chain and the arch", () => {
  it("shows the semicircle standing with its thrust line, and the three shapes", async () => {
    renderWithProviders(<ArchPage />);
    expect(await screen.findByRole("img", { name: E.arch.view })).toBeInTheDocument();
    expect(await screen.findByText(E.arch.play.stands)).toBeInTheDocument();
    for (const shape of ["semicircle", "pointed", "catenary"] as const)
      expect(screen.getByRole("radio", { name: E.arch.play.shapes[shape] })).toBeInTheDocument();
    expect(legends()).toHaveLength(6);
  });

  it("breaks when the stones are made too thin, and stands again as the chain's arch", async () => {
    renderWithProviders(<ArchPage />);
    await screen.findByRole("img", { name: E.arch.view });
    setSlider(E.arch.play.thickness, "8");
    expect(await screen.findByText(E.arch.play.falls)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: E.arch.play.shapes.catenary }));
    expect(await screen.findByText(E.arch.play.stands)).toBeInTheDocument();
  });
});

describe("the Chladni figures", () => {
  it("shows the plate, its first tones at 102, 269 and 517 Hz, and the sound off", async () => {
    renderWithProviders(<ChladniPage />);
    expect(await screen.findByRole("img", { name: E.chladni.view })).toBeInTheDocument();
    for (const hz of ["102 Hz", "269 Hz", "517 Hz"])
      expect(screen.getByRole("button", { name: hz })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: E.play.sound })).not.toBeChecked();
    expect(legends()).toHaveLength(7);
  });

  it("rings at a tone when it is chosen", async () => {
    renderWithProviders(<ChladniPage />);
    await screen.findByRole("img", { name: E.chladni.view });
    fireEvent.click(screen.getByRole("button", { name: "517 Hz" }));
    expect((await screen.findAllByDisplayValue("517")).length).toBeGreaterThan(0);
  });
});
