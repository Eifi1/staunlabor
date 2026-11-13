import { createFixedPalette } from "@eifi1/ui-kit";
import { useTheme } from "@/shared/state/theme-store";

/** The chart palette: the kit's fixed one, light or dark with the theme. */
export const { useChartHex } = createFixedPalette(useTheme);
