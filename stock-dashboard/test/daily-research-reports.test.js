const assert = require("node:assert/strict");
const test = require("node:test");
const { buildDailyResearchReport, normalizeDailyReportLimit, persistDailyResearchReport } = require("../lib/daily-research-reports");

test("daily research report uses only snapshot facts and refuses recommendation fields", function () {
  const report = buildDailyResearchReport({ id: "snapshot-1", market_date: "2026-01-02", source_summary: { eventCount: 2, reviewStatuses: { accepted: 1 }, providers: { sec: 1 }, similarDayCandidateCount: 4 } }, { marketState: { symbol: "QQQ", adjustedClose: 510, changePercent: 1.2, volatilityLevel: "normal" } });
  assert.equal(report.kind, "deterministic_fact_recap");
  assert.equal(report.market.changePercent, 1.2);
  assert.equal(report.evidence.eventCount, 2);
  assert.equal("forecast" in report, false);
  assert.ok(report.limitations.some(function (line) { return /Does not contain/.test(line); }));
});

test("daily report reads stay bounded", function () { assert.equal(normalizeDailyReportLimit(100), 30); assert.equal(normalizeDailyReportLimit(-1), 1); });

test("daily research reports use an idempotent snapshot and version conflict key", async function () {
  let received = null;
  const result = await persistDailyResearchReport(
    { url: "https://example.invalid", secretKey: "secret" },
    { id: "snapshot-1", market_date: "2026-01-02", source_summary: {} },
    { marketState: { symbol: "QQQ", adjustedClose: null, changePercent: null } },
    async function (_config, path, options) {
      received = { path, options };
      return [];
    }
  );

  assert.match(received.path, /on_conflict=snapshot_id,report_version/);
  assert.equal(received.options.headers.Prefer, "resolution=ignore-duplicates,return=representation");
  assert.equal(received.options.body.report.market.adjustedClose, null);
  assert.equal(result.created, false);
});
