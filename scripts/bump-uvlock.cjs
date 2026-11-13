/**
 * Keep `backend/uv.lock`'s own project version in step with a release.
 *
 * `uv.lock` embeds the project as a package like any other:
 *
 *     [[package]]
 *     name = "staunlabor"
 *     version = "0.1.0"
 *     source = { virtual = "." }
 *
 * and CI runs `uv sync --frozen`, which does not re-resolve — so a release that
 * bumped pyproject.toml and left this behind would ship a lock that disagrees with
 * it, and the next `uv lock` would show up as an unrelated diff. Taken from
 * keksdose, where exactly that drift cost sixteen catch-up commits.
 *
 * Anchored to the `name = "staunlabor"` block, not to the first `version =` in the
 * file — a uv lock opens with `version = 1`, the lockfile FORMAT version, which
 * must never be touched.
 */
const BLOCK = /(\[\[package\]\]\s*\nname = "staunlabor"\s*\nversion = ")([^"]+)(")/;

module.exports.readVersion = function (contents) {
  const m = contents.match(BLOCK);
  if (!m) throw new Error('uv.lock: no [[package]] block for name = "staunlabor"');
  return m[2];
};

module.exports.writeVersion = function (contents, version) {
  if (!BLOCK.test(contents)) {
    throw new Error('uv.lock: no [[package]] block for name = "staunlabor"');
  }
  return contents.replace(BLOCK, `$1${version}$3`);
};
