const report = require("../data/evaluation/qqq-baseline-evaluation-v1.json");

function getBaselineEvaluationReport() {
  if (report?.evaluationVersion !== "qqq-baseline-evaluation-v1" || !Array.isArray(report?.folds) || !report.folds.length) {
    throw new Error("Invalid frozen baseline evaluation report");
  }
  return report;
}

module.exports = { getBaselineEvaluationReport };
