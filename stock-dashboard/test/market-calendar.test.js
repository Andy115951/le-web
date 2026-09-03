const assert = require("node:assert/strict");
const test = require("node:test");
const {
  annualizedTrailingVolatility,
  buildCalendarDays,
  monthBounds,
  normalizeDate,
  normalizeMonth,
  previousWeekdayDate,
  volatilityLevel
} = require("../lib/market-calendar");
const { isKnownNyseFullClosure } = require("../lib/nyse-trading-calendar");

test("calendar input validation handles real dates and leap months", function () {
  assert.deepEqual(monthBounds("2024-02"), { start: "2024-02-01", end: "2024-02-29" });
  assert.equal(normalizeMonth("2026-08"), "2026-08");
  assert.equal(normalizeDate("2026-08-11"), "2026-08-11");
  assert.throws(function () { normalizeMonth("2026-13"); }, /Invalid calendar month/);
  assert.throws(function () { normalizeDate("2026-02-31"); }, /Invalid calendar date/);
  assert.equal(previousWeekdayDate("2026-08-10"), "2026-08-07");
});

test("trailing volatility uses only the 20 returns ending on that day", function () {
  const steady = Array(21).fill(100);
  assert.equal(annualizedTrailingVolatility(steady), 0);
  assert.equal(annualizedTrailingVolatility(steady.slice(0, 20)), null);
  assert.equal(volatilityLevel(0), "calm");
  assert.equal(volatilityLevel(20), "normal");
  assert.equal(volatilityLevel(30), "elevated");
});

test("calendar separates trading, weekend, missing and upcoming dates", function () {
  const days = buildCalendarDays({
    start: "2026-08-01",
    end: "2026-08-06",
    today: "2026-08-05",
    prices: [{
      market_date: "2026-08-03",
      open: 100,
      high: 103,
      low: 99,
      close: 102,
      adjusted_close: 102,
      volume: 1000,
      change_percent: 2
    }],
    labels: [{
      market_date: "2026-08-03",
      return_1d_percent: 1.2,
      return_3d_percent: null,
      return_5d_percent: null,
      return_20d_percent: null,
      max_drawdown_20d_percent: null,
      realized_volatility_20d_percent: null,
      label_version: "v1"
    }],
    events: [{
      market_date: "2026-08-03",
      event_type: "market_move_attribution",
      impact_level: "high",
      tickers: ["QQQ", "NVDA"]
    }],
    earnings: [{ marketDate: "2026-08-03", symbol: "NVDA", session: "after_market" }]
  });
  assert.equal(days[0].status, "weekend");
  assert.equal(days[2].status, "trading");
  assert.equal(days[3].status, "closed-or-missing");
  assert.equal(days[5].status, "upcoming");
  assert.equal(days[2].eventSummary.highestImpact, "high");
  assert.equal(days[2].eventSummary.earningsCount, 1);
  assert.deepEqual(days[2].eventSummary.symbols, ["QQQ", "NVDA"]);
  assert.equal(days[2].researchOutcome.return1dPercent, 1.2);
  assert.equal(days[2].researchOutcome.return3dPercent, null);
});

test("calendar marks only covered official full closures as market holidays", function () {
  const days = buildCalendarDays({
    start: "2026-09-07",
    end: "2026-09-08",
    today: "2026-09-08",
    prices: [],
    labels: [],
    events: [],
    earnings: []
  });
  assert.equal(isKnownNyseFullClosure("2026-09-07"), true);
  assert.equal(days[0].status, "market-holiday");
  assert.equal(days[1].status, "closed-or-missing");

  const uncovered = buildCalendarDays({
    start: "2025-09-01",
    end: "2025-09-01",
    today: "2025-09-02",
    prices: [],
    labels: [],
    events: [],
    earnings: []
  });
  assert.equal(uncovered[0].status, "closed-or-missing");
});

test("future prices do not alter an earlier day's trailing state", function () {
  const prices = Array.from({ length: 22 }, function (_, index) {
    return {
      market_date: "2026-07-" + String(index + 10).padStart(2, "0"),
      adjusted_close: 100 + index,
      close: 100 + index,
      open: 100 + index,
      high: 101 + index,
      low: 99 + index,
      volume: 1000,
      change_percent: 1
    };
  });
  const options = {
    start: "2026-07-30",
    end: "2026-07-31",
    today: "2026-08-01",
    labels: [],
    events: []
  };
  const first = buildCalendarDays({ ...options, prices })[0].qqq.trailingVolatility20dPercent;
  prices.push({ ...prices.at(-1), market_date: "2026-08-01", adjusted_close: 1000, close: 1000 });
  const second = buildCalendarDays({ ...options, prices })[0].qqq.trailingVolatility20dPercent;
  assert.equal(second, first);
});
