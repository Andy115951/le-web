const { getBaselineEvaluationReport } = require("./evaluation-baseline-report");
const { getLogisticEvaluationReport } = require("./evaluation-logistic-report");
const { getTreeEvaluationReport } = require("./evaluation-tree-report");
const { evaluatePromotion } = require("./model-promotion-governance");
const { buildFailureCaseSummary } = require("./evaluation-failure-cases");
const { getAvailableRegimesByFold, getEvaluationRegimeDiagnosticReport } = require("./evaluation-regime-diagnostic-report");

function buildPromotionReview(candidate) {
  const baseline = getBaselineEvaluationReport();
  const regimeReport = getEvaluationRegimeDiagnosticReport();
  return {
    ...evaluatePromotion(candidate, baseline),
    failureCaseSummary: buildFailureCaseSummary(candidate, baseline, {
      maxCases: 16,
      regimeByFold: getAvailableRegimesByFold(regimeReport),
      regimeDiagnosticVersion: regimeReport.diagnosticVersion
    })
  };
}

function getLogisticPromotionReview() {
  return buildPromotionReview(getLogisticEvaluationReport());
}

function getTreePromotionReview() {
  return buildPromotionReview(getTreeEvaluationReport());
}

function getCandidatePromotionReviews() {
  return [
    { label: "Logistic Regression", review: getLogisticPromotionReview() },
    { label: "Shallow Probability Tree", review: getTreePromotionReview() }
  ];
}

module.exports = { getCandidatePromotionReviews, getLogisticPromotionReview, getTreePromotionReview };
