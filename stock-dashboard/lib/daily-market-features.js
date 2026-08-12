const FEATURE_VERSION = "qqq-daily-state-v1";

function round(value, digits = 6) {
  return Number(Number(value).toFixed(digits));
}

function validPrice(row) {
  const adjustedClose = Number(row?.adjusted_close ?? row?.adjustedClose ?? row?.close);
  const close = Number(row?.close ?? row?.adjusted_close ?? row?.adjustedClose);
  const open = Number(row?.open);
  const volume = Number(row?.volume);
  if (!Number.isFinite(adjustedClose) || adjustedClose <= 0 || !Number.isFinite(close) || close <= 0) return null;
  return {
    adjustedClose,
    close,
    open: Number.isFinite(open) && open > 0 ? open : null,
    volume: Number.isFinite(volume) && volume >= 0 ? volume : null
  };
}

function average(values) {
  if (!values.length) return null;
  return values.reduce(function (sum, value) { return sum + value; }, 0) / values.length;
}

function annualizedVolatility(prices) {
  if (prices.length < 21) return null;
  const returns = prices.slice(1).map(function (price, index) {
    return Math.log(price / prices[index]);
  });
  const mean = average(returns);
  const variance = average(returns.map(function (value) { return (value - mean) ** 2; }));
  return round(Math.sqrt(variance) * Math.sqrt(252) * 100);
}

function trailingDrawdown(prices) {
  if (prices.length < 2) return null;
  let peak = prices[0];
  let drawdown = 0;
  prices.slice(1).forEach(function (price) {
    peak = Math.max(peak, price);
    drawdown = Math.min(drawdown, ((price / peak) - 1) * 100);
  });
  return round(drawdown);
}

function newYorkOffsetMinutes(date) {
  const value = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "shortOffset"
  }).formatToParts(date).find(function (part) { return part.type === "timeZoneName"; })?.value || "GMT-5";
  const match = value.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
  if (!match) throw new Error("Could not determine America/New_York offset");
  const minutes = Number(match[2]) * 60 + Number(match[3] || 0);
  return match[1] === "+" ? minutes : -minutes;
}

function marketCloseAt(marketDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(marketDate || ""))) throw new Error("Invalid market date");
  const [year, month, day] = marketDate.split("-").map(Number);
  const noonUtc = new Date(Date.UTC(year, month - 1, day, 12));
  const offsetMinutes = newYorkOffsetMinutes(noonUtc);
  return new Date(Date.UTC(year, month - 1, day, 16) - offsetMinutes * 60 * 1000).toISOString();
}

function eventAvailableAt(event) {
  const value = event?.available_at || event?.availableAt || event?.event_time || event?.eventTime || null;
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function summarizeKnownEvents(events, featureAsOf) {
  const cutoff = new Date(featureAsOf);
  const known = events.filter(function (event) {
    const availableAt = eventAvailableAt(event);
    return availableAt && availableAt <= cutoff;
  });
  const impactCounts = { high: 0, medium: 0, low: 0 };
  const eventTypeCounts = {};
  const tickers = new Set();
  let latestAvailableAt = null;

  known.forEach(function (event) {
    const impact = String(event.impact_level || event.impactLevel || "").toLowerCase();
    if (impactCounts[impact] !== undefined) impactCounts[impact] += 1;
    const type = String(event.event_type || event.eventType || "unknown").trim() || "unknown";
    eventTypeCounts[type] = (eventTypeCounts[type] || 0) + 1;
    (Array.isArray(event.tickers) ? event.tickers : []).forEach(function (ticker) { tickers.add(ticker); });
    const availableAt = eventAvailableAt(event);
    if (!latestAvailableAt || availableAt > latestAvailableAt) latestAvailableAt = availableAt;
  });

  return {
    availableEventCount: known.length,
    highImpactEventCount: impactCounts.high,
    mediumImpactEventCount: impactCounts.medium,
    lowImpactEventCount: impactCounts.low,
    eventTickerCount: tickers.size,
    eventTypeCounts,
    inputEventMaxAvailableAt: latestAvailableAt ? latestAvailableAt.toISOString() : null
  };
}

function buildDailyMarketFeatures(options) {
  const prices = [...(options?.prices || [])].sort(function (left, right) {
    return String(left.market_date || left.marketDate).localeCompare(String(right.market_date || right.marketDate));
  });
  const eventsByDate = new Map();
  (options?.events || []).forEach(function (event) {
    const date = String(event.market_date || event.marketDate || "");
    if (!eventsByDate.has(date)) eventsByDate.set(date, []);
    eventsByDate.get(date).push(event);
  });
  const computedAt = options?.computedAt || new Date().toISOString();
  const result = [];

  prices.forEach(function (row, index) {
    const current = validPrice(row);
    if (!current) throw new Error("Daily features require a valid close for every market day");
    const date = String(row.market_date || row.marketDate);
    const previous = index > 0 ? validPrice(prices[index - 1]) : null;
    const trailing21 = prices.slice(Math.max(0, index - 20), index + 1).map(validPrice).map(function (item) { return item.adjustedClose; });
    const trailing20 = prices.slice(Math.max(0, index - 19), index + 1).map(validPrice).map(function (item) { return item.adjustedClose; });
    const priorVolumes = prices.slice(Math.max(0, index - 20), index).map(validPrice).map(function (item) { return item.volume; }).filter(function (value) { return value !== null; });
    const averagePriorVolume = average(priorVolumes);
    const featureAsOf = marketCloseAt(date);
    const events = summarizeKnownEvents(eventsByDate.get(date) || [], featureAsOf);

    result.push({
      marketDate: date,
      featureVersion: FEATURE_VERSION,
      featureAsOf,
      return1dPercent: previous ? round(((current.adjustedClose / previous.adjustedClose) - 1) * 100) : null,
      return5dPercent: index >= 5 ? round(((current.adjustedClose / validPrice(prices[index - 5]).adjustedClose) - 1) * 100) : null,
      return20dPercent: index >= 20 ? round(((current.adjustedClose / validPrice(prices[index - 20]).adjustedClose) - 1) * 100) : null,
      gapPercent: previous && current.open ? round(((current.open / previous.close) - 1) * 100) : null,
      trailingVolatility20dPercent: annualizedVolatility(trailing21),
      trailingDrawdown20dPercent: trailingDrawdown(trailing20),
      volumeRatio20dPercent: current.volume !== null && averagePriorVolume && priorVolumes.length >= 20
        ? round(((current.volume / averagePriorVolume) - 1) * 100)
        : null,
      ...events,
      inputPriceSource: String(row.source || options?.priceSource || "unknown"),
      inputPriceCapturedAt: row.captured_at || row.capturedAt || null,
      computedAt
    });
  });

  return result;
}

module.exports = {
  FEATURE_VERSION,
  annualizedVolatility,
  buildDailyMarketFeatures,
  eventAvailableAt,
  marketCloseAt,
  summarizeKnownEvents,
  trailingDrawdown
};
