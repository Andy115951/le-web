const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildLogisticEvaluation,
  calibrationBins,
  fitFeatureSchema,
  fitLogisticRegression,
  predictLogistic
} = require("../lib/walk-forward-logistic");
const { getLogisticEvaluationReport } = require("../lib/evaluation-logistic-report");

function trainingRows() {
  return Array.from({ length: 120 }, function (_item, index) {
    const positive = index >= 60;
    return {
      date: "2024-01-" + String(index % 28 + 1).padStart(2, "0"),
      feature: {
        return_1d_percent: positive ? 2 : -2,
        return_5d_percent: positive ? 3 : -3,
        return_20d_percent: positive ? 4 : -4,
        gap_percent: positive ? 0.5 : -0.5,
        trailing_volatility_20d_percent: positive ? 15 : 25,
        trailing_drawdown_20d_percent: positive ? -3 : -12,
        volume_ratio_20d_percent: positive ? 120 : 80,
        available_event_count: positive ? 2 : 1,
        high_impact_event_count: 0,
        medium_impact_event_count: 0,
        low_impact_event_count: 1
      },
      outcome: positive ? 1 : 0
    };
  });
}

test("logistic feature schema is fit from training rows and imputes missing values to zero-standardized", function () {
  const rows = trainingRows();
  const schema = fitFeatureSchema(rows, { minimumSamples: 60 });
  const stat = schema.stats.find(function (item) { return item.key === "return_20d_percent"; });
  assert.equal(stat.mean, 0);
  const model = fitLogisticRegression(rows, { minimumSamples: 60, iterations: 200 });
  const missing = { return_1d_percent: null, return_5d_percent: null, return_20d_percent: null, gap_percent: null, trailing_volatility_20d_percent: null, trailing_drawdown_20d_percent: null, volume_ratio_20d_percent: null, available_event_count: null, high_impact_event_count: null, medium_impact_event_count: null, low_impact_event_count: null };
  const probability = predictLogistic(model, missing);
  assert.ok(probability > 0 && probability < 1);
});

test("regularized logistic regression learns a higher probability for a separable positive feature state", function () {
  const model = fitLogisticRegression(trainingRows(), { minimumSamples: 60, iterations: 500, learningRate: 0.08 });
  const low = predictLogistic(model, trainingRows()[0].feature);
  const high = predictLogistic(model, trainingRows().at(-1).feature);
  assert.ok(high > low);
  assert.ok(high > 0.8);
  assert.ok(low < 0.2);
});

test("calibration bins preserve every evaluation prediction exactly once", function () {
  const bins = calibrationBins([
    { upProbability: 0.01, actualDirection: 0 },
    { upProbability: 0.21, actualDirection: 0 },
    { upProbability: 0.61, actualDirection: 1 },
    { upProbability: 1, actualDirection: 1 }
  ]);
  assert.equal(bins.reduce(function (sum, bin) { return sum + bin.sampleCount; }, 0), 4);
  assert.equal(bins[0].observedUpRate, 0);
  assert.equal(bins[4].observedUpRate, 1);
});

test("logistic evaluation uses fold-local training data and does not retain individual predictions in its report", function () {
  const rows = trainingRows();
  const features = rows.map(function (row, index) { return { ...row.feature, market_date: "2024-02-" + String(index % 28 + 1).padStart(2, "0") }; });
  const labels = rows.map(function (row, index) { return { market_date: "2024-02-" + String(index % 28 + 1).padStart(2, "0"), return_20d_percent: row.outcome ? 1 : -1 }; });
  // Keep unique, lexically ordered dates for the small fold fixture.
  features.forEach(function (feature, index) { feature.market_date = "2024-" + String(Math.floor(index / 20) + 1).padStart(2, "0") + "-" + String(index % 20 + 1).padStart(2, "0"); });
  labels.forEach(function (label, index) { label.market_date = features[index].market_date; });
  const report = buildLogisticEvaluation({
    features,
    labels,
    manifest: {
      splitVersion: "qqq-walk-forward-v1",
      instrument: "QQQ",
      featureVersion: "fixture-feature",
      labelVersion: "fixture-label",
      horizonTradingDays: 20,
      splits: [{
        id: "fold-01",
        training: { startDate: features[0].market_date, endDate: features[79].market_date },
        embargo: { startDate: features[80].market_date, endDate: features[89].market_date, tradingDays: 10 },
        evaluation: { startDate: features[90].market_date, endDate: features[119].market_date }
      }]
    },
    minimumSamples: 60,
    iterations: 120
  });
  assert.equal(report.folds.length, 1);
  assert.equal("predictions" in report.folds[0], false);
  assert.equal(report.summary.metrics.sampleCount, 30);
});

test("committed QQQ logistic report is explicitly research-only and tied to frozen splits", function () {
  const report = getLogisticEvaluationReport();
  assert.equal(report.deploymentStatus, "research_only_not_selected");
  assert.equal(report.splitVersion, "qqq-walk-forward-v1");
  assert.equal(report.folds.length, 16);
  assert.equal(report.summary.metrics.sampleCount, 975);
  assert.equal(report.summary.calibrationBins.reduce(function (sum, bin) { return sum + bin.sampleCount; }, 0), 975);
});
