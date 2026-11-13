#!/usr/bin/env node
/**
 * Assert that every file commit-and-tag-version bumps carries the same version.
 *
 * The sources below mirror the `bumpFiles` list in .versionrc.json; a release
 * rewrites all of them together, so any drift here is a hand-edit that went out of
 * sync. Run in CI (the Commits job) and before every release (the shared release
 * workflow's pre-release check). The version is also what the API reports:
 * `staunlabor/__init__.py` is read by `main.py` for the startup log and the
 * OpenAPI title.
 *
 * The two lockfiles are in the list on purpose. Each embeds the project's own
 * version — `backend/uv.lock`'s `[[package]] name = "staunlabor"` block, and
 * `package-lock.json`'s three copies — and in keksdose, where this script comes
 * from, nothing bumped either until sixteen catch-up commits said so.
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const match = (text, re) => (text.match(re) || [])[1];

const sources = {
  "package.json": JSON.parse(read("package.json")).version,
  "frontend/package.json": JSON.parse(read("frontend/package.json")).version,
  "backend/pyproject.toml": match(read("backend/pyproject.toml"), /^version\s*=\s*"([^"]+)"/m),
  "backend/staunlabor/__init__.py": match(
    read("backend/staunlabor/__init__.py"),
    /__version__\s*=\s*"([^"]+)"/,
  ),
  // Anchored to the project's own [[package]] block: `uv.lock` opens with
  // `version = 1`, the LOCKFILE FORMAT version, which must never move.
  "backend/uv.lock": match(
    read("backend/uv.lock"),
    /\[\[package\]\]\s*\nname = "staunlabor"\s*\nversion = "([^"]+)"/,
  ),
  "package-lock.json": JSON.parse(read("package-lock.json")).version,
  'package-lock.json packages[""]': JSON.parse(read("package-lock.json")).packages[""]?.version,
  "package-lock.json packages[frontend]": JSON.parse(read("package-lock.json")).packages
    ?.frontend?.version,
};

const table = Object.entries(sources)
  .map(([file, version]) => `  ${(version ?? "—").padEnd(12)} ${file}`)
  .join("\n");
const distinct = [...new Set(Object.values(sources))];

if (distinct.length === 1 && distinct[0]) {
  console.log(`✓ version ${distinct[0]} is in sync:\n${table}`);
  process.exit(0);
}
console.error(`✖ version mismatch across bump files:\n${table}`);
process.exit(1);
