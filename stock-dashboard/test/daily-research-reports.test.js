const assert = require("node:assert/strict");
const test = require("node:test");
const { buildDailyResearchReport, getDailyResearchReports, latestReportsByDateAndVersion, normalizeDailyReportLimit, persistDailyResearchReport } = require("../lib/daily-research-reports");

test("daily research report uses only snapshot facts and refuses recommendation fields", function () {
  const report = buildDailyResearchReport({ id: "snapshot-1", market_date: "2026-01-02", source_summary: { eventCount: 2, reviewStatuses: { accepted: 1 }, providers: { sec: 1 }, similarDayCandidateCount: 4 } }, { marketState: { symbol: "QQQ", adjustedClose: 510, changePercent: 1.2, volatilityLevel: "normal" } });
  assert.equal(report.kind, "deterministic_fact_recap");
  assert.equal(report.market.changePercent, 1.2);
  assert.equal(report.evidence.eventCount, 2);
  assert.equal("forecast" in report, false);
  assert.ok(report.limitations.some(function (line) { return /Does not contain/.test(line); }));
});

test("daily report reads stay bounded", function () { assert.equal(normalizeDailyReportLimit(100), 30); assert.equal(normalizeDailyReportLimit(-1), 1); });

test("daily reports return a bounded date cursor page with an explicit continuation flag", async function () {
  let path = "";
  const rows = Array.from({ length: 8 }, function (_, index) {
    return { market_date: "2026-08-" + String(14 - index).padStart(2, "0"), report_version: "v1", report: {}, created_at: "2026-08-14T00:00:00Z" };
  });
  const result = await getDailyResearchReports(
    { limit: 7, endDate: "2026-08-14" },
    { url: "https://example.invalid", secretKey: "secret" },
    async function (_config, receivedPath) { path = receivedPath; return rows; }
  );
  assert.match(path, /market_date=lte\.2026-08-14/);
  assert.match(path, /limit=29/);
  assert.equal(result.count, 7);
  assert.equal(result.hasMore, true);
  assert.equal(result.reports.length, 7);
});

test("daily report pagination keeps only the newest same-date report version", function () {
  const rows = latestReportsByDateAndVersion([
    { market_date: "2026-08-14", report_version: "v1", created_at: "2026-08-14T19:00:00Z", report: { revision: "old" } },
    { market_date: "2026-08-14", report_version: "v1", created_at: "2026-08-14T20:00:00Z", report: { revision: "new" } },
    { market_date: "2026-08-13", report_version: "v1", created_at: "2026-08-13T20:00:00Z", report: { revision: "other-day" } }
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].report.revision, "new");
  assert.equal(rows[1].report.revision, "other-day");
});

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
