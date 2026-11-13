/**
 * The experiments against a mocked engine whose answer is the real engine's
 * (`test-fixtures.json`, the API's answers to the defaults, written by
 * `scripts/write-test-fixtures.py` and held to the app by the backend's
 * `test_page_fixtures.py`): the overview offers the built exhibits and says what is coming and
 * whose exhibits they are; the chair page shows its three holes, its box and
 * the engine's numbers; and the projection the drawings rest on keeps the one
 * promise the exhibit makes — three objects, one picture. The race's balls are
 * where the engine's time tables put them, and on the cycloid valley all four
 * are at the bottom at the one time the engine names.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import en from "@/shared/i18n/locales/en.json";
import { mockApi } from "@/test/api-mock";
import { renderWithProviders } from "@/test/render";
import type { CannonFigures, ChairAnalysis, ElephantFigures, RaceAnalysis, SmokeFigures } from "@/shared/types";
import { ChairPage, autoView } from "./chair-page";
import { CoilPage } from "./coil-page";
import { Equation } from "./equation";
import { SpherePage, tempoFor } from "./sphere-page";
import { PlatformPage, autoPosture } from "./platform-page";
import { RacePage } from "./race-page";
import { ElephantPage } from "./elephant-page";
import { SmokePage } from "./smoke-page";
import { CannonPage } from "./cannon-page";
import { ballState, pitEntries, positionAt, raceLayout, swingAt } from "./race-views";
import { run as runPit } from "./simulate/pit";
import { HOLE, cameraAt, frameOf, project } from "./chair-views";
import { dailyExhibit, dailyHistory } from "./daily";
import { ExhibitPreview } from "./exhibit-preview";
import { EXHIBITS, exhibitAt, exhibitEntry } from "./exhibits";
import { ExperimentsLayout } from "./experiments-layout";
import { ExperimentsOverviewPage } from "./overview-page";
import { useTried } from "./tried";
import fixtures from "./test-fixtures.json";

const E = en.experiments;
const chair = fixtures.chair as unknown as ChairAnalysis;
const race = fixtures.race as unknown as RaceAnalysis;
const elephant = fixtures.elephant as unknown as ElephantFigures;
const smoke = fixtures.smoke as unknown as SmokeFigures;
const cannon = fixtures.cannon as unknown as CannonFigures;

beforeEach(() => {
  useTried.getState().forget();
  mockApi({
    "GET /experiments/chair": chair,
    "GET /experiments/defaults": fixtures.defaults,
    "POST /experiments/coil": fixtures.coil,
    "POST /experiments/sphere": fixtures.sphere,
    "POST /experiments/platform": fixtures.platform,
    "POST /experiments/race": race,
    "POST /experiments/elephant": elephant,
    "POST /experiments/smoke": smoke,
    "POST /experiments/cannon": cannon,
  });
});

describe("the overview", () => {
  // A day long after the epoch, in Zurich, so the history is a full week; only
  // the clock is faked, so the previews' frames and the queries run as ever.
  const DAY = "2027-02-03";
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(`${DAY}T11:00:00Z`));
  });
  afterEach(() => vi.useRealTimers());

  /** The overview, once every preview on it has arrived: each is a lazy
   *  module and a query or two, and one that lands after the test has read
   *  the page lands outside act(). */
  const renderOverview = async () => {
    const view = renderWithProviders(<ExperimentsOverviewPage />);
    await waitFor(() => expect(view.container.querySelector("[aria-busy='true']")).toBeNull());
    return view;
  };

  it("opens the built exhibit, says the others are coming and credits the museum", async () => {
    await renderOverview();
    expect(screen.getByRole("heading", { level: 3, name: E.exhibits.chair.title })).toBeInTheDocument();
    const opens = screen.getAllByRole("link", { name: new RegExp(E.overview.open) });
    expect(opens.map((link) => link.getAttribute("href"))).toEqual(EXHIBITS.flatMap((e) => (e.path ? [e.path] : [])));
    expect(screen.queryAllByText(E.overview.coming)).toHaveLength(EXHIBITS.filter((e) => !e.path).length);
    expect(screen.getByText(E.overview.credit)).toBeInTheDocument();
  });

  it("shows the day's exhibit with its question, and the days before it only when asked", async () => {
    const view = await renderOverview();
    const today = dailyExhibit(DAY);
    const daily = screen.getByRole("heading", { level: 2, name: E.exhibits[today].title });
    const card = daily.closest("div.min-w-0") as HTMLElement;
    expect(within(card).getByText(E.exhibits[today].question)).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: new RegExp(E.overview.daily.open) })).toHaveAttribute(
      "href",
      exhibitEntry(today).path,
    );
    // The page is the day's exhibit's; the days before it wait behind a button.
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(within(card).getByRole("button", { name: E.overview.history.open }));
    const dialog = await screen.findByRole("dialog", { name: E.overview.history.title });
    await waitFor(() => expect(view.container.ownerDocument.querySelector("[aria-busy='true']")).toBeNull());
    const days = within(dialog).getAllByRole("link");
    expect(days.map((link) => link.getAttribute("href"))).toEqual(
      dailyHistory(DAY, 14).map((pick) => exhibitEntry(pick.exhibit).path),
    );
    expect(days[0]).toHaveTextContent(E.exhibits[dailyHistory(DAY, 1)[0].exhibit].short);
  });

  it("filters the exhibits by what they are about, and shows them all again", async () => {
    await renderOverview();
    const cards = () => screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    fireEvent.click(screen.getByRole("button", { name: E.topics.flow }));
    expect(cards()).toEqual([E.exhibits.elephant.title, E.exhibits.smoke.title]);
    expect(screen.getByRole("button", { name: E.topics.flow })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: E.overview.all_topics }));
    expect(cards()).toHaveLength(EXHIBITS.length);
  });

  it("links a card to the course's lessons its computation stands on, and the chair to none", async () => {
    await renderOverview();
    const card = (exhibit: "cannon" | "chair") =>
      screen.getByRole("heading", { level: 3, name: E.exhibits[exhibit].title }).closest(".flex-col") as HTMLElement;
    expect(within(card("cannon")).getByRole("link", { name: E.computed.links.second_order })).toHaveAttribute(
      "href",
      "https://kurvenschmiede.app/dynamics/second-order",
    );
    expect(within(card("cannon")).getByRole("link", { name: E.computed.links.numerics })).toHaveAttribute(
      "href",
      "https://kurvenschmiede.app/dynamics/numerics",
    );
    expect(within(card("chair")).queryByText(E.overview.builds_on)).toBeNull();
  });

  it("ticks what was tried on this device, counts it, and forgets it when asked", async () => {
    useTried.getState().mark("cannon");
    await renderOverview();
    expect(screen.getByText(`1 of ${EXHIBITS.length}`)).toBeInTheDocument();
    expect(screen.getAllByText(E.overview.tried.mark).length).toBeGreaterThan(0);
    expect(JSON.parse(localStorage.getItem("staunlabor.experimentsTried") ?? "[]")).toEqual(["cannon"]);
    fireEvent.click(screen.getByRole("button", { name: E.overview.tried.forget }));
    expect(screen.getByText(`0 of ${EXHIBITS.length}`)).toBeInTheDocument();
    expect(screen.queryByText(E.overview.tried.mark)).toBeNull();
  });

  it("names an exhibit by its exact address only", () => {
    expect(exhibitAt("/chair/")?.exhibit).toBe("chair");
    expect(exhibitAt("/chair/more")).toBeUndefined();
  });
});

