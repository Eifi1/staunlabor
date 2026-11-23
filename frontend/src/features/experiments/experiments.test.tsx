/**
 * The experiments' site around the exhibits, against a mocked engine whose
 * answer is the real engine's (`test-fixtures.json`, the API's answers to the
 * defaults, written by `scripts/write-test-fixtures.py` and held to the app by
 * the backend's `test_page_fixtures.py`; the setup is `src/test/experiments.ts`):
 * the overview and the list of every exhibit, a visit counting as tried, the
 * previews, the way on from an exhibit's page, an equation's legend, the check
 * of the calculations and setting a case up, a reader who asked for reduced
 * motion, and a server that does not answer. Each exhibit's own page is in
 * `exhibits-1.test.tsx` and `exhibits-2.test.tsx`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import en from "@/shared/i18n/locales/en.json";
import { mockApi } from "@/test/api-mock";
import { E, UNCHECKED, mockExperiments, setSlider, sliderText } from "@/test/experiments";
import { renderWithProviders } from "@/test/render";
import type { ChairAnalysis } from "@/shared/types";
import { ChairPage } from "./chair-page";
import { CoilPage } from "./coil-page";
import { Equation } from "./equation";
import { SpherePage } from "./sphere-page";
import { PlatformPage } from "./platform-page";
import { RacePage } from "./race-page";
import { ElephantPage } from "./elephant-page";
import { SmokePage } from "./smoke-page";
import { CannonPage } from "./cannon-page";
import { WavePage } from "./wave-page";
import { HarmonographPage } from "./harmonograph-page";
import { ConePage } from "./cone-page";
import { ParabolaPage } from "./parabola-page";
import { CoupledPage } from "./coupled-page";
import { PegPage } from "./peg-page";
import { MaxwellPage } from "./maxwell-page";
import { ChaosPage } from "./chaos-page";
import { WaterwheelPage } from "./waterwheel-page";
import { FoucaultPage } from "./foucault-page";
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
import { weeklyExhibit } from "./weekly";
import { CheckSection } from "./check-section";
import { CheckStatus } from "./check-status";
import { ExhibitPreview } from "./exhibit-preview";
import { EXHIBITS, exhibitEntry, type Exhibit } from "./exhibits";
import { EQUATION_COUNT } from "./facts";
import { ExperimentsOverviewPage } from "./overview-page";
import { ExhibitsPage } from "./exhibits-page";
import { AppRoutes } from "@/app/routes";
import { settled } from "@/test/settle";
import { useTried } from "./tried";
import fixtures from "./test-fixtures.json";

const chair = fixtures.chair as unknown as ChairAnalysis;

beforeEach(() => {
  useTried.getState().forget();
  mockExperiments();
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
    // Every card's preview loads its page's module: with 45, the first list
    // of a run outlasts waitFor's one second while the modules are fetched.
    await waitFor(() => expect(view.container.querySelector("[aria-busy='true']")).toBeNull(), { timeout: 20_000 });
    return view;
  };

  it("opens every exhibit from its card and credits the museum", async () => {
    await renderList();
    expect(screen.getByRole("heading", { level: 3, name: E.exhibits.chair.title })).toBeInTheDocument();
    // The whole card opens its exhibit, through its title: no button per card.
    const list = within(document.body);
    const opens = list
      .getAllByRole("heading", { level: 3 })
      .flatMap((heading) => within(heading).queryAllByRole("link"));
    expect(opens.map((link) => link.getAttribute("href"))).toEqual(EXHIBITS.map((e) => e.path));
    expect(list.queryAllByRole("link", { name: /Open the exhibit/ })).toHaveLength(0);
    expect(screen.getByText(E.overview.credit)).toBeInTheDocument();
  });

  it("shows every exhibit in the list with its own drawing, held still until the card is pointed at", async () => {
    await renderList();
    const list = document.body;
    for (const entry of EXHIBITS) {
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

  it("shows six exhibits drawn at random as a part of its own, and the way to all of them", async () => {
    await renderOverview();
    const part = screen.getByRole("region", { name: E.overview.selection.title });
    const titles = EXHIBITS.map((entry) => E.exhibits[entry.exhibit].title);
    const shown = within(part)
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent ?? "");
    // Six different ones, in the list's order.
    expect(new Set(shown).size).toBe(6);
    expect(shown.map((title) => titles.indexOf(title))).toEqual(
      shown.map((title) => titles.indexOf(title)).sort((a, b) => a - b),
    );
    expect(shown.every((title) => titles.includes(title))).toBe(true);
    const all = E.overview.selection.all.replace("{{count}}", String(EXHIBITS.length));
    expect(within(part).getByRole("link", { name: new RegExp(all) })).toHaveAttribute("href", "/exhibits");
  });

  it("shows the lessons the exhibits build on under them, and the way to the course", async () => {
    await renderOverview();
    const part = screen.getByRole("region", { name: E.overview.basics.title });
    const course = en.course.lessons;
    expect(
      within(part)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href")),
    ).toEqual([
      "/basics",
      "/basics/first-order",
      "/basics/second-order",
      "/basics/eigenvalues",
      "/basics/laplace",
      "/basics/numerics",
      "/basics/two-mass",
    ]);
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
    expect(band).toHaveTextContent(new RegExp(`${E.overview.facts.exhibits}\\s*${EXHIBITS.length}`));
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
  it("links every exhibit's page back to the list on the front page, and on to the next exhibit", async () => {
    renderWithProviders(<ChairPage />);
    const back = await screen.findAllByRole("link", { name: E.overview.all });
    expect(back.map((link) => link.getAttribute("href"))).toEqual(["/exhibits", "/exhibits"]);
    const onward = screen.getByRole("navigation", { name: E.frame.onward });
    expect(
      within(onward).getByRole("link", { name: E.frame.next.replace("{{name}}", E.exhibits.coil.short) }),
    ).toHaveAttribute("href", "/coil");
  });

  it("shows all of what stands at the exhibit, with nothing folded away", async () => {
    renderWithProviders(<SpherePage />);
    expect(await screen.findByText(E.sphere.at.sphere)).toBeVisible();
    for (const paragraph of Object.values(E.sphere.at)) expect(screen.getByText(paragraph)).toBeVisible();
    expect(document.querySelector("details")).toBeNull();
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

describe("the check of the calculations", () => {
  it("says in one line under an exhibit's title that it is not yet checked, with no cases where it has none", async () => {
    // Every exhibit has its cases since the gyroscope's (2026-11-21): a name
    // that is no exhibit stands for one that ships before its cases.
    const none = "orrery" as Exhibit;
    renderWithProviders(
      <>
        <CheckStatus exhibit={none} />
        <CheckSection exhibit={none} />
      </>,
    );
    expect(await screen.findByText(E.checks.status.unchecked)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: E.checks.status.to_cases })).toBeNull();
    expect(screen.queryByRole("heading", { name: E.checks.title })).toBeNull();
  });

  it("gives a case with nothing to set no button: the overhang's furthest stack, which the page holds back", async () => {
    renderWithProviders(<OverhangPage />);
    const titled = (title: string) => (name: string) => name.endsWith(title);
    const cases = E.checks.cases.overhang;
    const furthest = await screen.findByRole("heading", { level: 3, name: titled(cases.nine.title) });
    expect(within(furthest.closest("li") as HTMLElement).queryByRole("button", { name: E.checks.set_up })).toBeNull();
    const even = screen.getByRole("heading", { level: 3, name: titled(cases.even.title) });
    expect(
      within(even.closest("li") as HTMLElement).getByRole("button", { name: E.checks.set_up }),
    ).toBeInTheDocument();
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
    // The case may come before the chair: the play takes it as it mounts.
    const eye = await screen.findByRole("slider", { name: E.chair.views.eye });
    await waitFor(() => expect(eye.getAttribute("aria-valuetext")).toMatch(/0\.16/));
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
    expect(await screen.findByRole("button", { name: E.play.pause })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: E.cradle.play.spacings.gap })).toBeChecked();
    expect(sliderText(E.cradle.play.restitution)).toMatch(/^1\b/);
  });

  it("turns the waterwheel's tap down to 5 for its steady turn, and starts it from rest", async () => {
    renderWithProviders(<WaterwheelPage />);
    await screen.findByRole("img", { name: E.waterwheel.views.wheel });
    await setUp(1);
    await waitFor(() => expect(sliderText(E.waterwheel.play.tap)).toMatch(/^5\b/));
    expect(await screen.findByText(E.waterwheel.play.regime_steady)).toBeInTheDocument();
  });

  it("stops the wave's clock at a third of its cycle, where its third case reads the row", async () => {
    renderWithProviders(<WavePage />);
    await screen.findByRole("img", { name: E.wave.views.top });
    await setUp(3);
    expect(await screen.findByRole("button", { name: E.play.run })).toBeInTheDocument();
    expect(screen.getByText(/^20\.0/)).toBeInTheDocument();
  });

  it("rolls a ball on the carousel at 6 rpm and shows it from outside, for its turn", async () => {
    renderWithProviders(<CoriolisPage />);
    await screen.findByRole("img", { name: E.coriolis.view });
    await setUp(3);
    expect(await screen.findByRole("radio", { name: E.coriolis.play.frames.outside })).toBeChecked();
    expect(screen.getByRole("radio", { name: E.coriolis.play.bodies.ball })).toBeChecked();
    expect(sliderText(E.coriolis.play.rpm)).toMatch(/^6\b/);
  });

  it("puts the sun on the horizon with the ozone, for the sky's last case", async () => {
    renderWithProviders(<SkyPage />);
    await screen.findByRole("img", { name: E.sky.sky_view });
    await setUp(4);
    await waitFor(() => expect(sliderText(E.sky.air.height)).toMatch(/^0\b/));
    expect(screen.getByRole("switch", { name: E.sky.air.ozone })).toBeChecked();
  });

  it("drives the Chladni plate 0.2 Hz off its lowest tone, finer than the slider goes, for its sharpness", async () => {
    renderWithProviders(<ChladniPage />);
    await screen.findByRole("img", { name: E.chladni.view });
    await setUp(2);
    await waitFor(() => expect(screen.getByText(/^70\.7/)).toBeInTheDocument());
  });

  it("lets Galileo's bob go from the horizontal with the peg at 60 cm, for the loop at its edge", async () => {
    renderWithProviders(<PegPage />);
    await screen.findByRole("img", { name: E.peg.view });
    await setUp(2);
    await waitFor(() => expect(sliderText(E.peg.change.peg)).toMatch(/^60\b/));
    expect(sliderText(E.peg.change.start)).toMatch(/^90\b/);
  });

  it("hangs Foucault's pendulum at the pole and runs an hour a second, for the pole's turn", async () => {
    renderWithProviders(<FoucaultPage />);
    await screen.findByRole("img", { name: E.foucault.view });
    await setUp(1);
    await waitFor(() => expect(sliderText(E.foucault.play.latitude)).toMatch(/^90\b/));
  });

  it("puts a 1 cm aluminium plate between the falling plates' magnets, for its thickness case", async () => {
    renderWithProviders(<PlatesPage />);
    await screen.findAllByRole("img");
    await setUp(2);
    await waitFor(() => expect(sliderText(E.plates.change.thickness)).toMatch(/^10\b/));
  });

  it("builds a chain-shaped arch of 40 thin stones with the chain beside it, for the arch's second case", async () => {
    renderWithProviders(<ArchPage />);
    await screen.findByRole("img", { name: E.arch.view });
    await setUp(1);
    await waitFor(() => expect(screen.getByRole("switch", { name: E.arch.play.chain })).toBeChecked());
    expect(sliderText(E.arch.play.stones)).toMatch(/^40\b/);
  });

  it("lets the Maxwell wheel go without loss in the bands, for its fall", async () => {
    renderWithProviders(<MaxwellPage />);
    await screen.findAllByRole("img");
    await setUp(0);
    await waitFor(() => expect(screen.queryByRole("button", { name: E.play.pause })).toBeInTheDocument());
  });

  it("drives the resonance table at the 60 cm rod's own beat, and has no button for the case the page cannot show", async () => {
    renderWithProviders(<ResonancePage />);
    await screen.findByRole("img", { name: E.resonance.view });
    const buttons = await screen.findAllByRole("button", { name: E.checks.set_up });
    // Five cases, one of them (the buckling rod) with nothing to set.
    expect(buttons).toHaveLength(4);
    await setUp(1);
    await waitFor(() => expect(sliderText(E.resonance.play.beat)).toMatch(/^2\.09/));
  });

  it("takes the double slit back to the red laser and covers one slit, then opens it again", async () => {
    renderWithProviders(<SlitsPage />);
    await screen.findByRole("img", { name: E.slits.wall_view });
    setSlider(E.slits.play.wavelength, "532");
    setSlider(E.slits.change.spacing, "0.5");
    await setUp(1);
    await waitFor(() => expect(screen.getByRole("switch", { name: E.slits.play.cover })).toBeChecked());
    expect(sliderText(E.slits.play.wavelength)).toMatch(/^650\b/);
    expect(sliderText(E.slits.change.spacing)).toMatch(/^0\.25\b/);
    await setUp(0);
    expect(await screen.findByText(E.slits.play.status_both.replace("{{spacing}}", "5.2"))).toBeInTheDocument();
  });

  it("gives the diver its air back and lets it go just under its hover depth, where it hovers for now", async () => {
    renderWithProviders(<DiverPage />);
    await screen.findByRole("img", { name: E.diver.view });
    setSlider(E.diver.change.air, "2.2");
    await setUp(3);
    expect(await screen.findByText(E.diver.play.motion.hovers)).toBeInTheDocument();
    expect(sliderText(E.diver.play.squeeze)).toMatch(/^10\b/);
    expect(sliderText(E.diver.change.air)).toMatch(/^2\b/);
  });

  it("puts the double cone's rails back from too long to the exhibit's and lets the cone go", async () => {
    renderWithProviders(<ConePage />);
    await screen.findByRole("img", { name: E.cone.views.side });
    setSlider(E.cone.change.length, "50");
    expect(await screen.findByText(E.cone.refused.fall_through)).toBeInTheDocument();
    await setUp(2);
    expect(await screen.findByRole("button", { name: E.play.pause })).toBeInTheDocument();
    expect(sliderText(E.cone.change.length)).toMatch(/^30\b/);
  });

  it("slides the beats' rider to the prong's tip and strikes the forks, the sound left off", async () => {
    renderWithProviders(<BeatsPage />);
    await screen.findByRole("img", { name: E.beats.view });
    await setUp(1);
    await waitFor(() => expect(sliderText(E.beats.change.position)).toMatch(/^100\b/));
    expect(screen.queryByText(E.beats.play.waiting)).not.toBeInTheDocument();
    expect(screen.getByText(E.play.no_sound)).toBeInTheDocument();
  });

  it("fills the parabola's vessel back to 10 cm and spins its table up to 90 rpm, for the spin-up", async () => {
    renderWithProviders(<ParabolaPage />);
    await screen.findByRole("img", { name: E.parabola.views.side });
    setSlider(E.parabola.change.fill, "35");
    expect(await screen.findAllByText(E.parabola.refused)).toHaveLength(2);
    await setUp(4);
    expect(await screen.findByRole("img", { name: E.parabola.views.side })).toBeInTheDocument();
    expect(sliderText(E.parabola.change.fill)).toMatch(/^10\b/);
    expect(sliderText(E.parabola.play.rate)).toMatch(/^90\b/);
    await setUp(2);
    await waitFor(() => expect(sliderText(E.parabola.play.rate)).toMatch(/^160\b/));
  });

  it("tunes the floating top back to 23.5 g in a room not warmed, where it hovers again", async () => {
    renderWithProviders(<LevitationPage />);
    await screen.findByRole("img", { name: E.levitation.view });
    setSlider(E.levitation.play.mass, "24");
    setSlider(E.levitation.play.warming, "3.5");
    expect(await screen.findByText(E.levitation.play.lands)).toBeInTheDocument();
    await setUp(3);
    expect(await screen.findByText(E.levitation.play.hovers)).toBeInTheDocument();
    expect(sliderText(E.levitation.play.warming)).toMatch(/^0\b/);
  });

  it("sets the slow circuit's resistance to its edge, between the 10 Ω steps, and throws the switch", async () => {
    renderWithProviders(<CircuitPage />);
    await screen.findByRole("img", { name: E.circuit.view });
    await setUp(3);
    expect(await screen.findByRole("button", { name: E.play.pause })).toBeInTheDocument();
    // 2√(L/C) = 2529.82 Ω, where rounding puts the engine a hair on the creeping side.
    expect(screen.getByText(E.circuit.change.creeps)).toBeInTheDocument();
    expect(sliderText(E.circuit.change.resistance)).toMatch(/^2,?530\b/);
  });

  it("lays the race's finish back at 120 cm out and 50 cm down, for the straight line's time", async () => {
    renderWithProviders(<RacePage />);
    await screen.findByRole("img", { name: E.race.play.view });
    setSlider(E.race.change.run, "200");
    await setUp(0);
    await waitFor(() => expect(sliderText(E.race.change.run)).toMatch(/^120\b/));
    expect(sliderText(E.race.change.drop)).toMatch(/^50\b/);
  });

  it("lets the double pendulum go in its slow mode, damped, for the damping's case", async () => {
    renderWithProviders(<ChaosPage />);
    await screen.findByRole("img", { name: E.chaos.view });
    await setUp(2);
    await waitFor(() => expect(sliderText(E.chaos.change.damping)).toMatch(/^0\.10\b/));
    // The lower arm at √2°, shown to the slider's whole degree.
    expect(sliderText(E.chaos.play.upper)).toMatch(/^1\b/);
    expect(sliderText(E.chaos.play.lower)).toMatch(/^1\b/);
    expect(await screen.findByRole("button", { name: E.play.pause })).toBeInTheDocument();
  });

  it("builds the steel ball at half its bounce, 5 cm up, after the table-tennis ball, for its rest", async () => {
    renderWithProviders(<BouncePage />);
    await screen.findByRole("img", { name: E.bounce.view });
    await setUp(0);
    await waitFor(() => expect(screen.getByRole("radio", { name: E.bounce.short.tennis })).toBeChecked());
    await setUp(3);
    await waitFor(() => expect(screen.getByRole("radio", { name: E.bounce.short.steel })).toBeChecked());
    expect(sliderText(E.bounce.change.restitution)).toMatch(/^0\.50\b/);
    expect(sliderText(E.bounce.change.height)).toMatch(/^5\b/);
  });

  it("takes the platform's bearing off and leans the visitor out, for the faster-upright case", async () => {
    renderWithProviders(<PlatformPage />);
    await screen.findByRole("img", { name: E.platform.view });
    setSlider(E.platform.play.lean, "10");
    await setUp(1);
    await waitFor(() => expect(sliderText(E.platform.change.friction)).toMatch(/^0\b/));
    await waitFor(() => expect(sliderText(E.platform.play.lean)).toMatch(/^30\b/));
    expect(screen.getByRole("switch", { name: E.platform.play.auto })).not.toBeChecked();
  });

  it("hangs the coupled pendulums back as built and lets them go against each other, for that mode", async () => {
    renderWithProviders(<CoupledPage />);
    await screen.findByRole("img", { name: E.coupled.view });
    setSlider(E.coupled.change.right_length, "30");
    setSlider(E.coupled.change.spring_at, "40");
    expect(await screen.findByText(E.coupled.refused)).toBeInTheDocument();
    await setUp(1);
    await waitFor(() => expect(screen.queryByText(E.coupled.refused)).toBeNull());
    expect(sliderText(E.coupled.change.right_length)).toMatch(/^50\b/);
    expect(sliderText(E.coupled.change.spring_at)).toMatch(/^25\b/);
    expect(await screen.findByRole("button", { name: E.play.pause })).toBeInTheDocument();
  });

  it("puts the smoke drum back as built and sets a full half-second press, for the slug's length", async () => {
    renderWithProviders(<SmokePage />);
    await screen.findByRole("img", { name: E.smoke.view });
    setSlider(E.smoke.change.stroke, "5");
    setSlider(E.smoke.play.duration, "1.5");
    await setUp(1);
    await waitFor(() => expect(sliderText(E.smoke.change.stroke)).toMatch(/^8\b/));
    expect(sliderText(E.smoke.play.duration)).toMatch(/^0\.50\b/);
    expect(sliderText(E.smoke.play.depth)).toMatch(/^8\b/);
  });

  it("makes the bead a water drop, then glass with the ray halfway out, for the rainbow's cases", async () => {
    renderWithProviders(<RainbowPage />);
    await screen.findByRole("img", { name: E.rainbow.bead_view });
    setSlider(E.rainbow.play.impact, "90");
    await setUp(0);
    const kind = screen.getByRole("radiogroup", { name: E.rainbow.change.kind });
    await waitFor(() => expect(within(kind).getByRole("radio", { name: E.rainbow.change.kinds.water })).toBeChecked());
    await setUp(2);
    await waitFor(() => expect(within(kind).getByRole("radio", { name: E.rainbow.change.kinds.glass })).toBeChecked());
    expect(
      screen.getByText(E.rainbow.play.inside.replace("{{angle}}", "16.8").replace("{{bow}}", "21.1")),
    ).toBeInTheDocument();
  });

  it("leaves the cannon's bottom ball alone on a lossless floor, then puts the exhibit's three back", async () => {
    renderWithProviders(<CannonPage />);
    await screen.findByRole("img", { name: E.cannon.view });
    await setUp(1);
    await waitFor(() => expect(screen.getByRole("radio", { name: "1 ball" })).toBeChecked());
    expect(sliderText(E.cannon.change.floor_e)).toMatch(/^1\.00\b/);
    await setUp(0);
    await waitFor(() => expect(screen.getByRole("radio", { name: "3 balls" })).toBeChecked());
    expect(sliderText(E.cannon.change.ball_2)).toMatch(/^5\b/);
  });

  it("tunes the harmonograph to exactly 2 : 3 at 12° each without friction, for the closed figure", async () => {
    renderWithProviders(<HarmonographPage />);
    await screen.findByRole("img", { name: E.harmonograph.views.drawing });
    await setUp(1);
    const slider = (name: string) => sliderText(name);
    await waitFor(() => expect(slider(E.harmonograph.change.detune)).toMatch(/^0\.00\b/));
    expect(slider(E.harmonograph.change.pen_amplitude)).toMatch(/^12\b/);
    expect(slider(E.harmonograph.change.board_amplitude)).toMatch(/^12\b/);
    await setUp(3);
    await waitFor(() => expect(slider(E.harmonograph.change.damping)).toMatch(/^0\.020\b/));
    expect(slider(E.harmonograph.change.pen_amplitude)).toMatch(/^2\b/);
  });

  it("stacks nine blocks in even steps, and offers no button for the furthest stack it holds back", async () => {
    renderWithProviders(<OverhangPage />);
    await screen.findByRole("group", { name: E.overhang.view });
    // Four cases: the furthest stack's two and the count's set nothing.
    expect(await screen.findAllByRole("button", { name: E.checks.set_up })).toHaveLength(1);
    setSlider(E.overhang.play.count, "3");
    await setUp(0);
    await waitFor(() => expect(sliderText(E.overhang.play.count)).toMatch(/^9\b/));
    expect(screen.getByText(/It reaches 18\.0 cm out over the edge/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: E.overhang.play.furthest })).toBeNull();
  });

  it("puts the elephant's trunk upright with the exhibit's air and ball, the ball back on the rim", async () => {
    renderWithProviders(<ElephantPage />);
    await screen.findByRole("img", { name: E.elephant.view });
    setSlider(E.elephant.play.air, "20");
    setSlider(E.elephant.play.tilt, "10");
    await setUp(0);
    await waitFor(() => expect(sliderText(E.elephant.play.air)).toMatch(/^14\.5\b/));
    expect(sliderText(E.elephant.play.tilt)).toMatch(/^0\b/);
    expect(screen.getByRole("switch", { name: E.elephant.play.auto })).not.toBeChecked();
  });

  it("spins the gyroscope's wheel to 600 rpm and lets it go level from rest, for its nods", async () => {
    renderWithProviders(<GyroscopePage />);
    await screen.findByRole("img", { name: E.gyroscope.view });
    await setUp(2);
    await waitFor(() => expect(sliderText(E.gyroscope.play.rpm)).toMatch(/^600\b/));
    expect(sliderText(E.gyroscope.play.tilt)).toMatch(/^90\b/);
    expect(screen.getByRole("radio", { name: E.gyroscope.play.starts.rest })).toBeChecked();
    expect(await screen.findByRole("button", { name: E.play.pause })).toBeInTheDocument();
  });

  it("pushes the ball round the well on its circle, with the felt's brake, for the brake's case", async () => {
    renderWithProviders(<WellPage />);
    await screen.findByRole("img", { name: E.well.view_top });
    await setUp(3);
    await waitFor(() => expect(sliderText(E.well.play.resistance)).toMatch(/^0\.002/));
    expect(sliderText(E.well.play.push)).toMatch(/^0\.44/);
  });

  it("puts a 15 kg car on the coil's track for the brake, without rolling resistance", async () => {
    renderWithProviders(<CoilPage />);
    await setUp(5);
    await waitFor(() => expect(sliderText(E.coil.change.mass)).toMatch(/15/));
    expect(sliderText(E.coil.change.rolling)).toMatch(/^0\b/);
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
    expect(screen.getByRole("button", { name: E.play.pause })).toBeInTheDocument();
  });

  // Every twin that would start moving by itself as its page opens.
  it.each([
    ["coupled pendulums", CoupledPage],
    ["ball cannon", CannonPage],
    ["magnet car", CoilPage],
    ["harmonograph", HarmonographPage],
    ["Bernoulli elephant", ElephantPage],
    ["Cartesian diver", DiverPage],
    ["water parabola", ParabolaPage],
    ["interrupted pendulum", PegPage],
    ["ball in the sphere", SpherePage],
    ["chaotic waterwheel", WaterwheelPage],
    ["pendulum wave", WavePage],
    ["Foucault pendulum", FoucaultPage],
    ["smoke ring", SmokePage],
    ["turntable", PlatformPage],
    ["race and its valley", RacePage],
    ["Coriolis carousel", CoriolisPage],
    ["Chladni plate", ChladniPage],
  ])("the %s starts still, with a button to start it", async (_, Page) => {
    renderWithProviders(<Page />);
    expect((await screen.findAllByRole("button", { name: E.play.run })).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: E.play.pause })).not.toBeInTheDocument();
  });

  it("starts the Coriolis carousel when a throw is thrown", async () => {
    renderWithProviders(<CoriolisPage />);
    fireEvent.click(await screen.findByRole("button", { name: E.coriolis.play.throw }));
    expect(screen.getByRole("button", { name: E.play.pause })).toBeInTheDocument();
  });

  // Paused, a twin's main action starts it: the reader is asking to see it
  // move, and on these pages the action did nothing until Run was pressed.
  const click = (name: string) => () => fireEvent.click(screen.getByRole("button", { name }));
  const slide = (name: string, value: string) => () => setSlider(name, value);
  it.each([
    ["smoke ring", SmokePage, click(E.smoke.play.press)],
    ["ball cannon", CannonPage, click(E.cannon.play.drop)],
    ["turntable", PlatformPage, click(E.platform.play.push)],
    ["Bernoulli elephant", ElephantPage, click(E.elephant.play.push_left)],
    ["Chladni plate", ChladniPage, slide(E.chladni.play.drive, "300")],
    ["Cartesian diver", DiverPage, slide(E.diver.play.squeeze, "2")],
    [
      "ball in the sphere",
      SpherePage,
      () => fireEvent.click(screen.getByRole("radio", { name: E.sphere.play.modes.circle })),
    ],
    ["water parabola", ParabolaPage, slide(E.parabola.play.rate, "120")],
  ])("starts the %s when its main action is taken", async (_, Page, act) => {
    renderWithProviders(<Page />);
    await screen.findAllByRole("button", { name: E.play.run });
    act();
    expect(await screen.findByRole("button", { name: E.play.pause })).toBeInTheDocument();
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
