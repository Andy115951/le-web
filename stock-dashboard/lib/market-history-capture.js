const { getDailyMarketEvents, isAfterUsMarketClose, marketDate } = require("./daily-market-events");

function getConfig() {
  const url = String(process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return { url, serviceRoleKey };
}

async function requestSupabase(config, path, options) {
  const response = await fetch(config.url + path, {
    method: options?.method || "GET",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: "Bearer " + config.serviceRoleKey,
      "Content-Type": "application/json",
      ...(options?.headers || {})
    },
    body: options?.body ? JSON.stringify(options.body) : undefined
  });
  const text = await response.text();
  if (!response.ok) throw new Error("Supabase " + response.status + ": " + text.slice(0, 300));
  return text ? JSON.parse(text) : null;
}

function isGlobalStockSymbol(symbol) {
  return /^[A-Z][A-Z0-9.-]{0,9}$/.test(String(symbol || "").trim().toUpperCase());
}

function collectSymbols(items) {
  return Array.from(new Set((Array.isArray(items) ? items : []).map(function (item) {
    return String(item?.symbol || "").trim().toUpperCase();
  }).filter(isGlobalStockSymbol))).sort();
}

function toHistoryRow(userId, event, now) {
  return {
    user_id: userId,
    market_date: event.date,
    symbol: event.symbol,
    display_name: event.name,
    change_percent: event.changePercent,
    benchmark_change_percent: event.benchmarkChangePercent,
    driver_type: event.driverType,
    confidence: event.confidence,
    summary: event.summary,
    reasons: Array.isArray(event.reasons) ? event.reasons : [],
    news: Array.isArray(event.news) ? event.news : [],
    captured_at: event.capturedAt,
    updated_at: now.toISOString()
  };
}

async function captureMarketHistory(now = new Date()) {
  if (!isAfterUsMarketClose(now)) {
    return { skipped: true, reason: "US market has not reached the post-close capture window" };
  }

  const config = getConfig();
  const states = await requestSupabase(config, "/rest/v1/watchlist_states?select=user_id,items", {
    headers: { Range: "0-999" }
  });
  const today = marketDate(now);
  const resultCache = new Map();
  let savedEvents = 0;
  let processedUsers = 0;
  const skippedUsers = [];

  for (const state of Array.isArray(states) ? states : []) {
    const symbols = collectSymbols(state?.items);
    if (!state?.user_id || !symbols.length) continue;
    const key = symbols.join(",");
    if (!resultCache.has(key)) resultCache.set(key, getDailyMarketEvents(symbols));
    const snapshot = await resultCache.get(key);

    // A market holiday or stale upstream quote must never be stamped as today.
    if (snapshot.date !== today || !snapshot.events.length) {
      skippedUsers.push(state.user_id);
      continue;
    }

    const rows = snapshot.events.map(function (event) {
      return toHistoryRow(state.user_id, event, now);
    });
    await requestSupabase(config, "/rest/v1/market_event_history?on_conflict=user_id,market_date,symbol", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: rows
    });
    processedUsers += 1;
    savedEvents += rows.length;
  }

  return { skipped: false, date: today, processedUsers, savedEvents, skippedUsers: skippedUsers.length };
}

module.exports = { captureMarketHistory };
