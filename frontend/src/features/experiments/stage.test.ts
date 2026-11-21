/// <reference types="node" />
// The test reads the pages' source, as Tailwind does: a class it holds to is
// one the source must spell.
import { readdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SIDE } from "./stage";

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
