const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";
const MAX_SYMBOLS = 16;
const FRESH_NEWS_WINDOW_MS = 36 * 60 * 60 * 1000;

function normalizeSymbol(value) {
  return String(value || "").trim().toUpperCase();
}

function isGlobalStockSymbol(symbol) {
  return /^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol);
}

function number(value) {
  if (value === null || value === undefined || value === "") return null;
  if (value && typeof value === "object" && "raw" in value) value = value.raw;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function fetchJson(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": UA },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(response.status + " " + response.statusText);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function buildChartUrl(symbol) {
  return "https://query1.finance.yahoo.com/v8/finance/chart/"
    + encodeURIComponent(symbol)
    + "?range=1d&interval=1d";
}

function buildSearchUrl(symbol) {
  return "https://query1.finance.yahoo.com/v1/finance/search?q="
    + encodeURIComponent(symbol)
    + "&quotesCount=1&newsCount=8";
}

function marketDate(now) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map(function (part) { return [part.type, part.value]; }));
  return value.year + "-" + value.month + "-" + value.day;
}

function getNewYorkClock(now) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23"
  }).formatToParts(now);
  return Object.fromEntries(parts.map(function (part) { return [part.type, part.value]; }));
}

function isAfterUsMarketClose(now) {
  const clock = getNewYorkClock(now);
  return ["Mon", "Tue", "Wed", "Thu", "Fri"].includes(clock.weekday) && Number(clock.hour) >= 17;
}

function parseNews(payload) {
  const items = Array.isArray(payload?.news) ? payload.news : [];
  return items.map(function (item) {
    const timestamp = Number(item?.providerPublishTime);
    return {
      title: String(item?.title || "未命名资讯").trim(),
      publisher: String(item?.publisher || item?.provider || "Yahoo Finance").trim(),
      publishedAt: Number.isFinite(timestamp) ? new Date(timestamp * 1000).toISOString() : "",
      url: String(item?.link || item?.clickThroughUrl?.url || "").trim()
    };
  }).filter(function (item) {
    return item.title && item.url;
  });
}

async function fetchTickerContext(symbol) {
  const [chartPayload, searchPayload] = await Promise.all([
    fetchJson(buildChartUrl(symbol)),
    fetchJson(buildSearchUrl(symbol)).catch(function () { return {}; })
  ]);
  const meta = chartPayload?.chart?.result?.[0]?.meta || {};
  const currentPrice = number(meta.regularMarketPrice);
  const previousClose = number(meta.chartPreviousClose);
  const changePercent = Number.isFinite(currentPrice) && Number.isFinite(previousClose) && previousClose > 0
    ? Number((((currentPrice - previousClose) / previousClose) * 100).toFixed(2))
    : null;
  if (changePercent === null) throw new Error("未获取到当日涨跌幅");
  return {
    symbol,
    name: String(meta.longName || meta.shortName || symbol).trim() || symbol,
    changePercent,
    marketTimestamp: Number.isFinite(Number(meta.regularMarketTime))
      ? Number(meta.regularMarketTime) * 1000
      : null,
    news: parseNews(searchPayload)
  };
}

function sameDirection(left, right) {
  return (left > 0 && right > 0) || (left < 0 && right < 0);
}

