const assert = require("node:assert/strict");
const test = require("node:test");
const { evaluatePromotion } = require("../lib/model-promotion-governance");
const { getLogisticPromotionReview } = require("../lib/evaluation-promotion-report");

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
});
