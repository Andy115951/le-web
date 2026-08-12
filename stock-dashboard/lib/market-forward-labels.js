const HORIZONS = [1, 3, 5, 20];
const LABEL_VERSION = "adjusted-close-forward-v1";

function round(value, digits = 6) {
  return Number(Number(value).toFixed(digits));
}

function priceOf(row) {
  const adjusted = Number(row?.adjusted_close ?? row?.adjustedClose);
  if (Number.isFinite(adjusted) && adjusted > 0) return adjusted;
  const close = Number(row?.close);
  return Number.isFinite(close) && close > 0 ? close : null;
}

function futureReturn(prices, index, horizon) {
  if (index + horizon >= prices.length) return null;
  return round(((prices[index + horizon] / prices[index]) - 1) * 100);
}

function maxDrawdown(prices) {
  let peak = prices[0];
  let result = 0;
  prices.slice(1).forEach(function (price) {
    peak = Math.max(peak, price);
    result = Math.min(result, ((price / peak) - 1) * 100);
  });
  return round(result);
}

function annualizedVolatility(prices) {
  const returns = prices.slice(1).map(function (price, index) {
    return Math.log(price / prices[index]);
  });
  const mean = returns.reduce(function (sum, value) { return sum + value; }, 0) / returns.length;
  const variance = returns.reduce(function (sum, value) {
    return sum + ((value - mean) ** 2);
  }, 0) / returns.length;
  return round(Math.sqrt(variance) * Math.sqrt(252) * 100);
}

function calculateForwardLabels(rows, computedAt = new Date().toISOString()) {
  const ordered = [...rows].sort(function (left, right) {
    return String(left.market_date || left.marketDate).localeCompare(String(right.market_date || right.marketDate));
  });
  const prices = ordered.map(priceOf);
  if (prices.some(function (price) { return price === null; })) {
    throw new Error("Forward labels require a valid adjusted close or close for every market day");
  }

  return ordered.map(function (row, index) {
    const label = {
      marketDate: String(row.market_date || row.marketDate),
      return1dPercent: futureReturn(prices, index, HORIZONS[0]),
      return3dPercent: futureReturn(prices, index, HORIZONS[1]),
      return5dPercent: futureReturn(prices, index, HORIZONS[2]),
      return20dPercent: futureReturn(prices, index, HORIZONS[3]),
      maxDrawdown20dPercent: null,
      realizedVolatility20dPercent: null,
      priceBasis: "adjusted_close",
      horizonUnit: "trading_day",
      labelVersion: LABEL_VERSION,
      computedAt
    };

    if (index + 20 < prices.length) {
      const window = prices.slice(index, index + 21);
      label.maxDrawdown20dPercent = maxDrawdown(window);
      label.realizedVolatility20dPercent = annualizedVolatility(window);
    }
    return label;
  });
}

module.exports = {
  LABEL_VERSION,
  annualizedVolatility,
  calculateForwardLabels,
  maxDrawdown,
  priceOf
};
