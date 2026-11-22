/**
 * The baseline rule both dead-code checks share (check-vulture.cjs,
 * check-ts-prune.cjs): what the tool reports now against a file of what it
 * reported when the check became blocking, one entry a line. Lines starting
 * with "#" are the reasons a developer wrote down; they are neither entries
 * nor dropped by --update. The check fails when
 *   - an entry appears that is not in the baseline (use it or delete it), or
 *   - a baseline entry is no longer reported (delete the line: the baseline only
 *     ever shrinks).
 * `--update` rewrites the baseline, after a deliberate review, never to make
 * the check pass.
 */
const fs = require("fs");
const path = require("path");

/**
 * Compares `current` (a Set of entries) with `baselineFile` and exits: 0 when
 * they agree or on --update, 1 with the differences listed otherwise. `noun`
 * names an entry in the messages ("unused name", "unused export"), `tool` the
 * tool in the success line.
 */
function compareWithBaseline({ baselineFile, current, noun, tool }) {
  const lines = fs.existsSync(baselineFile)
    ? fs
        .readFileSync(baselineFile, "utf8")
        .split("\n")
        .map((line) => line.trim())
    : [];
  const reasons = lines.filter((line) => line.startsWith("#"));
  const baseline = new Set(lines.filter((line) => line && !line.startsWith("#")));

  if (process.argv.includes("--update")) {
    fs.writeFileSync(baselineFile, [...reasons, ...[...current].sort()].join("\n") + "\n");
    console.log(`baseline rewritten: ${current.size} entries`);
    process.exit(0);
  }

  const added = [...current].filter((entry) => !baseline.has(entry)).sort();
  const gone = [...baseline].filter((entry) => !current.has(entry)).sort();
  const shown = path.relative(path.join(__dirname, ".."), baselineFile);

  if (added.length) {
    console.error(`✖ ${added.length} new ${noun}(s) — use or delete them:`);
    for (const entry of added) console.error(`  ${entry}`);
  }
  if (gone.length) {
    console.error(`✖ ${gone.length} baseline entr(y/ies) no longer unused — delete them from ${shown}:`);
    for (const entry of gone) console.error(`  ${entry}`);
  }
  if (added.length || gone.length) process.exit(1);
  console.log(`${tool}: no new ${noun}s (${baseline.size} baselined)`);
  process.exit(0);
}

module.exports = { compareWithBaseline };
