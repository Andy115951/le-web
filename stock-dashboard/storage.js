const STORAGE_KEY = "stock-dashboard-state-v2";

const CORE_US_TECH_ITEMS = [
  { symbol: "QQQ", displayName: "Invesco QQQ Trust", group: "纳指核心", note: "纳指 100 ETF 基准", createdAt: "2026-04-22T00:00:00.000Z" },
  { symbol: "AAPL", displayName: "Apple", group: "美股巨头", note: "iPhone 与服务业务", createdAt: "2026-04-22T00:00:00.000Z" },
  { symbol: "MSFT", displayName: "Microsoft", group: "美股巨头", note: "Azure + Copilot", createdAt: "2026-04-22T00:01:00.000Z" },
  { symbol: "NVDA", displayName: "NVIDIA", group: "美股巨头", note: "AI 算力龙头", createdAt: "2026-04-22T00:02:00.000Z" },
  { symbol: "AMZN", displayName: "Amazon", group: "美股巨头", note: "电商 + AWS", createdAt: "2026-04-22T00:03:00.000Z" },
  { symbol: "GOOGL", displayName: "Alphabet", group: "美股巨头", note: "搜索 + 云", createdAt: "2026-04-22T00:04:00.000Z" },
  { symbol: "META", displayName: "Meta", group: "美股巨头", note: "广告 + AI", createdAt: "2026-04-22T00:05:00.000Z" },
  { symbol: "TSLA", displayName: "Tesla", group: "美股巨头", note: "电动车 + AI", createdAt: "2026-04-22T00:06:00.000Z" },
  { symbol: "MAGS", displayName: "Roundhill Mags ETF", group: "美股巨头", note: "七巨头篮子 ETF", createdAt: "2026-04-22T00:07:00.000Z" }
];

const DEFAULT_ITEMS = CORE_US_TECH_ITEMS;

const DEFAULT_PREFERENCES = {
  selectedGroup: "all",
  performanceFilter: "all",
  searchKeyword: "",
  sortKey: "changePercent",
  sortDirection: "desc",
  autoRefreshSec: 0,
  pageSize: 10,
  currentPage: 1,
  strategyRulesText: "8:20,12:30,18:50",
  notifyOnTarget: false,
  dropAlertEnabled: false,
  dropAlertThreshold: 3,
  dropAlertVoice: true,
  dropAlertSound: true,
  dropAlertNotify: false
};

const ALLOWED_SORT_KEYS = new Set(["symbol", "displayName", "price", "changePercent", "drawdownPercent", "targetDistance", "relativeQqq"]);
const ALLOWED_PERFORMANCE_FILTERS = new Set(["all", "up", "down", "flat"]);
const ALLOWED_PAGE_SIZES = new Set([10, 20, 50]);
const ALLOWED_AUTO_REFRESH = new Set([0, 30, 60, 300]);
const ALLOWED_HOLDING_TYPES = new Set(["watchlist", "core", "trading"]);
const MARKET_EVENT_RETENTION_DAYS = 14;

