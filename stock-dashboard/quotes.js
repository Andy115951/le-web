const QUOTE_FIELDS = "f2,f3,f4,f12,f13,f14";
const TREND_TOKEN = "fa5fd1943c7b386f172d6893dbfba10b";

function normalizeSymbol(symbol) {
  return String(symbol || "").trim().toUpperCase();
}

function inferSecid(symbol) {
  const normalized = normalizeSymbol(symbol);

  if (/^(0|1|105)\./.test(normalized)) {
    return normalized;
  }

  if (/^6\d{5}$/.test(normalized)) {
    return "1." + normalized;
  }

  if (/^(0|3)\d{5}$/.test(normalized)) {
    return "0." + normalized;
  }

  if (/^[A-Z][A-Z0-9.-]{0,9}$/.test(normalized)) {
    return "105." + normalized;
  }

  throw new Error("暂不支持该代码格式：" + symbol);
}

function getPriceScale(secid, market) {
  const prefix = String(secid || "").split(".")[0];
  if (Number(market) === 105 || prefix === "105") {
    return 1000;
  }
  return 100;
}

function parseScaledNumber(value, scale) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Number((num / scale).toFixed(3));
}

function buildQuoteUrl(secids) {
  return "https://push2.eastmoney.com/api/qt/ulist.np/get?secids="
    + encodeURIComponent(secids.join(","))
    + "&fields="
    + QUOTE_FIELDS;
}

function buildTrendUrl(secid) {
  return "https://push2his.eastmoney.com/api/qt/stock/trends2/get?secid="
    + encodeURIComponent(secid)
    + "&fields1=f1,f2&fields2=f51,f53&ut="
    + TREND_TOKEN
    + "&ndays=1&iscr=0&iscca=0";
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error("行情接口返回异常：" + response.status);
  }

  const data = await response.json();
  if (data && typeof data.rc === "number" && data.rc !== 0) {
    throw new Error("行情接口暂时不可用");
  }

  return data;
}

async function fetchTrendPayload(secid) {
  try {
    return await fetchJson(buildTrendUrl(secid));
  } catch (_) {
    return null;
  }
}

function fallbackSparkline(price, change) {
  if (!Number.isFinite(price)) return [];
  const previous = Number.isFinite(change) ? price - change : price;
  const points = [];

  for (let i = 0; i < 16; i += 1) {
    const ratio = i / 15;
    const value = previous + (price - previous) * ratio;
    points.push(Number(value.toFixed(3)));
  }

  return points;
}

function parseTrendPayload(payload) {
  const trends = Array.isArray(payload?.data?.trends) ? payload.data.trends : [];
  return trends.map(function (row) {
    const parts = String(row || "").split(",");
    const price = Number(parts[1]);
    return Number.isFinite(price) ? Number(price.toFixed(3)) : null;
  }).filter(function (price) {
    return Number.isFinite(price);
  });
}

function createEmptyQuote(symbol) {
  return {
    symbol,
    name: symbol,
    price: null,
    change: null,
    changePercent: null,
    updatedAt: new Date().toISOString(),
    sparkline: []
  };
}

export async function fetchQuotes(symbols) {
  const entries = Array.from(new Set((symbols || []).map(normalizeSymbol).filter(Boolean))).map(function (symbol) {
    return {
      symbol,
      secid: inferSecid(symbol)
    };
  });

  if (!entries.length) {
    return {};
  }

  const quotePayload = await fetchJson(buildQuoteUrl(entries.map(function (entry) {
    return entry.secid;
  })));

  const quotes = {};
  for (const entry of entries) {
    quotes[entry.symbol] = createEmptyQuote(entry.symbol);
  }

  const diff = Array.isArray(quotePayload?.data?.diff) ? quotePayload.data.diff : [];
  for (const item of diff) {
    const symbol = normalizeSymbol(item.f12);
    const entry = entries.find(function (candidate) {
      return candidate.symbol === symbol;
    });
    if (!entry) continue;

    const scale = getPriceScale(entry.secid, item.f13);
    quotes[symbol] = {
      symbol,
      name: String(item.f14 || symbol).trim() || symbol,
      price: parseScaledNumber(item.f2, scale),
      change: parseScaledNumber(item.f4, scale),
      changePercent: parseScaledNumber(item.f3, 100),
      updatedAt: new Date().toISOString(),
      sparkline: []
    };
  }

  const trendResults = await Promise.all(entries.map(function (entry) {
    return fetchTrendPayload(entry.secid);
  }));

  trendResults.forEach(function (payload, index) {
    const entry = entries[index];
    const current = quotes[entry.symbol] || createEmptyQuote(entry.symbol);

    if (payload) {
      current.sparkline = parseTrendPayload(payload);
    }

    if (!current.sparkline.length) {
      current.sparkline = fallbackSparkline(current.price, current.change);
    }

    quotes[entry.symbol] = current;
  });

  return quotes;
}
