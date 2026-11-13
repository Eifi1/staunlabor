#!/usr/bin/env node
/**
 * Dead code in the backend: vulture, against a baseline — the same rule as
 * check-ts-prune.cjs, for the other half.
 *
 * Vulture runs from backend/ with its settings in pyproject.toml's
 * [tool.vulture]: `staunlabor` at --min-confidence 60, with the decorators
 * that hand a function to a framework ignored. It is a dev dependency, pinned
 * in uv.lock, so `uv run vulture` is the version CI installs.
 *
 * 60 is where vulture scores an unused function, method or class, and it is
 * also the score it gives every name it never sees read — which is every
 * pydantic field, dataclass field and settings attribute in the package, read
 * by the framework rather than by name . Those two
 * kinds, `unused variable` and `unused attribute`, are dropped at 60 and only
 * at 60: a local variable or an argument nobody reads still comes back at 100
 * and still fails. 60 is the rule of the apps this one comes from, where an
 * unused service function once sat for weeks under a gate run at 80.
 *
 * What is left over is backend/.vulture-baseline, as "path: message" without
 * the line number or the confidence, so an edit above a name is not a change.
 * Lines starting with "#" there are the reasons, and are kept by --update. The
 * check fails when
 *   - an entry appears that is not in the baseline (use it or delete it), or
 *   - a baseline entry is no longer reported (delete the line: the baseline only
 *     ever shrinks).
 * `node scripts/check-vulture.cjs --update` rewrites the baseline — after a
 * deliberate review, never to make the check pass.
 */
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const BACKEND = path.join(__dirname, "..", "backend");
const BASELINE = path.join(BACKEND, ".vulture-baseline");

// Vulture's exit code is 3 when it found something, which is the normal case
// here: the baseline is what decides whether that is a failure. Anything else
// non-zero (1 invalid input, 2 invalid arguments) is the tool failing.
let raw;
try {
  raw = execFileSync("uv", ["run", "vulture"], {
    cwd: BACKEND,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
} catch (error) {
  if (error.status !== 3) throw error;
  raw = error.stdout;
}

// "staunlabor/x.py:12: unused method 'y' (60% confidence)"
const LINE = /^(.+?):\d+: (.+) \((\d+)% confidence\)$/;
const FIELD_NOISE = /^unused (variable|attribute) /;

const current = new Set(
  raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = LINE.exec(line);
      if (!match) throw new Error(`vulture printed a line this script cannot read: ${line}`);
      return { entry: `${match[1]}: ${match[2]}`, message: match[2], confidence: Number(match[3]) };
    })
    .filter(({ message, confidence }) => !(confidence === 60 && FIELD_NOISE.test(message)))
    .map(({ entry }) => entry),
);

const lines = fs.existsSync(BASELINE) ? fs.readFileSync(BASELINE, "utf8").split("\n").map((line) => line.trim()) : [];
const reasons = lines.filter((line) => line.startsWith("#"));
const baseline = new Set(lines.filter((line) => line && !line.startsWith("#")));

if (process.argv.includes("--update")) {
  fs.writeFileSync(BASELINE, [...reasons, ...[...current].sort()].join("\n") + "\n");
  console.log(`baseline rewritten: ${current.size} entries`);
  process.exit(0);
}

const added = [...current].filter((entry) => !baseline.has(entry)).sort();
const gone = [...baseline].filter((entry) => !current.has(entry)).sort();

if (added.length) {
  console.error(`✖ ${added.length} new unused name(s) — use or delete them:`);
  for (const entry of added) console.error(`  ${entry}`);
}
if (gone.length) {
  console.error(`✖ ${gone.length} baseline entr(y/ies) no longer unused — delete them from backend/.vulture-baseline:`);
  for (const entry of gone) console.error(`  ${entry}`);
}
if (added.length || gone.length) process.exit(1);
console.log(`vulture: no new unused names (${baseline.size} baselined)`);
