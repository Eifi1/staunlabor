/**
 * The column every page sits in, the header's included: at most 1160 px of
 * content, centred, with a gutter that grows past a phone (Marcel's spec of
 * 2026-11-20, "1160 px container everywhere, exhibit pages included"). Before
 * it, a page ran the full width of the window, and on a wide screen the front
 * page's drawing grew with it while its text stayed where it was.
 */
export const CONTAINER = "mx-auto w-full max-w-[calc(1160px+3rem)] px-3 md:px-6";

/** A page in that column: its parts one under the other. */
export const PAGE_SHELL = `${CONTAINER} flex flex-col gap-4 py-4`;
