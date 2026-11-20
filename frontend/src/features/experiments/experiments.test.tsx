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
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import en from "@/shared/i18n/locales/en.json";
import { mockApi } from "@/test/api-mock";
import { renderWithProviders } from "@/test/render";
import type {
  CannonFigures,
  ChairAnalysis,
  ElephantFigures,
  RaceAnalysis,
  SmokeFigures,
  WaveFigures,
} from "@/shared/types";
import { ChairPage, autoView } from "./chair-page";
import { CoilPage } from "./coil-page";
import { CoilTrack } from "./coil-track";
import { Equation } from "./equation";
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
import { ChladniPage } from "./chladni-page";
import { ballState, pitEntries, positionAt, raceLayout, swingAt } from "./race-views";
import { run as runPit } from "./simulate/pit";
import { HOLE, cameraAt, frameOf, project } from "./chair-views";
import { weeklyExhibit } from "./weekly";
import { ExhibitPreview } from "./exhibit-preview";
import { EXHIBITS, exhibitEntry } from "./exhibits";
import { EQUATION_COUNT } from "./facts";
import { ExperimentsLayout } from "./experiments-layout";
import { ExperimentsOverviewPage } from "./overview-page";
import { ExhibitsPage } from "./exhibits-page";
import { AppRoutes } from "@/app/routes";
import { settled } from "@/test/settle";
import { useTried } from "./tried";
import fixtures from "./test-fixtures.json";

const E = en.experiments;

/** Asks a play card for the answer it holds back until the exhibit is tried
 *  (`held.tsx`). */
const showAnswer = () => fireEvent.click(screen.getByRole("button", { name: E.frame.show }));
const chair = fixtures.chair as unknown as ChairAnalysis;
const race = fixtures.race as unknown as RaceAnalysis;
const elephant = fixtures.elephant as unknown as ElephantFigures;
const smoke = fixtures.smoke as unknown as SmokeFigures;
const cannon = fixtures.cannon as unknown as CannonFigures;
const wave = fixtures.wave as unknown as WaveFigures;

/** No exhibit checked yet: what the server answers until an admin checks one. */
const UNCHECKED = { with_cases: ["chair", "coil", "cradle", "sphere", "waterwheel", "wave"], checked: [] };

beforeEach(() => {
  useTried.getState().forget();
  mockApi({
    "GET /experiments/checks": UNCHECKED,
    "GET /experiments/chair": chair,
    "GET /experiments/chladni": fixtures.chladni,
    "GET /experiments/defaults": fixtures.defaults,
    "POST /experiments/coil": fixtures.coil,
    "POST /experiments/sphere": fixtures.sphere,
    "POST /experiments/platform": fixtures.platform,
    "POST /experiments/race": race,
    "POST /experiments/elephant": elephant,
    "POST /experiments/smoke": smoke,
    "POST /experiments/cannon": cannon,
    "POST /experiments/wave": wave,
  });
});

