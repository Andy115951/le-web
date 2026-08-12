const manifest = require("../data/evaluation/qqq-walk-forward-v1.json");
const { validateWalkForwardManifest } = require("./walk-forward-splits");

function getWalkForwardSplitManifest() {
  const validation = validateWalkForwardManifest(manifest);
  if (!validation.valid) throw new Error("Invalid frozen walk-forward manifest: " + validation.errors.join("; "));
  return manifest;
}

module.exports = { getWalkForwardSplitManifest };
