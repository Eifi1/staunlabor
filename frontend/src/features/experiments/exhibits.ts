/**
 * The exhibits, in the order the lists show them (the oldest first), and
 * what the overview says about each besides its name: the physics it is about
 * (`topics`, the overview's filter), the course's lessons its computation
 * stands on (`lessons`, linked from the overview's card and from the page's
 * "How it is computed"), and the day it joins the experiment of the week
 * (`since`, `weekly.ts`).
 *
 * Each has its page at the site's top level (`/cannon`): an exhibit is listed
 * once it is built, since `exhibit-modules.ts` wants a page for every one.
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
  | "vessel"
  | "bounce"
  | "overhang"
  | "diver"
  | "ship"
  | "rainbow"
  | "sky"
  | "slits"
  | "beats"
  | "spring"
  | "kapitza"
  | "galton"
  | "film"
  | "polarizer"
  | "jet"
  | "string"
  | "metronomes";

/** What an exhibit is about, as a reader would look for it: one word each,
 *  and an exhibit may be about two. */
export type Topic =
  | "momentum"
  | "angular_momentum"
  | "energy"
  | "oscillation"
  | "equilibrium"
  | "flow"
  | "induction"
  | "chance"
  | "light"
  | "perception";

/** The order the overview's chips stand in: the mechanics first, then the rest;
 *  chance, the Galton board's, before light and perception. */
export const TOPICS: readonly Topic[] = [
  "momentum",
  "angular_momentum",
  "energy",
  "oscillation",
  "equilibrium",
  "flow",
  "induction",
  "chance",
  "light",
  "perception",
];

/** The course's lessons an exhibit's computation stands on: the basics, the
 *  course on differential equations whose lessons 0–6 moved here from
 *  Kurvenschmiede, where these exhibits were first built, and live under
 *  `/basics` (`docs/course.md`; `course/lessons.ts`'s `lessonEntry`). */
export type CourseLesson = "first_order" | "second_order" | "eigenvalues" | "laplace" | "numerics" | "two_mass";

export interface ExhibitEntry {
  exhibit: Exhibit;
  /** The page's address. */
  path: string;
  topics: readonly Topic[];
  /** Empty for an exhibit that is geometry, not a motion (the chair). */
  lessons: readonly CourseLesson[];
  /** The day it joins the experiment of the week: the day it ships, never one
   *  before (`weekly.ts` says why). */
  since: string;
}

export const OVERVIEW_PATH = "/";

/** The page of every exhibit, the header's "Exhibits". */
export const EXHIBITS_PATH = "/exhibits";

/** Where the list of every exhibit was until 2026-11-20, the front page's
 *  lower half: the front page sends a link to it on to `EXHIBITS_PATH`. */
export const EXHIBITS_ANCHOR = "all-exhibits";

/**
 * The day the second series shipped, the joint deploy (Marcel, 2026-11-15: the
 * next deploy after the last kit versions are released). It is before the
 * experiment of the week's first Monday (`weekly.ts`), so the whole series is
 * in its first round.
 */
export const SECOND_SERIES = "2026-11-16";

/**
 * The day the third series ships (`docs/plan.md`, "The third series"): its ten
 * join the experiment of the week's first round that starts on or after it.
 * A placeholder until the deploy is set (Marcel, 2026-11-23: all ten in one
 * series); set it to the deploy day before that deploy, never to a past day.
 */
export const THIRD_SERIES = "2026-11-30";

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
  {
    exhibit: "diver",
    path: "/diver",
    topics: ["equilibrium"],
    lessons: ["second_order"],
    since: SECOND_SERIES,
  },
  {
    exhibit: "rainbow",
    path: "/rainbow",
    topics: ["light"],
    lessons: [],
    since: SECOND_SERIES,
  },
  {
    exhibit: "sky",
    path: "/sky",
    topics: ["light"],
    lessons: ["first_order"],
    since: SECOND_SERIES,
  },
  {
    exhibit: "slits",
    path: "/slits",
    topics: ["light"],
    lessons: [],
    since: SECOND_SERIES,
  },
  {
    exhibit: "beats",
    path: "/beats",
    topics: ["oscillation", "perception"],
    lessons: ["second_order"],
    since: SECOND_SERIES,
  },
  // The third series: from THIRD_SERIES on.
  {
    exhibit: "spring",
    path: "/spring",
    topics: ["oscillation", "energy"],
    lessons: ["eigenvalues", "two_mass"],
    since: THIRD_SERIES,
  },
  {
    exhibit: "metronomes",
    path: "/metronomes",
    topics: ["oscillation"],
    lessons: ["second_order", "numerics"],
    since: THIRD_SERIES,
  },
  {
    exhibit: "string",
    path: "/string",
    topics: ["oscillation"],
    lessons: ["eigenvalues", "laplace"],
    since: THIRD_SERIES,
  },
  {
    exhibit: "kapitza",
    path: "/kapitza",
    topics: ["equilibrium", "oscillation"],
    lessons: ["eigenvalues", "numerics"],
    since: THIRD_SERIES,
  },
  { exhibit: "ship", path: "/ship", topics: ["equilibrium"], lessons: ["second_order"], since: THIRD_SERIES },
  { exhibit: "film", path: "/film", topics: ["equilibrium"], lessons: [], since: THIRD_SERIES },
  { exhibit: "vessel", path: "/vessel", topics: ["flow"], lessons: ["first_order"], since: THIRD_SERIES },
  { exhibit: "galton", path: "/galton", topics: ["chance"], lessons: [], since: THIRD_SERIES },
  {
    exhibit: "polarizer",
    path: "/polarizer",
    topics: ["light"],
    lessons: [],
    since: THIRD_SERIES,
  },
  { exhibit: "jet", path: "/jet", topics: ["light"], lessons: [], since: THIRD_SERIES },
];

export function exhibitEntry(exhibit: Exhibit): ExhibitEntry {
  return EXHIBITS.find((entry) => entry.exhibit === exhibit) ?? EXHIBITS[0];
}

/** `count` of `entries` drawn at random, each as likely as any other, in the
 *  list's order: the front page's selection, new on every visit, so an exhibit
 *  added last is as likely to be shown as the first (Marcel, 2026-11-22: "random
 *  sechs Exponate"). Neither the first six, which would never show a new one,
 *  nor the newest, which would never show the old. */
export function sampled<T>(entries: readonly T[], count: number, random: () => number = Math.random): T[] {
  const indices = entries.map((_, i) => i);
  // The first `count` steps of a Fisher–Yates shuffle.
  for (let i = 0; i < Math.min(count, indices.length); i++) {
    const j = i + Math.floor(random() * (indices.length - i));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices
    .slice(0, count)
    .sort((a, b) => a - b)
    .map((i) => entries[i]);
}

/** The topics some exhibit has: a chip, or a figure, for a topic with none
 *  would promise what the page cannot show. */
export const TOPICS_SHOWN: readonly Topic[] = TOPICS.filter((topic) =>
  EXHIBITS.some((entry) => entry.topics.includes(topic)),
);
