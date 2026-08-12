const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";
const ALLOWED_RANGES = new Set(["1y", "2y", "5y", "10y"]);

function normalizeSymbol(value) {
  const symbol = String(value || "").trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol)) throw new Error("Unsupported market symbol");
  return symbol;
}

function normalizeRange(value) {
  const range = String(value || "5y").trim().toLowerCase();
  return ALLOWED_RANGES.has(range) ? range : "5y";
}

function marketDate(timestampMs) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(timestampMs));
  const value = Object.fromEntries(parts.map(function (part) { return [part.type, part.value]; }));
  return value.year + "-" + value.month + "-" + value.day;
}

function finiteNumber(value) {
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function round(value, digits = 6) {
  return Number(Number(value).toFixed(digits));
}

function parseYahooDailyBars(payload, symbol) {
  const result = payload?.chart?.result?.[0];
  if (!result) throw new Error(payload?.chart?.error?.description || "Yahoo chart returned no data");
  const timestamps = Array.isArray(result.timestamp) ? result.timestamp : [];
  const quote = result.indicators?.quote?.[0] || {};
  const adjusted = result.indicators?.adjclose?.[0]?.adjclose || [];
  const bars = [];
  let previousClose = null;

  timestamps.forEach(function (timestamp, index) {
    const open = finiteNumber(quote.open?.[index]);
    const high = finiteNumber(quote.high?.[index]);
    const low = finiteNumber(quote.low?.[index]);
    const close = finiteNumber(quote.close?.[index]);
    const adjustedClose = finiteNumber(adjusted[index]);
    const volume = finiteNumber(quote.volume?.[index]);
    if (![open, high, low, close].every(function (value) { return value !== null && value > 0; })) return;
    if (high < Math.max(open, close, low) || low > Math.min(open, close, high)) return;

    bars.push({
      marketDate: marketDate(Number(timestamp) * 1000),
      open: round(open),
      high: round(high),
      low: round(low),
      close: round(close),
      adjustedClose: adjustedClose !== null && adjustedClose > 0 ? round(adjustedClose) : null,
      volume: volume !== null && volume >= 0 ? Math.round(volume) : null,
      changePercent: previousClose && previousClose > 0
        ? round(((close - previousClose) / previousClose) * 100)
        : null
    });
    previousClose = close;
  });

  if (!bars.length) throw new Error("Yahoo chart contained no valid daily bars");
  return {
    symbol: normalizeSymbol(symbol),
    name: String(result.meta?.longName || result.meta?.shortName || symbol).trim(),
    exchange: String(result.meta?.exchangeName || "NASDAQ").trim(),
    currency: String(result.meta?.currency || "USD").trim(),
    bars
  };
}

async function fetchYahooDailyBars(symbol, range) {
  const normalizedSymbol = normalizeSymbol(symbol);
  const normalizedRange = normalizeRange(range);
  const url = "https://query1.finance.yahoo.com/v8/finance/chart/"
    + encodeURIComponent(normalizedSymbol)
    + "?range=" + encodeURIComponent(normalizedRange)
    + "&interval=1d&events=div%2Csplits";
  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, 30000);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": UA },
      signal: controller.signal
    });
    if (!response.ok) throw new Error("Yahoo chart " + response.status + " " + response.statusText);
    return parseYahooDailyBars(await response.json(), normalizedSymbol);
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  fetchYahooDailyBars,
  marketDate,
  normalizeRange,
  normalizeSymbol,
  parseYahooDailyBars
};
