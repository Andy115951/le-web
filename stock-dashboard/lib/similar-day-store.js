const { normalizeSymbol } = require("./historical-market-data");
const { getStoredDailyFeatures, normalizeFeatureDate } = require("./daily-feature-store");
const { getStoredForwardLabels } = require("./market-label-store");
const { SIMILARITY_METHOD_VERSION, findSimilarDays } = require("./similar-days");
const { getSupabaseConfig, requestSupabase } = require("./supabase-server");

function normalizeSimilarLimit(value) {
  const limit = Number(value) || 5;
  return Math.min(10, Math.max(1, Math.round(limit)));
}

async function getInstrument(config, symbol) {
  const rows = await requestSupabase(
    config,
    "/rest/v1/instruments?select=id,symbol,display_name&symbol=eq." + encodeURIComponent(symbol) + "&limit=1"
  );
  const instrument = Array.isArray(rows) ? rows[0] : null;
  if (!instrument) throw new Error("Instrument is not registered: " + symbol);
  return instrument;
}

async function upsertSimilarMatches(config, rows) {
  for (let index = 0; index < rows.length; index += 250) {
    await requestSupabase(config, "/rest/v1/similar_day_matches?on_conflict=target_instrument_id,target_market_date,method_version,rank", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: rows.slice(index, index + 250)
    });
  }
}

async function rebuildSimilarDayMatches(symbol) {
  const normalizedSymbol = normalizeSymbol(symbol || "QQQ");
  const config = getSupabaseConfig();
  const [featureData, labelData] = await Promise.all([
    getStoredDailyFeatures(normalizedSymbol, 2600),
    getStoredForwardLabels(normalizedSymbol, 2600)
  ]);
  if (!featureData.features.length) throw new Error("No stored daily features for " + normalizedSymbol);
  const computedAt = new Date().toISOString();
  const rows = [];
  featureData.features.forEach(function (target) {
    const result = findSimilarDays({
      features: featureData.features,
      labels: labelData.labels,
      targetDate: target.market_date,
      maxResults: 5
    });
    result.matches.forEach(function (match) {
      rows.push({
        target_instrument_id: featureData.instrument.id,
        target_market_date: target.market_date,
        candidate_instrument_id: featureData.instrument.id,
        candidate_market_date: match.candidate.market_date,
        method_version: result.methodVersion,
        rank: match.rank,
        similarity_score: match.score,
        momentum_score: match.components.momentum ?? null,
        risk_score: match.components.risk ?? null,
        participation_score: match.components.participation ?? null,
        event_score: match.components.event ?? null,
        used_feature_keys: match.usedFeatureKeys,
        normalization_start_date: result.normalization.startDate,
        normalization_end_date: result.normalization.endDate,
        normalization_sample_count: result.normalization.sampleCount,
        candidate_return_1d_percent: match.outcome.return1dPercent,
        candidate_return_3d_percent: match.outcome.return3dPercent,
        candidate_return_5d_percent: match.outcome.return5dPercent,
        candidate_return_20d_percent: match.outcome.return20dPercent,
        candidate_max_drawdown_20d_percent: match.outcome.maxDrawdown20dPercent,
        candidate_realized_volatility_20d_percent: match.outcome.realizedVolatility20dPercent,
        computed_at: computedAt,
        updated_at: computedAt
      });
    });
  });

  // This table is derived exclusively from the current feature and label versions.
  // Replacing one instrument/method slice prevents stale ranks after an idempotent rebuild.
  await requestSupabase(config, "/rest/v1/similar_day_matches?target_instrument_id=eq." + featureData.instrument.id
    + "&method_version=eq." + encodeURIComponent(SIMILARITY_METHOD_VERSION), { method: "DELETE" });
  await upsertSimilarMatches(config, rows);
  return {
    symbol: normalizedSymbol,
    targetsProcessed: featureData.features.length,
    matchesWritten: rows.length,
    firstTargetDate: featureData.features[0].market_date,
    lastTargetDate: featureData.features.at(-1).market_date,
    methodVersion: SIMILARITY_METHOD_VERSION
  };
}

async function getStoredSimilarDays(symbol, date, limit) {
  const normalizedSymbol = normalizeSymbol(symbol || "QQQ");
  const normalizedDate = normalizeFeatureDate(date);
  const normalizedLimit = normalizeSimilarLimit(limit);
  const config = getSupabaseConfig();
  const instrument = await getInstrument(config, normalizedSymbol);
  const featureColumns = "market_date,feature_version,feature_as_of,return_1d_percent,return_5d_percent,return_20d_percent,gap_percent,trailing_volatility_20d_percent,trailing_drawdown_20d_percent,volume_ratio_20d_percent,available_event_count,high_impact_event_count,medium_impact_event_count,low_impact_event_count,event_ticker_count,event_type_counts";
  const featureRows = await requestSupabase(config, "/rest/v1/daily_market_features?select=" + featureColumns
    + "&instrument_id=eq." + instrument.id
    + (normalizedDate ? "&market_date=eq." + normalizedDate : "")
    + "&order=market_date.desc&limit=1");
  const target = Array.isArray(featureRows) ? featureRows[0] : null;
  if (!target) return { instrument, target: null, matches: [], methodVersion: SIMILARITY_METHOD_VERSION };
  const columns = [
    "rank", "similarity_score", "momentum_score", "risk_score", "participation_score", "event_score", "used_feature_keys",
    "normalization_start_date", "normalization_end_date", "normalization_sample_count", "candidate_market_date",
    "candidate_return_1d_percent", "candidate_return_3d_percent", "candidate_return_5d_percent", "candidate_return_20d_percent",
    "candidate_max_drawdown_20d_percent", "candidate_realized_volatility_20d_percent", "computed_at"
  ].join(",");
  const rows = await requestSupabase(config, "/rest/v1/similar_day_matches?select=" + columns
    + "&target_instrument_id=eq." + instrument.id
    + "&target_market_date=eq." + target.market_date
    + "&method_version=eq." + encodeURIComponent(SIMILARITY_METHOD_VERSION)
    + "&order=rank.asc&limit=" + normalizedLimit);
  return { instrument, target, matches: Array.isArray(rows) ? rows : [], methodVersion: SIMILARITY_METHOD_VERSION };
}

module.exports = { getStoredSimilarDays, normalizeSimilarLimit, rebuildSimilarDayMatches };
