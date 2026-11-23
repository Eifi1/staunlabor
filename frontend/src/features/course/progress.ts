import { create } from "zustand";
import { readStoredJson, writeStoredJson } from "@eifi1/ui-kit";
import type { Lesson } from "@/shared/types";
import { STORAGE } from "@/shared/lib/storage-keys";

/**
 * A reader's way through the course, on this device.
 *
 * Which lessons were opened, which exercises solved — with how many attempts
 * and the estimate made before the answer — and the **surprises**: every
 * estimate more than half off, which is the list a reader learns most from
 * reading back. The course is public and holds nothing of anybody's, so the
 * browser is the whole record (`STORAGE.courseProgress` says so on the privacy
 * page); a reader on another device starts again.
 *
 * Every read and write is guarded: a private window, blocked site data or a
 * full quota leaves the course working with an empty record rather than broken.
 */

export interface ExerciseRecord {
  solved: boolean;
  attempts: number;
  /** The reader's estimate, made before the answer was shown, if asked for one. */
  estimate: number | null;
}

export interface Surprise {
  exercise: string;
  estimate: number;
  answer: number;
  unit: string;
  at: string;
}

interface Stored {
  visited: Lesson[];
  exercises: Record<string, ExerciseRecord>;
  surprises: Surprise[];
}

/** An estimate this far off the answer, relative, is a surprise. */
export const SURPRISE_SHARE = 0.5;

/** How far an estimate is off the answer, relative to it; `null` for an
 *  answer of zero, against which no estimate is off by a share. One rule for
 *  the store's surprises and the card's words, so the two cannot disagree. */
export function estimateMiss(estimate: number, answer: number): number | null {
  return answer !== 0 ? Math.abs(estimate - answer) / Math.abs(answer) : null;
}

/** Whether a miss (`estimateMiss`) is a surprise. */
export function isSurprise(miss: number | null): boolean {
  return miss !== null && miss > SURPRISE_SHARE;
}

const EMPTY: Stored = { visited: [], exercises: {}, surprises: [] };

/** Any object: each part of the record is checked on its own below, so a record
 *  one part of which an older version wrote differently keeps the other two. */
function isRecord(value: unknown): value is Partial<Stored> {
  return typeof value === "object" && value !== null;
}

/** Absent, blocked or unreadable storage is a course not started (the kit's
 *  `readStoredJson`, ui-kit 0.52). */
function read(): Stored {
  const parsed = readStoredJson(STORAGE.courseProgress, isRecord);
  if (!parsed) return EMPTY;
  return {
    visited: Array.isArray(parsed.visited) ? parsed.visited : [],
    exercises: parsed.exercises && typeof parsed.exercises === "object" ? parsed.exercises : {},
    surprises: Array.isArray(parsed.surprises) ? parsed.surprises : [],
  };
}

/** Storage refused: the course goes on with the record in memory. */
function write(state: Stored): void {
  writeStoredJson(STORAGE.courseProgress, state);
}

interface CourseProgress extends Stored {
  visit: (lesson: Lesson) => void;
  attempt: (exercise: string, solved: boolean) => void;
  estimate: (exercise: string, estimate: number, answer: number, unit: string) => void;
  forget: () => void;
}

export const useCourseProgress = create<CourseProgress>((set, get) => {
  const save = (next: Stored) => {
    write(next);
    set(next);
  };
  const stored = (): Stored => {
    const { visited, exercises, surprises } = get();
    return { visited, exercises, surprises };
  };
  return {
    ...read(),
    visit: (lesson) => {
      const now = stored();
      if (now.visited.includes(lesson)) return;
      save({ ...now, visited: [...now.visited, lesson] });
    },
    attempt: (exercise, solved) => {
      const now = stored();
      const before = now.exercises[exercise] ?? { solved: false, attempts: 0, estimate: null };
      save({
        ...now,
        exercises: {
          ...now.exercises,
          [exercise]: { ...before, attempts: before.attempts + 1, solved: before.solved || solved },
        },
      });
    },
    estimate: (exercise, estimate, answer, unit) => {
      const now = stored();
      const before = now.exercises[exercise] ?? { solved: false, attempts: 0, estimate: null };
      const surprised = isSurprise(estimateMiss(estimate, answer));
      save({
        ...now,
        exercises: { ...now.exercises, [exercise]: { ...before, estimate } },
        surprises: surprised
          ? [
              ...now.surprises.filter((s) => s.exercise !== exercise),
              { exercise, estimate, answer, unit, at: new Date().toISOString() },
            ]
          : now.surprises,
      });
    },
    forget: () => save(EMPTY),
  };
});
