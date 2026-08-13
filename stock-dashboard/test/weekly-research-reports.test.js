const assert = require("node:assert/strict");
const test = require("node:test");
const {
  assessWeeklyFreezeEligibility,
  buildFrozenWeeklyResearchReport,
  buildWeeklyResearchReport,
  freezeWeeklyResearchReport,
  getWeeklyResearchReports,
  normalizeWeeklyReportLimit,
  weekStartForDate
} = require("../lib/weekly-research-reports");

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

test("weekly freezing requires all Monday-to-Friday reports and preserves the fixed coverage rule", function () {
  const complete = [
    daily("2026-08-10", 500, 1), daily("2026-08-11", 501, 0.2), daily("2026-08-12", 502, 0.2),
    daily("2026-08-13", 503, 0.2), daily("2026-08-14", 504, 0.2)
  ];
  const beforeFriday = assessWeeklyFreezeEligibility("2026-08-10", complete, "2026-08-13");
  assert.equal(beforeFriday.eligible, false);
  assert.equal(beforeFriday.reason, "week_not_complete");
  const missingDay = assessWeeklyFreezeEligibility("2026-08-10", complete.slice(0, 4), "2026-08-14");
  assert.equal(missingDay.eligible, false);
  assert.equal(missingDay.reason, "incomplete_business_week");
  assert.deepEqual(missingDay.missingDates, ["2026-08-14"]);
  const eligible = assessWeeklyFreezeEligibility("2026-08-10", [...complete, { ...complete[0], created_at: "2026-08-20T00:00:00.000Z" }], "2026-08-14");
  assert.equal(eligible.eligible, true);
  const frozen = buildFrozenWeeklyResearchReport(eligible, "2026-08-15T01:00:00.000Z");
  assert.equal(frozen.coverage.status, "frozen_complete");
  assert.equal(frozen.coverage.archivedDailyReports, 5);
  assert.deepEqual(frozen.coverage.expectedBusinessDates, ["2026-08-10", "2026-08-11", "2026-08-12", "2026-08-13", "2026-08-14"]);
  assert.equal(frozen.freeze.rule, "complete_monday_to_friday_archived_daily_reports_v1");
});

test("weekly freezing writes only an eligible immutable week and frozen rows override dynamic views", async function () {
  const complete = [
    daily("2026-08-10", 500, 1), daily("2026-08-11", 501, 0.2), daily("2026-08-12", 502, 0.2),
    daily("2026-08-13", 503, 0.2), daily("2026-08-14", 504, 0.2)
  ];
  const calls = [];
  const client = async function (_config, path, options) {
    calls.push({ path, options });
    if (path.includes("daily_research_reports")) return complete;
    if (path.includes("frozen_weekly_research_reports") && options?.method === "POST") return [{ id: "frozen-1" }];
    if (path.includes("frozen_weekly_research_reports")) return [{
      week_start: "2026-08-10",
      report_version: "weekly-research-report-v1",
      frozen_at: "2026-08-15T01:00:00.000Z",
      report: buildFrozenWeeklyResearchReport(assessWeeklyFreezeEligibility("2026-08-10", complete, "2026-08-14"), "2026-08-15T01:00:00.000Z")
    }];
    return [];
  };
  const frozen = await freezeWeeklyResearchReport({ asOfDate: "2026-08-14", frozenAt: "2026-08-15T01:00:00.000Z" }, {}, client);
  assert.deepEqual(frozen, {
    status: "succeeded", reason: null, weekStart: "2026-08-10", expectedBusinessDateCount: 5, archivedDailyReportCount: 5, created: true
  });
  assert.equal(calls.some(function (call) { return call.options?.method === "POST" && call.path.includes("on_conflict=week_start,report_version"); }), true);
  const result = await getWeeklyResearchReports({ limit: 6 }, {}, client);
  assert.equal(result.count, 1);
  assert.equal(result.reports[0].archived, true);
  assert.equal(result.reports[0].report.coverage.status, "frozen_complete");
});
