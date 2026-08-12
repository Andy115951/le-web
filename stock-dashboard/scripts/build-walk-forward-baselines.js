const fs = require("fs");
const path = require("path");
const manifest = require("../data/evaluation/qqq-walk-forward-v1.json");
const { getStoredDailyFeatures } = require("../lib/daily-feature-store");
const { getStoredForwardLabels } = require("../lib/market-label-store");
const { buildBaselineEvaluation } = require("../lib/walk-forward-baselines");

async function main() {
  const [featureData, labelData] = await Promise.all([
    getStoredDailyFeatures("QQQ", 2600),
    getStoredForwardLabels("QQQ", 2600)
  ]);
  const report = buildBaselineEvaluation({
    manifest,
    features: featureData.features,
    labels: labelData.labels
  });
  if (!report.folds.length) throw new Error("No baseline folds were evaluated");
  const outputPath = path.join(__dirname, "..", "data", "evaluation", report.evaluationVersion + ".json");
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({
    outputPath,
    evaluationVersion: report.evaluationVersion,
    splitVersion: report.splitVersion,
    foldCount: report.folds.length,
    summary: report.summary
  }, null, 2));
}

main().catch(function (error) {
  console.error("Walk-forward baseline evaluation failed:", error?.message || error);
  process.exitCode = 1;
});
