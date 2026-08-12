const report = require("../data/evaluation/qqq-probability-gated-backtest-v1.json");

function getWalkForwardBacktestReport() {
  if (report?.backtestVersion !== "qqq-probability-gated-backtest-v1" || !Array.isArray(report?.candidates) || !report.candidates.length) {
    throw new Error("Invalid frozen walk-forward backtest report");
  }
  return report;
}

module.exports = { getWalkForwardBacktestReport };
