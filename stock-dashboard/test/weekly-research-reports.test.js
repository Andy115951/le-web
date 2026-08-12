const assert = require("node:assert/strict");
const test = require("node:test");
const { buildWeeklyResearchReport, normalizeWeeklyReportLimit, weekStartForDate } = require("../lib/weekly-research-reports");

function daily(marketDate, close, changePercent, evidence = {}) {
  return {
    market_date: marketDate,
    report: {
      market: { symbol: "QQQ", adjustedClose: close, changePercent, volatilityLevel: "normal" },
      evidence: { eventCount: 0, similarDayCandidateCount: 0, eventTypes: {}, reviewStatuses: {}, providers: {}, ...evidence }
    }
  };
}

test("weekly research report only aggregates archived daily facts", function () {
  const report = buildWeeklyResearchReport([
    daily("2026-08-10", 500, 1, { eventCount: 2, providers: { sec: 1 } }),
    daily("2026-08-11", 510, 2, { eventCount: 3, providers: { sec: 2, fred: 1 }, similarDayCandidateCount: 4 })
  ]);

  assert.equal(report.weekStart, "2026-08-10");
  assert.equal(report.coverage.archivedDailyReports, 2);
  assert.equal(report.coverage.status, "limited");
  assert.equal(report.market.observedWindowChangePercent, 2);
  assert.equal(report.evidence.eventCount, 5);
  assert.deepEqual(report.evidence.providers, { sec: 3, fred: 1 });
  assert.equal("forecast" in report, false);
});

test("weekly report calendar grouping starts on Monday and has safe limits", function () {
  assert.equal(weekStartForDate("2026-08-16"), "2026-08-10");
  assert.equal(normalizeWeeklyReportLimit(100), 12);
  assert.equal(normalizeWeeklyReportLimit(-2), 1);
});
