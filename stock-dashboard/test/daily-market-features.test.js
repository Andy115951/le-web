const assert = require("node:assert/strict");
const test = require("node:test");
const {
  annualizedVolatility,
  buildDailyMarketFeatures,
  marketCloseAt,
  summarizeKnownEvents,
  trailingDrawdown
} = require("../lib/daily-market-features");

function row(index) {
  const date = new Date(Date.UTC(2026, 2, 2 + index));
  const marketDate = date.toISOString().slice(0, 10);
  const close = 100 + index;
  return {
    market_date: marketDate,
    open: close - 0.5,
    high: close + 1,
    low: close - 1,
    close,
    adjusted_close: close,
    volume: 1000 + index * 10,
    source: "test",
    captured_at: "2026-03-30T21:00:00.000Z"
  };
}

test("market close respects New York daylight saving time", function () {
  assert.equal(marketCloseAt("2026-03-06"), "2026-03-06T21:00:00.000Z");
  assert.equal(marketCloseAt("2026-03-09"), "2026-03-09T20:00:00.000Z");
  assert.equal(marketCloseAt("2026-11-02"), "2026-11-02T21:00:00.000Z");
});

test("daily features only retain events known by the New York close", function () {
  const asOf = marketCloseAt("2026-03-09");
  const summary = summarizeKnownEvents([
    { event_type: "earnings", impact_level: "high", tickers: ["NVDA"], available_at: "2026-03-09T19:59:59.000Z" },
    { event_type: "news", impact_level: "medium", tickers: ["NVDA", "MSFT"], available_at: "2026-03-09T20:00:01.000Z" },
    { event_type: "news", impact_level: "low", tickers: ["AAPL"], available_at: "2026-03-10T12:00:00.000Z" }
  ], asOf);
  assert.equal(summary.availableEventCount, 1);
  assert.equal(summary.highImpactEventCount, 1);
  assert.equal(summary.mediumImpactEventCount, 0);
  assert.equal(summary.eventTickerCount, 1);
  assert.deepEqual(summary.eventTypeCounts, { earnings: 1 });
});

test("price features use only trailing data through each feature date", function () {
  const prices = Array.from({ length: 25 }, function (_, index) { return row(index); });
  const first = buildDailyMarketFeatures({ prices, events: [], computedAt: "2026-04-01T00:00:00.000Z" })[20];
  prices.push({ ...row(25), adjusted_close: 10000, close: 10000 });
  const second = buildDailyMarketFeatures({ prices, events: [], computedAt: "2026-04-01T00:00:00.000Z" })[20];
  assert.equal(first.return1dPercent, second.return1dPercent);
  assert.equal(first.return5dPercent, second.return5dPercent);
  assert.equal(first.return20dPercent, second.return20dPercent);
  assert.equal(first.trailingVolatility20dPercent, second.trailingVolatility20dPercent);
  assert.equal(first.trailingDrawdown20dPercent, second.trailingDrawdown20dPercent);
  assert.equal(first.volumeRatio20dPercent, second.volumeRatio20dPercent);
  assert.equal(first.return20dPercent, 20);
  assert.equal(first.availableEventCount, 0);
});

test("trailing calculations have stable boundary behavior", function () {
  assert.equal(annualizedVolatility(Array(21).fill(100)), 0);
  assert.equal(annualizedVolatility(Array(20).fill(100)), null);
  assert.equal(trailingDrawdown([100]), null);
  assert.equal(trailingDrawdown([100, 110, 99]), -10);
});
