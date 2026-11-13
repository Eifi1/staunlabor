module.exports.readVersion = function (contents) {
  const m = contents.match(/__version__\s*=\s*"([^"]+)"/);
  if (!m) throw new Error("__version__ not found in __init__.py");
  return m[1];
};

module.exports.writeVersion = function (contents, version) {
  return contents.replace(/__version__\s*=\s*"[^"]+"/, `__version__ = "${version}"`);
};
