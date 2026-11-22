#!/usr/bin/env node
/**
 * Dead code in the frontend: unused exports (ts-prune), against a baseline.
 *
 * ts-prune reads frontend/tsconfig.prune.json: tsconfig.json, which lists `src`
 * itself (it is not a solution file with `"files": []`, on which ts-prune checks
 * nothing at all and reports nothing — how kastlan's step passed for months over
 * zero files), less the tests and the harness. Over the whole of `src` a test
 * counts as a user, so an export only tests import passes.
 *
 * It does not resolve a DIRECTORY import through the `@/` alias:
 * `from "@/shared/i18n"` reaches `index.ts` for the compiler and nothing for
 * ts-prune, which then calls everything imported that way unused. Spell such an
 * import `@/shared/i18n/index`, as the importers of that module do.
 *
 * What it reported when this check became blocking is frontend/.ts-prune-baseline,
 * as "file - name" without the line number, so an edit above an export is not a
 * change. The `export type *` barrel in shared/types, which ts-prune cannot
 * follow, is left out of both (see BARREL below). The rule (new entries and
 * gone ones both fail), the "#" reasons and --update are baseline.cjs's, shared
 * with check-vulture.cjs: `node scripts/check-ts-prune.cjs --update` rewrites
 * the baseline — after a deliberate review, never to make the check pass.
 */
const { execFileSync } = require("child_process");
const path = require("path");
const { compareWithBaseline } = require("./baseline.cjs");

const FRONTEND = path.join(__dirname, "..", "frontend");
const BASELINE = path.join(FRONTEND, ".ts-prune-baseline");

const raw = execFileSync("npx", ["--yes", "ts-prune@0.10.3", "-p", "tsconfig.prune.json"], {
  cwd: FRONTEND,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
});

// The `export type *` barrel is left out rather than baselined. ts-prune
// cannot follow it, so every type in shared/types was "unused" — 145 of the
// baseline's 149 lines on 2026-10-01 — and it is not even consistent about
// which: two pre-push runs that day dropped `Team` (and once `TeamMember`,
// `TeamRole`) from the report while six runs by hand kept all of them, and the
// "fixed ones must leave" rule then failed a push over a type nobody touched.
// A check that flips on code that did not change is worse than none. What the
// barrel re-exports is held honest elsewhere: shared/types is types only, and
// mirror.test.ts walks it against the backend schemas.
const BARREL = "src/shared/types/index.ts";

const current = new Set(
  raw
    .split("\n")
    .filter((line) => line.trim() && !line.includes("(used in module)"))
    .filter((line) => !line.startsWith(`${BARREL}:`))
    // "src/x.ts:12 - name" → "src/x.ts - name"
    .map((line) => line.replace(/:\d+ - /, " - ").trim()),
);

compareWithBaseline({ baselineFile: BASELINE, current, noun: "unused export", tool: "ts-prune" });
