const assert = require("node:assert/strict");
const test = require("node:test");
const {
  collectSymbols,
  determineRunStatus,
  normalizeCaptureOptions
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
