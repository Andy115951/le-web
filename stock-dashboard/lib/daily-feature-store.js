const { normalizeSymbol } = require("./historical-market-data");
const { buildDailyMarketFeatures } = require("./daily-market-features");
const { getStoredDailyPrices, normalizeHistoryLimit } = require("./price-history-store");
const { getUnifiedMarketEventsRange } = require("./unified-market-events");
const { getReportedEarningsFeatureEvents } = require("./earnings-calendar");
const { getSupabaseConfig, requestSupabase } = require("./supabase-server");

function normalizeFeatureDate(value) {
  const date = String(value || "").trim();
  if (!date) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(date + "T12:00:00.000Z").toISOString().slice(0, 10) !== date) {
    throw new Error("Invalid feature date");
  }
  return date;
}

async function upsertFeatures(config, rows, client = requestSupabase) {
  for (let index = 0; index < rows.length; index += 250) {
    await client(config, "/rest/v1/daily_market_features?on_conflict=instrument_id,market_date,feature_version", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: rows.slice(index, index + 250)
    });
  }
}

async function rebuildDailyFeatures(symbol, dependencies = {}) {
  const normalizedSymbol = normalizeSymbol(symbol || "QQQ");
  const config = (dependencies.getSupabaseConfig || getSupabaseConfig)();
  const loadPrices = dependencies.getStoredDailyPrices || getStoredDailyPrices;
  const loadUnifiedEvents = dependencies.getUnifiedMarketEventsRange || getUnifiedMarketEventsRange;
  const loadReportedEarnings = dependencies.getReportedEarningsFeatureEvents || getReportedEarningsFeatureEvents;
  const persistFeatures = dependencies.upsertFeatures || upsertFeatures;
  const now = dependencies.now || new Date();
  const history = await loadPrices(normalizedSymbol, 2600);
  if (!history.prices.length) throw new Error("No stored daily prices for " + normalizedSymbol);
  const firstDate = history.prices[0].market_date;
  const lastDate = history.prices.at(-1).market_date;
  const [events, reportedEarnings, computedAt] = await Promise.all([
    loadUnifiedEvents(firstDate, lastDate, { includeRelations: false }),
    loadReportedEarnings({ startDate: firstDate, endDate: lastDate }),
    Promise.resolve(now.toISOString())
  ]);
  const features = buildDailyMarketFeatures({ prices: history.prices, events: events.concat(reportedEarnings), computedAt });

  await persistFeatures(config, features.map(function (feature) {
    return {
      instrument_id: history.instrument.id,
      market_date: feature.marketDate,
      feature_version: feature.featureVersion,
      feature_as_of: feature.featureAsOf,
      return_1d_percent: feature.return1dPercent,
      return_5d_percent: feature.return5dPercent,
      return_20d_percent: feature.return20dPercent,
      gap_percent: feature.gapPercent,
      trailing_volatility_20d_percent: feature.trailingVolatility20dPercent,
      trailing_drawdown_20d_percent: feature.trailingDrawdown20dPercent,
      volume_ratio_20d_percent: feature.volumeRatio20dPercent,
      available_event_count: feature.availableEventCount,
      high_impact_event_count: feature.highImpactEventCount,
      medium_impact_event_count: feature.mediumImpactEventCount,
      low_impact_event_count: feature.lowImpactEventCount,
      event_ticker_count: feature.eventTickerCount,
      event_type_counts: feature.eventTypeCounts,
      input_price_source: feature.inputPriceSource,
      input_price_captured_at: feature.inputPriceCapturedAt,
      input_event_max_available_at: feature.inputEventMaxAvailableAt,
      computed_at: feature.computedAt,
      updated_at: computedAt
    };
  }));

  return {
    symbol: normalizedSymbol,
    featuresWritten: features.length,
    firstDate,
    lastDate,
    featureVersion: features[0].featureVersion,
    knownEventDays: features.filter(function (feature) { return feature.availableEventCount > 0; }).length,
    reportedEarningsFeatureEvents: reportedEarnings.length
  };
}

async function getStoredDailyFeatures(symbol, limit, date) {
  const normalizedSymbol = normalizeSymbol(symbol || "QQQ");
  const normalizedLimit = normalizeHistoryLimit(limit);
  const normalizedDate = normalizeFeatureDate(date);
  const config = getSupabaseConfig();
  const instrumentRows = await requestSupabase(config, "/rest/v1/instruments?select=id,symbol,display_name&symbol=eq." + encodeURIComponent(normalizedSymbol) + "&limit=1");
  const instrument = Array.isArray(instrumentRows) ? instrumentRows[0] : null;
  if (!instrument) throw new Error("Instrument is not registered: " + normalizedSymbol);
  const columns = [
    "market_date", "feature_version", "feature_as_of", "return_1d_percent", "return_5d_percent", "return_20d_percent",
    "gap_percent", "trailing_volatility_20d_percent", "trailing_drawdown_20d_percent", "volume_ratio_20d_percent",
    "available_event_count", "high_impact_event_count", "medium_impact_event_count", "low_impact_event_count",
    "event_ticker_count", "event_type_counts", "input_price_source", "input_price_captured_at", "input_event_max_available_at", "computed_at"
  ].join(",");
  const basePath = "/rest/v1/daily_market_features?select=" + columns
    + "&instrument_id=eq." + instrument.id
    + (normalizedDate ? "&market_date=eq." + normalizedDate : "")
    + "&order=market_date.desc";
  const rows = [];
  while (rows.length < (normalizedDate ? 1 : normalizedLimit)) {
    const pageSize = Math.min(1000, (normalizedDate ? 1 : normalizedLimit) - rows.length);
    const page = await requestSupabase(config, basePath + "&limit=" + pageSize + "&offset=" + rows.length);
    const pageRows = Array.isArray(page) ? page : [];
    rows.push(...pageRows);
    if (pageRows.length < pageSize) break;
  }
  return { instrument, features: (Array.isArray(rows) ? rows : []).reverse() };
}

module.exports = { getStoredDailyFeatures, normalizeFeatureDate, rebuildDailyFeatures, upsertFeatures };
