const fs = require("fs");
const path = require("path");
const { buildEarningsImportPreview, buildEarningsImportRecords, persistEarningsImport } = require("../lib/earnings-calendar");
const { getSupabaseConfig } = require("../lib/supabase-server");

const inputPath = process.argv.slice(2).find(function (argument) { return argument !== "--approve"; });
const approved = process.argv.includes("--approve");
if (!inputPath) {
  process.stderr.write("Preview an official IR candidate first: node scripts/import-earnings-events.js <candidate.json>\n");
  process.exitCode = 1;
} else {
  try {
    const input = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), inputPath), "utf8"));
    const candidates = Array.isArray(input) ? input : input?.events;
    const records = buildEarningsImportRecords(candidates);
    const preview = buildEarningsImportPreview(records);
    if (!approved) {
      process.stdout.write(JSON.stringify({ mode: "dry_run", ...preview, nextStep: "Re-run the same command with --approve only after reviewing this plan." }, null, 2) + "\n");
    } else {
      persistEarningsImport(getSupabaseConfig(), records).then(function (result) {
        process.stdout.write(JSON.stringify({ mode: "approved_import", ...preview, ...result }, null, 2) + "\n");
      }).catch(function (error) {
        process.stderr.write((error?.message || String(error)) + "\n");
        process.exitCode = 1;
      });
    }
  } catch (error) {
    process.stderr.write((error?.message || String(error)) + "\n");
    process.exitCode = 1;
  }
}