function normalizeMarketEvents(events) {
  if (!Array.isArray(events)) return [];

  const cutoff = Date.now() - MARKET_EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const latestByDayAndSymbol = new Map();

  for (const entry of events) {
    const symbol = String(entry?.symbol || "").trim().toUpperCase();
    const capturedAt = new Date(entry?.capturedAt || entry?.updatedAt || 0).getTime();
    const date = typeof entry?.date === "string" ? entry.date.slice(0, 10) : "";
    if (!symbol || !date || !Number.isFinite(capturedAt) || capturedAt < cutoff) continue;

    const key = date + ":" + symbol;
    const current = latestByDayAndSymbol.get(key);
    if (current && new Date(current.capturedAt).getTime() >= capturedAt) continue;

    latestByDayAndSymbol.set(key, {
      id: String(entry?.id || key),
      symbol,
      name: String(entry?.name || symbol).trim() || symbol,
      date,
      capturedAt: new Date(capturedAt).toISOString(),
      changePercent: typeof entry?.changePercent === "number" && Number.isFinite(entry.changePercent)
        ? Number(entry.changePercent.toFixed(2))
        : null,
      benchmarkChangePercent: typeof entry?.benchmarkChangePercent === "number" && Number.isFinite(entry.benchmarkChangePercent)
        ? Number(entry.benchmarkChangePercent.toFixed(2))
        : null,
      driverType: ["market", "company", "mixed", "unclear"].includes(entry?.driverType) ? entry.driverType : "unclear",
      confidence: ["high", "medium", "low"].includes(entry?.confidence) ? entry.confidence : "low",
      summary: String(entry?.summary || "暂无明确的当日驱动证据。").trim().slice(0, 360),
      reasons: Array.isArray(entry?.reasons)
        ? entry.reasons.slice(0, 3).map(function (reason) { return String(reason || "").trim().slice(0, 240); }).filter(Boolean)
        : [],
      news: Array.isArray(entry?.news)
        ? entry.news.slice(0, 2).map(function (news) {
          return {
            title: String(news?.title || "未命名资讯").trim().slice(0, 240),
            publisher: String(news?.publisher || "资讯来源").trim().slice(0, 80),
            publishedAt: typeof news?.publishedAt === "string" ? news.publishedAt : "",
            url: typeof news?.url === "string" ? news.url.slice(0, 1000) : ""
          };
        })
        : []
    });
  }

  return Array.from(latestByDayAndSymbol.values()).sort(function (left, right) {
    return new Date(right.capturedAt).getTime() - new Date(left.capturedAt).getTime();
  });
}

function normalizeUsPeaks(usPeaks) {
  const normalized = {};
  if (!usPeaks || typeof usPeaks !== "object") return normalized;

  for (const [key, value] of Object.entries(usPeaks)) {
    const symbol = String(key || "").trim().toUpperCase();
    const peakPrice = Number(value?.peakPrice);
    if (!symbol || !Number.isFinite(peakPrice) || peakPrice <= 0) continue;

    normalized[symbol] = {
      peakPrice: Number(peakPrice.toFixed(3)),
      peakAt: typeof value?.peakAt === "string" ? value.peakAt : new Date().toISOString()
    };
  }
  return normalized;
}

function normalizeItem(item) {
  const symbol = String(item.symbol || "").trim().toUpperCase();
  const targetPrice = Number(item.targetPrice);
  const costBasis = Number(item.costBasis);
  const shares = Number(item.shares);
  const holdingType = typeof item.holdingType === "string" && ALLOWED_HOLDING_TYPES.has(item.holdingType)
    ? item.holdingType
    : "watchlist";
  return {
    symbol,
    displayName: String(item.displayName || symbol).trim() || symbol,
    group: String(item.group || "未分组").trim() || "未分组",
    note: String(item.note || "").trim(),
    targetPrice: Number.isFinite(targetPrice) && targetPrice > 0 ? Number(targetPrice.toFixed(3)) : null,
    costBasis: Number.isFinite(costBasis) && costBasis > 0 ? Number(costBasis.toFixed(3)) : null,
    shares: Number.isFinite(shares) && shares > 0 ? Number(shares.toFixed(4)) : null,
    holdingType,
    createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString()
  };
}

