/// <reference types="node" />
import { readdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { EQUATION_COUNT } from "./facts";

// Not `new URL("…", import.meta.url)`: Vite rewrites that into a served URL.
const DIR = dirname(fileURLToPath(import.meta.url));

describe("the front page's figures", () => {
  it("says as many equations as the exhibits' pages write out", () => {
    const written = readdirSync(DIR)
      .filter((name) => name.endsWith("-page.tsx"))
      .reduce((sum, name) => sum + (readFileSync(`${DIR}/${name}`, "utf8").match(/<Equation\b/g)?.length ?? 0), 0);
    expect(written).toBe(EQUATION_COUNT);
  });
});
