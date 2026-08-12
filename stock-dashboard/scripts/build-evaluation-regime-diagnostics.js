const fs = require("fs");
const path = require("path");
const manifest = require("../data/evaluation/qqq-walk-forward-v1.json");
const { buildEvaluationRegimeDiagnostics } = require("../lib/evaluation-regime-diagnostics");
const { getStoredDailyPrices } = require("../lib/price-history-store");

async function main() {
  const history = await getStoredDailyPrices("QQQ", 2600);
  const artifact = buildEvaluationRegimeDiagnostics(manifest, history.prices);
  if (!artifact.folds.length || artifact.folds.some(function (fold) { return fold.status !== "available"; })) {
    throw new Error("Cannot freeze regime diagnostics without complete price coverage for every evaluation fold");
  }
  const outputPath = path.join(__dirname, "..", "data", "evaluation", artifact.diagnosticVersion + ".json");
  fs.writeFileSync(outputPath, JSON.stringify(artifact, null, 2) + "\n");
  console.log(JSON.stringify({ outputPath, diagnosticVersion: artifact.diagnosticVersion, splitVersion: artifact.splitVersion, folds: artifact.folds.length, regimeCounts: artifact.folds.reduce(function (counts, fold) { const label = fold.regime?.label || "unavailable"; counts[label] = (counts[label] || 0) + 1; return counts; }, {}) }, null, 2));
}

main().catch(function (error) {
  console.error("Evaluation regime diagnostic build failed:", error?.message || error);
  process.exitCode = 1;
});
