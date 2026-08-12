const fs = require("fs");
const path = require("path");
const manifest = require("../data/evaluation/qqq-walk-forward-v1.json");
const { getStoredDailyFeatures } = require("../lib/daily-feature-store");
const { getStoredForwardLabels } = require("../lib/market-label-store");
const { buildTreeEvaluation } = require("../lib/walk-forward-tree");

async function main() {
  const [featureData, labelData] = await Promise.all([getStoredDailyFeatures("QQQ", 2600), getStoredForwardLabels("QQQ", 2600)]);
  const report = buildTreeEvaluation({ manifest, features: featureData.features, labels: labelData.labels });
  if (!report.folds.length || !report.summary.metrics.sampleCount) throw new Error("No tree evaluation samples were produced");
  const outputPath = path.join(__dirname, "..", "data", "evaluation", report.evaluationVersion + ".json");
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ outputPath, evaluationVersion: report.evaluationVersion, modelVersion: report.modelVersion, foldCount: report.folds.length, metrics: report.summary.metrics, calibrationBins: report.summary.calibrationBins }, null, 2));
}

main().catch(function (error) { console.error("Walk-forward tree evaluation failed:", error?.message || error); process.exitCode = 1; });