function normalizePreferences(preferences) {
  const sortKey = typeof preferences?.sortKey === "string" && ALLOWED_SORT_KEYS.has(preferences.sortKey)
    ? preferences.sortKey
    : DEFAULT_PREFERENCES.sortKey;
  const performanceFilter = typeof preferences?.performanceFilter === "string" && ALLOWED_PERFORMANCE_FILTERS.has(preferences.performanceFilter)
    ? preferences.performanceFilter
    : DEFAULT_PREFERENCES.performanceFilter;
  const autoRefreshSec = Number(preferences?.autoRefreshSec);
  const pageSize = Number(preferences?.pageSize);
  const currentPage = Number(preferences?.currentPage);
  const dropAlertThreshold = Number(preferences?.dropAlertThreshold);

  return {
    selectedGroup: typeof preferences?.selectedGroup === "string" ? preferences.selectedGroup : DEFAULT_PREFERENCES.selectedGroup,
    performanceFilter,
    searchKeyword: typeof preferences?.searchKeyword === "string" ? preferences.searchKeyword.trim().slice(0, 40) : DEFAULT_PREFERENCES.searchKeyword,
    sortKey,
    sortDirection: preferences?.sortDirection === "asc" ? "asc" : DEFAULT_PREFERENCES.sortDirection,
    autoRefreshSec: ALLOWED_AUTO_REFRESH.has(autoRefreshSec) ? autoRefreshSec : DEFAULT_PREFERENCES.autoRefreshSec,
    pageSize: ALLOWED_PAGE_SIZES.has(pageSize) ? pageSize : DEFAULT_PREFERENCES.pageSize,
    currentPage: Number.isInteger(currentPage) && currentPage > 0 ? currentPage : DEFAULT_PREFERENCES.currentPage,
    strategyRulesText: typeof preferences?.strategyRulesText === "string"
      ? preferences.strategyRulesText.trim().slice(0, 120)
      : DEFAULT_PREFERENCES.strategyRulesText,
    notifyOnTarget: preferences?.notifyOnTarget === true,
    dropAlertEnabled: preferences?.dropAlertEnabled === true,
    dropAlertThreshold: Number.isFinite(dropAlertThreshold) && dropAlertThreshold > 0
      ? Math.min(50, Math.max(0.1, Number(dropAlertThreshold.toFixed(2))))
      : DEFAULT_PREFERENCES.dropAlertThreshold,
    dropAlertVoice: preferences?.dropAlertVoice !== false,
    dropAlertSound: preferences?.dropAlertSound !== false,
    dropAlertNotify: preferences?.dropAlertNotify === true
  };
}

export function loadState() {
  let raw = null;
  try {
    raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch (_) {
    raw = null;
  }

  if (!raw || typeof raw !== "object") {
    return {
      items: dedupeItems(DEFAULT_ITEMS.map(normalizeItem)),
      preferences: { ...DEFAULT_PREFERENCES },
      usPeaks: {},
      marketEvents: []
    };
  }

  const hasItems = Array.isArray(raw.items);
  const items = hasItems ? raw.items.map(normalizeItem).filter(function (item) {
    return item.symbol;
  }) : DEFAULT_ITEMS.map(normalizeItem);

  const mergedItems = hasItems
    ? mergeWithCoreUsTech(items)
    : dedupeItems(DEFAULT_ITEMS.map(normalizeItem));

  return {
    items: mergedItems,
    preferences: normalizePreferences(raw.preferences),
    usPeaks: normalizeUsPeaks(raw.usPeaks),
    marketEvents: normalizeMarketEvents(raw.marketEvents)
  };
}

export function saveState(state) {
  const payload = {
    items: dedupeItems((state.items || []).map(normalizeItem)),
    preferences: normalizePreferences(state.preferences || {}),
    usPeaks: normalizeUsPeaks(state.usPeaks),
    marketEvents: normalizeMarketEvents(state.marketEvents)
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function upsertItem(items, item) {
  const normalized = normalizeItem(item);
  const nextItems = dedupeItems(items || []);
  const index = nextItems.findIndex(function (entry) {
    return entry.symbol === normalized.symbol;
  });

  if (index >= 0) {
    nextItems[index] = {
      ...nextItems[index],
      ...normalized
    };
    return nextItems;
  }

  return [normalized].concat(nextItems);
}

export function removeItem(items, symbol) {
  const key = String(symbol || "").trim().toUpperCase();
  return (items || []).filter(function (item) {
    return item.symbol !== key;
  });
}

export function collectGroups(items) {
  const seen = new Set();
  for (const item of items || []) {
    seen.add(item.group || "未分组");
  }
  return Array.from(seen).sort();
}

function dedupeItems(items) {
  const map = new Map();
  for (const item of items || []) {
    const normalized = normalizeItem(item);
    if (!normalized.symbol) continue;
    map.set(normalized.symbol, normalized);
  }
  return Array.from(map.values()).sort(function (a, b) {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

function mergeWithCoreUsTech(items) {
  return dedupeItems([]
    .concat(items || [])
    .concat(CORE_US_TECH_ITEMS));
}
