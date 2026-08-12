const assert = require("node:assert/strict");
const test = require("node:test");
const { buildWalkForwardSplits, validateWalkForwardManifest } = require("../lib/walk-forward-splits");
const { getWalkForwardSplitManifest } = require("../lib/evaluation-split-manifest");

function dateAt(index) {
  return new Date(Date.UTC(2025, 0, 2 + index)).toISOString().slice(0, 10);
}

function sampleRows(count = 30) {
  return Array.from({ length: count }, function (_item, index) {
    return {
      feature: { market_date: dateAt(index), feature_version: "daily-market-feature-v1" },
      label: { market_date: dateAt(index), return_20d_percent: index < count - 3 ? 1.2 : null, label_version: "forward-label-v1" }
    };
  });
}

test("walk-forward splits embargo every training outcome before its evaluation window", function () {
  const rows = sampleRows();
  const manifest = buildWalkForwardSplits({
    instrument: { symbol: "QQQ" },
    features: rows.map(function (row) { return row.feature; }).reverse(),
    labels: rows.map(function (row) { return row.label; }),
    minTrainingDays: 6,
    horizonTradingDays: 3,
    evaluationDays: 4,
    stepDays: 4
  });
  assert.equal(manifest.splitVersion, "qqq-walk-forward-v1");
  assert.equal(manifest.lastMatureOutcomeDate, dateAt(26));
  assert.equal(manifest.splits[0].training.endDate, dateAt(5));
  assert.equal(manifest.splits[0].embargo.startDate, dateAt(6));
  assert.equal(manifest.splits[0].embargo.endDate, dateAt(8));
  assert.equal(manifest.splits[0].evaluation.startDate, dateAt(9));
  manifest.splits.forEach(function (split) {
    assert.ok(split.training.endDate < split.evaluation.startDate);
    assert.equal(split.embargo.tradingDays, 3);
  });
  assert.deepEqual(validateWalkForwardManifest(manifest), { valid: true, errors: [] });
});

test("walk-forward splits refuse to report a manifest without mature labels", function () {
  const features = sampleRows(12).map(function (row) { return row.feature; });
  const labels = features.map(function (feature) { return { market_date: feature.market_date, return_20d_percent: null }; });
  const manifest = buildWalkForwardSplits({ features, labels, minTrainingDays: 3, horizonTradingDays: 2, evaluationDays: 2 });
  assert.equal(manifest.splits.length, 0);
  const validation = validateWalkForwardManifest(manifest);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some(function (error) { return /No walk-forward splits/.test(error); }));
});

test("committed QQQ evaluation manifest is a valid frozen no-leakage artifact", function () {
  const manifest = getWalkForwardSplitManifest();
  assert.equal(manifest.instrument, "QQQ");
  assert.equal(manifest.horizonTradingDays, 20);
  assert.equal(manifest.splits.length, 16);
  assert.equal(manifest.splits[0].training.startDate, "2021-08-12");
  assert.equal(manifest.lastMatureOutcomeDate, "2026-07-14");
});
