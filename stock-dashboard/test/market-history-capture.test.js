const assert = require("node:assert/strict");
const test = require("node:test");
const {
  collectSymbols,
  buildSafeCaptureDetails,
  determineRunStatus,
  normalizeHistoryDays,
  normalizeCaptureOptions,
  normalizeCaptureRunId,
  sanitizeCaptureResultForOps,
  sanitizeCaptureRunForOps,
  toHistoryRow,
  toPublicHistoryRow
} = require("../lib/market-history-capture");

test("collectSymbols normalizes, deduplicates, and filters symbols", function () {
  assert.deepEqual(collectSymbols([
    { symbol: " nvda " },
    { symbol: "NVDA" },
    { symbol: "QQQ" },
    { symbol: "600519" },
    { symbol: "not valid" }
  ]), ["NVDA", "QQQ"]);
});

test("normalizeHistoryDays only accepts supported dashboard ranges", function () {
  assert.equal(normalizeHistoryDays(30), 30);
  assert.equal(normalizeHistoryDays("90"), 90);
  assert.equal(normalizeHistoryDays(180), 180);
  assert.equal(normalizeHistoryDays(365), 30);
});

test("public history rows preserve market identity without a user id", function () {
  const now = new Date("2026-08-12T01:00:00.000Z");
  const row = toPublicHistoryRow({
    date: "2026-08-11",
    symbol: "QQQ",
    name: "Invesco QQQ Trust",
    changePercent: -0.34,
    benchmarkChangePercent: -0.34,
    driverType: "market",
    confidence: "medium",
    summary: "Market summary",
    reasons: ["Reason"],
    news: [],
    eventTime: "2026-08-11T20:00:00.000Z",
    availableAt: "2026-08-11T20:00:12.000Z",
    capturedAt: now.toISOString()
  }, now);
  assert.equal(row.instrument_role, "benchmark");
  assert.equal(row.universe_as_of, "2026-06-30");
  assert.equal(row.event_time, "2026-08-11T20:00:00.000Z");
  assert.equal(row.available_at, "2026-08-11T20:00:12.000Z");
  assert.equal("user_id" in row, false);
});

test("public rows preserve the exact dynamic universe version", function () {
  const now = new Date("2026-08-12T01:00:00.000Z");
  const row = toPublicHistoryRow({
    date: "2026-08-11",
    symbol: "NVDA",
    name: "NVIDIA",
    reasons: [],
    news: [],
    capturedAt: now.toISOString()
  }, now, {
    asOf: "2026-05-01",
    instruments: [{ symbol: "NVDA", role: "component" }]
  });
  assert.equal(row.universe_as_of, "2026-05-01");
  assert.equal(row.instrument_role, "component");
});

test("personal compatibility rows do not write unified-only time columns", function () {
  const now = new Date("2026-08-12T01:00:00.000Z");
  const row = toHistoryRow("user-id", {
    date: "2026-08-11",
    symbol: "QQQ",
    name: "Invesco QQQ Trust",
    reasons: [],
    news: [],
    eventTime: "2026-08-11T20:00:00.000Z",
    availableAt: "2026-08-11T20:00:12.000Z",
    capturedAt: now.toISOString()
  }, now);
  assert.equal("event_time" in row, false);
  assert.equal("available_at" in row, false);
});

test("normalizeCaptureOptions preserves cron and manual triggers", function () {
  const now = new Date("2026-08-12T22:00:00.000Z");
  assert.deepEqual(normalizeCaptureOptions({ now, trigger: "manual" }), { now, trigger: "manual" });
  assert.deepEqual(normalizeCaptureOptions({ now, trigger: "unknown" }), { now, trigger: "cron" });
  assert.deepEqual(normalizeCaptureOptions(now), { now, trigger: "manual" });
});

test("capture run ids only accept UUIDs for protected single-run diagnostics", function () {
  assert.equal(normalizeCaptureRunId("7ca68fea-797e-46c9-9ee2-34b503dfceb1"), "7ca68fea-797e-46c9-9ee2-34b503dfceb1");
  assert.equal(normalizeCaptureRunId("not-a-run-id"), null);
  assert.equal(normalizeCaptureRunId("7ca68fea-797e-46c9-9ee2-34b503dfceb1&details=*"), null);
});

test("determineRunStatus distinguishes complete and partial failures", function () {
  assert.equal(determineRunStatus(2, 0, 0), "succeeded");
  assert.equal(determineRunStatus(0, 0, 0), "skipped");
  assert.equal(determineRunStatus(0, 2, 0), "skipped");
  assert.equal(determineRunStatus(1, 0, 1), "partial");
  assert.equal(determineRunStatus(0, 1, 1), "partial");
  assert.equal(determineRunStatus(0, 0, 1), "failed");
});

test("capture diagnostics remove user data, raw errors, and non-public symbols", function () {
  const details = buildSafeCaptureDetails({
    failedSymbols: ["QQQ", "PRIVATE", "NVDA", "private"],
    personalFailedSymbolCount: 3,
    userFailures: [{ userId: "private-user", error: "raw upstream failure" }],
    secFilingStatus: "failed",
    secFilingError: "do-not-return-this",
    researchNarrativeReason: "another raw error"
  });
  assert.deepEqual(details.publicFailedSymbols, ["NVDA", "QQQ"]);
  assert.equal(details.publicFailedSymbolCount, 2);
  assert.equal(details.personalFailedSymbolCount, 3);
  assert.equal(JSON.stringify(details).includes("private-user"), false);
  assert.equal(JSON.stringify(details).includes("raw upstream failure"), false);
  assert.equal(JSON.stringify(details).includes("do-not-return-this"), false);
});

test("operational capture responses expose only a bounded safe summary", function () {
  const run = sanitizeCaptureRunForOps({
    id: "run-123",
    trigger_type: "manual",
    status: "partial",
    market_date: "2026-08-15",
    source_users: 4,
    processed_users: 2,
    failed_users: 1,
    error_message: "database hostname and user details",
    details: {
      failedSymbols: ["QQQ", "PERSONAL"],
      userFailures: [{ userId: "private-user", error: "raw failure" }]
    }
  });
  assert.equal(run.runId, "run-123");
  assert.deepEqual(run.details.publicFailedSymbols, ["QQQ"]);
  assert.equal(run.details.publicFailedSymbolCount, 1);
  assert.equal(JSON.stringify(run).includes("private-user"), false);
  assert.equal(JSON.stringify(run).includes("database hostname"), false);

  const result = sanitizeCaptureResultForOps({
    runId: "run-456",
    status: "skipped",
    reason: "raw upstream reason",
    failedSymbols: ["QQQ", "PERSONAL"],
    loggingError: "do-not-expose",
    researchNarrativeReason: "do-not-expose"
  });
  assert.equal(result.skipReason, "outside_post_close_window");
  assert.deepEqual(result.publicFailedSymbols, ["QQQ"]);
  assert.equal(result.publicFailedSymbolCount, 1);
  assert.equal(JSON.stringify(result).includes("do-not-expose"), false);
  assert.equal(JSON.stringify(result).includes("raw upstream reason"), false);
});
