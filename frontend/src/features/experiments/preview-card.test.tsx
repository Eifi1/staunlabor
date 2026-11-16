import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "@/shared/i18n/locales/en.json";
import { renderWithProviders } from "@/test/render";
import { PreviewCard } from "./preview-card";

vi.mock("./exhibit-preview", () => ({
  ExhibitPreview: ({ exhibit, still }: { exhibit: string; still?: boolean }) => (
    <svg data-testid={`preview-${exhibit}`} data-held={String(Boolean(still))} />
  ),
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the link-preview card", () => {
  it("shows an exhibit's preview beside its title, its question and its address", () => {
    renderWithProviders(<PreviewCard card="sky" held={false} />);
    expect(screen.getByRole("heading", { name: en.experiments.exhibits.sky.title })).toBeInTheDocument();
    expect(screen.getByText(en.experiments.exhibits.sky.question)).toBeInTheDocument();
    expect(screen.getByText("staunlabor.app/sky")).toBeInTheDocument();
    expect(screen.getByTestId("preview-sky")).toHaveAttribute("data-held", "false");
  });

  it("shows the overview as the site's line beside four previews, all held once it is told to hold them", () => {
    renderWithProviders(<PreviewCard card="overview" held />);
    expect(screen.getByText(en.app.tagline)).toBeInTheDocument();
    const previews = screen.getAllByTestId(/^preview-/);
    expect(previews).toHaveLength(4);
    for (const preview of previews) expect(preview).toHaveAttribute("data-held", "true");
  });

  it("scales a preview taller than its box down until it fits, and leaves one that fits alone", () => {
    let height = 1068;
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(() => height);
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(private readonly changed: () => void) {}
        observe() {
          this.changed();
        }
        disconnect() {}
      },
    );
    const { unmount } = renderWithProviders(<PreviewCard card="elephant" held={false} />);
    const frame = screen.getByTestId("preview-elephant").closest("[data-still]");
    expect(frame).toHaveStyle({ transform: "scale(0.5)" });
    unmount();
    height = 400;
    renderWithProviders(<PreviewCard card="elephant" held={false} />);
    expect(screen.getByTestId("preview-elephant").closest("[data-still]")?.getAttribute("style")).toBeNull();
  });
});
