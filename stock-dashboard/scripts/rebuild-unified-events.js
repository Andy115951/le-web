const { getNasdaqMarketHistory } = require("../lib/market-history-capture");
const { getSupabaseConfig } = require("../lib/supabase-server");
const { persistUnifiedMarketEvents } = require("../lib/unified-market-events");

const days = [30, 90, 180].includes(Number(process.argv[2])) ? Number(process.argv[2]) : 180;

getNasdaqMarketHistory(days).then(async function (history) {
  const events = history.map(function (row) {
    return {
      symbol: row.symbol,
      name: row.display_name,
      date: row.market_date,
      eventTime: row.event_time,
      availableAt: row.available_at,
      capturedAt: row.captured_at,
      changePercent: row.change_percent,
      benchmarkChangePercent: row.benchmark_change_percent,
      driverType: row.driver_type,
      confidence: row.confidence,
      summary: row.summary,
      reasons: row.reasons,
      news: row.news
    };
  });
  const result = await persistUnifiedMarketEvents(getSupabaseConfig(), events);
  return { days, legacySnapshotsRead: history.length, ...result };
}).then(function (result) {
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}).catch(function (error) {
  process.stderr.write((error?.message || String(error)) + "\n");
  process.exitCode = 1;
});
