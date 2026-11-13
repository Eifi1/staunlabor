/**
 * Keep `package-lock.json`'s three copies of the root version in step with a release.
 *
 * npm writes the workspace root's version in three places — the top-level `version`,
 * `packages[""].version` and `packages["frontend"].version` (the frontend workspace
 * mirrors the root's) — and a release bumped none of them. Nothing else is touched:
 * the design system is an ordinary dependency (`@eifi1/ui-kit`) with its own version
 * line, and it does not follow this app's releases.
 *
 * Written as one updater rather than leaning on commit-and-tag-version's built-in json
 * handler plus a second custom one: the built-in reaches the first two by convention,
 * which is exactly the kind of thing that stops being true on a minor bump.
 */
module.exports.readVersion = function (contents) {
  return JSON.parse(contents).version;
};

module.exports.writeVersion = function (contents, version) {
  const lock = JSON.parse(contents);
  lock.version = version;
  if (lock.packages?.[""]) lock.packages[""].version = version;
  if (lock.packages?.frontend) lock.packages.frontend.version = version;
  // npm writes the file with two-space indent and a trailing newline.
  return `${JSON.stringify(lock, null, 2)}\n`;
};
