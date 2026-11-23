import { useCallback } from "react";
import { createFixedPalette } from "@eifi1/ui-kit";
import { useTheme } from "@/shared/state/theme-store";

/** The chart palette: the kit's fixed one, light or dark with the theme. */
export const { useChartHex } = createFixedPalette(useTheme);

/**
 * The palette by index: `hue(i)` is the i-th colour, counted round the
 * palette, so an index past its end is still a colour and never `undefined`
 * in a `stroke`. The exhibits name their hues as indices (`LINE_HUE = 2`);
 * this is the one place the wrap is written, where 128 call sites spelt out
 * `hex[i % hex.length]` each. The same function for as long as the palette
 * is the same, so a memo that draws with it keeps.
 */
export function useChartHue(): (index: number) => string {
  const hex = useChartHex();
  return useCallback((index) => hex[index % hex.length], [hex]);
}
