const assert = require("node:assert/strict");
const test = require("node:test");
const { buildTreeEvaluation, fitProbabilityTree, predictProbabilityTree } = require("../lib/walk-forward-tree");
const { getTreeEvaluationReport } = require("../lib/evaluation-tree-report");

function trainingRows() {
  return Array.from({ length: 120 }, function (_item, index) {
    const up = index >= 60 ? 1 : 0;
    const month = Math.floor(index / 30) + 1;
    const day = index % 30 + 1;
    return { date: "2024-" + String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0"), feature: { return_20d_percent: up ? 4 : -4 }, outcome: up };
  });
}

test("shallow tree learns a train-only split and produces bounded probabilities", function () {
  const model = fitProbabilityTree(trainingRows());
  const low = predictProbabilityTree(model, { return_20d_percent: -4 });
  const high = predictProbabilityTree(model, { return_20d_percent: 4 });
  assert.equal(model.root.type, "split");
  assert.ok(high > low);
  assert.ok(low > 0 && high < 1);
});

test("tree evaluation retains no individual predictions in frozen report folds", function () {
  const rows = trainingRows();
  const dates = rows.map(function (row) { return row.date; });
  const report = buildTreeEvaluation({
    features: rows.map(function (row) { return { market_date: row.date, ...row.feature }; }),
    labels: rows.map(function (row) { return { market_date: row.date, return_20d_percent: row.outcome ? 2 : -2 }; }),
    manifest: { splitVersion: "qqq-walk-forward-v1", instrument: "QQQ", splits: [{ id: "fold-01", training: { startDate: dates[0], endDate: dates[79] }, embargo: { tradingDays: 20 }, evaluation: { startDate: dates[80], endDate: dates[119] } }] }
  });
  assert.equal(report.folds[0].metrics.sampleCount, 40);
  assert.equal("predictions" in report.folds[0], false);
  assert.equal(report.summary.calibrationBins.reduce(function (sum, bin) { return sum + bin.sampleCount; }, 0), 40);
});

test("committed QQQ tree report is research-only and bound to frozen splits", function () {
  const report = getTreeEvaluationReport();
  assert.equal(report.deploymentStatus, "research_only_not_selected");
  assert.equal(report.splitVersion, "qqq-walk-forward-v1");
  assert.equal(report.folds.length, 16);
  assert.equal(report.summary.metrics.sampleCount, 962);
});
