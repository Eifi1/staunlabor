/**
 * The exhibits, in the order the site's strip and the overview show them, and
 * what the overview says about each besides its name: the physics it is about
 * (`topics`, the overview's filter), the course's lessons its computation
 * stands on (`lessons`, linked from the overview's card and from the page's
 * "How it is computed"), and the day it joins the experiment of the day
 * (`since`, `daily.ts`).
 *
 * Only the built ones have a path, at the site's top level (`/cannon`); the
 * others are listed so the overview can say what is coming.
 */

export type Exhibit = "chair" | "coil" | "sphere" | "platform" | "race" | "elephant" | "smoke" | "cannon";

/** What an exhibit is about, as a reader would look for it: one word each,
 *  and an exhibit may be about two. */
export type Topic = "momentum" | "angular_momentum" | "energy" | "oscillation" | "flow" | "induction" | "perception";

/** The order the overview's chips stand in: the mechanics first, then the rest. */
export const TOPICS: readonly Topic[] = [
  "momentum",
  "angular_momentum",
  "energy",
  "oscillation",
  "flow",
  "induction",
  "perception",
];

/** The course's lessons an exhibit's computation stands on: the course on
 *  differential equations in Kurvenschmiede, public and free, where these
 *  exhibits were first built (`exhibit-frame.tsx`'s `lessonPath`). */
export type CourseLesson = "first_order" | "second_order" | "numerics";

export interface ExhibitEntry {
  exhibit: Exhibit;
  /** The page's address, once it is built. */
  path: string | null;
  topics: readonly Topic[];
  /** Empty for an exhibit that is geometry, not a motion (the chair). */
  lessons: readonly CourseLesson[];
  /** The day it joins the experiment of the day: the day it ships, never one
   *  before (`daily.ts` says why). */
  since: string;
}

export const OVERVIEW_PATH = "/";

export const EXHIBITS: readonly ExhibitEntry[] = [
  { exhibit: "chair", path: "/chair", topics: ["perception"], lessons: [], since: "2026-11-12" },
  {
    exhibit: "coil",
    path: "/coil",
    topics: ["induction", "energy"],
    lessons: ["first_order", "second_order", "numerics"],
    since: "2026-11-12",
  },
  {
    exhibit: "sphere",
    path: "/sphere",
    topics: ["oscillation"],
    lessons: ["second_order", "numerics"],
    since: "2026-11-12",
  },
  {
    exhibit: "platform",
    path: "/platform",
    topics: ["angular_momentum"],
    lessons: ["first_order"],
    since: "2026-11-12",
  },
  { exhibit: "race", path: "/race", topics: ["energy"], lessons: ["numerics"], since: "2026-11-12" },
  {
    exhibit: "elephant",
    path: "/elephant",
    topics: ["flow"],
    lessons: ["second_order", "numerics"],
    since: "2026-11-12",
  },
  {
    exhibit: "smoke",
    path: "/smoke",
    topics: ["flow"],
    lessons: ["first_order", "numerics"],
    since: "2026-11-12",
  },
  {
    exhibit: "cannon",
    path: "/cannon",
    topics: ["momentum", "energy"],
    lessons: ["second_order", "numerics"],
    since: "2026-11-12",
  },
];

export function exhibitEntry(exhibit: Exhibit): ExhibitEntry {
  return EXHIBITS.find((entry) => entry.exhibit === exhibit) ?? EXHIBITS[0];
}

/** The built exhibit whose page `pathname` is, if any. */
export function exhibitAt(pathname: string): ExhibitEntry | undefined {
  const path = pathname.replace(/\/+$/, "");
  return EXHIBITS.find((entry) => entry.path === path);
}
