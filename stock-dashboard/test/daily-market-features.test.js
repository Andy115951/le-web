const assert = require("node:assert/strict");
const test = require("node:test");
const {
  annualizedVolatility,
  buildDailyMarketFeatures,
  marketCloseAt,
  summarizeKnownEvents,
  trailingDrawdown
} = require("../lib/daily-market-features");
const { buildReportedEarningsFeatureEvent } = require("../lib/earnings-calendar");

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

test("weekend macro events attribute to the next trading day, not their calendar date", function () {
  // Two trading days spanning a weekend: Fri 2026-08-14 and Mon 2026-08-17.
  const prices = [
    { market_date: "2026-08-14", open: 99, high: 101, low: 98, close: 100, adjusted_close: 100, volume: 1000, source: "test", captured_at: "2026-08-14T21:00:00.000Z" },
    { market_date: "2026-08-17", open: 100, high: 102, low: 99, close: 101, adjusted_close: 101, volume: 1100, source: "test", captured_at: "2026-08-17T21:00:00.000Z" }
  ];
  // A FRED macro observation published Sunday 2026-08-16 before the Monday close.
  // Its calendar market_date (Sunday) has no feature row; it must land on Monday.
  const events = [{
    event_type: "fred_macro_observation",
    impact_level: "medium",
    tickers: [],
    market_date: "2026-08-16",
    available_at: "2026-08-16T08:06:00.000Z"
  }];
  const features = buildDailyMarketFeatures({ prices, events, computedAt: "2026-09-01T00:00:00.000Z" });
  const friday = features.find(function (f) { return f.marketDate === "2026-08-14"; });
  const monday = features.find(function (f) { return f.marketDate === "2026-08-17"; });
  // Friday closed before the Sunday release, so it must not see the event.
  assert.equal(friday.availableEventCount, 0);
  // Monday is the first trading day on which the weekend event was available.
  assert.equal(monday.availableEventCount, 1);
  assert.deepEqual(monday.eventTypeCounts, { fred_macro_observation: 1 });
});

test("official reported earnings use their publication time instead of their calendar date", function () {
  const prices = [
    { market_date: "2026-07-29", open: 99, high: 101, low: 98, close: 100, adjusted_close: 100, volume: 1000, source: "test", captured_at: "2026-07-29T21:00:00.000Z" },
    { market_date: "2026-07-30", open: 100, high: 102, low: 99, close: 101, adjusted_close: 101, volume: 1100, source: "test", captured_at: "2026-07-30T20:00:00.000Z" }
  ];
  const earnings = buildReportedEarningsFeatureEvent({
    eventKey: "earnings:META:example",
    marketDate: "2026-07-29",
    status: "reported",
    symbol: "META",
    source: { publishedAt: "2026-07-29T21:00:00.000Z" }
  });
  const features = buildDailyMarketFeatures({ prices, events: [earnings], computedAt: "2026-09-02T00:00:00.000Z" });
  assert.equal(features[0].availableEventCount, 0);
  assert.equal(features[1].availableEventCount, 1);
  assert.deepEqual(features[1].eventTypeCounts, { earnings_reported: 1 });
});

test("trailing calculations have stable boundary behavior", function () {
  assert.equal(annualizedVolatility(Array(21).fill(100)), 0);
  assert.equal(annualizedVolatility(Array(20).fill(100)), null);
  assert.equal(trailingDrawdown([100]), null);
  assert.equal(trailingDrawdown([100, 110, 99]), -10);
});
