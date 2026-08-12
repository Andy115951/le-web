const { rehashResearchPacketSnapshots } = require("../lib/research-packet-snapshots");

rehashResearchPacketSnapshots().then(function (result) {
  console.log(JSON.stringify(result, null, 2));
}).catch(function (error) {
  console.error("Research packet fingerprint migration failed:", error?.message || error);
  process.exitCode = 1;
});
