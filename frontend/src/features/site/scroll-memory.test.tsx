import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router";
import { useScrollMemory } from "./scroll-memory";

/** A page that keeps the scroll memory and can go on or back. */
function Probe() {
  useScrollMemory();
  const navigate = useNavigate();
  return (
    <>
      <button onClick={() => void navigate("/exhibits")}>on</button>
      <button onClick={() => void navigate(-1)}>back</button>
    </>
  );
}

describe("the scroll memory", () => {
  // jsdom scrolls nothing: the window's position is the last one asked for.
  let y = 0;
  const scrollTo = vi.fn((_x: number, top: number) => {
    y = top;
  });
  beforeEach(() => {
    y = 0;
    scrollTo.mockClear();
    vi.spyOn(window, "scrollTo").mockImplementation(scrollTo as unknown as typeof window.scrollTo);
    vi.spyOn(window, "scrollY", "get").mockImplementation(() => y);
  });
  afterEach(() => vi.restoreAllMocks());

  it("starts a new page at its top, and goes back to where the last one was left", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="*" element={<Probe />} />
        </Routes>
      </MemoryRouter>,
    );
    // The reader scrolls down the front page and clicks on.
    y = 1240;
    fireEvent.scroll(window);
    fireEvent.click(screen.getByRole("button", { name: "on" }));
    expect(scrollTo).toHaveBeenLastCalledWith(0, 0);
    // Further down the new page, then back with the mouse's side button.
    y = 300;
    fireEvent.scroll(window);
    fireEvent.click(screen.getByRole("button", { name: "back" }));
    expect(scrollTo).toHaveBeenLastCalledWith(0, 1240);
  });
});
