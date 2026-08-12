const fs = require("fs");
const path = require("path");
const { getStoredDailyFeatures } = require("../lib/daily-feature-store");
const { getStoredForwardLabels } = require("../lib/market-label-store");
const { buildWalkForwardSplits, validateWalkForwardManifest } = require("../lib/walk-forward-splits");

async function main() {
  const [featureData, labelData] = await Promise.all([
    getStoredDailyFeatures("QQQ", 2600),
    getStoredForwardLabels("QQQ", 2600)
  ]);
  const manifest = buildWalkForwardSplits({
    instrument: featureData.instrument,
    features: featureData.features,
    labels: labelData.labels
  });
  const validation = validateWalkForwardManifest(manifest);
  if (!validation.valid) throw new Error(validation.errors.join("; "));
  const outputPath = path.join(__dirname, "..", "data", "evaluation", manifest.splitVersion + ".json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log(JSON.stringify({
    outputPath,
    splitVersion: manifest.splitVersion,
    eligibleObservationCount: manifest.eligibleObservationCount,
    splitCount: manifest.splits.length,
    lastMatureOutcomeDate: manifest.lastMatureOutcomeDate
  }, null, 2));
}

main().catch(function (error) {
  console.error("Walk-forward split build failed:", error?.message || error);
  process.exitCode = 1;
});
