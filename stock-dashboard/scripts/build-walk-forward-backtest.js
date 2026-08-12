const fs = require("fs");
const path = require("path");
const manifest = require("../data/evaluation/qqq-walk-forward-v1.json");
const { getStoredDailyFeatures } = require("../lib/daily-feature-store");
const { getStoredForwardLabels } = require("../lib/market-label-store");
const { buildWalkForwardBacktest } = require("../lib/walk-forward-backtest");

async function main() {
  const [featureData, labelData] = await Promise.all([getStoredDailyFeatures("QQQ", 2600), getStoredForwardLabels("QQQ", 2600)]);
  const report = buildWalkForwardBacktest({ manifest, features: featureData.features, labels: labelData.labels });
  const outputPath = path.join(__dirname, "..", "data", "evaluation", report.backtestVersion + ".json");
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ outputPath, backtestVersion: report.backtestVersion, benchmark: report.benchmark.summary, candidates: report.candidates }, null, 2));
}

main().catch(function (error) { console.error("Walk-forward backtest failed:", error?.message || error); process.exitCode = 1; });
