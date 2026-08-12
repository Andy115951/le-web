const assert = require("node:assert/strict");
const test = require("node:test");
const { buildWalkForwardBacktest, maximumDrawdown } = require("../lib/walk-forward-backtest");
const { getWalkForwardBacktestReport } = require("../lib/evaluation-backtest-report");

function source() {
  return Array.from({ length: 120 }, function (_item, index) {
    const month = Math.floor(index / 30) + 1;
    const day = index % 30 + 1;
    const date = "2024-" + String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0");
    const up = index % 2 === 0;
    return { date, feature: { market_date: date, return_20d_percent: up ? 3 : -3 }, label: { market_date: date, return_20d_percent: up ? 4 : -4 } };
  });
}

test("walk-forward backtest samples non-overlapping evaluation periods and never emits decisions", function () {
  const rows = source();
  const report = buildWalkForwardBacktest({
    features: rows.map(function (row) { return row.feature; }),
    labels: rows.map(function (row) { return row.label; }),
    manifest: { splitVersion: "qqq-walk-forward-v1", instrument: "QQQ", splits: [{ id: "fold-01", training: { startDate: rows[0].date, endDate: rows[79].date }, evaluation: { startDate: rows[80].date, endDate: rows[119].date } }] }
  });
  assert.equal(report.benchmark.summary.decisionCount, 2);
  assert.equal(report.candidates.length, 3);
  assert.equal("decisions" in report.candidates[0].summary, false);
  assert.match(report.methodology.limitation, /Research-only/);
});

test("maximum drawdown is measured from compounded simulated periods", function () {
  assert.ok(Math.abs(maximumDrawdown([10, -20, 10]) + 20) < 1e-9);
});

test("committed QQQ backtest report stays research-only and retains no decisions", function () {
  const report = getWalkForwardBacktestReport();
  assert.equal(report.deploymentStatus, "research_only_not_selected");
  assert.equal(report.splitVersion, "qqq-walk-forward-v1");
  assert.equal(report.benchmark.summary.decisionCount, 61);
  assert.ok(report.candidates.every(function (candidate) { return !("decisions" in candidate.summary); }));
});
