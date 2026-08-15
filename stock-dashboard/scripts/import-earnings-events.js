const fs = require("fs");
const path = require("path");
const { buildEarningsImportRecords, persistEarningsImport } = require("../lib/earnings-calendar");
const { getSupabaseConfig } = require("../lib/supabase-server");

const inputPath = process.argv.slice(2).find(function (argument) { return argument !== "--approve"; });
if (!inputPath || !process.argv.includes("--approve")) {
  process.stderr.write("Review an official IR candidate first, then run: node scripts/import-earnings-events.js <candidate.json> --approve\n");
  process.exitCode = 1;
} else {
  try {
    const input = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), inputPath), "utf8"));
    const candidates = Array.isArray(input) ? input : input?.events;
    const records = buildEarningsImportRecords(candidates);
    persistEarningsImport(getSupabaseConfig(), records).then(function (result) {
      process.stdout.write(JSON.stringify({ candidateCount: records.events.length, ...result }, null, 2) + "\n");
    }).catch(function (error) {
      process.stderr.write((error?.message || String(error)) + "\n");
      process.exitCode = 1;
    });
  } catch (error) {
    process.stderr.write((error?.message || String(error)) + "\n");
    process.exitCode = 1;
  }
}
