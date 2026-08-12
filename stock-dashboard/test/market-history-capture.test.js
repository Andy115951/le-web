const assert = require("node:assert/strict");
const test = require("node:test");
const {
  collectSymbols,
  determineRunStatus,
  normalizeHistoryDays,
  normalizeCaptureOptions,
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

test("determineRunStatus distinguishes complete and partial failures", function () {
  assert.equal(determineRunStatus(2, 0, 0), "succeeded");
  assert.equal(determineRunStatus(0, 0, 0), "skipped");
  assert.equal(determineRunStatus(0, 2, 0), "skipped");
  assert.equal(determineRunStatus(1, 0, 1), "partial");
  assert.equal(determineRunStatus(0, 1, 1), "partial");
  assert.equal(determineRunStatus(0, 0, 1), "failed");
});
