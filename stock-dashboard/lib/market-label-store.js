const { normalizeSymbol } = require("./historical-market-data");
const { calculateForwardLabels } = require("./market-forward-labels");
const { getStoredDailyPrices, normalizeHistoryLimit } = require("./price-history-store");
const { getSupabaseConfig, requestSupabase } = require("./supabase-server");

async function getInstrument(config, symbol) {
  const rows = await requestSupabase(
    config,
    "/rest/v1/instruments?select=id,symbol,display_name&symbol=eq." + encodeURIComponent(symbol) + "&limit=1"
  );
  const instrument = Array.isArray(rows) ? rows[0] : null;
  if (!instrument) throw new Error("Instrument is not registered: " + symbol);
  return instrument;
}

async function upsertLabels(config, rows) {
  for (let index = 0; index < rows.length; index += 250) {
    await requestSupabase(config, "/rest/v1/market_forward_labels?on_conflict=instrument_id,market_date", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: rows.slice(index, index + 250)
    });
  }
}

async function rebuildForwardLabels(symbol) {
  const normalizedSymbol = normalizeSymbol(symbol || "QQQ");
  const config = getSupabaseConfig();
  const history = await getStoredDailyPrices(normalizedSymbol, 2600);
  if (!history.prices.length) throw new Error("No stored daily prices for " + normalizedSymbol);
  const computedAt = new Date().toISOString();
  const labels = calculateForwardLabels(history.prices, computedAt);

  await upsertLabels(config, labels.map(function (label) {
    return {
      instrument_id: history.instrument.id,
      market_date: label.marketDate,
      return_1d_percent: label.return1dPercent,
      return_3d_percent: label.return3dPercent,
      return_5d_percent: label.return5dPercent,
      return_20d_percent: label.return20dPercent,
      max_drawdown_20d_percent: label.maxDrawdown20dPercent,
      realized_volatility_20d_percent: label.realizedVolatility20dPercent,
      price_basis: label.priceBasis,
      horizon_unit: label.horizonUnit,
      label_version: label.labelVersion,
      computed_at: label.computedAt,
      updated_at: computedAt
    };
  }));

  return {
    symbol: normalizedSymbol,
    labelsWritten: labels.length,
    mature20dLabels: labels.filter(function (label) { return label.return20dPercent !== null; }).length,
    firstDate: labels[0].marketDate,
    lastDate: labels[labels.length - 1].marketDate,
    labelVersion: labels[0].labelVersion
  };
}

async function getStoredForwardLabels(symbol, limit) {
  const normalizedSymbol = normalizeSymbol(symbol || "QQQ");
  const normalizedLimit = normalizeHistoryLimit(limit);
  const config = getSupabaseConfig();
  const instrument = await getInstrument(config, normalizedSymbol);
  const columns = [
    "market_date",
    "return_1d_percent",
    "return_3d_percent",
    "return_5d_percent",
    "return_20d_percent",
    "max_drawdown_20d_percent",
    "realized_volatility_20d_percent",
    "price_basis",
    "horizon_unit",
    "label_version",
    "computed_at"
  ].join(",");
  const rows = [];

  while (rows.length < normalizedLimit) {
    const pageSize = Math.min(1000, normalizedLimit - rows.length);
    const page = await requestSupabase(
      config,
      "/rest/v1/market_forward_labels?select=" + columns
        + "&instrument_id=eq." + instrument.id
        + "&order=market_date.desc"
        + "&limit=" + pageSize
        + "&offset=" + rows.length
    );
    const pageRows = Array.isArray(page) ? page : [];
    rows.push(...pageRows);
    if (pageRows.length < pageSize) break;
  }

  return { instrument, labels: rows.reverse() };
}

module.exports = { getStoredForwardLabels, rebuildForwardLabels };