describe("the overview", () => {
  // A Wednesday long after the epoch, in Zurich; only the clock is faked, so
  // the previews' frames and the queries run as ever.
  const DAY = "2027-04-07";
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

  /** The page of every exhibit, likewise once its previews are in. */
  const renderList = async () => {
    const view = renderWithProviders(<ExhibitsPage />, { initialEntries: ["/exhibits"] });
    await waitFor(() => expect(view.container.querySelector("[aria-busy='true']")).toBeNull());
    return view;
  };

  it("opens the built exhibit, says the others are coming and credits the museum", async () => {
    await renderList();
    expect(screen.getByRole("heading", { level: 3, name: E.exhibits.chair.title })).toBeInTheDocument();
    // The whole card opens its exhibit, through its title: no button per card.
    const list = within(document.body);
    const opens = list
      .getAllByRole("heading", { level: 3 })
      .flatMap((heading) => within(heading).queryAllByRole("link"));
    expect(opens.map((link) => link.getAttribute("href"))).toEqual(EXHIBITS.flatMap((e) => (e.path ? [e.path] : [])));
    expect(list.queryAllByRole("link", { name: /Open the exhibit/ })).toHaveLength(0);
    expect(screen.queryAllByText(E.overview.coming)).toHaveLength(EXHIBITS.filter((e) => !e.path).length);
    expect(screen.getByText(E.overview.credit)).toBeInTheDocument();
  });

  it("shows every built exhibit in the list with its own drawing, held still until the card is pointed at", async () => {
    await renderList();
    const list = document.body;
    for (const entry of EXHIBITS.filter((e) => e.path)) {
      const heading = within(list).getByRole("heading", { level: 3, name: E.exhibits[entry.exhibit].title });
      const drawing = list.querySelector(`[data-still="${entry.exhibit}"]`);
      expect(drawing?.querySelector("svg, canvas"), entry.exhibit).not.toBeNull();
      // In the exhibit's own card: the smallest box holding both holds no other title.
      let card = heading.parentElement;
      while (card && !card.contains(drawing)) card = card.parentElement;
      expect(card?.querySelectorAll("h3"), entry.exhibit).toHaveLength(1);
    }
  });

  it("gives every exhibit in the list its own icon", async () => {
    await renderList();
    const icons = screen.getAllByRole("heading", { level: 3 }).map((heading) => {
      const icon = heading.parentElement?.parentElement?.querySelector(":scope > svg");
      return [...(icon?.classList ?? [])].find((name) => name.startsWith("lucide-"));
    });
    expect(icons).toHaveLength(EXHIBITS.length);
    expect(new Set(icons).size).toBe(EXHIBITS.length);
  });

  it("heads the page with what the site is, and shows the week's exhibit on a stage under it", async () => {
    await renderOverview();
    const today = weeklyExhibit(DAY);
    // The page's one heading of the first rank says what the site is, across
    // the page (Marcel, 2026-11-20), and one line under it.
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(E.overview.claim.replace(/<\/?em>/g, ""));
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText(E.overview.lead)).toBeInTheDocument();
    expect(E.overview.lead).not.toMatch(/twin/);
    // The stage: the week, Monday to Sunday (Intl sets thin spaces round the
    // dash, hence \s), the exhibit's name, the question, the two ways on.
    const stage = screen.getByRole("region", { name: E.exhibits[today].title });
    expect(within(stage).getByText(new RegExp(`${E.overview.week.eyebrow} · 5\\s–\\s11 Apr`))).toBeInTheDocument();
    expect(within(stage).getByText(E.exhibits[today].question)).toBeInTheDocument();
    expect(within(stage).getByRole("link", { name: new RegExp(E.overview.week.open) })).toHaveAttribute(
      "href",
      exhibitEntry(today).path,
    );
    // The list is a page of its own, so the browser's back button returns here.
    expect(within(stage).getByRole("link", { name: E.overview.all })).toHaveAttribute("href", "/exhibits");
    // The question alone: the summary is the list's, the longer text the page's.
    expect(within(stage).queryByText(E.exhibits[today].summary)).toBeNull();
    // The past weeks are not listed: the list below has every exhibit, with
    // the same cards (Marcel, 2026-11-20), and a dialog only repeated it.
    expect(within(stage).getAllByRole("link")).toHaveLength(2);
    expect(within(stage).queryByRole("button")).toBeNull();
  });

  it("shows the newest exhibits as a part of its own, and the way to all of them", async () => {
    await renderOverview();
    const built = EXHIBITS.filter((entry) => entry.path);
    const part = screen.getByRole("region", { name: E.overview.selection.title });
    expect(
      within(part)
        .getAllByRole("heading", { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(built.slice(0, 6).map((entry) => E.exhibits[entry.exhibit].title));
    const all = E.overview.selection.all.replace("{{count}}", String(built.length));
    expect(within(part).getByRole("link", { name: new RegExp(all) })).toHaveAttribute("href", "/exhibits");
  });

  it("shows the lessons most exhibits build on under them, and the way to the course", async () => {
    await renderOverview();
    const part = screen.getByRole("region", { name: E.overview.basics.title });
    const course = en.course.lessons;
    expect(
      within(part)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href")),
    ).toEqual(["/basics", "/basics/first-order", "/basics/second-order", "/basics/numerics"]);
    expect(within(part).getByText(new RegExp(course.numerics.title))).toBeInTheDocument();
  });

  it("grows the list of every exhibit as the reader scrolls near its end", async () => {
    // An observer that reports only when told to; the list's own is the one
    // watching the line under the last card.
    const watching: { report: IntersectionObserverCallback; target?: Element }[] = [];
    class Observer {
      readonly watch: { report: IntersectionObserverCallback; target?: Element };
      constructor(report: IntersectionObserverCallback) {
        this.watch = { report };
        watching.push(this.watch);
      }
      observe(target: Element) {
        this.watch.target = target;
      }
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal("IntersectionObserver", Observer);
    try {
      renderWithProviders(<ExhibitsPage />, { initialEntries: ["/exhibits"] });
      expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(9);
      const end = () => watching.filter((w) => w.target?.classList.contains("h-px")).at(-1)!;
      act(() => end().report([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
      expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(18);
      await settled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("sends a link to the list's old place on the front page on to its page", async () => {
    renderWithProviders(<AppRoutes />, { initialEntries: ["/#all-exhibits"] });
    expect(await screen.findByRole("heading", { level: 1, name: E.overview.all })).toBeInTheDocument();
  });

  it("counts the site in figures, the checked exhibits as the server says", async () => {
    await renderOverview();
    const band = screen.getByRole("region", { name: E.overview.facts.label });
    const built = EXHIBITS.filter((entry) => entry.path).length;
    expect(band).toHaveTextContent(new RegExp(`${E.overview.facts.exhibits}\\s*${built}`));
    expect(band).toHaveTextContent(new RegExp(`${E.overview.facts.equations}\\s*${EQUATION_COUNT}`));
    expect(band).toHaveTextContent(new RegExp(`${E.overview.facts.languages}\\s*7`));
    // None checked yet: the server's answer, not a figure the page made up.
    await waitFor(() => expect(band).toHaveTextContent(new RegExp(`${E.overview.facts.checked}\\s*0`)));
    expect(within(band).getByText(E.overview.facts.promise)).toBeInTheDocument();
  });

  it("filters the exhibits by what they are about, and shows them all again", async () => {
    await renderList();
    const cards = () => screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    fireEvent.click(screen.getByRole("button", { name: E.topics.flow }));
    // The flows, in the list's order: the elephant and the smoke ring first.
    const flows = EXHIBITS.filter((entry) => entry.topics.includes("flow")).map(
      (entry) => E.exhibits[entry.exhibit].title,
    );
    expect(flows.slice(0, 2)).toEqual([E.exhibits.elephant.title, E.exhibits.smoke.title]);
    expect(cards()).toEqual(flows);
    expect(screen.getByRole("button", { name: E.topics.flow })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: E.overview.all_topics }));
    expect(cards()).toHaveLength(EXHIBITS.length);
  });

  it("links a card to the course's lessons its computation stands on, and the chair to none", async () => {
    await renderList();
    const card = (exhibit: "cannon" | "chair") =>
      screen.getByRole("heading", { level: 3, name: E.exhibits[exhibit].title }).closest(".flex-col") as HTMLElement;
    expect(within(card("cannon")).getByRole("link", { name: E.computed.links.second_order })).toHaveAttribute(
      "href",
      "/basics/second-order",
    );
    expect(within(card("cannon")).getByRole("link", { name: E.computed.links.numerics })).toHaveAttribute(
      "href",
      "/basics/numerics",
    );
    expect(within(card("chair")).queryByText(E.overview.builds_on)).toBeNull();
  });

  it("ticks what was tried on this device, counts it, and forgets it when asked", async () => {
    useTried.getState().mark("cannon");
    await renderList();
    expect(screen.getByText(`1 of ${EXHIBITS.length}`)).toBeInTheDocument();
    expect(screen.getAllByText(E.overview.tried.mark).length).toBeGreaterThan(0);
    expect(JSON.parse(localStorage.getItem("staunlabor.experimentsTried") ?? "[]")).toEqual(["cannon"]);
    fireEvent.click(screen.getByRole("button", { name: E.overview.tried.forget }));
    expect(screen.queryByText(E.overview.tried.mark)).toBeNull();
    // Nothing tried, nothing counted: "0 of 35" to a newcomer reads as homework.
    expect(screen.queryByText(`0 of ${EXHIBITS.length}`)).toBeNull();
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
    // A drawing: an SVG, or a canvas where thousands of grains are drawn.
    expect(container.querySelector("svg, canvas")).not.toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("the area", () => {
  it("has the name, the three ways in, the search, the language and the theme in its header", () => {
    renderWithProviders(<ExperimentsLayout />, { initialEntries: ["/chair"] });
    const header = screen.getByRole("banner");
    expect(within(header).getByRole("link", { name: en.app.name })).toHaveAttribute("href", "/");
    const nav = within(header).getByRole("navigation", { name: en.site.nav.label });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => [link.textContent, link.getAttribute("href")]),
    ).toEqual([
      [en.site.nav.exhibits, "/exhibits"],
      [en.site.nav.basics, "/basics"],
      [en.site.nav.about, "/about"],
    ]);
    expect(within(header).getByRole("button", { name: new RegExp(en.site.search.trigger) })).toBeInTheDocument();
    // Still no strip of thirty-five exhibits (Marcel, 2026-11-19).
    expect(within(header).getAllByRole("link")).toHaveLength(4);
  });

  it("finds an exhibit by its question in the header's search", async () => {
    renderWithProviders(<ExperimentsLayout />, { initialEntries: ["/chair"] });
    fireEvent.click(
      within(screen.getByRole("banner")).getByRole("button", { name: new RegExp(en.site.search.trigger) }),
    );
    const field = await screen.findByPlaceholderText(en.site.search.placeholder);
    fireEvent.change(field, { target: { value: E.exhibits.smoke.question } });
    // A row of the palette, and a real link to the page.
    const found = await screen.findByRole("option", { name: new RegExp(E.exhibits.smoke.title) });
    expect(found).toHaveAttribute("href", "/smoke");
  });

  it("links every exhibit's page back to the list on the front page, and on to the next exhibit", async () => {
    renderWithProviders(<ChairPage />);
    const back = await screen.findAllByRole("link", { name: E.overview.all });
    expect(back.map((link) => link.getAttribute("href"))).toEqual(["/exhibits", "/exhibits"]);
    const onward = screen.getByRole("navigation", { name: E.frame.onward });
    expect(
      within(onward).getByRole("link", { name: E.frame.next.replace("{{name}}", E.exhibits.coil.short) }),
    ).toHaveAttribute("href", "/coil");
  });

  it("shows the first paragraph of what stands at the exhibit, and the rest on request", async () => {
    renderWithProviders(<SpherePage />);
    expect(await screen.findByText(E.sphere.at.sphere)).toBeVisible();
    const more = screen.getByText(E.frame.more_at);
    expect(more.closest("details")).not.toHaveAttribute("open");
    fireEvent.click(more);
    expect(more.closest("details")).toHaveAttribute("open");
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
    await waitFor(() => expect(screen.getAllByLabelText(E.equation.symbols).length).toBeGreaterThanOrEqual(9));
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
    expect(screen.getByText(/How far the trunk can tilt: up to 32°/)).toBeInTheDocument();
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

  it("makes the ring of a press on the drum it began on, though the stroke is lowered mid-press", async () => {
    renderWithProviders(<SmokePage />);
    fireEvent.click(await screen.findByRole("button", { name: E.smoke.play.press }));
    // Lowered under the depth already pressed: the ring is still the press's own.
    fireEvent.change(screen.getByRole("slider", { name: E.smoke.change.stroke }), { target: { value: "2" } });
    // The press takes half a second of real time on the page's own frames, which
    // under coverage come so slowly that the verdict took 3.2 s alone and more
    // in the full run: 3 s failed the pre-push check of 2026-11-19.
    expect(await screen.findByText(E.smoke.play.verdict.ring, {}, { timeout: 8000 })).toBeInTheDocument();
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

describe("the pendulum wave", () => {
  it("refuses a row that asks for pendulums shorter than 2 cm, in the play card and the trick", async () => {
    renderWithProviders(<WavePage />);
    await screen.findByRole("img", { name: E.wave.views.top });
    const set = (name: string, value: string) =>
      fireEvent.change(screen.getByRole("slider", { name }), { target: { value } });
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
    await waitFor(() => expect(screen.getAllByLabelText(E.equation.symbols).length).toBeGreaterThanOrEqual(6));
  });

  it("stops the clock at half the cycle, where the row stands in two groups", async () => {
    renderWithProviders(<WavePage />);
    await screen.findByRole("img", { name: E.wave.views.top });
    fireEvent.click(screen.getByRole("button", { name: E.wave.play.jumps["2"] }));
    expect(screen.getByRole("button", { name: E.wave.play.run })).toBeInTheDocument();
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
    const swing = () => screen.getByRole("slider", { name: E.wave.play.amplitude }).getAttribute("aria-valuetext");
    expect(swing()).toMatch(/^30\b/);
    expect(screen.getByRole("button", { name: E.wave.play.run })).toBeInTheDocument();
    fireEvent.pointerUp(side, { pointerId: 1 });
    expect(await screen.findByRole("button", { name: E.wave.play.pause })).toBeInTheDocument();
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
    expect(screen.getAllByLabelText(E.equation.symbols).length).toBeGreaterThanOrEqual(5);
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
    expect(screen.getAllByLabelText(E.equation.symbols).length).toBeGreaterThanOrEqual(4);
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
    expect(screen.getAllByLabelText(E.equation.symbols).length).toBeGreaterThanOrEqual(4);
  });

  it("refuses a vessel filled over its top", async () => {
    renderWithProviders(<ParabolaPage />);
    await screen.findByRole("img", { name: E.parabola.views.side });
    fireEvent.change(screen.getByRole("slider", { name: E.parabola.change.fill }), { target: { value: "35" } });
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
    expect(screen.getAllByLabelText(E.equation.symbols).length).toBeGreaterThanOrEqual(4);
  });

  it("refuses a spring fixed below the shorter bob", async () => {
    renderWithProviders(<CoupledPage />);
    await screen.findByRole("img", { name: E.coupled.view });
    fireEvent.change(screen.getByRole("slider", { name: E.coupled.change.right_length }), { target: { value: "30" } });
    fireEvent.change(screen.getByRole("slider", { name: E.coupled.change.spring_at }), { target: { value: "40" } });
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
    expect(screen.getAllByLabelText(E.equation.symbols).length).toBeGreaterThanOrEqual(4);
  });

  it("sets the three cases from the trick, and says what each does", async () => {
    renderWithProviders(<PegPage />);
    await screen.findByRole("img", { name: E.peg.view });
    fireEvent.click(screen.getByRole("button", { name: E.peg.sweet.cases.over_the_top }));
    expect(await screen.findByText(E.peg.play.outcome_over_the_top)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: E.peg.sweet.cases.slack }));
    expect(await screen.findByText(E.peg.play.outcome_slack)).toBeInTheDocument();
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
    expect(screen.getAllByLabelText(E.equation.symbols).length).toBeGreaterThanOrEqual(4);
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
    expect(
      await screen.findByText(
        /Measured for this start over half a minute: λ ≈ \d\.\d a second – a single stretch of path, so a few tenths more or less\. A difference thus doubles about every \d\.\d\d s/,
        {},
        { timeout: 8000 },
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByLabelText(E.equation.symbols).length).toBeGreaterThanOrEqual(4);
  }, 15000);

  it("calls a gentle start predictable", async () => {
    renderWithProviders(<ChaosPage />);
    await screen.findByRole("img", { name: E.chaos.view });
    fireEvent.click(screen.getByRole("button", { name: E.chaos.play.presets.gentle }));
    expect(await screen.findByText(/practically zero/, {}, { timeout: 8000 })).toBeInTheDocument();
  }, 15000);
});

describe("the chaotic waterwheel", () => {
  it("shows the wheel and the butterfly, the tap and the wheel's reversals", async () => {
    renderWithProviders(<WaterwheelPage />);
    expect(await screen.findByRole("img", { name: E.waterwheel.views.wheel })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: E.waterwheel.views.butterfly })).toBeInTheDocument();
    expect(screen.getByText(E.waterwheel.play.regime_chaotic)).toBeInTheDocument();
    expect(await screen.findByText(/In 200 seconds the wheel here turns back \d+ times/)).toBeInTheDocument();
    expect(screen.getAllByLabelText(E.equation.symbols).length).toBeGreaterThanOrEqual(3);
  });

  it("stands still with too little water, and turns steadily with some more", async () => {
    renderWithProviders(<WaterwheelPage />);
    await screen.findByRole("img", { name: E.waterwheel.views.wheel });
    fireEvent.change(screen.getByRole("slider", { name: E.waterwheel.play.tap }), { target: { value: "0.5" } });
    expect(await screen.findByText(E.waterwheel.play.regime_still)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("slider", { name: E.waterwheel.play.tap }), { target: { value: "10" } });
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
    expect(screen.getAllByLabelText(E.equation.symbols).length).toBeGreaterThanOrEqual(3);
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
    fireEvent.change(screen.getByRole("slider", { name: E.coriolis.play.aim }), { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: E.coriolis.play.throw }));
    expect(screen.getByText("Aiming 50.4° ahead hits it.")).toBeInTheDocument();
    expect(screen.getAllByLabelText(E.equation.symbols).length).toBeGreaterThanOrEqual(3);
  });

  it("aims ahead when asked, and then misses by nothing", async () => {
    renderWithProviders(<CoriolisPage />);
    await screen.findByRole("img", { name: E.coriolis.view });
    showAnswer();
    fireEvent.click(screen.getByRole("button", { name: E.coriolis.play.aim_lead }));
    expect((await screen.findAllByDisplayValue("50.4")).length).toBeGreaterThan(0);
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
    expect(screen.getAllByLabelText(E.equation.symbols).length).toBeGreaterThanOrEqual(3);
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
    expect(screen.getByRole("slider", { name: E.cradle.play.angle }).getAttribute("aria-valuetext")).toMatch(/^60\b/);
    expect(screen.queryByRole("button", { name: E.cradle.play.pause })).toBeNull();
    fireEvent.pointerUp(view, { pointerId: 1 });
    expect(await screen.findByRole("button", { name: E.cradle.play.pause })).toBeInTheDocument();
    expect(x0).toBeLessThan(0);
  });

  it("lets go when asked, and can be paused", async () => {
    renderWithProviders(<CradlePage />);
    await screen.findByRole("img", { name: E.cradle.view });
    fireEvent.click(screen.getByRole("button", { name: E.cradle.play.let_go }));
    expect(await screen.findByRole("button", { name: E.cradle.play.pause })).toBeInTheDocument();
  });
});

describe("the gravity well", () => {
  it("shows the funnel from above and from the side, ready on the circle", async () => {
    renderWithProviders(<WellPage />);
    expect(await screen.findByRole("img", { name: E.well.view_top })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: E.well.view_side })).toBeInTheDocument();
    // The circle at the start: the speed that keeps it there without friction.
    expect((await screen.findAllByDisplayValue("0.44")).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText(E.equation.symbols).length).toBeGreaterThanOrEqual(4);
  });

  it("pushes off when asked, and can be paused", async () => {
    renderWithProviders(<WellPage />);
    await screen.findByRole("img", { name: E.well.view_top });
    fireEvent.click(screen.getByRole("button", { name: E.well.play.launch }));
    expect(await screen.findByRole("button", { name: E.well.play.pause })).toBeInTheDocument();
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
    expect(screen.getByRole("switch", { name: E.resonance.play.sound })).not.toBeChecked();
    expect(screen.getByText(E.resonance.play.no_sound)).toBeInTheDocument();
    expect(screen.getAllByLabelText(E.equation.symbols).length).toBeGreaterThanOrEqual(3);
  });

  it("shakes when asked, and sweeps from 1 Hz with the frequencies out", async () => {
    renderWithProviders(<ResonancePage />);
    await screen.findByRole("img", { name: E.resonance.view });
    fireEvent.click(screen.getByRole("button", { name: E.resonance.play.shake }));
    expect(await screen.findByRole("button", { name: E.resonance.play.stop })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("slider", { name: E.resonance.play.beat }), { target: { value: "3" } });
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
    expect(screen.getAllByLabelText(E.equation.symbols).length).toBeGreaterThanOrEqual(4);
  });

  it("lets go when asked, and can be paused", async () => {
    renderWithProviders(<GyroscopePage />);
    await screen.findByRole("img", { name: E.gyroscope.view });
    fireEvent.click(screen.getByRole("button", { name: E.gyroscope.play.let_go }));
    expect(await screen.findByRole("button", { name: E.gyroscope.play.pause })).toBeInTheDocument();
  });

  it("lets a wheel too slow to circle at its tilt go from rest, and says so, where it once broke the site", async () => {
    renderWithProviders(<GyroscopePage />);
    await screen.findByRole("img", { name: E.gyroscope.view });
    fireEvent.click(screen.getByRole("radio", { name: E.gyroscope.play.starts.steady }));
    fireEvent.change(screen.getByRole("slider", { name: E.gyroscope.play.rpm }), { target: { value: "20" } });
    fireEvent.change(screen.getByRole("slider", { name: E.gyroscope.play.tilt }), { target: { value: "70" } });
    expect(await screen.findByText(E.gyroscope.play.no_steady)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: E.gyroscope.play.let_go }));
    expect(await screen.findByRole("button", { name: E.gyroscope.play.pause })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("slider", { name: E.gyroscope.play.rpm }), { target: { value: "200" } });
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
    expect(screen.getAllByLabelText(E.equation.symbols).length).toBeGreaterThanOrEqual(3);
  });

  it("breaks when the stones are made too thin, and stands again as the chain's arch", async () => {
    renderWithProviders(<ArchPage />);
    await screen.findByRole("img", { name: E.arch.view });
    fireEvent.change(screen.getByRole("slider", { name: E.arch.play.thickness }), { target: { value: "8" } });
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
    expect(screen.getByRole("switch", { name: E.chladni.play.sound })).not.toBeChecked();
    expect(screen.getAllByLabelText(E.equation.symbols).length).toBeGreaterThanOrEqual(3);
  });

  it("rings at a tone when it is chosen", async () => {
    renderWithProviders(<ChladniPage />);
    await screen.findByRole("img", { name: E.chladni.view });
    fireEvent.click(screen.getByRole("button", { name: "517 Hz" }));
    expect((await screen.findAllByDisplayValue("517")).length).toBeGreaterThan(0);
  });
});

describe("the check of the calculations", () => {
  it("says in one line under an exhibit's title that it is not yet checked, with no cases where it has none", async () => {
    // The gyroscope is among the last to get its cases (docs/experiments.md).
    renderWithProviders(<GyroscopePage />);
    expect(await screen.findByText(E.checks.status.unchecked)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: E.checks.status.to_cases })).toBeNull();
    expect(screen.queryByRole("heading", { name: E.checks.title })).toBeNull();
  });

  it("shows an exhibit's cases: formula, the value by hand and the page's, and the source quoted", async () => {
    renderWithProviders(<SpherePage />);
    expect(await screen.findByRole("link", { name: E.checks.status.to_cases })).toHaveAttribute("href", "#check-it");
    const section = screen
      .getByRole("heading", { level: 2, name: E.checks.title })
      .closest("div.space-y-4") as HTMLElement;
    const cases = within(section).getAllByRole("heading", { level: 3 });
    expect(cases).toHaveLength(8);
    expect(cases[0]).toHaveTextContent(E.checks.cases.sphere.small_swing.title);
    // By hand 0.9928421 Hz, the page's time loop 0.9927665 Hz: seven digits show where they part.
    expect(within(section).getByText("0.9928421 Hz")).toBeInTheDocument();
    expect(within(section).getByText("0.9927665 Hz")).toBeInTheDocument();
    // The source, a link a reader can open, and its words as it has them.
    expect(within(section).getAllByRole("link", { name: /Ball Rolling in a Bowl/ })[0]).toHaveAttribute(
      "href",
      expect.stringContaining("libretexts.org"),
    );
    // A case no source states as used says so, and gives the step.
    expect(within(section).getAllByText(E.checks.derived).length).toBeGreaterThan(0);
    expect(within(section).getByText(E.checks.cases.sphere.hollow_ball.step)).toBeInTheDocument();
  });

  it("gives the day an admin checked the exhibit, and no warning", async () => {
    mockApi({
      "GET /experiments/checks": { ...UNCHECKED, checked: [{ exhibit: "sphere", checked_on: "2026-11-20" }] },
      "GET /experiments/defaults": fixtures.defaults,
      "POST /experiments/sphere": fixtures.sphere,
    });
    renderWithProviders(<SpherePage />);
    // The day as the reader's language writes it (English here: "20 November 2026").
    const said = E.checks.status.checked.replace("{{date}}", "");
    expect(await screen.findByText(new RegExp(`^${said}.*20.*November.*2026`))).toBeInTheDocument();
    expect(screen.queryByText(E.checks.status.unchecked)).toBeNull();
  });

  it("offers no verdict to a reader who is not signed in", async () => {
    renderWithProviders(<SpherePage />);
    await screen.findByText(E.checks.status.unchecked);
    expect(screen.queryByRole("button", { name: E.checks.admin.check })).toBeNull();
  });
});

describe("setting a check case up", () => {
  const setUp = async (index: number) => {
    const buttons = await screen.findAllByRole("button", { name: E.checks.set_up });
    fireEvent.click(buttons[index]);
  };

  it("moves the chair's eye by the parallax case's 0.16 mm, and to the other eye for the next", async () => {
    renderWithProviders(<ChairPage />);
    await setUp(2);
    const eye = screen.getByRole("slider", { name: E.chair.views.eye });
    expect(eye.getAttribute("aria-valuetext")).toMatch(/0\.16/);
    await setUp(3);
    expect(eye.getAttribute("aria-valuetext")).toMatch(/65/);
  });

  it("lets the sphere's ball go without a hand, 90° up the wall, for the wide swing", async () => {
    renderWithProviders(<SpherePage />);
    await setUp(2);
    expect(await screen.findByRole("slider", { name: E.sphere.play.start_angle })).toHaveAttribute(
      "aria-valuetext",
      expect.stringMatching(/90/),
    );
    expect(screen.getByText(E.sphere.play.hint_release)).toBeInTheDocument();
  });

  it("hangs the cradle's balls a hair apart without loss and lets one go, for one in, one out", async () => {
    renderWithProviders(<CradlePage />);
    await screen.findByRole("img", { name: E.cradle.view });
    await setUp(0);
    expect(await screen.findByRole("button", { name: E.cradle.play.pause })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: E.cradle.play.spacings.gap })).toBeChecked();
    expect(screen.getByRole("slider", { name: E.cradle.play.restitution }).getAttribute("aria-valuetext")).toMatch(
      /^1\b/,
    );
  });

  it("turns the waterwheel's tap down to 5 for its steady turn, and starts it from rest", async () => {
    renderWithProviders(<WaterwheelPage />);
    await screen.findByRole("img", { name: E.waterwheel.views.wheel });
    await setUp(1);
    await waitFor(() =>
      expect(screen.getByRole("slider", { name: E.waterwheel.play.tap }).getAttribute("aria-valuetext")).toMatch(
        /^5\b/,
      ),
    );
    expect(await screen.findByText(E.waterwheel.play.regime_steady)).toBeInTheDocument();
  });

  it("stops the wave's clock at a third of its cycle, where its third case reads the row", async () => {
    renderWithProviders(<WavePage />);
    await screen.findByRole("img", { name: E.wave.views.top });
    await setUp(3);
    expect(await screen.findByRole("button", { name: E.wave.play.run })).toBeInTheDocument();
    expect(screen.getByText(/^20\.0/)).toBeInTheDocument();
  });

  it("puts a 15 kg car on the coil's track for the brake, without rolling resistance", async () => {
    renderWithProviders(<CoilPage />);
    await setUp(5);
    await waitFor(() =>
      expect(screen.getByRole("slider", { name: E.coil.change.mass }).getAttribute("aria-valuetext")).toMatch(/15/),
    );
    expect(screen.getByRole("slider", { name: E.coil.change.rolling }).getAttribute("aria-valuetext")).toMatch(/^0\b/);
  });
});

describe("the floating top", () => {
  it("shows the tuned top floating in its window, with the field's equations", async () => {
    renderWithProviders(<LevitationPage />);
    expect(await screen.findByRole("img", { name: E.levitation.view })).toBeInTheDocument();
    expect(await screen.findByText(E.levitation.play.hovers)).toBeInTheDocument();
    expect(screen.getAllByLabelText(E.equation.symbols).length).toBeGreaterThanOrEqual(5);
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
    fireEvent.change(screen.getByRole("slider", { name: E.levitation.play.warming }), { target: { value: "3.5" } });
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
    expect(screen.getByRole("button", { name: E.circuit.play.pause })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: E.circuit.play.pause }));
    expect(screen.getByRole("button", { name: E.circuit.play.run })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: E.circuit.play.recharge }));
    expect(screen.getByRole("button", { name: E.circuit.play.throw })).toBeInTheDocument();
    expect(screen.getAllByLabelText(E.equation.symbols).length).toBeGreaterThanOrEqual(6);
  });

  it("says when too much resistance stops it swinging, and the energy is all in the capacitor before the switch", async () => {
    renderWithProviders(<CircuitPage />);
    await screen.findByRole("img", { name: E.circuit.view });
    expect(screen.getByText(E.circuit.change.swings)).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: new RegExp(`^${E.circuit.play.energy}: ${E.circuit.play.capacitor} 100 %`) }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByRole("slider", { name: E.circuit.change.resistance }), { target: { value: "3000" } });
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
    fireEvent.click(screen.getByRole("button", { name: E.plates.play.pause }));
    expect(screen.getByRole("button", { name: E.plates.play.run })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: E.plates.play.top }));
    expect(screen.getByRole("button", { name: E.plates.play.drop })).toBeInTheDocument();
    const look = screen.getByRole("radiogroup", { name: E.plates.play.look });
    fireEvent.click(within(look).getByRole("radio", { name: E.plates.short.plastic }));
    expect(screen.getByText(E.plates.play.none)).toBeInTheDocument();
    expect(screen.getAllByLabelText(E.equation.symbols).length).toBeGreaterThanOrEqual(5);
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
    expect(screen.getByText(E.bounce.play.no_sound)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: E.bounce.play.drop }));
    expect(screen.queryByText(E.bounce.play.waiting)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: E.bounce.play.pause }));
    expect(screen.getByRole("button", { name: E.bounce.play.run })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: E.bounce.play.top }));
    expect(screen.getByRole("button", { name: E.bounce.play.drop })).toBeInTheDocument();
    expect(screen.getAllByLabelText(E.equation.symbols).length).toBeGreaterThanOrEqual(4);
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
    expect(screen.getAllByLabelText(E.equation.symbols).length).toBeGreaterThanOrEqual(4);
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
    renderWithProviders(<DiverPage />);
    expect(await screen.findByRole("img", { name: E.diver.view })).toBeInTheDocument();
    expect(screen.getByText(E.diver.play.motion.floats)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("slider", { name: E.diver.play.squeeze }), { target: { value: "20" } });
    // The sinking runs on the page's frames, slow under coverage, as the smoke ring's press.
    expect(await screen.findByText(E.diver.play.motion.sinks, undefined, { timeout: 8000 })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: E.diver.play.pause }));
    expect(screen.getByRole("button", { name: E.diver.play.run })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: E.diver.play.surface }));
    expect(screen.getAllByLabelText(E.equation.symbols).length).toBeGreaterThanOrEqual(4);
  });

  it("names the squeeze that sinks it, 10.9 kPa, and more with more air", async () => {
    renderWithProviders(<DiverPage />);
    await screen.findByRole("img", { name: E.diver.view });
    expect(screen.getByText("10.9")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("slider", { name: E.diver.change.air }), { target: { value: "2.2" } });
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
    fireEvent.change(screen.getByRole("slider", { name: E.rainbow.play.impact }), { target: { value: "99" } });
    expect(screen.getByText(new RegExp(`${E.rainbow.play.across.split("{{angle}}")[1]}$`))).toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch", { name: E.rainbow.play.split }));
    expect(screen.getByRole("switch", { name: E.rainbow.play.split })).toBeChecked();
    expect(screen.getAllByLabelText(E.equation.symbols).length).toBeGreaterThanOrEqual(4);
  });

  it("says a crossing ray lands outside the ring once a dense bead's ring has shrunk inside it", async () => {
    renderWithProviders(<RainbowPage />);
    await screen.findByRole("img", { name: E.rainbow.bead_view });
    // At n = 1.9 the ring stands at 1.5°, and a ray 99 % out comes back across the way at some 20°.
    fireEvent.change(screen.getByRole("slider", { name: E.rainbow.change.index }), { target: { value: "1.9" } });
    fireEvent.change(screen.getByRole("slider", { name: E.rainbow.play.impact }), { target: { value: "99" } });
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
    fireEvent.change(screen.getByRole("slider", { name: E.sky.air.height }), { target: { value: "0" } });
    expect(await screen.findByText("37.9")).toBeInTheDocument();
    expect(screen.getAllByLabelText(E.equation.symbols).length).toBeGreaterThanOrEqual(4);
  });

  it("marks where red wins only inside the tube, and cloudier water moves it towards the lamp", async () => {
    renderWithProviders(<SkyPage />);
    await screen.findByRole("img", { name: E.sky.tube_view });
    expect(screen.getByText(E.sky.play.red_mark)).toBeInTheDocument();
    // In a 40 cm tube the red never wins: it would, past 54 cm.
    fireEvent.change(screen.getByRole("slider", { name: E.sky.change.length }), { target: { value: "0.4" } });
    expect(screen.queryByText(E.sky.play.red_mark)).not.toBeInTheDocument();
    // At 3 per metre half the blue is gone after 10 cm, and red wins after 25 cm.
    fireEvent.change(screen.getByRole("slider", { name: E.sky.play.cloudiness }), { target: { value: "3" } });
    expect(await screen.findByText("10")).toBeInTheDocument();
    expect(screen.getByText(E.sky.play.red_mark)).toBeInTheDocument();
  });

  it("has the ozone take 39 % of the orange with the sun on the horizon, and nothing once it is off", async () => {
    renderWithProviders(<SkyPage />);
    await screen.findByRole("img", { name: E.sky.sky_view });
    fireEvent.change(screen.getByRole("slider", { name: E.sky.air.height }), { target: { value: "0" } });
    expect(await screen.findByText(E.sky.air.ozone_takes)).toBeInTheDocument();
    expect(screen.getByText("39")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch", { name: E.sky.air.ozone }));
    expect(screen.queryByText(E.sky.air.ozone_takes)).not.toBeInTheDocument();
    expect(screen.queryByText("39")).not.toBeInTheDocument();
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
    expect(screen.getAllByLabelText(E.equation.symbols).length).toBeGreaterThanOrEqual(3);
  });

  it("widens the stripes with green light gone red and closes them with the slits further apart", async () => {
    renderWithProviders(<SlitsPage />);
    await screen.findByRole("img", { name: E.slits.wall_view });
    fireEvent.change(screen.getByRole("slider", { name: E.slits.play.wavelength }), { target: { value: "532" } });
    expect(await screen.findByText(E.slits.play.status_both.replace("{{spacing}}", "4.3"))).toBeInTheDocument();
    fireEvent.change(screen.getByRole("slider", { name: E.slits.change.spacing }), { target: { value: "0.5" } });
    expect(await screen.findByText(E.slits.play.status_both.replace("{{spacing}}", "2.1"))).toBeInTheDocument();
  });

  it("says when the wall is nearer than the far-field formula allows for slits this wide", async () => {
    renderWithProviders(<SlitsPage />);
    await screen.findByRole("img", { name: E.slits.wall_view });
    expect(screen.queryByText(/nearer than the formula allows/)).toBeNull();
    // The slider's widest, 0.2 mm, in red light: 35·a²/λ = 2.2 m, past the wall's 2 m.
    fireEvent.change(screen.getByRole("slider", { name: E.slits.change.width }), { target: { value: "0.2" } });
    expect(await screen.findByText(E.slits.play.near.replace("{{near}}", "2.2"))).toBeInTheDocument();
  });
});

