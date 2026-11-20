import type { Lesson } from "@/shared/types";

/** Where the course starts: lesson 0, the recipe. */
export const BASICS_PATH = "/basics";

/**
 * The course's lessons in the order a reader meets them, and the address of
 * each — one list for the front page's tiles, the previous and next links
 * under every lesson and the route table's paths.
 *
 * Lessons 0–6 and the cheat sheet, moved from Kurvenschmiede's course on
 * differential equations (`docs/plan.md`, "The third stage"); its lessons 7–10
 * stayed there. The cheat sheet follows lesson 6 as lesson 7, so the numbers
 * here run without a gap.
 */
export const LESSONS: readonly { lesson: Lesson; path: string; number: number }[] = [
  { lesson: "recipe", path: BASICS_PATH, number: 0 },
  { lesson: "first_order", path: `${BASICS_PATH}/first-order`, number: 1 },
  { lesson: "second_order", path: `${BASICS_PATH}/second-order`, number: 2 },
  { lesson: "eigenvalues", path: `${BASICS_PATH}/eigenvalues`, number: 3 },
  { lesson: "laplace", path: `${BASICS_PATH}/laplace`, number: 4 },
  { lesson: "numerics", path: `${BASICS_PATH}/numerics`, number: 5 },
  { lesson: "two_mass", path: `${BASICS_PATH}/two-mass`, number: 6 },
  { lesson: "cheat_sheet", path: `${BASICS_PATH}/cheat-sheet`, number: 7 },
];

export function lessonEntry(lesson: Lesson): (typeof LESSONS)[number] {
  return LESSONS.find((entry) => entry.lesson === lesson) ?? LESSONS[0];
}

/** The lessons either side of one, for the links under it. */
export function neighbours(lesson: Lesson): {
  previous: (typeof LESSONS)[number] | null;
  next: (typeof LESSONS)[number] | null;
} {
  const at = LESSONS.findIndex((entry) => entry.lesson === lesson);
  return { previous: LESSONS[at - 1] ?? null, next: LESSONS[at + 1] ?? null };
}
