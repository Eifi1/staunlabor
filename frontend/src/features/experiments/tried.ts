import { create } from "zustand";
import { readStoredJson, writeStoredJson } from "@eifi1/ui-kit";
import { STORAGE } from "@/shared/lib/storage-keys";
import { EXHIBITS, type Exhibit } from "./exhibits";

/**
 * Which exhibits a reader has tried, on this device: the overview's ticks and
 * its "5 of 8 tried".
 *
 * **Tried, not opened**: an exhibit counts once the reader has done something
 * in its "Try it" — dragged, pressed, switched the auto mode on
 * (`ExhibitFrame`). A page opened and scrolled past is not a visit to an
 * exhibit, and a tick for it would tell the reader they had done what they
 * had only seen.
 *
 * The experiments are public and hold nothing of anybody's, so the browser is
 * the whole record (`STORAGE.experimentsTried` says so on the privacy page);
 * on another device the reader starts again.
 * Every read and write is guarded by the kit's helpers: storage that refuses
 * leaves an empty record, never a broken page.
 */

const KNOWN = new Set<string>(EXHIBITS.map((entry) => entry.exhibit));

/** A list of names, of which only the exhibits that still exist are kept: an
 *  exhibit renamed or withdrawn leaves its old name behind on the device. */
function isList(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function read(): Exhibit[] {
  const stored = readStoredJson(STORAGE.experimentsTried, isList) ?? [];
  return stored.filter((name): name is Exhibit => typeof name === "string" && KNOWN.has(name));
}

interface Tried {
  tried: readonly Exhibit[];
  mark: (exhibit: Exhibit) => void;
  /** Start again: forget every exhibit tried on this device. */
  forget: () => void;
}

export const useTried = create<Tried>((set, get) => ({
  tried: read(),
  mark: (exhibit) => {
    const now = get().tried;
    if (now.includes(exhibit)) return;
    const next = [...now, exhibit];
    writeStoredJson(STORAGE.experimentsTried, next);
    set({ tried: next });
  },
  forget: () => {
    writeStoredJson(STORAGE.experimentsTried, []);
    set({ tried: [] });
  },
}));