describe("the beats", () => {
  it("waits, rings when struck, and has its sound muted with no Web Audio here", async () => {
    renderWithProviders(<BeatsPage />);
    expect(await screen.findByRole("img", { name: E.beats.view })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: E.beats.loudness_view })).toBeInTheDocument();
    expect(screen.getByText(E.beats.play.waiting)).toBeInTheDocument();
    expect(screen.getByText(E.beats.play.no_sound)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: E.beats.play.strike }));
    expect(screen.queryByText(E.beats.play.waiting)).not.toBeInTheDocument();
    expect(screen.getAllByLabelText(E.equation.symbols).length).toBeGreaterThanOrEqual(3);
  });

  it("beats 0.82 times a second with a gram a third up, and stops with the rider at the stem", async () => {
    renderWithProviders(<BeatsPage />);
    await screen.findByRole("img", { name: E.beats.view });
    expect(screen.getAllByText("0.82").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("1.22").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("23")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("slider", { name: E.beats.change.position }), { target: { value: "0" } });
    expect((await screen.findAllByText("0.00")).length).toBeGreaterThanOrEqual(2);
  });
});

describe("for a reader who asked for reduced motion", () => {
  // jsdom has no matchMedia; here it answers as such a reader's browser does.
  beforeEach(() => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("puts the magnet car's start on the track, and lets it go from there", async () => {
    renderWithProviders(<CoilPage />);
    const go = await screen.findByRole("button", { name: E.coil.play.let_go });
    fireEvent.click(go);
    expect(screen.queryByRole("button", { name: E.coil.play.let_go })).toBeNull();
    expect(screen.getByRole("button", { name: E.coil.play.pause })).toBeInTheDocument();
  });

  // Every twin that would start moving by itself as its page opens.
  it.each([
    ["coupled pendulums", CoupledPage, E.coupled.play],
    ["ball cannon", CannonPage, E.cannon.play],
    ["magnet car", CoilPage, E.coil.play],
    ["harmonograph", HarmonographPage, E.harmonograph.play],
    ["Bernoulli elephant", ElephantPage, E.elephant.play],
    ["Cartesian diver", DiverPage, E.diver.play],
    ["water parabola", ParabolaPage, E.parabola.play],
    ["interrupted pendulum", PegPage, E.peg.play],
    ["ball in the sphere", SpherePage, E.sphere.play],
    ["chaotic waterwheel", WaterwheelPage, E.waterwheel.play],
    ["pendulum wave", WavePage, E.wave.play],
    ["Foucault pendulum", FoucaultPage, E.foucault.play],
    ["smoke ring", SmokePage, E.smoke.play],
    ["turntable", PlatformPage, E.platform.play],
    ["race and its valley", RacePage, E.race.play],
    ["Coriolis carousel", CoriolisPage, E.play],
    ["Chladni plate", ChladniPage, E.play],
  ])("the %s starts still, with a button to start it", async (_, Page, words) => {
    renderWithProviders(<Page />);
    expect((await screen.findAllByRole("button", { name: words.run })).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: words.pause })).not.toBeInTheDocument();
  });

  it("starts the Coriolis carousel when a throw is thrown", async () => {
    renderWithProviders(<CoriolisPage />);
    fireEvent.click(await screen.findByRole("button", { name: E.coriolis.play.throw }));
    expect(screen.getByRole("button", { name: E.play.pause })).toBeInTheDocument();
  });

  // Paused, a twin's main action starts it: the reader is asking to see it
  // move, and on these pages the action did nothing until Run was pressed.
  const click = (name: string) => () => fireEvent.click(screen.getByRole("button", { name }));
  const slide = (name: string, value: string) => () =>
    fireEvent.change(screen.getByRole("slider", { name }), { target: { value } });
  it.each([
    ["smoke ring", SmokePage, E.smoke.play, click(E.smoke.play.press)],
    ["ball cannon", CannonPage, E.cannon.play, click(E.cannon.play.drop)],
    ["turntable", PlatformPage, E.platform.play, click(E.platform.play.push)],
    ["Bernoulli elephant", ElephantPage, E.elephant.play, click(E.elephant.play.push_left)],
    ["Chladni plate", ChladniPage, E.play, slide(E.chladni.play.drive, "300")],
    ["Cartesian diver", DiverPage, E.diver.play, slide(E.diver.play.squeeze, "2")],
    [
      "ball in the sphere",
      SpherePage,
      E.sphere.play,
      () => fireEvent.click(screen.getByRole("radio", { name: E.sphere.play.modes.circle })),
    ],
    ["water parabola", ParabolaPage, E.parabola.play, slide(E.parabola.play.rate, "120")],
  ])("starts the %s when its main action is taken", async (_, Page, words, act) => {
    renderWithProviders(<Page />);
    await screen.findAllByRole("button", { name: words.run });
    act();
    expect(await screen.findByRole("button", { name: words.pause })).toBeInTheDocument();
  });
});

describe("while the server does not answer", () => {
  // The defaults, the chair's boxes and the Chladni plate's modes: the three
  // answers a page waits on before it draws its twin.
  it.each([
    ["coupled pendulums", CoupledPage, "GET /experiments/defaults"],
    ["chair", ChairPage, "GET /experiments/chair"],
    ["Chladni plate", ChladniPage, "GET /experiments/chladni"],
  ])("the %s page says so in place of its twin", async (_, Page, route) => {
    mockApi({
      "GET /experiments/defaults": fixtures.defaults,
      "GET /experiments/chair": chair,
      "GET /experiments/chladni": fixtures.chladni,
      [route]: new Error("unreachable"),
    });
    renderWithProviders(<Page />);
    expect(await screen.findByText(E.failed)).toBeInTheDocument();
  });
});
