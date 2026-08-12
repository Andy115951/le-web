const artifact = require("../data/evaluation/qqq-evaluation-regime-diagnostic-v1.json");
const { EVALUATION_REGIME_DIAGNOSTIC_VERSION } = require("./evaluation-regime-diagnostics");

function getEvaluationRegimeDiagnosticReport() {
  if (
    artifact?.diagnosticVersion !== EVALUATION_REGIME_DIAGNOSTIC_VERSION
    || artifact?.instrument !== "QQQ"
    || artifact?.splitVersion !== "qqq-walk-forward-v1"
    || !Array.isArray(artifact?.folds)
    || !artifact.folds.length
  ) {
    throw new Error("Invalid frozen evaluation regime diagnostic report");
  }
  return artifact;
}

function getAvailableRegimesByFold(report = getEvaluationRegimeDiagnosticReport()) {
  return new Map(report.folds.filter(function (fold) {
    return fold?.status === "available" && fold?.foldId && fold?.regime?.label;
  }).map(function (fold) {
    return [fold.foldId, {
      label: fold.regime.label,
      metrics: fold.regime.metrics || {},
      ruleVersion: fold.regime.ruleVersion || report?.rules?.version || null
    }];
  }));
}

module.exports = { getAvailableRegimesByFold, getEvaluationRegimeDiagnosticReport };
