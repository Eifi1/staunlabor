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

export type Exhibit =
  | "chair"
  | "coil"
  | "sphere"
  | "platform"
  | "race"
  | "elephant"
  | "smoke"
  | "cannon"
  | "wave"
  | "harmonograph"
  | "cone"
  | "parabola"
  | "coupled"
  | "peg"
  | "maxwell"
  | "chaos"
  | "waterwheel"
  | "foucault"
  | "coriolis"
  | "cradle"
  | "well"
  | "resonance"
  | "gyroscope"
  | "arch"
  | "chladni"
  | "levitation"
  | "circuit"
  | "plates"
  | "bounce"
  | "overhang";

/** What an exhibit is about, as a reader would look for it: one word each,
 *  and an exhibit may be about two. */
export type Topic =
  "momentum" | "angular_momentum" | "energy" | "oscillation" | "equilibrium" | "flow" | "induction" | "perception";

/** The order the overview's chips stand in: the mechanics first, then the rest. */
export const TOPICS: readonly Topic[] = [
  "momentum",
  "angular_momentum",
  "energy",
  "oscillation",
  "equilibrium",
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

/**
 * The day the second series joins the experiment of the day, and the day the
 * draw's maluses weaken (`daily.ts`): the day of the joint deploy, set when it
 * goes out (Marcel, 2026-11-15: the next deploy after the last kit versions are
 * released). Never a day before the deploy: a past day would redraw a round the
 * live site has already shown.
 */
export const SECOND_SERIES = "2026-12-01";

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
  // The second series: from SECOND_SERIES on.
  { exhibit: "wave", path: "/wave", topics: ["oscillation"], lessons: ["second_order"], since: SECOND_SERIES },
  {
    exhibit: "harmonograph",
    path: "/harmonograph",
    topics: ["oscillation"],
    lessons: ["second_order", "numerics"],
    since: SECOND_SERIES,
  },
  { exhibit: "cone", path: "/cone", topics: ["energy"], lessons: ["numerics"], since: SECOND_SERIES },
  {
    exhibit: "parabola",
    path: "/parabola",
    topics: ["angular_momentum", "flow"],
    lessons: ["first_order", "numerics"],
    since: SECOND_SERIES,
  },
  {
    exhibit: "coupled",
    path: "/coupled",
    topics: ["oscillation", "energy"],
    lessons: ["second_order", "numerics"],
    since: SECOND_SERIES,
  },
  { exhibit: "peg", path: "/peg", topics: ["energy"], lessons: ["second_order", "numerics"], since: SECOND_SERIES },
  {
    exhibit: "maxwell",
    path: "/maxwell",
    topics: ["energy", "angular_momentum"],
    lessons: ["second_order"],
    since: SECOND_SERIES,
  },
  {
    exhibit: "chaos",
    path: "/chaos",
    topics: ["oscillation", "energy"],
    lessons: ["second_order", "numerics"],
    since: SECOND_SERIES,
  },
  {
    exhibit: "waterwheel",
    path: "/waterwheel",
    topics: ["flow", "angular_momentum"],
    lessons: ["first_order", "numerics"],
    since: SECOND_SERIES,
  },
  {
    exhibit: "foucault",
    path: "/foucault",
    topics: ["oscillation", "angular_momentum"],
    lessons: ["second_order"],
    since: SECOND_SERIES,
  },
  {
    exhibit: "coriolis",
    path: "/coriolis",
    topics: ["momentum", "angular_momentum"],
    lessons: ["second_order"],
    since: SECOND_SERIES,
  },
  {
    exhibit: "cradle",
    path: "/cradle",
    topics: ["momentum", "energy"],
    lessons: ["second_order", "numerics"],
    since: SECOND_SERIES,
  },
  {
    exhibit: "well",
    path: "/well",
    topics: ["angular_momentum", "energy"],
    lessons: ["second_order", "numerics"],
    since: SECOND_SERIES,
  },
  {
    exhibit: "resonance",
    path: "/resonance",
    topics: ["oscillation", "energy"],
    lessons: ["second_order", "numerics"],
    since: SECOND_SERIES,
  },
  {
    exhibit: "gyroscope",
    path: "/gyroscope",
    topics: ["angular_momentum"],
    lessons: ["second_order", "numerics"],
    since: SECOND_SERIES,
  },
  {
    exhibit: "arch",
    path: "/arch",
    topics: ["equilibrium"],
    lessons: [],
    since: SECOND_SERIES,
  },
  {
    exhibit: "chladni",
    path: "/chladni",
    topics: ["oscillation"],
    lessons: [],
    since: SECOND_SERIES,
  },
  {
    exhibit: "levitation",
    path: "/levitation",
    topics: ["equilibrium"],
    lessons: [],
    since: SECOND_SERIES,
  },
  {
    exhibit: "circuit",
    path: "/circuit",
    topics: ["oscillation", "induction"],
    lessons: ["second_order"],
    since: SECOND_SERIES,
  },
  {
    exhibit: "plates",
    path: "/plates",
    topics: ["induction"],
    lessons: ["first_order"],
    since: SECOND_SERIES,
  },
  {
    exhibit: "bounce",
    path: "/bounce",
    topics: ["momentum"],
    lessons: [],
    since: SECOND_SERIES,
  },
  {
    exhibit: "overhang",
    path: "/overhang",
    topics: ["equilibrium"],
    lessons: [],
    since: SECOND_SERIES,
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
