const { backfillDailyPrices } = require("../lib/price-history-store");

const symbol = process.argv[2] || "QQQ";
const range = process.argv[3] || "5y";

backfillDailyPrices(symbol, range).then(function (result) {
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}).catch(function (error) {
  process.stderr.write((error?.message || String(error)) + "\n");
  process.exitCode = 1;
});
