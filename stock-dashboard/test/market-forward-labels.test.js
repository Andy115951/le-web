const assert = require("node:assert/strict");
const test = require("node:test");
const {
  calculateForwardLabels,
  maxDrawdown,
  priceOf
} = require("../lib/market-forward-labels");

function rowsFromPrices(prices) {
  return prices.map(function (price, index) {
    return {
      market_date: "2026-01-" + String(index + 1).padStart(2, "0"),
      adjusted_close: price,
      close: price + 1000
    };
  });
}

test("forward returns use adjusted close and trading-day horizons", function () {
  const prices = Array.from({ length: 21 }, function (_, index) { return 100 * (1.01 ** index); });
  const labels = calculateForwardLabels(rowsFromPrices(prices), "2026-02-01T00:00:00.000Z");
  assert.equal(labels[0].return1dPercent, 1);
  assert.equal(labels[0].return3dPercent, 3.0301);
  assert.equal(labels[0].return5dPercent, 5.101005);
  assert.equal(labels[0].return20dPercent, 22.019004);
  assert.equal(labels[0].maxDrawdown20dPercent, 0);
  assert.equal(labels[0].realizedVolatility20dPercent, 0);
  assert.equal(labels[0].priceBasis, "adjusted_close");
  assert.equal(labels[0].horizonUnit, "trading_day");
});

test("20-day drawdown measures peak-to-later-trough loss", function () {
  const prices = [100, 110, 90].concat(Array(18).fill(95));
  const labels = calculateForwardLabels(rowsFromPrices(prices));
  assert.equal(labels[0].maxDrawdown20dPercent, -18.181818);
  assert.ok(labels[0].realizedVolatility20dPercent > 0);
  assert.equal(maxDrawdown([100, 110, 90]), -18.181818);
});

test("unmatured horizons remain null instead of inventing future data", function () {
  const labels = calculateForwardLabels(rowsFromPrices([100, 101, 102, 103, 104, 105]));
  assert.equal(labels[4].return1dPercent, 0.961538);
  assert.equal(labels[4].return3dPercent, null);
  assert.equal(labels[0].return5dPercent, 5);
  assert.equal(labels[0].return20dPercent, null);
  assert.equal(labels.at(-1).return1dPercent, null);
  assert.equal(labels.at(-1).maxDrawdown20dPercent, null);
});

test("a label only depends on prices inside its declared future horizon", function () {
  const base = Array.from({ length: 21 }, function (_, index) { return 100 + index; });
  const computedAt = "2026-02-01T00:00:00.000Z";
  const first = calculateForwardLabels(rowsFromPrices(base), computedAt)[0];
  const withLaterShock = calculateForwardLabels(rowsFromPrices(base.concat([1])), computedAt)[0];
  assert.deepEqual(withLaterShock, first);
});

test("price selection falls back to close but rejects missing prices", function () {
  assert.equal(priceOf({ adjusted_close: null, close: 123.45 }), 123.45);
  assert.throws(function () {
    calculateForwardLabels([{ market_date: "2026-01-01", adjusted_close: null, close: null }]);
  }, /valid adjusted close or close/);
});
