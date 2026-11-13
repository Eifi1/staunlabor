module.exports.readVersion = function (contents) {
  const m = contents.match(/^version\s*=\s*"([^"]+)"/m);
  if (!m) throw new Error("version line not found in pyproject.toml");
  return m[1];
};

module.exports.writeVersion = function (contents, version) {
  return contents.replace(/^version\s*=\s*"[^"]+"/m, `version = "${version}"`);
};
