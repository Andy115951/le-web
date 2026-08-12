const path = require("path");
const { importNdxSnapshot } = require("../lib/ndx-snapshots");

const inputPath = process.argv[2] || "../data/ndx/2026-05-01.json";
const snapshot = require(path.resolve(__dirname, inputPath));

importNdxSnapshot(snapshot).then(function (result) {
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}).catch(function (error) {
  process.stderr.write((error?.message || String(error)) + "\n");
  process.exitCode = 1;
});
