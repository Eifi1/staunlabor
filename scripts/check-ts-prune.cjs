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
 * follow, is left out of both (see BARREL below). The check fails when
 *   - an unused export appears that is not in the baseline (use it or remove it), or
 *   - a baseline entry is no longer reported (delete the line: the baseline only
 *     ever shrinks).
 * `node scripts/check-ts-prune.cjs --update` rewrites the baseline — after a
 * deliberate review, never to make the check pass.
 */
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

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

if (process.argv.includes("--update")) {
  fs.writeFileSync(BASELINE, [...current].sort().join("\n") + "\n");
  console.log(`baseline rewritten: ${current.size} entries`);
  process.exit(0);
}

const baseline = new Set(
  fs.existsSync(BASELINE)
    ? fs.readFileSync(BASELINE, "utf8").split("\n").map((line) => line.trim()).filter(Boolean)
    : [],
);

const added = [...current].filter((entry) => !baseline.has(entry)).sort();
const gone = [...baseline].filter((entry) => !current.has(entry)).sort();

if (added.length) {
  console.error(`✖ ${added.length} new unused export(s) — use or remove them:`);
  for (const entry of added) console.error(`  ${entry}`);
}
if (gone.length) {
  console.error(`✖ ${gone.length} baseline entr(y/ies) no longer unused — delete them from frontend/.ts-prune-baseline:`);
  for (const entry of gone) console.error(`  ${entry}`);
}
if (added.length || gone.length) process.exit(1);
console.log(`ts-prune: no new unused exports (${baseline.size} baselined)`);