describe("trying an exhibit", () => {
  it("counts once the reader does something in its Try it, not when the page is only opened", async () => {
    renderWithProviders(<CannonPage />);
    const drop = await screen.findByRole("button", { name: E.cannon.play.drop });
    expect(useTried.getState().tried).toEqual([]);
    fireEvent.pointerDown(drop);
    expect(useTried.getState().tried).toEqual(["cannon"]);
  });
});

describe("a preview", () => {
  it("is the exhibit's own drawing, held still where motion cannot be asked about", async () => {
    renderWithProviders(<ExhibitPreview exhibit="cannon" />);
    expect(await screen.findByRole("img", { name: E.cannon.view })).toBeInTheDocument();
    // No controls: the page's buttons, sliders and switches stay on the page.
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it.each(EXHIBITS.map((entry) => entry.exhibit))("draws the %s", async (exhibit) => {
    const { container } = renderWithProviders(<ExhibitPreview exhibit={exhibit} />);
    await waitFor(() => expect(container.querySelector("[aria-busy='true']")).toBeNull());
    expect(container.querySelector("svg")).not.toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("the area", () => {
  it("has a strip with the overview and every built exhibit", () => {
    renderWithProviders(<ExperimentsLayout />, { initialEntries: ["/chair"] });
    const strip = screen.getByRole("navigation", { name: E.area });
    expect(within(strip).getByRole("link", { name: E.overview.short })).toBeInTheDocument();
    expect(within(strip).getByRole("link", { name: E.exhibits.chair.short })).toBeInTheDocument();
    expect(within(strip).getByRole("link", { name: E.exhibits.coil.short })).toBeInTheDocument();
    expect(within(strip).getByRole("link", { name: E.exhibits.sphere.short })).toBeInTheDocument();
    expect(within(strip).getByRole("link", { name: E.exhibits.platform.short })).toBeInTheDocument();
    expect(within(strip).getByRole("link", { name: E.exhibits.race.short })).toBeInTheDocument();
  });
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
    expect(screen.getByText(/6\.6°/)).toBeInTheDocument();
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

describe("an equation", () => {
  it("says what it means and what every symbol is", () => {
    renderWithProviders(
      <Equation
        tex="F = k\\, i"
        reads="The push the coil gives the car."
        symbols={[
          { tex: "F", meaning: "the push", unit: "N" },
          { tex: "i", meaning: "the current", unit: "A" },
        ]}
      />,
    );
    expect(screen.getByText("The push the coil gives the car.")).toBeInTheDocument();
    const legend = screen.getByLabelText(E.equation.symbols);
    expect(within(legend).getByText("the push")).toBeInTheDocument();
    expect(within(legend).getByText("(A)")).toBeInTheDocument();
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
    await waitFor(() => expect(screen.getAllByLabelText(E.equation.symbols).length).toBeGreaterThanOrEqual(9));
    expect(screen.getByText(E.coil.model.force)).toBeInTheDocument();
  });
});

describe("the sphere", () => {
  it("shows both views, who pushes, and the engine's orbits", async () => {
    renderWithProviders(<SpherePage />);
    expect(await screen.findByRole("img", { name: E.sphere.views.top })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: E.sphere.views.side })).toBeInTheDocument();
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
    expect(screen.getAllByLabelText(E.equation.symbols).length).toBeGreaterThanOrEqual(6);
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
    await waitFor(() => expect(screen.getAllByLabelText(E.equation.symbols).length).toBeGreaterThanOrEqual(6));
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
    // The ranking, in the order the balls arrive: the cycloid first, the
    // hump last.
    const table = screen.getByRole("table", { name: E.race.motion.table });
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
    expect(screen.getAllByRole("button", { name: E.race.play.pause })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: E.race.play.run })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: E.race.play.start }));
    expect(screen.getAllByRole("button", { name: E.race.play.pause })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: E.race.play.run })).not.toBeInTheDocument();
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
    expect(screen.getAllByLabelText(E.equation.symbols).length).toBeGreaterThanOrEqual(6);
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
    expect(screen.getByText(/How far the trunk can tilt: up to 44°/)).toBeInTheDocument();
    expect(screen.getByText(/from 12\.1 m\/s on/)).toBeInTheDocument();
    // Every equation with a letter in it explains them: all but the balance, which reuses the others'.
    await waitFor(() => expect(screen.getAllByLabelText(E.equation.symbols)).toHaveLength(7));
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
    // Every equation with a letter in it explains them.
    await waitFor(() => expect(screen.getAllByLabelText(E.equation.symbols)).toHaveLength(8));
  });

  it("says when no press can make a ring", async () => {
    mockApi({
      "GET /experiments/defaults": fixtures.defaults,
      "POST /experiments/smoke": { ...smoke, fastest_s: null, slowest_s: null, best_s: null, best: null },
    });
    renderWithProviders(<SmokePage />);
    expect(await screen.findByText(E.smoke.sweet.none)).toBeInTheDocument();
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
    // top ball of three climbs 2.2 times that, to 2.4 m — instantaneous hits one
    // after another would send it off at 10.9 m/s instead of 6.6.
    expect(await screen.findByText(/top ball of 3 climbs 2\.2 times that, to 2\.4 m/)).toBeInTheDocument();
    expect(
      screen.getByText(/leaves at 6\.6 m\/s\. With instantaneous hits one after another it would leave at 10\.9 m\/s/),
    ).toBeInTheDocument();
    // The contacts of the impact, with the force the floor pushes back with.
    expect(screen.getByRole("cell", { name: "Floor – 10 cm" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "1,239 N" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByLabelText(E.equation.symbols)).toHaveLength(5));
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
