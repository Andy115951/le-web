const { getBaselineEvaluationReport } = require("./evaluation-baseline-report");
const { getLogisticEvaluationReport } = require("./evaluation-logistic-report");
const { evaluatePromotion } = require("./model-promotion-governance");
const { buildFailureCaseSummary } = require("./evaluation-failure-cases");

function getLogisticPromotionReview() {
  const candidate = getLogisticEvaluationReport();
  const baseline = getBaselineEvaluationReport();
  return {
    ...evaluatePromotion(candidate, baseline),
    failureCaseSummary: buildFailureCaseSummary(candidate, baseline)
  };
}

module.exports = { getLogisticPromotionReview };