function buildEvent(context, benchmark, now) {
  const marketAt = Number.isFinite(context.marketTimestamp)
    ? new Date(context.marketTimestamp)
    : Number.isFinite(benchmark?.marketTimestamp)
      ? new Date(benchmark.marketTimestamp)
      : now;
  const benchmarkChange = benchmark?.changePercent ?? null;
  const freshNews = context.news.filter(function (item) {
    const publishedAt = new Date(item.publishedAt).getTime();
    return Number.isFinite(publishedAt) && now.getTime() - publishedAt <= FRESH_NEWS_WINDOW_MS;
  }).slice(0, 2);
  const hasMarketMove = Number.isFinite(benchmarkChange) && Math.abs(benchmarkChange) >= 0.5;
  const isSameDirection = hasMarketMove && sameDirection(context.changePercent, benchmarkChange);
  const relativeMove = Number.isFinite(benchmarkChange)
    ? Number((context.changePercent - benchmarkChange).toFixed(2))
    : null;
  const hasCompanyMove = freshNews.length > 0 && (relativeMove === null || Math.abs(relativeMove) >= 1);

  let driverType = "unclear";
  let confidence = "low";
  let summary = "暂无足够的公开证据将当日波动归因到单一事件。";
  const reasons = [];

  if (isSameDirection && hasCompanyMove) {
    driverType = "mixed";
    confidence = "medium";
    summary = "当日走势既与纳指方向一致，也有近期公司相关资讯可供复核，属于市场与个股因素共同观察。";
  } else if (isSameDirection) {
    driverType = "market";
    confidence = "medium";
    summary = "走势与 QQQ 同向，纳指整体风险偏好或板块行情可能是主要背景。";
  } else if (hasCompanyMove) {
    driverType = "company";
    confidence = "medium";
    summary = "走势相对 QQQ 出现偏离，近期公司相关资讯值得优先核对。";
  }

  if (Number.isFinite(benchmarkChange)) {
    reasons.push("QQQ 当日 " + (benchmarkChange > 0 ? "+" : "") + benchmarkChange.toFixed(2) + "%；该股 " + (context.changePercent > 0 ? "+" : "") + context.changePercent.toFixed(2) + "%。");
  } else {
    reasons.push("该股当日 " + (context.changePercent > 0 ? "+" : "") + context.changePercent.toFixed(2) + "%；QQQ 基准数据暂不可用。");
  }

  if (freshNews.length) {
    reasons.push("关联资讯：" + freshNews[0].title);
  } else {
    reasons.push("最近 36 小时未抓到可直接复核的公司新闻，请结合财报、行业消息与宏观数据判断。");
  }

  return {
    id: marketDate(marketAt) + ":" + context.symbol,
    symbol: context.symbol,
    name: context.name,
    date: marketDate(marketAt),
    capturedAt: now.toISOString(),
    changePercent: context.changePercent,
    benchmarkChangePercent: benchmarkChange,
    driverType,
    confidence,
    summary,
    reasons,
    news: freshNews
  };
}

async function getDailyMarketEvents(symbols, options) {
  const normalized = Array.from(new Set((symbols || []).map(normalizeSymbol).filter(isGlobalStockSymbol))).slice(0, MAX_SYMBOLS);
  if (!normalized.length) return { date: marketDate(new Date()), events: [], failedSymbols: [] };

  const querySymbols = normalized.includes("QQQ") ? normalized : ["QQQ"].concat(normalized);
  const settled = await mapWithConcurrency(querySymbols, 3, fetchTickerContext);
  const contexts = new Map();
  const failedSymbols = [];
  settled.forEach(function (result, index) {
    const symbol = querySymbols[index];
    if (result.status === "fulfilled") contexts.set(symbol, result.value);
    else failedSymbols.push(symbol);
  });

  const now = new Date();
  const fallbackBenchmarkChange = number(options?.benchmarkChange);
  const benchmark = contexts.get("QQQ") || (fallbackBenchmarkChange === null ? null : {
    symbol: "QQQ",
    name: "Invesco QQQ Trust",
    changePercent: Number(fallbackBenchmarkChange.toFixed(2)),
    marketTimestamp: null,
    news: []
  });
  const events = normalized.map(function (symbol) {
    const context = contexts.get(symbol);
    return context ? buildEvent(context, benchmark, now) : null;
  }).filter(Boolean);

  const sourceDate = benchmark?.marketTimestamp ? marketDate(new Date(benchmark.marketTimestamp)) : marketDate(now);
  return { date: sourceDate, events, failedSymbols };
}

async function mapWithConcurrency(items, limit, task) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async function () {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      try {
        results[index] = { status: "fulfilled", value: await task(items[index]) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  });
  await Promise.all(workers);
  return results;
}

module.exports = { getDailyMarketEvents, isAfterUsMarketClose, marketDate };
