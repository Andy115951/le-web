const report = require("../data/evaluation/qqq-logistic-evaluation-v1.json");

function getLogisticEvaluationReport() {
  if (report?.evaluationVersion !== "qqq-logistic-evaluation-v1" || !Array.isArray(report?.folds) || !report.folds.length) {
    throw new Error("Invalid frozen logistic evaluation report");
  }
  return report;
}

module.exports = { getLogisticEvaluationReport };
