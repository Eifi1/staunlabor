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
