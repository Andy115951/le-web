const { fetchYahooDailyBars, normalizeRange, normalizeSymbol } = require("./historical-market-data");
const { getSupabaseConfig, requestSupabase } = require("./supabase-server");

const SOURCE = "Yahoo Finance chart";

async function upsertRows(config, table, conflictColumns, rows) {
  for (let index = 0; index < rows.length; index += 250) {
    await requestSupabase(config, "/rest/v1/" + table + "?on_conflict=" + conflictColumns, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: rows.slice(index, index + 250)
    });
  }
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

async function backfillDailyPrices(symbol, range) {
  const normalizedSymbol = normalizeSymbol(symbol || "QQQ");
  const normalizedRange = normalizeRange(range);
  const config = getSupabaseConfig();
  const [instrument, snapshot] = await Promise.all([
    getInstrument(config, normalizedSymbol),
    fetchYahooDailyBars(normalizedSymbol, normalizedRange)
  ]);
  const capturedAt = new Date().toISOString();

  await upsertRows(config, "market_days", "market_date", snapshot.bars.map(function (bar) {
    return {
      market_date: bar.marketDate,
      exchange: "XNAS",
      is_trading_day: true,
      session_status: "closed",
      source: SOURCE,
      updated_at: capturedAt
    };
  }));

  await upsertRows(config, "price_bars_daily", "instrument_id,market_date", snapshot.bars.map(function (bar) {
    return {
      instrument_id: instrument.id,
      market_date: bar.marketDate,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      adjusted_close: bar.adjustedClose,
      volume: bar.volume,
      change_percent: bar.changePercent,
      source: SOURCE,
      captured_at: capturedAt,
      updated_at: capturedAt
    };
  }));

  return {
    symbol: normalizedSymbol,
    range: normalizedRange,
    firstDate: snapshot.bars[0].marketDate,
    lastDate: snapshot.bars[snapshot.bars.length - 1].marketDate,
    barsWritten: snapshot.bars.length,
    source: SOURCE
  };
}

function normalizeHistoryLimit(value) {
  const limit = Number(value) || 365;
  return Math.min(2600, Math.max(30, Math.round(limit)));
}

async function getStoredDailyPrices(symbol, limit) {
  const normalizedSymbol = normalizeSymbol(symbol || "QQQ");
  const normalizedLimit = normalizeHistoryLimit(limit);
  const config = getSupabaseConfig();
  const instrument = await getInstrument(config, normalizedSymbol);
  const columns = "market_date,open,high,low,close,adjusted_close,volume,change_percent,source,captured_at";
  const rows = [];

  // PostgREST projects commonly cap one response at 1,000 rows.
  while (rows.length < normalizedLimit) {
    const pageSize = Math.min(1000, normalizedLimit - rows.length);
    const page = await requestSupabase(
      config,
      "/rest/v1/price_bars_daily?select=" + columns
        + "&instrument_id=eq." + instrument.id
        + "&order=market_date.desc"
        + "&limit=" + pageSize
        + "&offset=" + rows.length
    );
    const pageRows = Array.isArray(page) ? page : [];
    rows.push(...pageRows);
    if (pageRows.length < pageSize) break;
  }

  return {
    instrument,
    prices: rows.reverse()
  };
}

module.exports = { backfillDailyPrices, getStoredDailyPrices, normalizeHistoryLimit };
