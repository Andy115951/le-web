const { getBaselineEvaluationReport } = require("./evaluation-baseline-report");
const { getLogisticEvaluationReport } = require("./evaluation-logistic-report");
const { getTreeEvaluationReport } = require("./evaluation-tree-report");
const { evaluatePromotion } = require("./model-promotion-governance");
const { buildFailureCaseSummary } = require("./evaluation-failure-cases");

function buildPromotionReview(candidate) {
  const baseline = getBaselineEvaluationReport();
  return {
    ...evaluatePromotion(candidate, baseline),
    failureCaseSummary: buildFailureCaseSummary(candidate, baseline)
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
