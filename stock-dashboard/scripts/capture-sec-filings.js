const { NASDAQ_FOCUS_INSTRUMENTS } = require("../lib/nasdaq-universe");
const { getSupabaseConfig } = require("../lib/supabase-server");
const { captureRecentSecFilings } = require("../lib/sec-edgar");

const requestedSymbols = String(process.argv[2] || "").split(",")
  .map(function (symbol) { return symbol.trim().toUpperCase(); })
  .filter(Boolean);
const symbols = requestedSymbols.length
  ? requestedSymbols
  : NASDAQ_FOCUS_INSTRUMENTS.map(function (instrument) { return instrument.symbol; });

captureRecentSecFilings(getSupabaseConfig(), symbols).then(function (result) {
  process.stdout.write(JSON.stringify({
    fetchedCompanies: result.fetchedCompanies,
    skippedSymbols: result.skippedSymbols,
    filingsFound: result.filings.length,
    eventsWritten: result.eventsWritten,
    sourcesWritten: result.sourcesWritten,
    sinceDate: result.sinceDate
  }, null, 2) + "\n");
}).catch(function (error) {
  process.stderr.write((error?.message || String(error)) + "\n");
  process.exitCode = 1;
});
