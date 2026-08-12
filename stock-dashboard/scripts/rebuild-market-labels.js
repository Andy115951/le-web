const { rebuildForwardLabels } = require("../lib/market-label-store");

const symbol = process.argv[2] || "QQQ";

rebuildForwardLabels(symbol).then(function (result) {
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}).catch(function (error) {
  process.stderr.write((error?.message || String(error)) + "\n");
  process.exitCode = 1;
});
