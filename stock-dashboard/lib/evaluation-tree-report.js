const report = require("../data/evaluation/qqq-tree-evaluation-v1.json");

function getTreeEvaluationReport() {
  if (report?.evaluationVersion !== "qqq-tree-evaluation-v1" || !Array.isArray(report?.folds) || !report.folds.length) {
    throw new Error("Invalid frozen tree evaluation report");
  }
  return report;
}

module.exports = { getTreeEvaluationReport };
