const assert = require("node:assert/strict");
const test = require("node:test");
const { evaluatePromotion } = require("../lib/model-promotion-governance");
const { getLogisticPromotionReview } = require("../lib/evaluation-promotion-report");
const { buildFailureCaseSummary } = require("../lib/evaluation-failure-cases");

function baseline() {
  return {
    evaluationVersion: "baseline-v1",
    summary: { conditionalMomentum20d: { brierScore: 0.25, balancedAccuracy: 0.5 } }
  };
}

function candidate(overrides = {}) {
  return {
    evaluationVersion: "candidate-v1",
    instrument: "QQQ",
    splitVersion: "qqq-walk-forward-v1",
    folds: Array.from({ length: 16 }),
    summary: {
      metrics: { sampleCount: 900, brierScore: 0.24, balancedAccuracy: 0.51 },
      calibrationBins: [{ sampleCount: 100, averagePredictedProbability: 0.55, observedUpRate: 0.5 }]
    },
    ...overrides
  };
}

test("promotion policy requires all pre-registered gates", function () {
  const review = evaluatePromotion(candidate(), baseline());
  assert.equal(review.reviewStatus, "eligible_for_human_review");
  assert.equal(review.runtimeStatus, "not_deployed");
  assert.deepEqual(review.failureLabels, []);
});

test("promotion policy labels a candidate that misses a metric and calibration gate", function () {
  const report = candidate({
    summary: {
      metrics: { sampleCount: 900, brierScore: 0.251, balancedAccuracy: 0.5 },
      calibrationBins: [{ sampleCount: 100, averagePredictedProbability: 0.8, observedUpRate: 0.5 }]
    }
  });
  const review = evaluatePromotion(report, baseline());
  assert.equal(review.reviewStatus, "not_eligible");
  assert.deepEqual(review.failureLabels, ["brier_improvement", "balanced_accuracy_improvement", "calibration"]);
});

test("committed logistic candidate is not eligible and remains outside runtime", function () {
  const review = getLogisticPromotionReview();
  assert.equal(review.reviewStatus, "not_eligible");
  assert.equal(review.runtimeStatus, "not_deployed");
  assert.deepEqual(review.failureLabels, ["brier_improvement", "balanced_accuracy_improvement", "calibration"]);
  assert.equal(review.failureCaseSummary.scope, "fold_level_only");
  assert.ok(review.failureCaseSummary.failureCaseCount > 0);
});

test("failure cases compare only matching frozen folds and omit individual predictions", function () {
  const summary = buildFailureCaseSummary({
    folds: [{
      id: "fold-01",
      evaluation: { startDate: "2025-01-01", endDate: "2025-03-31" },
      metrics: { brierScore: 0.3, balancedAccuracy: 0.4 }
    }]
  }, {
    folds: [{ id: "fold-01", baselines: { conditionalMomentum20d: { brierScore: 0.2, balancedAccuracy: 0.6 } } }]
  });
  assert.equal(summary.failureCaseCount, 1);
  assert.deepEqual(summary.cases[0].labels, ["probability_degradation", "direction_degradation"]);
  assert.equal("predictions" in summary.cases[0], false);
});
