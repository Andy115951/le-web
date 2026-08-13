const { getSupabaseConfig } = require("../lib/supabase-server");
const { getUnifiedMarketEventsRange } = require("../lib/unified-market-events");
const { buildMarketEventAttributionRecords, runMarketAttributionAgent } = require("../lib/market-attribution-agent");
const { buildEventRuleLabelRecords, runEventLabelerAgent } = require("../lib/event-labeler-agent");

const marketDate = String(process.argv[2] || "").trim();
const apply = process.argv.includes("--apply");

function normalizeDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || new Date(value + "T12:00:00.000Z").toISOString().slice(0, 10) !== value) {
    throw new Error("Usage: npm run agents:replay -- YYYY-MM-DD [--apply]");
  }
  return value;
}

async function run() {
  const date = normalizeDate(marketDate);
  const config = getSupabaseConfig();
  const events = await getUnifiedMarketEventsRange(date, date, { includeRelations: true });
  if (!apply) {
    const attributionRecords = buildMarketEventAttributionRecords(events);
    const labelRecords = buildEventRuleLabelRecords(events);
    process.stdout.write(JSON.stringify({
      mode: "preview",
      marketDate: date,
      sourceEvents: events.length,
      attributionCandidates: attributionRecords.length,
      labelCandidates: labelRecords.length,
      note: "No database writes, model calls, web requests, or human-review changes were made. Re-run with --apply to append derived records."
    }, null, 2) + "\n");
    return;
  }
  const [attribution, labeling] = await Promise.all([
    runMarketAttributionAgent({ marketDate: date, config }),
    runEventLabelerAgent({ marketDate: date, config })
  ]);
  process.stdout.write(JSON.stringify({
    mode: "apply",
    marketDate: date,
    attribution,
    labeling,
    note: "Only append-only derived records were written; raw events and human review decisions were not changed."
  }, null, 2) + "\n");
}

run().catch(function (error) {
  process.stderr.write((error?.message || String(error)) + "\n");
  process.exitCode = 1;
});
