const assert = require("node:assert/strict");
const test = require("node:test");
const {
  marketDate,
  normalizeRange,
  normalizeSymbol,
  parseYahooDailyBars
} = require("../lib/historical-market-data");

test("marketDate resolves timestamps in the New York market timezone", function () {
  assert.equal(marketDate(Date.parse("2026-08-12T00:30:00.000Z")), "2026-08-11");
});

test("market input normalization keeps the supported surface bounded", function () {
  assert.equal(normalizeSymbol(" qqq "), "QQQ");
  assert.throws(function () { normalizeSymbol("QQQ<script>"); }, /Unsupported market symbol/);
  assert.equal(normalizeRange("10Y"), "10y");
  assert.equal(normalizeRange("max"), "5y");
});

test("Yahoo parser produces validated daily bars and close-to-close changes", function () {
  const payload = {
    chart: {
      result: [{
        meta: { longName: "Invesco QQQ Trust", exchangeName: "NMS", currency: "USD" },
        timestamp: [
          Date.parse("2026-08-10T16:00:00.000Z") / 1000,
          Date.parse("2026-08-11T16:00:00.000Z") / 1000,
          Date.parse("2026-08-12T16:00:00.000Z") / 1000
        ],
        indicators: {
          quote: [{
            open: [100, 103, null],
            high: [105, 108, null],
            low: [99, 102, null],
            close: [102, 107.1, null],
            volume: [1000, 1250, null]
          }],
          adjclose: [{ adjclose: [101.5, 106.8, null] }]
        }
      }],
      error: null
    }
  };

  const result = parseYahooDailyBars(payload, "qqq");
  assert.equal(result.symbol, "QQQ");
  assert.equal(result.bars.length, 2);
  assert.deepEqual(result.bars[0], {
    marketDate: "2026-08-10",
    open: 100,
    high: 105,
    low: 99,
    close: 102,
    adjustedClose: 101.5,
    volume: 1000,
    changePercent: null
  });
  assert.equal(result.bars[1].changePercent, 5);
});
