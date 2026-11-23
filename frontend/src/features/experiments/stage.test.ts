/// <reference types="node" />
// The test reads the pages' source, as Tailwind does: a class it holds to is
// one the source must spell.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SIDE, STAGE } from "./stage";

// Not `new URL("…", import.meta.url)`: Vite rewrites that into a served URL.
const DIR = dirname(fileURLToPath(import.meta.url));
const PAGES = readdirSync(DIR)
  .filter((name) => name.endsWith("-page.tsx"))
  .map((name) => ({ name, source: readFileSync(`${DIR}/${name}`, "utf8") }));

/** Each `SIDE.grid` in a page, with the cap its class names, in order. */
function grids(source: string): (string | null)[] {
  return [...source.matchAll(/className=\{(?:SIDE\.grid|`\$\{SIDE\.grid\}([^`]*)`)\}/g)].map((match) => {
    const cap = /SIDE\.cap(?:\.(\w+)|\["(\w+)"\])/.exec(match[1] ?? "");
    return cap ? (cap[1] ?? cap[2]) : null;
  });
}

/** Each `SIDE.views` in a page that carries a width of its own, in order. */
function viewWidths(source: string): (string | null)[] {
  return [...source.matchAll(/\$\{SIDE\.views\}([^`]*)`/g)].map(
    (match) => /\bmax-w-(xs|sm|md|lg|xl|2xl|3xl)\b/.exec(match[1])?.[1] ?? null,
  );
}

describe("the views and their column of controls on a wide screen", () => {
  it("caps every side-by-side grid whose views carry a width at that width, so the controls stand beside them", () => {
    const wrong = PAGES.flatMap(({ name, source }) => {
      const caps = grids(source);
      return viewWidths(source).flatMap((width, i) =>
        width !== null && caps[i] !== width ? [`${name}: views max-w-${width}, grid cap ${caps[i]}`] : [],
      );
    });
    expect(wrong).toEqual([]);
  });

  it("has a cap for every width it is asked for, each the width plus the 18rem column and its gap", () => {
    const rem = { xs: 20, sm: 24, md: 28, xl: 36, "2xl": 42, "3xl": 48 } as const;
    for (const [width, cap] of Object.entries(SIDE.cap)) {
      expect(cap).toBe(`2xl:mx-auto 2xl:max-w-[calc(${rem[width as keyof typeof rem]}rem_+_19rem)]`);
    }
  });

  it("finds the pages it guards", () => {
    expect(PAGES.filter(({ source }) => grids(source).some((cap) => cap !== null)).length).toBeGreaterThanOrEqual(20);
  });
});

/** Every source file under `src`, the tests' own included, by its path from `src`. */
function sources(dir: string): { name: string; source: string }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.tsx?$/.test(entry.name) ? [{ name: relative(SRC, path), source: readFileSync(path, "utf8") }] : [];
  });
}
const SRC = join(DIR, "..", "..");

describe("the height a drawing may take", () => {
  // The 60 % share is written in stage.ts alone: a drawing that spelt
  // `max-h-[60dvh]` itself kept its old cap when the share changed, and eight
  // did, though stage.ts said every one used it.
  it("is spelt only in stage.ts: every other file takes it from STAGE", () => {
    const own = join("features", "experiments");
    const spelt = sources(SRC)
      .filter(({ name }) => name !== join(own, "stage.ts") && name !== join(own, "stage.test.ts"))
      .filter(({ source }) => source.includes("60dvh"))
      .map(({ name }) => name);
    expect(spelt).toEqual([]);
  });

  it("caps a wide drawing at the share", () => {
    expect(STAGE.wide).toBe("max-h-[60dvh]");
  });
});
