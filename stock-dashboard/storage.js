const STORAGE_KEY = "stock-dashboard-state-v1";

const DEFAULT_ITEMS = [
  { symbol: "AAPL", displayName: "Apple", group: "科技", note: "iPhone 与服务业务", createdAt: "2026-04-22T00:00:00.000Z" },
  { symbol: "MSFT", displayName: "Microsoft", group: "云计算", note: "Azure + Copilot", createdAt: "2026-04-22T00:01:00.000Z" },
  { symbol: "NVDA", displayName: "NVIDIA", group: "AI", note: "关注算力周期", createdAt: "2026-04-22T00:02:00.000Z" },
  { symbol: "AMZN", displayName: "Amazon", group: "消费", note: "电商 + AWS", createdAt: "2026-04-22T00:03:00.000Z" }
];

const DEFAULT_PREFERENCES = {
  selectedGroup: "all",
  sortKey: "changePercent",
  sortDirection: "desc"
};

function normalizeItem(item) {
  const symbol = String(item.symbol || "").trim().toUpperCase();
  return {
    symbol,
    displayName: String(item.displayName || symbol).trim() || symbol,
    group: String(item.group || "未分组").trim() || "未分组",
    note: String(item.note || "").trim(),
    createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString()
  };
}

function normalizePreferences(preferences) {
  return {
    selectedGroup: typeof preferences?.selectedGroup === "string" ? preferences.selectedGroup : DEFAULT_PREFERENCES.selectedGroup,
    sortKey: typeof preferences?.sortKey === "string" ? preferences.sortKey : DEFAULT_PREFERENCES.sortKey,
    sortDirection: preferences?.sortDirection === "asc" ? "asc" : DEFAULT_PREFERENCES.sortDirection
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
      items: DEFAULT_ITEMS.map(normalizeItem),
      preferences: { ...DEFAULT_PREFERENCES }
    };
  }

  const hasItems = Array.isArray(raw.items);
  const items = hasItems ? raw.items.map(normalizeItem).filter(function (item) {
    return item.symbol;
  }) : DEFAULT_ITEMS.map(normalizeItem);

  return {
    items: hasItems ? dedupeItems(items) : DEFAULT_ITEMS.map(normalizeItem),
    preferences: normalizePreferences(raw.preferences)
  };
}

export function saveState(state) {
  const payload = {
    items: dedupeItems((state.items || []).map(normalizeItem)),
    preferences: normalizePreferences(state.preferences || {})
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
