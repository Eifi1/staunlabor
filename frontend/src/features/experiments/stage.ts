/**
 * How big an exhibit's drawing may get: never so tall that the controls under
 * it leave the screen.
 *
 * Every drawing here is an SVG as wide as its column and as tall as its
 * proportions make it, and on a phone or a laptop that is right. On a wide
 * display it is wrong in a way that is easy to miss on a normal one: a square
 * as wide as a third of a 3000 px window is 1000 px tall, so the chair's three
 * views filled a 1160 px screen and its sliders sat below the fold: on a large
 * screen one saw less instead of more. The width is not the scarce thing on a
 * wide display; the height is, so the cap is a share of the viewport's
 * height, and a group of views side by side is capped as a group and centred,
 * so the views keep their gaps instead of drifting apart.
 *
 * `dvh` rather than `vh`: on a phone `vh` is the height with the browser's bar
 * hidden, and a drawing sized by it is cut off whenever the bar shows. The
 * classes are written out whole, one per layout, because Tailwind finds a class
 * only as a literal string; the share they all use is 60 % of the height, and
 * changing it means changing every one of them.
 *
 * The other half of the same observation is that a wide display has width to
 * spare, so from `2xl` up the controls stand in a column beside the views
 * (`SIDE`), where they are read while the views move, instead of under them.
 *
 * What this does not do is shrink a drawing on a phone: there the column is
 * narrower than the cap and nothing changes.
 */
export const STAGE = {
  /** One square drawing with a column of controls beside it from `md` up:
   *  the square's cap plus the 18rem column and its 1rem gap. */
  withSide: "mx-auto w-full max-w-[calc(60dvh_+_19rem)]",
  /** Two square drawings side by side, 1rem apart. */
  two: "mx-auto w-full max-w-[calc(120dvh_+_1rem)]",
  /** Three square drawings side by side, 1rem apart. */
  three: "mx-auto w-full max-w-[calc(180dvh_+_2rem)]",
  /** Views and a column of controls beside them from `2xl` up, capped as one
   *  group, so the column stands next to the views rather than across a gap
   *  at the far edge: the views' own cap, the 18rem column and its 1rem gap. */
  twoWithSide: "mx-auto w-full max-w-[calc(120dvh_+_20rem)]",
  threeWithSide: "mx-auto w-full max-w-[calc(180dvh_+_21rem)]",
  /** A drawing wider than tall: it keeps the column's width and its height
   *  stops at the cap, the picture centred in it (`xMidYMid meet`, the SVG
   *  default), so a framed one keeps its frame across the column. */
  wide: "max-h-[60dvh]",
} as const;

/**
 * The views and their controls from `2xl` up: views on the left, an 18rem
 * column on the right, and the order in the markup kept for the narrower
 * widths, where the controls follow the views. `top` is what stands above the
 * views below `2xl` (a choice of who drives) and heads the column beside them.
 */
export const SIDE = {
  grid: "grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1fr)_18rem] 2xl:grid-rows-[auto_1fr] 2xl:items-start",
  top: "2xl:col-start-2 2xl:row-start-1",
  views: "space-y-4 2xl:col-start-1 2xl:row-span-2 2xl:row-start-1",
  column: "space-y-4 2xl:col-start-2 2xl:row-start-2",
} as const;
