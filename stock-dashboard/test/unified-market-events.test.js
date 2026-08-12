const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildUnifiedEventRecords,
  canonicalizeSourceUrl,
  normalizeHistoryDays,
  sourceFingerprint
} = require("../lib/unified-market-events");

test("source URLs remove tracking parameters and normalize ordering", function () {
  const url = canonicalizeSourceUrl("https://example.com/story?utm_source=test&b=2&a=1#part");
  assert.equal(url, "https://example.com/story?a=1&b=2");
  assert.equal(sourceFingerprint(url).length, 64);
  assert.throws(function () { canonicalizeSourceUrl("javascript:alert(1)"); }, /Unsupported source URL/);
});

test("unified records deduplicate evidence and preserve time semantics", function () {
  const capturedAt = "2026-08-12T01:00:00.000Z";
  const news = {
    title: "Nvidia announces a product update",
    publisher: "Example News",
    publishedAt: "2026-08-11T19:00:00.000Z",
    url: "https://example.com/nvidia?utm_medium=feed"
  };
  const records = buildUnifiedEventRecords([{
    symbol: "NVDA",
    date: "2026-08-11",
    eventTime: "2026-08-11T20:00:00.000Z",
    availableAt: "2026-08-11T20:00:12.000Z",
    capturedAt,
    changePercent: -2.4,
    benchmarkChangePercent: -0.3,
    driverType: "company",
    confidence: "medium",
    summary: "Company evidence requires review.",
    reasons: ["Relative move"],
    news: [news, news]
  }], new Date(capturedAt));

  assert.equal(records.events.length, 1);
  assert.equal(records.sources.length, 2);
  assert.equal(records.sourceLinks.length, 2);
  assert.equal(records.entityLinks.length, 2);
  assert.equal(records.events[0].event_key, "market-move:2026-08-11:NVDA:v1");
  assert.equal(records.events[0].event_time, "2026-08-11T20:00:00.000Z");
  assert.equal(records.events[0].available_at, "2026-08-11T20:00:12.000Z");
  assert.equal(records.events[0].impact_level, "high");
  assert.equal(records.events[0].confidence, 0.65);
  assert.deepEqual(records.events[0].tickers, ["NVDA"]);
});

test("unified records ignore malformed events and unsupported evidence URLs", function () {
  const records = buildUnifiedEventRecords([
    { symbol: "bad symbol", date: "2026-08-11" },
    {
      symbol: "QQQ",
      date: "2026-08-11",
      capturedAt: "2026-08-12T01:00:00.000Z",
      news: [{ title: "Bad", url: "file:///tmp/news" }]
    }
  ]);
  assert.equal(records.events.length, 1);
  assert.equal(records.sources.length, 1);
  assert.equal(records.events[0].event_time, null);
  assert.deepEqual(records.entityLinks, [{
    eventKey: "market-move:2026-08-11:QQQ:v1",
    symbol: "QQQ",
    entityRole: "primary"
  }]);
});

test("missing timestamps remain null instead of becoming the Unix epoch", function () {
  const records = buildUnifiedEventRecords([{
    symbol: "QQQ",
    date: "2026-08-11",
    capturedAt: "2026-08-12T01:00:00.000Z"
  }]);
  assert.equal(records.events[0].event_time, null);
  assert.equal(records.sources[0].published_at, null);
});

test("event history ranges stay aligned with public dashboard choices", function () {
  assert.equal(normalizeHistoryDays(30), 30);
  assert.equal(normalizeHistoryDays("90"), 90);
  assert.equal(normalizeHistoryDays(180), 180);
  assert.equal(normalizeHistoryDays(365), 30);
});
