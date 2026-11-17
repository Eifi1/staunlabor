import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { useConfirm } from "@eifi1/ui-kit";
import { KitProviders } from "./kit-providers";

/** What the kit's feedback thread does at a reader's own comment: ask first. */
function AsksFirst() {
  const confirm = useConfirm();
  return (
    <button type="button" onClick={() => void confirm({ title: "Delete this comment?" })}>
      Delete
    </button>
  );
}

describe("the kit's providers", () => {
  // Not through `renderWithProviders`, which uses this tree itself: here the
  // tree stands alone, as main.tsx mounts it.
  it("answer a confirm, as the feedback thread's delete button asks for one", () => {
    render(
      <MemoryRouter>
        <KitProviders>
          <AsksFirst />
        </KitProviders>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("alertdialog", { name: "Delete this comment?" })).toBeInTheDocument();
  });
});
