const path = require("path");
const { importNdxSnapshot } = require("../lib/ndx-snapshots");

const inputPath = process.argv.slice(2).find(function (argument) { return argument !== "--approve"; });
if (!inputPath || !process.argv.includes("--approve")) {
  process.stderr.write("Review the candidate first, then run: node scripts/import-ndx-snapshot.js <candidate.json> --approve\n");
  process.exitCode = 1;
} else {
  const snapshot = require(path.resolve(__dirname, inputPath));

  importNdxSnapshot(snapshot).then(function (result) {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  }).catch(function (error) {
    process.stderr.write((error?.message || String(error)) + "\n");
    process.exitCode = 1;
  });
}
