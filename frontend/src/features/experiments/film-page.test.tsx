/**
 * The soap film's page against a mocked engine whose answer is the real
 * engine's (`src/test/experiments.ts`): the film between the rings, the two
 * discs past 1.055 radii, the tear past 1.3255 and the distance it is held
 * back until then, and a new dip.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { E, legends, mockExperiments, setSlider } from "@/test/experiments";
import { renderWithProviders } from "@/test/render";
import { FilmPage } from "./film-page";
import { useTried } from "./tried";

beforeEach(() => {
  useTried.getState().forget();
  mockExperiments();
});

const least = (area: string, discs: string) => E.film.play.least.replace("{{area}}", area).replace("{{discs}}", discs);
const held = (area: string, discs: string) => E.film.play.held.replace("{{area}}", area).replace("{{discs}}", discs);

describe("the soap film between two rings", () => {
  it("starts with the rings a centimetre apart and the film the least area, with its equations", async () => {
    renderWithProviders(<FilmPage />);
    expect(await screen.findByRole("group", { name: E.film.view })).toBeInTheDocument();
    expect(screen.getByText(least("31.4", "157.1"))).toBeInTheDocument();
    // The distance it tears at is the page's question: held back.
    expect(screen.queryByText(E.film.figures.tear)).not.toBeInTheDocument();
    expect(legends()).toHaveLength(10);
  });

  it("is no longer the least area past 1.055 radii, and still holds", async () => {
    renderWithProviders(<FilmPage />);
    await screen.findByRole("group", { name: E.film.view });
    setSlider(E.film.play.distance, "5.2");
    expect(screen.getByText(least("155.1", "157.1"))).toBeInTheDocument();
    setSlider(E.film.play.distance, "5.4");
    expect(screen.getByText(held("160.2", "157.1"))).toBeInTheDocument();
  });

  it("tears when the ring is drawn past 6.63 cm, stays torn when pushed back, and is whole again when dipped", async () => {
    renderWithProviders(<FilmPage />);
    const ring = await screen.findByRole("slider", { name: E.film.play.ring });
    for (let i = 0; i < 5; i++) fireEvent.keyDown(ring, { key: "ArrowRight", shiftKey: true });
    for (let i = 0; i < 6; i++) fireEvent.keyDown(ring, { key: "ArrowRight" });
    expect(ring).toHaveAttribute("aria-valuenow", "6.6");
    expect(screen.queryByText(E.film.play.torn)).not.toBeInTheDocument();
    fireEvent.keyDown(ring, { key: "ArrowRight" });
    expect(screen.getByText(E.film.play.torn)).toBeInTheDocument();
    // Torn, the reader has found the distance: now it is shown.
    expect(screen.getByText(E.film.figures.tear)).toBeInTheDocument();
    fireEvent.keyDown(ring, { key: "ArrowLeft", shiftKey: true });
    expect(screen.getByText(E.film.play.torn)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: E.film.play.dip }));
    expect(screen.getByText(least("31.4", "157.1"))).toBeInTheDocument();
  });

  it("tears at once when the rings are made smaller than the distance allows", async () => {
    renderWithProviders(<FilmPage />);
    await screen.findByRole("group", { name: E.film.view });
    setSlider(E.film.play.distance, "4.5");
    setSlider(E.film.play.radius, "3");
    expect(screen.getByText(E.film.play.torn)).toBeInTheDocument();
  });
});
