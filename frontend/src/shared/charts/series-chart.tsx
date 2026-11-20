import type { ComponentProps } from "react";
import { SeriesChart as KitSeriesChart, cn } from "@eifi1/ui-kit";

const GRID_INK = "[&_.recharts-cartesian-grid_line]:!stroke-strong/30";

/**
 * The line chart every exhibit draws — `@eifi1/ui-kit`'s `SeriesChart`, with
 * the site's two opinions about it applied in one place. Everything else (the
 * axes per channel, the zoom, the helpers a page builds its series with) is the
 * kit's; import those from it.
 *
 * * **The grid ink.** The kit draws its grid faintly, right for a dashboard
 *   tile; these are plots somebody reads a value off, on a projector as often
 *   as not. `--border-strong` at 30 % is a token, so More contrast steps it.
 *   `!` because the rule it overrules has the same specificity, and a grid
 *   whose colour depends on the order Tailwind emits two classes in changes on
 *   an upgrade.
 * * **An empty chart is blank.** It is empty mostly because the reader switched
 *   every line off with the legend beside it, where the kit's "No data" would
 *   be untrue.
 *
 * The chart is named by its axes (the kit's default), so a call site passes an
 * `aria-label` only when it has a better name.
 */
export function SeriesChart({ className, empty = null, ...props }: ComponentProps<typeof KitSeriesChart>) {
  return <KitSeriesChart {...props} empty={empty} className={cn(GRID_INK, className)} />;
}

/**
 * The most rows a chart of a long table hands recharts — the kit's `maxRows`,
 * on the course's charts, some of which draw thousands of samples.
 *
 * A chart cannot draw more points than the plot has pixels, so a long table is
 * thinned, and how decides what the reader sees: a stride aliases (a fast
 * wave kept every sixth sample is drawn as a slow one, with confidence) and
 * drops a one-sample spike between two kept samples. `maxRows` thins by the
 * **envelope** instead — from each stretch the rows where each line is lowest
 * and highest, and each line's first and last — so every line reaches every
 * extreme the table has, and a zoom thins the window on show. That is why a
 * chart is handed every row. Two thousand is about what a plot's pixels show.
 * (Kurvenschmiede's `PLOT_ROWS`, with the course.)
 */
export const PLOT_ROWS = 2000;
