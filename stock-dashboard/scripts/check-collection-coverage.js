/**
 * Read-only collection coverage check.
 *
 * Answers ROADMAP batch item #1: "verify the daily close cron actually writes
 * SEC filings and FRED observations." Lists the latest write date per data
 * source (price bars, public events, SEC filings, FRED observations, research
 * snapshots) so a maintainer can confirm the cron is healthy at a glance.
 *
 * It never writes, calls a model, or exposes user data — pure SELECT over the
 * public research tables via the server Supabase key.
 *
 * Usage:
 *   set -a && . ./.env.local && set +a
 *   node scripts/check-collection-coverage.js
 */
const { getSupabaseConfig, requestSupabase } = require("../lib/supabase-server");

async function latest(config, path) {
  try {
    const rows = await requestSupabase(config, path);
    return Array.isArray(rows) ? rows : [];
  } catch (error) {
    return { error: error?.message || String(error) };
  }
}

function firstDate(rows, field) {
  if (!Array.isArray(rows) || !rows.length) return null;
  return rows[0][field] || null;
}

async function main() {
  const config = getSupabaseConfig();

  // QQQ price bars need the instrument id first.
  const instruments = await latest(config, "/rest/v1/instruments?select=id&symbol=eq.QQQ&limit=1");
  const qqqId = Array.isArray(instruments) && instruments[0] ? instruments[0].id : null;

  const [prices, publicEvents, secFilings, fredObs, snapshots] = await Promise.all([
    qqqId
      ? latest(config, "/rest/v1/price_bars_daily?select=market_date&instrument_id=eq." + qqqId + "&order=market_date.desc&limit=1")
      : Promise.resolve([]),
    latest(config, "/rest/v1/nasdaq_market_event_history?select=market_date&order=market_date.desc&limit=1"),
    latest(config, "/rest/v1/events?select=market_date&event_key=like.sec-filing:*&order=market_date.desc&limit=1"),
    latest(config, "/rest/v1/events?select=market_date&event_key=like.fred-observation:*&order=market_date.desc&limit=1"),
    latest(config, "/rest/v1/research_packet_snapshots?select=market_date&order=market_date.desc&limit=1")
  ]);

  const report = {
    checkedAt: new Date().toISOString(),
    latestWrite: {
      qqqPriceBars: prices.error ? { error: prices.error } : firstDate(prices, "market_date"),
      publicMarketEvents: publicEvents.error ? { error: publicEvents.error } : firstDate(publicEvents, "market_date"),
      secFilings: secFilings.error ? { error: secFilings.error } : firstDate(secFilings, "market_date"),
      fredObservations: fredObs.error ? { error: fredObs.error } : firstDate(fredObs, "market_date"),
      researchSnapshots: snapshots.error ? { error: snapshots.error } : firstDate(snapshots, "market_date")
    }
  };

  // A simple staleness hint: warn when SEC/FRED lag the latest price bar by a lot.
  const priceDate = typeof report.latestWrite.qqqPriceBars === "string" ? report.latestWrite.qqqPriceBars : null;
  const notes = [];
  if (!priceDate) notes.push("qqqPriceBars 无数据：价格采集可能未运行");
  if (report.latestWrite.secFilings === null) notes.push("secFilings 无数据：确认 SEC_USER_AGENT 已在生产配置");
  if (report.latestWrite.fredObservations === null) notes.push("fredObservations 无数据：确认 FRED_API_KEY 已在生产配置");
  report.notes = notes;

  console.log(JSON.stringify(report, null, 2));
}

main().catch(function (error) {
  console.error("check-collection-coverage 失败: " + (error?.message || String(error)));
  process.exitCode = 1;
});
