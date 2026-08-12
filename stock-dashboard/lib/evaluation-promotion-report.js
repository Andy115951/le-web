const { getBaselineEvaluationReport } = require("./evaluation-baseline-report");
const { getLogisticEvaluationReport } = require("./evaluation-logistic-report");
const { evaluatePromotion } = require("./model-promotion-governance");

function getLogisticPromotionReview() {
  return evaluatePromotion(getLogisticEvaluationReport(), getBaselineEvaluationReport());
}

module.exports = { getLogisticPromotionReview };
