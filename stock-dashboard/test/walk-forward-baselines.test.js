const assert = require("node:assert/strict");
const test = require("node:test");
const { buildBaselineEvaluation, fitMomentumBaseline, metricSummary } = require("../lib/walk-forward-baselines");
const { getBaselineEvaluationReport } = require("../lib/evaluation-baseline-report");

function rows() {
  return Array.from({ length: 10 }, function (_item, index) {
    const date = "2025-01-" + String(index + 2).padStart(2, "0");
    return {
      feature: { market_date: date, return_20d_percent: index < 5 ? 3 : -3 },
      label: { market_date: date, return_20d_percent: index < 5 ? 2 : -2 }
    };
  });
}

test("conditional momentum probabilities are fit from training rows only", function () {
  const source = rows();
  const training = source.slice(0, 5).map(function (row) {
    return { date: row.feature.market_date, feature: row.feature, outcome: row.label.return_20d_percent > 0 ? 1 : 0 };
  });
  const fit = fitMomentumBaseline(training);
  assert.equal(fit.bucketProbabilities.nonnegative, 1);
  assert.equal(fit.bucketProbabilities.negative, 1);
  assert.equal(fit.bucketSampleCounts.negative, 0);
});

test("baseline evaluation never incorporates evaluation outcomes into the fold fit", function () {
  const source = rows();
  const evaluation = buildBaselineEvaluation({
    features: source.map(function (row) { return row.feature; }),
    labels: source.map(function (row) { return row.label; }),
    manifest: {
      splitVersion: "qqq-walk-forward-v1",
      instrument: "QQQ",
      featureVersion: "test-feature-v1",
      labelVersion: "test-label-v1",
      horizonTradingDays: 20,
      splits: [{
        id: "fold-01",
        training: { startDate: "2025-01-02", endDate: "2025-01-06" },
        embargo: { startDate: "2025-01-07", endDate: "2025-01-08", tradingDays: 2 },
        evaluation: { startDate: "2025-01-09", endDate: "2025-01-11" }
      }]
    }
  });
  const fold = evaluation.folds[0];
  assert.equal(fold.momentumFit.fallbackProbability, 1);
  assert.equal(fold.baselines.conditionalMomentum20d.sampleCount, 3);
  assert.equal(fold.baselines.conditionalMomentum20d.actualUpRate, 0);
  assert.equal(fold.baselines.conditionalMomentum20d.brierScore, 1);
});

test("metric summary reports direction and probability metrics without invented samples", function () {
  assert.deepEqual(metricSummary([]), { sampleCount: 0, accuracy: null, balancedAccuracy: null, brierScore: null, actualUpRate: null });
  const metrics = metricSummary([
    { actualDirection: 1, predictedDirection: 1, upProbability: 0.75 },
    { actualDirection: 0, predictedDirection: 0, upProbability: 0.25 }
  ]);
  assert.deepEqual(metrics, { sampleCount: 2, accuracy: 1, balancedAccuracy: 1, brierScore: 0.0625, actualUpRate: 0.5 });
});

test("committed QQQ baseline report remains bound to the frozen split version", function () {
  const report = getBaselineEvaluationReport();
  assert.equal(report.splitVersion, "qqq-walk-forward-v1");
  assert.equal(report.folds.length, 16);
  assert.equal(report.summary.alwaysUp.sampleCount, 975);
  assert.match(report.summary.aggregation, /sample-weighted/);
});
