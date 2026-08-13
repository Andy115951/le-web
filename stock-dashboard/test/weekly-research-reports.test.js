const assert = require("node:assert/strict");
const test = require("node:test");
const {
  assessWeeklyFreezeEligibility,
  buildFrozenWeeklyResearchReport,
  buildWeeklyResearchReport,
  freezeCandidateWeekStart,
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

test("weekly freezing requires every expected NYSE trading-day report and preserves coverage", function () {
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
  assert.equal(frozen.freeze.rule, "complete_expected_nyse_trading_days_archived_daily_reports_v1");
  assert.equal(frozen.coverage.tradingCalendar.status, "official_full_closures");
});

test("official full-day closures reduce only the expected report set and retain early-close sessions", function () {
  const goodFridayWeek = [
    daily("2026-03-30", 500, 1), daily("2026-03-31", 501, 0.2),
    daily("2026-04-01", 502, 0.2), daily("2026-04-02", 503, 0.2)
  ];
  const eligible = assessWeeklyFreezeEligibility("2026-03-30", goodFridayWeek, "2026-04-02");
  assert.equal(eligible.eligible, true);
  assert.deepEqual(eligible.expectedDates, ["2026-03-30", "2026-03-31", "2026-04-01", "2026-04-02"]);
  assert.deepEqual(eligible.tradingWeek.fullClosureDates, ["2026-04-03"]);
  assert.equal(eligible.tradingWeek.calendarStatus, "official_full_closures");

  const thanksgivingWeek = [
    daily("2026-11-23", 500, 1), daily("2026-11-24", 501, 0.2),
    daily("2026-11-25", 502, 0.2), daily("2026-11-27", 503, 0.2)
  ];
  const thanksgiving = assessWeeklyFreezeEligibility("2026-11-23", thanksgivingWeek, "2026-11-27");
  assert.equal(thanksgiving.eligible, true);
  assert.deepEqual(thanksgiving.tradingWeek.fullClosureDates, ["2026-11-26"]);
  assert.deepEqual(thanksgiving.expectedDates, ["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-27"]);
});

test("weekly freeze selects the prior completed week when the current week is still open", function () {
  assert.equal(freezeCandidateWeekStart("2026-04-02"), "2026-03-30");
  assert.equal(freezeCandidateWeekStart("2026-04-06"), "2026-03-30");
  assert.equal(freezeCandidateWeekStart("2026-08-13"), "2026-08-03");
  assert.equal(freezeCandidateWeekStart("2026-08-14"), "2026-08-10");
});

test("holiday-week freezing writes four archived reports after the final expected trading day", async function () {
  const reports = [
    daily("2026-03-30", 500, 1), daily("2026-03-31", 501, 0.2),
    daily("2026-04-01", 502, 0.2), daily("2026-04-02", 503, 0.2)
  ];
  const calls = [];
  const client = async function (_config, path, options) {
    calls.push({ path, options });
    if (path.includes("daily_research_reports")) return reports;
    if (path.includes("frozen_weekly_research_reports")) return [{ id: "holiday-week" }];
    return [];
  };
  const frozen = await freezeWeeklyResearchReport({ asOfDate: "2026-04-02", frozenAt: "2026-04-03T01:00:00.000Z" }, {}, client);
  assert.equal(frozen.status, "succeeded");
  assert.equal(frozen.weekStart, "2026-03-30");
  assert.equal(frozen.expectedBusinessDateCount, 4);
  assert.equal(frozen.archivedDailyReportCount, 4);
  assert.equal(frozen.calendarStatus, "official_full_closures");
  const write = calls.find(function (call) { return call.options?.method === "POST"; });
  assert.deepEqual(write.options.body.report.coverage.fullClosureDates, ["2026-04-03"]);
});

test("unknown calendar years conservatively retain the five-weekday requirement", function () {
  const complete = [
    daily("2029-08-13", 500, 1), daily("2029-08-14", 501, 0.2), daily("2029-08-15", 502, 0.2),
    daily("2029-08-16", 503, 0.2), daily("2029-08-17", 504, 0.2)
  ];
  const eligible = assessWeeklyFreezeEligibility("2029-08-13", complete, "2029-08-17");
  assert.equal(eligible.eligible, true);
  assert.equal(eligible.tradingWeek.calendarStatus, "strict_weekday_fallback");
  assert.equal(eligible.expectedDates.length, 5);
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
    status: "succeeded", reason: null, weekStart: "2026-08-10", expectedBusinessDateCount: 5, archivedDailyReportCount: 5, calendarStatus: "official_full_closures", created: true
  });
  assert.equal(calls.some(function (call) { return call.options?.method === "POST" && call.path.includes("on_conflict=week_start,report_version"); }), true);
  const result = await getWeeklyResearchReports({ limit: 6 }, {}, client);
  assert.equal(result.count, 1);
  assert.equal(result.reports[0].archived, true);
  assert.equal(result.reports[0].report.coverage.status, "frozen_complete");
});
