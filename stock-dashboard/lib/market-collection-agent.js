const { getDailyMarketEvents } = require("./daily-market-events");
const { NASDAQ_FOCUS_INSTRUMENTS, NASDAQ_UNIVERSE_AS_OF } = require("./nasdaq-universe");
const { requestSupabase } = require("./supabase-server");
const { persistUnifiedMarketEvents } = require("./unified-market-events");

const MARKET_COLLECTION_AGENT_VERSION = "market-collection-agent-v1";
const PUBLIC_HISTORY_TABLE = "nasdaq_market_event_history";
const INSTRUMENT_ROLES = new Map(NASDAQ_FOCUS_INSTRUMENTS.map(function (item) {
  return [item.symbol, item.role];
}));

function normalizePublicSymbols(values, universe) {
  const allowedSymbols = new Set((Array.isArray(universe?.instruments) ? universe.instruments : NASDAQ_FOCUS_INSTRUMENTS).map(function (item) {
    return String(item?.symbol || "").trim().toUpperCase();
  }));
  return Array.from(new Set((Array.isArray(values) ? values : []).map(function (symbol) {
    return String(symbol || "").trim().toUpperCase();
  }).filter(function (symbol) {
    return allowedSymbols.has(symbol);
  }))).sort();
}

function getUniverseSymbols(universe) {
  return (Array.isArray(universe?.instruments) ? universe.instruments : NASDAQ_FOCUS_INSTRUMENTS).map(function (item) {
    return String(item?.symbol || "").trim().toUpperCase();
  }).filter(Boolean);
}

function toPublicHistoryRow(event, now, universe) {
  const instruments = Array.isArray(universe?.instruments) ? universe.instruments : NASDAQ_FOCUS_INSTRUMENTS;
  const role = instruments.find(function (item) { return item.symbol === event.symbol; })?.role;
  return {
    market_date: event.date,
    symbol: event.symbol,
    display_name: event.name,
    instrument_role: role || INSTRUMENT_ROLES.get(event.symbol) || "component",
    universe_as_of: universe?.asOf || NASDAQ_UNIVERSE_AS_OF,
    change_percent: event.changePercent,
    benchmark_change_percent: event.benchmarkChangePercent,
    driver_type: event.driverType,
    confidence: event.confidence,
    summary: event.summary,
    reasons: Array.isArray(event.reasons) ? event.reasons : [],
    news: Array.isArray(event.news) ? event.news : [],
    event_time: event.eventTime || null,
    available_at: event.availableAt || event.capturedAt,
    captured_at: event.capturedAt,
    updated_at: now.toISOString()
  };
}

async function upsertPublicRows(config, rows, requestImpl = requestSupabase) {
  if (!rows.length) return;
  await requestImpl(config, "/rest/v1/" + PUBLIC_HISTORY_TABLE + "?on_conflict=market_date,symbol", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: rows
  });
}

// This agent owns only the public factual collection boundary. It never reads personal watchlists.
async function runMarketCollectionAgent(input = {}) {
  const now = input.now instanceof Date ? input.now : new Date();
  const expectedMarketDate = String(input.marketDate || "").trim();
  const config = input.config;
  const getEvents = input.getDailyMarketEvents || getDailyMarketEvents;
  const requestImpl = input.requestImpl || requestSupabase;
  const persistEvents = input.persistUnifiedMarketEvents || persistUnifiedMarketEvents;
  const snapshot = await getEvents([]);
  const failedPublicSymbols = normalizePublicSymbols(snapshot.failedSymbols, snapshot.universe);

  if (!snapshot.events.length && failedPublicSymbols.length) {
    throw new Error("Public Nasdaq collector returned no events");
  }

  if (snapshot.date !== expectedMarketDate || !snapshot.events.length) {
    return {
      status: "skipped",
      date: expectedMarketDate || null,
      publicFailedSymbols: failedPublicSymbols,
      publicRowsWritten: 0,
      unifiedEventsWritten: 0,
      unifiedSourcesWritten: 0,
      universeAsOf: snapshot.universe?.asOf || NASDAQ_UNIVERSE_AS_OF,
      universeSymbols: getUniverseSymbols(snapshot.universe)
    };
  }

  const publicRows = snapshot.events.map(function (event) {
    return toPublicHistoryRow(event, now, snapshot.universe);
  });
  await upsertPublicRows(config, publicRows, requestImpl);
  const unifiedResult = await persistEvents(config, snapshot.events, now);
  return {
    status: failedPublicSymbols.length ? "partial" : "succeeded",
    date: snapshot.date,
    publicFailedSymbols: failedPublicSymbols,
    publicRowsWritten: publicRows.length,
    unifiedEventsWritten: Number(unifiedResult.eventsWritten || 0),
    unifiedSourcesWritten: Number(unifiedResult.sourcesWritten || 0),
    universeAsOf: snapshot.universe?.asOf || NASDAQ_UNIVERSE_AS_OF,
    universeSymbols: getUniverseSymbols(snapshot.universe)
  };
}

module.exports = {
  MARKET_COLLECTION_AGENT_VERSION,
  getUniverseSymbols,
  normalizePublicSymbols,
  runMarketCollectionAgent,
  toPublicHistoryRow
};
