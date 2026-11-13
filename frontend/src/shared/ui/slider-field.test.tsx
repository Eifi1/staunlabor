/**
 * A logarithmic slider's leftmost stop is its minimum, never zero: every log
 * slider on an exhibit is a quantity the engine refuses at zero (the cannon's
 * Young's modulus, the smoke ring's Reynolds number), so a zero stop sent a
 * value that came back as an error.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { SliderField } from "./slider-field";

function slider(props: Partial<Parameters<typeof SliderField>[0]> = {}) {
  const onChange = vi.fn();
  renderWithProviders(
    <SliderField
      label="Stiffness"
      unit="MPa"
      value={3}
      min={0.5}
      max={200}
      step={0.5}
      digits={1}
      log
      onChange={onChange}
      {...props}
    />,
  );
  return { onChange, track: screen.getByRole("slider", { name: "Stiffness" }) };
}

describe("a logarithmic slider", () => {
  it("stops at its minimum on the left, not at zero", () => {
    const { onChange, track } = slider();
    fireEvent.change(track, { target: { value: "0" } });
    expect(onChange).toHaveBeenCalledWith(0.5);
  });

  it("offers zero only where a page asks for it", () => {
    const { onChange, track } = slider({ zeroStop: true });
    fireEvent.change(track, { target: { value: "0" } });
    expect(onChange).toHaveBeenCalledWith(0);
  });
});
