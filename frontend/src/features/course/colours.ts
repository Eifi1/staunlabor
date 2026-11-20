/**
 * What each colour means, in every lesson.
 *
 * The specification fixed the meanings — the measuring chain blue, the test
 * object orange, poles and instability coral, envelopes green, setpoints grey
 * and dashed — so a reader who has learnt them in one lesson reads the next
 * without a legend. The hues themselves are the site's chart palette
 * (`useChartHex`: anyplot's Imprint since ui-kit 0.49, eight hues, the same in
 * light and dark), so the meanings map onto its nearest members: blue for the
 * measuring chain (also the one Imprint hue that holds 3:1 on both surfaces, for
 * the line every lesson draws), ochre for the test object (Imprint has no
 * orange), matte red for poles and instability, green for envelopes. Indices
 * into that palette, so a palette change in the design system carries through —
 * and why they were remapped by meaning when the palette went from Paul Tol's
 * nine to Imprint's eight, rather than kept by number: index 0 was indigo there
 * and is green here.
 *
 * `second`, `third` and `fourth` are the lines with no meaning of their own;
 * wherever they meet one another or the named ones they come out distinct.
 */
export const HUE = {
  measuring: 2,
  object: 3,
  pole: 4,
  envelope: 0,
  second: 1,
  third: 6,
  fourth: 7,
} as const;

/** A setpoint, a reference, a target: the page's own grey, dashed. */
export const REFERENCE_GREY = "var(--text-muted)";
